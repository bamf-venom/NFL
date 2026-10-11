// ==================== NFL POINTS - Anstoßzeiten mit ESPN abgleichen ====================
// Hintergrund (2026-10-11): Die Spiele einer Saison werden einmalig angelegt
// (add-season-2026.html) und danach nie mehr mit dem Spielplan abgeglichen. Ändert die
// NFL später die Anstoßzeit (Flex-Scheduling, Verlegungen), blieb in Firestore die
// alte Zeit stehen. check-scores.js betrachtet aber nur Spiele, deren game_date schon
// vorbei ist - ein bereits laufendes Spiel mit zu später Zeit blieb deshalb auf
// "geplant" und war weiter tippbar (Packers - Bears, Woche 5: eingetragen 22:25,
// tatsächlich 19:00 Uhr).
//
// Dieses Skript gleicht Anstoßzeit, Heim/Auswärts, Woche, Teamnamen und Endstände mit ESPN ab
// und kann abweichende Anstoßzeiten korrigieren:
//
//   node sync-game-times.js                      Trockenlauf: nur berichten, nichts schreiben
//   node sync-game-times.js --apply              abweichende Zeiten korrigieren
//   node sync-game-times.js --scope=all --seasons=2025,2026
//                                                komplette Saison(en) prüfen (Standard: window =
//                                                nur nicht beendete Spiele der nächsten 14 Tage)
//   node sync-game-times.js --apply --hourly     wie --apply, läuft aber nur in den ersten 10
//                                                Minuten jeder Stunde (für den 5-Minuten-Takt)
//
// Korrigiert wird NUR game_date von Spielen mit Status scheduled/live, deren ESPN-Zeit
// als gültig markiert ist. Beendete Spiele, Endstände und Status fasst das Skript nicht
// an (Status/Stände pflegt check-scores.js). Mit der neuen Anstoßzeit werden auch die
// gespeicherten Sperrzeiten (betting_lock_time) der bestehenden Tipps nachgezogen -
// Ändern/Löschen von Tipps prüft diese Zeit am Tipp selbst, nicht am Spiel.
//
// In den Ausgaben stehen bewusst keine Nutzernamen (die Logs öffentlicher Repos sind
// öffentlich) - nur Spiele und Anzahlen.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ---- Team-Abkürzungen: ESPN -> unsere Datenbank (wie in check-scores.js) ----
const ESPN_ABBR_TO_OURS = { WSH: 'WAS' };
const ourAbbr = (abbr) => ESPN_ABBR_TO_OURS[abbr] || abbr;

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
// Unsere Wochen 19-22 (Playoffs) sind bei ESPN seasontype=3 mit den Wochen 1, 2, 3 und 5
const PLAYOFF_WEEK_TO_ESPN = { 19: 1, 20: 2, 21: 3, 22: 5 };

const TIME_TOLERANCE_MS = 60 * 1000; // Abweichungen unter einer Minute ignorieren
const FIRESTORE_BATCH_LIMIT = 400;

// ESPN-Abfrage für eine unserer Wochen. WICHTIG: ESPN ignoriert den Parameter `year=` und
// liefert dann immer die aktuelle Saison - nur `dates=<Saison>` wählt die Saison wirklich.
function espnRequestFor(season, week) {
  if (week >= 19) {
    return { url: `${ESPN_SCOREBOARD}?dates=${season}&seasontype=3&week=${PLAYOFF_WEEK_TO_ESPN[week]}`, seasonType: 3, espnWeek: PLAYOFF_WEEK_TO_ESPN[week] };
  }
  return { url: `${ESPN_SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`, seasonType: 2, espnWeek: week };
}

// ESPN-Event -> schlanker Datensatz
function normalizeEspnEvent(event) {
  const comp = event.competitions && event.competitions[0];
  if (!comp || !comp.competitors) return null;
  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return null;
  const statusType = (comp.status && comp.status.type) || {};
  const score = (c) => (c.score !== undefined && c.score !== '' ? parseInt(c.score, 10) : null);
  return {
    id: event.id,
    home: ourAbbr(home.team.abbreviation),
    away: ourAbbr(away.team.abbreviation),
    homeName: home.team.displayName,
    awayName: away.team.displayName,
    date: new Date(event.date),
    timeValid: comp.timeValid !== false,
    state: statusType.state, // pre | in | post
    completed: statusType.completed === true,
    homeScore: score(home),
    awayScore: score(away),
  };
}

async function fetchEspnWeek(season, week) {
  const req = espnRequestFor(season, week);
  const res = await fetch(req.url);
  if (!res.ok) throw new Error(`ESPN-Fehler ${res.status} für Saison ${season} Woche ${week}`);
  const data = await res.json();
  // Absicherung: stimmt die Antwort überhaupt mit der Anfrage überein?
  const gotYear = data.season && data.season.year;
  const gotType = data.season && data.season.type;
  const gotWeek = data.week && data.week.number;
  if (Number(gotYear) !== Number(season) || gotType !== req.seasonType || gotWeek !== req.espnWeek) {
    throw new Error(`ESPN lieferte Saison ${gotYear}/Typ ${gotType}/Woche ${gotWeek} statt ${season}/${req.seasonType}/${req.espnWeek}`);
  }
  return (data.events || []).map(normalizeEspnEvent).filter(Boolean);
}

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const EXPECTED_STATUS = { pre: 'scheduled', in: 'live', post: 'finished' };

// Vergleicht Firestore-Spiele mit ESPN. Reine Funktion (ohne Netz/Datenbank), damit sie
// sich mit Testdaten prüfen lässt.
//   fsGames:   [{ id, season, week, home_team_abbr, away_team_abbr, game_date (Date|Timestamp), status, home_score, away_score }]
//   espnByKey: Map "<Saison>|<Woche>" -> [normalisierte ESPN-Events]
//   options.completeSeasons: Saisons (Strings), für die ALLE Spiele geladen wurden - nur dort
//                            kann gemeldet werden, dass ein ESPN-Spiel in Firestore fehlt
// Rückgabe: Liste von Befunden { type, game, ev, ... }
function auditGames(fsGames, espnByKey, options = {}) {
  const findings = [];
  const usedEspn = new Set();
  const seen = new Map();

  for (const game of fsGames) {
    const season = String(game.season);
    const week = Number(game.week);
    const events = espnByKey.get(`${season}|${week}`) || [];
    const pairKey = `${season}|${week}|${game.home_team_abbr}|${game.away_team_abbr}`;
    seen.set(pairKey, (seen.get(pairKey) || 0) + 1);

    let ev = events.find(e => e.home === game.home_team_abbr && e.away === game.away_team_abbr);
    if (!ev) {
      const swapped = events.find(e => e.home === game.away_team_abbr && e.away === game.home_team_abbr);
      if (swapped) {
        usedEspn.add(`${season}|${week}|${swapped.id}`);
        findings.push({ type: 'home_away', game, ev: swapped });
        continue;
      }
      let elsewhere = null;
      for (const [key, list] of espnByKey) {
        if (!key.startsWith(`${season}|`) || key === `${season}|${week}`) continue;
        const hit = list.find(e => (e.home === game.home_team_abbr && e.away === game.away_team_abbr) ||
                                   (e.home === game.away_team_abbr && e.away === game.home_team_abbr));
        if (hit) { elsewhere = { key, hit }; break; }
      }
      if (elsewhere) {
        usedEspn.add(`${elsewhere.key}|${elsewhere.hit.id}`);
        findings.push({ type: 'andere_woche', game, ev: elsewhere.hit, espnWeek: Number(elsewhere.key.split('|')[1]) });
      } else {
        findings.push({ type: 'kein_match', game });
      }
      continue;
    }
    usedEspn.add(`${season}|${week}|${ev.id}`);

    const fsDate = toDate(game.game_date);
    if (!fsDate) {
      findings.push({ type: 'zeit', game, ev, diffMs: null });
    } else {
      const diffMs = ev.date.getTime() - fsDate.getTime();
      if (Math.abs(diffMs) >= TIME_TOLERANCE_MS) findings.push({ type: 'zeit', game, ev, diffMs });
    }

    // Teamnamen (Anzeige in der App) müssen zu den Kürzeln passen
    const sameName = (a, b) => !a || !b || String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    if (!sameName(game.home_team, ev.homeName) || !sameName(game.away_team, ev.awayName)) {
      findings.push({ type: 'teamname', game, ev });
    }

    const expected = EXPECTED_STATUS[ev.state];
    if (expected && game.status !== expected) {
      findings.push({ type: 'status', game, ev, expected });
    }
    // Endstand: bei beendeten Spielen auf beiden Seiten muss er identisch sein
    if (game.status === 'finished' && ev.completed &&
        (Number(game.home_score) !== ev.homeScore || Number(game.away_score) !== ev.awayScore)) {
      findings.push({ type: 'endstand', game, ev });
    }
  }

  for (const [pairKey, count] of seen) {
    if (count > 1) findings.push({ type: 'doppelt', pairKey, count });
  }

  for (const season of options.completeSeasons || []) {
    for (const [key, list] of espnByKey) {
      if (!key.startsWith(`${season}|`)) continue;
      for (const ev of list) {
        if (!usedEspn.has(`${key}|${ev.id}`)) findings.push({ type: 'fehlt_in_firestore', season, week: Number(key.split('|')[1]), ev });
      }
    }
  }
  return findings;
}

// ---------- Ausgabe ----------
const fmtUtc = (d) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') + 'Z' : 'unbekannt');
const fmtBerlin = (d) => (d ? d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const gameLabel = (g) => `${g.season} W${g.week} ${g.away_team_abbr} @ ${g.home_team_abbr}`;

function describeFinding(f) {
  switch (f.type) {
    case 'zeit': {
      const fsDate = toDate(f.game.game_date);
      const diffMin = f.diffMs === null ? '?' : Math.round(f.diffMs / 60000);
      return `ZEIT        ${gameLabel(f.game)} [${f.game.status}]: Firestore ${fmtUtc(fsDate)} (${fmtBerlin(fsDate)}), ESPN ${fmtUtc(f.ev.date)} (${fmtBerlin(f.ev.date)}), Differenz ${diffMin} min${f.ev.timeValid ? '' : ' - ESPN-Zeit noch nicht festgelegt'}`;
    }
    case 'status':
      return `STATUS      ${gameLabel(f.game)}: Firestore "${f.game.status}", ESPN meldet "${f.ev.state}" (erwartet "${f.expected}")`;
    case 'endstand':
      return `ENDSTAND    ${gameLabel(f.game)}: Firestore ${f.game.away_score}:${f.game.home_score}, ESPN ${f.ev.awayScore}:${f.ev.homeScore} (Gast:Heim)`;
    case 'teamname':
      return `TEAMNAME    ${gameLabel(f.game)}: Firestore "${f.game.away_team}" @ "${f.game.home_team}", ESPN "${f.ev.awayName}" @ "${f.ev.homeName}"`;
    case 'home_away':
      return `HEIM/GAST   ${gameLabel(f.game)}: bei ESPN ist es ${f.ev.away} @ ${f.ev.home}`;
    case 'andere_woche':
      return `WOCHE       ${gameLabel(f.game)}: bei ESPN in Woche ${f.espnWeek}`;
    case 'kein_match':
      return `KEIN MATCH  ${gameLabel(f.game)}: bei ESPN nicht gefunden`;
    case 'doppelt':
      return `DOPPELT     ${f.pairKey}: ${f.count} Dokumente für dasselbe Spiel`;
    case 'fehlt_in_firestore':
      return `FEHLT       ${f.season} W${f.week} ${f.ev.away} @ ${f.ev.home} (${fmtUtc(f.ev.date)}): bei ESPN vorhanden, nicht in Firestore`;
    default:
      return JSON.stringify(f);
  }
}

// Welche Befunde werden bei --apply wirklich korrigiert?
function isFixable(f) {
  return f.type === 'zeit' &&
    f.ev.timeValid &&
    (f.game.status === 'scheduled' || f.game.status === 'live');
}

// ---------- Hauptprogramm ----------
function readLockMinutes() {
  // gleiche Konstante wie die App (js/config.js), damit Sperrzeiten identisch berechnet werden
  const text = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
  const m = text.match(/BETTING_LOCK_MINUTES_BEFORE_KICKOFF\s*=\s*(\d+)/);
  if (!m) throw new Error('BETTING_LOCK_MINUTES_BEFORE_KICKOFF in js/config.js nicht gefunden');
  return parseInt(m[1], 10);
}

function parseArgs(argv) {
  const opts = { apply: false, hourly: false, scope: 'window', seasons: ['2026'], maxChanges: null };
  for (const arg of argv) {
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--hourly') opts.hourly = true;
    else if (arg.startsWith('--scope=')) opts.scope = arg.slice(8);
    else if (arg.startsWith('--seasons=')) opts.seasons = arg.slice(10).split(',').map(s => s.trim()).filter(Boolean);
    else if (arg.startsWith('--max-changes=')) opts.maxChanges = parseInt(arg.slice(14), 10);
    else throw new Error(`Unbekanntes Argument: ${arg}`);
  }
  if (!['window', 'all'].includes(opts.scope)) throw new Error('--scope muss window oder all sein');
  // Schutz gegen Massenänderungen durch eine fehlerhafte ESPN-Antwort: im Dauerbetrieb
  // höchstens 8 Korrekturen pro Lauf, bei manuellem Lauf (--scope=all) mehr
  if (opts.maxChanges === null) opts.maxChanges = opts.scope === 'all' ? 60 : 8;
  return opts;
}

async function loadFirestoreGames(db, opts) {
  const snaps = [];
  if (opts.scope === 'all') {
    // gesamte Sammlung lesen (einmalig, ca. 280 Dokumente pro Saison) und nach Saison filtern -
    // so fallen auch Dokumente mit unerwartetem season-Wert auf
    const snap = await db.collection('games').get();
    const wanted = new Set(opts.seasons);
    const other = new Map();
    snap.docs.forEach(doc => {
      const season = String(doc.data().season);
      if (wanted.has(season)) snaps.push(doc);
      else other.set(season, (other.get(season) || 0) + 1);
    });
    console.log(`Spiele-Sammlung: ${snap.size} Dokumente, davon ${snaps.length} in den Saisons ${opts.seasons.join(', ')}.`);
    if (other.size) console.log(`Weitere Saison-Werte in der Sammlung (nicht geprüft): ${[...other].map(([s, n]) => `${s} (${n})`).join(', ')}`);
  } else {
    const horizon = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    const snap = await db.collection('games')
      .where('status', 'in', ['scheduled', 'live'])
      .where('game_date', '<=', admin.firestore.Timestamp.fromDate(horizon))
      .get();
    snap.docs.forEach(doc => snaps.push(doc));
    console.log(`Nicht beendete Spiele bis ${fmtUtc(horizon)}: ${snaps.length}`);
  }
  return snaps.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
}

async function loadEspn(fsGames, opts) {
  const wanted = new Set();
  fsGames.forEach(g => wanted.add(`${g.season}|${Number(g.week)}`));
  if (opts.scope === 'all') {
    // auch Wochen laden, in denen Firestore (noch) kein Spiel hat, damit "fehlt in Firestore" auffällt
    for (const season of opts.seasons) for (let w = 1; w <= 18; w++) wanted.add(`${season}|${w}`);
  }
  const byKey = new Map();
  for (const key of wanted) {
    const [season, week] = key.split('|');
    try {
      byKey.set(key, await fetchEspnWeek(season, Number(week)));
    } catch (error) {
      console.error(`ESPN: ${error.message}`);
    }
  }
  return byKey;
}

async function applyFix(db, finding, lockMinutes, apply) {
  const { game, ev } = finding;
  const newLock = admin.firestore.Timestamp.fromDate(new Date(ev.date.getTime() - lockMinutes * 60000));
  const betsSnap = await db.collection('bets').where('game_id', '==', game.id).get();

  // Tipps, die erst NACH dem tatsächlichen Anpfiff abgegeben wurden (nur Anzahl, keine Namen)
  let afterKickoff = 0;
  let relock = 0;
  betsSnap.docs.forEach(doc => {
    const bet = doc.data();
    const created = toDate(bet.created_at);
    if (created && created.getTime() >= ev.date.getTime()) afterKickoff++;
    if (bet.betting_lock_time) relock++;
  });
  console.log(`  -> ${betsSnap.size} Tipps, davon ${afterKickoff} erst nach dem echten Anpfiff angelegt; ${relock} Sperrzeiten werden auf ${fmtUtc(new Date(newLock.toMillis()))} gesetzt.`);

  if (!apply) return;

  await game.ref.update({ game_date: admin.firestore.Timestamp.fromDate(ev.date) });
  let batch = db.batch();
  let pending = 0;
  for (const doc of betsSnap.docs) {
    if (!doc.data().betting_lock_time) continue; // ältere Tipps ohne Feld: Sperre wird dort aus dem Spiel berechnet
    batch.update(doc.ref, { betting_lock_time: newLock });
    if (++pending >= FIRESTORE_BATCH_LIMIT) { await batch.commit(); batch = db.batch(); pending = 0; }
  }
  if (pending > 0) await batch.commit();
  console.log(`  -> korrigiert: game_date ${fmtUtc(ev.date)}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.hourly && new Date().getUTCMinutes() >= 10) {
    console.log('Stündlicher Abgleich: nicht in den ersten 10 Minuten der Stunde, übersprungen.');
    return;
  }

  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();
  const lockMinutes = readLockMinutes();

  console.log(`Modus: ${opts.apply ? 'KORRIGIEREN' : 'Trockenlauf (nichts wird geschrieben)'} | Umfang: ${opts.scope}${opts.scope === 'all' ? ` (${opts.seasons.join(', ')})` : ''} | Sperrzeit ${lockMinutes} min vor Anpfiff`);

  const fsGames = await loadFirestoreGames(db, opts);
  if (fsGames.length === 0) {
    console.log('Keine Spiele zu prüfen.');
    return;
  }
  const espnByKey = await loadEspn(fsGames, opts);

  // Nur Spiele prüfen, zu denen die ESPN-Woche geladen werden konnte
  const checkable = fsGames.filter(g => espnByKey.has(`${g.season}|${Number(g.week)}`));
  if (checkable.length < fsGames.length) {
    console.log(`Achtung: ${fsGames.length - checkable.length} Spiele nicht prüfbar (ESPN-Woche nicht ladbar).`);
  }

  const findings = auditGames(checkable, espnByKey, { completeSeasons: opts.scope === 'all' ? opts.seasons : [] });

  const order = ['zeit', 'kein_match', 'home_away', 'andere_woche', 'doppelt', 'fehlt_in_firestore', 'endstand', 'teamname', 'status'];
  findings.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  console.log(`\n${checkable.length} Spiele geprüft, ${findings.length} Befunde:`);
  findings.forEach(f => console.log(describeFinding(f)));

  const fixable = findings.filter(isFixable);
  if (fixable.length === 0) {
    console.log('\nNichts zu korrigieren.');
    return;
  }
  console.log(`\n${fixable.length} Anstoßzeit(en) ${opts.apply ? 'werden korrigiert' : 'würden korrigiert (Trockenlauf)'}:`);
  if (fixable.length > opts.maxChanges) {
    throw new Error(`Abbruch: ${fixable.length} Korrekturen sind mehr als erlaubt (${opts.maxChanges}) - wahrscheinlich liefert ESPN gerade etwas Unplausibles. Mit --max-changes=<n> bewusst erhöhen.`);
  }
  for (const f of fixable) {
    console.log(`${gameLabel(f.game)}: ${fmtUtc(toDate(f.game.game_date))} -> ${fmtUtc(f.ev.date)}`);
    await applyFix(db, f, lockMinutes, opts.apply);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Unerwarteter Fehler:', error.message || error);
      process.exit(1);
    });
}

module.exports = { normalizeEspnEvent, auditGames, espnRequestFor, isFixable, parseArgs };
