// Admin page logic

Object.assign(TRANSLATIONS.de, {
  admin_subtitle: 'Verwalte Spiele und Benutzer',
  tab_games: 'Spiele', tab_users: 'Benutzer',
  btn_new_game: 'Neues Spiel',
  error_loading_admin_data: 'Die Daten konnten nicht geladen werden.',
  team_select_placeholder: 'Team wählen...',
  admin_week_wildcard: 'Wild Card', admin_week_divisional: 'Divisional',
  admin_week_conf: 'Conf. Championship', admin_week_superbowl: 'Super Bowl',
  no_games_in_filter: 'Keine Spiele in dieser Saison/Woche gefunden',
  creating_game: 'Wird erstellt...', error_creating_game: 'Fehler beim Erstellen des Spiels',
  btn_create_game_admin: 'Spiel erstellen',
  game_id_label: 'Spiel ID: {id}...', team_points_label: '{team} Punkte',
  saving_ellipsis: 'Wird gespeichert...', error_updating_game: 'Fehler beim Aktualisieren des Spiels',
  confirm_delete_game: 'Spiel wirklich löschen? Alle Wetten gehen verloren!',
  error_deleting_game: 'Fehler beim Löschen des Spiels',
  confirm_delete_user: 'Benutzer "{username}" wirklich löschen? Alle Daten werden gelöscht!',
  error_deleting_user: 'Fehler beim Löschen des Benutzers',
  status_option_scheduled: 'Geplant', status_option_live: 'Live', status_option_finished: 'Beendet',
  create_game_modal_title: 'Neues Spiel erstellen', edit_game_modal_title: 'Spiel bearbeiten',
  label_home_team: 'Heimteam', label_away_team: 'Gastteam',
  label_date_time: 'Datum & Uhrzeit', label_week: 'Woche', label_season: 'Saison',
  label_home_points_default: 'Heim Punkte', label_away_points_default: 'Gast Punkte',
  label_status: 'Status'
});
Object.assign(TRANSLATIONS.en, {
  admin_subtitle: 'Manage games and users',
  tab_games: 'Games', tab_users: 'Users',
  btn_new_game: 'New game',
  error_loading_admin_data: 'The data could not be loaded.',
  team_select_placeholder: 'Select team...',
  admin_week_wildcard: 'Wild Card', admin_week_divisional: 'Divisional',
  admin_week_conf: 'Conf. Championship', admin_week_superbowl: 'Super Bowl',
  no_games_in_filter: 'No games found for this season/week',
  creating_game: 'Creating...', error_creating_game: 'Error creating the game',
  btn_create_game_admin: 'Create game',
  game_id_label: 'Game ID: {id}...', team_points_label: '{team} points',
  saving_ellipsis: 'Saving...', error_updating_game: 'Error updating the game',
  confirm_delete_game: 'Really delete this game? All bets will be lost!',
  error_deleting_game: 'Error deleting the game',
  confirm_delete_user: 'Really delete user "{username}"? All their data will be deleted!',
  error_deleting_user: 'Error deleting the user',
  status_option_scheduled: 'Scheduled', status_option_live: 'Live', status_option_finished: 'Finished',
  create_game_modal_title: 'Create new game', edit_game_modal_title: 'Edit game',
  label_home_team: 'Home team', label_away_team: 'Away team',
  label_date_time: 'Date & time', label_week: 'Week', label_season: 'Season',
  label_home_points_default: 'Home points', label_away_points_default: 'Away points',
  label_status: 'Status'
});

let adminGames = [];
let adminUsers = [];
let currentTab = 'games';
let editingGame = null;
let adminSelectedSeason = null;
let adminSelectedWeek = null;

// Initialize admin page
async function initAdminPage() {
  // Check if user is admin
  if (!currentUser?.is_admin) {
    window.location.href = 'games.html';
    return;
  }
  
  // Populate team selects first (before loading data)
  populateTeamSelects();
  translateAdminStaticSelects();
  await loadAdminData();
  
  // Setup filter listeners
  setupAdminFilters();
}

// Setup filter event listeners
function setupAdminFilters() {
  const seasonFilter = document.getElementById('admin-season-filter');
  const weekFilter = document.getElementById('admin-week-filter');
  
  if (seasonFilter) {
    seasonFilter.addEventListener('change', function(e) {
      // Always require a season - if somehow empty, use first available
      adminSelectedSeason = e.target.value || null;
      adminSelectedWeek = null; // Reset week when season changes
      populateAdminWeekFilter();
      renderAdminGames();
    });
  }
  
  if (weekFilter) {
    weekFilter.addEventListener('change', function(e) {
      adminSelectedWeek = e.target.value ? parseInt(e.target.value) : null;
      renderAdminGames();
    });
  }
}

// Determine current NFL season based on date
function getCurrentNFLSeason() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  
  if (month <= 1) {
    return (year - 1).toString();
  }
  if (month >= 2 && month <= 7) {
    return (year - 1).toString();
  }
  return year.toString();
}

// Determine current week based on games in the selected season
function getCurrentWeekForSeasonAdmin(season, games) {
  const now = new Date();
  const seasonGames = games.filter(g => g.season === season);
  if (seasonGames.length === 0) return null;
  
  const weeks = [...new Set(seasonGames.map(g => g.week))].sort((a, b) => a - b);
  if (weeks.length === 0) return null;
  
  let currentWeek = null;
  
  for (const week of weeks) {
    const weekGames = seasonGames.filter(g => g.week === week);
    const firstGameDate = new Date(Math.min(...weekGames.map(g => new Date(g.game_date).getTime())));
    const lastGameDate = new Date(Math.max(...weekGames.map(g => new Date(g.game_date).getTime())));
    
    if (firstGameDate > now) {
      break;
    }
    
    currentWeek = week;
    
    const weekEndBuffer = new Date(lastGameDate.getTime() + 24 * 60 * 60 * 1000);
    if (now <= weekEndBuffer) {
      break;
    }
  }
  
  if (currentWeek === null) {
    currentWeek = weeks[0];
  }
  
  const allGamesFinished = seasonGames.every(g => g.status === 'finished');
  const lastWeek = weeks[weeks.length - 1];
  
  if (allGamesFinished) {
    return lastWeek;
  }
  
  return currentWeek;
}

// Populate admin season filter - always requires a season selection (no "Alle Saisons")
function populateAdminSeasonFilter() {
  const seasons = [...new Set(adminGames.map(g => g.season))].sort((a, b) => b - a);
  const filter = document.getElementById('admin-season-filter');
  
  if (!filter) return;
  
  // NO "Alle Saisons" option - always require a season
  filter.innerHTML = '';
  
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season;
    option.textContent = getSeasonDisplayName(season);
    filter.appendChild(option);
  });
  
  // Auto-select current NFL season or latest available
  if (!adminSelectedSeason && seasons.length > 0) {
    const currentNFLSeason = getCurrentNFLSeason();
    
    if (seasons.includes(currentNFLSeason)) {
      adminSelectedSeason = currentNFLSeason;
    } else {
      adminSelectedSeason = seasons[0];
    }
    filter.value = adminSelectedSeason;
  } else if (adminSelectedSeason) {
    filter.value = adminSelectedSeason;
  }
}

// Populate admin week filter
function populateAdminWeekFilter() {
  // Always require a season filter now
  let filteredGames = adminGames;
  if (adminSelectedSeason) {
    filteredGames = adminGames.filter(g => g.season === adminSelectedSeason);
  }
  
  const weeks = [...new Set(filteredGames.map(g => g.week))].sort((a, b) => a - b);
  const filter = document.getElementById('admin-week-filter');
  
  if (!filter) return;
  
  filter.innerHTML = `<option value="">${t('all_weeks')}</option>`;
  
  weeks.forEach(week => {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = getWeekDisplayName(week);
    filter.appendChild(option);
  });
  
  // Auto-select current week if no week selected yet
  if (adminSelectedWeek === null && adminSelectedSeason) {
    const currentWeek = getCurrentWeekForSeasonAdmin(adminSelectedSeason, adminGames);
    if (currentWeek !== null && weeks.includes(currentWeek)) {
      adminSelectedWeek = currentWeek;
      filter.value = adminSelectedWeek;
    }
  }
  
  // Reset week selection if not in filtered list
  if (adminSelectedWeek && !weeks.includes(adminSelectedWeek)) {
    adminSelectedWeek = null;
  }
  
  // Restore selection if exists
  if (adminSelectedWeek) {
    filter.value = adminSelectedWeek;
  }
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
    
    // Populate filters
    populateAdminSeasonFilter();
    populateAdminWeekFilter();
    
    renderAdminGames();
    renderAdminUsers();
  } catch (error) {
    console.error('Error loading admin data:', error);
    document.getElementById('admin-games-container').innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-exclamation-triangle fa-3x empty-icon" style="color: var(--error);"></i>
        <h3 class="empty-title">${t('error_loading_title')}</h3>
        <p class="empty-text">${t('error_loading_admin_data')}</p>
        <button class="btn btn-primary" onclick="loadAdminData()">${t('btn_retry')}</button>
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
  homeSelect.innerHTML = `<option value="">${t('team_select_placeholder')}</option>`;
  awaySelect.innerHTML = `<option value="">${t('team_select_placeholder')}</option>`;
  
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

// Translate the static week/status <option> text in the create/edit game modals
function translateAdminStaticSelects() {
  ['game-week-input', 'edit-game-week'].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    Array.from(select.options).forEach(option => {
      const week = parseInt(option.value);
      if (!week) return;
      option.textContent = getWeekDisplayName(week);
    });
  });

  const statusSelect = document.getElementById('edit-status');
  if (statusSelect) {
    const labels = {
      scheduled: t('status_option_scheduled'),
      live: t('status_option_live'),
      finished: t('status_option_finished')
    };
    Array.from(statusSelect.options).forEach(option => {
      if (labels[option.value]) option.textContent = labels[option.value];
    });
  }
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

// Get display name for week (including playoffs)
function getWeekDisplayName(week) {
  switch (week) {
    case 19: return t('admin_week_wildcard');
    case 20: return t('admin_week_divisional');
    case 21: return t('admin_week_conf');
    case 22: return t('admin_week_superbowl');
    default: return t('week_n', { n: week });
  }
}

// Format season display name (e.g., "2025" -> "2025/2026")
function getSeasonDisplayName(season) {
  const startYear = parseInt(season);
  const endYear = startYear + 1;
  return `${startYear}/${endYear}`;
}

// Render admin games
function renderAdminGames() {
  const container = document.getElementById('admin-games-container');
  
  // Apply filters - season is always required
  let filteredGames = adminGames;
  
  // Always filter by season (required)
  if (adminSelectedSeason) {
    filteredGames = filteredGames.filter(g => g.season === adminSelectedSeason);
  }
  
  if (adminSelectedWeek) {
    filteredGames = filteredGames.filter(g => g.week === adminSelectedWeek);
  }
  
  if (filteredGames.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <p style="color: var(--muted);">${t('no_games_in_filter')}</p>
      </div>
    `;
    return;
  }
  
  let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
  
  filteredGames.forEach((game, index) => {
    // Gleiche Statusfarben wie im Rest der App: beendet = rot, live = helles
    // Rot, geplant = grün (vorher inkonsistent: beendet war hier grün)
    const statusInfo = getStatusBadge(game.status);
    const status = statusInfo.text;
    const statusClass = statusInfo.class;
    
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
            <div class="admin-game-meta">${getWeekDisplayName(game.week)} • ${getSeasonDisplayName(game.season)} • ${new Date(game.game_date).toLocaleDateString(getCurrentLocale())}</div>
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
          <div class="user-card-avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
          <div>
            <div class="user-card-name">
              ${escapeHtml(user.username)}
              ${user.is_admin ? `<span class="badge badge-warning">${t('admin_badge')}</span>` : ''}
            </div>
            <div class="user-card-email">${escapeHtml(user.email)}</div>
          </div>
        </div>
        <div class="user-card-actions">
          <div class="user-card-points">${user.total_points || 0} ${t('pts_short')}</div>
          ${!user.is_admin && user.id !== currentUser.id ? `
            <button class="btn btn-danger btn-sm" onclick="handleDeleteUser('${user.id}', '${jsAttrSafe(user.username)}')" data-testid="delete-user-${user.id}">
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
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('creating_game')}`;

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
    alert(error.message || t('error_creating_game'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = t('btn_create_game_admin');
  }
}

// Populate edit modal team selects
function populateEditTeamSelects() {
  const homeSelect = document.getElementById('edit-home-team');
  const awaySelect = document.getElementById('edit-away-team');
  
  if (!homeSelect || !awaySelect) {
    console.error('Edit team selects not found');
    return;
  }
  
  if (typeof NFL_TEAMS === 'undefined' || !NFL_TEAMS || NFL_TEAMS.length === 0) {
    console.error('NFL_TEAMS not available');
    return;
  }
  
  console.log('Populating edit team selects with', NFL_TEAMS.length, 'teams');
  
  homeSelect.innerHTML = `<option value="">${t('team_select_placeholder')}</option>`;
  awaySelect.innerHTML = `<option value="">${t('team_select_placeholder')}</option>`;
  
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
  
  console.log('Edit team selects populated, home options:', homeSelect.options.length, 'away options:', awaySelect.options.length);
}

// Populate edit modal season select dynamically
function populateEditSeasonSelect(currentSeason) {
  const seasonSelect = document.getElementById('edit-game-season');
  if (!seasonSelect) return;
  
  // Get all unique seasons from games
  const seasons = [...new Set(adminGames.map(g => String(g.season)))].sort();
  
  // Add current game's season if not in list
  const currentSeasonStr = String(currentSeason);
  if (!seasons.includes(currentSeasonStr)) {
    seasons.push(currentSeasonStr);
    seasons.sort();
  }
  
  // Add some future seasons
  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    const yearStr = String(year);
    if (!seasons.includes(yearStr)) {
      seasons.push(yearStr);
    }
  }
  seasons.sort();
  
  // Rebuild options
  seasonSelect.innerHTML = '';
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season;
    option.textContent = `${season}/${parseInt(season) + 1}`;
    seasonSelect.appendChild(option);
  });
  
  console.log('Season select populated with:', seasons);
}

// Open edit score modal
function openEditScoreModal(gameId) {
  editingGame = adminGames.find(g => g.id === gameId);
  if (!editingGame) {
    console.error('Game not found:', gameId);
    return;
  }
  
  console.log('Opening edit modal for game:', editingGame);
  console.log('Game data - week:', editingGame.week, '(type:', typeof editingGame.week + ')', 
              'season:', editingGame.season, '(type:', typeof editingGame.season + ')',
              'status:', editingGame.status, '(type:', typeof editingGame.status + ')');
  
  // Populate team selects first
  populateEditTeamSelects();
  
  // Populate season select dynamically
  populateEditSeasonSelect(editingGame.season);
  
  // Helper function to set select value and trigger change event for custom-select
  function setSelectValue(selectElement, value) {
    if (!selectElement) return;
    const strValue = String(value);
    selectElement.value = strValue;
    // Trigger change event to update custom-select UI
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('Set', selectElement.id, 'to:', strValue, '-> Current value:', selectElement.value);
  }
  
  // Use setTimeout to ensure DOM is updated before setting values
  setTimeout(() => {
    // Set current values
    document.getElementById('edit-game-title').textContent = t('game_id_label', { id: editingGame.id.substring(0, 8) });
    
    // Set team selections
    const homeTeamSelect = document.getElementById('edit-home-team');
    const awayTeamSelect = document.getElementById('edit-away-team');
    
    if (homeTeamSelect && editingGame.home_team_abbr) {
      setSelectValue(homeTeamSelect, editingGame.home_team_abbr);
    }
    
    if (awayTeamSelect && editingGame.away_team_abbr) {
      setSelectValue(awayTeamSelect, editingGame.away_team_abbr);
    }
    
    // Format date for datetime-local input (handle timezone properly)
    const gameDate = new Date(editingGame.game_date);
    // Adjust for local timezone
    const localDate = new Date(gameDate.getTime() - gameDate.getTimezoneOffset() * 60000);
    const formattedDate = localDate.toISOString().slice(0, 16);
    document.getElementById('edit-game-date').value = formattedDate;
    console.log('Set date to:', formattedDate);
    
    // Set week - dispatch change event for custom-select
    const weekSelect = document.getElementById('edit-game-week');
    if (weekSelect) {
      setSelectValue(weekSelect, editingGame.week);
    }
    
    // Set season - dispatch change event for custom-select
    const seasonSelect = document.getElementById('edit-game-season');
    if (seasonSelect) {
      setSelectValue(seasonSelect, editingGame.season);
    }
    
    // Set labels and scores
    document.getElementById('edit-home-label').textContent = t('team_points_label', { team: editingGame.home_team_abbr });
    document.getElementById('edit-away-label').textContent = t('team_points_label', { team: editingGame.away_team_abbr });
    document.getElementById('edit-home-score').value = editingGame.home_score ?? '';
    document.getElementById('edit-away-score').value = editingGame.away_score ?? '';
    
    // Status - dispatch change event for custom-select
    const statusSelect = document.getElementById('edit-status');
    if (statusSelect) {
      setSelectValue(statusSelect, editingGame.status || 'scheduled');
    }
    
    // Show modal
    document.getElementById('edit-score-modal').classList.add('active');
  }, 10);
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
  
  const homeTeamAbbr = document.getElementById('edit-home-team').value;
  const awayTeamAbbr = document.getElementById('edit-away-team').value;
  const gameDate = document.getElementById('edit-game-date').value;
  const week = parseInt(document.getElementById('edit-game-week').value);
  const season = document.getElementById('edit-game-season').value;
  const homeScoreVal = document.getElementById('edit-home-score').value;
  const awayScoreVal = document.getElementById('edit-away-score').value;
  let status = document.getElementById('edit-status').value;

  // Beide Endstände eingetragen, aber Status-Dropdown noch auf "Geplant"/"Live"
  // stehen gelassen (zeigt einfach den bisherigen Spielstatus, wird beim
  // Öffnen des Modals nicht automatisch umgestellt) - dann wuerde
  // calculatePointsForGame() (siehe firebaseUpdateGame() in
  // firebase-config.js, laeuft NUR bei status === 'finished') still
  // uebersprungen: Endstand ist gespeichert, aber niemand bekommt dafuer
  // Punkte, ohne dass das im UI auffaellt. Wer beide Endstaende eintraegt,
  // meint damit praktisch immer "Spiel ist vorbei".
  if (homeScoreVal !== '' && awayScoreVal !== '') {
    status = 'finished';
  }
  
  // Get team names
  const homeTeam = NFL_TEAMS.find(t => t.abbr === homeTeamAbbr);
  const awayTeam = NFL_TEAMS.find(t => t.abbr === awayTeamAbbr);
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('saving_ellipsis')}`;
  
  try {
    const updateData = {
      home_team: homeTeam?.name || homeTeamAbbr,
      away_team: awayTeam?.name || awayTeamAbbr,
      home_team_abbr: homeTeamAbbr,
      away_team_abbr: awayTeamAbbr,
      game_date: new Date(gameDate),
      week: week,
      season: season,
      status: status
    };
    
    // Only include scores if provided
    if (homeScoreVal !== '') {
      updateData.home_score = parseInt(homeScoreVal);
    }
    if (awayScoreVal !== '') {
      updateData.away_score = parseInt(awayScoreVal);
    }
    
    await firebaseUpdateGame(editingGame.id, updateData);
    
    closeEditScoreModal();
    await loadAdminData();
  } catch (error) {
    console.error('Error updating game:', error);
    alert(error.message || t('error_updating_game'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fas fa-check"></i> ${t('btn_save')}`;
  }
}

// Handle delete game
async function handleDeleteGame(gameId) {
  if (!confirm(t('confirm_delete_game'))) return;

  try {
    await firebaseDeleteGame(gameId);
    await loadAdminData();
  } catch (error) {
    console.error('Error deleting game:', error);
    alert(error.message || t('error_deleting_game'));
  }
}

// Handle delete user
async function handleDeleteUser(userId, username) {
  username = decodeURIComponent(username);
  if (!confirm(t('confirm_delete_user', { username }))) return;

  try {
    await firebaseDeleteUser(userId);
    await loadAdminData();
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(error.message || t('error_deleting_user'));
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
