Object.assign(TRANSLATIONS.de, {
  hero_subtitle: 'Wette mit Freunden auf NFL Spiele',
  btn_register: 'Registrieren', btn_login: 'Anmelden',
  label_username: 'Benutzername', label_email: 'E-Mail', label_password: 'Passwort',
  placeholder_username: 'Dein Benutzername', placeholder_email: 'deine@email.de',
  modal_title_register: 'Registrieren', modal_title_login: 'Anmelden',
  switch_have_account: 'Bereits registriert?', switch_no_account: 'Noch kein Konto?',
  error_username_too_short: 'Benutzername muss mindestens 2 Zeichen haben',
  error_email_in_use: 'Ein Benutzer mit dieser E-Mail existiert bereits',
  error_invalid_email: 'Ungültige E-Mail-Adresse',
  error_weak_password: 'Das Passwort muss mindestens 6 Zeichen haben',
  error_invalid_credentials: 'Ungültige E-Mail oder Passwort',
  error_too_many_requests: 'Zu viele Anmeldeversuche. Bitte versuche es später erneut.'
});
Object.assign(TRANSLATIONS.en, {
  hero_subtitle: 'Bet with friends on NFL games',
  btn_register: 'Register', btn_login: 'Log in',
  label_username: 'Username', label_email: 'Email', label_password: 'Password',
  placeholder_username: 'Your username', placeholder_email: 'your@email.com',
  modal_title_register: 'Register', modal_title_login: 'Log in',
  switch_have_account: 'Already have an account?', switch_no_account: "Don't have an account yet?",
  error_username_too_short: 'Username must be at least 2 characters',
  error_email_in_use: 'A user with this email already exists',
  error_invalid_email: 'Invalid email address',
  error_weak_password: 'Password must be at least 6 characters',
  error_invalid_credentials: 'Invalid email or password',
  error_too_many_requests: 'Too many login attempts. Please try again later.'
});

// ==================== AUTH STATE ====================
let currentUser = null;
let authInitialized = false;

// Wait for Firebase auth to be ready
function waitForAuth() {
  return new Promise((resolve) => {
    if (authInitialized) {
      resolve(currentUser);
      return;
    }
    
    const authPollInterval = setInterval(() => {
      if (typeof auth !== 'undefined' && auth) {
        clearInterval(authPollInterval);
        // Erst wenn setPersistence(LOCAL) (siehe initializeFirebase() in
        // firebase-config.js) wirklich fertig ist, den Auth-Status abfragen -
        // sonst kann dieser allererste Check noch mit der SDK-Standard-
        // persistenz statt LOCAL laufen (Race Condition, vermutlich Ursache
        // für wiederholtes Ausloggen in der installierten Android-App).
        Promise.resolve(typeof authPersistenceReady !== 'undefined' ? authPersistenceReady : null).finally(() => {
          auth.onAuthStateChanged(async (user) => {
            if (user) {
              try {
                // WICHTIG (2026-09-23): Firebase kann `user` hier schon als
                // eingeloggt melden, bevor der interne Zugriffstoken für
                // Firestore-Anfragen vollständig bereit ist - besonders kurz
                // nach einer Sitzungs-Wiederherstellung (nicht bei einem
                // frischen, interaktiven Login). Ein sofortiger Firestore-Read
                // (firebaseGetCurrentUser() unten) kann dadurch mit einem
                // Berechtigungsfehler fehlschlagen, obwohl die Sitzung
                // eigentlich gültig ist - auf einem frischen Gerät ohne
                // lokalen Fallback (siehe catch unten) führte das zu einem
                // fälschlichen Logout. getIdToken() erzwingt, dass der Token
                // wirklich bereit ist, bevor der Firestore-Zugriff versucht wird.
                await user.getIdToken();
                currentUser = await firebaseGetCurrentUser();
                localStorage.setItem('user', JSON.stringify(currentUser));
              } catch (error) {
                // Firebase Auth selbst sagt "eingeloggt" (user != null) - ein
                // Fehler hier ist ein Firestore-Problem (z.B. Netzwerk, oder wie
                // beim Kontingent-Vorfall vom 21.09. ein RESOURCE_EXHAUSTED),
                // keine echte Abmeldung. Vorher wurde das faelschlich als Logout
                // behandelt - jeder Firestore-Hakler hat den Nutzer rausgeworfen,
                // obwohl die Session noch gueltig war. Bereits gespeicherte
                // Nutzerdaten bleiben deshalb jetzt einfach stehen.
                console.error('Error getting user data (Session bleibt trotzdem bestehen):', error);
                const storedUser = localStorage.getItem('user');
                currentUser = storedUser ? JSON.parse(storedUser) : null;
              }
            } else {
              currentUser = null;
              localStorage.removeItem('user');
            }
            authInitialized = true;
            resolve(currentUser);
          });
        });
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(authPollInterval);
      authInitialized = true;
      resolve(null);
    }, 5000);
  });
}

// Check if user is logged in on page load
async function checkAuth() {
  // First try localStorage for immediate UI
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
  }
  
  // Wait for Firebase auth
  await waitForAuth();

  // WICHTIG (2026-09-23): war vorher `currentPath === '/' ||
  // currentPath.endsWith('index.html')` - funktionierte lokal (Pfad `/`),
  // aber NICHT auf der echten Seite unter github.io/NFL/, wo der Pfad
  // `/NFL/` ist (kein "index.html" in der URL, da implizites Standard-
  // dokument). isLandingPage wurde dadurch faelschlich `false`, was einen
  // nicht angemeldeten Besucher der Startseite in eine Umleitungsschleife
  // schickte (zurueck zu '../index.html', das wiederum zurueck zu /NFL/
  // umleitet - siehe die Root-Redirect-Seite unter bamf-venom.github.io/).
  // Jede Unterseite liegt unter /pages/ (siehe initPage() in main.js fuer
  // dasselbe Muster) - alles ANDERE ist die Landing Page, unabhaengig vom
  // Hosting-Pfad-Praefix.
  const currentPath = window.location.pathname;
  const isLandingPage = !currentPath.includes('/pages/');

  if (currentUser) {
    // If on landing page, redirect to games
    if (isLandingPage) {
      window.location.href = 'pages/games.html';
    }
    return true;
  } else {
    // If on protected page, redirect to landing
    if (!isLandingPage) {
      window.location.href = '../index.html';
      return false;
    }
  }
  return false;
}

// Open auth modal
function openModal(mode) {
  authMode = mode;
  const modal = document.getElementById('auth-modal');
  const modalTitle = document.getElementById('modal-title');
  const usernameField = document.getElementById('username-field');
  const submitText = document.getElementById('submit-text');
  const switchText = document.getElementById('switch-text');
  const switchBtn = document.getElementById('switch-btn');
  
  if (mode === 'register') {
    modalTitle.textContent = t('modal_title_register');
    usernameField.classList.remove('hidden');
    document.getElementById('username-input').required = true;
    submitText.textContent = t('btn_register');
    switchText.textContent = t('switch_have_account');
    switchBtn.textContent = t('btn_login');
    switchBtn.setAttribute('data-testid', 'switch-to-login');
  } else {
    modalTitle.textContent = t('modal_title_login');
    usernameField.classList.add('hidden');
    document.getElementById('username-input').required = false;
    submitText.textContent = t('btn_login');
    switchText.textContent = t('switch_no_account');
    switchBtn.textContent = t('btn_register');
    switchBtn.setAttribute('data-testid', 'switch-to-register');
  }
  
  // Clear form and errors
  document.getElementById('auth-form').reset();
  hideError();
  
  modal.classList.add('active');
}

let authMode = 'login';

// Close auth modal
function closeModal() {
  document.getElementById('auth-modal').classList.remove('active');
}

// Switch between login and register
function switchAuthMode() {
  openModal(authMode === 'login' ? 'register' : 'login');
}

// Show error message
function showError(message) {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

// Hide error message
function hideError() {
  document.getElementById('auth-error').classList.add('hidden');
}

// Handle auth form submit
async function handleAuth(event) {
  event.preventDefault();
  hideError();
  
  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;
  const username = document.getElementById('username-input')?.value;
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const submitText = document.getElementById('submit-text');
  const submitSpinner = document.getElementById('submit-spinner');
  
  // Show loading state
  submitBtn.disabled = true;
  submitText.classList.add('hidden');
  submitSpinner.classList.remove('hidden');
  
  try {
    // Firebase Authentication
    if (authMode === 'register') {
      if (!username || username.trim().length < 2) {
        throw new Error(t('error_username_too_short'));
      }
      
      currentUser = await firebaseRegister(email, password, username.trim());
    } else {
      currentUser = await firebaseLogin(email, password);
    }
    
    // Save to localStorage for offline support
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    // Redirect to games
    window.location.href = 'pages/games.html';
    
  } catch (error) {
    console.error('Auth error:', error);
    
    // Translate Firebase error messages to German
    let errorMessage = error.message;
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = t('error_email_in_use');
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = t('error_invalid_email');
    } else if (error.code === 'auth/weak-password') {
      errorMessage = t('error_weak_password');
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      errorMessage = t('error_invalid_credentials');
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = t('error_too_many_requests');
    }
    
    showError(errorMessage);
  } finally {
    submitBtn.disabled = false;
    submitText.classList.remove('hidden');
    submitSpinner.classList.add('hidden');
  }
}

// Logout
async function logout() {
  try {
    await firebaseLogout();
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  currentUser = null;
  
  // Check if we're in a subdirectory
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    window.location.href = '../index.html';
  } else {
    window.location.href = 'index.html';
  }
}

// Generate unique ID (fallback)
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
