// ==================== NFL POINTS - Wett-Erinnerung per Push ====================
// Läuft periodisch zusammen mit check-scores.js (siehe
// .github/workflows/update-scores.yml, alle 15 Minuten). Erinnert jeden
// Nutzer per Push-Benachrichtigung ca. 1h vor Anpfiff eines Spiels, FALLS er
// dafür noch keine Wette platziert hat. Startet mehrere Spiele in etwa
// derselben Stunde, bekommt der Nutzer trotzdem nur EINE Benachrichtigung für
// diesen Lauf (siehe buildUserReminders). Text kommt je nach `language`-Feld
// am Nutzer-Dokument auf Deutsch oder Englisch (Default 'de', siehe
// REMINDER_TEXT).

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

// Erinnerungsfenster um die 1h-Marke vor Anpfiff. Bewusst breiter als der
// 15-Minuten-Lauftakt (nicht knapp 55-65min), damit ein verzögerter oder
// ausgefallener Workflow-Lauf die Erinnerung nicht komplett verpasst - das
// reminder_sent-Flag pro Spiel verhindert trotzdem Mehrfachversand.
const WINDOW_MIN_MINUTES = 40;
const WINDOW_MAX_MINUTES = 80;

function teamMatchup(game) {
  return `${game.away_team_abbr} @ ${game.home_team_abbr}`;
}

// Notification-Texte je Sprache - Sprachwahl kommt aus dem `language`-Feld am
// Nutzer-Dokument (js/firebase-config.js: firebaseUpdateUserLanguage()),
// Default 'de' falls nie gesetzt (z.B. Nutzer war nie in den Einstellungen)
const REMINDER_TEXT = {
  de: {
    title: 'NFL POINTS - Wett-Erinnerung',
    single: (game) => `${teamMatchup(game)} beginnt in ca. 1 Stunde - du hast noch keine Wette platziert!`,
    multi: (count) => `${count} Spiele beginnen in ca. 1 Stunde, für die du noch keine Wette platziert hast!`,
  },
  en: {
    title: 'NFL POINTS - Bet Reminder',
    single: (game) => `${teamMatchup(game)} starts in about 1 hour - you haven't placed a bet yet!`,
    multi: (count) => `${count} games start in about 1 hour that you haven't bet on yet!`,
  },
};

// Baut pro Nutzer genau EINE Erinnerung aus allen fälligen Spielen, für die er
// noch nicht getippt hat - verhindert Nachrichtenflut wenn mehrere Spiele in
// etwa zur gleichen Zeit anstehen
function buildUserReminders(gamesNeedingReminder, missingBetsByGame, userLanguages) {
  const perUser = new Map(); // userId -> [game, ...]

  for (const game of gamesNeedingReminder) {
    const missingUserIds = missingBetsByGame.get(game.id) || [];
    for (const userId of missingUserIds) {
      if (!perUser.has(userId)) perUser.set(userId, []);
      perUser.get(userId).push(game);
    }
  }

  const reminders = new Map(); // userId -> { title, body, url }
  for (const [userId, games] of perUser.entries()) {
    const lang = userLanguages.get(userId) === 'en' ? 'en' : 'de';
    const text = REMINDER_TEXT[lang];
    let body;
    let url = './pages/games.html';
    if (games.length === 1) {
      body = text.single(games[0]);
      url = `./pages/games.html?game=${games[0].id}`;
    } else {
      body = text.multi(games.length);
    }
    reminders.set(userId, { title: text.title, body, url });
  }
  return reminders;
}

async function sendToUser(userId, payload) {
  const subsSnapshot = await db.collection('users').doc(userId).collection('push_subscriptions').get();
  if (subsSnapshot.empty) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;

  for (const subDoc of subsSnapshot.docs) {
    const sub = subDoc.data();
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      );
      sent++;
    } catch (error) {
      // 404/410 = Subscription ist nicht mehr gültig (Browser abgemeldet, App
      // deinstalliert, ...) - Eintrag aufräumen statt bei jedem Lauf erneut
      // erfolglos zu versuchen
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
  const now = Date.now();
  const windowStart = new Date(now + WINDOW_MIN_MINUTES * 60000);
  const windowEnd = new Date(now + WINDOW_MAX_MINUTES * 60000);

  // Serverseitig gefiltert (nicht erst client-seitig danach) - siehe
  // check-scores.js für den Hintergrund dieser Regel (Kontingent-Vorfall)
  const gamesSnapshot = await db.collection('games')
    .where('status', '==', 'scheduled')
    .where('game_date', '>=', admin.firestore.Timestamp.fromDate(windowStart))
    .where('game_date', '<=', admin.firestore.Timestamp.fromDate(windowEnd))
    .get();

  const candidateGames = gamesSnapshot.docs
    .map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
    .filter(game => !game.reminder_sent);

  if (candidateGames.length === 0) {
    console.log('Keine Spiele im Erinnerungsfenster (oder bereits erledigt).');
    return;
  }

  console.log(`${candidateGames.length} Spiel(e) im Erinnerungsfenster, prüfe Wetten...`);

  const usersSnapshot = await db.collection('users').get();
  const allUserIds = usersSnapshot.docs.map(doc => doc.id);
  const userLanguages = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data().language]));

  const missingBetsByGame = new Map();
  for (const game of candidateGames) {
    const betsSnapshot = await db.collection('bets').where('game_id', '==', game.id).get();
    const bettedUserIds = new Set(betsSnapshot.docs.map(doc => doc.data().user_id));
    const missingUserIds = allUserIds.filter(id => !bettedUserIds.has(id));
    missingBetsByGame.set(game.id, missingUserIds);
    console.log(`  ${teamMatchup(game)}: ${missingUserIds.length} von ${allUserIds.length} Nutzern ohne Wette`);
  }

  const reminders = buildUserReminders(candidateGames, missingBetsByGame, userLanguages);

  let notifiedUsers = 0;
  let totalSent = 0;
  let totalRemoved = 0;

  for (const [userId, payload] of reminders.entries()) {
    const { sent, removed } = await sendToUser(userId, payload);
    if (sent > 0) notifiedUsers++;
    totalSent += sent;
    totalRemoved += removed;
  }

  // Alle geprüften Spiele als erledigt markieren, unabhängig davon ob dafür
  // tatsächlich jemand benachrichtigt wurde (verhindert erneutes Prüfen bei
  // jedem weiteren 15-Minuten-Lauf)
  const batch = db.batch();
  for (const game of candidateGames) {
    batch.update(game.ref, { reminder_sent: true });
  }
  await batch.commit();

  console.log(`\nFertig. ${notifiedUsers} Nutzer benachrichtigt (${totalSent} Geräte, ${totalRemoved} veraltete Subscriptions entfernt).`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unerwarteter Fehler:', error);
    process.exit(1);
  });
