// ==================== NFL POINTS - Beendete Saison/Wochen als Datei archivieren ====================
// Beendete Spiele ändern sich nie mehr. Statt sie bei jedem Seitenaufruf aus Firestore zu lesen,
// werden sie einmal in eine feste Datei geschrieben (data/seasons/<Saison>.json), die mit der App
// ausgeliefert wird. Die App liest archivierte Saisons (ARCHIVED_SEASONS in js/config.js) bzw.
// die bereits beendeten Wochen einer laufenden Saison (PARTIAL_ARCHIVED_SEASONS) aus dieser Datei -
// das spart Lesevorgänge und lädt schneller.
//
// Die Spiele-Datei enthält NUR Spiele (Paarung, Anstoßzeit, Endstand - öffentliche NFL-Daten).
// Die optionale Tipp-Datei (--tips-out) enthält die Tipps der archivierten Spiele OHNE Namen und
// ohne E-Mail: nur Nutzer-ID, Spiel, Tipp und Punkte. Das Repo und damit beide Dateien sind
// öffentlich; Namen werden in der App live aus den Nutzer-Dokumenten dazugeholt.
//
//   node archive-season.js --season=2025                           Bericht (schreibt nichts)
//   node archive-season.js --season=2025 --out=../data/seasons/2025.json
//                                                                  Datei schreiben
//   --weeks=1-10       nur diese Wochen archivieren (laufende Saison): alle Spiele dieser Wochen
//                      müssen beendet sein; die Datei bekommt "partial": true und "archived_until"
//   --tips-out=<Datei> zusätzlich die Tipps der archivierten Spiele schreiben (ohne Namen)
//   --drop=<id>,<id>   diese Spiel-IDs weglassen (z.B. Doppeleinträge, vorher im Bericht prüfen)
//   --allow-unfinished auch schreiben, wenn nicht alle Spiele beendet sind (nur für Tests)
//   --raw-out=<Datei>  alle Firestore-Dokumente der Saison unverändert sichern (auch Doppelte)
//   --delete-firestore --confirm=<Saison>
//                      die Spiele-Dokumente der Saison aus Firestore LÖSCHEN, nachdem sie archiviert
//                      sind. Nur wenn: die Archivdatei data/seasons/<Saison>.json im Repo liegt und
//                      zur Saison passt, kein einziger Tipp auf diese Spiele zeigt und --confirm
//                      genau die Saison nennt. Nicht zusammen mit --weeks.
//
// Ohne --delete-firestore bleiben die Firestore-Dokumente unangetastet (auch mit --weeks: dort
// bleiben Spiele UND Tipps in Firestore, die App liest die archivierten nur nicht mehr von dort).
// In Berichten und Logs erscheinen nie Namen oder Nutzer-IDs, nur Anzahlen und Spiel-IDs.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// "1-10", "1,2,5-7" -> [1, 2, 5, 6, 7]
function parseWeeks(spec) {
  const weeks = new Set();
  for (const part of String(spec).split(',').map(s => s.trim()).filter(Boolean)) {
    const range = /^(\d{1,2})-(\d{1,2})$/.exec(part);
    const single = /^(\d{1,2})$/.exec(part);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > to) throw new Error(`--weeks: ungültiger Bereich "${part}"`);
      for (let w = from; w <= to; w++) weeks.add(w);
    } else if (single) {
      weeks.add(Number(single[1]));
    } else {
      throw new Error(`--weeks: ungültiger Wert "${part}" (erlaubt: 1-10 oder 1,2,5-7)`);
    }
  }
  const list = [...weeks].sort((a, b) => a - b);
  if (list.length === 0 || list.some(w => w < 1 || w > 22)) throw new Error('--weeks: Wochen müssen zwischen 1 und 22 liegen');
  return list;
}

function parseArgs(argv) {
  const opts = {
    season: null, out: null, drop: [], allowUnfinished: false, rawOut: null,
    deleteFirestore: false, confirm: null, weeks: null, tipsOut: null
  };
  for (const arg of argv) {
    if (arg.startsWith('--season=')) opts.season = arg.slice(9).trim();
    else if (arg.startsWith('--out=')) opts.out = arg.slice(6).trim();
    else if (arg.startsWith('--drop=')) opts.drop = arg.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    else if (arg === '--allow-unfinished') opts.allowUnfinished = true;
    else if (arg.startsWith('--raw-out=')) opts.rawOut = arg.slice(10).trim();
    else if (arg === '--delete-firestore') opts.deleteFirestore = true;
    else if (arg.startsWith('--confirm=')) opts.confirm = arg.slice(10).trim();
    else if (arg.startsWith('--weeks=')) opts.weeks = parseWeeks(arg.slice(8));
    else if (arg.startsWith('--tips-out=')) opts.tipsOut = arg.slice(11).trim();
    else throw new Error(`Unbekanntes Argument: ${arg}`);
  }
  if (!/^\d{4}$/.test(opts.season || '')) throw new Error('--season=<Jahr> fehlt oder ist ungültig (z.B. 2025)');
  if (opts.deleteFirestore && opts.confirm !== opts.season) {
    throw new Error('--delete-firestore braucht --confirm=<Saison> mit genau derselben Saison');
  }
  if (opts.deleteFirestore && opts.out) {
    throw new Error('--delete-firestore und --out nicht im selben Lauf (erst Datei schreiben und einchecken, dann löschen)');
  }
  if (opts.deleteFirestore && opts.weeks) {
    throw new Error('--delete-firestore gibt es nur für ganze Saisons, nicht zusammen mit --weeks');
  }
  if (opts.tipsOut && !opts.out) {
    throw new Error('--tips-out braucht --out (die Tipp-Datei gehört zur Spiele-Datei desselben Laufs)');
  }
  return opts;
}

// Firestore-Werte JSON-tauglich machen: Timestamps -> ISO-Text (wie mapGameDoc in der App)
function toPlain(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
}

// Stabile Schlüsselreihenfolge (sauberere Git-Diffs, wenn die Datei neu erzeugt wird)
function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]));
}

// Gleiche Punktelogik wie calculatePointsForGame in check-scores.js: je 3 für ein exakt
// getroffenes Teamergebnis, 1 für den richtigen Sieger (oder Unentschieden)
function expectedPoints(homeScore, awayScore, homePred, awayPred) {
  let points = 0;
  if (homePred === homeScore) points += 3;
  if (awayPred === awayScore) points += 3;
  const winner = (h, a) => (h > a ? 1 : a > h ? 2 : 0);
  if (winner(homePred, awayPred) === winner(homeScore, awayScore)) points += 1;
  return points;
}

// Tipp-Datei lesbar und diff-freundlich schreiben: Kopf als Zeilen, je Spiel eine Zeile
function formatTipsFile(file) {
  const { tips, ...head } = file;
  const headLines = Object.entries(head).map(([key, value]) => ` ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  const body = Object.keys(tips).sort().map(id => `  ${JSON.stringify(id)}: ${JSON.stringify(tips[id])}`).join(',\n');
  return '{\n' + [...headLines, ` "tips": {\n${body}\n }`].join(',\n') + '\n}\n';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();
  const partial = !!opts.weeks;

  const snap = await db.collection('games').where('season', '==', opts.season).get();
  // Gleiche ID-Logik wie mapGameDoc() in der App (js/firebase-config.js): Das Feld "id" im
  // Dokument hat Vorrang, sonst die Dokument-ID. Tipps hängen über game_id an dieser ID.
  const docIdOf = new Map();
  const allGames = snap.docs.map(doc => {
    const game = { id: doc.id, ...toPlain(doc.data()) };
    docIdOf.set(game.id, doc.id);
    return game;
  });
  console.log(`Saison ${opts.season}: ${allGames.length} Spiele in Firestore.`);
  if (allGames.length === 0) throw new Error('Keine Spiele gefunden.');

  // Bei --weeks: nur die Spiele dieser Wochen werden archiviert, der Rest bleibt in Firestore
  const games = partial ? allGames.filter(g => opts.weeks.includes(g.week)) : allGames;
  const otherGames = partial ? allGames.filter(g => !opts.weeks.includes(g.week)) : [];
  if (partial) {
    const missing = opts.weeks.filter(w => !games.some(g => g.week === w));
    if (missing.length) throw new Error(`Abbruch: für die Wochen ${missing.join(', ')} gibt es keine Spiele.`);
    console.log(`Teilarchiv: Wochen ${opts.weeks[0]}-${opts.weeks[opts.weeks.length - 1]} (${opts.weeks.length} Wochen): ${games.length} Spiele; ${otherGames.length} Spiele anderer Wochen bleiben außen vor.`);
  }

  // Dokumente, deren Feld "id" nicht zur Dokument-ID passt (alte Handeingaben)
  const idMismatch = games.filter(g => docIdOf.get(g.id) !== g.id);
  if (idMismatch.length) {
    const byWeek = {};
    idMismatch.forEach(g => { byWeek[g.week] = (byWeek[g.week] || 0) + 1; });
    console.log(`Hinweis: ${idMismatch.length} Spiele haben ein id-Feld, das von der Dokument-ID abweicht (je Woche: ${JSON.stringify(byWeek)}) - die App nutzt das id-Feld, so auch die Datei.`);
  }
  const withoutIdField = snap.docs.filter(doc => doc.data().id === undefined && games.some(g => g.id === doc.id));
  if (withoutIdField.length) console.log(`Hinweis: ${withoutIdField.length} Spiele haben kein id-Feld - dort gilt die Dokument-ID.`);

  // Tipps: nur die Felder, die gebraucht werden (KEIN Benutzername). Ein Tipp kann an der
  // App-ID ODER an der Dokument-ID des Spiels hängen.
  const betsSnap = await db.collection('bets')
    .select('game_id', 'user_id', 'home_score_prediction', 'away_score_prediction', 'points_earned')
    .get();
  const appIdByKey = new Map(); // game_id eines Tipps (App-ID oder Dokument-ID) -> App-ID des archivierten Spiels
  games.forEach(g => {
    appIdByKey.set(g.id, g.id);
    if (docIdOf.get(g.id) !== g.id) appIdByKey.set(docIdOf.get(g.id), g.id);
  });
  const betCount = new Map();
  const betsOfArchive = []; // Tipps auf archivierte Spiele
  betsSnap.docs.forEach(doc => {
    const bet = doc.data();
    const appId = appIdByKey.get(bet.game_id);
    if (!appId) return;
    betCount.set(appId, (betCount.get(appId) || 0) + 1);
    betsOfArchive.push({ appId, ...bet });
  });
  const tipsFor = (g) => betCount.get(g.id) || 0;
  const tipsTotal = games.reduce((sum, g) => sum + tipsFor(g), 0);
  console.log(`Tipps auf ${partial ? 'die archivierten Spiele' : 'Spiele dieser Saison'}: ${tipsTotal} (von ${betsSnap.size} Tipps insgesamt).`);

  // ---- Bericht ----
  const byStatus = {};
  games.forEach(g => { byStatus[g.status] = (byStatus[g.status] || 0) + 1; });
  console.log('Status:', JSON.stringify(byStatus));
  const byWeek = {};
  games.forEach(g => { byWeek[g.week] = (byWeek[g.week] || 0) + 1; });
  console.log('Spiele je Woche:', JSON.stringify(byWeek));
  if (tipsTotal > 0) {
    const tipsByWeek = {};
    games.forEach(g => { tipsByWeek[g.week] = (tipsByWeek[g.week] || 0) + tipsFor(g); });
    console.log('Tipps je Woche:', JSON.stringify(tipsByWeek));
    console.log(`Verschiedene Tippende: ${new Set(betsOfArchive.map(b => b.user_id)).size}`);
  }

  const noScore = games.filter(g => g.status === 'finished' && (g.home_score == null || g.away_score == null));
  if (noScore.length) console.log(`ACHTUNG: ${noScore.length} beendete Spiele ohne Endstand.`);

  // Doppelte Spiele (gleiche Woche + gleiche Teams): mit Anzahl Tipps je Dokument, damit man
  // das überflüssige Dokument sicher erkennt (Tipps hängen an der Spiel-ID)
  const groups = new Map();
  games.forEach(g => {
    const key = `${g.week}|${g.home_team_abbr}|${g.away_team_abbr}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  });
  const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);
  console.log(`Doppelte Spiele (gleiche Woche + Teams): ${duplicates.length}`);
  for (const [key, list] of duplicates) {
    const [week, home, away] = key.split('|');
    console.log(`  W${week} ${away} @ ${home}:`);
    for (const g of list) {
      console.log(`    id ${g.id} | ${g.game_date} | ${g.status} ${g.away_score}:${g.home_score} | ${tipsFor(g)} Tipps`);
    }
  }

  // Nicht beendete Spiele in den gewählten Wochen (bei --weeks ein Abbruchgrund, siehe unten)
  const notFinished = games.filter(g => g.status !== 'finished');
  if (notFinished.length) {
    console.log(`Nicht beendete Spiele: ${notFinished.length}`);
    notFinished.slice(0, 20).forEach(g => console.log(`  W${g.week} ${g.away_team_abbr} @ ${g.home_team_abbr} | ${g.game_date} | ${g.status}`));
  }

  // Teilarchiv: Ab welchem Zeitpunkt liest die App wieder aus Firestore? Alles, was beendet ist
  // und NACH dem letzten archivierten Spiel angesetzt ist. Ein beendetes Spiel einer anderen Woche
  // mit früherer Anstoßzeit würde dadurch weder in der Datei stehen noch aus Firestore kommen.
  let archivedUntil = null;
  if (partial) {
    archivedUntil = games.map(g => g.game_date).sort().pop();
    console.log(`Archiviert bis (letzter Anstoß der gewählten Wochen): ${archivedUntil}`);
    const hidden = otherGames.filter(g => g.status === 'finished' && new Date(g.game_date) <= new Date(archivedUntil));
    if (hidden.length) {
      hidden.forEach(g => console.log(`  VERSTECKT W${g.week} ${g.away_team_abbr} @ ${g.home_team_abbr} | ${g.game_date} | id ${g.id}`));
      throw new Error(`Abbruch: ${hidden.length} beendete Spiele anderer Wochen sind vor dem Stichtag angesetzt und würden in der App fehlen.`);
    }
    const earlyOpen = otherGames.filter(g => g.status !== 'finished' && new Date(g.game_date) <= new Date(archivedUntil));
    if (earlyOpen.length) console.log(`Hinweis: ${earlyOpen.length} nicht beendete Spiele anderer Wochen liegen vor dem Stichtag (werden wie bisher aus Firestore geladen).`);
  }

  // Ein Nutzer darf je Spiel nur einen Tipp haben (firebasePlaceBet verhindert doppelte)
  let duplicateTips = 0;
  {
    const seen = new Set();
    betsOfArchive.forEach(bet => {
      const key = `${bet.appId}|${bet.user_id}`;
      if (seen.has(key)) duplicateTips++;
      seen.add(key);
    });
    console.log(`Doppelte Tipps (gleicher Nutzer, gleiches Spiel): ${duplicateTips}`);
  }

  // Punkte der Tipps gegen den Endstand nachrechnen (Bericht, ändert nichts)
  if (betsOfArchive.length) {
    const gameById = new Map(games.map(g => [g.id, g]));
    const wrong = [];
    let unchecked = 0;
    betsOfArchive.forEach(bet => {
      const game = gameById.get(bet.appId);
      if (!game || game.status !== 'finished' || game.home_score == null || game.away_score == null) { unchecked++; return; }
      const expected = expectedPoints(game.home_score, game.away_score, bet.home_score_prediction, bet.away_score_prediction);
      if ((bet.points_earned || 0) !== expected) wrong.push({ gameId: bet.appId, stored: bet.points_earned || 0, expected });
    });
    console.log(`Punkte nachgerechnet: ${betsOfArchive.length - unchecked} Tipps geprüft, ${wrong.length} weichen von den gespeicherten Punkten ab, ${unchecked} nicht prüfbar (Spiel nicht beendet).`);
    wrong.slice(0, 20).forEach(w => console.log(`  Spiel ${w.gameId}: gespeichert ${w.stored}, nachgerechnet ${w.expected}`));
  }

  const unknownDrop = opts.drop.filter(id => !games.some(g => g.id === id));
  if (unknownDrop.length) throw new Error(`--drop enthält unbekannte Spiel-IDs: ${unknownDrop.join(', ')}`);
  // Schutz: ein Spiel, auf das getippt wurde, wird nie weggelassen (die Tipps würden ins Leere zeigen)
  const dropWithTips = games.filter(g => opts.drop.includes(g.id) && tipsFor(g) > 0);
  if (dropWithTips.length) {
    throw new Error(`Abbruch: ${dropWithTips.length} der weggelassenen Spiele haben Tipps (${dropWithTips.map(g => `${g.id}: ${tipsFor(g)}`).join(', ')}).`);
  }

  // ---- Rohsicherung ----
  if (opts.rawOut) {
    const raw = snap.docs.map(doc => ({ doc_id: doc.id, data: toPlain(doc.data()) }));
    fs.mkdirSync(path.dirname(path.resolve(opts.rawOut)), { recursive: true });
    fs.writeFileSync(opts.rawOut, JSON.stringify({ season: opts.season, saved_at: new Date().toISOString(), count: raw.length, docs: raw }, null, 1) + '\n', 'utf8');
    console.log(`\nRohsicherung geschrieben: ${opts.rawOut} (${raw.length} Dokumente, unverändert inkl. Doppelter).`);
  }

  // ---- Löschen (nur mit --delete-firestore --confirm=<Saison>) ----
  if (opts.deleteFirestore) {
    const archivePath = path.join(__dirname, '..', 'data', 'seasons', `${opts.season}.json`);
    if (!fs.existsSync(archivePath)) throw new Error(`Abbruch: ${archivePath} existiert nicht - erst archivieren.`);
    const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
    if (String(archive.season) !== opts.season || !Array.isArray(archive.games) || archive.games.length === 0) {
      throw new Error('Abbruch: Archivdatei passt nicht zur Saison oder ist leer.');
    }
    if (archive.partial) throw new Error('Abbruch: die Archivdatei ist nur ein Teilarchiv - gelöscht wird nur nach dem Archiv der kompletten Saison.');
    if (tipsTotal > 0) throw new Error(`Abbruch: ${tipsTotal} Tipps zeigen auf Spiele dieser Saison - nichts gelöscht.`);
    console.log(`\nLösche ${snap.docs.length} Spiele-Dokumente der Saison ${opts.season} aus Firestore (Archivdatei: ${archive.games.length} Spiele, 0 Tipps betroffen)...`);
    let batch = db.batch();
    let pending = 0;
    let deleted = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      pending++;
      if (pending >= 400) { await batch.commit(); deleted += pending; batch = db.batch(); pending = 0; }
    }
    if (pending > 0) { await batch.commit(); deleted += pending; }
    const rest = await db.collection('games').where('season', '==', opts.season).get();
    console.log(`Gelöscht: ${deleted} Dokumente. Verbleibend in Firestore für Saison ${opts.season}: ${rest.size}.`);
    return;
  }

  // ---- Datei ----
  if (!opts.out) {
    console.log('\nBericht-Modus: es wird nichts geschrieben (--out=<Datei> zum Schreiben).');
    return;
  }

  if (notFinished.length && !opts.allowUnfinished) {
    throw new Error(`Abbruch: ${notFinished.length} Spiele sind noch nicht beendet - ${partial ? 'die gewählten Wochen sind' : 'die Saison ist'} nicht abgeschlossen.`);
  }
  if (opts.tipsOut && duplicateTips > 0) {
    throw new Error(`Abbruch: ${duplicateTips} doppelte Tipps (gleicher Nutzer, gleiches Spiel) - erst klären, es wurde nichts geschrieben.`);
  }

  const kept = games
    .filter(g => !opts.drop.includes(g.id))
    .sort((a, b) => (new Date(a.game_date) - new Date(b.game_date)) || a.id.localeCompare(b.id))
    .map(sortKeys);

  const archive = {
    schema: partial ? 2 : 1,
    season: opts.season,
    ...(partial ? { partial: true, weeks: opts.weeks, archived_until: archivedUntil } : {}),
    generated_at: new Date().toISOString(),
    count: kept.length,
    excluded_ids: opts.drop,
    games: kept,
  };

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(archive, null, 1) + '\n', 'utf8');
  console.log(`\nGeschrieben: ${opts.out} (${kept.length} Spiele, ${opts.drop.length} weggelassen, ${fs.statSync(opts.out).size} Bytes).`);

  // ---- Tipp-Datei (ohne Namen) ----
  if (opts.tipsOut) {
    const keptIds = new Set(kept.map(g => g.id));
    const userIds = [...new Set(betsOfArchive.filter(b => keptIds.has(b.appId)).map(b => b.user_id))].sort();
    const userIndex = new Map(userIds.map((id, i) => [id, i]));
    const tips = {};
    kept.forEach(g => { tips[g.id] = []; }); // auch Spiele ohne Tipp, damit die App weiß: "archiviert, 0 Tipps"
    let skipped = 0;
    betsOfArchive.forEach(bet => {
      if (!keptIds.has(bet.appId)) return;
      const ok = Number.isInteger(bet.home_score_prediction) && Number.isInteger(bet.away_score_prediction) && typeof bet.user_id === 'string';
      if (!ok) { skipped++; return; }
      tips[bet.appId].push([userIndex.get(bet.user_id), bet.away_score_prediction, bet.home_score_prediction, bet.points_earned || 0]);
    });
    Object.values(tips).forEach(rows => rows.sort((a, b) => a[0] - b[0]));
    const tipCount = Object.values(tips).reduce((sum, rows) => sum + rows.length, 0);
    const tipsFile = {
      schema: 1,
      season: opts.season,
      generated_at: archive.generated_at,
      // Spalten je Tipp: [Nutzer-Nummer (Index in "users"), Tipp Gast, Tipp Heim, Punkte]
      fields: ['user', 'away', 'home', 'points'],
      weeks: partial ? opts.weeks : [...new Set(kept.map(g => g.week))].sort((a, b) => a - b),
      game_count: kept.length,
      tip_count: tipCount,
      users: userIds,
      tips,
    };
    fs.mkdirSync(path.dirname(path.resolve(opts.tipsOut)), { recursive: true });
    fs.writeFileSync(opts.tipsOut, formatTipsFile(tipsFile), 'utf8');
    console.log(`Geschrieben: ${opts.tipsOut} (${tipCount} Tipps von ${userIds.length} Nutzern auf ${kept.length} Spiele, ${skipped} ungültige übersprungen, ${fs.statSync(opts.tipsOut).size} Bytes; ohne Namen).`);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fehler:', error.message || error);
      process.exit(1);
    });
}

module.exports = { parseArgs, parseWeeks, toPlain, sortKeys, expectedPoints, formatTipsFile };
