// ==================== FIREBASE CONFIGURATION ====================
// Firebase SDK Version 10.7.1 - Compat Mode - OPTIMIZED
// ===============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBhhPFVV_cyH5kPMVFM55gpeMvCms8-l9U",
  authDomain: "projekt1-95e74.firebaseapp.com",
  projectId: "projekt1-95e74",
  storageBucket: "projekt1-95e74.firebasestorage.app",
  messagingSenderId: "204324789350",
  appId: "1:204324789350:web:c54182f94b57a8e5a521a7",
  measurementId: "G-ZXV5PPJR04"
};

Object.assign(TRANSLATIONS.de, {
  error_not_logged_in: 'Nicht angemeldet', error_user_data_not_found: 'Benutzerdaten nicht gefunden',
  error_no_email_found: 'Keine E-Mail-Adresse gefunden',
  error_username_min_length: 'Benutzername muss mindestens 2 Zeichen haben',
  error_already_bet: 'Du hast bereits auf dieses Spiel gewettet', error_game_not_found: 'Spiel nicht gefunden',
  error_betting_closed_place: 'Die Tipp-Sperrfrist ist erreicht. Wette kann nicht mehr platziert werden.',
  error_bet_not_found: 'Wette nicht gefunden',
  error_delete_own_bets_only: 'Du kannst nur deine eigenen Wetten löschen',
  error_betting_closed_delete: 'Die Tipp-Sperrfrist ist erreicht. Wette kann nicht mehr gelöscht werden.',
  error_invalid_invite_code: 'Ungültiger Einladungscode',
  error_already_group_member: 'Du bist bereits Mitglied dieser Gruppe',
  error_admin_cant_leave_group: 'Als Admin kannst du die Gruppe nicht verlassen. Lösche sie stattdessen.',
  error_only_admin_remove_members: 'Nur der Admin kann Mitglieder entfernen',
  error_cant_remove_self: 'Du kannst dich nicht selbst entfernen',
  error_only_admin_delete_group: 'Nur der Admin kann die Gruppe löschen',
  error_group_not_found: 'Gruppe nicht gefunden',
  error_only_admin_rename_group: 'Nur der Admin kann den Gruppennamen ändern',
  error_group_name_min_length: 'Gruppenname muss mindestens 2 Zeichen haben',
  error_push_not_supported: 'Dein Browser unterstützt leider keine Push-Benachrichtigungen',
  error_push_permission_denied: 'Benachrichtigungen wurden nicht erlaubt. Du kannst das in den Browser-/App-Einstellungen ändern.'
});
Object.assign(TRANSLATIONS.en, {
  error_not_logged_in: 'Not logged in', error_user_data_not_found: 'User data not found',
  error_no_email_found: 'No email address found',
  error_username_min_length: 'Username must be at least 2 characters',
  error_already_bet: 'You have already bet on this game', error_game_not_found: 'Game not found',
  error_betting_closed_place: 'The betting deadline has passed. The bet can no longer be placed.',
  error_bet_not_found: 'Bet not found',
  error_delete_own_bets_only: 'You can only delete your own bets',
  error_betting_closed_delete: 'The betting deadline has passed. The bet can no longer be deleted.',
  error_invalid_invite_code: 'Invalid invite code',
  error_already_group_member: 'You are already a member of this group',
  error_admin_cant_leave_group: 'As admin you cannot leave the group. Delete it instead.',
  error_only_admin_remove_members: 'Only the admin can remove members',
  error_cant_remove_self: 'You cannot remove yourself',
  error_only_admin_delete_group: 'Only the admin can delete the group',
  error_group_not_found: 'Group not found',
  error_only_admin_rename_group: 'Only the admin can change the group name',
  error_group_name_min_length: 'Group name must be at least 2 characters',
  error_push_not_supported: 'Your browser does not support push notifications',
  error_push_permission_denied: 'Notifications were not allowed. You can change this in your browser/app settings.'
});

// ==================== PERFORMANCE CACHE ====================
// Games-Caching läuft über eigene, saison-fähige Strukturen (siehe
// finishedGamesCache/gamesCombinedCache weiter unten), nicht über dataCache.
// TTLs bewusst grosszuegig, seit die localStorage-Schicht (unten) sie auch
// über Seitenwechsel hinweg gültig hält - eigene Wetten/Gruppen ändern sich
// selten spontan von aussen, und jede Aktion die sie ändert (Wette
// platzieren/löschen, Gruppe beitreten/verlassen, Profil bearbeiten)
// invalidiert den jeweiligen Cache ohnehin sofort explizit.
const dataCache = {
  leaderboard: { data: null, timestamp: 0, ttl: 60000 }, // 60 Sekunden
  userBets: { data: null, timestamp: 0, ttl: 60000 }, // 60 Sekunden (vorher 15s)
  groups: { data: null, timestamp: 0, ttl: 60000 }, // 60 Sekunden (vorher 30s)
  currentUser: { data: null, timestamp: 0, ttl: 60000 } // 60 Sekunden
};

// ==================== LOCALSTORAGE-PERSISTENZ ====================
// Ohne SPA-Routing wird bei jedem Seitenwechsel dieses komplette Script neu
// geladen und alle Caches oben sind wieder leer - jeder Klick auf eine andere
// Seite hat dadurch praktisch alles neu von Firestore geholt, auch wenn es
// Sekunden vorher schon geladen wurde. Das war der Hauptgrund für das
// Firestore-Kontingent-Problem vom 21.09.2026 (siehe Obsidian: Sicherheit.md).
// localStorage übersteht Seitenwechsel und dient hier als zweite Schicht
// hinter dem In-Memory-Cache - gleiche TTLs, nur mit größerer Reichweite.
const LS_PREFIX = 'nflp_cache_';

function lsRead(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function lsWrite(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    // z.B. Safari Privatmodus oder voller Speicher - Cache ist nur eine
    // Optimierung, darf den eigentlichen Ablauf nie blockieren
  }
}

function lsRemove(key) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch (e) {}
}

function lsRemovePrefix(prefix) {
  try {
    const full = LS_PREFIX + prefix;
    Object.keys(localStorage)
      .filter(k => k.startsWith(full))
      .forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

// 'leaderboard' ist global, 'userBets'/'groups' gehören zum eingeloggten
// Nutzer - deshalb pro Nutzer (uid) getrennt speichern, damit auf einem
// gemeinsam genutzten Browser nicht die Wetten/Gruppen des vorherigen
// Nutzers sichtbar werden
function dataCacheStorageKey(key) {
  if (key === 'leaderboard') return 'leaderboard';
  if (key === 'userBets' || key === 'groups' || key === 'currentUser') {
    const uid = auth && auth.currentUser && auth.currentUser.uid;
    return uid ? `${key}_${uid}` : null;
  }
  return null;
}

// Cache helper functions
function getCachedData(key) {
  const cache = dataCache[key];
  if (cache && cache.data && (Date.now() - cache.timestamp) < cache.ttl) {
    return cache.data;
  }

  // In-Memory-Cache leer (z.B. nach Seitenwechsel) - in localStorage nachsehen,
  // bevor Firestore gefragt wird
  const storageKey = dataCacheStorageKey(key);
  if (cache && storageKey) {
    const persisted = lsRead(storageKey);
    if (persisted && (Date.now() - persisted.timestamp) < cache.ttl) {
      cache.data = persisted.data;
      cache.timestamp = persisted.timestamp;
      return persisted.data;
    }
  }
  return null;
}

function setCachedData(key, data) {
  if (dataCache[key]) {
    dataCache[key].data = data;
    dataCache[key].timestamp = Date.now();

    const storageKey = dataCacheStorageKey(key);
    if (storageKey) {
      lsWrite(storageKey, { data, timestamp: dataCache[key].timestamp });
    }
  }
}

function invalidateCache(key) {
  if (key) {
    if (dataCache[key]) {
      dataCache[key].data = null;
      dataCache[key].timestamp = 0;
    }
    const storageKey = dataCacheStorageKey(key);
    if (storageKey) lsRemove(storageKey);
  } else {
    // Invalidate all
    Object.keys(dataCache).forEach(k => {
      dataCache[k].data = null;
      dataCache[k].timestamp = 0;
      const storageKey = dataCacheStorageKey(k);
      if (storageKey) lsRemove(storageKey);
    });
  }
}

// ==================== DEBUG MODE ====================
const DEBUG_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

// ==================== FIREBASE INITIALIZATION ====================
let app, auth, db;
let firebaseReady = false;
let firebaseReadyCallbacks = [];
// Promise, die auflöst sobald setPersistence() wirklich fertig ist - auth.js
// wartet darauf, bevor onAuthStateChanged registriert wird (siehe Kommentar
// bei setPersistence() unten für den Grund)
let authPersistenceReady = null;

function onFirebaseReady(callback) {
  if (firebaseReady) {
    callback();
  } else {
    firebaseReadyCallbacks.push(callback);
  }
}

function initializeFirebase() {
  // Wird von mehreren Stellen aufgerufen (Inline-Script in der HTML + jede
  // page.js selbst) - beim zweiten Aufruf würde db.settings() werfen, da
  // Firestore schon gestartet ist. Einfach überspringen, wenn schon bereit.
  if (firebaseReady) {
    return true;
  }

  if (typeof firebase !== 'undefined') {
    try {
      // Prüfen ob schon initialisiert
      if (firebase.apps.length === 0) {
        app = firebase.initializeApp(firebaseConfig);
      } else {
        app = firebase.apps[0];
      }
      // Räumt übermäßig angesammelte groupBets-Cache-Einträge auf (siehe
      // pruneGroupBetsCacheIfNeeded weiter unten) - läuft bei JEDEM Start,
      // nicht erst beim nächsten Schreibvorgang, damit bereits bestehender
      // Speicher-Überschuss (der Firebase Auths eigene Sitzungsdaten beim
      // Schreiben stören kann) auch ohne manuellen "Cache leeren"-Klick
      // behoben wird. Läuft VOR setPersistence, damit Firebase Auth danach
      // möglichst viel freien Speicher vorfindet.
      pruneGroupBetsCacheIfNeeded();

      auth = firebase.auth();

      // WICHTIG (2026-09-23): war kurzzeitig auf einen per dynamic import()
      // nachgeladenen, MODULAREN browserLocalPersistence umgestellt (in der
      // Annahme, dass IndexedDB - was Compat-LOCAL tatsächlich nutzt, siehe
      // Datenbank "firebaseLocalStorageDb" - in der installierten Android-App
      // nicht zuverlässig übersteht). Nach dieser Umstellung trat aber ein
      // NEUES, reproduzierbares Symptom auf: der Auth-Schlüssel war beim
      // Laden noch da, verschwand aber WÄHREND Firebase's eigener
      // Initialisierung wieder (bestätigt über mehrere sauber getestete
      // Läufe). Vermutung: das Mischen von Compat- und modularer SDK auf
      // derselben Auth-Instanz für die Persistenz-Umstellung hat einen
      // internen Migrations-Konflikt ausgelöst statt das Problem zu lösen.
      // Zurückgerollt auf die einfache, gut getestete Compat-API - das
      // eigentliche Problem war vermutlich ohnehin der jetzt behobene
      // Service-Worker-Cache-Bug (sw.js, Browser-HTTP-Cache wurde nicht
      // umgangen), der frühere Testergebnisse verfälscht haben könnte.
      authPersistenceReady = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
        debugLog('Auth-Persistenz konnte nicht gesetzt werden:', err.code);
      });

      db = firebase.firestore();
      
      // Firestore Settings für bessere Performance
      db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
      });
      
      // Enable offline persistence (non-blocking)
      db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code === 'failed-precondition') {
          debugLog('Firestore persistence: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
          debugLog('Firestore persistence not available');
        }
      });
      
      debugLog('✅ Firebase initialized successfully');
      
      // Mark as ready and run callbacks
      firebaseReady = true;
      firebaseReadyCallbacks.forEach(cb => cb());
      firebaseReadyCallbacks = [];
      
      // Debug tests only in development
      if (DEBUG_MODE) {
        setTimeout(() => testFirestoreConnection(), 1000);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      return false;
    }
  }
  console.error('❌ Firebase SDK not loaded');
  return false;
}

// Debug function - only runs in DEBUG_MODE
async function testFirestoreConnection() {
  if (!DEBUG_MODE) return;
  
  try {
    debugLog('🔍 Testing Firestore connection...');
    const user = auth.currentUser;
    debugLog('👤 Auth User:', user ? user.uid : 'NOT LOGGED IN');
  } catch (error) {
    debugLog('❌ Firestore Test Error:', error.code);
  }
}

// ==================== FIRESTORE COLLECTIONS ====================
const collections = {
  users: () => db.collection('users'),
  games: () => db.collection('games'),
  bets: () => db.collection('bets'),
  groups: () => db.collection('groups'),
};

// ==================== PUSH-BENACHRICHTIGUNGEN (Wett-Erinnerung) ====================
// Speichert die Push-Subscription eines Geräts unter
// users/{uid}/push_subscriptions/{hash der endpoint-URL} - der Hash sorgt
// dafür, dass ein erneutes Abonnieren desselben Geräts den bestehenden
// Eintrag überschreibt statt Duplikate anzulegen. Versand läuft serverseitig
// über automation/send-bet-reminders.js (Firebase Admin SDK, GitHub Actions).
async function hashPushEndpoint(endpoint) {
  const data = new TextEncoder().encode(endpoint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// navigator.serviceWorker.ready hängt sich für immer auf, wenn die
// Registrierung (siehe main.js, läuft auf 'load') aus irgendeinem Grund nie
// abschließt - Timeout verhindert, dass der Status-Check dann ewig lädt
function getServiceWorkerRegistration(timeoutMs = 5000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Service Worker Timeout')), timeoutMs)),
  ]);
}

// Fragt Benachrichtigungs-Erlaubnis an und abonniert Push-Erinnerungen für
// dieses Gerät. Wirft eine sprechende Fehlermeldung, wenn der Nutzer ablehnt
// oder der Browser Push nicht unterstützt (z.B. iOS Safari außerhalb der
// installierten PWA).
async function firebaseSubscribeToPush() {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error(t('error_push_not_supported'));
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(t('error_push_permission_denied'));
  }

  const registration = await getServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = subscription.toJSON();
  const subId = await hashPushEndpoint(subJson.endpoint);

  await db.collection('users').doc(user.uid).collection('push_subscriptions').doc(subId).set({
    endpoint: subJson.endpoint,
    keys: subJson.keys,
    created_at: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Deabonniert Push für dieses Gerät und entfernt den Firestore-Eintrag
async function firebaseUnsubscribeFromPush() {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  if (!('serviceWorker' in navigator)) return;

  const registration = await getServiceWorkerRegistration().catch(() => null);
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const subJson = subscription.toJSON();
  const subId = await hashPushEndpoint(subJson.endpoint);
  await subscription.unsubscribe();
  await db.collection('users').doc(user.uid).collection('push_subscriptions').doc(subId).delete().catch(() => {});
}

// Prüft ob dieses Gerät aktuell für Push-Erinnerungen abonniert ist (für den
// Toggle-Zustand in den Einstellungen)
async function firebaseGetPushSubscriptionStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  const registration = await getServiceWorkerRegistration().catch(() => null);
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

// ==================== PROFILE PICTURE HELPERS ====================

// Compress and convert image to base64
async function compressImageToBase64(file, maxWidth = 150, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 (JPEG for smaller size)
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Update profile picture in Firestore
async function firebaseUpdateProfilePicture(base64Image) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  await collections.users().doc(user.uid).update({
    profile_picture: base64Image
  });
  
  return base64Image;
}

// Remove profile picture
async function firebaseRemoveProfilePicture() {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  await collections.users().doc(user.uid).update({
    profile_picture: firebase.firestore.FieldValue.delete()
  });
}

// ==================== AUTH HELPERS ====================
async function firebaseRegister(email, password, username) {
  const userCredential = await auth.createUserWithEmailAndPassword(email, password);
  const user = userCredential.user;
  
  const userData = {
    id: user.uid,
    username: username,
    email: email,
    is_admin: false,
    total_points: 0,
    // total_bets/correct_winners/correct_scores waren hier bisher NICHT
    // gesetzt (nur implizit über FieldValue.increment() beim ersten Wetten/
    // Punkte-Berechnen entstanden). Das bricht die Firestore-Regel für
    // users.update: die vergleicht resource.data.correct_winners/
    // correct_scores VOR der Änderung mit dem Wert danach - fehlt das Feld
    // komplett, schlägt der Vergleich fehl und JEDE erste Wette eines neuen
    // Nutzers wurde mit "Missing or insufficient permissions" abgelehnt.
    total_bets: 0,
    correct_winners: 0,
    correct_scores: 0,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  await collections.users().doc(user.uid).set(userData);
  
  return { ...userData, created_at: new Date().toISOString() };
}

async function firebaseLogin(email, password) {
  const userCredential = await auth.signInWithEmailAndPassword(email, password);
  const user = userCredential.user;
  
  const userDoc = await collections.users().doc(user.uid).get();
  
  if (!userDoc.exists) {
    throw new Error(t('error_user_data_not_found'));
  }
  
  const userData = userDoc.data();
  return {
    ...userData,
    created_at: userData.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
  };
}

async function firebaseLogout() {
  await auth.signOut();
}

async function firebaseGetCurrentUser(useCache = true) {
  const user = auth.currentUser;
  if (!user) return null;

  if (useCache) {
    const cached = getCachedData('currentUser');
    if (cached) return cached;
  }

  const userDoc = await collections.users().doc(user.uid).get();
  if (!userDoc.exists) return null;

  const userData = userDoc.data();
  const result = {
    ...userData,
    created_at: userData.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
  };
  setCachedData('currentUser', result);
  return result;
}

async function firebaseDeleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  await collections.users().doc(user.uid).delete();
  
  const betsSnapshot = await collections.bets().where('user_id', '==', user.uid).get();
  const batch = db.batch();
  betsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  await user.delete();
}

// Send password reset email
async function firebaseSendPasswordReset(email) {
  if (!email) {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error(t('error_no_email_found'));
    email = user.email;
  }
  
  await auth.sendPasswordResetEmail(email);
  return email;
}

// Speichert die gewählte Sprache zusätzlich am Nutzer-Dokument (nicht nur
// localStorage) - der Sprachwahl-Schalter selbst bleibt rein clientseitig,
// aber die Push-Benachrichtigungen werden serverseitig verschickt
// (automation/send-bet-reminders.js, notify-new-version.js) und haben sonst
// keine Möglichkeit, die Sprache des jeweiligen Nutzers zu kennen. Bewusst
// "fire and forget" (kein await beim Aufruf, kein Fehler blockiert die
// eigentliche Sprachumschaltung) - schlägt der Schreibvorgang fehl, bleibt
// die Sprache im Browser trotzdem korrekt umgestellt, nur die
// Benachrichtigungen würden dann auf der zuletzt bekannten Sprache bleiben.
async function firebaseUpdateUserLanguage(lang) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await collections.users().doc(user.uid).update({ language: lang });
  } catch (error) {
    console.warn('Sprache konnte nicht am Nutzer-Dokument gespeichert werden:', error);
  }
}

// Update username
async function firebaseUpdateUsername(newUsername) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  if (!newUsername || newUsername.trim().length < 2) {
    throw new Error(t('error_username_min_length'));
  }
  
  const trimmedUsername = newUsername.trim();
  
  // Update user document
  await collections.users().doc(user.uid).update({
    username: trimmedUsername
  });
  
  // Update username in all bets
  const betsSnapshot = await collections.bets().where('user_id', '==', user.uid).get();
  if (!betsSnapshot.empty) {
    const batch = db.batch();
    betsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { username: trimmedUsername });
    });
    await batch.commit();
  }
  
  // Update username in group memberships
  const groupsSnapshot = await collections.groups()
    .where('member_ids', 'array-contains', user.uid)
    .get();
  
  for (const groupDoc of groupsSnapshot.docs) {
    const groupData = groupDoc.data();
    const updatedMembers = groupData.members.map(m => 
      m.user_id === user.uid ? { ...m, username: trimmedUsername } : m
    );
    await groupDoc.ref.update({ members: updatedMembers });
  }
  
  return trimmedUsername;
}

// ==================== GAMES HELPERS ====================
function mapGameDoc(doc) {
  const data = doc.data();
  return {
    ...data,
    game_date: data.game_date?.toDate?.()?.toISOString() || data.game_date,
    created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
  };
}

// Dynamischer Cache für (ggf. saison-gefilterte) Spiele-Kombi-Abfragen.
// Key: Saison-String oder 'all' für unfilterte Abfragen.
const finishedGamesCache = {};
// Beendete Spiele ändern sich nie von selbst - lange TTL ist sicher, jede
// nachträgliche Korrektur (Admin ändert Endstand) ruft ohnehin
// invalidateGamesCaches() auf. War 3 Minuten, was in Kombination mit der
// localStorage-Persistenz kaum noch Vorteile brachte, da der Cache trotzdem
// ständig neu ablief.
const FINISHED_GAMES_TTL = 21600000; // 6 Stunden (vorher 3 Minuten)
const gamesCombinedCache = {};
// War 30s - zu kurz für den häufigsten Ablauf (Spiele-Liste -> Spiel öffnen,
// tippen, zurück): das dauert oft länger als 30s, wodurch der Cache beim
// Zurückgehen schon wieder abgelaufen war und alles neu geladen wurde. 2 Min
// ist immer noch kurz genug, dass Live-Spielstände nicht spürbar veraltet
// wirken, aber deckt diesen Rundgang jetzt zuverlässig ab.
const GAMES_COMBINED_TTL = 120000; // 2 Minuten (vorher 30s)

// Beendete Spiele ändern sich nie wieder - lange cachen statt bei jedem
// Seitenaufruf die komplette Historie (alte Saisons + Playoffs) neu zu laden.
// Optional nach Saison gefiltert, damit ein Ladevorgang für "nur die aktuelle
// Saison" nicht trotzdem alle anderen Saisons mitschleppt.
async function getFinishedGamesCached(season = null) {
  const cacheKey = season || 'all';
  const cached = finishedGamesCache[cacheKey];
  if (cached && (Date.now() - cached.timestamp) < FINISHED_GAMES_TTL) {
    debugLog('📦 Beendete Spiele aus Cache:', cacheKey);
    return cached.data;
  }

  // Beendete Spiele ändern sich nie wieder - lohnt sich besonders, über
  // Seitenwechsel hinweg aus localStorage zu bedienen statt neu zu laden
  const storageKey = `finishedGames_${cacheKey}`;
  const persisted = lsRead(storageKey);
  if (persisted && (Date.now() - persisted.timestamp) < FINISHED_GAMES_TTL) {
    debugLog('📦 Beendete Spiele aus localStorage:', cacheKey);
    finishedGamesCache[cacheKey] = persisted;
    return persisted.data;
  }

  let query = collections.games().where('status', '==', 'finished');
  if (season) {
    query = query.where('season', '==', season);
  }
  const snapshot = await query.get();
  const games = snapshot.docs.map(mapGameDoc);
  const entry = { data: games, timestamp: Date.now() };
  finishedGamesCache[cacheKey] = entry;
  lsWrite(storageKey, entry);
  return games;
}

// Laufende/geplante Spiele können sich jederzeit ändern (Automatik setzt sie
// live/beendet) - immer frisch laden, optional nach Saison gefiltert
async function getActiveGamesFresh(season = null) {
  let query = collections.games().where('status', 'in', ['scheduled', 'live']);
  if (season) {
    query = query.where('season', '==', season);
  }
  const snapshot = await query.get();
  return snapshot.docs.map(mapGameDoc);
}

function invalidateGamesCaches() {
  Object.keys(finishedGamesCache).forEach(key => delete finishedGamesCache[key]);
  Object.keys(gamesCombinedCache).forEach(key => delete gamesCombinedCache[key]);
  lsRemovePrefix('finishedGames_');
  lsRemovePrefix('gamesCombined_');
}

async function firebaseGetGames(filters = {}, useCache = true) {
  try {
    // Einzelne Woche: sehr spezifische, kleine Abfrage - unverändert direkt
    if (filters.week) {
      let query = collections.games().where('week', '==', filters.week);
      if (filters.season) {
        query = query.where('season', '==', filters.season);
      }
      const snapshot = await query.get();
      const sortedGames = snapshot.docs.map(mapGameDoc)
        .sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
      debugLog('🎮 Games loaded from Firestore:', sortedGames.length);
      return sortedGames;
    }

    // Ohne Wochen-Filter (mit oder ohne Saison): aufgeteilt in beendete
    // (lang gecacht) und laufende/geplante Spiele (immer frisch), da
    // beendete Spiele den Großteil der Datenmenge ausmachen und sich nie
    // mehr ändern. Kombi-Ergebnis zusätzlich kurz gecacht (30s) gegen
    // mehrfache Aufrufe kurz hintereinander.
    const cacheKey = filters.season || 'all';
    const storageKey = `gamesCombined_${cacheKey}`;
    if (useCache) {
      const cached = gamesCombinedCache[cacheKey];
      if (cached && (Date.now() - cached.timestamp) < GAMES_COMBINED_TTL) {
        debugLog('📦 Games loaded from cache:', cacheKey);
        return cached.data;
      }
      // Kurzes TTL (30s), hilft aber trotzdem bei schnellem Hin-und-Her
      // zwischen Seiten (z.B. Spiele -> Spiel-Detail -> zurück)
      const persisted = lsRead(storageKey);
      if (persisted && (Date.now() - persisted.timestamp) < GAMES_COMBINED_TTL) {
        debugLog('📦 Games loaded from localStorage:', cacheKey);
        gamesCombinedCache[cacheKey] = persisted;
        return persisted.data;
      }
    }

    const [finishedGames, activeGames] = await Promise.all([
      getFinishedGamesCached(filters.season),
      getActiveGamesFresh(filters.season)
    ]);

    const sortedGames = [...finishedGames, ...activeGames]
      .sort((a, b) => new Date(a.game_date) - new Date(b.game_date));

    const entry = { data: sortedGames, timestamp: Date.now() };
    gamesCombinedCache[cacheKey] = entry;
    lsWrite(storageKey, entry);
    debugLog('🎮 Games loaded from Firestore:', sortedGames.length);
    return sortedGames;
  } catch (error) {
    console.error('Error in firebaseGetGames:', error);
    throw error;
  }
}

async function firebaseGetGame(gameId) {
  const doc = await collections.games().doc(gameId).get();
  if (!doc.exists) return null;
  
  const data = doc.data();
  return {
    ...data,
    game_date: data.game_date?.toDate?.()?.toISOString() || data.game_date,
    created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
  };
}

async function firebaseCreateGame(gameData) {
  const gameId = db.collection('_').doc().id;
  const game = {
    id: gameId,
    ...gameData,
    game_date: firebase.firestore.Timestamp.fromDate(new Date(gameData.game_date)),
    home_score: null,
    away_score: null,
    status: 'scheduled',
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  await collections.games().doc(gameId).set(game);
  
  // Invalidate games cache
  invalidateGamesCaches();
  
  return { ...game, game_date: gameData.game_date, created_at: new Date().toISOString() };
}

async function firebaseUpdateGame(gameId, updateData) {
  // Convert Date object to Firestore Timestamp if present
  if (updateData.game_date instanceof Date) {
    updateData.game_date = firebase.firestore.Timestamp.fromDate(updateData.game_date);
  }
  
  await collections.games().doc(gameId).update(updateData);
  
  // Invalidate games cache
  invalidateGamesCaches();
  
  if (updateData.status === 'finished' && updateData.home_score != null && updateData.away_score != null) {
    await calculatePointsForGame(gameId, updateData.home_score, updateData.away_score);
    // Invalidate leaderboard cache after points calculation
    invalidateCache('leaderboard');
  }
  
  return await firebaseGetGame(gameId);
}

async function firebaseDeleteGame(gameId) {
  await collections.games().doc(gameId).delete();
  
  // Invalidate games cache
  invalidateGamesCaches();
  
  const betsSnapshot = await collections.bets().where('game_id', '==', gameId).get();
  const batch = db.batch();
  betsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

// ==================== BETS HELPERS ====================
// Lädt nur die eigene Wette für ein Spiel, statt wie firebaseGetGameBets()
// ALLE Wetten aller Nutzer im ganzen System zu laden, nur um die eigene
// darin zu suchen
async function firebaseGetUserBetForGame(userId, gameId) {
  try {
    const snapshot = await collections.bets()
      .where('user_id', '==', userId)
      .where('game_id', '==', gameId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    };
  } catch (error) {
    console.error('Error in firebaseGetUserBetForGame:', error);
    throw error;
  }
}

async function firebaseGetUserBets(userId) {
  try {
    const snapshot = await collections.bets()
      .where('user_id', '==', userId)
      .get();
    
    const bets = snapshot.docs.map(doc => ({
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    }));
    
    // Sortiere client-seitig
    return bets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (error) {
    console.error('Error in firebaseGetUserBets:', error);
    throw error;
  }
}

async function firebasePlaceBet(betData) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  const existing = await collections.bets()
    .where('user_id', '==', user.uid)
    .where('game_id', '==', betData.game_id)
    .get();
  
  if (!existing.empty) {
    throw new Error(t('error_already_bet'));
  }
  
  const userDoc = await collections.users().doc(user.uid).get();
  const userData = userDoc.data();

  // Sperrfrist wird fest am Wett-Dokument gespeichert (statt sie bei jedem
  // späteren Ändern/Löschen erneut über das Spiel-Dokument nachzuschlagen) -
  // die Firestore Security Rule prüft beim update/delete direkt
  // request.time < resource.data.betting_lock_time statt eines get() auf
  // games/{gameId}. Erfordert trotzdem hier einen get(), aber nur einmal pro
  // Wette statt einmal pro Änderung/Löschung.
  const gameDoc = await collections.games().doc(betData.game_id).get();
  if (!gameDoc.exists) {
    throw new Error(t('error_game_not_found'));
  }
  const gameData = gameDoc.data();
  const gameDate = gameData.game_date?.toDate?.() || new Date(gameData.game_date);
  const bettingLockTime = new Date(gameDate.getTime() - BETTING_LOCK_MINUTES_BEFORE_KICKOFF * 60000);
  if (new Date() >= bettingLockTime) {
    throw new Error(t('error_betting_closed_place'));
  }

  const betId = db.collection('_').doc().id;
  const bet = {
    id: betId,
    user_id: user.uid,
    username: userData.username,
    game_id: betData.game_id,
    home_score_prediction: betData.home_score_prediction,
    away_score_prediction: betData.away_score_prediction,
    points_earned: 0,
    betting_lock_time: firebase.firestore.Timestamp.fromDate(bettingLockTime),
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };

  await collections.bets().doc(betId).set(bet);

  // total_bets direkt am Nutzer-Konto mitführen, damit die Rangliste nicht
  // mehr ALLE Wetten aller Nutzer scannen muss, um diese Zahl zu ermitteln
  await collections.users().doc(user.uid).update({
    total_bets: firebase.firestore.FieldValue.increment(1)
  });

  // Invalidate user bets cache
  invalidateCache('userBets');
  invalidateCache('leaderboard');

  return { ...bet, created_at: new Date().toISOString(), betting_lock_time: bettingLockTime.toISOString() };
}

async function firebaseUpdateBet(betId, betData) {
  await collections.bets().doc(betId).update({
    home_score_prediction: betData.home_score_prediction,
    away_score_prediction: betData.away_score_prediction
  });

  // Fehlte bisher (anders als bei firebasePlaceBet/firebaseDeleteBet) - ohne
  // das zeigte die Spielübersicht nach einer Tipp-Änderung bis zu 60s lang
  // (userBets-Cache-TTL) noch den alten Tipp, auch nach einem Reload.
  invalidateCache('userBets');

  const doc = await collections.bets().doc(betId).get();
  return {
    ...doc.data(),
    created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at,
    betting_lock_time: doc.data().betting_lock_time?.toDate?.()?.toISOString() || doc.data().betting_lock_time
  };
}

// Wette löschen
async function firebaseDeleteBet(betId) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));

  // Prüfe ob es die eigene Wette ist
  const betDoc = await collections.bets().doc(betId).get();
  if (!betDoc.exists) {
    throw new Error(t('error_bet_not_found'));
  }

  const betData = betDoc.data();
  if (betData.user_id !== user.uid) {
    throw new Error(t('error_delete_own_bets_only'));
  }

  // Prüfe ob die Sperrfrist vor Anpfiff noch nicht erreicht ist. Sperrfrist
  // liegt bei neueren Wetten direkt am Dokument (betting_lock_time, siehe
  // firebasePlaceBet) - kein get() auf das Spiel mehr nötig. Ältere Wetten
  // (vor dieser Änderung angelegt) haben das Feld noch nicht und fallen auf
  // den alten, get()-basierten Check zurück.
  if (betData.betting_lock_time) {
    const bettingLockTime = betData.betting_lock_time.toDate?.() || new Date(betData.betting_lock_time);
    if (new Date() >= bettingLockTime) {
      throw new Error(t('error_betting_closed_delete'));
    }
  } else {
    const gameDoc = await collections.games().doc(betData.game_id).get();
    if (gameDoc.exists) {
      const gameData = gameDoc.data();
      const gameDate = gameData.game_date?.toDate?.() || new Date(gameData.game_date);
      const bettingLockTime = new Date(gameDate.getTime() - BETTING_LOCK_MINUTES_BEFORE_KICKOFF * 60000);
      if (new Date() >= bettingLockTime) {
        throw new Error(t('error_betting_closed_delete'));
      }
    }
  }

  await collections.bets().doc(betId).delete();

  // Gegenstück zum increment beim Platzieren der Wette
  await collections.users().doc(user.uid).update({
    total_bets: firebase.firestore.FieldValue.increment(-1)
  });

  // Invalidate user bets cache
  invalidateCache('userBets');
  invalidateCache('leaderboard');
}

// Alle Wetten des aktuellen Users laden (für Spielübersicht)
async function firebaseGetCurrentUserBets(useCache = true) {
  const user = auth.currentUser;
  if (!user) return [];
  
  try {
    // Check cache first
    if (useCache) {
      const cached = getCachedData('userBets');
      if (cached) {
        debugLog('📦 User bets loaded from cache');
        return cached;
      }
    }
    
    const snapshot = await collections.bets()
      .where('user_id', '==', user.uid)
      .get();
    
    const bets = snapshot.docs.map(doc => ({
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    }));
    
    // Cache results
    setCachedData('userBets', bets);
    
    debugLog('🎯 User bets loaded from Firestore:', bets.length);
    return bets;
  } catch (error) {
    console.error('Error in firebaseGetCurrentUserBets:', error);
    return [];
  }
}

async function calculatePointsForGame(gameId, homeScore, awayScore) {
  const betsSnapshot = await collections.bets().where('game_id', '==', gameId).get();

  let actualWinner;
  if (homeScore > awayScore) actualWinner = 1;
  else if (awayScore > homeScore) actualWinner = 2;
  else actualWinner = 0;

  const batch = db.batch();
  // Statt nur Punkte auch correct_winners/correct_scores pro Nutzer mitführen,
  // damit die Rangliste komplett aus den Nutzer-Konten gelesen werden kann statt
  // jedes Mal ALLE Wetten aller Nutzer im System zu scannen
  const userStatsMap = {};

  betsSnapshot.docs.forEach(doc => {
    const bet = doc.data();
    // WICHTIG: Differenz zur zuletzt gespeicherten points_earned dieser Wette
    // verrechnen, nicht den absoluten neuen Wert - total_points am
    // Nutzer-Konto wird unten per FieldValue.increment() aktualisiert, kein
    // set(). Ohne das wuerde eine spaetere Korrektur eines bereits
    // beendeten Spiels (Admin tippt sich beim Endstand vertan, editiert ihn
    // nochmal) die Punkte ein zweites Mal draufaddieren statt sie zu
    // ersetzen - macht die Funktion sicher mehrfach fuer dasselbe Spiel
    // aufrufbar (2026-09-25).
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
    await collections.users().doc(userId).update({
      total_points: firebase.firestore.FieldValue.increment(stats.points),
      correct_winners: firebase.firestore.FieldValue.increment(stats.correctWinners),
      correct_scores: firebase.firestore.FieldValue.increment(stats.correctScores)
    });
  }
}

// ==================== LEADERBOARD HELPERS ====================
// Liest die Rangliste direkt aus den Nutzer-Konten (total_points, total_bets,
// correct_winners, correct_scores werden dort schon inkrementell mitgeführt -
// siehe firebasePlaceBet/firebaseDeleteBet/calculatePointsForGame) statt wie
// bisher ALLE Wetten ALLER Nutzer im System zu laden und clientseitig neu zu
// aggregieren. Das war mit Abstand die teuerste Abfrage der App.
async function firebaseGetLeaderboard(useCache = true) {
  // Check cache first
  if (useCache) {
    const cached = getCachedData('leaderboard');
    if (cached) {
      debugLog('📦 Leaderboard loaded from cache');
      return cached;
    }
  }

  const snapshot = await collections.users().get();

  const leaderboard = snapshot.docs
    .map(doc => doc.data())
    .filter(user => (user.total_bets || 0) > 0) // nur Nutzer, die auch getippt haben
    .map(user => ({
      user_id: user.id,
      username: user.username,
      total_points: user.total_points || 0,
      total_bets: user.total_bets || 0,
      correct_winners: user.correct_winners || 0,
      correct_scores: user.correct_scores || 0
    }))
    .sort((a, b) => b.total_points - a.total_points);

  // Cache results
  setCachedData('leaderboard', leaderboard);

  debugLog('🏆 Leaderboard loaded from Firestore:', leaderboard.length);
  return leaderboard;
}

// ==================== GROUPS HELPERS ====================
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function firebaseGetUserGroups(useCache = true) {
  // Warte auf Auth wenn nötig
  let user = auth.currentUser;
  
  if (!user) {
    // Versuche aus localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      // Warte kurz auf Firebase Auth
      await new Promise(resolve => setTimeout(resolve, 300));
      user = auth.currentUser;
    }
  }
  
  if (!user) {
    debugLog('firebaseGetUserGroups: Kein User eingeloggt');
    return [];
  }
  
  try {
    // Check cache first
    if (useCache) {
      const cached = getCachedData('groups');
      if (cached) {
        debugLog('📦 Groups loaded from cache');
        return cached;
      }
    }
    
    debugLog('firebaseGetUserGroups: Lade Gruppen für User', user.uid);
    const snapshot = await collections.groups()
      .where('member_ids', 'array-contains', user.uid)
      .get();
    
    const groups = snapshot.docs.map(doc => ({
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
    }));
    
    // Cache results
    setCachedData('groups', groups);
    
    debugLog('👥 Groups loaded:', groups.length);
    return groups;
  } catch (error) {
    console.error('Error in firebaseGetUserGroups:', error);
    throw error;
  }
}

async function firebaseGetGroup(groupId) {
  const doc = await collections.groups().doc(groupId).get();
  if (!doc.exists) return null;
  
  const data = doc.data();
  
  // Load profile pictures for all members
  const membersWithPictures = await Promise.all(
    (data.members || []).map(async (member) => {
      try {
        const userDoc = await collections.users().doc(member.user_id).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          return {
            ...member,
            profile_picture: userData.profile_picture || null
          };
        }
      } catch (error) {
        console.error('Error loading member profile:', error);
      }
      return member;
    })
  );
  
  return {
    ...data,
    members: membersWithPictures,
    created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
  };
}

async function firebaseCreateGroup(name) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  const userDoc = await collections.users().doc(user.uid).get();
  const userData = userDoc.data();
  
  const groupId = db.collection('_').doc().id;
  const inviteCode = generateInviteCode();
  
  const group = {
    id: groupId,
    name: name,
    admin_id: user.uid,
    invite_code: inviteCode,
    member_ids: [user.uid],
    members: [{
      user_id: user.uid,
      username: userData.username,
      joined_at: new Date().toISOString()
    }],
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  await collections.groups().doc(groupId).set(group);
  
  // Invalidate groups cache
  invalidateCache('groups');
  
  return { ...group, created_at: new Date().toISOString() };
}

async function firebaseJoinGroup(inviteCode) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  const snapshot = await collections.groups()
    .where('invite_code', '==', inviteCode.toUpperCase())
    .get();
  
  if (snapshot.empty) {
    throw new Error(t('error_invalid_invite_code'));
  }
  
  const groupDoc = snapshot.docs[0];
  const groupData = groupDoc.data();
  
  if (groupData.member_ids.includes(user.uid)) {
    throw new Error(t('error_already_group_member'));
  }
  
  const userDoc = await collections.users().doc(user.uid).get();
  const userData = userDoc.data();
  
  await groupDoc.ref.update({
    member_ids: firebase.firestore.FieldValue.arrayUnion(user.uid),
    members: firebase.firestore.FieldValue.arrayUnion({
      user_id: user.uid,
      username: userData.username,
      joined_at: new Date().toISOString()
    })
  });
  
  // Invalidate groups cache
  invalidateCache('groups');
  delete groupMembersCache[groupDoc.id];
  lsRemove(`groupMembers_${groupDoc.id}`);
  invalidateGroupBetsCache(groupDoc.id);

  return await firebaseGetGroup(groupDoc.id);
}

async function firebaseLeaveGroup(groupId) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  if (groupData.admin_id === user.uid) {
    throw new Error(t('error_admin_cant_leave_group'));
  }
  
  const updatedMembers = groupData.members.filter(m => m.user_id !== user.uid);
  const updatedMemberIds = groupData.member_ids.filter(id => id !== user.uid);
  
  await groupDoc.ref.update({
    member_ids: updatedMemberIds,
    members: updatedMembers
  });
  
  // Invalidate groups cache
  invalidateCache('groups');
  delete groupMembersCache[groupId];
  lsRemove(`groupMembers_${groupId}`);
  invalidateGroupBetsCache(groupId);
}

async function firebaseKickMember(groupId, userId) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  if (groupData.admin_id !== user.uid) {
    throw new Error(t('error_only_admin_remove_members'));
  }
  
  if (userId === groupData.admin_id) {
    throw new Error(t('error_cant_remove_self'));
  }
  
  const updatedMembers = groupData.members.filter(m => m.user_id !== userId);
  const updatedMemberIds = groupData.member_ids.filter(id => id !== userId);
  
  await groupDoc.ref.update({
    member_ids: updatedMemberIds,
    members: updatedMembers
  });

  delete groupMembersCache[groupId];
  lsRemove(`groupMembers_${groupId}`);
  invalidateGroupBetsCache(groupId);
}

async function firebaseDeleteGroup(groupId) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  if (groupData.admin_id !== user.uid) {
    throw new Error(t('error_only_admin_delete_group'));
  }
  
  await groupDoc.ref.delete();
  
  // Invalidate groups cache
  invalidateCache('groups');
}

// Gruppenname ändern (nur Admin)
async function firebaseUpdateGroupName(groupId, newName) {
  const user = auth.currentUser;
  if (!user) throw new Error(t('error_not_logged_in'));
  
  const groupDoc = await collections.groups().doc(groupId).get();
  if (!groupDoc.exists) {
    throw new Error(t('error_group_not_found'));
  }
  
  const groupData = groupDoc.data();
  
  if (groupData.admin_id !== user.uid) {
    throw new Error(t('error_only_admin_rename_group'));
  }
  
  if (!newName || newName.trim().length < 2) {
    throw new Error(t('error_group_name_min_length'));
  }
  
  await groupDoc.ref.update({
    name: newName.trim()
  });
  
  return await firebaseGetGroup(groupId);
}

async function firebaseGetGroupLeaderboard(groupId) {
  const groupDoc = await collections.groups().doc(groupId).get();
  const groupData = groupDoc.data();
  
  const memberIds = groupData.member_ids;
  if (memberIds.length === 0) return [];
  
  const chunks = [];
  for (let i = 0; i < memberIds.length; i += 10) {
    chunks.push(memberIds.slice(i, i + 10));
  }
  
  const userStats = {};

  const snapshots = await Promise.all(
    chunks.map(chunk => collections.bets().where('user_id', 'in', chunk).get())
  );

  snapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      const bet = doc.data();
      if (!userStats[bet.user_id]) {
        userStats[bet.user_id] = {
          user_id: bet.user_id,
          username: bet.username,
          total_points: 0,
          total_bets: 0,
          correct_winners: 0,
          correct_scores: 0
        };
      }

      userStats[bet.user_id].total_points += bet.points_earned || 0;
      userStats[bet.user_id].total_bets += 1;
      if (bet.points_earned > 0) userStats[bet.user_id].correct_winners += 1;
      if (bet.points_earned >= 3) userStats[bet.user_id].correct_scores += 1;
    });
  });

  return Object.values(userStats).sort((a, b) => b.total_points - a.total_points);
}

// Cache für Gruppen-Mitglieder + Profilbilder, damit firebaseGetGroupBets()
// bei mehreren Spielen derselben Gruppe nicht jedes Mal Gruppe + alle
// Profilbilder erneut aus Firestore lädt (war die Hauptbremse beim Laden
// einer Gruppe mit vielen Spielen)
const groupMembersCache = {};
const GROUP_MEMBERS_CACHE_TTL = 30000; // 30 Sekunden

// Gibt ein Promise zurück (nicht async) und legt es SOFORT synchron in den Cache,
// damit mehrere gleichzeitige Aufrufe für dieselbe Gruppe (z.B. Promise.all über
// mehrere Spiele) sich das eine In-Flight-Promise teilen statt parallel dieselben
// Daten mehrfach zu laden
function getGroupMembersForBets(groupId) {
  const cached = groupMembersCache[groupId];
  if (cached && (Date.now() - cached.timestamp) < GROUP_MEMBERS_CACHE_TTL) {
    return cached.promise;
  }

  // localStorage hält nur den AUFGELÖSTEN Wert (kein Promise serialisierbar) -
  // übersteht damit Seitenwechsel, während das In-Memory-Promise-Cache oben
  // nur gleichzeitige Aufrufe innerhalb derselben Seite dedupliziert
  const storageKey = `groupMembers_${groupId}`;
  const persisted = lsRead(storageKey);
  if (persisted && (Date.now() - persisted.timestamp) < GROUP_MEMBERS_CACHE_TTL) {
    const promise = Promise.resolve(persisted.data);
    groupMembersCache[groupId] = { promise, timestamp: persisted.timestamp };
    return promise;
  }

  const promise = (async () => {
    const groupDoc = await collections.groups().doc(groupId).get();
    const groupData = groupDoc.data();
    // Defensiv filtern: leere/ungültige Einträge in member_ids würden
    // Query.where('user_id', 'in', chunk) mit "Unsupported field value:
    // undefined" abstürzen lassen
    const memberIds = (groupData?.member_ids || []).filter(id => typeof id === 'string' && id.length > 0);

    const memberPictures = {};
    await Promise.all(memberIds.map(async (userId) => {
      try {
        const userDoc = await collections.users().doc(userId).get();
        if (userDoc.exists) {
          memberPictures[userId] = userDoc.data().profile_picture || null;
        }
      } catch (e) {
        console.error('Error loading user profile picture:', e);
      }
    }));

    const result = { memberIds, memberPictures };
    lsWrite(storageKey, { data: result, timestamp: Date.now() });
    return result;
  })();

  groupMembersCache[groupId] = { promise, timestamp: Date.now() };
  return promise;
}

// Cache für Gruppen-Wetten pro (Gruppe, Spiel). Bei einem BEENDETEN Spiel
// ändern sich Tipps/Punkte nie wieder - das Ergebnis wird dann dauerhaft
// (für die gesamte Session) gecacht statt bei jedem Seitenaufruf erneut
// abgefragt zu werden. Bei laufenden/geplanten Spielen gilt nur ein kurzes
// TTL, da sich dort noch etwas ändern kann.
const groupBetsCache = {};
const GROUP_BETS_CACHE_TTL = 30000; // 30 Sekunden für nicht-beendete Spiele

// Löscht alle gecachten Gruppen-Wetten (auch die "permanenten" für beendete
// Spiele) für eine Gruppe - nötig wenn sich die Mitgliederliste ändert, da
// sich sonst z.B. ein neu beigetretenes Mitglied mit einem alten Tipp auf ein
// schon beendetes Spiel nie im Cache zeigen würde
function invalidateGroupBetsCache(groupId) {
  const prefix = `${groupId}::`;
  Object.keys(groupBetsCache).forEach(key => {
    if (key.startsWith(prefix)) delete groupBetsCache[key];
  });
  lsRemovePrefix(`groupBets_${prefix}`);
}

// Ohne Obergrenze sammelt sich pro (Gruppe, Spiel)-Kombination, die je
// abgefragt wurde, ein eigener localStorage-Eintrag an, der nur bei
// Mitgliederänderungen der jeweiligen Gruppe gelöscht wird - über viele
// Wochen/Gruppen hinweg wächst das unbegrenzt (in der Praxis auf über 300
// Einträge beobachtet, siehe Obsidian: Caching-System.md). Das kann den
// gesamten localStorage-Speicher des Ursprungs auffüllen und dadurch ANDERE
// Schreibvorgänge (u.a. Firebase Auths eigene Sitzungsdaten) zum Scheitern
// bringen - vermutlicher Mitverursacher des wiederholten Ausloggens in der
// installierten App. Begrenzt die Anzahl der persistierten Einträge auf ein
// Maximum, entfernt bei Überschreitung die ältesten zuerst.
const GROUP_BETS_CACHE_MAX_ENTRIES = 80;

function pruneGroupBetsCacheIfNeeded() {
  try {
    const prefix = LS_PREFIX + 'groupBets_';
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    if (keys.length <= GROUP_BETS_CACHE_MAX_ENTRIES) return;

    const entries = keys.map(k => {
      let timestamp = 0;
      try { timestamp = JSON.parse(localStorage.getItem(k)).timestamp || 0; } catch (e) {}
      return { key: k, timestamp };
    });
    entries.sort((a, b) => a.timestamp - b.timestamp);

    const excess = entries.length - GROUP_BETS_CACHE_MAX_ENTRIES;
    for (let i = 0; i < excess; i++) {
      localStorage.removeItem(entries[i].key);
    }
  } catch (e) {
    // Aufräumen ist nur eine Vorsichtsmaßnahme, darf den eigentlichen Ablauf
    // nie blockieren
  }
}

async function firebaseGetGroupBets(groupId, gameId, isGameFinished = false) {
  // Ohne gültige gameId würde Query.where('game_id', '==', gameId) mit
  // "Unsupported field value: undefined" abstürzen und damit die komplette
  // Gruppen-Abfrage für ALLE Spiele in diesem Promise.all-Batch mitreißen
  if (!groupId || !gameId) {
    console.warn('firebaseGetGroupBets: ungültige groupId/gameId', groupId, gameId);
    return [];
  }

  const cacheKey = `${groupId}::${gameId}`;
  const cached = groupBetsCache[cacheKey];
  if (cached && (cached.permanent || (Date.now() - cached.timestamp) < GROUP_BETS_CACHE_TTL)) {
    return cached.bets;
  }

  // Beendete Spiele werden "permanent" gecacht (ändern sich nie mehr) - genau
  // dieser Fall profitiert am meisten davon, auch Seitenwechsel zu überstehen
  const storageKey = `groupBets_${cacheKey}`;
  const persisted = lsRead(storageKey);
  if (persisted && (persisted.permanent || (Date.now() - persisted.timestamp) < GROUP_BETS_CACHE_TTL)) {
    groupBetsCache[cacheKey] = persisted;
    return persisted.bets;
  }

  const { memberIds, memberPictures } = await getGroupMembersForBets(groupId);
  if (memberIds.length === 0) return [];

  const allBets = [];

  const chunks = [];
  for (let i = 0; i < memberIds.length; i += 10) {
    chunks.push(memberIds.slice(i, i + 10));
  }

  const snapshots = await Promise.all(
    chunks.map(chunk =>
      collections.bets()
        .where('user_id', 'in', chunk)
        .where('game_id', '==', gameId)
        .get()
    )
  );

  snapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      const betData = doc.data();
      const profilePic = memberPictures[betData.user_id] || null;
      allBets.push({
        ...betData,
        profile_picture: profilePic,
        created_at: betData.created_at?.toDate?.()?.toISOString() || betData.created_at
      });
    });
  });

  const entry = { bets: allBets, timestamp: Date.now(), permanent: isGameFinished };
  groupBetsCache[cacheKey] = entry;
  pruneGroupBetsCacheIfNeeded();
  lsWrite(storageKey, entry);

  return allBets;
}

// ==================== ADMIN HELPERS ====================
async function firebaseGetAllUsers() {
  const snapshot = await collections.users().get();
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
  }));
}

async function firebaseDeleteUser(userId) {
  await collections.users().doc(userId).delete();
  
  const betsSnapshot = await collections.bets().where('user_id', '==', userId).get();
  const batch = db.batch();
  betsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
