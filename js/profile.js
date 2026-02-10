// Profile page logic

let myBets = [];
let gamesData = [];

// Initialize profile page
async function initProfilePage() {
  await loadProfile();
  await loadMyBets();
}

// Load profile data from Firebase
async function loadProfile() {
  try {
    gamesData = await firebaseGetGames();
  } catch (error) {
    console.error('Error loading games:', error);
    gamesData = [];
  }
}

// Load user bets from Firebase
async function loadMyBets() {
  try {
    myBets = await firebaseGetUserBets(currentUser.id);
    renderProfile();
  } catch (error) {
    console.error('Error loading bets:', error);
    myBets = [];
    renderProfile();
  }
}

// Render profile
function renderProfile() {
  const container = document.getElementById('profile-container');
  const user = currentUser;
  
  // Calculate stats
  const totalPoints = myBets.reduce((sum, bet) => sum + (bet.points_earned || 0), 0);
  const correctWinners = myBets.filter(bet => bet.points_earned > 0).length;
  const correctScores = myBets.filter(bet => bet.points_earned >= 3).length;
  
  // Nur offene Wetten (Spiele die noch nicht beendet sind)
  const openBets = myBets.filter(bet => {
    const game = gamesData.find(g => g.id === bet.game_id);
    return game && game.status !== 'finished';
  });
  
  let html = `
    <!-- Profile Header -->
    <div class="card profile-header animate-fade-in">
      <div class="profile-avatar">
        <i class="fas fa-user fa-2x"></i>
      </div>
      <h1 class="profile-username" data-testid="profile-username">${user.username}</h1>
      <p class="profile-email">${user.email}</p>
      ${user.is_admin ? '<span class="profile-badge">Admin</span>' : ''}
    </div>
    
    <!-- Stats -->
    <div class="stats-grid">
      <div class="card stat-card animate-fade-in" style="animation-delay: 0.1s;">
        <i class="fas fa-trophy fa-lg stat-icon"></i>
        <div class="stat-value" data-testid="total-points">${totalPoints}</div>
        <div class="stat-label">Punkte</div>
      </div>
      
      <div class="card stat-card animate-fade-in" style="animation-delay: 0.15s;">
        <i class="fas fa-bullseye fa-lg stat-icon"></i>
        <div class="stat-value" data-testid="total-bets">${myBets.length}</div>
        <div class="stat-label">Wetten</div>
      </div>
      
      <div class="card stat-card animate-fade-in" style="animation-delay: 0.2s;">
        <i class="fas fa-calendar-check fa-lg stat-icon"></i>
        <div class="stat-value" data-testid="correct-winners">${correctWinners}</div>
        <div class="stat-label">Richtig</div>
      </div>
    </div>
    
    <!-- Open Bets Only -->
    <div class="card animate-fade-in" style="margin-top: 24px; animation-delay: 0.25s;">
      <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">
        <i class="fas fa-clock" style="margin-right: 8px; color: var(--warning);"></i>
        Offene Wetten (${openBets.length})
      </h3>
      
      ${openBets.length === 0 ? `
        <p style="text-align: center; color: var(--muted); padding: 32px 0;">
          Keine offenen Wetten vorhanden
        </p>
      ` : `
        <div class="bets-list">
          ${openBets.map(bet => {
            const game = gamesData.find(g => g.id === bet.game_id);
            
            return `
              <div class="bet-item" 
                   onclick="window.location.href='game-detail.html?id=${bet.game_id}'" 
                   style="cursor: pointer;"
                   data-testid="my-bet-${bet.id}">
                <div>
                  <div style="font-weight: 500;">
                    ${game ? `${game.home_team_abbr} vs ${game.away_team_abbr}` : 'Spiel'}
                  </div>
                  <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                    Tipp: ${bet.home_score_prediction} : ${bet.away_score_prediction}
                  </div>
                  ${game ? `
                    <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                      ${formatDate(game.game_date)}
                    </div>
                  ` : ''}
                </div>
                <div class="bet-earned" style="background: rgba(245, 158, 11, 0.15); color: var(--warning);">
                  ${game?.status === 'live' ? 'Live' : 'Offen'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
    
    <!-- Action Buttons -->
    <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 12px;" class="animate-fade-in" style="animation-delay: 0.3s;">
      <button class="btn btn-secondary btn-full" onclick="logout()" data-testid="logout-button">
        <i class="fas fa-sign-out-alt"></i>
        Abmelden
      </button>
      
      <button class="btn btn-danger btn-full" onclick="openDeleteModal()" data-testid="delete-account-button">
        <i class="fas fa-trash"></i>
        Account löschen
      </button>
    </div>
  `;
  
  container.innerHTML = html;
}

// Open delete modal
function openDeleteModal() {
  document.getElementById('delete-modal').classList.add('active');
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('delete-error').classList.add('hidden');
}

// Close delete modal
function closeDeleteModal() {
  document.getElementById('delete-modal').classList.remove('active');
}

// Confirm delete account
async function confirmDeleteAccount() {
  const confirmInput = document.getElementById('delete-confirm-input').value.toUpperCase();
  const errorEl = document.getElementById('delete-error');
  const submitBtn = document.querySelector('#delete-modal button.btn-danger');
  
  if (confirmInput !== 'LÖSCHEN') {
    errorEl.textContent = 'Bitte gib "LÖSCHEN" ein um zu bestätigen';
    errorEl.classList.remove('hidden');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gelöscht...';
  
  try {
    await firebaseDeleteAccount();
    logout();
  } catch (error) {
    console.error('Error deleting account:', error);
    errorEl.textContent = error.message || 'Fehler beim Löschen des Accounts';
    errorEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Account löschen';
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
    initProfilePage();
  }
});
