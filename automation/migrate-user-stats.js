// ==================== EINMALIGE MIGRATION ====================
// Berechnet total_bets, correct_winners und correct_scores für ALLE
// bestehenden Nutzer aus der kompletten Bet-Historie und schreibt sie auf
// das jeweilige Nutzer-Konto. Nötig, weil diese Felder vorher nur "on the
// fly" aus allen Bets berechnet wurden (siehe alte firebaseGetLeaderboard())
// und nun stattdessen inkrementell am Nutzer-Konto mitgeführt werden
// (siehe firebasePlaceBet/firebaseDeleteBet/calculatePointsForGame).
//
// total_points wird NICHT überschrieben - das wurde schon immer korrekt
// inkrementell mitgeführt. Es wird hier nur zur Kontrolle gegen den aus den
// Bets neu berechneten Wert verglichen (Mismatch wird geloggt, aber nicht
// automatisch korrigiert).
//
// Läuft einmalig manuell über den GitHub-Actions-Workflow
// migrate-user-stats.yml (workflow_dispatch, kein Zeitplan).

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  console.log('Lade alle Wetten...');
  const betsSnapshot = await db.collection('bets').get();
  console.log(`${betsSnapshot.size} Wetten gefunden.`);

  const userStats = {};

  betsSnapshot.docs.forEach(doc => {
    const bet = doc.data();
    if (!bet.user_id) return;

    if (!userStats[bet.user_id]) {
      userStats[bet.user_id] = { total_bets: 0, correct_winners: 0, correct_scores: 0, total_points: 0 };
    }

    userStats[bet.user_id].total_bets += 1;
    userStats[bet.user_id].total_points += bet.points_earned || 0;
    if (bet.points_earned > 0) userStats[bet.user_id].correct_winners += 1;
    if (bet.points_earned >= 3) userStats[bet.user_id].correct_scores += 1;
  });

  const userIds = Object.keys(userStats);
  console.log(`${userIds.length} betroffene Nutzer werden aktualisiert.`);

  // In Batches von 400 schreiben (Firestore-Limit pro Batch: 500 Operationen)
  let updated = 0;
  for (let i = 0; i < userIds.length; i += 400) {
    const chunk = userIds.slice(i, i + 400);
    const batch = db.batch();

    for (const userId of chunk) {
      const stats = userStats[userId];
      batch.set(
        db.collection('users').doc(userId),
        {
          total_bets: stats.total_bets,
          correct_winners: stats.correct_winners,
          correct_scores: stats.correct_scores,
        },
        { merge: true }
      );
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`✅ ${updated}/${userIds.length} Nutzer aktualisiert`);
  }

  // Kontrolle: existierendes total_points mit neu berechnetem Wert vergleichen
  console.log('\nKontrolle total_points (nur Hinweise, keine automatische Korrektur):');
  let mismatches = 0;
  for (const userId of userIds) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.warn(`⚠️ Nutzer ${userId} existiert nicht mehr (gelöschter Account?), aber hat noch Wetten.`);
      continue;
    }
    const existingPoints = userDoc.data().total_points || 0;
    const computedPoints = userStats[userId].total_points;
    if (existingPoints !== computedPoints) {
      mismatches++;
      console.warn(`⚠️ ${userDoc.data().username || userId}: gespeichert=${existingPoints}, aus Bets berechnet=${computedPoints}`);
    }
  }

  console.log(`\n🎉 Fertig. ${updated} Nutzer migriert, ${mismatches} Punkte-Abweichungen gefunden (nur zur Info geloggt).`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fehler bei der Migration:', error);
    process.exit(1);
  });
