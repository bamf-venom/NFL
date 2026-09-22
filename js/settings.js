// Einstellungen-Seite

const LANGUAGE_STORAGE_KEY = 'nflpoints_language';

function getStoredLanguage() {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'de';
}

function setStoredLanguage(lang) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
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
      statusEl.innerHTML = `<span style="color: var(--muted);">Version ${escapeHtml(APP_VERSION)}</span>`;
      return;
    }

    if (remoteVersion === APP_VERSION) {
      statusEl.innerHTML = `
        <span style="color: var(--success);"><i class="fas fa-check-circle"></i> Du bist auf dem neuesten Stand</span>
        <span style="color: var(--muted); font-size: 13px; display: block; margin-top: 4px;">Version ${escapeHtml(APP_VERSION)}</span>
      `;
    } else {
      statusEl.innerHTML = `
        <span style="color: var(--warning);"><i class="fas fa-arrow-circle-up"></i> Update verfügbar (Version ${escapeHtml(remoteVersion)})</span>
        <span style="color: var(--muted); font-size: 13px; display: block; margin: 4px 0 12px;">Du hast aktuell Version ${escapeHtml(APP_VERSION)}</span>
        <button class="btn btn-primary" onclick="location.reload()" data-testid="apply-update-button">
          <i class="fas fa-rotate"></i> Jetzt aktualisieren
        </button>
      `;
    }
  } catch (error) {
    console.error('Error checking for update:', error);
    statusEl.innerHTML = `<span style="color: var(--muted);">Version ${escapeHtml(APP_VERSION)} - Update-Check fehlgeschlagen</span>`;
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
    btn.innerHTML = `<i class="fas fa-check"></i> Cache geleert (${keysToRemove.length} Einträge)`;
    setTimeout(() => { btn.innerHTML = original; }, 2500);
  }
}

function handleLanguageChange(value) {
  setStoredLanguage(value);
  const noteEl = document.getElementById('language-note');
  if (noteEl) {
    noteEl.classList.remove('hidden');
  }
}

function renderSettings() {
  const container = document.getElementById('settings-container');

  container.innerHTML = `
    <div class="card animate-fade-in" style="margin-bottom: 16px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-mobile-screen-button"></i> App-Version
      </h3>
      <div id="version-status" style="color: var(--muted);">
        <div class="spinner" style="width: 20px; height: 20px;"></div>
      </div>
    </div>

    <div class="card animate-fade-in" style="margin-bottom: 16px; animation-delay: 0.05s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-language"></i> Sprache
      </h3>
      <select class="form-input" id="language-select" data-testid="language-select" onchange="handleLanguageChange(this.value)">
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>
      <p id="language-note" class="hidden" style="color: var(--muted); font-size: 13px; margin-top: 8px;">
        Wird gespeichert. Die Übersetzung der App-Inhalte folgt in einem späteren Update.
      </p>
    </div>

    <div class="card animate-fade-in" style="margin-bottom: 16px; animation-delay: 0.1s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-broom"></i> Zwischenspeicher
      </h3>
      <p style="color: var(--muted); font-size: 14px; margin-bottom: 12px;">
        Spiele, Wetten und Gruppen werden lokal zwischengespeichert, damit die App schneller lädt. Falls mal etwas veraltet wirkt, hilft es, den Cache einmal zu leeren.
      </p>
      <button class="btn btn-secondary" id="clear-cache-button" onclick="clearAppCache()" data-testid="clear-cache-button">
        <i class="fas fa-broom"></i> Cache leeren
      </button>
    </div>

    <div class="card animate-fade-in" style="margin-bottom: 16px; animation-delay: 0.15s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-scale-balanced"></i> Rechtliches
      </h3>
      <details style="margin-bottom: 12px;">
        <summary style="cursor: pointer; font-weight: 500; padding: 4px 0;">Datenschutz</summary>
        <div style="color: var(--muted); font-size: 14px; margin-top: 8px; line-height: 1.6;">
          <p>NFL POINTS ist ein privates Tippspiel für einen Freundeskreis, kein kommerzielles Produkt. Gespeichert werden über Firebase (Google): deine E-Mail-Adresse, dein gewählter Benutzername, deine Tipps und Gruppenmitgliedschaften. Diese Daten sind für andere angemeldete Nutzer der App einsehbar (Rangliste, Gruppen-Wetten), aber nicht öffentlich im Internet. Du kannst dein Konto jederzeit selbst über dein Profil löschen - dabei werden auch deine Wetten entfernt.</p>
          <p style="margin-top: 8px;"><em>Hinweis: das ist eine ehrliche, aber keine professionell geprüfte Rechtstext-Formulierung.</em></p>
        </div>
      </details>
      <details>
        <summary style="cursor: pointer; font-weight: 500; padding: 4px 0;">Nutzungsbedingungen</summary>
        <div style="color: var(--muted); font-size: 14px; margin-top: 8px; line-height: 1.6;">
          <p>Die App dient ausschließlich dem Spaß am gemeinsamen Tippen mit Freunden. Es wird kein echtes Geld eingesetzt oder ausgezahlt, Punkte haben keinen monetären Wert. Bitte geh respektvoll mit den Namen/Inhalten um, die du in der App einträgst (Benutzername, Gruppenname) - unangemessene Inhalte können vom Admin entfernt werden.</p>
        </div>
      </details>
    </div>

    <div class="card animate-fade-in" style="animation-delay: 0.2s;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-circle-info"></i> Über die App
      </h3>
      <p style="color: var(--muted); font-size: 14px;">
        NFL POINTS - Wette mit Freunden auf NFL-Spiele.<br>
        <a href="https://github.com/bamf-venom/NFL" target="_blank" rel="noopener" style="color: var(--accent);">Quellcode auf GitHub</a>
      </p>
    </div>
  `;

  const langSelect = document.getElementById('language-select');
  if (langSelect) {
    langSelect.value = getStoredLanguage();
  }

  checkForAppUpdate();
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
