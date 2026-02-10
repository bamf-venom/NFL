// Admin page logic

let adminGames = [];
let adminUsers = [];
let currentTab = 'games';
let editingGame = null;

// Initialize admin page
async function initAdminPage() {
  // Check if user is admin
  if (!currentUser?.is_admin) {
    window.location.href = 'games.html';
    return;
  }
  
  // Populate team selects first (before loading data)
  populateTeamSelects();
  await loadAdminData();
}

// Load admin data from Firebase
async function loadAdminData() {
  try {
    const [games, users] = await Promise.all([
      firebaseGetGames(),
      firebaseGetAllUsers()
    ]);
    
    adminGames = games;
    adminUsers = users;
    
    // Update counts
    document.getElementById('games-count').textContent = adminGames.length;
    document.getElementById('users-count').textContent = adminUsers.length;
    
    renderAdminGames();
    renderAdminUsers();
  } catch (error) {
    console.error('Error loading admin data:', error);
    document.getElementById('admin-games-container').innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-exclamation-triangle fa-3x empty-icon" style="color: var(--error);"></i>
        <h3 class="empty-title">Fehler beim Laden</h3>
        <p class="empty-text">Die Daten konnten nicht geladen werden.</p>
        <button class="btn btn-primary" onclick="loadAdminData()">Erneut versuchen</button>
      </div>
    `;
  }
}

// Populate team selects
function populateTeamSelects() {
  const homeSelect = document.getElementById('home-team-select');
  const awaySelect = document.getElementById('away-team-select');
  
  // Check if elements exist
  if (!homeSelect || !awaySelect) {
    console.error('Team select elements not found');
    return;
  }
  
  // Check if NFL_TEAMS is defined
  if (typeof NFL_TEAMS === 'undefined' || !NFL_TEAMS || NFL_TEAMS.length === 0) {
    console.error('NFL_TEAMS is not defined or empty');
    return;
  }
  
  // Clear existing options
  homeSelect.innerHTML = '<option value="">Team wählen...</option>';
  awaySelect.innerHTML = '<option value="">Team wählen...</option>';
  
  console.log('Populating team selects with', NFL_TEAMS.length, 'teams');
  
  NFL_TEAMS.forEach(team => {
    const homeOption = document.createElement('option');
    homeOption.value = team.abbr;
    homeOption.textContent = `${team.abbr} - ${team.name}`;
    homeSelect.appendChild(homeOption);
    
    const awayOption = document.createElement('option');
    awayOption.value = team.abbr;
    awayOption.textContent = `${team.abbr} - ${team.name}`;
    awaySelect.appendChild(awayOption);
  });
  
  console.log('Team selects populated successfully');
}

// Switch tab
function switchTab(tab) {
  currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-testid="tab-${tab}"]`).classList.add('active');
  
  // Show/hide content
  document.getElementById('games-tab').classList.toggle('hidden', tab !== 'games');
  document.getElementById('users-tab').classList.toggle('hidden', tab !== 'users');
}

// Render admin games
function renderAdminGames() {
  const container = document.getElementById('admin-games-container');
  
  if (adminGames.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <p style="color: var(--muted);">Noch keine Spiele vorhanden</p>
      </div>
    `;
    return;
  }
  
  let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
  
  adminGames.forEach((game, index) => {
    const status = game.status === 'finished' ? 'Beendet' : game.status === 'live' ? 'Live' : 'Geplant';
    const statusClass = game.status === 'finished' ? 'badge-success' : game.status === 'live' ? 'badge-warning' : 'badge-default';
    
    html += `
      <div class="card admin-game-card" 
           style="animation: fadeIn 0.3s ease-out ${index * 0.03}s both;"
           data-testid="admin-game-${game.id}">
        <div class="admin-game-info">
          <span class="badge ${statusClass}">${status}</span>
          <div class="admin-game-teams">
            ${getTeamLogoHTML(game.home_team_abbr, 32)}
            <span style="font-weight: 500;">vs</span>
            ${getTeamLogoHTML(game.away_team_abbr, 32)}
          </div>
          <div>
            <div class="admin-game-details">${game.home_team_abbr} vs ${game.away_team_abbr}</div>
            <div class="admin-game-meta">Woche ${game.week} • ${new Date(game.game_date).toLocaleDateString('de-DE')}</div>
          </div>
        </div>
        
        <div class="admin-game-actions">
          ${game.status === 'finished' ? `
            <div class="admin-game-score">${game.home_score} : ${game.away_score}</div>
          ` : ''}
          <div class="admin-game-buttons">
            <button class="btn btn-secondary btn-sm" onclick="openEditScoreModal('${game.id}')" data-testid="edit-game-${game.id}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="handleDeleteGame('${game.id}')" data-testid="delete-game-${game.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Render admin users
function renderAdminUsers() {
  const container = document.getElementById('admin-users-container');
  
  let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
  
  adminUsers.forEach((user, index) => {
    html += `
      <div class="card user-card" 
           style="animation: fadeIn 0.3s ease-out ${index * 0.03}s both;"
           data-testid="user-${user.id}">
        <div class="user-card-info">
          <div class="user-card-avatar">${user.username.charAt(0).toUpperCase()}</div>
          <div>
            <div class="user-card-name">
              ${user.username}
              ${user.is_admin ? '<span class="badge badge-warning">Admin</span>' : ''}
            </div>
            <div class="user-card-email">${user.email}</div>
          </div>
        </div>
        <div class="user-card-actions">
          <div class="user-card-points">${user.total_points || 0} Pkt</div>
          ${!user.is_admin && user.id !== currentUser.id ? `
            <button class="btn btn-danger btn-sm" onclick="handleDeleteUser('${user.id}', '${user.username}')" data-testid="delete-user-${user.id}">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Open create game modal
function openCreateGameModal() {
  // Re-populate teams in case they weren't loaded initially
  populateTeamSelects();
  
  document.getElementById('create-game-modal').classList.add('active');
  document.getElementById('home-team-select').value = '';
  document.getElementById('away-team-select').value = '';
  document.getElementById('game-date-input').value = '';
  document.getElementById('game-week-input').value = '1';
  document.getElementById('game-season-input').value = '2025';
}

// Close create game modal
function closeCreateGameModal() {
  document.getElementById('create-game-modal').classList.remove('active');
}

// Handle create game
async function handleCreateGame(event) {
  event.preventDefault();
  
  const homeTeamAbbr = document.getElementById('home-team-select').value;
  const awayTeamAbbr = document.getElementById('away-team-select').value;
  const gameDate = document.getElementById('game-date-input').value;
  const week = parseInt(document.getElementById('game-week-input').value);
  const season = document.getElementById('game-season-input').value;
  
  const homeTeam = NFL_TEAMS.find(t => t.abbr === homeTeamAbbr);
  const awayTeam = NFL_TEAMS.find(t => t.abbr === awayTeamAbbr);
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird erstellt...';
  
  try {
    await firebaseCreateGame({
      home_team: homeTeam?.name || homeTeamAbbr,
      away_team: awayTeam?.name || awayTeamAbbr,
      home_team_abbr: homeTeamAbbr,
      away_team_abbr: awayTeamAbbr,
      game_date: gameDate,
      week: week,
      season: season
    });
    
    closeCreateGameModal();
    await loadAdminData();
  } catch (error) {
    console.error('Error creating game:', error);
    alert(error.message || 'Fehler beim Erstellen des Spiels');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Spiel erstellen';
  }
}

// Open edit score modal
function openEditScoreModal(gameId) {
  editingGame = adminGames.find(g => g.id === gameId);
  if (!editingGame) return;
  
  document.getElementById('edit-game-title').textContent = `${editingGame.home_team_abbr} vs ${editingGame.away_team_abbr}`;
  document.getElementById('edit-home-label').textContent = `${editingGame.home_team_abbr} Punkte`;
  document.getElementById('edit-away-label').textContent = `${editingGame.away_team_abbr} Punkte`;
  document.getElementById('edit-home-score').value = editingGame.home_score ?? '';
  document.getElementById('edit-away-score').value = editingGame.away_score ?? '';
  document.getElementById('edit-status').value = editingGame.status;
  
  document.getElementById('edit-score-modal').classList.add('active');
}

// Close edit score modal
function closeEditScoreModal() {
  document.getElementById('edit-score-modal').classList.remove('active');
  editingGame = null;
}

// Handle update score
async function handleUpdateScore(event) {
  event.preventDefault();
  
  if (!editingGame) return;
  
  const homeScore = parseInt(document.getElementById('edit-home-score').value);
  const awayScore = parseInt(document.getElementById('edit-away-score').value);
  const status = document.getElementById('edit-status').value;
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gespeichert...';
  
  try {
    await firebaseUpdateGame(editingGame.id, {
      home_score: homeScore,
      away_score: awayScore,
      status: status
    });
    
    closeEditScoreModal();
    await loadAdminData();
  } catch (error) {
    console.error('Error updating game:', error);
    alert(error.message || 'Fehler beim Aktualisieren des Spiels');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Speichern';
  }
}

// Handle delete game
async function handleDeleteGame(gameId) {
  if (!confirm('Spiel wirklich löschen? Alle Wetten gehen verloren!')) return;
  
  try {
    await firebaseDeleteGame(gameId);
    await loadAdminData();
  } catch (error) {
    console.error('Error deleting game:', error);
    alert(error.message || 'Fehler beim Löschen des Spiels');
  }
}

// Handle delete user
async function handleDeleteUser(userId, username) {
  if (!confirm(`Benutzer "${username}" wirklich löschen? Alle Daten werden gelöscht!`)) return;
  
  try {
    await firebaseDeleteUser(userId);
    await loadAdminData();
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(error.message || 'Fehler beim Löschen des Benutzers');
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
    initAdminPage();
  }
});
