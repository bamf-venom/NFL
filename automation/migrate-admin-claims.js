// ==================== ADMIN-CLAIMS MIGRATION ====================
// Setzt für jeden Nutzer einen Firebase Auth Custom Claim (admin: true/false)
// passend zum is_admin-Feld in seinem Firestore-Dokument. Grund: die
// Firestore Security Rule isAdmin() hat bisher bei JEDER admin-geschützten
// Schreibaktion einen extra get() auf users/{uid} gebraucht, um is_admin zu
// prüfen. Mit dem Custom Claim steht das direkt im Auth-Token
// (request.auth.token.admin) - kein zusätzlicher Lesevorgang mehr nötig.
//
// WICHTIG - Reihenfolge beim Einspielen:
// 1. Dieses Skript hier zuerst laufen lassen (setzt die Claims)
// 2. ERST DANACH die neue isAdmin()-Regel (die auf token.admin prüft) in der
//    Firebase Console einspielen
// Sonst verlieren bestehende Admins zwischenzeitlich ihre Rechte, weil die
// Regel schon auf einen Claim prüft, den noch niemand hat.
//
// Muss außerdem erneut laufen, wann immer sich is_admin für einen Nutzer
// ändert (z.B. neuer Admin ernannt) - es gibt auf dem kostenlosen Spark-Plan
// keinen automatischen Trigger dafür (Cloud Functions bräuchten Blaze).
//
// Bereits eingeloggte Admin-Sessions merken einen neu gesetzten Claim erst
// nach einem Token-Refresh (einmal ab- und wieder anmelden reicht).
//
// Läuft einmalig/manuell über den GitHub-Actions-Workflow
// migrate-admin-claims.yml (workflow_dispatch, kein Zeitplan).

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  console.log('Lade alle Nutzer...');
  const usersSnapshot = await db.collection('users').get();
  console.log(`${usersSnapshot.size} Nutzer gefunden.`);

  let changed = 0;
  let unchanged = 0;
  let failed = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const isAdmin = userDoc.data().is_admin === true;

    try {
      const authUser = await admin.auth().getUser(userId);
      const currentClaim = authUser.customClaims?.admin === true;

      if (currentClaim === isAdmin) {
        unchanged++;
        continue;
      }

      await admin.auth().setCustomUserClaims(userId, { admin: isAdmin });
      changed++;
      console.log(`✅ ${userDoc.data().username || userId}: admin-Claim -> ${isAdmin}`);
    } catch (error) {
      failed++;
      console.warn(`⚠️ Nutzer ${userId} (Firestore) hat keinen zugehörigen Auth-Account mehr oder Fehler: ${error.message}`);
    }
  }

  console.log(`\n🎉 Fertig. ${changed} Claims geändert, ${unchanged} bereits korrekt, ${failed} Fehler/übersprungen.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fehler bei der Migration:', error);
    process.exit(1);
  });
