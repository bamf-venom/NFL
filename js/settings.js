// Einstellungen-Seite

Object.assign(TRANSLATIONS.de, {
  settings_title: 'Einstellungen',
  section_app_version: 'App-Version', up_to_date: 'Du bist auf dem neuesten Stand',
  version_label: 'Version {v}', update_available: 'Update verfügbar (Version {v})',
  current_version: 'Du hast aktuell Version {v}', btn_update_now: 'Jetzt aktualisieren',
  update_check_failed: 'Update-Check fehlgeschlagen',
  section_language: 'Sprache',
  section_notifications: 'Benachrichtigungen',
  notifications_description: 'Erhalte eine Erinnerung, wenn ein Spiel in etwa einer Stunde beginnt und du noch nicht getippt hast.',
  notifications_enabled: 'Erinnerungen sind aktiviert',
  notifications_blocked: 'Benachrichtigungen sind blockiert. Ändere das in den Browser-/App-Einstellungen, um Erinnerungen zu erhalten.',
  btn_enable_notifications: 'Erinnerungen aktivieren', btn_disable_notifications: 'Erinnerungen deaktivieren',
  enabling_notifications: 'Wird aktiviert...',
  section_cache: 'Zwischenspeicher',
  cache_description: 'Spiele, Wetten und Gruppen werden lokal zwischengespeichert, damit die App schneller lädt. Falls mal etwas veraltet wirkt, hilft es, den Cache einmal zu leeren.',
  btn_clear_cache: 'Cache leeren', cache_cleared: 'Cache geleert ({n} Einträge)',
  section_legal: 'Rechtliches', legal_privacy: 'Datenschutz', legal_terms: 'Nutzungsbedingungen',
  privacy_text: 'NFL POINTS ist ein privates Tippspiel für einen Freundeskreis, kein kommerzielles Produkt. Gespeichert werden über Firebase (Google): deine E-Mail-Adresse, dein gewählter Benutzername, deine Tipps und Gruppenmitgliedschaften. Diese Daten sind für andere angemeldete Nutzer der App einsehbar (Rangliste, Gruppen-Wetten), aber nicht öffentlich im Internet. Du kannst dein Konto jederzeit selbst über dein Profil löschen - dabei werden auch deine Wetten entfernt.',
  privacy_disclaimer: 'Hinweis: das ist eine ehrliche, aber keine professionell geprüfte Rechtstext-Formulierung.',
  terms_text: 'Die App dient ausschließlich dem Spaß am gemeinsamen Tippen mit Freunden. Es wird kein echtes Geld eingesetzt oder ausgezahlt, Punkte haben keinen monetären Wert. Bitte geh respektvoll mit den Namen/Inhalten um, die du in der App einträgst (Benutzername, Gruppenname) - unangemessene Inhalte können vom Admin entfernt werden.',
  section_about: 'Über die App', about_tagline: 'NFL POINTS - Wette mit Freunden auf NFL-Spiele.',
  about_credit: 'Erstellt von MBP'
});
Object.assign(TRANSLATIONS.en, {
  settings_title: 'Settings',
  section_app_version: 'App version', up_to_date: "You're up to date",
  version_label: 'Version {v}', update_available: 'Update available (version {v})',
  current_version: "You're currently on version {v}", btn_update_now: 'Update now',
  update_check_failed: 'Update check failed',
  section_language: 'Language',
  section_notifications: 'Notifications',
  notifications_description: "Get a reminder when a game starts in about an hour and you haven't placed your bet yet.",
  notifications_enabled: 'Reminders are enabled',
  notifications_blocked: 'Notifications are blocked. Change this in your browser/app settings to receive reminders.',
  btn_enable_notifications: 'Enable reminders', btn_disable_notifications: 'Disable reminders',
  enabling_notifications: 'Enabling...',
  section_cache: 'Cache',
  cache_description: 'Games, bets, and groups are cached locally so the app loads faster. If something looks outdated, clearing the cache can help.',
  btn_clear_cache: 'Clear cache', cache_cleared: 'Cache cleared ({n} entries)',
  section_legal: 'Legal', legal_privacy: 'Privacy', legal_terms: 'Terms of use',
  privacy_text: "NFL POINTS is a private prediction game for a group of friends, not a commercial product. Stored via Firebase (Google): your email address, your chosen username, your bets, and group memberships. This data is visible to other logged-in users of the app (leaderboard, group bets), but not public on the internet. You can delete your account yourself at any time via your profile - this also removes your bets.",
  privacy_disclaimer: "Note: this is an honest description, not a professionally reviewed legal text.",
  terms_text: "The app exists purely for fun, predicting games together with friends. No real money is wagered or paid out, points have no monetary value. Please be respectful with the names/content you enter in the app (username, group name) - inappropriate content may be removed by the admin.",
  section_about: 'About this app', about_tagline: 'NFL POINTS - bet with friends on NFL games.',
  about_credit: 'Made by MBP'
});

function handleLanguageChange(value) {
  setCurrentLanguage(value);
  // Einfachster zuverlässiger Weg, die neue Sprache überall durchschlagen zu
  // lassen: jede Seite baut ihren Inhalt ohnehin aus denselben
  // Render-Funktionen neu auf, ein Reload reicht.
  location.reload();
}

// Ein reines location.reload() reicht nicht zuverlässig aus, um auf die neue
// Version zu wechseln - der alte Service Worker (samt seinem Cache, siehe
// sw.js) kann noch aktiv sein und Dateien aus seinem Cache ausliefern statt
// vom Netzwerk. Leert deshalb explizit alle Caches vor dem Neuladen.
//
// WICHTIG: registration.unregister() wird hier bewusst NICHT mehr aufgerufen
// (war ein eigener Bug) - das Deregistrieren des Service Workers macht auch
// die daran hängende Push-Subscription (Benachrichtigungen, siehe
// firebase-config.js) ungültig, wodurch Nutzer nach jedem Update ihre
// Erinnerungen erneut aktivieren mussten. caches.delete() + reload reicht:
// der neue Service Worker (neuer CACHE_NAME durch APP_VERSION) übernimmt
// beim Neuladen automatisch (self.skipWaiting()/clients.claim() in sw.js),
// ohne die bestehende Push-Subscription zu zerstören.
async function applyAppUpdate() {
  const btn = document.getElementById('apply-update-button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('btn_update_now')}`;
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) await registration.update();
    }
  } catch (error) {
    console.warn('Fehler beim Zurücksetzen von Service Worker/Cache:', error);
  } finally {
    location.reload();
  }
}

// Vergleicht die aktuell geladene APP_VERSION (aus config.js) mit einer
// frisch vom Server geholten Kopie derselben Datei (cache: 'no-store', damit
// hier garantiert nicht der Service-Worker-Cache oder Browser-Cache
// zwischengeht). Läuft die App schon lange offen ohne Neuladen, zeigt das
// zuverlässig an, ob es inzwischen eine neuere Version gibt.
async function checkForAppUpdate() {
  const statusEl = document.getElementById('version-status');
  if (!statusEl) return;

  try {
    const res = await fetch('../js/config.js', { cache: 'no-store' });
    const text = await res.text();
    const match = text.match(/APP_VERSION\s*=\s*'([^']+)'/);
    const remoteVersion = match ? match[1] : null;

    if (!remoteVersion) {
      statusEl.innerHTML = `<span style="color: var(--muted);">${t('version_label', { v: escapeHtml(APP_VERSION) })}</span>`;
      return;
    }

    if (remoteVersion === APP_VERSION) {
      statusEl.innerHTML = `
        <span style="color: var(--success);"><i class="fas fa-check-circle"></i> ${t('up_to_date')}</span>
        <span style="color: var(--muted); font-size: 13px; display: block; margin-top: 4px;">${t('version_label', { v: escapeHtml(APP_VERSION) })}</span>
      `;
    } else {
      statusEl.innerHTML = `
        <span style="color: var(--warning);"><i class="fas fa-arrow-circle-up"></i> ${t('update_available', { v: escapeHtml(remoteVersion) })}</span>
        <span style="color: var(--muted); font-size: 13px; display: block; margin: 4px 0 12px;">${t('current_version', { v: escapeHtml(APP_VERSION) })}</span>
        <button class="btn btn-primary" id="apply-update-button" onclick="applyAppUpdate()" data-testid="apply-update-button">
          <i class="fas fa-rotate"></i> ${t('btn_update_now')}
        </button>
      `;
    }
  } catch (error) {
    console.error('Error checking for update:', error);
    statusEl.innerHTML = `<span style="color: var(--muted);">${t('version_label', { v: escapeHtml(APP_VERSION) })} - ${t('update_check_failed')}</span>`;
  }
}

// Leert nur den Firestore-Datencache (siehe firebase-config.js, Präfix
// LS_PREFIX = 'nflp_cache_') - NICHT die Filter-Einstellungen oder die
// Sprachwahl, die sind keine "Daten" im veraltbaren Sinne
function clearAppCache() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('nflp_cache_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  const btn = document.getElementById('clear-cache-button');
  if (btn) {
    const original = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check"></i> ${t('cache_cleared', { n: keysToRemove.length })}`;
    setTimeout(() => { btn.innerHTML = original; }, 2500);
  }
}

// Zeigt Aktivieren/Deaktivieren-Button je nach aktuellem Push-Subscription-
// Status dieses Geräts, bzw. einen Hinweis wenn Push nicht unterstützt oder
// vom Nutzer/Browser blockiert ist (dann lässt sich der Dialog nicht erneut
// öffnen, nur über die Browser-/App-Einstellungen selbst zurücksetzen)
async function renderNotificationStatus() {
  const el = document.getElementById('notification-status');
  if (!el) return;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    el.innerHTML = `<span style="color: var(--muted);">${t('error_push_not_supported')}</span>`;
    return;
  }

  if (Notification.permission === 'denied') {
    el.innerHTML = `<span style="color: var(--error);"><i class="fas fa-bell-slash"></i> ${t('notifications_blocked')}</span>`;
    return;
  }

  const isSubscribed = await firebaseGetPushSubscriptionStatus();
  if (isSubscribed) {
    el.innerHTML = `
      <span style="color: var(--success); display: block; margin-bottom: 12px;"><i class="fas fa-bell"></i> ${t('notifications_enabled')}</span>
      <button class="btn btn-secondary" id="notification-toggle-button" onclick="handleDisableNotifications()" data-testid="disable-notifications-button">
        <i class="fas fa-bell-slash"></i> ${t('btn_disable_notifications')}
      </button>
    `;
  } else {
    el.innerHTML = `
      <button class="btn btn-primary" id="notification-toggle-button" onclick="handleEnableNotifications()" data-testid="enable-notifications-button">
        <i class="fas fa-bell"></i> ${t('btn_enable_notifications')}
      </button>
    `;
  }
}

async function handleEnableNotifications() {
  const btn = document.getElementById('notification-toggle-button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('enabling_notifications')}`;
  }
  try {
    await firebaseSubscribeToPush();
  } catch (error) {
    console.error('Error enabling notifications:', error);
    alert(error.message || t('error_push_not_supported'));
  }
  await renderNotificationStatus();
}

async function handleDisableNotifications() {
  const btn = document.getElementById('notification-toggle-button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
  }
  try {
    await firebaseUnsubscribeFromPush();
  } catch (error) {
    console.error('Error disabling notifications:', error);
  }
  await renderNotificationStatus();
}

function renderSettings() {
  const container = document.getElementById('settings-container');
  // App-Version-Check und Benachrichtigungen ergeben nur in der installierten
  // App Sinn (Android-TWA/APK oder "Zum Startbildschirm hinzugefügt") - auf
  // der normalen Webseite werden beide Karten komplett ausgeblendet
  const isApp = isInstalledApp();

  container.innerHTML = `
    ${isApp ? `
    <div class="card animate-fade-in" style="margin-bottom: 16px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-mobile-screen-button"></i> ${t('section_app_version')}
      </h3>
      <div id="version-status" style="color: var(--muted);">
        <div class="spinner" style="width: 20px; height: 20px;"></div>
      </div>
    </div>
    ` : ''}

    <div class="card animate-fade-in" style="margin-bottom: 16px; animation-delay: 0.05s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-language"></i> ${t('section_language')}
      </h3>
      <select class="form-input" id="language-select" data-testid="language-select" onchange="handleLanguageChange(this.value)">
        <option value="de">German</option>
        <option value="en">English</option>
      </select>
    </div>

    ${isApp ? `
    <div class="card animate-fade-in" style="margin-bottom: 16px; animation-delay: 0.08s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-bell"></i> ${t('section_notifications')}
      </h3>
      <p style="color: var(--muted); font-size: 14px; margin-bottom: 12px;">
        ${t('notifications_description')}
      </p>
      <div id="notification-status" style="color: var(--muted);">
        <div class="spinner" style="width: 20px; height: 20px;"></div>
      </div>
    </div>
    ` : ''}

    <div class="card animate-fade-in" style="margin-bottom: 16px; animation-delay: 0.1s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-broom"></i> ${t('section_cache')}
      </h3>
      <p style="color: var(--muted); font-size: 14px; margin-bottom: 12px;">
        ${t('cache_description')}
      </p>
      <button class="btn btn-secondary" id="clear-cache-button" onclick="clearAppCache()" data-testid="clear-cache-button">
        <i class="fas fa-broom"></i> ${t('btn_clear_cache')}
      </button>
    </div>

    <div class="card animate-fade-in" style="margin-bottom: 16px; animation-delay: 0.15s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-scale-balanced"></i> ${t('section_legal')}
      </h3>
      <details style="margin-bottom: 12px;">
        <summary style="cursor: pointer; font-weight: 500; padding: 4px 0;">${t('legal_privacy')}</summary>
        <div style="color: var(--muted); font-size: 14px; margin-top: 8px; line-height: 1.6;">
          <p>${t('privacy_text')}</p>
          <p style="margin-top: 8px;"><em>${t('privacy_disclaimer')}</em></p>
        </div>
      </details>
      <details>
        <summary style="cursor: pointer; font-weight: 500; padding: 4px 0;">${t('legal_terms')}</summary>
        <div style="color: var(--muted); font-size: 14px; margin-top: 8px; line-height: 1.6;">
          <p>${t('terms_text')}</p>
        </div>
      </details>
    </div>

    <div class="card animate-fade-in" style="animation-delay: 0.2s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-circle-info"></i> ${t('section_about')}
      </h3>
      <p style="color: var(--muted); font-size: 14px;">
        ${t('about_tagline')}<br>
        ${t('about_credit')} - <a href="https://mbpvfx.com" target="_blank" rel="noopener" style="color: var(--accent);">mbpvfx.com</a>
      </p>
    </div>
  `;

  const langSelect = document.getElementById('language-select');
  if (langSelect) {
    langSelect.value = getCurrentLanguage();
  }

  if (isApp) {
    checkForAppUpdate();
    renderNotificationStatus();
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  if (typeof initializeFirebase === 'function') {
    initializeFirebase();
  }

  const isAuthed = await checkAuth();
  if (isAuthed) {
    renderSettings();
  }
});
