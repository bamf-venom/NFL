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
//   --raw-out=<Datei>  alle Firestore-Dokumente der Saison unverändert sichern (auch Doppelte)
//   --delete-firestore --confirm=<Saison>
//                      die Spiele-Dokumente der Saison aus Firestore LÖSCHEN, nachdem sie archiviert
//                      sind. Nur wenn: die Archivdatei data/seasons/<Saison>.json im Repo liegt und
//                      zur Saison passt, kein einziger Tipp auf diese Spiele zeigt und --confirm
//                      genau die Saison nennt.
//
// Ohne --delete-firestore bleiben die Firestore-Dokumente unangetastet.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function parseArgs(argv) {
  const opts = { season: null, out: null, drop: [], allowUnfinished: false, rawOut: null, deleteFirestore: false, confirm: null };
  for (const arg of argv) {
    if (arg.startsWith('--season=')) opts.season = arg.slice(9).trim();
    else if (arg.startsWith('--out=')) opts.out = arg.slice(6).trim();
    else if (arg.startsWith('--drop=')) opts.drop = arg.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    else if (arg === '--allow-unfinished') opts.allowUnfinished = true;
    else if (arg.startsWith('--raw-out=')) opts.rawOut = arg.slice(10).trim();
    else if (arg === '--delete-firestore') opts.deleteFirestore = true;
    else if (arg.startsWith('--confirm=')) opts.confirm = arg.slice(10).trim();
    else throw new Error(`Unbekanntes Argument: ${arg}`);
  }
  if (!/^\d{4}$/.test(opts.season || '')) throw new Error('--season=<Jahr> fehlt oder ist ungültig (z.B. 2025)');
  if (opts.deleteFirestore && opts.confirm !== opts.season) {
    throw new Error('--delete-firestore braucht --confirm=<Saison> mit genau derselben Saison');
  }
  if (opts.deleteFirestore && opts.out) {
    throw new Error('--delete-firestore und --out nicht im selben Lauf (erst Datei schreiben und einchecken, dann löschen)');
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();

  const snap = await db.collection('games').where('season', '==', opts.season).get();
  // Gleiche ID-Logik wie mapGameDoc() in der App (js/firebase-config.js): Das Feld "id" im
  // Dokument hat Vorrang, sonst die Dokument-ID. Tipps hängen über game_id an dieser ID.
  const docIdOf = new Map();
  const games = snap.docs.map(doc => {
    const game = { id: doc.id, ...toPlain(doc.data()) };
    docIdOf.set(game.id, doc.id);
    return game;
  });
  console.log(`Saison ${opts.season}: ${games.length} Spiele in Firestore.`);
  if (games.length === 0) throw new Error('Keine Spiele gefunden.');

  // Dokumente, deren Feld "id" nicht zur Dokument-ID passt (alte Handeingaben)
  const idMismatch = games.filter(g => docIdOf.get(g.id) !== g.id);
  if (idMismatch.length) {
    const byWeek = {};
    idMismatch.forEach(g => { byWeek[g.week] = (byWeek[g.week] || 0) + 1; });
    console.log(`Hinweis: ${idMismatch.length} Spiele haben ein id-Feld, das von der Dokument-ID abweicht (je Woche: ${JSON.stringify(byWeek)}) - die App nutzt das id-Feld, so auch die Datei.`);
  }
  const withoutIdField = snap.docs.filter(doc => doc.data().id === undefined);
  if (withoutIdField.length) console.log(`Hinweis: ${withoutIdField.length} Spiele haben kein id-Feld - dort gilt die Dokument-ID.`);

  // Tipps je Spiel (nur Anzahlen): alle Tipps einmal lesen, nach game_id zählen. Ein Tipp kann
  // an der App-ID ODER an der Dokument-ID hängen.
  const betsSnap = await db.collection('bets').select('game_id').get();
  const betCount = new Map();
  betsSnap.docs.forEach(doc => {
    const id = doc.data().game_id;
    betCount.set(id, (betCount.get(id) || 0) + 1);
  });
  const tipsFor = (g) => (betCount.get(g.id) || 0) + (docIdOf.get(g.id) !== g.id ? (betCount.get(docIdOf.get(g.id)) || 0) : 0);
  const tipsTotal = games.reduce((sum, g) => sum + tipsFor(g), 0);
  console.log(`Tipps auf Spiele dieser Saison: ${tipsTotal} (von ${betsSnap.size} Tipps insgesamt).`);

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
      console.log(`    id ${g.id} | ${g.game_date} | ${g.status} ${g.away_score}:${g.home_score} | ${tipsFor(g)} Tipps`);
    }
  }

  const unknownDrop = opts.drop.filter(id => !games.some(g => g.id === id));
  if (unknownDrop.length) throw new Error(`--drop enthält unbekannte Spiel-IDs: ${unknownDrop.join(', ')}`);
  // Schutz: ein Spiel, auf das getippt wurde, wird nie weggelassen (die Tipps würden ins Leere zeigen)
  const dropWithTips = games.filter(g => opts.drop.includes(g.id) && tipsFor(g) > 0);
  if (dropWithTips.length) {
    throw new Error(`Abbruch: ${dropWithTips.length} der weggelassenen Spiele haben Tipps (${dropWithTips.map(g => `${g.id}: ${tipsFor(g)}`).join(', ')}).`);
  }

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
