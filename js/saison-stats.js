// Saison-Statistik: zeigt die PDF "NFL Saison 2025 Statistik" als Seitenansicht in der App.
// Eingebettete PDFs funktionieren auf Handys nicht zuverlässig (Android lädt sie nur herunter,
// iOS zeigt nur die erste Seite), deshalb werden die Seiten hier mit PDF.js (js/vendor/pdfjs,
// Apache-Lizenz) selbst gezeichnet - nur die gerade sichtbaren Seiten, der Rest wird erst beim
// Scrollen geladen und weit entfernte Seiten werden wieder freigegeben (spart Speicher).
// Die Team-Links der PDF (Ranking-Seite) funktionieren als Sprung zur Team-Seite.
import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

Object.assign(TRANSLATIONS.de, {
  stats_title: 'Saison 2025/26',
  stats_subtitle: 'Statistik der letzten Saison: wie die Teams gespielt haben',
  stats_open_pdf: 'PDF öffnen',
  stats_ranking: 'Ranking', stats_overview: 'Überblick', stats_leaders: 'Liga-Leader',
  stats_page_of: 'Seite {n} von {total}',
  stats_error: 'Die Statistik konnte nicht angezeigt werden.',
  back_to_profile: 'Zurück zum Profil'
});
Object.assign(TRANSLATIONS.en, {
  stats_title: 'Season 2025/26',
  stats_subtitle: 'Last season\'s statistics: how the teams played',
  stats_open_pdf: 'Open PDF',
  stats_ranking: 'Ranking', stats_overview: 'Overview', stats_leaders: 'League leaders',
  stats_page_of: 'Page {n} of {total}',
  stats_error: 'The statistics could not be displayed.',
  back_to_profile: 'Back to profile'
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

let pdfDoc = null;
let pageWidthPt = 595.28;
let pageHeightPt = 841.89;
let pageEls = [];
let currentPage = 0;
const renderedPages = new Map(); // Seitennummer -> Zeichen-Nummer (zum Verwerfen veralteter Aufträge)
let renderCounter = 0;

function teamIndexForPage(pageNum) {
  if (pageNum < FIRST_TEAM_PAGE) return -1;
  return Math.min(STATS_TEAMS.length - 1, Math.floor((pageNum - FIRST_TEAM_PAGE) / 2));
}

function scrollToPage(pageNum) {
  const el = pageEls[pageNum - 1];
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const indicator = document.getElementById('stats-page-indicator');
  if (indicator) {
    const label = t('stats_page_of', { n: pageNum, total: pdfDoc.numPages });
    indicator.textContent = teamIdx >= 0 ? `${STATS_TEAMS[teamIdx][1]} · ${label}` : label;
  }
  const chips = document.getElementById('stats-chips');
  if (!chips) return;
  let activeChip = null;
  chips.querySelectorAll('.stats-chip').forEach(chip => {
    const isActive = pageNum >= Number(chip.dataset.from) && pageNum <= Number(chip.dataset.to);
    chip.classList.toggle('active', isActive);
    if (isActive) activeChip = chip;
  });
  if (activeChip) {
    const target = activeChip.offsetLeft - (chips.clientWidth - activeChip.clientWidth) / 2;
    chips.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }
}

// Läuft bei jedem Scrollen/Größenändern (pro Bild einmal): sichtbare und nahe Seiten zeichnen,
// weit entfernte freigeben, und die aktuelle Seite für Anzeige und Sprungleiste bestimmen
function updateVisiblePages() {
  const vh = window.innerHeight;
  let current = 1;
  const probe = vh * 0.4;
  for (const el of pageEls) {
    const rect = el.getBoundingClientRect();
    const distance = rect.bottom < 0 ? -rect.bottom : (rect.top > vh ? rect.top - vh : 0);
    if (distance < vh * 1.2) renderPage(el);
    else if (distance > vh * 3.5) releasePage(el);
    if (rect.top <= probe) current = Number(el.dataset.page);
  }
  setCurrentPage(current);
}

let frameRequested = false;
function scheduleUpdate() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => { frameRequested = false; updateVisiblePages(); });
}

function buildToolbar() {
  const chips = document.getElementById('stats-chips');
  const textChip = (label, page) => `
    <button type="button" class="stats-chip stats-chip-text" data-from="${page}" data-to="${page}" data-jump="${page}">${label}</button>`;
  const teamChip = ([abbr, name], index) => {
    const page = FIRST_TEAM_PAGE + index * 2;
    const logo = typeof getTeamLogoURL === 'function' ? getTeamLogoURL(abbr) : null;
    return `
      <button type="button" class="stats-chip" data-from="${page}" data-to="${page + 1}" data-jump="${page}" title="${name}" data-testid="stats-team-${abbr}">
        ${logo ? `<img src="${logo}" alt="" loading="lazy">` : ''}
        <span>${abbr}</span>
      </button>`;
  };
  chips.innerHTML =
    textChip(t('stats_ranking'), 1) + textChip(t('stats_overview'), 2) + textChip(t('stats_leaders'), 3) +
    STATS_TEAMS.map(teamChip).join('');
  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-jump]');
    if (chip) scrollToPage(Number(chip.dataset.jump));
  });
  document.getElementById('stats-toolbar').hidden = false;
  updateToolbarHeight();
}

// Höhe der klebenden Sprungleiste, damit Sprünge nicht unter ihr landen (CSS: scroll-margin-top)
function updateToolbarHeight() {
  const toolbar = document.getElementById('stats-toolbar');
  if (toolbar && toolbar.offsetHeight) {
    document.documentElement.style.setProperty('--stats-toolbar-h', toolbar.offsetHeight + 'px');
  }
}

async function initStatsPage() {
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

    buildToolbar();
    if (status) status.remove();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
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
