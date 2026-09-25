// ==================== NFL POINTS - Automatischer Ergebnis-Check ====================
// Läuft periodisch (siehe .github/workflows/update-scores.yml), holt sich die
// Ergebnisse laufender/vergangener Spiele von der kostenlosen ESPN-Schnittstelle
// und schreibt sie per Firebase Admin SDK in Firestore. Beim Abschluss eines Spiels
// werden automatisch die Punkte für alle Tipps berechnet (gleiche Logik wie im
// Admin-Panel der Web-App, siehe js/firebase-config.js -> calculatePointsForGame).

const admin = require('firebase-admin');

// ---- Firebase Admin initialisieren ----
// FIREBASE_SERVICE_ACCOUNT enthält den kompletten Inhalt der Service-Account-JSON
// (als GitHub Actions Secret hinterlegt, niemals ins Repo committen!)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ---- Team-Abkürzungen: ESPN -> unsere Datenbank ----
const ESPN_ABBR_TO_OURS = {
  ARI: 'ARI', ATL: 'ATL', BAL: 'BAL', BUF: 'BUF', CAR: 'CAR', CHI: 'CHI',
  CIN: 'CIN', CLE: 'CLE', DAL: 'DAL', DEN: 'DEN', DET: 'DET', GB: 'GB',
  HOU: 'HOU', IND: 'IND', JAX: 'JAX', KC: 'KC', LV: 'LV', LAC: 'LAC',
  LAR: 'LAR', MIA: 'MIA', MIN: 'MIN', NE: 'NE', NO: 'NO', NYG: 'NYG',
  NYJ: 'NYJ', PHI: 'PHI', PIT: 'PIT', SF: 'SF', SEA: 'SEA', TB: 'TB',
  TEN: 'TEN', WSH: 'WAS', WAS: 'WAS',
};

// ---- ESPN Scoreboard für eine (Saison, Woche)-Kombination laden ----
async function fetchEspnWeek(season, week) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${season}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN-API Fehler für Season ${season} Woche ${week}: ${res.status}`);
  }
  const data = await res.json();
  return data.events || [];
}

// Findet das passende ESPN-Event für ein Firestore-Spiel anhand der Team-Kürzel
function findEspnMatch(espnEvents, homeAbbr, awayAbbr) {
  for (const event of espnEvents) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const espnHome = ESPN_ABBR_TO_OURS[home.team.abbreviation] || home.team.abbreviation;
    const espnAway = ESPN_ABBR_TO_OURS[away.team.abbreviation] || away.team.abbreviation;

    if (espnHome === homeAbbr && espnAway === awayAbbr) {
      return { comp, home, away };
    }
  }
  return null;
}

// Gleiche Punktelogik wie firebaseUpdateGame/calculatePointsForGame in js/firebase-config.js.
// Führt zusätzlich correct_winners/correct_scores am Nutzer-Konto mit, damit die
// Rangliste komplett aus den Nutzer-Konten gelesen werden kann statt jedes Mal
// alle Wetten aller Nutzer zu scannen.
async function calculatePointsForGame(gameId, homeScore, awayScore) {
  const betsSnapshot = await db.collection('bets').where('game_id', '==', gameId).get();

  let actualWinner;
  if (homeScore > awayScore) actualWinner = 1;
  else if (awayScore > homeScore) actualWinner = 2;
  else actualWinner = 0;

  const batch = db.batch();
  const userStatsMap = {};

  betsSnapshot.docs.forEach(doc => {
    const bet = doc.data();
    // Differenz zur zuletzt gespeicherten points_earned verrechnen, nicht den
    // absoluten neuen Wert - siehe gleiche Änderung in
    // calculatePointsForGame() (js/firebase-config.js) für den Hintergrund
    // (macht die Funktion sicher mehrfach für dasselbe Spiel aufrufbar).
    const oldPoints = bet.points_earned || 0;
    let points = 0;

    if (bet.home_score_prediction === homeScore) points += 3;
    if (bet.away_score_prediction === awayScore) points += 3;

    let predictedWinner;
    if (bet.home_score_prediction > bet.away_score_prediction) predictedWinner = 1;
    else if (bet.away_score_prediction > bet.home_score_prediction) predictedWinner = 2;
    else predictedWinner = 0;

    if (predictedWinner === actualWinner) points += 1;

    batch.update(doc.ref, { points_earned: points });

    if (!userStatsMap[bet.user_id]) {
      userStatsMap[bet.user_id] = { points: 0, correctWinners: 0, correctScores: 0 };
    }
    userStatsMap[bet.user_id].points += (points - oldPoints);
    userStatsMap[bet.user_id].correctWinners += (points > 0 ? 1 : 0) - (oldPoints > 0 ? 1 : 0);
    userStatsMap[bet.user_id].correctScores += (points >= 3 ? 1 : 0) - (oldPoints >= 3 ? 1 : 0);
  });

  await batch.commit();

  for (const [userId, stats] of Object.entries(userStatsMap)) {
    if (stats.points === 0 && stats.correctWinners === 0 && stats.correctScores === 0) continue;
    await db.collection('users').doc(userId).update({
      total_points: admin.firestore.FieldValue.increment(stats.points),
      correct_winners: admin.firestore.FieldValue.increment(stats.correctWinners),
      correct_scores: admin.firestore.FieldValue.increment(stats.correctScores),
    });
  }
}

async function main() {
  const now = new Date();

  // Alle Spiele holen, die noch nicht final sind, aber laut Anstoßzeit schon
  // begonnen haben könnten. Der game_date-Filter läuft bewusst SERVERSEITIG
  // mit (nicht erst client-seitig danach) - Firestore berechnet pro
  // QUERY-TREFFER einen Lesevorgang, unabhängig davon, ob man das Ergebnis
  // hinterher noch filtert. Bei ca. 280 Spielen pro Saison, die alle auf
  // einmal als 'scheduled' angelegt werden (siehe add-season-2026.html), hat
  // die alte reine status-Abfrage bei JEDEM Lauf (alle 5-15 Min, rund um die
  // Uhr) praktisch die komplette Saison gelesen statt nur die paar fälligen
  // Spiele - Hauptursache des Kontingent-Vorfalls vom 21.09.2026.
  const snapshot = await db.collection('games')
    .where('status', 'in', ['scheduled', 'live'])
    .where('game_date', '<=', admin.firestore.Timestamp.fromDate(now))
    .get();

  const pendingGames = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));

  if (pendingGames.length === 0) {
    console.log('Keine fälligen Spiele zu prüfen.');
    return;
  }

  console.log(`${pendingGames.length} fällige Spiele werden geprüft...`);

  // Gruppieren nach (season, week), damit wir die ESPN-API nicht mehrfach für
  // dieselbe Woche abfragen
  const groups = new Map();
  for (const game of pendingGames) {
    const key = `${game.season}_${game.week}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(game);
  }

  let updatedCount = 0;
  let finishedCount = 0;

  for (const [key, games] of groups.entries()) {
    const [season, week] = key.split('_');
    let espnEvents;
    try {
      espnEvents = await fetchEspnWeek(season, week);
    } catch (error) {
      console.error(`Fehler beim Laden von ESPN für Season ${season} Woche ${week}:`, error.message);
      continue;
    }

    for (const game of games) {
      const match = findEspnMatch(espnEvents, game.home_team_abbr, game.away_team_abbr);
      if (!match) {
        console.log(`Kein ESPN-Match gefunden für ${game.away_team_abbr} @ ${game.home_team_abbr} (Woche ${week})`);
        continue;
      }

      const { comp, home, away } = match;
      const isCompleted = comp.status?.type?.completed === true;
      const isInProgress = comp.status?.type?.state === 'in';
      const homeScore = home.score !== undefined ? parseInt(home.score, 10) : null;
      const awayScore = away.score !== undefined ? parseInt(away.score, 10) : null;

      if (homeScore === null || awayScore === null) continue;

      if (isCompleted && game.status !== 'finished') {
        await game.ref.update({
          home_score: homeScore,
          away_score: awayScore,
          status: 'finished',
        });
        await calculatePointsForGame(game.id, homeScore, awayScore);
        console.log(`✅ BEENDET: ${game.away_team_abbr} @ ${game.home_team_abbr} (${awayScore}:${homeScore}) - Punkte berechnet`);
        finishedCount++;
        updatedCount++;
      } else if (isInProgress && (game.home_score !== homeScore || game.away_score !== awayScore || game.status !== 'live')) {
        await game.ref.update({
          home_score: homeScore,
          away_score: awayScore,
          status: 'live',
        });
        console.log(`🔴 LIVE: ${game.away_team_abbr} @ ${game.home_team_abbr} (${awayScore}:${homeScore})`);
        updatedCount++;
      }
    }
  }

  console.log(`\nFertig. ${updatedCount} Spiele aktualisiert, davon ${finishedCount} neu beendet.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unerwarteter Fehler:', error);
    process.exit(1);
  });
