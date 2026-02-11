// Main application logic

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

// Toggle mobile menu (Hamburger)
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const hamburger = document.querySelector('.hamburger-icon');
  
  if (menu && overlay) {
    const isActive = menu.classList.contains('active');
    menu.classList.toggle('active');
    overlay.classList.toggle('active');
    
    // Animate hamburger icon
    if (hamburger) {
      hamburger.classList.toggle('active');
    }
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = isActive ? '' : 'hidden';
  }
}

// Close mobile menu
function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const hamburger = document.querySelector('.hamburger-icon');
  
  if (menu) menu.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  if (hamburger) hamburger.classList.remove('active');
  document.body.style.overflow = '';
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
  
  // Mobile menu links with larger touch targets
  const mobileLinksHTML = navItems.map(item => `
    <a href="${item.href}" class="mobile-nav-link ${currentPage === item.id ? 'active' : ''}" onclick="closeMobileMenu()">
      <i class="fas ${item.icon}"></i>
      <span>${item.label}</span>
    </a>
  `).join('');
  
  // Avatar content - use profile picture if available
  const avatarContent = user.profile_picture 
    ? `<img src="${user.profile_picture}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
    : '<i class="fas fa-user"></i>';
  
  return `
    <nav class="navbar">
      <div class="navbar-container">
        <div class="navbar-content">
          <!-- Logo links -->
          <a href="games.html" class="navbar-logo" data-testid="logo-link">
            NFL<span>POINTS</span>
          </a>
          
          <!-- Desktop Navigation -->
          <div class="navbar-nav desktop-nav">
            ${navLinksHTML}
          </div>
          
          <!-- Mobile: Username in der Mitte (zum Profil) -->
          <a href="profile.html" class="mobile-profile-link" data-testid="mobile-profile-link">
            <div class="mobile-profile-avatar">
              ${avatarContent}
            </div>
            <span class="mobile-profile-name">${user.username}</span>
          </a>
          
          <!-- Desktop: User Menu -->
          <div class="navbar-user desktop-user">
            <button class="user-button" onclick="toggleUserMenu()" data-testid="user-menu-button">
              <div class="user-avatar">
                ${avatarContent}
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
          
          <!-- Mobile: Hamburger Button -->
          <button class="hamburger-btn" onclick="toggleMobileMenu()" data-testid="hamburger-menu-toggle" aria-label="Menü öffnen">
            <div class="hamburger-icon">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        </div>
      </div>
    </nav>
    
    <!-- Mobile Menu Overlay -->
    <div id="mobile-menu-overlay" class="mobile-menu-overlay" onclick="closeMobileMenu()"></div>
    
    <!-- Mobile Slide-in Menu -->
    <div id="mobile-menu" class="mobile-slide-menu">
      <div class="mobile-menu-header">
        <span class="mobile-menu-title">Menü</span>
        <button class="mobile-menu-close" onclick="closeMobileMenu()" aria-label="Menü schließen">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="mobile-menu-nav">
        ${mobileLinksHTML}
      </div>
      
      <div class="mobile-menu-footer">
        <a href="profile.html" class="mobile-nav-link" onclick="closeMobileMenu()">
          <i class="fas fa-user"></i>
          <span>Mein Profil</span>
        </a>
        <button onclick="logout(); closeMobileMenu();" class="mobile-nav-link logout-link">
          <i class="fas fa-sign-out-alt"></i>
          <span>Abmelden</span>
        </button>
      </div>
    </div>
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

