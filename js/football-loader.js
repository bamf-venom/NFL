/* ==================== FOOTBALL LOADER ==================== */
/* Benötigt football-loader.css.
 *
 * Vollbild-Overlay:
 *   FootballLoader.show({ text: 'Spiele werden geladen' });
 *   FootballLoader.progress(40);   // optional: Drive-Balken, 100 = Touchdown
 *   FootballLoader.hide(800);      // optional mit Verzögerung in ms
 *
 * Inline in einem Container:
 *   const loader = new FootballLoader('#games', { hint: 'Hut, hut …' });
 *   loader.setProgress(75);
 *   loader.destroy();
 *
 * Varianten (Option variant):
 *   'color' – Standard, Lederball über grünem Feld
 *   'line'  – vereinfachte Illustration ohne Farbe, nur Linien in currentColor
 *   'nfl'   – Nachbau der Ladeanimation der NFL-App: kleiner weißer Linien-Ball
 *             auf Navy. Statt des NFL-Logos optional ein eigenes Logo (logo:
 *             Bild-URL) oder ein Schriftzug (title) in der Mitte.
 */
(function (window, document) {
  'use strict';

  const BALL = 'M4 36C18 10 42 4 60 4C78 4 102 10 116 36C102 62 78 68 60 68C42 68 18 62 4 36Z';
  const SEAM = 'M4 36C18 10 42 4 60 4C78 4 102 10 116 36';
  // Ringnähte nahe der Spitzen, bleiben beim Drall an Ort und Stelle
  const BANDS = 'M22 15.2Q27 36 22 56.8M98 15.2Q93 36 98 56.8';

  // Variante 'nfl', vermessen an einer Bildschirmaufnahme der NFL-App
  // (Einheiten = Pixel der Aufnahme, Ball-Mittelpunkt im Ursprung):
  // Quadrat mit Seitenlänge 75.6, oben links/unten rechts Radius 55,
  // an den Spitzen (oben rechts/unten links) Radius 6.
  const NFL_BALL = 'M17.2 -37.8H31.8A6 6 0 0 1 37.8 -31.8V-17.2A55 55 0 0 1 -17.2 37.8' +
    'H-31.8A6 6 0 0 1 -37.8 31.8V17.2A55 55 0 0 1 17.2 -37.8Z';
  // Schnürung und Fahrtwind im um -45° gedrehten System (x = Längsachse)
  const NFL_LACES = 'M-24 0H24M-20.5 -6.9V6.9M-7.5 -6.9V6.9M7.5 -6.9V6.9M20.5 -6.9V6.9';
  const NFL_STREAKS = ['M-61.5 -10.6H-85.5', 'M-67.2 5.9H-89.8', 'M-61.5 24.4H-72.3'];

  const DEFAULTS = {
    variant: 'color',
    logo: '',
    title: '',
    text: 'Wird geladen',
    hint: '',
    touchdownText: 'Touchdown!'
  };

  let uid = 0;
  let overlay = null;
  let hideTimer = null;

  // Querschnürung: count kurze senkrechte Striche zwischen x1 und x2
  function stitches(count, x1, x2, y1, y2) {
    let d = '';
    for (let i = 0; i < count; i++) {
      d += 'M' + (x1 + (i * (x2 - x1)) / (count - 1)).toFixed(1) + ' ' + y1 + 'V' + y2;
    }
    return d;
  }

  function ballSvg(line) {
    const id = 'fbl-' + ++uid;
    let seams = '';
    for (let i = 1; i <= 4; i++) {
      seams += '<path class="fbl-seam fbl-seam--' + i + '" d="' + SEAM + '"/>';
    }
    const laces =
      '<g class="fbl-laces"><g class="fbl-laces__inner">' +
        '<path class="fbl-lace" d="M40 36H80' + stitches(8, 43, 77, 31.5, 40.5) + '"/>' +
      '</g></g>';
    const clip = '<clipPath id="' + id + '-clip"><path d="' + BALL + '"/></clipPath>';
    const open = '<svg class="fbl-ball" viewBox="0 0 120 72" aria-hidden="true" focusable="false">';

    if (line) {
      return (
        open +
        '<defs>' + clip + '</defs>' +
        '<path class="fbl-body" d="' + BALL + '"/>' +
        '<g clip-path="url(#' + id + '-clip)">' +
          seams +
          '<path class="fbl-band" d="' + BANDS + '"/>' +
          laces +
        '</g>' +
        '<path class="fbl-outline" d="' + BALL + '"/>' +
        '</svg>'
      );
    }

    return (
      open +
      '<defs>' +
        '<radialGradient id="' + id + '-leather" cx="40%" cy="28%" r="80%">' +
          '<stop offset="0" stop-color="#d17d42"/>' +
          '<stop offset=".4" stop-color="#9c4b1f"/>' +
          '<stop offset=".78" stop-color="#6b2d0f"/>' +
          '<stop offset="1" stop-color="#3f1707"/>' +
        '</radialGradient>' +
        '<linearGradient id="' + id + '-tips">' +
          '<stop offset="0" stop-opacity=".5"/>' +
          '<stop offset=".25" stop-opacity="0"/>' +
          '<stop offset=".75" stop-opacity="0"/>' +
          '<stop offset="1" stop-opacity=".5"/>' +
        '</linearGradient>' +
        clip +
      '</defs>' +
      '<path d="' + BALL + '" fill="url(#' + id + '-leather)"/>' +
      '<g clip-path="url(#' + id + '-clip)">' +
        '<path d="' + BALL + '" fill="url(#' + id + '-tips)"/>' +
        seams +
        laces +
        '<ellipse class="fbl-shine" cx="50" cy="17" rx="24" ry="6"/>' +
      '</g>' +
      '<path class="fbl-outline" d="' + BALL + '"/>' +
      '</svg>'
    );
  }

  function nflSvg() {
    const id = 'fbl-' + ++uid;
    let streaks = '';
    NFL_STREAKS.forEach(function (d, i) {
      streaks += '<path class="fbl-nfl-streak fbl-nfl-streak--' + (i + 1) + '" d="' + d + '" pathLength="100"/>';
    });
    return (
      '<svg class="fbl-nfl-icon" viewBox="-72 -72 144 144" aria-hidden="true" focusable="false">' +
        '<defs><clipPath id="' + id + '-clip"><path d="' + NFL_BALL + '"/></clipPath></defs>' +
        '<g transform="rotate(-45)">' + streaks + '</g>' +
        '<g clip-path="url(#' + id + '-clip)"><g transform="rotate(-45)">' +
          '<g class="fbl-nfl-laces"><path d="' + NFL_LACES + '"/></g>' +
        '</g></g>' +
        '<path d="' + NFL_BALL + '"/>' +
      '</svg>'
    );
  }

  const MINI_BALL =
    '<svg viewBox="0 0 120 72" aria-hidden="true" focusable="false">' +
      '<path class="fbl-mini-body" d="' + BALL + '"/>' +
      '<path class="fbl-mini-lace" d="M36 36H84' + stitches(4, 44, 76, 27, 45) + '"/>' +
    '</svg>';

  function template(variant) {
    const stage =
      variant === 'nfl'
        ? nflSvg()
        : '<div class="fbl-stage" aria-hidden="true">' +
            '<div class="fbl-field"></div>' +
            '<div class="fbl-shadow"></div>' +
            '<div class="fbl-flight"><div class="fbl-tilt">' +
              '<div class="fbl-streaks"><span></span><span></span><span></span></div>' +
              ballSvg(variant === 'line') +
            '</div></div>' +
          '</div>';
    return (
      stage +
      '<div class="fbl-label" role="status" aria-live="polite">' +
        '<span class="fbl-text"></span>' +
        '<span class="fbl-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>' +
      '</div>' +
      '<div class="fbl-hint" hidden></div>' +
      '<div class="fbl-drive" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>' +
        '<div class="fbl-drive__track">' +
          '<div class="fbl-drive__ez fbl-drive__ez--own"></div>' +
          '<div class="fbl-drive__gain"></div>' +
          '<div class="fbl-drive__ez fbl-drive__ez--goal"></div>' +
          '<div class="fbl-drive__ball">' + MINI_BALL + '</div>' +
        '</div>' +
        '<div class="fbl-drive__meta">' +
          '<span class="fbl-drive__spot"></span>' +
          '<span class="fbl-drive__pct"></span>' +
        '</div>' +
      '</div>'
    );
  }

  // Fortschritt als Feldposition: 0 = eigene Endzone, 100 = Touchdown
  function fieldSpot(p) {
    if (p >= 100) return 'Endzone';
    if (p >= 80) return 'Red Zone · ' + (100 - p);
    if (p === 50) return 'Mittellinie';
    return p < 50 ? 'Eigene ' + p : 'Gegner ' + (100 - p);
  }

  class FootballLoader {
    constructor(target, options) {
      const parent = typeof target === 'string' ? document.querySelector(target) : target;
      if (!parent) throw new Error('FootballLoader: Container nicht gefunden');

      this.options = Object.assign({}, DEFAULTS, options);
      // Adoptiert ein bereits im HTML vorhandenes .fbl-Element (statisches
      // Markup direkt im <body>, siehe "page-loader" in den *.html-Dateien -
      // macht den Loader schon beim allerersten Paint sichtbar, ganz ohne
      // auf JS zu warten, kein Aufblitzen der eigentlichen Seite mehr davor).
      // Ohne passendes Element (z.B. normale Inline-Nutzung per
      // `new FootballLoader('#container', ...)`) wird wie bisher ein neues
      // erzeugt.
      this.el = parent.querySelector(':scope > .fbl') || document.createElement('div');
      this.render();
      if (!this.el.parentElement) parent.appendChild(this.el);
    }

    // Baut das Markup für die aktuelle Variante (neu) auf
    render() {
      const el = this.el;
      const o = this.options;
      // 'nfl' übernimmt die Linien-Styles für Drive-Balken und Touchdown
      el.className =
        o.variant === 'nfl' ? 'fbl fbl--line fbl--nfl' : o.variant === 'line' ? 'fbl fbl--line' : 'fbl';
      el.innerHTML = template(o.variant);

      if (o.variant === 'nfl' && (o.logo || o.title)) {
        const brand = document.createElement('div');
        brand.className = 'fbl-nfl-brand';
        if (o.logo) {
          const img = document.createElement('img');
          img.src = o.logo;
          img.alt = o.title || '';
          brand.appendChild(img);
        } else {
          brand.textContent = o.title;
        }
        el.insertBefore(brand, el.firstChild);
      }

      this.textEl = el.querySelector('.fbl-text');
      this.hintEl = el.querySelector('.fbl-hint');
      this.drive = el.querySelector('.fbl-drive');
      this.gain = el.querySelector('.fbl-drive__gain');
      this.marker = el.querySelector('.fbl-drive__ball');
      this.spot = el.querySelector('.fbl-drive__spot');
      this.pct = el.querySelector('.fbl-drive__pct');
      return this.reset();
    }

    setText(text, hint) {
      if (text != null) {
        this.options.text = String(text);
        if (!this.el.classList.contains('is-touchdown')) this.textEl.textContent = this.options.text;
      }
      if (hint !== undefined) {
        this.options.hint = hint ? String(hint) : '';
        this.hintEl.textContent = this.options.hint;
        this.hintEl.hidden = !this.options.hint;
      }
      return this;
    }

    setProgress(value) {
      const p = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      const done = p === 100;

      this.progress = p;
      this.drive.hidden = false;
      this.drive.setAttribute('aria-valuenow', p);
      this.gain.style.width = p * 0.84 + '%';
      this.marker.style.left = (done ? 96 : 8 + p * 0.84) + '%';
      this.spot.textContent = fieldSpot(p);
      this.pct.textContent = p + ' %';
      this.el.classList.toggle('is-redzone', p >= 80 && !done);

      if (done !== this.el.classList.contains('is-touchdown')) {
        this.el.classList.toggle('is-touchdown', done);
        this.textEl.textContent = done ? this.options.touchdownText : this.options.text;
      }
      return this;
    }

    reset() {
      this.progress = null;
      this.el.classList.remove('is-redzone', 'is-touchdown');
      this.drive.hidden = true;
      this.gain.style.width = '0%';
      this.marker.style.left = '8%';
      return this.setText(this.options.text, this.options.hint);
    }

    destroy() {
      this.el.remove();
    }

    // ===== Vollbild-Overlay (eine Instanz pro Seite) =====

    static show(options) {
      clearTimeout(hideTimer);
      if (!overlay) {
        // Schon ein statischer Loader im HTML vorhanden (siehe
        // "page-loader" in den *.html-Dateien)? Dann übernehmen statt einen
        // zweiten, überlappenden zu erzeugen - der ist schon sichtbar,
        // braucht also auch keinen Reflow/Einblend-Übergang.
        let wrap = document.querySelector('.fbl-overlay');
        const isNew = !wrap;
        if (isNew) {
          wrap = document.createElement('div');
          wrap.className = 'fbl-overlay is-hidden';
          (document.body || document.documentElement).appendChild(wrap);
        } else {
          wrap.classList.remove('is-hidden');
        }
        overlay = new FootballLoader(wrap, options);
        overlay.overlay = wrap;
        if (isNew) void wrap.offsetWidth; // Reflow, damit das Einblenden animiert
      } else {
        const prev = overlay.options;
        overlay.options = Object.assign({}, DEFAULTS, options);
        const o = overlay.options;
        if (o.variant !== prev.variant || o.logo !== prev.logo || o.title !== prev.title) overlay.render();
        else overlay.reset();
      }
      overlay.overlay.classList.toggle('fbl-overlay--nfl', overlay.options.variant === 'nfl');
      document.documentElement.classList.add('fbl-lock');
      overlay.overlay.classList.remove('is-hidden');
      return overlay;
    }

    static progress(value) {
      if (!overlay || overlay.overlay.classList.contains('is-hidden')) FootballLoader.show();
      return overlay.setProgress(value);
    }

    static hide(delay) {
      clearTimeout(hideTimer);
      if (!overlay) return;
      const current = overlay;
      hideTimer = setTimeout(function () {
        current.overlay.classList.add('is-hidden');
        document.documentElement.classList.remove('fbl-lock');
        hideTimer = setTimeout(function () {
          current.overlay.remove();
          if (overlay === current) overlay = null;
        }, 350);
      }, delay || 0);
    }
  }

  window.FootballLoader = FootballLoader;
})(window, document);
