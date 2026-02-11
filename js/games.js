// Games page logic

let gamesData = [];
let userBetsMap = {}; // Map von game_id zu eigener Wette
let userGroups = []; // Gruppen des Users
let selectedWeek = null;
let selectedSeason = null; // Season Filter
let selectedGroupId = null; // Gewählte Gruppe für Filter
let groupBetsMap = {}; // Map von game_id zu Array von Gruppen-Wetten

// Save filter state to localStorage
function saveFilterState() {
  const filterState = {
    season: selectedSeason,
    week: selectedWeek,
    groupId: selectedGroupId,
    scrollY: window.scrollY
  };
  localStorage.setItem('nflpoints_games_filter', JSON.stringify(filterState));
}

// Load filter state from localStorage
function loadFilterState() {
  try {
    const saved = localStorage.getItem('nflpoints_games_filter');
    if (saved) {
      const state = JSON.parse(saved);
      selectedSeason = state.season || null;
      selectedWeek = state.week || null;
      selectedGroupId = state.groupId || null;
      
      // Restore scroll position after a small delay (after render)
      if (state.scrollY) {
        setTimeout(() => {
          window.scrollTo(0, state.scrollY);
        }, 100);
      }
    }
  } catch (e) {
    console.log('No saved filter state');
  }
}

// Initialize games page
async function initGamesPage() {
  // Load saved filter state FIRST
  loadFilterState();
  
  await loadGames();
  populateSeasonFilter(); // Season first - will auto-select current season if none saved
  populateWeekFilter();
  
  // Render games with filters applied
  renderGames();
  
  // Week filter change
  document.getElementById('week-filter').addEventListener('change', function(e) {
    selectedWeek = e.target.value ? parseInt(e.target.value) : null;
    saveFilterState();
    renderGames();
  });
  
  // Season filter change
  document.getElementById('season-filter').addEventListener('change', function(e) {
    selectedSeason = e.target.value; // Always required now
    selectedWeek = null; // Reset week when season changes to auto-select new current week
    // Update week filter based on selected season
    populateWeekFilter();
    saveFilterState();
    renderGames();
  });
  
  // Group filter change - note: event listener is already added in populateGroupFilter
}

// Load games from Firebase
async function loadGames() {
  try {
    // Lade Spiele, User-Wetten, Gruppen und aktuellen User parallel
    const [games, userBets, groups, freshUser] = await Promise.all([
      firebaseGetGames(),
      firebaseGetCurrentUserBets(),
      firebaseGetUserGroups(),
      firebaseGetCurrentUser()
    ]);
    
    // Update currentUser mit frischen Daten (inkl. profile_picture)
    if (freshUser) {
      currentUser = freshUser;
      localStorage.setItem('user', JSON.stringify(currentUser));
    }
    
    gamesData = games;
    userGroups = groups;
    
    // Erstelle Map von game_id zu eigener Wette
    userBetsMap = {};
    userBets.forEach(bet => {
      userBetsMap[bet.game_id] = bet;
    });
    
    // Populate group filter (will restore saved group selection)
    populateGroupFilter();
    
    // Load group bets if a group was previously selected and still valid
    if (selectedGroupId && userGroups.find(g => g.id === selectedGroupId)) {
      await loadGroupBets();
    }
    
    // Don't render here - let populateSeasonFilter and populateWeekFilter handle it
  } catch (error) {
    console.error('Error loading games:', error);
    document.getElementById('games-container').innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-exclamation-triangle fa-3x empty-icon" style="color: var(--error);"></i>
        <h3 class="empty-title">Fehler beim Laden</h3>
        <p class="empty-text">Die Spiele konnten nicht geladen werden. Bitte versuche es erneut.</p>
        <button class="btn btn-primary" onclick="loadGames()">Erneut versuchen</button>
      </div>
    `;
  }
}

// Populate group filter
function populateGroupFilter() {
  const filterContainer = document.querySelector('.filter-container');
  
  // Entferne ALLE alten Group Filter Elemente (Wrapper UND Select)
  document.querySelectorAll('.custom-select[data-testid="group-filter"], #group-filter').forEach(el => {
    const wrapper = el.closest('.custom-select');
    if (wrapper) {
      wrapper.remove();
    } else {
      el.remove();
    }
  });
  
  // Nur anzeigen wenn User in mindestens einer Gruppe ist
  if (userGroups.length === 0) return;
  
  const groupFilterHTML = `
    <select id="group-filter" class="form-input" style="width: auto; min-width: 150px;" data-testid="group-filter">
      <option value="none">Keine Gruppe</option>
      ${userGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
    </select>
  `;
  
  filterContainer.insertAdjacentHTML('beforeend', groupFilterHTML);
  
  // Restore saved group selection if valid
  const groupFilter = document.getElementById('group-filter');
  if (selectedGroupId) {
    const validGroup = userGroups.find(g => g.id === selectedGroupId);
    if (validGroup) {
      groupFilter.value = selectedGroupId;
    } else {
      selectedGroupId = null;
      saveFilterState();
    }
  }
  
  // Event listener hinzufügen
  groupFilter.addEventListener('change', async function(e) {
    const value = e.target.value;
    const newGroupId = (value === 'none' || value === '') ? null : value;
    
    // Verhindere doppelte Klicks während Daten laden
    if (groupFilter.disabled) return;
    
    selectedGroupId = newGroupId;
    saveFilterState();
    
    // Leere groupBetsMap SOFORT
    groupBetsMap = {};
    
    // Wenn eine Gruppe ausgewählt, lade deren Wetten
    if (selectedGroupId) {
      // Deaktiviere Filter während Laden
      groupFilter.disabled = true;
      groupFilter.style.opacity = '0.6';
      
      try {
        await loadGroupBets();
      } finally {
        // Reaktiviere Filter
        groupFilter.disabled = false;
        groupFilter.style.opacity = '1';
      }
    }
    
    // Rendere nur EINMAL am Ende
    renderGames();
  });
}

// Load bets from selected group
async function loadGroupBets() {
  // Sofort leeren wenn keine Gruppe ausgewählt
  if (!selectedGroupId || selectedGroupId === 'none') {
    groupBetsMap = {};
    return;
  }
  
  // Merke aktuelle Gruppe für Race-Condition Check
  const loadingGroupId = selectedGroupId;
  
  try {
    const tempGroupBetsMap = {};
    
    // Lade alle Wetten für jedes Spiel von der Gruppe parallel für bessere Performance
    const promises = gamesData.map(async (game) => {
      // Prüfe ob Gruppe noch die gleiche ist (früher Abbruch)
      if (selectedGroupId !== loadingGroupId) return null;
      
      const bets = await firebaseGetGroupBets(loadingGroupId, game.id);
      if (bets.length > 0) {
        return { gameId: game.id, bets };
      }
      return null;
    });
    
    const results = await Promise.all(promises);
    
    // Prüfe nochmal ob Gruppe noch die gleiche ist nach dem Laden
    if (selectedGroupId !== loadingGroupId) {
      console.log('Group changed during load, discarding results');
      return;
    }
    
    // Ergebnisse in Map übertragen
    results.forEach(result => {
      if (result) {
        tempGroupBetsMap[result.gameId] = result.bets;
      }
    });
    
    groupBetsMap = tempGroupBetsMap;
  } catch (error) {
    console.error('Error loading group bets:', error);
    // Nur leeren wenn noch gleiche Gruppe
    if (selectedGroupId === loadingGroupId) {
      groupBetsMap = {};
    }
  }
}

// Format season display name (e.g., "2025" -> "2025/2026")
function getSeasonDisplayName(season) {
  const startYear = parseInt(season);
  const endYear = startYear + 1;
  return `${startYear}/${endYear}`;
}

// Determine current NFL season based on date
// NFL season starts in September and ends in February
function getCurrentNFLSeason() {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  
  // NFL Season: September (month 8) to February (month 1)
  // If January or February, we're in the previous year's season
  if (month <= 1) { // January or February
    return (year - 1).toString();
  }
  // If March to August, no active season - return previous season
  if (month >= 2 && month <= 7) {
    return (year - 1).toString();
  }
  // September onwards - current year's season
  return year.toString();
}

// Determine current week based on games in the selected season
function getCurrentWeekForSeason(season) {
  const now = new Date();
  
  // Get games for this season
  const seasonGames = gamesData.filter(g => g.season === season);
  if (seasonGames.length === 0) return null;
  
  // Get all weeks in this season sorted
  const weeks = [...new Set(seasonGames.map(g => g.week))].sort((a, b) => a - b);
  if (weeks.length === 0) return null;
  
  // Find the latest week that has started or is currently active
  let currentWeek = null;
  
  for (const week of weeks) {
    const weekGames = seasonGames.filter(g => g.week === week);
    const firstGameDate = new Date(Math.min(...weekGames.map(g => new Date(g.game_date).getTime())));
    const lastGameDate = new Date(Math.max(...weekGames.map(g => new Date(g.game_date).getTime())));
    
    // If the first game of this week hasn't started yet, use the previous week
    if (firstGameDate > now) {
      break;
    }
    
    currentWeek = week;
    
    // If we're currently within this week's games (between first and last game + 1 day buffer)
    const weekEndBuffer = new Date(lastGameDate.getTime() + 24 * 60 * 60 * 1000);
    if (now <= weekEndBuffer) {
      break;
    }
  }
  
  // If no current week found (season hasn't started), return first week
  if (currentWeek === null) {
    currentWeek = weeks[0];
  }
  
  // Check if season is over (all games finished)
  const allGamesFinished = seasonGames.every(g => g.status === 'finished');
  const lastWeek = weeks[weeks.length - 1];
  
  // If season is over, show the last week (Super Bowl is week 22)
  if (allGamesFinished) {
    return lastWeek;
  }
  
  return currentWeek;
}

// Populate season filter - always requires a season selection
function populateSeasonFilter() {
  const seasons = [...new Set(gamesData.map(g => g.season))].sort((a, b) => b - a); // Newest first
  const filter = document.getElementById('season-filter');
  
  if (!filter) return;
  
  // Clear existing options - NO "Alle Saisons" option
  filter.innerHTML = '';
  
  // Add seasons with proper display name
  seasons.forEach((season, index) => {
    const option = document.createElement('option');
    option.value = season;
    option.textContent = getSeasonDisplayName(season);
    filter.appendChild(option);
  });
  
  // Check if saved season is still valid
  if (selectedSeason && seasons.includes(selectedSeason)) {
    // Use saved season
    filter.value = selectedSeason;
  } else if (seasons.length > 0) {
    // Auto-select current NFL season or latest available
    const currentNFLSeason = getCurrentNFLSeason();
    
    // Try to find the current NFL season in available seasons
    if (seasons.includes(currentNFLSeason)) {
      selectedSeason = currentNFLSeason;
    } else {
      // Fallback to newest available season
      selectedSeason = seasons[0];
    }
    filter.value = selectedSeason;
  }
  
  // Save the initial state
  saveFilterState();
}

// Get display name for week (including playoffs)
function getWeekDisplayName(week) {
  switch (week) {
    case 19: return 'Wild Card Weekend';
    case 20: return 'Divisional Playoffs';
    case 21: return 'Conference Championships';
    case 22: return 'Super Bowl';
    default: return `Woche ${week}`;
  }
}

// Populate week filter
function populateWeekFilter() {
  // Filter weeks based on selected season (always required now)
  let filteredGames = gamesData;
  if (selectedSeason) {
    filteredGames = gamesData.filter(g => g.season === selectedSeason);
  }
  
  const weeks = [...new Set(filteredGames.map(g => g.week))].sort((a, b) => a - b);
  const filter = document.getElementById('week-filter');
  
  // Clear existing options
  filter.innerHTML = '<option value="">Alle Wochen</option>';
  
  weeks.forEach(week => {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = getWeekDisplayName(week);
    filter.appendChild(option);
  });
  
  // Check if saved week is still valid for this season
  if (selectedWeek && weeks.includes(selectedWeek)) {
    // Use saved week
    filter.value = selectedWeek;
  } else if (selectedSeason) {
    // Auto-select current week if no valid saved week
    const currentWeek = getCurrentWeekForSeason(selectedSeason);
    if (currentWeek !== null && weeks.includes(currentWeek)) {
      selectedWeek = currentWeek;
      filter.value = selectedWeek;
    } else {
      selectedWeek = null;
      filter.value = '';
    }
  } else {
    selectedWeek = null;
    filter.value = '';
  }
  
  // Save state after week is set
  saveFilterState();
}

// Render games list
function renderGames() {
  const container = document.getElementById('games-container');
  const user = currentUser;
  
  let filteredGames = gamesData;
  
  // Apply season filter
  if (selectedSeason) {
    filteredGames = filteredGames.filter(g => g.season === selectedSeason);
  }
  
  // Apply week filter
  if (selectedWeek) {
    filteredGames = filteredGames.filter(g => g.week === selectedWeek);
  }
  
  if (filteredGames.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-calendar fa-3x empty-icon"></i>
        <h3 class="empty-title">Keine Spiele gefunden</h3>
        <p class="empty-text">
          ${user?.is_admin ? 'Als Admin kannst du neue Spiele hinzufügen.' : 'Es sind noch keine Spiele geplant.'}
        </p>
        ${user?.is_admin ? `
          <button class="btn btn-primary" onclick="window.location.href='admin.html'" data-testid="go-to-admin">
            Zum Admin Panel
          </button>
        ` : ''}
      </div>
    `;
    return;
  }
  
  // Group games by date
  const groupedGames = filteredGames.reduce((acc, game) => {
    const date = new Date(game.game_date).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(game);
    return acc;
  }, {});
  
  let html = '';
  let gameIndex = 0; // Global index for staggered animation
  
  Object.entries(groupedGames).forEach(([date, dateGames]) => {
    html += `
      <div class="games-date-group">
        <div class="date-header">
          <i class="fas fa-calendar"></i>
          ${formatDateOnly(date)}
        </div>
        <div class="games-list">
    `;
    
    dateGames.forEach(game => {
      const status = getStatusBadge(game.status);
      const gameDate = new Date(game.game_date);
      const now = new Date();
      const isGameStarted = gameDate < now;
      
      // Wetten sind geschlossen wenn das Spiel gestartet ist, aber nicht "live" oder "finished" ist
      // UND das Spiel-Datum wirklich in der Vergangenheit liegt
      const isBettingClosed = game.status === 'scheduled' && isGameStarted;
      const myBet = userBetsMap[game.id];
      const groupBets = groupBetsMap[game.id] || [];
      
      // Zeige immer den tatsächlichen Status aus der Datenbank
      let badgeClass = status.class;
      let badgeText = status.text;
      
      // Wenn Gruppe aktiv: eigene Wette in groupBets einfügen falls nicht schon drin
      let displayGroupBets = groupBets;
      if (selectedGroupId && selectedGroupId !== 'none' && myBet) {
        // Prüfe ob eigene Wette schon in groupBets ist
        const myBetInGroup = groupBets.find(b => b.user_id === currentUser?.id);
        if (!myBetInGroup) {
          // Füge eigene Wette hinzu MIT Profilbild vom currentUser
          displayGroupBets = [{ 
            ...myBet, 
            user_id: currentUser?.id,
            username: currentUser?.username,
            profile_picture: currentUser?.profile_picture || null
          }, ...groupBets];
        }
      }
      
      // Sortiere: eigene Wette zuerst
      if (selectedGroupId && selectedGroupId !== 'none') {
        displayGroupBets = displayGroupBets.sort((a, b) => {
          if (a.user_id === currentUser?.id) return -1;
          if (b.user_id === currentUser?.id) return 1;
          return 0;
        });
      }
      
      html += `
        <div class="card card-hover game-card-expanded ${isBettingClosed ? 'opacity-70' : ''}" 
             style="animation: fadeIn 0.4s ease-out ${gameIndex * 0.05}s both;"
             data-testid="game-card-${game.id}">
          
          <!-- Game Header - klickbar -->
          <div class="game-card-header" onclick="window.location.href='game-detail.html?id=${game.id}'">
            <!-- Top Row: Badge + eigene Wette (für Mobile) -->
            <div class="game-card-top-row">
              <span class="badge ${badgeClass}">${badgeText}</span>
              ${myBet ? `
                <div class="my-bet-inline-mobile" data-testid="my-bet-mobile-${game.id}">
                  <span class="my-bet-inline-score">${myBet.home_score_prediction}:${myBet.away_score_prediction}</span>
                  ${game.status === 'finished' ? `<span class="my-bet-inline-pts ${myBet.points_earned > 0 ? 'earned' : ''}">${myBet.points_earned || 0}P</span>` : ''}
                </div>
              ` : ''}
              <i class="fas fa-chevron-right game-arrow"></i>
            </div>
            
            <!-- Desktop Badge (wird auf Mobile versteckt) -->
            <span class="badge ${badgeClass} desktop-only">${badgeText}</span>
            
            <div class="game-teams">
              <div class="game-team home">
                <div class="team-info left">
                  <div class="team-abbr">${game.home_team_abbr}</div>
                  <div class="team-name">${game.home_team}</div>
                </div>
              </div>
              
              ${game.status === 'finished' || game.status === 'live' ? `
                <div class="game-score-with-logos">
                  ${getTeamLogoHTML(game.home_team_abbr, 48)}
                  <div class="game-score">
                    <span class="game-score-num">${game.home_score ?? '-'}</span>
                    <span class="game-score-sep">:</span>
                    <span class="game-score-num">${game.away_score ?? '-'}</span>
                  </div>
                  ${getTeamLogoHTML(game.away_team_abbr, 48)}
                </div>
              ` : `
                <div class="game-score-with-logos">
                  ${getTeamLogoHTML(game.home_team_abbr, 48)}
                  <div class="game-time">
                    <i class="fas fa-clock"></i>
                    <span>${formatTime(game.game_date)}</span>
                  </div>
                  ${getTeamLogoHTML(game.away_team_abbr, 48)}
                </div>
              `}
              
              <div class="game-team away">
                <div class="team-info right">
                  <div class="team-abbr">${game.away_team_abbr}</div>
                  <div class="team-name">${game.away_team}</div>
                </div>
              </div>
            </div>
            
            <!-- Rechter Bereich: Eigene Wette + Pfeil (Desktop) -->
            <div class="game-card-right desktop-only">
              ${myBet ? `
                <div class="my-bet-inline-desktop" data-testid="my-bet-desktop-${game.id}">
                  <div class="my-bet-inline-label">Dein Tipp</div>
                  <div class="my-bet-inline-score-desktop">${myBet.home_score_prediction} : ${myBet.away_score_prediction}</div>
                  ${game.status === 'finished' ? `<div class="my-bet-inline-pts-desktop ${myBet.points_earned > 0 ? 'earned' : ''}">${myBet.points_earned || 0} Pkt</div>` : ''}
                </div>
              ` : (!isBettingClosed && game.status === 'scheduled' ? `
                <div class="my-bet-inline-desktop no-bet">
                  <i class="fas fa-plus"></i>
                </div>
              ` : '')}
              <i class="fas fa-chevron-right game-arrow"></i>
            </div>
          </div>
          
          <!-- Gruppen-Wetten Bereich - nur wenn eine Gruppe ausgewählt ist -->
          ${userGroups.length > 0 && selectedGroupId && selectedGroupId !== 'none' ? `
            <div class="group-bets-section">
              ${displayGroupBets.length === 0 ? `
                <div class="no-group-bets">
                  <i class="fas fa-users"></i>
                  <span>Noch keine Wetten in der Gruppe</span>
                </div>
              ` : `
                <div class="group-bets-list">
                  ${displayGroupBets.map(bet => `
                    <div class="group-bet-item ${bet.user_id === currentUser?.id ? 'own' : ''}" data-testid="group-bet-${bet.id}">
                      <div class="group-bet-user">
                        <div class="group-bet-avatar">
                          ${bet.profile_picture ? `<img src="${bet.profile_picture}" alt="${bet.username}" class="group-bet-avatar-img" onerror="this.style.display='none'; this.parentElement.innerHTML='${bet.username.charAt(0).toUpperCase()}';">` : bet.username.charAt(0).toUpperCase()}
                        </div>
                        <span class="group-bet-username">${bet.user_id === currentUser?.id ? 'Du' : bet.username}</span>
                      </div>
                      <div class="group-bet-prediction">
                        ${bet.home_score_prediction} : ${bet.away_score_prediction}
                      </div>
                      ${game.status === 'finished' ? `
                        <div class="group-bet-points ${bet.points_earned > 0 ? 'earned' : ''}">
                          ${bet.points_earned || 0}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          ` : ''}
        </div>
      `;
      gameIndex++; // Increment for next animation delay
    });
    
    html += '</div></div>';
  });
  
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
    initGamesPage();
  }
  
  // Save scroll position before leaving the page
  window.addEventListener('beforeunload', saveFilterState);
  
  // Also save when clicking on game cards (navigation)
  document.addEventListener('click', function(e) {
    const gameCard = e.target.closest('.game-card-expanded');
    if (gameCard) {
      saveFilterState();
    }
  });
});
