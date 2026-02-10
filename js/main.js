// Main application logic

// Initialize Firebase when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  if (typeof initializeFirebase === 'function') {
    initializeFirebase();
  }
});

// Format date for German locale
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format date only
function formatDateOnly(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

// Format time only
function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get status badge HTML
function getStatusBadge(status) {
  switch (status) {
    case 'live':
      return { text: 'LIVE', class: 'badge-live' };
    case 'finished':
      return { text: 'BEENDET', class: 'badge-default' };
    default:
      return { text: 'GEPLANT', class: 'badge-default' };
  }
}

// Toggle user menu
function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) {
    menu.classList.toggle('active');
  }
}

// Toggle mobile menu
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) {
    menu.classList.toggle('active');
  }
}

// Close menus when clicking outside
document.addEventListener('click', function(event) {
  const userBtn = document.querySelector('.user-button');
  const userMenu = document.getElementById('user-menu');
  
  if (userBtn && userMenu && !userBtn.contains(event.target) && !userMenu.contains(event.target)) {
    userMenu.classList.remove('active');
  }
});

// Render navbar (for pages)
function renderNavbar() {
  const user = currentUser || JSON.parse(localStorage.getItem('user'));
  if (!user) return '';
  
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
  
  const navItems = [
    { href: 'games.html', id: 'games', label: 'Spiele', icon: 'fa-calendar' },
    { href: 'groups.html', id: 'groups', label: 'Gruppen', icon: 'fa-users' },
    { href: 'leaderboard.html', id: 'leaderboard', label: 'Rangliste', icon: 'fa-trophy' },
  ];
  
  if (user.is_admin) {
    navItems.push({ href: 'admin.html', id: 'admin', label: 'Admin', icon: 'fa-shield' });
  }
  
  const navLinksHTML = navItems.map(item => `
    <a href="${item.href}" class="nav-link ${currentPage === item.id ? 'active' : ''}" data-testid="nav-${item.label.toLowerCase()}">
      <i class="fas ${item.icon}"></i>
      ${item.label}
    </a>
  `).join('');
  
  const mobileLinksHTML = navItems.map(item => `
    <a href="${item.href}" class="nav-link ${currentPage === item.id ? 'active' : ''}">
      <i class="fas ${item.icon}"></i>
      ${item.label}
    </a>
  `).join('');
  
  return `
    <nav class="navbar">
      <div class="navbar-container">
        <div class="navbar-content">
          <a href="games.html" class="navbar-logo" data-testid="logo-link">
            NFL<span>BETT</span>
          </a>
          
          <div class="navbar-nav">
            ${navLinksHTML}
          </div>
          
          <div class="navbar-user">
            <button class="user-button" onclick="toggleUserMenu()" data-testid="user-menu-button">
              <div class="user-avatar">
                <i class="fas fa-user"></i>
              </div>
              <span>${user.username}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            
            <div id="user-menu" class="user-menu">
              <a href="profile.html" class="user-menu-item" data-testid="profile-link">
                <i class="fas fa-user"></i>
                Mein Profil
              </a>
              <button onclick="logout()" class="user-menu-item danger" data-testid="logout-button">
                <i class="fas fa-sign-out-alt"></i>
                Abmelden
              </button>
            </div>
          </div>
          
          <button class="mobile-menu-btn" onclick="toggleMobileMenu()" data-testid="mobile-menu-toggle">
            <i class="fas fa-bars"></i>
          </button>
        </div>
        
        <div id="mobile-menu" class="mobile-menu">
          ${mobileLinksHTML}
          <div style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
            <a href="profile.html" class="nav-link">
              <i class="fas fa-user"></i>
              Mein Profil
            </a>
            <button onclick="logout()" class="nav-link" style="width: 100%; color: var(--error);">
              <i class="fas fa-sign-out-alt"></i>
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

// Initialize page
function initPage() {
  // Check auth for protected pages
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    // Insert navbar immediately with cached user
    const navbarContainer = document.getElementById('navbar-container');
    if (navbarContainer) {
      navbarContainer.innerHTML = renderNavbar();
    }
  }
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', initPage);
