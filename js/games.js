// Games page logic

let gamesData = [];
let userBetsMap = {}; // Map von game_id zu eigener Wette
let userGroups = []; // Gruppen des Users
let selectedWeek = null;
let selectedGroupId = null; // Gewählte Gruppe für Filter
let groupBetsMap = {}; // Map von game_id zu Array von Gruppen-Wetten

// Initialize games page
async function initGamesPage() {
  await loadGames();
  populateWeekFilter();
  
  // Week filter change
  document.getElementById('week-filter').addEventListener('change', function(e) {
    selectedWeek = e.target.value ? parseInt(e.target.value) : null;
    renderGames();
  });
  
  // Group filter change
  const groupFilter = document.getElementById('group-filter');
  if (groupFilter) {
    groupFilter.addEventListener('change', async function(e) {
      selectedGroupId = e.target.value || null;
      await loadGroupBets();
      renderGames();
    });
  }
}

// Load games from Firebase
async function loadGames() {
  try {
    // Lade Spiele, User-Wetten und Gruppen parallel
    const [games, userBets, groups] = await Promise.all([
      firebaseGetGames(),
      firebaseGetCurrentUserBets(),
      firebaseGetUserGroups()
    ]);
    
    gamesData = games;
    userGroups = groups;
    
    // Erstelle Map von game_id zu eigener Wette
    userBetsMap = {};
    userBets.forEach(bet => {
      userBetsMap[bet.game_id] = bet;
    });
    
    // Populate group filter
    populateGroupFilter();
    
    // Wenn User in Gruppen ist, lade Gruppen-Wetten
    if (userGroups.length > 0) {
      // Wähle erste Gruppe als Standard
      if (!selectedGroupId) {
        selectedGroupId = userGroups[0].id;
        const groupFilter = document.getElementById('group-filter');
        if (groupFilter) groupFilter.value = selectedGroupId;
      }
      await loadGroupBets();
    }
    
    renderGames();
  } catch (error) {
    console.error('Error loading games:', error);
    document.getElementById('games-container').innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-exclamation-triangle fa-3x empty-icon" style="color: var(--error);"></i>
        <h3 class="empty-title">Fehler beim Laden</h3>
        <p class="empty-text">Die Spiele konnten nicht geladen werden. Bitte versuche es erneut.</p>
        <button class="btn btn-primary" onclick="loadGames()">Erneut versuchen</button>
      </div>
    `;
  }
}

// Populate group filter
function populateGroupFilter() {
  const filterContainer = document.querySelector('.filter-container');
  
  // Entferne alten Group Filter falls vorhanden
  const oldGroupFilter = document.getElementById('group-filter');
  if (oldGroupFilter) oldGroupFilter.remove();
  
  // Nur anzeigen wenn User in mindestens einer Gruppe ist
  if (userGroups.length === 0) return;
  
  const groupFilterHTML = `
    <select id="group-filter" class="form-input" style="width: auto; min-width: 150px;" data-testid="group-filter">
      ${userGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
    </select>
  `;
  
  filterContainer.insertAdjacentHTML('beforeend', groupFilterHTML);
  
  // Event listener hinzufügen
  document.getElementById('group-filter').addEventListener('change', async function(e) {
    selectedGroupId = e.target.value || null;
    await loadGroupBets();
    renderGames();
  });
}

// Load bets from selected group
async function loadGroupBets() {
  if (!selectedGroupId) {
    groupBetsMap = {};
    return;
  }
  
  try {
    // Lade alle Wetten für jedes Spiel von der Gruppe
    groupBetsMap = {};
    
    for (const game of gamesData) {
      const bets = await firebaseGetGroupBets(selectedGroupId, game.id);
      if (bets.length > 0) {
        groupBetsMap[game.id] = bets;
      }
    }
  } catch (error) {
    console.error('Error loading group bets:', error);
    groupBetsMap = {};
  }
}

// Populate week filter
function populateWeekFilter() {
  const weeks = [...new Set(gamesData.map(g => g.week))].sort((a, b) => a - b);
  const filter = document.getElementById('week-filter');
  
  // Clear existing options except first
  filter.innerHTML = '<option value="">Alle Wochen</option>';
  
  weeks.forEach(week => {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = `Woche ${week}`;
    filter.appendChild(option);
  });
}

// Render games list
function renderGames() {
  const container = document.getElementById('games-container');
  const user = currentUser;
  
  let filteredGames = gamesData;
  if (selectedWeek) {
    filteredGames = gamesData.filter(g => g.week === selectedWeek);
  }
  
  if (filteredGames.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-calendar fa-3x empty-icon"></i>
        <h3 class="empty-title">Keine Spiele gefunden</h3>
        <p class="empty-text">
          ${user?.is_admin ? 'Als Admin kannst du neue Spiele hinzufügen.' : 'Es sind noch keine Spiele geplant.'}
        </p>
        ${user?.is_admin ? `
          <button class="btn btn-primary" onclick="window.location.href='admin.html'" data-testid="go-to-admin">
            Zum Admin Panel
          </button>
        ` : ''}
      </div>
    `;
    return;
  }
  
  // Group games by date
  const groupedGames = filteredGames.reduce((acc, game) => {
    const date = new Date(game.game_date).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(game);
    return acc;
  }, {});
  
  let html = '';
  
  Object.entries(groupedGames).forEach(([date, dateGames]) => {
    html += `
      <div class="games-date-group">
        <div class="date-header">
          <i class="fas fa-calendar"></i>
          ${formatDateOnly(date)}
        </div>
        <div class="games-list">
    `;
    
    dateGames.forEach(game => {
      const status = getStatusBadge(game.status);
      const isGameStarted = new Date(game.game_date) < new Date();
      const isBettingClosed = game.status === 'scheduled' && isGameStarted;
      const myBet = userBetsMap[game.id];
      const groupBets = groupBetsMap[game.id] || [];
      
      let badgeClass = status.class;
      let badgeText = status.text;
      
      if (isBettingClosed) {
        badgeClass = 'badge-warning';
        badgeText = 'GESCHLOSSEN';
      }
      
      html += `
        <div class="card card-hover game-card-expanded ${isBettingClosed ? 'opacity-70' : ''}" 
             data-testid="game-card-${game.id}">
          
          <!-- Game Header - klickbar -->
          <div class="game-card-header" onclick="window.location.href='game-detail.html?id=${game.id}'">
            <span class="badge ${badgeClass}">${badgeText}</span>
            
            <div class="game-teams">
              <div class="game-team home">
                <div class="team-info left">
                  <div class="team-abbr">${game.home_team_abbr}</div>
                  <div class="team-name">${game.home_team}</div>
                </div>
                ${getTeamLogoHTML(game.home_team_abbr, 40)}
              </div>
              
              ${game.status === 'finished' || game.status === 'live' ? `
                <div class="game-score">
                  <span class="game-score-num">${game.home_score ?? '-'}</span>
                  <span class="game-score-sep">:</span>
                  <span class="game-score-num">${game.away_score ?? '-'}</span>
                </div>
              ` : `
                <div class="game-time">
                  <i class="fas fa-clock"></i>
                  <span>${formatTime(game.game_date)}</span>
                </div>
              `}
              
              <div class="game-team away">
                ${getTeamLogoHTML(game.away_team_abbr, 40)}
                <div class="team-info right">
                  <div class="team-abbr">${game.away_team_abbr}</div>
                  <div class="team-name">${game.away_team}</div>
                </div>
              </div>
            </div>
            
            <i class="fas fa-chevron-right game-arrow"></i>
          </div>
          
          <!-- Gruppen-Wetten Bereich - nur wenn User in einer Gruppe ist -->
          ${userGroups.length > 0 ? `
            <div class="group-bets-section">
              ${groupBets.length === 0 ? `
                <div class="no-group-bets">
                  <i class="fas fa-users"></i>
                  <span>Noch keine Wetten in der Gruppe</span>
                </div>
              ` : `
                <div class="group-bets-list">
                  ${groupBets.map(bet => `
                    <div class="group-bet-item ${bet.user_id === currentUser?.id ? 'own' : ''}" data-testid="group-bet-${bet.id}">
                      <div class="group-bet-user">
                        <div class="group-bet-avatar">${bet.username.charAt(0).toUpperCase()}</div>
                        <span class="group-bet-username">${bet.username}</span>
                      </div>
                      <div class="group-bet-prediction">
                        ${bet.home_score_prediction} : ${bet.away_score_prediction}
                      </div>
                      ${game.status === 'finished' ? `
                        <div class="group-bet-points ${bet.points_earned > 0 ? 'earned' : ''}">
                          ${bet.points_earned || 0}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          ` : ''}
        </div>
      `;
    });
    
    html += '</div></div>';
  });
  
  container.innerHTML = html;
}

// Run on page load
document.addEventListener('DOMContentLoaded', async function() {
  // Initialize Firebase first
  if (typeof initializeFirebase === 'function') {
    initializeFirebase();
  }
  
  const isAuthed = await checkAuth();
  if (isAuthed) {
    initGamesPage();
  }
});
