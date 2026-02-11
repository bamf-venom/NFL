// Group detail page logic

let currentGroupData = null;
let groupLeaderboardData = [];
let groupBetsData = {};
let gamesData = [];
let currentTab = 'members';
let copied = false;

// Initialize group detail page
async function initGroupDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get('id');
  
  if (!groupId) {
    window.location.href = 'groups.html';
    return;
  }
  
  await loadGroupDetail(groupId);
}

// Load group detail from Firebase
async function loadGroupDetail(groupId) {
  try {
    const [group, games] = await Promise.all([
      firebaseGetGroup(groupId),
      firebaseGetGames()
    ]);
    
    currentGroupData = group;
    gamesData = games;
    
    if (!currentGroupData) {
      document.getElementById('group-detail-container').innerHTML = `
        <div class="card empty-state">
          <h3 class="empty-title">Gruppe nicht gefunden</h3>
          <a href="groups.html" class="btn btn-primary" style="margin-top: 16px;">Zurück zu Gruppen</a>
        </div>
      `;
      return;
    }
    
    // Load group leaderboard
    await loadGroupLeaderboard();
    
    // Load bets for games
    await loadGroupBets();
    
    renderGroupDetail();
  } catch (error) {
    console.error('Error loading group:', error);
    document.getElementById('group-detail-container').innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-exclamation-triangle fa-3x empty-icon" style="color: var(--error);"></i>
        <h3 class="empty-title">Fehler beim Laden</h3>
        <p class="empty-text">Die Gruppe konnte nicht geladen werden.</p>
        <button class="btn btn-primary" onclick="location.reload()">Erneut versuchen</button>
      </div>
    `;
  }
}

// Load group leaderboard from Firebase
async function loadGroupLeaderboard() {
  try {
    groupLeaderboardData = await firebaseGetGroupLeaderboard(currentGroupData.id);
  } catch (error) {
    console.error('Error loading group leaderboard:', error);
    groupLeaderboardData = [];
  }
}

// Load group bets for games from Firebase
async function loadGroupBets() {
  groupBetsData = {};
  
  // Load bets for first 10 games
  const gamesToLoad = gamesData.slice(0, 10);
  
  for (const game of gamesToLoad) {
    try {
      groupBetsData[game.id] = await firebaseGetGroupBets(currentGroupData.id, game.id);
    } catch (error) {
      console.error(`Error loading bets for game ${game.id}:`, error);
      groupBetsData[game.id] = [];
    }
  }
}

// Switch tab
function switchGroupTab(tab) {
  currentTab = tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-testid="tab-${tab}"]`).classList.add('active');
  
  renderTabContent();
}

// Copy invite code
function copyInviteCode() {
  navigator.clipboard.writeText(currentGroupData.invite_code);
  copied = true;
  renderGroupDetail();
  setTimeout(() => {
    copied = false;
    renderGroupDetail();
  }, 2000);
}

// Copy invite link
function copyInviteLink() {
  const link = `${window.location.origin}/Web/pages/group-join.html?code=${currentGroupData.invite_code}`;
  navigator.clipboard.writeText(link);
  copied = true;
  renderGroupDetail();
  setTimeout(() => {
    copied = false;
    renderGroupDetail();
  }, 2000);
}

// Kick member
async function kickMember(userId, username) {
  if (!confirm(`${username} wirklich aus der Gruppe entfernen?`)) return;
  
  try {
    await firebaseKickMember(currentGroupData.id, userId);
    
    // Reload group data
    currentGroupData = await firebaseGetGroup(currentGroupData.id);
    await loadGroupLeaderboard();
    await loadGroupBets();
    renderGroupDetail();
  } catch (error) {
    console.error('Error kicking member:', error);
    alert(error.message || 'Fehler beim Entfernen des Mitglieds');
  }
}

// Open delete group modal
function openDeleteGroupModal() {
  document.getElementById('delete-group-text').textContent = 
    `Bist du sicher, dass du die Gruppe "${currentGroupData.name}" löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.`;
  document.getElementById('delete-group-modal').classList.add('active');
}

// Close delete group modal
function closeDeleteGroupModal() {
  document.getElementById('delete-group-modal').classList.remove('active');
}

// Confirm delete group
async function confirmDeleteGroup() {
  try {
    await firebaseDeleteGroup(currentGroupData.id);
    window.location.href = 'groups.html';
  } catch (error) {
    console.error('Error deleting group:', error);
    alert(error.message || 'Fehler beim Löschen der Gruppe');
  }
}

// Open leave group modal
function openLeaveGroupModal() {
  document.getElementById('leave-group-text').textContent = 
    `Bist du sicher, dass du die Gruppe "${currentGroupData.name}" verlassen möchtest?`;
  document.getElementById('leave-group-modal').classList.add('active');
}

// Close leave group modal
function closeLeaveGroupModal() {
  document.getElementById('leave-group-modal').classList.remove('active');
}

// Confirm leave group
async function confirmLeaveGroup() {
  try {
    await firebaseLeaveGroup(currentGroupData.id);
    window.location.href = 'groups.html';
  } catch (error) {
    console.error('Error leaving group:', error);
    alert(error.message || 'Fehler beim Verlassen der Gruppe');
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

// Render group detail
function renderGroupDetail() {
  const container = document.getElementById('group-detail-container');
  const group = currentGroupData;
  const isAdmin = group.admin_id === currentUser.id;
  const memberCount = group.members?.length || group.member_ids?.length || 1;
  
  let html = `
    <!-- Group Header -->
    <div class="card group-header-card animate-fade-in">
      <div class="group-header-info">
        <div class="group-header-avatar">
          <i class="fas fa-users fa-lg"></i>
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1 class="group-header-name" data-testid="group-name">${group.name}</h1>
            ${isAdmin ? `
              <button class="btn btn-ghost btn-sm" onclick="openEditNameModal()" data-testid="edit-name-btn" title="Name ändern">
                <i class="fas fa-edit"></i>
              </button>
            ` : ''}
          </div>
          <div class="group-header-meta">
            ${memberCount} Mitglied${memberCount !== 1 ? 'er' : ''}
            ${isAdmin ? '<span class="badge badge-warning">Admin</span>' : ''}
          </div>
        </div>
      </div>
      
      <div class="group-invite">
        <div class="group-invite-label">Einladungscode</div>
        <div class="group-invite-code">
          <span class="invite-code" data-testid="invite-code">${group.invite_code}</span>
          <button class="btn btn-ghost btn-sm" onclick="copyInviteCode()" data-testid="copy-code-btn">
            <i class="fas ${copied ? 'fa-check text-success' : 'fa-copy'}"></i>
          </button>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="copyInviteLink()" data-testid="copy-link-btn">
          <i class="fas fa-link"></i>
          Link kopieren
        </button>
      </div>
    </div>
    
    <!-- Tabs -->
    <div class="tabs" style="margin-top: 24px;">
      <button class="tab-btn ${currentTab === 'members' ? 'active' : ''}" onclick="switchGroupTab('members')" data-testid="tab-members">
        <i class="fas fa-users"></i>
        Mitglieder
      </button>
      <button class="tab-btn ${currentTab === 'leaderboard' ? 'active' : ''}" onclick="switchGroupTab('leaderboard')" data-testid="tab-leaderboard">
        <i class="fas fa-trophy"></i>
        Rangliste
      </button>
      <button class="tab-btn ${currentTab === 'bets' ? 'active' : ''}" onclick="switchGroupTab('bets')" data-testid="tab-bets">
        <i class="fas fa-bullseye"></i>
        Wetten
      </button>
    </div>
    
    <!-- Tab Content -->
    <div id="tab-content" style="margin-top: 24px;"></div>
    
    <!-- Actions -->
    <div style="margin-top: 24px;">
      ${isAdmin ? `
        <button class="btn btn-danger btn-full" onclick="openDeleteGroupModal()" data-testid="delete-group-btn">
          <i class="fas fa-trash"></i>
          Gruppe löschen
        </button>
      ` : `
        <button class="btn btn-danger btn-full" onclick="openLeaveGroupModal()" data-testid="leave-group-btn">
          <i class="fas fa-sign-out-alt"></i>
          Gruppe verlassen
        </button>
      `}
    </div>
  `;
  
  container.innerHTML = html;
  renderTabContent();
}

// Open edit name modal
function openEditNameModal() {
  document.getElementById('edit-name-input').value = currentGroupData.name;
  document.getElementById('edit-name-error').classList.add('hidden');
  document.getElementById('edit-name-modal').classList.add('active');
}

// Close edit name modal
function closeEditNameModal() {
  document.getElementById('edit-name-modal').classList.remove('active');
}

// Handle edit group name
async function handleEditGroupName(event) {
  event.preventDefault();
  
  const newName = document.getElementById('edit-name-input').value.trim();
  const errorEl = document.getElementById('edit-name-error');
  const submitBtn = event.target.querySelector('button[type="submit"]');
  
  if (newName.length < 2) {
    errorEl.textContent = 'Name muss mindestens 2 Zeichen haben';
    errorEl.classList.remove('hidden');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gespeichert...';
  
  try {
    currentGroupData = await firebaseUpdateGroupName(currentGroupData.id, newName);
    closeEditNameModal();
    renderGroupDetail();
  } catch (error) {
    console.error('Error updating group name:', error);
    errorEl.textContent = error.message || 'Fehler beim Ändern des Namens';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Speichern';
  }
}

// Render tab content
function renderTabContent() {
  const tabContent = document.getElementById('tab-content');
  const group = currentGroupData;
  const isAdmin = group.admin_id === currentUser.id;
  
  if (currentTab === 'members') {
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    (group.members || []).forEach((member, i) => {
      const isOwn = member.user_id === currentUser.id;
      const isMemberAdmin = member.user_id === group.admin_id;
      
      // Profile picture or initial
      const avatarContent = member.profile_picture 
        ? `<img src="${member.profile_picture}" alt="${member.username}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
        : member.username.charAt(0).toUpperCase();
      
      html += `
        <div class="card member-item ${isOwn ? 'own' : ''}" 
             style="animation: fadeIn 0.3s ease-out ${i * 0.05}s both;"
             data-testid="member-${member.user_id}">
          <div class="member-info">
            <div class="member-avatar" style="overflow: hidden;">${avatarContent}</div>
            <div>
              <div class="member-name">
                ${member.username}
                ${isOwn ? '<span style="font-size: 12px; padding: 2px 8px; background: rgba(255,255,255,0.1); border-radius: 4px;">Du</span>' : ''}
                ${isMemberAdmin ? '<i class="fas fa-crown" style="color: #fbbf24;"></i>' : ''}
              </div>
              <div class="member-joined">Beigetreten ${new Date(member.joined_at).toLocaleDateString('de-DE')}</div>
            </div>
          </div>
          ${isAdmin && !isOwn ? `
            <button class="btn btn-ghost btn-sm" onclick="kickMember('${member.user_id}', '${member.username}')" data-testid="kick-${member.user_id}">
              <i class="fas fa-user-minus" style="color: var(--error);"></i>
            </button>
          ` : ''}
        </div>
      `;
    });
    
    html += '</div>';
    tabContent.innerHTML = html;
  }
  
  else if (currentTab === 'leaderboard') {
    if (groupLeaderboardData.length === 0) {
      tabContent.innerHTML = `
        <div class="card empty-state">
          <i class="fas fa-trophy fa-2x" style="color: var(--muted); margin-bottom: 8px;"></i>
          <p style="color: var(--muted);">Noch keine Wetten ausgewertet</p>
        </div>
      `;
      return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    groupLeaderboardData.forEach((entry, index) => {
      const medalColor = getMedalColor(index);
      const isOwn = entry.user_id === currentUser?.id;
      
      html += `
        <div class="card leaderboard-entry ${isOwn ? 'own' : ''}" 
             style="animation: fadeIn 0.3s ease-out ${index * 0.05}s both;"
             data-testid="leaderboard-${index}">
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
    tabContent.innerHTML = html;
  }
  
  else if (currentTab === 'bets') {
    if (gamesData.length === 0) {
      tabContent.innerHTML = `
        <div class="card empty-state">
          <p style="color: var(--muted);">Keine Spiele vorhanden</p>
        </div>
      `;
      return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 24px;">';
    
    gamesData.slice(0, 10).forEach(game => {
      const bets = groupBetsData[game.id] || [];
      
      html += `
        <div class="card" data-testid="game-bets-${game.id}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <div style="font-weight: 600;">${game.home_team_abbr} vs ${game.away_team_abbr}</div>
              <div style="font-size: 12px; color: var(--muted);">Woche ${game.week} • ${new Date(game.game_date).toLocaleDateString('de-DE')}</div>
            </div>
            ${game.status === 'finished' ? `
              <div style="font-size: 18px; font-weight: 700;">${game.home_score} : ${game.away_score}</div>
            ` : ''}
          </div>
          
          ${bets.length === 0 ? `
            <p style="font-size: 14px; color: var(--muted); text-align: center; padding: 8px 0;">Keine Wetten</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${bets.map(bet => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 8px; background: ${bet.user_id === currentUser.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'};">
                  <span style="font-size: 14px;">${bet.username}</span>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-weight: 500;">${bet.home_score_prediction} : ${bet.away_score_prediction}</span>
                    ${game.status === 'finished' ? `
                      <span style="font-size: 14px; color: ${bet.points_earned > 0 ? 'var(--success)' : 'var(--muted)'};">
                        ${bet.points_earned || 0} Pkt
                      </span>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    });
    
    html += '</div>';
    tabContent.innerHTML = html;
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
    initGroupDetailPage();
  }
});
