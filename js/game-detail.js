// Spiel-Detail-Logik - läuft als In-Page-Ansicht innerhalb von games.html
// (aufgerufen über openGameDetail() in games.js), nicht mehr als eigene
// Seite. userGroups/selectedGroupId werden deshalb NICHT hier deklariert,
// sondern von games.js mitverwendet (dort bereits vorhanden) - zwei
// let-Deklarationen desselben Namens im selben globalen Scope (beide
// Skripte laufen jetzt auf derselben Seite) würden sonst einen SyntaxError
// werfen. Als netter Nebeneffekt bleibt die Gruppenauswahl so automatisch
// zwischen Liste und Detail-Ansicht konsistent.
Object.assign(TRANSLATIONS.de, {
  game_not_found: 'Spiel nicht gefunden', back_to_games_btn: 'Zurück zu Spielen',
  error_loading_game: 'Das Spiel konnte nicht geladen werden.',
  vs: 'VS', betting_closed_title: 'Wetten geschlossen',
  betting_closed_text: 'Das Spiel hat bereits begonnen. Wetten sind nicht mehr möglich.',
  place_bet_title: 'Deine Wette platzieren', team_points: '{team} Punkte',
  bet_placed_success: 'Wette erfolgreich platziert!', btn_place_bet: 'Wette platzieren',
  bet_placing: 'Wird platziert...', points_info: '3 Punkte pro richtigem Team-Score • 1 Punkt für richtigen Gewinner',
  my_bet_title: 'Deine Wette', btn_edit: 'Bearbeiten',
  points_earned_label: 'Punkte erhalten', group_bets_title: 'Wetten in der Gruppe ({n})',
  no_group_bets_for_game: 'Noch keine Wetten in dieser Gruppe für dieses Spiel',
  error_placing_bet: 'Fehler beim Platzieren der Wette', edit_bet_title: 'Wette bearbeiten',
  edit_bet_success: 'Wette erfolgreich aktualisiert!', edit_bet_hint: 'Du kannst deine Wette bis 24 Stunden vor Spielbeginn bearbeiten',
  btn_save_changes: 'Änderungen speichern', bet_saving: 'Wird gespeichert...',
  error_updating_bet: 'Fehler beim Aktualisieren der Wette', error_deleting_bet: 'Fehler beim Löschen der Wette',
  record_label: 'Bilanz · Siegquote',
  team_record_hint: 'Siege-Niederlagen der regulären Saison vor diesem Spiel'
});
Object.assign(TRANSLATIONS.en, {
  game_not_found: 'Game not found', back_to_games_btn: 'Back to games',
  error_loading_game: 'The game could not be loaded.',
  vs: 'VS', betting_closed_title: 'Betting closed',
  betting_closed_text: 'The game has already started. Bets are no longer possible.',
  place_bet_title: 'Place your bet', team_points: '{team} points',
  bet_placed_success: 'Bet placed successfully!', btn_place_bet: 'Place bet',
  bet_placing: 'Placing...', points_info: '3 points for each correct team score • 1 point for the correct winner',
  my_bet_title: 'Your bet', btn_edit: 'Edit',
  points_earned_label: 'Points earned', group_bets_title: 'Group picks ({n})',
  no_group_bets_for_game: 'No picks in this group for this game yet',
  error_placing_bet: 'Error placing bet', edit_bet_title: 'Edit bet',
  edit_bet_success: 'Bet updated successfully!', edit_bet_hint: 'You can edit your bet up to 24 hours before kickoff',
  btn_save_changes: 'Save changes', bet_saving: 'Saving...',
  error_updating_bet: 'Error updating bet', error_deleting_bet: 'Error deleting bet',
  record_label: 'Record · Win rate',
  team_record_hint: 'Win-loss record of the regular season before this game'
});

let currentGameData = null;
let groupBetsData = []; // Wetten der Mitglieder der ausgewählten Gruppe (nicht mehr "alle Wetten global")
let myBetData = null;
let currentTeamResults = null; // Ergebnisse der Saison pro Team, siehe getSeasonTeamResults()

// ==================== TEAM-BILANZ (Siege-Niederlagen) ====================
// Wird aus den ohnehin geladenen beendeten Spielen der Saison berechnet - keine
// zusätzlichen Firestore-Abfragen und nichts, was extra gespeichert werden
// müsste. Das Ergebnis bleibt ein fester Wert (wird pro Saison gemerkt), bis
// sich die beendeten Spiele ändern: sobald ein Spiel beendet wird (oder ein
// Endstand korrigiert wird), passt die Signatur nicht mehr und es wird beim
// nächsten Öffnen einer Detail-Ansicht automatisch neu berechnet.
const REGULAR_SEASON_LAST_WEEK = 18;
const teamResultsCache = {}; // season -> { signature, results }

function getSeasonTeamResults(season, games) {
  const finished = games.filter(g =>
    g.season === season && g.status === 'finished' && g.week <= REGULAR_SEASON_LAST_WEEK &&
    g.home_score != null && g.away_score != null
  );
  const signature = finished.map(g => `${g.id}:${g.home_score}-${g.away_score}`).join('|');

  const cached = teamResultsCache[season];
  if (cached && cached.signature === signature) return cached.results;

  const results = {}; // Kürzel -> [{ time, outcome: 'W' | 'L' | 'T' }]
  finished.forEach(g => {
    const time = new Date(g.game_date).getTime();
    const diff = g.home_score - g.away_score;
    (results[g.home_team_abbr] = results[g.home_team_abbr] || []).push({ time, outcome: diff > 0 ? 'W' : diff < 0 ? 'L' : 'T' });
    (results[g.away_team_abbr] = results[g.away_team_abbr] || []).push({ time, outcome: diff < 0 ? 'W' : diff > 0 ? 'L' : 'T' });
  });

  teamResultsCache[season] = { signature, results };
  return results;
}

// Bilanz eines Teams VOR dem Anpfiff des betrachteten Spiels. Unentschieden
// zählen wie in der NFL als halber Sieg.
function getTeamRecordBefore(results, abbr, beforeTime) {
  const record = { wins: 0, losses: 0, ties: 0, pct: null };
  (results[abbr] || []).forEach(r => {
    if (r.time >= beforeTime) return;
    if (r.outcome === 'W') record.wins++;
    else if (r.outcome === 'L') record.losses++;
    else record.ties++;
  });
  const total = record.wins + record.losses + record.ties;
  if (total > 0) record.pct = (record.wins + record.ties / 2) / total;
  return record;
}

// Vergleichsbalken unter den Teams: links Auswärts-, rechts Heimteam (wie in
// der Kopfzeile), oben Bilanz, darunter Siegquote als gespiegelte Balken, die
// von der Mitte nach aussen wachsen. Das Team mit der höheren Quote ist
// hervorgehoben.
function getRecordCompareHTML(game) {
  if (!currentTeamResults) return '';
  const time = new Date(game.game_date).getTime();
  const sides = [game.away_team_abbr, game.home_team_abbr].map(abbr => {
    const record = getTeamRecordBefore(currentTeamResults, abbr, time);
    return {
      abbr,
      wl: `${record.wins}-${record.losses}${record.ties ? '-' + record.ties : ''}`,
      pct: record.pct,
      pctText: record.pct === null ? '–' : `${Math.round(record.pct * 100)}%`
    };
  });
  const [away, home] = sides;
  const lead = (a, b) => (a.pct ?? -1) >= (b.pct ?? -1) ? ' leads' : '';

  return `
    <div class="record-compare" title="${t('team_record_hint')}" data-testid="record-compare">
      <div class="record-wl record-away${lead(away, home)}" data-testid="team-record-${away.abbr}"><span class="record-abbr">${away.abbr}</span>${away.wl}</div>
      <div class="record-label">${t('record_label')}</div>
      <div class="record-wl record-home${lead(home, away)}" data-testid="team-record-${home.abbr}">${home.wl}<span class="record-abbr">${home.abbr}</span></div>

      <div class="record-pct record-away${lead(away, home)}">${away.pctText}</div>
      <div class="record-bars">
        <div class="record-bar record-away${lead(away, home)}"><i style="width: ${Math.round((away.pct ?? 0) * 100)}%"></i></div>
        <div class="record-bar record-home${lead(home, away)}"><i style="width: ${Math.round((home.pct ?? 0) * 100)}%"></i></div>
      </div>
      <div class="record-pct record-home${lead(home, away)}">${home.pctText}</div>
    </div>
  `;
}

// Spiele der Saison für die Bilanz: normalerweise liegen sie über games.js
// schon im Speicher, bei einem Deep-Link auf eine noch nicht geladene Saison
// wird sie (aus dem Cache bzw. gezielt) nachgeladen
async function getSeasonGamesForRecords(season) {
  const loaded = typeof gamesData !== 'undefined' ? gamesData.filter(g => g.season === season) : [];
  if (loaded.length > 0) return loaded;
  return await firebaseGetGames({ season });
}

// Load game detail - bevorzugt aus den bereits von games.js geladenen
// Daten (gamesData/userBetsMap/userGroups), damit das Öffnen eines Spiels
// im Normalfall OHNE Firestore-Aufruf und damit sofort passiert. Nur falls
// etwas dort nicht gefunden wird (z.B. Deep-Link auf ein Spiel aus einer
// noch nicht geladenen Saison), wird gezielt nachgeladen.
async function loadGameDetail(gameId) {
  try {
    let game = (typeof gamesData !== 'undefined' ? gamesData.find(g => g.id === gameId) : null) || null;
    if (!game) {
      game = await firebaseGetGame(gameId);
    }

    currentGameData = game;

    if (!currentGameData) {
      document.getElementById('game-detail-container').innerHTML = `
        <div class="card empty-state">
          <h3 class="empty-title">${t('game_not_found')}</h3>
          <a href="#" class="btn btn-primary" style="margin-top: 16px;" onclick="closeGameDetail(); return false;">${t('back_to_games_btn')}</a>
        </div>
      `;
      return;
    }

    // Die Bilanz ist nur eine Zusatzinfo - schlägt das Laden fehl, wird die
    // Detail-Ansicht trotzdem ohne sie angezeigt
    try {
      currentTeamResults = getSeasonTeamResults(game.season, await getSeasonGamesForRecords(game.season));
    } catch (error) {
      console.error('Error loading team records:', error);
      currentTeamResults = null;
    }

    myBetData = (typeof userBetsMap !== 'undefined' ? userBetsMap[gameId] : null) || null;
    if (!myBetData && currentUser) {
      // Fallback, falls userBetsMap ausnahmsweise noch nicht gefüllt ist
      myBetData = await firebaseGetUserBetForGame(currentUser.id, gameId);
    }

    if (typeof userGroups === 'undefined' || !userGroups) {
      userGroups = await firebaseGetUserGroups();
    }

    // Gruppe auswählen: userGroups/selectedGroupId sind dieselben Variablen
    // wie auf der Spiele-Liste (siehe Kommentar oben im Datei-Header) - die
    // dortige loadFilterState() hat selectedGroupId beim Seitenaufruf schon
    // aus dem gespeicherten Filter wiederhergestellt. Hier nur noch prüfen,
    // ob die Auswahl noch gültig ist, sonst auf die erste eigene Gruppe
    // zurückfallen. Ohne Gruppen gibt es nichts zu wählen.
    if (userGroups.length > 0) {
      if (!selectedGroupId || !userGroups.find(g => g.id === selectedGroupId)) {
        selectedGroupId = userGroups[0].id;
      }
      await loadGroupBetsForCurrentGame();
    } else {
      selectedGroupId = null;
      groupBetsData = [];
    }

    renderGameDetail();
  } catch (error) {
    console.error('Error loading game:', error);
    document.getElementById('game-detail-container').innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-exclamation-triangle fa-3x empty-icon" style="color: var(--error);"></i>
        <h3 class="empty-title">${t('error_loading_title')}</h3>
        <p class="empty-text">${t('error_loading_game')}</p>
        <button class="btn btn-primary" onclick="location.reload()">${t('btn_retry')}</button>
      </div>
    `;
  }
}

// Lädt die Wetten der Mitglieder der aktuell gewählten Gruppe für dieses Spiel
async function loadGroupBetsForCurrentGame() {
  if (!selectedGroupId || !currentGameData) {
    groupBetsData = [];
    return;
  }
  try {
    groupBetsData = await firebaseGetGroupBets(selectedGroupId, currentGameData.id, currentGameData.status === 'finished');
  } catch (error) {
    console.error('Error loading group bets:', error);
    groupBetsData = [];
  }
}

// Wird aufgerufen wenn der Nutzer im Dropdown eine andere Gruppe auswählt
async function switchGameDetailGroup(groupId) {
  selectedGroupId = groupId;

  const section = document.getElementById('group-bets-section-content');
  if (section) {
    section.innerHTML = `<div class="loading-container"><div class="spinner"></div></div>`;
  }

  await loadGroupBetsForCurrentGame();
  renderGameDetail();
}

// Render game detail
function renderGameDetail() {
  const container = document.getElementById('game-detail-container');
  const game = currentGameData;
  const status = getStatusBadge(game.status);
  
  // Wetten werden ab der Sperrfrist vor Anpfiff gesperrt (nicht erst beim Anpfiff selbst)
  const gameDate = new Date(game.game_date);
  const now = new Date();
  const bettingLockTime = new Date(gameDate.getTime() - BETTING_LOCK_MINUTES_BEFORE_KICKOFF * 60000);
  const isGameStarted = now >= bettingLockTime;

  // Bearbeiten erlaubt solange Sperrfrist noch nicht erreicht ist
  const canEditBet = myBetData && game.status === 'scheduled' && !isGameStarted;

  // Wetten erlaubt wenn: Status ist "scheduled" UND keine Wette vorhanden UND Sperrfrist noch nicht erreicht
  const canBet = game.status === 'scheduled' && !myBetData && !isGameStarted;

  // Wetten sind geschlossen wenn wir innerhalb der Sperrfrist vor Anpfiff sind,
  // das Spiel aber noch nicht als "live"/"finished" markiert wurde
  const isBettingClosed = game.status === 'scheduled' && isGameStarted;

  // Schloss-Icon: rot/geschlossen wenn Spiel vorbei/gestartet, grün/offen wenn noch tippbar
  const isLocked = isGameStarted || game.status === 'finished' || game.status === 'live';
  const lockIconHTML = isLocked
    ? `<i class="fas fa-lock lock-icon locked" title="${t('lock_title_locked')}"></i>`
    : `<i class="fas fa-lock-open lock-icon open" title="${t('lock_title_open')}"></i>`;

  // Badge zeigt den tatsächlichen Status - aber wenn die Sperrfrist erreicht ist und die
  // DB das (noch) nicht mitbekommen hat ("scheduled"), zeigen wir "GESPERRT" in rot
  let badgeClass = status.class;
  let badgeText = status.text;
  if (isBettingClosed) {
    badgeClass = 'badge-error';
    badgeText = t('status_locked');
  }

  let html = `
    <!-- Game Header -->
    <!-- NFL-Konvention "Away at Home" (z.B. "Ravens at Cowboys") - Auswärtsteam
         links, Heimteam rechts, konsistent mit der Spieleliste (games.js) -->
    <div class="card game-detail-header animate-fade-in ${getInternationalInfo(game) ? 'game-detail-international' : ''}" style="--home-color: ${TEAM_COLORS[game.home_team_abbr] || 'var(--accent)'}; --away-color: ${TEAM_COLORS[game.away_team_abbr] || 'var(--accent)'};">
      ${getInternationalBackdropHTML(game)}
      <div class="badge-lock-group" style="justify-content: center; margin-bottom: 16px;">
        <span class="badge ${badgeClass}">
          ${badgeText}
        </span>
        ${getBettingCountdownHTML(game)}
        ${lockIconHTML}
      </div>

      ${getInternationalBadgeHTML(game, { withStadium: true })}

      <div class="game-detail-teams">
        <!-- Away Team -->
        <div class="game-detail-team">
          ${getTeamLogoHTML(game.away_team_abbr, 80)}
          <h3 data-testid="away-team-name">${game.away_team}</h3>
        </div>

        <!-- Score or VS -->
        ${game.status === 'finished' || game.status === 'live' ? `
          <div class="game-detail-score">
            <span class="game-detail-score-num" data-testid="away-score">${game.away_score ?? '-'}</span>
            <span class="game-detail-score-sep">:</span>
            <span class="game-detail-score-num" data-testid="home-score">${game.home_score ?? '-'}</span>
          </div>
        ` : `
          <div class="game-detail-vs">${t('vs')}</div>
        `}

        <!-- Home Team -->
        <div class="game-detail-team">
          ${getTeamLogoHTML(game.home_team_abbr, 80)}
          <h3 data-testid="home-team-name">${game.home_team}</h3>
        </div>
      </div>

      ${getRecordCompareHTML(game)}

      <div class="game-detail-info">
        <i class="fas fa-clock"></i>
        <span>${t('week_n', { n: game.week })} • ${formatDate(game.game_date)}</span>
      </div>
    </div>
  `;
  
  // Zeige "Wetten geschlossen" NUR wenn das Spiel-Datum in der Vergangenheit liegt
  // UND der Status noch "scheduled" ist (Admin hat es noch nicht auf live/finished gesetzt)
  if (!myBetData && isGameStarted && game.status === 'scheduled') {
    html += `
      <div class="card betting-closed-notice animate-fade-in" style="margin-top: 24px; animation-delay: 0.1s;">
        <div class="betting-closed-content">
          <i class="fas fa-clock fa-lg"></i>
          <div class="betting-closed-text">
            <h3>${t('betting_closed_title')}</h3>
            <p>${t('betting_closed_text')}</p>
          </div>
        </div>
      </div>
    `;
  }
  
  // Bet Form
  if (canBet) {
    html += `
      <div class="card bet-form-card animate-fade-in" style="animation-delay: 0.1s;">
        <h3 class="bet-form-title">
          <i class="fas fa-trophy"></i>
          ${t('place_bet_title')}
        </h3>

        <form onsubmit="handlePlaceBet(event)">
          <div class="bet-inputs">
            <div class="form-group">
              <label class="form-label">${t('team_points', { team: game.away_team_abbr })}</label>
              <input type="number" id="away-score-input" class="form-input" min="0" max="100" placeholder="0" required data-testid="away-score-input">
            </div>
            <div class="form-group">
              <label class="form-label">${t('team_points', { team: game.home_team_abbr })}</label>
              <input type="number" id="home-score-input" class="form-input" min="0" max="100" placeholder="0" required data-testid="home-score-input">
            </div>
          </div>

          <div id="bet-error" class="error-message hidden"></div>
          <div id="bet-success" class="success-message hidden">${t('bet_placed_success')}</div>

          <button type="submit" id="bet-submit-btn" class="btn btn-primary btn-full" style="margin-top: 16px;" data-testid="submit-bet-button">
            ${t('btn_place_bet')}
          </button>

          <p class="bet-points-info">
            ${t('points_info')}
          </p>
        </form>
      </div>
    `;
  }
  
  // My Bet
  if (myBetData) {
    // Prüfe ob Löschen erlaubt (Spiel noch nicht gestartet)
    const canDeleteBet = game.status === 'scheduled' && !isGameStarted;
    
    html += `
      <div class="card my-bet-card animate-fade-in" style="margin-top: 24px; animation-delay: 0.1s;">
        <div class="my-bet-header">
          <h3 class="my-bet-title">
            <i class="fas fa-check"></i>
            ${t('my_bet_title')}
          </h3>
          <div style="display: flex; gap: 8px;">
            ${canEditBet ? `
              <button class="btn btn-secondary btn-sm" onclick="openEditBetModal()" data-testid="edit-bet-button">
                <i class="fas fa-edit"></i>
                ${t('btn_edit')}
              </button>
            ` : ''}
            ${canDeleteBet ? `
              <button class="btn btn-danger btn-sm" onclick="handleDeleteBet()" data-testid="delete-bet-button">
                <i class="fas fa-trash"></i>
                ${t('btn_delete')}
              </button>
            ` : ''}
          </div>
        </div>
        
        <div class="my-bet-scores">
          <div class="my-bet-score">
            <div class="my-bet-score-num" data-testid="my-bet-away">${myBetData.away_score_prediction}</div>
            <div class="my-bet-score-team">${game.away_team_abbr}</div>
          </div>
          <div style="font-size: 24px; color: var(--muted);">:</div>
          <div class="my-bet-score">
            <div class="my-bet-score-num" data-testid="my-bet-home">${myBetData.home_score_prediction}</div>
            <div class="my-bet-score-team">${game.home_team_abbr}</div>
          </div>
        </div>
        
        ${game.status === 'finished' ? `
          <div class="my-bet-points">
            <div class="my-bet-points-label">${t('points_earned_label')}</div>
            <div class="my-bet-points-num">${myBetData.points_earned || 0}</div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Gruppen-Wetten - nur wenn der Nutzer in mindestens einer Gruppe ist.
  // Zeigt keine globalen Wetten aller Nutzer mehr, sondern nur die der
  // gewählten Gruppe (mit Auswahl, falls man in mehreren Gruppen ist).
  if (userGroups.length > 0) {
    const groupSelectorHTML = userGroups.length > 1 ? `
      <select class="form-input" style="width: auto; min-width: 160px;" data-testid="game-detail-group-select" onchange="switchGameDetailGroup(this.value)">
        ${userGroups.map(g => `<option value="${g.id}" ${g.id === selectedGroupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
      </select>
    ` : `<span style="color: var(--muted); font-size: 14px;">${escapeHtml(userGroups[0].name)}</span>`;

    html += `
      <div class="card animate-fade-in" style="margin-top: 24px; animation-delay: 0.2s;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <h3 style="font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin: 0;">
            <i class="fas fa-users"></i>
            ${t('group_bets_title', { n: groupBetsData.length })}
          </h3>
          ${groupSelectorHTML}
        </div>

        <div id="group-bets-section-content">
          ${groupBetsData.length === 0 ? `
            <p style="text-align: center; color: var(--muted); padding: 32px 0;">
              ${t('no_group_bets_for_game')}
            </p>
          ` : `
            <div class="bets-list">
              ${groupBetsData.map((bet, i) => `
                <div class="bet-item ${bet.user_id === currentUser?.id ? 'own' : ''}"
                     style="animation: fadeIn 0.3s ease-out ${i * 0.05}s both;"
                     data-testid="bet-${bet.id}">
                  <div class="bet-user">
                    <div class="bet-avatar">${escapeHtml(bet.username.charAt(0).toUpperCase())}</div>
                    <div class="bet-user-info">
                      <div class="bet-username">${escapeHtml(bet.username)}</div>
                      <div class="bet-date">${new Date(bet.created_at).toLocaleDateString(getCurrentLocale())}</div>
                    </div>
                  </div>

                  <div class="bet-prediction">
                    <span class="bet-prediction-score">${bet.away_score_prediction} : ${bet.home_score_prediction}</span>
                    ${game.status === 'finished' ? `
                      <span class="bet-earned ${bet.points_earned > 0 ? 'success' : 'none'}">
                        ${bet.points_earned || 0} ${t('pts_short')}
                      </span>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Handle place bet
async function handlePlaceBet(event) {
  event.preventDefault();
  
  const homeScore = parseInt(document.getElementById('home-score-input').value);
  const awayScore = parseInt(document.getElementById('away-score-input').value);
  const errorEl = document.getElementById('bet-error');
  const successEl = document.getElementById('bet-success');
  const submitBtn = document.getElementById('bet-submit-btn');
  
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('bet_placing')}`;

  try {
    const bet = await firebasePlaceBet({
      game_id: currentGameData.id,
      home_score_prediction: homeScore,
      away_score_prediction: awayScore
    });

    myBetData = bet;

    // userBetsMap gehört games.js (siehe Kommentar oben in dieser Datei) und
    // wird für die "Mein Tipp"-Anzeige in der Spielübersicht genutzt -
    // closeGameDetail() ist ein reiner DOM-Wechsel ohne Neu-Rendern, ohne
    // dieses Update hier würde die Übersicht bis zum nächsten vollen Reload
    // weiter den alten Stand (keinen/den vorherigen Tipp) zeigen.
    userBetsMap[currentGameData.id] = bet;
    if (typeof renderGames === 'function') renderGames();

    await loadGroupBetsForCurrentGame();

    successEl.classList.remove('hidden');

    setTimeout(() => {
      renderGameDetail();
    }, 1500);
  } catch (error) {
    console.error('Error placing bet:', error);
    errorEl.textContent = error.message || t('error_placing_bet');
    errorEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.innerHTML = t('btn_place_bet');
  }
}

// Open edit bet modal
function openEditBetModal() {
  if (!myBetData) return;
  
  document.getElementById('edit-bet-teams').textContent = `${currentGameData.away_team_abbr} vs ${currentGameData.home_team_abbr}`;
  document.getElementById('edit-bet-home-label').textContent = t('team_points', { team: currentGameData.home_team_abbr });
  document.getElementById('edit-bet-away-label').textContent = t('team_points', { team: currentGameData.away_team_abbr });
  document.getElementById('edit-bet-home-score').value = myBetData.home_score_prediction;
  document.getElementById('edit-bet-away-score').value = myBetData.away_score_prediction;
  
  document.getElementById('edit-bet-error').classList.add('hidden');
  document.getElementById('edit-bet-success').classList.add('hidden');
  
  document.getElementById('edit-bet-modal').classList.add('active');
}

// Close edit bet modal
function closeEditBetModal() {
  document.getElementById('edit-bet-modal').classList.remove('active');
}

// Handle edit bet
async function handleEditBet(event) {
  event.preventDefault();
  
  const homeScore = parseInt(document.getElementById('edit-bet-home-score').value);
  const awayScore = parseInt(document.getElementById('edit-bet-away-score').value);
  const errorEl = document.getElementById('edit-bet-error');
  const successEl = document.getElementById('edit-bet-success');
  const submitBtn = event.target.querySelector('button[type="submit"]');
  
  errorEl.classList.add('hidden');
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('bet_saving')}`;

  try {
    const updatedBet = await firebaseUpdateBet(myBetData.id, {
      home_score_prediction: homeScore,
      away_score_prediction: awayScore
    });

    myBetData = updatedBet;

    // Update in groupBetsData (eigener Eintrag in der Gruppen-Wetten-Liste)
    const groupBetIndex = groupBetsData.findIndex(b => b.id === myBetData.id);
    if (groupBetIndex !== -1) {
      groupBetsData[groupBetIndex] = { ...groupBetsData[groupBetIndex], ...myBetData };
    }

    // Siehe gleicher Kommentar in handlePlaceBet() weiter oben
    userBetsMap[currentGameData.id] = updatedBet;
    if (typeof renderGames === 'function') renderGames();

    successEl.classList.remove('hidden');

    setTimeout(() => {
      closeEditBetModal();
      renderGameDetail();
    }, 1500);
  } catch (error) {
    console.error('Error updating bet:', error);
    errorEl.textContent = error.message || t('error_updating_bet');
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = t('btn_save_changes');
  }
}

// Handle delete bet
async function handleDeleteBet() {
  if (!myBetData) return;
  
  try {
    await firebaseDeleteBet(myBetData.id);

    // Entferne aus groupBetsData
    groupBetsData = groupBetsData.filter(b => b.id !== myBetData.id);

    // Siehe gleicher Kommentar in handlePlaceBet() weiter oben
    delete userBetsMap[currentGameData.id];
    if (typeof renderGames === 'function') renderGames();

    myBetData = null;

    // Lade Seite neu
    renderGameDetail();
  } catch (error) {
    console.error('Error deleting bet:', error);
    alert(error.message || t('error_deleting_bet'));
  }
}

// Kein eigener DOMContentLoaded-Listener mehr - diese Datei läuft jetzt als
// In-Page-Ansicht innerhalb von games.html, dessen eigener Listener
// (games.js) bereits Firebase initialisiert und Auth prüft. Aufgerufen wird
// diese Ansicht über openGameDetail() in games.js.
