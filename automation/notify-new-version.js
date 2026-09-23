// ==================== NFL POINTS - Neue-Version-Benachrichtigung ====================
// Wird MANUELL ausgelöst (siehe .github/workflows/notify-new-version.yml,
// workflow_dispatch, kein Cron) - nicht bei jedem Deploy, sondern nur wenn
// der Nutzer explizit eine neue Vollversion ankündigen will. Vergleicht die
// aktuelle APP_VERSION (js/config.js, wird seit 2026-09-23 nur noch manuell
// auf Zuruf hochgezählt, siehe Kommentar dort) mit der zuletzt an alle
// Nutzer gemeldeten Version - bei einem Unterschied bekommt jeder
// abonnierte Nutzer einmalig eine Push-Benachrichtigung "Neue Version
// verfügbar", in seiner jeweils eingestellten Sprache.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const webpush = require('web-push');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

webpush.setVapidDetails(
  'mailto:info@mbpvfx.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function readCurrentAppVersion() {
  const configPath = path.join(__dirname, '..', 'js', 'config.js');
  const text = fs.readFileSync(configPath, 'utf8');
  const match = text.match(/APP_VERSION\s*=\s*'([^']+)'/);
  if (!match) throw new Error('APP_VERSION nicht in js/config.js gefunden');
  return match[1];
}

const VERSION_TEXT = {
  de: {
    title: 'NFL POINTS - Update verfügbar',
    body: 'Es gibt eine neue Version der App. Tippe hier, um sie zu öffnen.',
  },
  en: {
    title: 'NFL POINTS - Update available',
    body: 'A new version of the app is available. Tap here to open it.',
  },
};

async function sendToUser(userId, payload) {
  const subsSnapshot = await db.collection('users').doc(userId).collection('push_subscriptions').get();
  let sent = 0;
  let removed = 0;

  for (const subDoc of subsSnapshot.docs) {
    const sub = subDoc.data();
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload));
      sent++;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await subDoc.ref.delete();
        removed++;
      } else {
        console.error(`Push-Fehler für User ${userId}:`, error.message);
      }
    }
  }
  return { sent, removed };
}

async function main() {
  const currentVersion = readCurrentAppVersion();
  const metaRef = db.collection('meta').doc('app_version');
  const metaDoc = await metaRef.get();

  if (!metaDoc.exists) {
    // Erster Lauf mit dieser Funktion ueberhaupt - nur die aktuelle Version
    // vermerken, NICHT benachrichtigen (sonst wuerde beim allerersten Mal
    // faelschlich "neue Version" fuer die laengst bekannte aktuelle gemeldet)
    await metaRef.set({ notified_version: currentVersion });
    console.log(`Erster Lauf: Version ${currentVersion} vermerkt, keine Benachrichtigung.`);
    return;
  }

  const notifiedVersion = metaDoc.data().notified_version;
  if (notifiedVersion === currentVersion) {
    console.log(`Version unveraendert (${currentVersion}), keine Benachrichtigung noetig.`);
    return;
  }

  console.log(`Neue Version erkannt: ${notifiedVersion} -> ${currentVersion}. Benachrichtige alle abonnierten Nutzer...`);

  const usersSnapshot = await db.collection('users').get();

  let notifiedUsers = 0;
  let totalSent = 0;
  let totalRemoved = 0;

  for (const userDoc of usersSnapshot.docs) {
    const lang = userDoc.data().language === 'en' ? 'en' : 'de';
    const text = VERSION_TEXT[lang];
    const payload = { title: text.title, body: text.body, url: './pages/settings.html' };
    const { sent, removed } = await sendToUser(userDoc.id, payload);
    if (sent > 0) notifiedUsers++;
    totalSent += sent;
    totalRemoved += removed;
  }

  await metaRef.set({ notified_version: currentVersion });

  console.log(`Fertig. ${notifiedUsers} Nutzer benachrichtigt (${totalSent} Geräte, ${totalRemoved} veraltete Subscriptions entfernt).`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unerwarteter Fehler:', error);
    process.exit(1);
  });
