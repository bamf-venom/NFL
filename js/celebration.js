// ==================== SUPER-BOWL-EFFEKTE ====================
// Konfetti-Effekte rund um den Super Bowl (canvas-confetti, siehe
// js/vendor/confetti.browser.min.js):
//  - Spieleliste, NUR bei aktivem Super-Bowl-Filter: "School Pride" über die
//    ganze Seite - Konfetti-Fontänen vom linken und rechten Bildschirmrand,
//    in den Farben der beiden Teams. Ist das Spiel beendet, nur in den Farben
//    des Siegers.
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

// Farben der Library-Demo, falls ein Kürzel keiner bekannten Mannschaft entspricht
const DEFAULT_CONFETTI_COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

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

  if (!away || !home) return DEFAULT_CONFETTI_COLORS.slice();
  const homeColor = confettiColorDistance(away[0], home[0]) < 70 ? home[1] : home[0];
  return [away[0], homeColor];
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function confettiAvailable() {
  return typeof confetti === 'function' && typeof confetti.create === 'function' && !prefersReducedMotion();
}

// ---------- Spieleliste: "School Pride" über die ganze Seite ----------
const SUPER_BOWL_PAGE_EFFECT_MS = 15000;

// Fontänen am linken und rechten Bildschirmrand. Die Original-Demo ("School
// Pride": 60/120 Grad, Tempo 45) verteilt das Konfetti über die ganze Breite,
// hier sollen die Fontänen am Rand bleiben (gemessen: >= 99 % des Konfettis in
// den äusseren 25 % je Seite bei Desktop, in den äusseren ~35 % bei Handy) -
// deshalb steilere Winkel und weniger Tempo. Auf schmalen Bildschirmen
// (Handy) zusätzlich weniger Teilchen und kürzere Lebensdauer, sonst
// verdeckt es zu viel vom Inhalt.
// angle = Winkel der linken Fontäne, die rechte ist gespiegelt (180 - angle).
function getSuperBowlPageShot() {
  return window.innerWidth < 768
    ? { particleCount: 1, angle: 72, spread: 38, startVelocity: 20, gravity: 0.8, ticks: 150, scalar: 0.9 }
    : { particleCount: 2, angle: 68, spread: 45, startVelocity: 30, gravity: 0.9, ticks: 170, scalar: 1 };
}

// key = Zustand, für den der Effekt gerade läuft oder schon gelaufen ist
// (Spiel + Farben). Solange derselbe Zustand bleibt (z.B. beim Wechsel des
// Gruppenfilters, der die Liste neu rendert), startet er nicht neu.
const superBowlPageEffect = { key: null, stop: null };

function runSuperBowlPageSchoolPride(colors, durationMs = SUPER_BOWL_PAGE_EFFECT_MS) {
  // Eigene, feste Zeichenfläche über der ganzen Seite; Klicks gehen durch
  // (pointer-events: none, siehe .superbowl-page-confetti in games.css)
  const canvas = document.createElement('canvas');
  canvas.className = 'superbowl-page-confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  // Mit der Geräte-Pixeldichte zeichnen (sonst wirkt das Konfetti auf
  // Handys unscharf) und Geschwindigkeit/Schwerkraft/Grösse entsprechend
  // mitskalieren, damit es auf jedem Gerät gleich aussieht
  let dpr = 1;
  let fitted = { w: 0, h: 0 };
  const fit = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2); // bei jedem Anpassen neu (Fenster kann auf anderen Monitor wechseln)
    const rect = canvas.getBoundingClientRect();
    fitted = { w: rect.width, h: rect.height };
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  };
  fit();

  const fire = confetti.create(canvas, { resize: false, useWorker: false, disableForReducedMotion: true });
  let base = getSuperBowlPageShot();
  // Pro Schuss eine zufällige der Farben: die Library verteilt die Farben
  // sonst nur innerhalb EINES Aufrufs (bei 1 Teilchen immer die erste Farbe)
  const pickColor = () => [colors[Math.floor(Math.random() * colors.length)]];
  const shot = (angle, x) => fire({
    particleCount: base.particleCount,
    angle,
    spread: base.spread,
    origin: { x },
    colors: pickColor(),
    startVelocity: base.startVelocity * dpr,
    gravity: base.gravity * dpr,
    scalar: base.scalar * dpr,
    ticks: base.ticks
  });

  let stopped = false;
  let raf = 0;
  let last = null;

  // Bei Drehen des Geräts/Ändern der Fenstergrösse die Zeichenfläche neu
  // anpassen. Kleine Höhenänderungen (Adressleiste auf dem Handy blendet beim
  // Scrollen ein/aus) werden ignoriert. Laufende Teilchen müssen vorher
  // verworfen werden, sonst rechnet die Library mit der alten Grösse weiter.
  function onResize() {
    const rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width - fitted.w) < 40 && Math.abs(rect.height - fitted.h) < 120) return;
    fire.reset();
    fit();
    base = getSuperBowlPageShot();
  }
  window.addEventListener('resize', onResize);

  function cleanup() {
    window.removeEventListener('resize', onResize);
    canvas.remove();
  }

  const end = Date.now() + durationMs;
  (function frame() {
    if (stopped) return;
    shot(base.angle, 0);
    last = shot(180 - base.angle, 1);
    if (Date.now() < end) {
      raf = requestAnimationFrame(frame);
    } else {
      // Zeit um: die letzten Teilchen noch auslaufen lassen, dann aufräumen
      Promise.resolve(last).then(() => { if (!stopped) cleanup(); });
    }
  })();

  return function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    fire.reset();
    cleanup();
  };
}

function stopSuperBowlPageEffect() {
  if (superBowlPageEffect.stop) superBowlPageEffect.stop();
  superBowlPageEffect.key = null;
  superBowlPageEffect.stop = null;
}

// Wird mit dem Super-Bowl-Spiel aufgerufen, wenn der Effekt laufen SOLL (Super-
// Bowl-Filter aktiv und Liste sichtbar), sonst mit null. Startet nur, wenn er
// für diesen Zustand nicht schon läuft bzw. gelaufen ist - ein erneutes
// Aufrufen (Neu-Rendern der Liste) startet ihn also nicht von vorn.
function syncSuperBowlPageEffect(game) {
  if (!game || !confettiAvailable()) {
    stopSuperBowlPageEffect();
    return;
  }
  const colors = getSuperBowlConfettiColors(game);
  const key = `${game.id}|${game.status}|${colors ? colors.join(',') : ''}`;
  if (superBowlPageEffect.key === key) return;

  stopSuperBowlPageEffect();
  superBowlPageEffect.key = key;
  superBowlPageEffect.stop = runSuperBowlPageSchoolPride(colors);
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
