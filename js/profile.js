// Profile page logic

let myBets = [];
let gamesData = [];
let userGroups = [];
let isEditingUsername = false;
let profileRendered = false;

// Image cropper state
let cropperState = {
  file: null,
  image: null,
  scale: 1,
  minScale: 1,
  maxScale: 3,
  posX: 0,
  posY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  startPosX: 0,
  startPosY: 0,
  imageWidth: 0,
  imageHeight: 0,
  cropSize: 260 // Size of the circular crop area
};

// Initialize profile page
async function initProfilePage() {
  profileRendered = false;
  await loadProfile();
  // Lade beides parallel, dann render
  const [bets, groups] = await Promise.all([
    loadMyBets(),
    loadUserGroups()
  ]);
  renderProfile();
  initCropper();
}

// Initialize cropper event listeners
function initCropper() {
  const cropArea = document.getElementById('crop-area');
  const zoomSlider = document.getElementById('crop-zoom');
  
  if (!cropArea || !zoomSlider) return;
  
  // Mouse events
  cropArea.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
  
  // Touch events for mobile
  cropArea.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('touchend', endDrag);
  
  // Mouse wheel zoom
  cropArea.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    adjustZoom(delta);
  }, { passive: false });
  
  // Zoom slider - always zoom to center
  zoomSlider.addEventListener('input', (e) => {
    const oldScale = cropperState.scale;
    const newScale = parseFloat(e.target.value);
    
    // Calculate zoom to center
    const cropSize = cropperState.cropSize;
    const centerX = cropSize / 2;
    const centerY = cropSize / 2;
    
    // Current image center position
    const oldImageCenterX = (centerX - cropperState.posX) / oldScale;
    const oldImageCenterY = (centerY - cropperState.posY) / oldScale;
    
    cropperState.scale = newScale;
    
    // Adjust position to keep the same image center point
    cropperState.posX = centerX - (oldImageCenterX * newScale);
    cropperState.posY = centerY - (oldImageCenterY * newScale);
    
    constrainPosition();
    updateCropImage();
  });
}

// Adjust zoom by delta - always zoom to center
function adjustZoom(delta) {
  const zoomSlider = document.getElementById('crop-zoom');
  if (!zoomSlider) return;
  
  const oldScale = cropperState.scale;
  const newValue = Math.max(cropperState.minScale, Math.min(cropperState.maxScale, cropperState.scale + delta));
  cropperState.scale = newValue;
  zoomSlider.value = newValue;
  
  // Calculate zoom to center
  const cropSize = cropperState.cropSize;
  const centerX = cropSize / 2;
  const centerY = cropSize / 2;
  
  // Current image center position
  const oldImageCenterX = (centerX - cropperState.posX) / oldScale;
  const oldImageCenterY = (centerY - cropperState.posY) / oldScale;
  
  // Adjust position to keep the same image center point
  cropperState.posX = centerX - (oldImageCenterX * newValue);
  cropperState.posY = centerY - (oldImageCenterY * newValue);
  
  constrainPosition();
  updateCropImage();
}

function startDrag(e) {
  e.preventDefault();
  cropperState.isDragging = true;
  
  const pos = getEventPosition(e);
  cropperState.startX = pos.x;
  cropperState.startY = pos.y;
  cropperState.startPosX = cropperState.posX;
  cropperState.startPosY = cropperState.posY;
}

function onDrag(e) {
  if (!cropperState.isDragging) return;
  e.preventDefault();
  
  const pos = getEventPosition(e);
  const deltaX = pos.x - cropperState.startX;
  const deltaY = pos.y - cropperState.startY;
  
  cropperState.posX = cropperState.startPosX + deltaX;
  cropperState.posY = cropperState.startPosY + deltaY;
  
  constrainPosition();
  updateCropImage();
}

function endDrag() {
  cropperState.isDragging = false;
}

function getEventPosition(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function constrainPosition() {
  const cropSize = cropperState.cropSize;
  const scaledWidth = cropperState.imageWidth * cropperState.scale;
  const scaledHeight = cropperState.imageHeight * cropperState.scale;
  
  // Keep image covering the entire crop area
  const minX = cropSize - scaledWidth;
  const maxX = 0;
  const minY = cropSize - scaledHeight;
  const maxY = 0;
  
  cropperState.posX = Math.min(maxX, Math.max(minX, cropperState.posX));
  cropperState.posY = Math.min(maxY, Math.max(minY, cropperState.posY));
}

function updateCropImage() {
  const img = document.getElementById('crop-image');
  if (!img) return;
  
  const scaledWidth = cropperState.imageWidth * cropperState.scale;
  const scaledHeight = cropperState.imageHeight * cropperState.scale;
  
  img.style.width = scaledWidth + 'px';
  img.style.height = scaledHeight + 'px';
  img.style.left = cropperState.posX + 'px';
  img.style.top = cropperState.posY + 'px';
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

// Load user groups
async function loadUserGroups() {
  try {
    userGroups = await firebaseGetUserGroups();
    return userGroups;
  } catch (error) {
    console.error('Error loading groups:', error);
    userGroups = [];
    return [];
  }
}

// Load user bets from Firebase
async function loadMyBets() {
  try {
    myBets = await firebaseGetUserBets(currentUser.id);
    return myBets;
  } catch (error) {
    console.error('Error loading bets:', error);
    myBets = [];
    return [];
  }
}

// Handle profile picture upload - open cropper
async function handleProfilePictureUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Bitte wähle ein Bild aus (JPG, PNG, etc.)');
    return;
  }
  
  // Validate file size (max 10MB original)
  if (file.size > 10 * 1024 * 1024) {
    alert('Das Bild ist zu groß. Maximale Größe: 10MB');
    return;
  }
  
  // Store file and open cropper
  cropperState.file = file;
  openCropModal(file);
  
  // Reset input so same file can be selected again
  event.target.value = '';
}

// Open crop modal with image
function openCropModal(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const cropSize = cropperState.cropSize;
      
      // Calculate minimum scale so image covers crop area
      const scaleToFitWidth = cropSize / img.width;
      const scaleToFitHeight = cropSize / img.height;
      const minScale = Math.max(scaleToFitWidth, scaleToFitHeight);
      
      cropperState.imageWidth = img.width;
      cropperState.imageHeight = img.height;
      cropperState.minScale = minScale;
      cropperState.maxScale = minScale * 3;
      cropperState.scale = minScale;
      
      // Center the image
      const scaledWidth = img.width * minScale;
      const scaledHeight = img.height * minScale;
      cropperState.posX = (cropSize - scaledWidth) / 2;
      cropperState.posY = (cropSize - scaledHeight) / 2;
      
      // Set image source
      const cropImg = document.getElementById('crop-image');
      cropImg.src = e.target.result;
      cropperState.image = e.target.result;
      
      // Update zoom slider
      const zoomSlider = document.getElementById('crop-zoom');
      zoomSlider.min = minScale;
      zoomSlider.max = cropperState.maxScale;
      zoomSlider.value = minScale;
      
      updateCropImage();
      
      // Show modal
      document.getElementById('crop-modal').classList.add('active');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Close crop modal
function closeCropModal() {
  document.getElementById('crop-modal').classList.remove('active');
  cropperState.file = null;
  cropperState.image = null;
}

// Apply crop and upload
async function applyCrop() {
  const cropSize = cropperState.cropSize;
  const outputSize = 200; // Final image size
  
  // Create canvas for cropping
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  
  // Load the original image
  const img = new Image();
  img.onload = async function() {
    // Calculate source coordinates in original image
    const srcX = -cropperState.posX / cropperState.scale;
    const srcY = -cropperState.posY / cropperState.scale;
    const srcSize = cropSize / cropperState.scale;
    
    // Draw cropped area to canvas
    ctx.drawImage(
      img,
      srcX, srcY, srcSize, srcSize,
      0, 0, outputSize, outputSize
    );
    
    // Convert to base64
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    
    // Close modal and show loading
    closeCropModal();
    
    const avatarEl = document.querySelector('.profile-avatar');
    if (avatarEl) {
      avatarEl.innerHTML = '<i class="fas fa-spinner fa-spin fa-2x"></i>';
    }
    
    try {
      // Save to Firestore
      await firebaseUpdateProfilePicture(base64Image);
      
      // Update local user data
      currentUser.profile_picture = base64Image;
      localStorage.setItem('user', JSON.stringify(currentUser));
      
      // Re-render profile and navbar
      renderProfile();
      updateNavbarAvatar();
      
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Fehler beim Hochladen des Bildes: ' + error.message);
      renderProfile();
    }
  };
  img.src = cropperState.image;
}

// Remove profile picture
async function removeProfilePicture() {
  if (!confirm('Profilbild wirklich entfernen?')) return;
  
  // Show loading state
  const avatarEl = document.querySelector('.profile-avatar');
  if (avatarEl) {
    avatarEl.innerHTML = '<i class="fas fa-spinner fa-spin fa-2x"></i>';
  }
  
  try {
    await firebaseRemoveProfilePicture();
    
    // Update local user data
    delete currentUser.profile_picture;
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    // Re-render profile and navbar
    renderProfile();
    updateNavbarAvatar();
    
  } catch (error) {
    console.error('Error removing profile picture:', error);
    alert('Fehler beim Entfernen des Bildes: ' + error.message);
    renderProfile();
  }
}

// Update navbar avatar after picture change
function updateNavbarAvatar() {
  const navbarAvatars = document.querySelectorAll('.user-avatar');
  navbarAvatars.forEach(avatar => {
    if (currentUser.profile_picture) {
      avatar.innerHTML = `<img src="${currentUser.profile_picture}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
      avatar.innerHTML = '<i class="fas fa-user"></i>';
    }
  });
}

// Toggle username edit mode
function toggleUsernameEdit() {
  isEditingUsername = !isEditingUsername;
  renderProfile();
  
  if (isEditingUsername) {
    const input = document.getElementById('username-edit-input');
    if (input) {
      input.focus();
      input.select();
    }
  }
}

// Save new username
async function saveUsername() {
  const input = document.getElementById('username-edit-input');
  const newUsername = input.value.trim();
  const errorEl = document.getElementById('username-error');
  const saveBtn = document.getElementById('save-username-btn');
  
  // Validate
  if (!newUsername || newUsername.length < 2) {
    errorEl.textContent = 'Benutzername muss mindestens 2 Zeichen haben';
    errorEl.classList.remove('hidden');
    return;
  }
  
  if (newUsername === currentUser.username) {
    isEditingUsername = false;
    renderProfile();
    return;
  }
  
  // Show loading
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  errorEl.classList.add('hidden');
  
  try {
    await firebaseUpdateUsername(newUsername);
    
    // Update local user data
    currentUser.username = newUsername;
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    isEditingUsername = false;
    renderProfile();
  } catch (error) {
    console.error('Error updating username:', error);
    errorEl.textContent = error.message || 'Fehler beim Speichern';
    errorEl.classList.remove('hidden');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
  }
}

// Render profile
function renderProfile() {
  const container = document.getElementById('profile-container');
  const user = currentUser;
  const shouldAnimate = !profileRendered; // Animate beim ersten Render
  profileRendered = true;
  
  // Calculate stats
  const totalPoints = myBets.reduce((sum, bet) => sum + (bet.points_earned || 0), 0);
  const correctWinners = myBets.filter(bet => bet.points_earned > 0).length;
  const correctScores = myBets.filter(bet => bet.points_earned >= 3).length;
  
  // Nur offene Wetten (Spiele die noch nicht beendet sind)
  const openBets = myBets.filter(bet => {
    const game = gamesData.find(g => g.id === bet.game_id);
    return game && game.status !== 'finished';
  });
  
  // Profile picture HTML
  const hasProfilePicture = user.profile_picture;
  const avatarContent = hasProfilePicture 
    ? `<img src="${user.profile_picture}" alt="Profilbild" class="profile-avatar-img">`
    : '<i class="fas fa-user fa-2x"></i>';
  
  let html = `
    <!-- Profile Header -->
    <div class="card profile-header${shouldAnimate ? ' animate' : ''}">
      <div class="profile-avatar-container">
        <div class="profile-avatar" data-testid="profile-avatar">
          ${avatarContent}
        </div>
        <div class="profile-avatar-overlay" onclick="document.getElementById('profile-picture-input').click()" data-testid="change-avatar-btn">
          <i class="fas fa-camera"></i>
        </div>
        <input 
          type="file" 
          id="profile-picture-input" 
          accept="image/*" 
          style="display: none;" 
          onchange="handleProfilePictureUpload(event)"
          data-testid="profile-picture-input"
        >
        ${hasProfilePicture ? `
          <button class="profile-avatar-remove" onclick="removeProfilePicture()" title="Profilbild entfernen" data-testid="remove-avatar-btn">
            <i class="fas fa-times"></i>
          </button>
        ` : ''}
      </div>
      
      ${isEditingUsername ? `
        <!-- Username Edit Mode -->
        <div class="username-edit-container" data-testid="username-edit-container">
          <input 
            type="text" 
            id="username-edit-input"
            class="form-input username-input"
            value="${user.username}"
            maxlength="30"
            data-testid="username-edit-input"
            onkeydown="if(event.key === 'Enter') saveUsername(); if(event.key === 'Escape') toggleUsernameEdit();"
          >
          <div id="username-error" class="error-message hidden"></div>
          <div class="username-edit-buttons">
            <button class="btn btn-secondary btn-sm" onclick="toggleUsernameEdit()" data-testid="cancel-username-btn">
              <i class="fas fa-times"></i> Abbrechen
            </button>
            <button id="save-username-btn" class="btn btn-primary btn-sm" onclick="saveUsername()" data-testid="save-username-btn">
              <i class="fas fa-check"></i> Speichern
            </button>
          </div>
        </div>
      ` : `
        <!-- Username Display Mode -->
        <div class="username-display-container" data-testid="username-display-container">
          <h1 class="profile-username" data-testid="profile-username">${user.username}</h1>
          <button class="btn-edit-username" onclick="toggleUsernameEdit()" data-testid="edit-username-btn" title="Benutzernamen ändern">
            <i class="fas fa-pencil"></i>
          </button>
        </div>
      `}
      
      <p class="profile-email">${user.email}</p>
      ${user.is_admin ? '<span class="profile-badge">Admin</span>' : ''}
    </div>
    
    <!-- Stats -->
    <div class="stats-grid${shouldAnimate ? ' animate' : ''}">
      <div class="card stat-card">
        <i class="fas fa-trophy fa-lg stat-icon"></i>
        <div class="stat-value" data-testid="total-points">${totalPoints}</div>
        <div class="stat-label">Punkte</div>
      </div>
      
      <div class="card stat-card">
        <i class="fas fa-bullseye fa-lg stat-icon"></i>
        <div class="stat-value" data-testid="total-bets">${myBets.length}</div>
        <div class="stat-label">Wetten</div>
      </div>
      
      <div class="card stat-card">
        <i class="fas fa-calendar-check fa-lg stat-icon"></i>
        <div class="stat-value" data-testid="correct-winners">${correctWinners}</div>
        <div class="stat-label">Richtig</div>
      </div>
    </div>
    
    <!-- User Groups -->
    <div class="card${shouldAnimate ? ' animate-fade-in' : ''}" style="margin-top: 24px;${shouldAnimate ? ' animation-delay: 0.75s;' : ''}">
      <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">
        <i class="fas fa-users" style="margin-right: 8px; color: var(--accent);"></i>
        Meine Gruppen (${userGroups.length})
      </h3>
      
      ${userGroups.length === 0 ? `
        <p style="text-align: center; color: var(--muted); padding: 24px 0;">
          Du bist noch in keiner Gruppe
        </p>
        <div style="display: flex; justify-content: center;">
          <a href="groups.html" class="btn btn-secondary btn-sm">
            <i class="fas fa-plus"></i> Gruppe beitreten
          </a>
        </div>
      ` : `
        <div class="groups-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${userGroups.map(group => {
            const isAdmin = group.admin_id === user.id;
            const memberCount = group.members?.length || group.member_ids?.length || 1;
            return `
              <a href="group-detail.html?id=${group.id}" class="group-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(var(--white-rgb), 0.03); border-radius: 10px; text-decoration: none; color: inherit; transition: all 0.2s ease;" data-testid="profile-group-${group.id}">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%); display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-users" style="font-size: 14px;"></i>
                  </div>
                  <div>
                    <div style="font-weight: 600;">${group.name}</div>
                    <div style="font-size: 12px; color: var(--muted);">
                      ${memberCount} Mitglied${memberCount !== 1 ? 'er' : ''}
                      ${isAdmin ? ' • Admin' : ''}
                    </div>
                  </div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--muted); font-size: 12px;"></i>
              </a>
            `;
          }).join('')}
        </div>
      `}
    </div>
    
    <!-- Open Bets Only -->
    <div class="card${shouldAnimate ? ' animate-fade-in' : ''}" style="margin-top: 24px;${shouldAnimate ? ' animation-delay: 0.85s;' : ''}">
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
    <div${shouldAnimate ? ' class="animate-fade-in"' : ''} style="margin-top: 24px; display: flex; flex-direction: column; gap: 12px;${shouldAnimate ? ' animation-delay: 0.95s;' : ''}">
      <button class="btn btn-secondary btn-full" onclick="openPasswordResetModal()" data-testid="reset-password-button">
        <i class="fas fa-key"></i>
        Passwort zurücksetzen
      </button>
      
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

// Open password reset modal
function openPasswordResetModal() {
  document.getElementById('password-reset-modal').classList.add('active');
  document.getElementById('password-reset-error').classList.add('hidden');
  document.getElementById('password-reset-success').classList.add('hidden');
}

// Close password reset modal
function closePasswordResetModal() {
  document.getElementById('password-reset-modal').classList.remove('active');
}

// Send password reset email
async function sendPasswordReset() {
  const errorEl = document.getElementById('password-reset-error');
  const successEl = document.getElementById('password-reset-success');
  const submitBtn = document.querySelector('#password-reset-modal .btn-primary');
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gesendet...';
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');
  
  try {
    const email = await firebaseSendPasswordReset();
    successEl.innerHTML = `<i class="fas fa-check-circle"></i> E-Mail wurde an <strong>${email}</strong> gesendet. Prüfe dein Postfach.`;
    successEl.classList.remove('hidden');
    
    // Auto-close after 5 seconds
    setTimeout(() => {
      closePasswordResetModal();
    }, 5000);
  } catch (error) {
    console.error('Error sending password reset:', error);
    errorEl.textContent = error.message || 'Fehler beim Senden der E-Mail';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> E-Mail senden';
  }
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
