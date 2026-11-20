// Saison-Statistik: zeigt die PDF "NFL Saison 2025 Statistik" als Seitenansicht in der App.
// Eingebettete PDFs funktionieren auf Handys nicht zuverlässig (Android lädt sie nur herunter,
// iOS zeigt nur die erste Seite), deshalb werden die Seiten hier mit PDF.js (js/vendor/pdfjs,
// Apache-Lizenz) selbst gezeichnet - nur die gerade sichtbaren Seiten, der Rest wird erst beim
// Scrollen geladen und weit entfernte Seiten werden wieder freigegeben (spart Speicher).
// Die Team-Links der PDF (Ranking-Seite) funktionieren als Sprung zur Team-Seite.
// Navigation: auf dem Handy eine Sprungleiste mit Chips oben, auf dem Computer eine Leiste am
// Seitenrand (alle Teams untereinander, wie eine Art Scrollbar: anklicken oder mit gedrückter
// Maustaste daran entlangfahren, die PDF folgt direkt).
import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

Object.assign(TRANSLATIONS.de, {
  stats_title: 'Saison 2025/26',
  stats_subtitle: 'Statistik der letzten Saison: wie die Teams gespielt haben',
  stats_open_pdf: 'PDF öffnen',
  stats_ranking: 'Ranking', stats_overview: 'Überblick', stats_leaders: 'Liga-Leader',
  stats_page_of: 'Seite {n} von {total}',
  stats_rail_label: 'Teams',
  stats_error: 'Die Statistik konnte nicht angezeigt werden.',
  back_to_profile: 'Zurück zum Profil',
  back_to_settings: 'Zurück zu den Einstellungen'
});
Object.assign(TRANSLATIONS.en, {
  stats_title: 'Season 2025/26',
  stats_subtitle: 'Last season\'s statistics: how the teams played',
  stats_open_pdf: 'Open PDF',
  stats_ranking: 'Ranking', stats_overview: 'Overview', stats_leaders: 'League leaders',
  stats_page_of: 'Page {n} of {total}',
  stats_rail_label: 'Teams',
  stats_error: 'The statistics could not be displayed.',
  back_to_profile: 'Back to profile',
  back_to_settings: 'Back to settings'
});

const STATS_PDF_URL = new URL('../data/stats/NFL_Saison_2025_Statistik.pdf', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

// Reihenfolge wie im Team-Ranking der PDF (Seite 1). Die Seite eines Teams ist
// FIRST_TEAM_PAGE + 2 * (Rang - 1), direkt danach folgt seine Seite mit den Spieler-Statistiken.
// Kürzel wie im Rest der App (Rams = LAR), nicht wie in der PDF (LA).
const STATS_TEAMS = [
  ['SEA', 'Seattle Seahawks'], ['NE', 'New England Patriots'], ['DEN', 'Denver Broncos'],
  ['JAX', 'Jacksonville Jaguars'], ['LAR', 'Los Angeles Rams'], ['BUF', 'Buffalo Bills'],
  ['HOU', 'Houston Texans'], ['SF', 'San Francisco 49ers'], ['PHI', 'Philadelphia Eagles'],
  ['LAC', 'Los Angeles Chargers'], ['CHI', 'Chicago Bears'], ['PIT', 'Pittsburgh Steelers'],
  ['GB', 'Green Bay Packers'], ['DET', 'Detroit Lions'], ['MIN', 'Minnesota Vikings'],
  ['IND', 'Indianapolis Colts'], ['BAL', 'Baltimore Ravens'], ['TB', 'Tampa Bay Buccaneers'],
  ['ATL', 'Atlanta Falcons'], ['CAR', 'Carolina Panthers'], ['DAL', 'Dallas Cowboys'],
  ['MIA', 'Miami Dolphins'], ['KC', 'Kansas City Chiefs'], ['NO', 'New Orleans Saints'],
  ['CIN', 'Cincinnati Bengals'], ['WAS', 'Washington Commanders'], ['CLE', 'Cleveland Browns'],
  ['NYG', 'New York Giants'], ['ARI', 'Arizona Cardinals'], ['LV', 'Las Vegas Raiders'],
  ['TEN', 'Tennessee Titans'], ['NYJ', 'New York Jets']
];
const FIRST_TEAM_PAGE = 4;

// Einträge der Sprungleiste (Handy) und der Seitenleiste (Computer): drei Übersichtsseiten und alle
// Teams. from/to = Seiten, die zum Eintrag gehören (Team: Teamseite + Spieler-Statistik).
function getJumpEntries() {
  return [
    { label: t('stats_ranking'), from: 1, to: 1 },
    { label: t('stats_overview'), from: 2, to: 2 },
    { label: t('stats_leaders'), from: 3, to: 3 },
    ...STATS_TEAMS.map(([abbr, name], index) => {
      const page = FIRST_TEAM_PAGE + index * 2;
      return { abbr, name, from: page, to: page + 1 };
    })
  ];
}

let pdfDoc = null;
let pageWidthPt = 595.28;
let pageHeightPt = 841.89;
let pageEls = [];
let currentPage = 0;
let jumpEntries = [];
let railItems = [];
let railThumb = null;
let railScrub = null; // läuft gerade ein "Entlangfahren" an der Seitenleiste?
const renderedPages = new Map(); // Seitennummer -> Zeichen-Nummer (zum Verwerfen veralteter Aufträge)
let renderCounter = 0;

function teamIndexForPage(pageNum) {
  if (pageNum < FIRST_TEAM_PAGE) return -1;
  return Math.min(STATS_TEAMS.length - 1, Math.floor((pageNum - FIRST_TEAM_PAGE) / 2));
}

// instant: sofort statt weich (beim Entlangfahren an der Seitenleiste soll die PDF direkt folgen)
function scrollToPage(pageNum, { instant = false } = {}) {
  const el = pageEls[pageNum - 1];
  if (el) el.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start' });
}

// Ziel eines PDF-Links (Name oder Liste) in eine Seitennummer umrechnen
async function pageIndexForDest(dest) {
  let explicit = dest;
  if (typeof dest === 'string') explicit = await pdfDoc.getDestination(dest);
  if (!Array.isArray(explicit)) return null;
  const ref = explicit[0];
  if (ref && typeof ref === 'object') return await pdfDoc.getPageIndex(ref);
  if (Number.isInteger(ref)) return ref;
  return null;
}

// Klickbare Flächen über die gezeichnete Seite legen (Team-Namen im Ranking, externe Links)
async function addLinks(el, page) {
  const annotations = await page.getAnnotations({ intent: 'display' });
  for (const annotation of annotations) {
    if (annotation.subtype !== 'Link' || !annotation.rect) continue;
    const [x1, y1, x2, y2] = annotation.rect;
    const link = document.createElement('a');
    link.className = 'pdf-link';
    link.style.left = (x1 / pageWidthPt * 100) + '%';
    link.style.top = ((pageHeightPt - y2) / pageHeightPt * 100) + '%';
    link.style.width = ((x2 - x1) / pageWidthPt * 100) + '%';
    link.style.height = ((y2 - y1) / pageHeightPt * 100) + '%';
    if (annotation.url) {
      link.href = annotation.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else if (annotation.dest) {
      link.href = '#';
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        const index = await pageIndexForDest(annotation.dest);
        if (index !== null) scrollToPage(index + 1);
      });
    } else {
      continue;
    }
    el.appendChild(link);
  }
}

async function renderPage(el) {
  const num = Number(el.dataset.page);
  if (renderedPages.has(num)) return;
  const token = ++renderCounter;
  renderedPages.set(num, token);
  try {
    const page = await pdfDoc.getPage(num);
    // Etwas feiner als die Bildschirmauflösung zeichnen, damit die Seite auch beim Heranzoomen
    // mit zwei Fingern scharf bleibt; Obergrenze gegen zu große Zeichenflächen
    const cssWidth = el.clientWidth || 360;
    const density = Math.min(window.devicePixelRatio || 1, 2) * 1.5;
    const scale = Math.min((cssWidth * density) / pageWidthPt, 3.5);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    if (renderedPages.get(num) !== token) return; // inzwischen wieder freigegeben
    el.prepend(canvas);
    el.classList.add('is-rendered');
    await addLinks(el, page);
  } catch (error) {
    if (renderedPages.get(num) === token) renderedPages.delete(num);
    console.error('Seite konnte nicht gezeichnet werden:', num, error);
  }
}

function releasePage(el) {
  const num = Number(el.dataset.page);
  if (!renderedPages.has(num)) return;
  renderedPages.delete(num);
  const canvas = el.querySelector('canvas');
  if (canvas) { canvas.width = 0; canvas.height = 0; canvas.remove(); }
  el.querySelectorAll('.pdf-link').forEach(link => link.remove());
  el.classList.remove('is-rendered');
}

function setCurrentPage(pageNum) {
  if (pageNum === currentPage) return;
  currentPage = pageNum;
  const teamIdx = teamIndexForPage(pageNum);
  const label = t('stats_page_of', { n: pageNum, total: pdfDoc.numPages });

  const indicator = document.getElementById('stats-page-indicator');
  if (indicator) indicator.textContent = teamIdx >= 0 ? `${STATS_TEAMS[teamIdx][1]} · ${label}` : label;
  const railPage = document.getElementById('stats-rail-page');
  if (railPage) railPage.textContent = label;

  // Sprungleiste (Handy)
  const chips = document.getElementById('stats-chips');
  if (chips) {
    let activeChip = null;
    chips.querySelectorAll('.stats-chip').forEach(chip => {
      const isActive = pageNum >= Number(chip.dataset.from) && pageNum <= Number(chip.dataset.to);
      chip.classList.toggle('active', isActive);
      if (isActive) activeChip = chip;
    });
    if (activeChip && chips.offsetParent !== null) {
      const target = activeChip.offsetLeft - (chips.clientWidth - activeChip.clientWidth) / 2;
      chips.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  }

  // Seitenleiste (Computer)
  let activeItem = null;
  railItems.forEach(item => {
    const entry = jumpEntries[Number(item.dataset.index)];
    const isActive = pageNum >= entry.from && pageNum <= entry.to;
    item.classList.toggle('active', isActive);
    if (isActive) activeItem = item;
  });
  // Ist die Leiste wegen eines niedrigen Fensters selbst scrollbar: den aktiven Eintrag im Blick
  // halten (nicht, während man gerade daran entlangfährt - sonst rutschen die Einträge weg)
  const list = document.getElementById('stats-rail-list');
  if (activeItem && list && !railScrub && list.scrollHeight > list.clientHeight + 1) {
    list.scrollTop = Math.max(0, activeItem.offsetTop - (list.clientHeight - activeItem.offsetHeight) / 2);
  }
}

// Die feine Linie an der Seitenleiste zeigt die Position in der PDF (wie der Schieber einer
// Scrollleiste); fraction = wie weit man in der aktuellen Seite ist (0..1)
function updateRailThumb(pageNum, fraction) {
  if (!railThumb || railItems.length === 0) return;
  const itemHeight = railItems[0].offsetHeight;
  if (!itemHeight) return; // Leiste ausgeblendet (Handy)
  const position = pageNum < FIRST_TEAM_PAGE
    ? (pageNum - 1) + fraction
    : 3 + ((pageNum - FIRST_TEAM_PAGE) + fraction) / 2;
  const y = railItems[0].offsetTop + position * itemHeight;
  railThumb.style.transform = `translateY(${Math.round(y * 10) / 10}px)`;
}

// Läuft bei jedem Scrollen/Größenändern (pro Bild einmal): sichtbare und nahe Seiten zeichnen,
// weit entfernte freigeben, und die aktuelle Seite für Anzeige, Sprungleiste und Seitenleiste
// bestimmen. Bei sehr schnellem Scrollen (Sprung über viele Seiten, Entlangfahren an der Leiste)
// werden keine neuen Seiten angefangen zu zeichnen, das holt ein Nachlauf kurz nach dem Anhalten nach.
let scrollSpeed = 0; // Pixel pro Millisekunde
let settleTimer = null;
const FAST_SCROLL_SPEED = 4;

function updateVisiblePages() {
  const vh = window.innerHeight;
  const fast = scrollSpeed > FAST_SCROLL_SPEED;
  let current = 1;
  let fraction = 0;
  const probe = vh * 0.4;
  for (const el of pageEls) {
    const rect = el.getBoundingClientRect();
    const distance = rect.bottom < 0 ? -rect.bottom : (rect.top > vh ? rect.top - vh : 0);
    if (distance < vh * 1.2) { if (!fast) renderPage(el); }
    else if (distance > vh * 3.5) releasePage(el);
    if (rect.top <= probe) {
      current = Number(el.dataset.page);
      fraction = rect.height > 0 ? Math.min(1, Math.max(0, (probe - rect.top) / rect.height)) : 0;
    }
  }
  setCurrentPage(current);
  updateRailThumb(current, fraction);

  if (fast) {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { scrollSpeed = 0; scheduleUpdate(); }, 150);
  }
}

let frameRequested = false;
function scheduleUpdate() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => { frameRequested = false; updateVisiblePages(); });
}

let lastScrollY = window.scrollY;
let lastScrollTime = performance.now();
function onScroll() {
  const now = performance.now();
  scrollSpeed = Math.abs(window.scrollY - lastScrollY) / Math.max(1, now - lastScrollTime);
  lastScrollY = window.scrollY;
  lastScrollTime = now;
  scheduleUpdate();
}

// Höhe der klebenden Sprungleiste, damit Sprünge nicht unter ihr landen (CSS: scroll-margin-top);
// auf dem Computer ist die Leiste ausgeblendet (Höhe 0)
function updateToolbarHeight() {
  const toolbar = document.getElementById('stats-toolbar');
  if (toolbar) document.documentElement.style.setProperty('--stats-toolbar-h', toolbar.offsetHeight + 'px');
}

// Sprungleiste für das Handy (und schmale Fenster)
function buildToolbar() {
  const chips = document.getElementById('stats-chips');
  const chipHTML = (entry, index) => {
    if (!entry.abbr) {
      return `<button type="button" class="stats-chip stats-chip-text" data-index="${index}" data-from="${entry.from}" data-to="${entry.to}">${entry.label}</button>`;
    }
    const logo = typeof getTeamLogoURL === 'function' ? getTeamLogoURL(entry.abbr) : null;
    return `
      <button type="button" class="stats-chip" data-index="${index}" data-from="${entry.from}" data-to="${entry.to}" title="${entry.name}" data-testid="stats-team-${entry.abbr}">
        ${logo ? `<img src="${logo}" alt="" loading="lazy">` : ''}
        <span>${entry.abbr}</span>
      </button>`;
  };
  chips.innerHTML = jumpEntries.map(chipHTML).join('');
  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-index]');
    if (chip) scrollToPage(jumpEntries[Number(chip.dataset.index)].from);
  });
  document.getElementById('stats-toolbar').hidden = false;
  updateToolbarHeight();
}

// Seitenleiste für den Computer: alle Teams untereinander, gleich hoch, so dass sie wie eine Art
// Scrollleiste die ganze PDF abdecken. Anklicken springt weich zum Team; mit gedrückter Maustaste
// daran entlangfahren lässt die PDF direkt mitlaufen.
function buildRail() {
  const rail = document.getElementById('stats-rail');
  const list = document.getElementById('stats-rail-list');
  if (!rail || !list) return;

  list.innerHTML = jumpEntries.map((entry, index) => {
    if (!entry.abbr) {
      return `<button type="button" class="rail-item rail-item-text" data-index="${index}"><span>${entry.label}</span></button>`;
    }
    const logo = typeof getTeamLogoURL === 'function' ? getTeamLogoURL(entry.abbr) : null;
    return `
      <button type="button" class="rail-item" data-index="${index}" title="${entry.name}" data-testid="stats-rail-${entry.abbr}">
        ${logo ? `<img src="${logo}" alt="" loading="lazy" draggable="false">` : ''}
        <span>${entry.abbr}</span>
      </button>`;
  }).join('') + '<div class="rail-thumb" id="stats-rail-thumb" aria-hidden="true"></div>';
  railItems = [...list.querySelectorAll('.rail-item')];
  railThumb = document.getElementById('stats-rail-thumb');

  // Welcher Eintrag liegt auf Höhe der Maus? (alle Einträge sind gleich hoch)
  const entryIndexAt = (clientY) => {
    const first = railItems[0].getBoundingClientRect();
    const index = Math.floor((clientY - first.top) / first.height);
    return Math.min(railItems.length - 1, Math.max(0, index));
  };

  list.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    railScrub = { pointerId: event.pointerId, startIndex: entryIndexAt(event.clientY), lastIndex: null, dragged: false };
    list.setPointerCapture(event.pointerId);
    list.classList.add('is-scrubbing');
  });

  list.addEventListener('pointermove', (event) => {
    if (!railScrub || event.pointerId !== railScrub.pointerId) return;
    const index = entryIndexAt(event.clientY);
    if (index === railScrub.lastIndex) return;
    // Erst wenn die Maus bei gedrückter Taste einen anderen Eintrag erreicht, zählt es als "Entlangfahren"
    if (railScrub.lastIndex !== null || index !== railScrub.startIndex) railScrub.dragged = true;
    railScrub.lastIndex = index;
    if (railScrub.dragged) scrollToPage(jumpEntries[index].from, { instant: true });
  });

  const endScrub = (event) => {
    if (!railScrub || event.pointerId !== railScrub.pointerId) return;
    const { dragged } = railScrub;
    const index = entryIndexAt(event.clientY);
    railScrub = null;
    list.classList.remove('is-scrubbing');
    try { list.releasePointerCapture(event.pointerId); } catch (e) {}
    // Einfacher Klick (ohne Entlangfahren, nicht abgebrochen): weich zum Team springen
    if (!dragged && event.type === 'pointerup') scrollToPage(jumpEntries[index].from);
  };
  list.addEventListener('pointerup', endScrub);
  list.addEventListener('pointercancel', endScrub);

  // Tastatur (Eintrag fokussiert, Eingabe/Leertaste): löst ein click ohne Mausklick aus (detail 0)
  list.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    const item = event.target.closest('[data-index]');
    if (item) scrollToPage(jumpEntries[Number(item.dataset.index)].from);
  });

  rail.setAttribute('aria-label', t('stats_rail_label'));
  rail.hidden = false;
}

// Der Zurück-Link führt dorthin, woher man kam (Profil oder Einstellungen); kam man über das Menü
// oder den Kopf der App, gibt es kein "Zurück" - dann bleibt er weg
function setupBackLink() {
  const link = document.querySelector('[data-testid="stats-back"]');
  if (!link) return;
  let from = '';
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === location.origin) from = ref.pathname.split('/').pop();
  } catch (e) {}
  if (from === 'settings.html') {
    link.setAttribute('href', 'settings.html');
    const label = link.querySelector('span');
    if (label) label.textContent = t('back_to_settings');
  } else if (from !== 'profile.html') {
    link.style.display = 'none';
  }
}

async function initStatsPage() {
  setupBackLink();
  const status = document.getElementById('pdf-status');
  const container = document.getElementById('pdf-pages');
  try {
    pdfDoc = await pdfjsLib.getDocument({
      url: STATS_PDF_URL,
      // Eine einzige Anfrage statt Teilabrufen (der Service Worker legt Antworten ab, Teilantworten nicht)
      disableRange: true,
      disableStream: true,
      isEvalSupported: false
    }).promise;

    const first = await pdfDoc.getPage(1);
    const viewport = first.getViewport({ scale: 1 });
    pageWidthPt = viewport.width;
    pageHeightPt = viewport.height;

    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const el = document.createElement('div');
      el.className = 'pdf-page';
      el.dataset.page = String(i);
      el.style.aspectRatio = `${pageWidthPt} / ${pageHeightPt}`;
      fragment.appendChild(el);
    }
    container.appendChild(fragment);
    pageEls = [...container.querySelectorAll('.pdf-page')];

    jumpEntries = getJumpEntries();
    buildToolbar();
    buildRail();
    if (status) status.remove();
    window.addEventListener('scroll', onScroll, { passive: true });
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      // Nur bei geänderter Breite neu zeichnen (Drehen, Fenster ändern); die Höhe ändert sich im
      // Handy-Browser schon beim Ein-/Ausblenden der Adressleiste
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        pageEls.forEach(releasePage);
        updateToolbarHeight();
      }
      scheduleUpdate();
    });
    updateVisiblePages();
  } catch (error) {
    console.error('Error loading season statistics:', error);
    if (status) {
      status.className = 'empty-state';
      status.innerHTML = `<p class="empty-text">${t('stats_error')}</p>
        <a class="btn btn-secondary btn-sm" href="${STATS_PDF_URL}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i> ${t('stats_open_pdf')}</a>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  await initPageWithLoader(initStatsPage);
});
