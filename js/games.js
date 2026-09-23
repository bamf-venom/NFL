// Games page logic

Object.assign(TRANSLATIONS.de, {
  games_title: 'Spiele', games_subtitle: 'Wähle ein Spiel und platziere deine Wette',
  no_group: 'Keine Gruppe',
  week_wildcard: 'Wild Card Weekend', week_divisional: 'Divisional Playoffs',
  week_conference: 'Conference Championships', week_superbowl: 'Super Bowl',
  error_loading_games: 'Die Spiele konnten nicht geladen werden. Bitte versuche es erneut.',
  no_games_found: 'Keine Spiele gefunden', no_games_admin: 'Als Admin kannst du neue Spiele hinzufügen.',
  no_games_user: 'Es sind noch keine Spiele geplant.', btn_go_to_admin: 'Zum Admin Panel',
  status_locked: 'GESPERRT', lock_title_locked: 'Tipp gesperrt - Spiel läuft/ist beendet',
  lock_title_open: 'Tipp noch möglich', my_pick: 'Dein Tipp',
  no_group_bets: 'Noch keine Wetten in der Gruppe',
  back_to_games: 'Zurück zu den Spielen'
});
Object.assign(TRANSLATIONS.en, {
  games_title: 'Games', games_subtitle: 'Choose a game and place your bet',
  no_group: 'No group',
  week_wildcard: 'Wild Card Weekend', week_divisional: 'Divisional Playoffs',
  week_conference: 'Conference Championships', week_superbowl: 'Super Bowl',
  error_loading_games: 'The games could not be loaded. Please try again.',
  no_games_found: 'No games found', no_games_admin: 'As admin, you can add new games.',
  no_games_user: 'No games have been scheduled yet.', btn_go_to_admin: 'Go to admin panel',
  status_locked: 'LOCKED', lock_title_locked: 'Picks locked - game is live/finished',
  lock_title_open: 'Picks still open', my_pick: 'Your pick',
  no_group_bets: 'No picks in this group yet',
  back_to_games: 'Back to games'
});

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

  // Zuerst nur EINE Saison laden (gespeicherte Auswahl oder aktuelle NFL-Saison) -
  // deutlich schneller als alle jemals gespielten Saisons auf einmal, da die
  // aktuelle Woche ohnehin nur aus dieser einen Saison kommt
  const initialSeason = selectedSeason || getCurrentNFLSeason();

  await loadGames(initialSeason);
  populateSeasonFilter(); // Season first - will auto-select current season if none saved
  populateWeekFilter();

  // Render games with filters applied
  renderGames();

  // Live-Countdown bis zur Wett-Sperre neben dem "GEPLANT"-Badge - aktualisiert
  // die Anzeige jede Sekunde ohne Re-Render, rendert Liste/Detail nur neu wenn
  // ein Countdown abläuft (Badge muss dann auf "GESPERRT" wechseln)
  startBettingCountdownTicker(
    gameId => gamesData.find(g => g.id === gameId),
    handleBettingCountdownExpired
  );

  // Deep-Link/Reload während eine Spiel-Detail-Ansicht offen war - direkt
  // dorthin springen statt erst kurz die Liste zu zeigen
  const deepLinkGameId = new URLSearchParams(window.location.search).get('game');
  if (deepLinkGameId) {
    openGameDetail(deepLinkGameId, { pushState: false });
  }

  // Week filter change
  document.getElementById('week-filter').addEventListener('change', function(e) {
    selectedWeek = e.target.value ? parseInt(e.target.value) : null;
    saveFilterState();
    renderGames();
  });

  // Season filter change
  document.getElementById('season-filter').addEventListener('change', async function(e) {
    selectedSeason = e.target.value; // Always required now
    selectedWeek = null; // Reset week when season changes to auto-select new current week

    // Falls die gewählte Saison noch nicht (vollständig) geladen ist, jetzt
    // nachladen. Der Hintergrund-Fetch (loadAllSeasonsInBackground) lädt zwar
    // irgendwann alle Saisons, aber falls der Nutzer schneller klickt als der
    // im Hintergrund fertig wird, holen wir die Saison hier gezielt nach.
    if (!gamesData.some(g => g.season === selectedSeason)) {
      try {
        const seasonGames = await firebaseGetGames({ season: selectedSeason });
        // Mit bereits geladenen Spielen anderer Saisons zusammenführen
        const otherSeasons = gamesData.filter(g => g.season !== selectedSeason);
        gamesData = [...otherSeasons, ...seasonGames];
      } catch (error) {
        console.error('Error loading season on demand:', error);
      }
    }

    // Update week filter based on selected season
    populateWeekFilter();
    saveFilterState();
    renderGames();
  });

  // Group filter change - note: event listener is already added in populateGroupFilter

  // Im Hintergrund alle übrigen Saisons nachladen, ohne die schnelle initiale
  // Anzeige zu blockieren
  loadAllSeasonsInBackground();
}

// Load games from Firebase
// seasonFilter: wenn gesetzt, wird NUR diese Saison geladen (schneller initialer
// Ladevorgang) statt aller jemals gespielten Saisons. Der Rest wird danach im
// Hintergrund nachgeladen, siehe loadAllSeasonsInBackground().
async function loadGames(seasonFilter = null) {
  try {
    // Lade Spiele, User-Wetten, Gruppen und aktuellen User parallel
    const [games, userBets, groups, freshUser] = await Promise.all([
      firebaseGetGames(seasonFilter ? { season: seasonFilter } : {}),
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
        <h3 class="empty-title">${t('error_loading_title')}</h3>
        <p class="empty-text">${t('error_loading_games')}</p>
        <button class="btn btn-primary" onclick="loadGames()">${t('btn_retry')}</button>
      </div>
    `;
  }
}

// Lädt im Hintergrund (nicht blockierend) ALLE Saisons nach, damit der
// Saison-Filter alle historischen Optionen zeigt und ein späterer Wechsel der
// Saison keinen zusätzlichen Ladevorgang mehr braucht. Die aktuell sichtbare
// Auswahl (Season+Woche) bleibt dabei unverändert - es werden nur weitere
// Optionen im Filter ergänzt.
async function loadAllSeasonsInBackground() {
  try {
    const allGames = await firebaseGetGames();

    const loadedSeasons = new Set(gamesData.map(g => g.season));
    const allSeasons = new Set(allGames.map(g => g.season));

    if (allSeasons.size > loadedSeasons.size) {
      gamesData = allGames;
      populateSeasonFilter();
    }
  } catch (error) {
    console.error('Error loading additional seasons in background:', error);
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
      <option value="none">${t('no_group')}</option>
      ${userGroups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
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
    const promises = gamesData.filter(game => game && game.id).map(async (game) => {
      // Prüfe ob Gruppe noch die gleiche ist (früher Abbruch)
      if (selectedGroupId !== loadingGroupId) return null;

      const bets = await firebaseGetGroupBets(loadingGroupId, game.id, game.status === 'finished');
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
    case 19: return t('week_wildcard');
    case 20: return t('week_divisional');
    case 21: return t('week_conference');
    case 22: return t('week_superbowl');
    default: return t('week_n', { n: week });
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
  filter.innerHTML = `<option value="">${t('all_weeks')}</option>`;
  
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

// Wird aufgerufen sobald ein Wett-Sperre-Countdown abläuft. Rendert die Liste
// neu (Badge wechselt auf "GESPERRT") und, falls gerade eine Detail-Ansicht
// offen ist, auch diese (currentGameData/renderGameDetail aus game-detail.js,
// läuft auf derselben Seite und teilt sich den globalen Scope)
function handleBettingCountdownExpired() {
  renderGames();
  if (typeof currentGameData !== 'undefined' && currentGameData) {
    renderGameDetail();
  }
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
        <h3 class="empty-title">${t('no_games_found')}</h3>
        <p class="empty-text">
          ${user?.is_admin ? t('no_games_admin') : t('no_games_user')}
        </p>
        ${user?.is_admin ? `
          <button class="btn btn-primary" onclick="window.location.href='admin.html'" data-testid="go-to-admin">
            ${t('btn_go_to_admin')}
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
      const bettingLockTime = new Date(gameDate.getTime() - BETTING_LOCK_MINUTES_BEFORE_KICKOFF * 60000);
      const isGameStarted = now >= bettingLockTime;

      // Wetten sind geschlossen wenn wir innerhalb der Sperrfrist vor Anpfiff sind,
      // das Spiel aber noch nicht als "live"/"finished" markiert wurde
      const isBettingClosed = game.status === 'scheduled' && isGameStarted;

      // Schloss-Icon: rot/geschlossen ab Sperrfrist bzw. wenn Spiel läuft/beendet ist, grün/offen wenn noch tippbar
      const isLocked = isGameStarted || game.status === 'finished' || game.status === 'live';
      const lockIconHTML = isLocked
        ? `<i class="fas fa-lock lock-icon locked" title="${t('lock_title_locked')}"></i>`
        : `<i class="fas fa-lock-open lock-icon open" title="${t('lock_title_open')}"></i>`;

      const myBet = userBetsMap[game.id];
      const groupBets = groupBetsMap[game.id] || [];

      // Badge zeigt den tatsächlichen Status - aber wenn die Sperrfrist erreicht ist
      // und die DB das (noch) nicht mitbekommen hat ("scheduled"), zeigen wir trotzdem
      // "GESPERRT" in rot, statt fälschlich "GEPLANT" in grün
      let badgeClass = status.class;
      let badgeText = status.text;
      if (isBettingClosed) {
        badgeClass = 'badge-error';
        badgeText = t('status_locked');
      }
      
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
             style="animation: fadeIn 0.4s ease-out ${gameIndex * 0.05}s both; --home-color: ${TEAM_COLORS[game.home_team_abbr] || 'var(--accent)'}; --away-color: ${TEAM_COLORS[game.away_team_abbr] || 'var(--accent)'};"
             data-testid="game-card-${game.id}">
          
          <!-- Game Header - klickbar -->
          <div class="game-card-header" onclick="openGameDetail('${game.id}')">
            <!-- Top Row: Badge links, Countdown mittig, eigene Wette + Pfeil rechts (für Mobile) -->
            <div class="game-card-top-row">
              <div class="top-row-left">
                <div class="badge-lock-group">
                  <span class="badge ${badgeClass}">${badgeText}</span>
                  ${lockIconHTML}
                </div>
              </div>
              <div class="top-row-center">
                ${getBettingCountdownHTML(game)}
              </div>
              <div class="top-row-right">
                ${myBet ? `
                  <div class="my-bet-inline-mobile" data-testid="my-bet-mobile-${game.id}">
                    <span class="my-bet-inline-score">${myBet.home_score_prediction}:${myBet.away_score_prediction}</span>
                    ${game.status === 'finished' ? `<span class="my-bet-inline-pts ${myBet.points_earned > 0 ? 'earned' : ''}">${myBet.points_earned || 0}P</span>` : ''}
                  </div>
                ` : ''}
                <i class="fas fa-chevron-right game-arrow"></i>
              </div>
            </div>
            
            <!-- Desktop Badge (wird auf Mobile versteckt) -->
            <div class="desktop-only badge-lock-group">
              <span class="badge ${badgeClass}">${badgeText}</span>
              ${getBettingCountdownHTML(game)}
              ${lockIconHTML}
            </div>
            
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
                  <div class="my-bet-inline-label">${t('my_pick')}</div>
                  <div class="my-bet-inline-score-desktop">${myBet.home_score_prediction} : ${myBet.away_score_prediction}</div>
                  ${game.status === 'finished' ? `<div class="my-bet-inline-pts-desktop ${myBet.points_earned > 0 ? 'earned' : ''}">${myBet.points_earned || 0} ${t('pts_short')}</div>` : ''}
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
                  <span>${t('no_group_bets')}</span>
                </div>
              ` : `
                <div class="group-bets-list">
                  ${displayGroupBets.map(bet => `
                    <div class="group-bet-item ${bet.user_id === currentUser?.id ? 'own' : ''}" data-testid="group-bet-${bet.id}">
                      <div class="group-bet-user">
                        <div class="group-bet-avatar">
                          ${bet.profile_picture ? `<img src="${bet.profile_picture}" alt="${escapeHtml(bet.username)}" class="group-bet-avatar-img" data-fallback-letter="${escapeHtml(bet.username.charAt(0).toUpperCase())}" onerror="this.style.display='none'; this.parentElement.textContent=this.dataset.fallbackLetter;">` : escapeHtml(bet.username.charAt(0).toUpperCase())}
                        </div>
                        <span class="group-bet-username">${bet.user_id === currentUser?.id ? t('you') : escapeHtml(bet.username)}</span>
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

// ==================== SPIEL-DETAIL ALS IN-PAGE-ANSICHT ====================
// Öffnet die Detail-Ansicht eines Spiels OHNE Seiten-Navigation (früher
// window.location.href='game-detail.html?id=...') - dadurch entfällt bei
// jedem Spiel-Öffnen/Zurückgehen der komplette Seiten-Reload samt erneuter
// Firebase-Initialisierung, was der Hauptgrund für die lange Ladezeit war.
// loadGameDetail() (in game-detail.js) nutzt gamesData/userBetsMap, die hier
// schon im Speicher sind, statt sie erneut von Firestore zu laden.
async function openGameDetail(gameId, { pushState = true } = {}) {
  const listView = document.getElementById('games-list-view');
  const detailView = document.getElementById('game-detail-view');
  if (!listView || !detailView) return;

  if (pushState) {
    history.pushState({ gameId }, '', `games.html?game=${encodeURIComponent(gameId)}`);
  }

  listView.classList.add('hidden');
  detailView.classList.remove('hidden');
  window.scrollTo(0, 0);

  document.getElementById('game-detail-container').innerHTML = `
    <div class="loading-container"><div class="spinner spinner-lg"></div></div>
  `;

  await loadGameDetail(gameId);
}

// Zurück zur Spiele-Liste - reiner DOM-Wechsel, kein Reload. Die Liste
// selbst wurde nie zerstört, Scroll-Position bleibt dadurch automatisch
// erhalten.
function closeGameDetail({ pushState = true } = {}) {
  const listView = document.getElementById('games-list-view');
  const detailView = document.getElementById('game-detail-view');
  if (!listView || !detailView) return;

  if (pushState) {
    history.pushState({}, '', 'games.html');
  }

  detailView.classList.add('hidden');
  listView.classList.remove('hidden');
}

// Reagiert auf Browser-/Android-Hardware-Zurück-Taste, wenn eine
// Detail-Ansicht per pushState geöffnet wurde
window.addEventListener('popstate', () => {
  const gameId = new URLSearchParams(window.location.search).get('game');
  if (gameId) {
    openGameDetail(gameId, { pushState: false });
  } else {
    closeGameDetail({ pushState: false });
  }
});

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
