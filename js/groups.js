// Groups page logic

let userGroups = [];

// Initialize groups page
async function initGroupsPage() {
  await loadGroups();
}

// Load user groups from Firebase
async function loadGroups() {
  try {
    userGroups = await firebaseGetUserGroups();
    renderGroups();
  } catch (error) {
    console.error('Error loading groups:', error);
    document.getElementById('groups-container').innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-exclamation-triangle fa-3x empty-icon" style="color: var(--error);"></i>
        <h3 class="empty-title">Fehler beim Laden</h3>
        <p class="empty-text">Die Gruppen konnten nicht geladen werden.</p>
        <button class="btn btn-primary" onclick="loadGroups()">Erneut versuchen</button>
      </div>
    `;
  }
}

// Render groups
function renderGroups() {
  const container = document.getElementById('groups-container');
  
  if (userGroups.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-users fa-3x empty-icon"></i>
        <h3 class="empty-title">Keine Gruppen</h3>
        <p class="empty-text">Erstelle eine Gruppe oder tritt einer bei, um mit Freunden zu wetten.</p>
        <div style="display: flex; justify-content: center; gap: 8px; margin-top: 16px;">
          <button class="btn btn-secondary" onclick="openJoinModal()">
            <i class="fas fa-link"></i>
            Mit Code beitreten
          </button>
          <button class="btn btn-primary" onclick="openCreateModal()">
            <i class="fas fa-plus"></i>
            Gruppe erstellen
          </button>
        </div>
      </div>
    `;
    return;
  }
  
  let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
  
  userGroups.forEach((group, i) => {
    const isAdmin = group.admin_id === currentUser.id;
    const memberCount = group.members?.length || group.member_ids?.length || 1;
    
    html += `
      <div class="card card-hover group-card" 
           onclick="window.location.href='group-detail.html?id=${group.id}'"
           style="animation: fadeIn 0.3s ease-out ${i * 0.05}s both;"
           data-testid="group-card-${group.id}">
        <div class="group-info">
          <div class="group-avatar">
            <i class="fas fa-users"></i>
          </div>
          <div>
            <div class="group-name">${group.name}</div>
            <div class="group-members">
              ${memberCount} Mitglied${memberCount !== 1 ? 'er' : ''}
              ${isAdmin ? '<span class="badge badge-default">Admin</span>' : ''}
            </div>
          </div>
        </div>
        <i class="fas fa-chevron-right" style="color: var(--muted);"></i>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Open create modal
function openCreateModal() {
  document.getElementById('create-modal').classList.add('active');
  document.getElementById('group-name-input').value = '';
  document.getElementById('create-error').classList.add('hidden');
}

// Close create modal
function closeCreateModal() {
  document.getElementById('create-modal').classList.remove('active');
}

// Handle create group
async function handleCreateGroup(event) {
  event.preventDefault();
  
  const name = document.getElementById('group-name-input').value.trim();
  const errorEl = document.getElementById('create-error');
  const submitBtn = event.target.querySelector('button[type="submit"]');
  
  if (!name) {
    errorEl.textContent = 'Bitte gib einen Gruppennamen ein';
    errorEl.classList.remove('hidden');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Erstellen...';
  
  try {
    const group = await firebaseCreateGroup(name);
    closeCreateModal();
    showSuccess(`Gruppe "${name}" erstellt!`);
    await loadGroups();
  } catch (error) {
    console.error('Error creating group:', error);
    errorEl.textContent = error.message || 'Fehler beim Erstellen der Gruppe';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Gruppe erstellen';
  }
}

// Open join modal
function openJoinModal() {
  document.getElementById('join-modal').classList.add('active');
  document.getElementById('invite-code-input').value = '';
  document.getElementById('join-error').classList.add('hidden');
}

// Close join modal
function closeJoinModal() {
  document.getElementById('join-modal').classList.remove('active');
}

// Handle join group
async function handleJoinGroup(event) {
  event.preventDefault();
  
  const code = document.getElementById('invite-code-input').value.trim().toUpperCase();
  const errorEl = document.getElementById('join-error');
  const submitBtn = event.target.querySelector('button[type="submit"]');
  
  if (code.length !== 8) {
    errorEl.textContent = 'Der Einladungscode muss 8 Zeichen haben';
    errorEl.classList.remove('hidden');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Beitreten...';
  
  try {
    const group = await firebaseJoinGroup(code);
    closeJoinModal();
    showSuccess(`Gruppe "${group.name}" beigetreten!`);
    await loadGroups();
  } catch (error) {
    console.error('Error joining group:', error);
    errorEl.textContent = error.message || 'Fehler beim Beitreten';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Beitreten';
  }
}

// Show success message
function showSuccess(message) {
  const successEl = document.getElementById('success-message');
  const textEl = document.getElementById('success-text');
  
  textEl.textContent = message;
  successEl.classList.remove('hidden');
  successEl.style.display = 'flex';
  successEl.style.alignItems = 'center';
  successEl.style.gap = '8px';
  
  setTimeout(() => {
    successEl.classList.add('hidden');
  }, 3000);
}

// Run on page load
document.addEventListener('DOMContentLoaded', async function() {
  // Initialize Firebase first
  if (typeof initializeFirebase === 'function') {
    initializeFirebase();
  }
  
  const isAuthed = await checkAuth();
  if (isAuthed) {
    initGroupsPage();
  }
});
