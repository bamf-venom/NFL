// ==================== EINMALIGE KORREKTUR ====================
// Setzt total_points für den Nutzer "Moritz" auf 0 zurück - waren alte
// Punkte aus Tests, die nicht mehr zu echten, aktuell existierenden Tipps
// gehören (siehe Mismatch-Warnung aus migrate-user-stats.js).
//
// Einmalig manuell über den GitHub-Actions-Workflow fix-moritz-points.yml
// ausgeführt (workflow_dispatch, kein Zeitplan).

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('users').where('username', '==', 'Moritz').get();

  if (snapshot.empty) {
    console.log('Kein Nutzer mit Username "Moritz" gefunden.');
    return;
  }

  for (const doc of snapshot.docs) {
    const before = doc.data().total_points || 0;
    await doc.ref.update({ total_points: 0 });
    console.log(`✅ ${doc.data().username} (${doc.id}): total_points ${before} -> 0`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fehler:', error);
    process.exit(1);
  });
