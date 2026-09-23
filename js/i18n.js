// ==================== ÜBERSETZUNG (i18n) ====================
// Kein zentrales Wörterbuch-File - jede Seiten-Datei ergänzt ihre eigenen
// Keys hier hinein per Object.assign(TRANSLATIONS.de, {...}) direkt oben in
// der jeweiligen Datei. Das hält Übersetzungen bei ihrer Verwendung, ohne
// dass jede neue Seite dieselbe zentrale Datei anfassen müsste.
const TRANSLATIONS = { de: {}, en: {} };

const LANGUAGE_STORAGE_KEY = 'nflpoints_language';

// Nur unterstützte Sprachen: Deutsch/Englisch. Browser-Sprachen, die keins
// von beidem sind, fallen auf Deutsch zurück (Hauptzielgruppe der App).
function detectBrowserLanguage() {
  const langs = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || ''];
  for (const lang of langs) {
    const code = (lang || '').toLowerCase();
    if (code.startsWith('en')) return 'en';
    if (code.startsWith('de')) return 'de';
  }
  return 'de';
}

// Solange der Nutzer die Sprache noch nie manuell umgestellt hat (kein Eintrag
// in localStorage), startet die App in der Systemsprache des Geräts/Browsers.
// Sobald einmal manuell umgestellt (setCurrentLanguage), bleibt diese Wahl
// dauerhaft gespeichert und hat Vorrang vor der Systemsprache.
function getCurrentLanguage() {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored || detectBrowserLanguage();
}

function setCurrentLanguage(lang) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

// Fällt auf den deutschen Text zurück, wenn ein Key in der aktuellen Sprache
// fehlt, und auf den Key selbst wenn er nirgendwo existiert (fällt beim
// Testen auf - besser als ein leerer/kaputter Text im UI). params ersetzt
// {platzhalter} im Text, z.B. t('week_n', {n: 3}) -> "Woche 3"
function t(key, params) {
  const lang = getCurrentLanguage();
  let text = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.de[key] || key;
  if (params) {
    Object.keys(params).forEach(p => {
      text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
  }
  return text;
}

// Für echtes statisches HTML (nicht aus JS-Templates gerendert) - Elemente
// mit data-i18n/data-i18n-placeholder werden einmal beim Laden ersetzt
function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
