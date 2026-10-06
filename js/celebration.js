// ==================== SUPER-BOWL-EFFEKTE ====================
// Konfetti-Effekte rund um den Super Bowl (canvas-confetti, siehe
// js/vendor/confetti.browser.min.js):
//  - Spieleliste: "School Pride" - Konfetti-Fontänen von beiden Seiten, NUR
//    innerhalb der Super-Bowl-Karte, in den Farben der beiden Teams. Ist das
//    Spiel beendet, nur in den Farben des Siegers.
//  - Detail-Ansicht eines beendeten Super Bowls: bunte "Fireworks" über der
//    ganzen Seite.
// Ohne geladene Library (z.B. blockiert) passiert einfach nichts.

const SUPER_BOWL_WEEK = 22; // Playoffs: 19 Wild Card, 20 Divisional, 21 Conference, 22 Super Bowl

// Konfetti-Farben pro Team: [Hauptfarbe, zweite Farbe]. Bewusst eigene, auf dem
// dunklen App-Hintergrund gut sichtbare Töne statt TEAM_COLORS (dort sind viele
// Hauptfarben fast schwarz bzw. sehr dunkel, z.B. Raiders, Jaguars, Browns -
// und Patriots/Seahawks haben dort exakt dasselbe Marineblau).
const TEAM_CONFETTI_COLORS = {
  ARI: ['#c8294b', '#ffb612'], ATL: ['#d1263f', '#d9dcde'], BAL: ['#7a5af0', '#e0b42a'],
  BUF: ['#2f6fe0', '#e31837'], CAR: ['#0085ca', '#c8c9c7'], CHI: ['#3d6fd1', '#f2602b'],
  CIN: ['#fb4f14', '#ffffff'], CLE: ['#ff3c00', '#ffffff'], DAL: ['#3b6ed6', '#c8c9c7'],
  DEN: ['#fb4f14', '#3d6fd1'], DET: ['#0076b6', '#c8c9c7'], GB: ['#2e9e5b', '#ffb612'],
  HOU: ['#2f8fc7', '#d3253e'], IND: ['#2f6fe0', '#ffffff'], JAX: ['#00a3b4', '#d7a22a'],
  KC: ['#e31837', '#ffb81c'], LV: ['#b8bec2', '#ffffff'], LAC: ['#0080c6', '#ffc20e'],
  LAR: ['#3b6ed6', '#ffd100'], MIA: ['#00a5b0', '#fc4c02'], MIN: ['#7a49c5', '#ffc62f'],
  NE: ['#2c66c8', '#e0183c'], NO: ['#d3bc8d', '#ffffff'], NYG: ['#2f5fd1', '#e0183c'],
  NYJ: ['#1a9b6c', '#ffffff'], PHI: ['#1b9aa5', '#a5acaf'], PIT: ['#ffb612', '#ffffff'],
  SF: ['#d9232d', '#b3995d'], SEA: ['#2c66c8', '#69be28'], TB: ['#e0242a', '#ff7900'],
  TEN: ['#4b92db', '#e0183c'], WAS: ['#b5273b', '#ffb612']
};

function isSuperBowlGame(game) {
  return !!game && Number(game.week) === SUPER_BOWL_WEEK;
}

function confettiColorDistance(hexA, hexB) {
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const a = rgb(hexA), b = rgb(hexB);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// Farben für den Effekt: beendet -> nur die (zwei) Farben des Siegers, sonst
// je die Hauptfarbe beider Teams. Sind die beiden Hauptfarben fast gleich
// (z.B. Patriots/Seahawks), nimmt das Heimteam stattdessen seine zweite Farbe.
function getSuperBowlConfettiColors(game) {
  const away = TEAM_CONFETTI_COLORS[game.away_team_abbr];
  const home = TEAM_CONFETTI_COLORS[game.home_team_abbr];

  const finished = game.status === 'finished' && game.home_score != null && game.away_score != null;
  if (finished && game.home_score !== game.away_score) {
    const winner = game.home_score > game.away_score ? home : away;
    if (winner) return winner.slice();
  }

  if (!away || !home) return undefined; // Standardfarben der Library
  const homeColor = confettiColorDistance(away[0], home[0]) < 70 ? home[1] : home[0];
  return [away[0], homeColor];
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function confettiAvailable() {
  return typeof confetti === 'function' && typeof confetti.create === 'function' && !prefersReducedMotion();
}

// ---------- Spieleliste: "School Pride" in der Super-Bowl-Karte ----------
const SUPER_BOWL_LIST_EFFECT_MS = 15000;

// Fest abgestimmt auf die kleine Karte (voller Standard-Wert wäre eine
// Fontäne über den ganzen Bildschirm)
const SUPER_BOWL_LIST_SHOT = {
  particleCount: 2, spread: 55, startVelocity: 26, gravity: 0.8, ticks: 120, scalar: 0.75
};

let superBowlListObserver = null;
const superBowlListRunning = new Map(); // canvas -> stop()

function getSuperBowlCanvasHTML(game) {
  return `<canvas class="superbowl-confetti" data-game-id="${game.id}" aria-hidden="true"></canvas>`;
}

// Die Konfetti-Ebene deckt nur den Spielbereich der Karte ab, nicht die
// Tipps der Gruppenmitglieder darunter - sonst würde sich der Effekt mit
// aktivem Gruppenfilter über die ganze, dann viel höhere Karte verteilen
function fitSuperBowlCanvas(canvas) {
  const card = canvas.parentElement;
  const header = card.querySelector('.game-card-header');
  const paddingBottom = parseFloat(getComputedStyle(card).paddingBottom) || 0;
  const wanted = header ? header.offsetTop + header.offsetHeight + paddingBottom : card.clientHeight;
  canvas.style.height = Math.min(wanted, card.clientHeight) + 'px';
}

function runSuperBowlSchoolPride(canvas, colors, durationMs = SUPER_BOWL_LIST_EFFECT_MS) {
  if (!confettiAvailable()) return () => {};

  fitSuperBowlCanvas(canvas);
  // Mit der Geräte-Pixeldichte zeichnen (sonst wirkt das Konfetti auf
  // Handys unscharf) und Geschwindigkeit/Schwerkraft/Grösse entsprechend
  // mitskalieren, damit es auf jedem Gerät gleich aussieht
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));

  const fire = confetti.create(canvas, { resize: false, useWorker: false, disableForReducedMotion: true });
  const base = SUPER_BOWL_LIST_SHOT;
  const shot = (angle, x) => fire({
    particleCount: base.particleCount,
    angle,
    spread: base.spread,
    origin: { x, y: 0.8 },
    colors,
    startVelocity: base.startVelocity * dpr,
    gravity: base.gravity * dpr,
    scalar: base.scalar * dpr,
    ticks: base.ticks
  });

  const end = Date.now() + durationMs;
  let stopped = false;
  let raf = 0;
  (function frame() {
    if (stopped) return;
    shot(60, 0);
    shot(120, 1);
    if (Date.now() < end) raf = requestAnimationFrame(frame);
  })();

  return function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    fire.reset();
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

function stopSuperBowlListEffects() {
  if (superBowlListObserver) {
    superBowlListObserver.disconnect();
    superBowlListObserver = null;
  }
  superBowlListRunning.forEach(stop => stop());
  superBowlListRunning.clear();
}

// Startet den Effekt, sobald die Super-Bowl-Karte im sichtbaren Bereich ist,
// und beendet ihn beim Wegscrollen bzw. wenn die Liste ausgeblendet wird
// (Detail-Ansicht offen). Beim erneuten Sichtbarwerden läuft er wieder an.
function startSuperBowlListEffects(root, games) {
  const canvases = root.querySelectorAll('canvas.superbowl-confetti');
  if (!canvases.length || !confettiAvailable() || typeof IntersectionObserver === 'undefined') return;

  superBowlListObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const canvas = entry.target;
      if (entry.isIntersecting) {
        if (superBowlListRunning.has(canvas)) return;
        const game = games.find(g => g.id === canvas.dataset.gameId);
        if (!game) return;
        superBowlListRunning.set(canvas, runSuperBowlSchoolPride(canvas, getSuperBowlConfettiColors(game)));
      } else if (superBowlListRunning.has(canvas)) {
        superBowlListRunning.get(canvas)();
        superBowlListRunning.delete(canvas);
      }
    });
  }, { threshold: 0.15 });

  canvases.forEach(canvas => superBowlListObserver.observe(canvas));
}

// ---------- Detail-Ansicht: "Fireworks" bei beendetem Super Bowl ----------
const SUPER_BOWL_FIREWORKS_MS = 15000;
let superBowlFireworksTimer = null;

function stopSuperBowlFireworks() {
  if (superBowlFireworksTimer) {
    clearInterval(superBowlFireworksTimer);
    superBowlFireworksTimer = null;
  }
  if (typeof confetti === 'function' && typeof confetti.reset === 'function') confetti.reset();
}

function playSuperBowlFireworks() {
  stopSuperBowlFireworks();
  if (!confettiAvailable()) return;

  const animationEnd = Date.now() + SUPER_BOWL_FIREWORKS_MS;
  // zIndex 30: über dem Seiteninhalt, aber unter Navigation (40) und Dialogen
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 30, disableForReducedMotion: true };
  const randomInRange = (min, max) => Math.random() * (max - min) + min;

  superBowlFireworksTimer = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      // Auslaufen lassen statt abrupt abzubrechen
      clearInterval(superBowlFireworksTimer);
      superBowlFireworksTimer = null;
      return;
    }
    // Die Teilchen fallen nach unten, deshalb etwas höher als zufällig starten
    const particleCount = 50 * (timeLeft / SUPER_BOWL_FIREWORKS_MS);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
}

// Nach dem Öffnen einer Detail-Ansicht: Feuerwerk, wenn es der beendete Super
// Bowl ist und die Detail-Ansicht auch (noch) offen ist
function celebrateSuperBowlDetail(game) {
  const detailView = document.getElementById('game-detail-view');
  const detailOpen = detailView && !detailView.classList.contains('hidden');
  if (detailOpen && isSuperBowlGame(game) && game.status === 'finished') {
    playSuperBowlFireworks();
  } else {
    stopSuperBowlFireworks();
  }
}
