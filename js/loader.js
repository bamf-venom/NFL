// ==================== Seiten-Ladeanimation ====================
// Steuert #nfl-loader (Markup direkt im <body> jeder Seite, siehe loader.css
// fuer den Default-sichtbar-Zustand). Zeigt einen Football-Intro-Bumper
// waehrend Seiten wechseln oder Daten laden, und passt die sichtbare Dauer
// an die tatsaechliche Ladezeit an: kurze Ladevorgaenge -> kurz sichtbar,
// laengere -> bleibt bis die Seite ihre Daten hat.

(function () {
  var MIN_VISIBLE_MS = 450; // verhindert Flackern bei sehr schnellem Laden
  var SAFETY_TIMEOUT_MS = 8000; // Notbremse, falls eine Seite hide() nie aufruft

  var shownAt = (window.performance && performance.now) ? performance.now() : Date.now();
  var isHidden = false;
  var safetyTimer = null;

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function getEl() {
    return document.getElementById('nfl-loader');
  }

  function show() {
    var el = getEl();
    if (!el) return;
    clearTimeout(safetyTimer);
    isHidden = false;
    shownAt = now();
    el.classList.remove('nfl-loader-hidden');
    safetyTimer = setTimeout(hide, SAFETY_TIMEOUT_MS);
  }

  function hide() {
    var el = getEl();
    if (!el || isHidden) return;
    clearTimeout(safetyTimer);
    var elapsed = now() - shownAt;
    var wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    setTimeout(function () {
      isHidden = true;
      el.classList.add('nfl-loader-hidden');
    }, wait);
  }

  window.NFLLoader = { show: show, hide: hide };

  // Sicherheitsnetz: Seiten ohne eigenen hide()-Aufruf (z.B. die
  // Startseite) blenden spaetestens beim vollstaendigen Laden aller
  // Ressourcen aus.
  window.addEventListener('load', function () {
    setTimeout(hide, 0);
  });

  // Notbremse von Anfang an aktiv, unabhaengig davon ob show() je manuell
  // aufgerufen wird (der Loader startet ja bereits sichtbar per CSS).
  safetyTimer = setTimeout(hide, SAFETY_TIMEOUT_MS);

  // Beim Verlassen der Seite (Klick auf einen Link, Redirect, etc.) sofort
  // wieder einblenden, damit kein kurzer weisser/leerer Frame zwischen den
  // Seiten sichtbar wird.
  window.addEventListener('pagehide', show);
})();
