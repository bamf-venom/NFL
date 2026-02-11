// Leaderboard page logic

let leaderboardData = [];
let userGroups = [];
let selectedGroup = 'global';

// Initialize leaderboard page
async function initLeaderboardPage() {
  await loadGroups();
  await loadLeaderboard();
  
  // Group filter change
  document.getElementById('group-filter').addEventListener('change', async function(e) {
    selectedGroup = e.target.value;
    updateGroupInfo();
    
    // Zeige Loading-Spinner während Daten geladen werden
    document.getElementById('leaderboard-container').innerHTML = `
      <div class="loading-container">
        <div class="spinner spinner-lg"></div>
      </div>
    `;
    
    await loadLeaderboard();
  });
}

// Load user groups from Firebase
async function loadGroups() {
  try {
    userGroups = await firebaseGetUserGroups();
    
    // Populate filter
    const filter = document.getElementById('group-filter');
    filter.innerHTML = '<option value="global">Global</option>';
    
    userGroups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      filter.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

// Update group info display
function updateGroupInfo() {
  const infoEl = document.getElementById('group-info');
  const nameEl = document.getElementById('group-name');
  
  if (selectedGroup !== 'global') {
    const group = userGroups.find(g => g.id === selectedGroup);
    nameEl.textContent = group?.name || '';
    infoEl.classList.remove('hidden');
    infoEl.style.display = 'flex';
  } else {
    infoEl.classList.add('hidden');
    infoEl.style.display = 'none';
  }
}

// Load leaderboard data from Firebase
async function loadLeaderboard() {
  try {
    // Invalidiere den Cache beim Wechseln der Gruppe, um frische Daten zu bekommen
    if (typeof invalidateCache === 'function') {
      invalidateCache('leaderboard');
    }
    
    if (selectedGroup === 'global') {
      leaderboardData = await firebaseGetLeaderboard(false); // false = kein Cache
    } else {
      leaderboardData = await firebaseGetGroupLeaderboard(selectedGroup);
    }
    
    renderLeaderboard();
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    document.getElementById('leaderboard-container').innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-exclamation-triangle fa-3x empty-icon" style="color: var(--error);"></i>
        <h3 class="empty-title">Fehler beim Laden</h3>
        <p class="empty-text">Die Rangliste konnte nicht geladen werden.</p>
        <button class="btn btn-primary" onclick="loadLeaderboard()">Erneut versuchen</button>
      </div>
    `;
  }
}

// Get medal color
function getMedalColor(index) {
  switch (index) {
    case 0: return 'gold';
    case 1: return 'silver';
    case 2: return 'bronze';
    default: return null;
  }
}

// Render leaderboard
function renderLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  
  if (leaderboardData.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-trophy fa-3x empty-icon"></i>
        <h3 class="empty-title">Noch keine Daten</h3>
        <p class="empty-text">
          ${selectedGroup === 'global' 
            ? 'Die Rangliste wird gefüllt sobald Wetten ausgewertet werden.'
            : 'Diese Gruppe hat noch keine ausgewerteten Wetten.'}
        </p>
      </div>
    `;
    return;
  }
  
  let html = '<div class="leaderboard-list">';
  
  leaderboardData.forEach((entry, index) => {
    const medalColor = getMedalColor(index);
    const isOwn = entry.user_id === currentUser?.id;
    
    html += `
      <div class="card leaderboard-entry ${isOwn ? 'own' : ''}" 
           style="animation: fadeIn 0.3s ease-out ${index * 0.05}s both;"
           data-testid="leaderboard-entry-${index}">
        <div class="leaderboard-rank">
          ${medalColor ? `
            <div class="leaderboard-medal ${medalColor}">
              <i class="fas fa-medal"></i>
            </div>
          ` : `
            <div class="leaderboard-rank-num">${index + 1}</div>
          `}
        </div>
        
        <div class="leaderboard-user">
          <div class="leaderboard-username">
            ${entry.username}
            ${isOwn ? '<span class="leaderboard-you">Du</span>' : ''}
          </div>
          <div class="leaderboard-stats">
            <span class="leaderboard-stat">
              <i class="fas fa-bullseye"></i>
              ${entry.total_bets} Wetten
            </span>
            <span class="leaderboard-stat">
              <i class="fas fa-chart-line"></i>
              ${entry.correct_winners} Richtig
            </span>
          </div>
        </div>
        
        <div class="leaderboard-points">
          <div class="leaderboard-points-num">${entry.total_points}</div>
          <div class="leaderboard-points-label">Punkte</div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
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
    initLeaderboardPage();
  }
});
