// ==================== NFL POINTS - Beendete Saison als Datei archivieren ====================
// Eine beendete Saison ändert sich nie mehr. Statt ihre Spiele bei jedem Seitenaufruf aus
// Firestore zu lesen, wird sie einmal in eine feste Datei geschrieben (data/seasons/<Saison>.json),
// die mit der App ausgeliefert wird. Die App liest archivierte Saisons (ARCHIVED_SEASONS in
// js/config.js) aus dieser Datei - das spart Lesevorgänge und lädt schneller.
//
// WICHTIG: Die Datei enthält NUR Spiele (Paarung, Anstoßzeit, Endstand - öffentliche NFL-Daten),
// KEINE Tipps und keine Nutzerdaten. Das Repo und damit die Datei sind öffentlich.
//
//   node archive-season.js --season=2025                           Bericht (schreibt nichts)
//   node archive-season.js --season=2025 --out=../data/seasons/2025.json
//                                                                  Datei schreiben
//   --drop=<id>,<id>   diese Spiel-IDs weglassen (z.B. Doppeleinträge, vorher im Bericht prüfen)
//   --allow-unfinished auch schreiben, wenn nicht alle Spiele beendet sind (nur für Tests)
//
// Die Firestore-Dokumente bleiben unangetastet (nichts wird gelöscht oder geändert).

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function parseArgs(argv) {
  const opts = { season: null, out: null, drop: [], allowUnfinished: false };
  for (const arg of argv) {
    if (arg.startsWith('--season=')) opts.season = arg.slice(9).trim();
    else if (arg.startsWith('--out=')) opts.out = arg.slice(6).trim();
    else if (arg.startsWith('--drop=')) opts.drop = arg.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    else if (arg === '--allow-unfinished') opts.allowUnfinished = true;
    else throw new Error(`Unbekanntes Argument: ${arg}`);
  }
  if (!/^\d{4}$/.test(opts.season || '')) throw new Error('--season=<Jahr> fehlt oder ist ungültig (z.B. 2025)');
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();

  const snap = await db.collection('games').where('season', '==', opts.season).get();
  const games = snap.docs.map(doc => ({ ...toPlain(doc.data()), id: doc.id }));
  console.log(`Saison ${opts.season}: ${games.length} Spiele in Firestore.`);
  if (games.length === 0) throw new Error('Keine Spiele gefunden.');

  // ---- Bericht ----
  const byStatus = {};
  games.forEach(g => { byStatus[g.status] = (byStatus[g.status] || 0) + 1; });
  console.log('Status:', JSON.stringify(byStatus));
  const byWeek = {};
  games.forEach(g => { byWeek[g.week] = (byWeek[g.week] || 0) + 1; });
  console.log('Spiele je Woche:', JSON.stringify(byWeek));

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
      const bets = await db.collection('bets').where('game_id', '==', g.id).get();
      console.log(`    id ${g.id} | ${g.game_date} | ${g.status} ${g.away_score}:${g.home_score} | ${bets.size} Tipps`);
    }
  }

  const unknownDrop = opts.drop.filter(id => !games.some(g => g.id === id));
  if (unknownDrop.length) throw new Error(`--drop enthält unbekannte Spiel-IDs: ${unknownDrop.join(', ')}`);

  // ---- Datei ----
  if (!opts.out) {
    console.log('\nBericht-Modus: es wird nichts geschrieben (--out=<Datei> zum Schreiben).');
    return;
  }

  const notFinished = games.filter(g => g.status !== 'finished');
  if (notFinished.length && !opts.allowUnfinished) {
    throw new Error(`Abbruch: ${notFinished.length} Spiele sind noch nicht beendet - die Saison ist nicht abgeschlossen.`);
  }

  const kept = games
    .filter(g => !opts.drop.includes(g.id))
    .sort((a, b) => (new Date(a.game_date) - new Date(b.game_date)) || a.id.localeCompare(b.id))
    .map(sortKeys);

  const archive = {
    schema: 1,
    season: opts.season,
    generated_at: new Date().toISOString(),
    count: kept.length,
    excluded_ids: opts.drop,
    games: kept,
  };

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(archive, null, 1) + '\n', 'utf8');
  console.log(`\nGeschrieben: ${opts.out} (${kept.length} Spiele, ${opts.drop.length} weggelassen, ${fs.statSync(opts.out).size} Bytes).`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fehler:', error.message || error);
      process.exit(1);
    });
}

module.exports = { parseArgs, toPlain, sortKeys };
