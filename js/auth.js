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
    
    const checkAuth = setInterval(() => {
      if (typeof auth !== 'undefined' && auth) {
        clearInterval(checkAuth);
        auth.onAuthStateChanged(async (user) => {
          if (user) {
            try {
              currentUser = await firebaseGetCurrentUser();
              localStorage.setItem('user', JSON.stringify(currentUser));
            } catch (error) {
              console.error('Error getting user data:', error);
              currentUser = null;
              localStorage.removeItem('user');
            }
          } else {
            currentUser = null;
            localStorage.removeItem('user');
          }
          authInitialized = true;
          resolve(currentUser);
        });
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkAuth);
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
  
  if (currentUser) {
    // If on landing page, redirect to games
    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
      window.location.href = 'pages/games.html';
    }
    return true;
  } else {
    // If on protected page, redirect to landing
    const publicPages = ['/', '/index.html', ''];
    const currentPath = window.location.pathname;
    const isPublic = publicPages.some(p => currentPath.endsWith(p) || currentPath === p);
    
    if (!isPublic && !currentPath.includes('index.html')) {
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
    modalTitle.textContent = 'Registrieren';
    usernameField.classList.remove('hidden');
    document.getElementById('username-input').required = true;
    submitText.textContent = 'Registrieren';
    switchText.textContent = 'Bereits registriert?';
    switchBtn.textContent = 'Anmelden';
    switchBtn.setAttribute('data-testid', 'switch-to-login');
  } else {
    modalTitle.textContent = 'Anmelden';
    usernameField.classList.add('hidden');
    document.getElementById('username-input').required = false;
    submitText.textContent = 'Anmelden';
    switchText.textContent = 'Noch kein Konto?';
    switchBtn.textContent = 'Registrieren';
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
        throw new Error('Benutzername muss mindestens 2 Zeichen haben');
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
      errorMessage = 'Ein Benutzer mit dieser E-Mail existiert bereits';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Ungültige E-Mail-Adresse';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Das Passwort muss mindestens 6 Zeichen haben';
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      errorMessage = 'Ungültige E-Mail oder Passwort';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Zu viele Anmeldeversuche. Bitte versuche es später erneut.';
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
