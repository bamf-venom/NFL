// Groups page logic

Object.assign(TRANSLATIONS.de, {
  groups_title: 'Meine Gruppen', groups_subtitle: 'Wette mit deinen Freunden',
  create_group_title: 'Neue Gruppe erstellen',
  placeholder_group_name: 'z.B. NFL Experten',
  new_group: 'Neue Gruppe',
  join_group_title: 'Gruppe beitreten', label_invite_code: 'Einladungscode',
  placeholder_invite_code: 'z.B. ABC12345', invite_code_hint: 'Frage einen Freund nach dem Einladungscode',
  error_loading_groups: 'Die Gruppen konnten nicht geladen werden.',
  no_groups_title: 'Keine Gruppen', no_groups_text: 'Erstelle eine Gruppe oder tritt einer bei, um mit Freunden zu wetten.',
  btn_join_with_code: 'Mit Code beitreten', btn_create_group: 'Gruppe erstellen',
  error_enter_group_name: 'Bitte gib einen Gruppennamen ein', creating: 'Erstellen...',
  group_created: 'Gruppe "{name}" erstellt!', error_creating_group: 'Fehler beim Erstellen der Gruppe',
  error_invite_code_length: 'Der Einladungscode muss 8 Zeichen haben', joining: 'Beitreten...',
  group_joined: 'Gruppe "{name}" beigetreten!', error_joining_group: 'Fehler beim Beitreten',
  btn_join: 'Beitreten'
});
Object.assign(TRANSLATIONS.en, {
  groups_title: 'My groups', groups_subtitle: 'Bet with your friends',
  create_group_title: 'Create new group',
  placeholder_group_name: 'e.g. NFL Experts',
  new_group: 'New group',
  join_group_title: 'Join group', label_invite_code: 'Invite code',
  placeholder_invite_code: 'e.g. ABC12345', invite_code_hint: 'Ask a friend for the invite code',
  error_loading_groups: 'The groups could not be loaded.',
  no_groups_title: 'No groups', no_groups_text: 'Create a group or join one to bet with friends.',
  btn_join_with_code: 'Join with code', btn_create_group: 'Create group',
  error_enter_group_name: 'Please enter a group name', creating: 'Creating...',
  group_created: 'Group "{name}" created!', error_creating_group: 'Error creating the group',
  error_invite_code_length: 'The invite code must be 8 characters', joining: 'Joining...',
  group_joined: 'Joined group "{name}"!', error_joining_group: 'Error joining the group',
  btn_join: 'Join'
});

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
        <h3 class="empty-title">${t('error_loading_title')}</h3>
        <p class="empty-text">${t('error_loading_groups')}</p>
        <button class="btn btn-primary" onclick="loadGroups()">${t('btn_retry')}</button>
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
        <h3 class="empty-title">${t('no_groups_title')}</h3>
        <p class="empty-text">${t('no_groups_text')}</p>
        <div style="display: flex; justify-content: center; gap: 8px; margin-top: 16px;">
          <button class="btn btn-secondary" onclick="openJoinModal()">
            <i class="fas fa-link"></i>
            ${t('btn_join_with_code')}
          </button>
          <button class="btn btn-primary" onclick="openCreateModal()">
            <i class="fas fa-plus"></i>
            ${t('btn_create_group')}
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
            <div class="group-name">${escapeHtml(group.name)}</div>
            <div class="group-members">
              ${memberCount} ${memberCount !== 1 ? t('members') : t('member')}
              ${isAdmin ? `<span class="badge badge-default">${t('admin_badge')}</span>` : ''}
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
    errorEl.textContent = t('error_enter_group_name');
    errorEl.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('creating')}`;

  try {
    const group = await firebaseCreateGroup(name);
    closeCreateModal();
    showSuccess(t('group_created', { name }));
    await loadGroups();
  } catch (error) {
    console.error('Error creating group:', error);
    errorEl.textContent = error.message || t('error_creating_group');
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = t('btn_create_group');
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
    errorEl.textContent = t('error_invite_code_length');
    errorEl.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('joining')}`;

  try {
    const group = await firebaseJoinGroup(code);
    closeJoinModal();
    showSuccess(t('group_joined', { name: group.name }));
    await loadGroups();
  } catch (error) {
    console.error('Error joining group:', error);
    errorEl.textContent = error.message || t('error_joining_group');
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = t('btn_join');
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
