// Game detail page logic

let currentGameData = null;
let groupBetsData = []; // Wetten der Mitglieder der ausgewählten Gruppe (nicht mehr "alle Wetten global")
let myBetData = null;
let userGroups = [];
let selectedGroupId = null;

// Initialize game detail page
async function initGameDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('id');

  if (!gameId) {
    window.location.href = 'games.html';
    return;
  }

  await loadGameDetail(gameId);
}

// Load game detail from Firebase
async function loadGameDetail(gameId) {
  try {
    // Spiel, eigene Wette (nur die eine, nicht alle Wetten im System) und die
    // eigenen Gruppen unabhängig voneinander parallel laden
    const [game, myBet, groups] = await Promise.all([
      firebaseGetGame(gameId),
      firebaseGetUserBetForGame(currentUser.id, gameId),
      firebaseGetUserGroups()
    ]);

    currentGameData = game;

    if (!currentGameData) {
      document.getElementById('game-detail-container').innerHTML = `
        <div class="card empty-state">
          <h3 class="empty-title">Spiel nicht gefunden</h3>
          <a href="games.html" class="btn btn-primary" style="margin-top: 16px;">Zurück zu Spielen</a>
        </div>
      `;
      return;
    }

    myBetData = myBet;
    userGroups = groups;

    // Gruppe auswählen: zuletzt auf der Spiele-Seite gewählte Gruppe falls noch
    // gültig, sonst die erste eigene Gruppe. Ohne Gruppen gibt es nichts zu wählen.
    if (userGroups.length > 0) {
      let preferredGroupId = null;
      try {
        const savedFilter = JSON.parse(localStorage.getItem('nflpoints_games_filter') || '{}');
        preferredGroupId = savedFilter.groupId || null;
      } catch (e) { /* ignore */ }

      selectedGroupId = userGroups.find(g => g.id === preferredGroupId)
        ? preferredGroupId
        : userGroups[0].id;

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
        <h3 class="empty-title">Fehler beim Laden</h3>
        <p class="empty-text">Das Spiel konnte nicht geladen werden.</p>
        <button class="btn btn-primary" onclick="location.reload()">Erneut versuchen</button>
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
    groupBetsData = await firebaseGetGroupBets(selectedGroupId, currentGameData.id);
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
    ? `<i class="fas fa-lock lock-icon locked" title="Tipp gesperrt - Spiel läuft/ist beendet"></i>`
    : `<i class="fas fa-lock-open lock-icon open" title="Tipp noch möglich"></i>`;

  // Badge zeigt den tatsächlichen Status - aber wenn die Sperrfrist erreicht ist und die
  // DB das (noch) nicht mitbekommen hat ("scheduled"), zeigen wir "GESPERRT" in rot
  let badgeClass = status.class;
  let badgeText = status.text;
  if (isBettingClosed) {
    badgeClass = 'badge-error';
    badgeText = 'GESPERRT';
  }

  let html = `
    <!-- Game Header -->
    <div class="card game-detail-header animate-fade-in" style="--home-color: ${TEAM_COLORS[game.home_team_abbr] || 'var(--accent)'}; --away-color: ${TEAM_COLORS[game.away_team_abbr] || 'var(--accent)'};">
      <div class="badge-lock-group" style="justify-content: center; margin-bottom: 16px;">
        <span class="badge ${badgeClass}">
          ${badgeText}
        </span>
        ${lockIconHTML}
      </div>

      <div class="game-detail-teams">
        <!-- Home Team -->
        <div class="game-detail-team">
          ${getTeamLogoHTML(game.home_team_abbr, 80)}
          <h3 data-testid="home-team-name">${game.home_team}</h3>
        </div>
        
        <!-- Score or VS -->
        ${game.status === 'finished' || game.status === 'live' ? `
          <div class="game-detail-score">
            <span class="game-detail-score-num" data-testid="home-score">${game.home_score ?? '-'}</span>
            <span class="game-detail-score-sep">:</span>
            <span class="game-detail-score-num" data-testid="away-score">${game.away_score ?? '-'}</span>
          </div>
        ` : `
          <div class="game-detail-vs">VS</div>
        `}
        
        <!-- Away Team -->
        <div class="game-detail-team">
          ${getTeamLogoHTML(game.away_team_abbr, 80)}
          <h3 data-testid="away-team-name">${game.away_team}</h3>
        </div>
      </div>
      
      <div class="game-detail-info">
        <i class="fas fa-clock"></i>
        <span>Woche ${game.week} • ${formatDate(game.game_date)}</span>
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
            <h3>Wetten geschlossen</h3>
            <p>Das Spiel hat bereits begonnen. Wetten sind nicht mehr möglich.</p>
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
          Deine Wette platzieren
        </h3>
        
        <form onsubmit="handlePlaceBet(event)">
          <div class="bet-inputs">
            <div class="form-group">
              <label class="form-label">${game.home_team_abbr} Punkte</label>
              <input type="number" id="home-score-input" class="form-input" min="0" max="100" placeholder="0" required data-testid="home-score-input">
            </div>
            <div class="form-group">
              <label class="form-label">${game.away_team_abbr} Punkte</label>
              <input type="number" id="away-score-input" class="form-input" min="0" max="100" placeholder="0" required data-testid="away-score-input">
            </div>
          </div>
          
          <div id="bet-error" class="error-message hidden"></div>
          <div id="bet-success" class="success-message hidden">Wette erfolgreich platziert!</div>
          
          <button type="submit" id="bet-submit-btn" class="btn btn-primary btn-full" style="margin-top: 16px;" data-testid="submit-bet-button">
            Wette platzieren
          </button>
          
          <p class="bet-points-info">
            3 Punkte pro richtigem Team-Score • 1 Punkt für richtigen Gewinner
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
            Deine Wette
          </h3>
          <div style="display: flex; gap: 8px;">
            ${canEditBet ? `
              <button class="btn btn-secondary btn-sm" onclick="openEditBetModal()" data-testid="edit-bet-button">
                <i class="fas fa-edit"></i>
                Bearbeiten
              </button>
            ` : ''}
            ${canDeleteBet ? `
              <button class="btn btn-danger btn-sm" onclick="handleDeleteBet()" data-testid="delete-bet-button">
                <i class="fas fa-trash"></i>
                Löschen
              </button>
            ` : ''}
          </div>
        </div>
        
        <div class="my-bet-scores">
          <div class="my-bet-score">
            <div class="my-bet-score-num" data-testid="my-bet-home">${myBetData.home_score_prediction}</div>
            <div class="my-bet-score-team">${game.home_team_abbr}</div>
          </div>
          <div style="font-size: 24px; color: var(--muted);">:</div>
          <div class="my-bet-score">
            <div class="my-bet-score-num" data-testid="my-bet-away">${myBetData.away_score_prediction}</div>
            <div class="my-bet-score-team">${game.away_team_abbr}</div>
          </div>
        </div>
        
        ${game.status === 'finished' ? `
          <div class="my-bet-points">
            <div class="my-bet-points-label">Punkte erhalten</div>
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
        ${userGroups.map(g => `<option value="${g.id}" ${g.id === selectedGroupId ? 'selected' : ''}>${g.name}</option>`).join('')}
      </select>
    ` : `<span style="color: var(--muted); font-size: 14px;">${userGroups[0].name}</span>`;

    html += `
      <div class="card animate-fade-in" style="margin-top: 24px; animation-delay: 0.2s;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <h3 style="font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin: 0;">
            <i class="fas fa-users"></i>
            Wetten in der Gruppe (${groupBetsData.length})
          </h3>
          ${groupSelectorHTML}
        </div>

        <div id="group-bets-section-content">
          ${groupBetsData.length === 0 ? `
            <p style="text-align: center; color: var(--muted); padding: 32px 0;">
              Noch keine Wetten in dieser Gruppe für dieses Spiel
            </p>
          ` : `
            <div class="bets-list">
              ${groupBetsData.map((bet, i) => `
                <div class="bet-item ${bet.user_id === currentUser?.id ? 'own' : ''}"
                     style="animation: fadeIn 0.3s ease-out ${i * 0.05}s both;"
                     data-testid="bet-${bet.id}">
                  <div class="bet-user">
                    <div class="bet-avatar">${bet.username.charAt(0).toUpperCase()}</div>
                    <div>
                      <div class="bet-username">${bet.username}</div>
                      <div class="bet-date">${new Date(bet.created_at).toLocaleDateString('de-DE')}</div>
                    </div>
                  </div>

                  <div class="bet-prediction">
                    <span class="bet-prediction-score">${bet.home_score_prediction} : ${bet.away_score_prediction}</span>
                    ${game.status === 'finished' ? `
                      <span class="bet-earned ${bet.points_earned > 0 ? 'success' : 'none'}">
                        ${bet.points_earned || 0} Pkt
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
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird platziert...';
  
  try {
    const bet = await firebasePlaceBet({
      game_id: currentGameData.id,
      home_score_prediction: homeScore,
      away_score_prediction: awayScore
    });
    
    myBetData = bet;
    await loadGroupBetsForCurrentGame();

    successEl.classList.remove('hidden');

    setTimeout(() => {
      renderGameDetail();
    }, 1500);
  } catch (error) {
    console.error('Error placing bet:', error);
    errorEl.textContent = error.message || 'Fehler beim Platzieren der Wette';
    errorEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Wette platzieren';
  }
}

// Open edit bet modal
function openEditBetModal() {
  if (!myBetData) return;
  
  document.getElementById('edit-bet-teams').textContent = `${currentGameData.home_team_abbr} vs ${currentGameData.away_team_abbr}`;
  document.getElementById('edit-bet-home-label').textContent = `${currentGameData.home_team_abbr} Punkte`;
  document.getElementById('edit-bet-away-label').textContent = `${currentGameData.away_team_abbr} Punkte`;
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
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gespeichert...';
  
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

    successEl.classList.remove('hidden');
    
    setTimeout(() => {
      closeEditBetModal();
      renderGameDetail();
    }, 1500);
  } catch (error) {
    console.error('Error updating bet:', error);
    errorEl.textContent = error.message || 'Fehler beim Aktualisieren der Wette';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Änderungen speichern';
  }
}

// Handle delete bet
async function handleDeleteBet() {
  if (!myBetData) return;
  
  try {
    await firebaseDeleteBet(myBetData.id);

    // Entferne aus groupBetsData
    groupBetsData = groupBetsData.filter(b => b.id !== myBetData.id);
    myBetData = null;
    
    // Lade Seite neu
    renderGameDetail();
  } catch (error) {
    console.error('Error deleting bet:', error);
    alert(error.message || 'Fehler beim Löschen der Wette');
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', async function() {
  // Initialize Firebase first
  if (typeof initializeFirebase === 'function') {
    initializeFirebase();
  }
  
  const isAuthed = await checkAuth();
  if (isAuthed) {
    initGameDetailPage();
  }
});
