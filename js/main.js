// Main application logic

Object.assign(TRANSLATIONS.de, {
  nav_games: 'Spiele', nav_groups: 'Gruppen', nav_leaderboard: 'Rangliste',
  nav_admin: 'Admin', nav_profile: 'Profil', nav_settings: 'Einstellungen',
  nav_my_profile: 'Mein Profil', nav_logout: 'Abmelden', nav_menu: 'Menü',
  nav_menu_close: 'Menü schließen', nav_menu_open: 'Menü öffnen',
  status_live: 'LIVE', status_finished: 'BEENDET', status_scheduled: 'GEPLANT',
  error_loading_title: 'Fehler beim Laden', btn_retry: 'Erneut versuchen',
  member: 'Mitglied', members: 'Mitglieder', admin_badge: 'Admin',
  you: 'Du', pts_short: 'Pkt', stat_points: 'Punkte', stat_bets: 'Wetten', stat_correct: 'Richtig',
  btn_save: 'Speichern', btn_cancel: 'Abbrechen', week_n: 'Woche {n}', btn_delete: 'Löschen',
  label_group_name: 'Gruppenname', all_weeks: 'Alle Wochen'
});
Object.assign(TRANSLATIONS.en, {
  nav_games: 'Games', nav_groups: 'Groups', nav_leaderboard: 'Leaderboard',
  nav_admin: 'Admin', nav_profile: 'Profile', nav_settings: 'Settings',
  nav_my_profile: 'My Profile', nav_logout: 'Log out', nav_menu: 'Menu',
  nav_menu_close: 'Close menu', nav_menu_open: 'Open menu',
  status_live: 'LIVE', status_finished: 'FINISHED', status_scheduled: 'SCHEDULED',
  error_loading_title: 'Failed to load', btn_retry: 'Try again',
  member: 'member', members: 'members', admin_badge: 'Admin',
  you: 'You', pts_short: 'pts', stat_points: 'Points', stat_bets: 'Bets', stat_correct: 'Correct',
  btn_save: 'Save', btn_cancel: 'Cancel', week_n: 'Week {n}', btn_delete: 'Delete',
  label_group_name: 'Group name', all_weeks: 'All weeks'
});

// Escaped nutzerkontrollierten Text (Username, Gruppenname, ...) sicher in
// HTML ein - schuetzt vor gespeichertem XSS, da diese Werte frei vom Nutzer
// gesetzt werden koennen und an vielen Stellen ungeprueft angezeigt werden.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Fuer nutzerkontrollierten Text, der als JS-String-Argument in ein inline
// onclick/onerror-Attribut eingebettet wird: HTML-Escaping allein reicht
// dort NICHT (der Browser dekodiert HTML-Entities in Attributwerten, bevor
// der JS-String geparst wird - ein escaptes ' wuerde also trotzdem als '
// im JS landen und den String-Literal aufbrechen). encodeURIComponent
// erzeugt dagegen keine Anfuehrungszeichen/Klammern und ist damit sicher;
// der Handler muss den Wert dann mit decodeURIComponent() zuruecklesen.
function jsAttrSafe(str) {
  return encodeURIComponent(str === null || str === undefined ? '' : String(str));
}

// Locale passend zur aktuell gewählten Sprache, für Date/Time-Formatierung
function getCurrentLocale() {
  return getCurrentLanguage() === 'en' ? 'en-US' : 'de-DE';
}

// Format date for the current language's locale
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(getCurrentLocale(), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format date only
function formatDateOnly(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(getCurrentLocale(), {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

// Format time only
function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString(getCurrentLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get status badge HTML
function getStatusBadge(status) {
  switch (status) {
    case 'live':
      return { text: t('status_live'), class: 'badge-live' };
    case 'finished':
      return { text: t('status_finished'), class: 'badge-error' };
    default:
      return { text: t('status_scheduled'), class: 'badge-success' };
  }
}

// ==================== WETT-SPERRE COUNTDOWN ====================
// Sekunden bis zur Wett-Sperre eines Spiels, oder null wenn außerhalb des
// Countdown-Fensters (Spiel nicht mehr "scheduled", oder die Sperrfrist ist
// noch mehr als BETTING_LOCK_MINUTES_BEFORE_KICKOFF Minuten entfernt bzw.
// schon erreicht/vorbei)
function getSecondsUntilBettingLock(game) {
  if (!game || game.status !== 'scheduled') return null;
  const gameDate = new Date(game.game_date);
  const bettingLockTime = new Date(gameDate.getTime() - BETTING_LOCK_MINUTES_BEFORE_KICKOFF * 60000);
  const secondsLeft = Math.floor((bettingLockTime.getTime() - Date.now()) / 1000);
  if (secondsLeft <= 0 || secondsLeft > BETTING_LOCK_MINUTES_BEFORE_KICKOFF * 60) return null;
  return secondsLeft;
}

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// HTML-Snippet für den Countdown neben dem "GEPLANT"-Badge, leer wenn
// außerhalb des Countdown-Fensters. data-countdown-game merkt sich die
// Spiel-ID, damit startBettingCountdownTicker() den Text jede Sekunde
// aktualisieren kann, ohne Liste/Detail-Ansicht komplett neu zu rendern.
function getBettingCountdownHTML(game) {
  const secondsLeft = getSecondsUntilBettingLock(game);
  if (secondsLeft === null) return '';
  return `<span class="countdown-lock" data-countdown-game="${game.id}">${formatCountdown(secondsLeft)}</span>`;
}

let bettingCountdownInterval = null;

// Aktualisiert alle sichtbaren Countdown-Elemente jede Sekunde direkt im DOM,
// statt die ganze Liste/Detail-Ansicht neu zu rendern (kein Flackern, keine
// neu startenden Animationen). getGameById liefert das aktuelle Spiel-Objekt
// zur ID im data-Attribut; onExpire wird aufgerufen sobald ein Countdown die
// Sperrfrist erreicht, damit das Badge korrekt auf "GESPERRT" wechselt.
function startBettingCountdownTicker(getGameById, onExpire) {
  stopBettingCountdownTicker();
  bettingCountdownInterval = setInterval(() => {
    const elements = document.querySelectorAll('[data-countdown-game]');
    if (elements.length === 0) return;
    let anyExpired = false;
    elements.forEach(el => {
      const game = getGameById(el.dataset.countdownGame);
      const secondsLeft = getSecondsUntilBettingLock(game);
      if (secondsLeft === null) {
        anyExpired = true;
      } else {
        el.textContent = formatCountdown(secondsLeft);
      }
    });
    if (anyExpired) onExpire();
  }, 1000);
}

function stopBettingCountdownTicker() {
  if (bettingCountdownInterval) {
    clearInterval(bettingCountdownInterval);
    bettingCountdownInterval = null;
  }
}

// Toggle user menu
function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) {
    menu.classList.toggle('active');
  }
}

// Toggle mobile menu (Hamburger)
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const hamburger = document.querySelector('.hamburger-icon');
  
  if (menu && overlay) {
    const isActive = menu.classList.contains('active');
    menu.classList.toggle('active');
    overlay.classList.toggle('active');
    
    // Animate hamburger icon
    if (hamburger) {
      hamburger.classList.toggle('active');
    }
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = isActive ? '' : 'hidden';
  }
}

// Close mobile menu
function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const hamburger = document.querySelector('.hamburger-icon');
  
  if (menu) menu.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  if (hamburger) hamburger.classList.remove('active');
  document.body.style.overflow = '';
}

// Close menus when clicking outside
document.addEventListener('click', function(event) {
  const userBtn = document.querySelector('.user-button');
  const userMenu = document.getElementById('user-menu');
  
  if (userBtn && userMenu && !userBtn.contains(event.target) && !userMenu.contains(event.target)) {
    userMenu.classList.remove('active');
  }
});

// Render navbar (for pages)
function renderNavbar() {
  const user = currentUser || JSON.parse(localStorage.getItem('user'));
  if (!user) return '';
  
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
  
  const navItems = [
    { href: 'games.html', id: 'games', label: t('nav_games'), icon: 'fa-calendar' },
    { href: 'groups.html', id: 'groups', label: t('nav_groups'), icon: 'fa-users' },
    { href: 'leaderboard.html', id: 'leaderboard', label: t('nav_leaderboard'), icon: 'fa-trophy' },
  ];

  if (user.is_admin) {
    navItems.push({ href: 'admin.html', id: 'admin', label: t('nav_admin'), icon: 'fa-shield' });
  }

  const navLinksHTML = navItems.map(item => `
    <a href="${item.href}" class="nav-link ${currentPage === item.id ? 'active' : ''}" data-testid="nav-${item.id}">
      <i class="fas ${item.icon}"></i>
      ${item.label}
    </a>
  `).join('');

  // Mobile menu links with larger touch targets
  const mobileLinksHTML = navItems.map(item => `
    <a href="${item.href}" class="mobile-nav-link ${currentPage === item.id ? 'active' : ''}" onclick="closeMobileMenu()">
      <i class="fas ${item.icon}"></i>
      <span>${item.label}</span>
    </a>
  `).join('');

  // Bottom tab bar items (mobile app style) - primary nav + Profil + Einstellungen
  const bottomNavItems = [
    ...navItems,
    { href: 'profile.html', id: 'profile', label: t('nav_profile'), icon: 'fa-user' },
    { href: 'settings.html', id: 'settings', label: t('nav_settings'), icon: 'fa-cog' }
  ];

  const bottomNavHTML = bottomNavItems.map(item => `
    <a href="${item.href}" class="bottom-nav-link ${currentPage === item.id ? 'active' : ''}" data-testid="bottom-nav-${item.id}">
      <i class="fas ${item.icon}"></i>
      <span>${item.label}</span>
    </a>
  `).join('');
  
  // Avatar content - use profile picture if available
  const avatarContent = user.profile_picture 
    ? `<img src="${user.profile_picture}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
    : '<i class="fas fa-user"></i>';
  
  return `
    <nav class="navbar">
      <div class="navbar-container">
        <div class="navbar-content">
          <!-- Logo links -->
          <a href="games.html" class="navbar-logo" data-testid="logo-link">
            NFL<span>POINTS</span>
          </a>
          
          <!-- Desktop Navigation -->
          <div class="navbar-nav desktop-nav">
            ${navLinksHTML}
          </div>
          
          <!-- Mobile: Username in der Mitte (zum Profil) -->
          <a href="profile.html" class="mobile-profile-link" data-testid="mobile-profile-link">
            <div class="mobile-profile-avatar">
              ${avatarContent}
            </div>
            <span class="mobile-profile-name">${escapeHtml(user.username)}</span>
          </a>
          
          <!-- Desktop: User Menu -->
          <div class="navbar-user desktop-user">
            <button class="user-button" onclick="toggleUserMenu()" data-testid="user-menu-button">
              <div class="user-avatar">
                ${avatarContent}
              </div>
              <span>${escapeHtml(user.username)}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            
            <div id="user-menu" class="user-menu">
              <a href="profile.html" class="user-menu-item" data-testid="profile-link">
                <i class="fas fa-user"></i>
                ${t('nav_my_profile')}
              </a>
              <a href="settings.html" class="user-menu-item" data-testid="settings-link">
                <i class="fas fa-cog"></i>
                ${t('nav_settings')}
              </a>
              <button onclick="logout()" class="user-menu-item danger" data-testid="logout-button">
                <i class="fas fa-sign-out-alt"></i>
                ${t('nav_logout')}
              </button>
            </div>
          </div>

          <!-- Mobile: Hamburger Button -->
          <button class="hamburger-btn" onclick="toggleMobileMenu()" data-testid="hamburger-menu-toggle" aria-label="${t('nav_menu_open')}">
            <div class="hamburger-icon">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        </div>
      </div>
    </nav>
    
    <!-- Mobile Menu Overlay -->
    <div id="mobile-menu-overlay" class="mobile-menu-overlay" onclick="closeMobileMenu()"></div>
    
    <!-- Mobile Slide-in Menu -->
    <div id="mobile-menu" class="mobile-slide-menu">
      <div class="mobile-menu-header">
        <span class="mobile-menu-title">${t('nav_menu')}</span>
        <button class="mobile-menu-close" onclick="closeMobileMenu()" aria-label="${t('nav_menu_close')}">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="mobile-menu-nav">
        ${mobileLinksHTML}
      </div>

      <div class="mobile-menu-footer">
        <a href="profile.html" class="mobile-nav-link" onclick="closeMobileMenu()">
          <i class="fas fa-user"></i>
          <span>${t('nav_my_profile')}</span>
        </a>
        <a href="settings.html" class="mobile-nav-link" onclick="closeMobileMenu()">
          <i class="fas fa-cog"></i>
          <span>${t('nav_settings')}</span>
        </a>
        <button onclick="logout(); closeMobileMenu();" class="mobile-nav-link logout-link">
          <i class="fas fa-sign-out-alt"></i>
          <span>${t('nav_logout')}</span>
        </button>
      </div>
    </div>

    <!-- Mobile Bottom Tab Bar (App-Style) -->
    <nav class="bottom-nav" data-testid="bottom-nav">
      ${bottomNavHTML}
    </nav>
  `;
}

// Initialize page
function initPage() {
  // Sprache: einmal beim Laden auf echtes statisches HTML anwenden (Inhalte
  // aus JS-Templates übersetzen sich durch ihre eigenen t()-Aufrufe bei
  // jedem Render selbst, brauchen das hier nicht)
  document.documentElement.lang = getCurrentLanguage();
  applyStaticTranslations();

  // Check auth for protected pages
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    // Insert navbar immediately with cached user
    const navbarContainer = document.getElementById('navbar-container');
    if (navbarContainer) {
      navbarContainer.innerHTML = renderNavbar();
    }
  }
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', initPage);

// PWA: Service Worker registrieren, damit die App installierbar ist und ein
// Offline-Grundgeruest hat. sw.js liegt im Projekt-Root, der relative Pfad
// unterscheidet sich je nachdem ob wir auf index.html oder einer Unterseite
// unter /pages/ sind - der Geltungsbereich (Scope) richtet sich trotzdem
// automatisch nach dem Ordner, in dem sw.js selbst liegt (Projekt-Root),
// deckt also immer die ganze App ab.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = window.location.pathname.includes('/pages/') ? '../sw.js' : 'sw.js';
    navigator.serviceWorker.register(swPath).catch((err) => {
      console.warn('Service Worker Registrierung fehlgeschlagen:', err);
    });
  });
}

