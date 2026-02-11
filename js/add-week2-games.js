// ==================== WEEK 2 GAMES - SEASON 2025-26 ====================
// Führe diese Funktion in der Browser-Konsole aus (als Admin eingeloggt)
// Oder füge dieses Script temporär auf der Admin-Seite ein

const WEEK2_GAMES_2025 = [
  // Thursday, September 11, 2025
  {
    home_team: 'Green Bay Packers',
    away_team: 'Washington Commanders',
    home_team_abbr: 'GB',
    away_team_abbr: 'WAS',
    game_date: '2025-09-11T20:15:00',
    week: 2,
    season: '2025'
  },
  
  // Sunday, September 14, 2025 - 1:00 PM ET (19:00 DE)
  {
    home_team: 'Cincinnati Bengals',
    away_team: 'Jacksonville Jaguars',
    home_team_abbr: 'CIN',
    away_team_abbr: 'JAX',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'Dallas Cowboys',
    away_team: 'New York Giants',
    home_team_abbr: 'DAL',
    away_team_abbr: 'NYG',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'Detroit Lions',
    away_team: 'Chicago Bears',
    home_team_abbr: 'DET',
    away_team_abbr: 'CHI',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'Tennessee Titans',
    away_team: 'Los Angeles Rams',
    home_team_abbr: 'TEN',
    away_team_abbr: 'LAR',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'Miami Dolphins',
    away_team: 'New England Patriots',
    home_team_abbr: 'MIA',
    away_team_abbr: 'NE',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'New Orleans Saints',
    away_team: 'San Francisco 49ers',
    home_team_abbr: 'NO',
    away_team_abbr: 'SF',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'New York Jets',
    away_team: 'Buffalo Bills',
    home_team_abbr: 'NYJ',
    away_team_abbr: 'BUF',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'Pittsburgh Steelers',
    away_team: 'Seattle Seahawks',
    home_team_abbr: 'PIT',
    away_team_abbr: 'SEA',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'Baltimore Ravens',
    away_team: 'Cleveland Browns',
    home_team_abbr: 'BAL',
    away_team_abbr: 'CLE',
    game_date: '2025-09-14T19:00:00',
    week: 2,
    season: '2025'
  },
  
  // Sunday, September 14, 2025 - 4:05 PM ET (22:05 DE)
  {
    home_team: 'Indianapolis Colts',
    away_team: 'Denver Broncos',
    home_team_abbr: 'IND',
    away_team_abbr: 'DEN',
    game_date: '2025-09-14T22:05:00',
    week: 2,
    season: '2025'
  },
  {
    home_team: 'Arizona Cardinals',
    away_team: 'Carolina Panthers',
    home_team_abbr: 'ARI',
    away_team_abbr: 'CAR',
    game_date: '2025-09-14T22:05:00',
    week: 2,
    season: '2025'
  },
  
  // Sunday, September 14, 2025 - 4:25 PM ET (22:25 DE)
  {
    home_team: 'Kansas City Chiefs',
    away_team: 'Philadelphia Eagles',
    home_team_abbr: 'KC',
    away_team_abbr: 'PHI',
    game_date: '2025-09-14T22:25:00',
    week: 2,
    season: '2025'
  },
  
  // Sunday Night Football - 8:20 PM ET (02:20 DE +1)
  {
    home_team: 'Minnesota Vikings',
    away_team: 'Atlanta Falcons',
    home_team_abbr: 'MIN',
    away_team_abbr: 'ATL',
    game_date: '2025-09-15T02:20:00',
    week: 2,
    season: '2025'
  },
  
  // Monday, September 15, 2025 - 7:00 PM ET (01:00 DE +1)
  {
    home_team: 'Houston Texans',
    away_team: 'Tampa Bay Buccaneers',
    home_team_abbr: 'HOU',
    away_team_abbr: 'TB',
    game_date: '2025-09-16T01:00:00',
    week: 2,
    season: '2025'
  },
  
  // Monday, September 15, 2025 - 10:00 PM ET (04:00 DE +1)
  {
    home_team: 'Las Vegas Raiders',
    away_team: 'Los Angeles Chargers',
    home_team_abbr: 'LV',
    away_team_abbr: 'LAC',
    game_date: '2025-09-16T04:00:00',
    week: 2,
    season: '2025'
  }
];

// Funktion zum Hinzufügen aller Spiele
async function addWeek2Games() {
  console.log('🏈 Starte Hinzufügen der Week 2 Spiele...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const game of WEEK2_GAMES_2025) {
    try {
      await firebaseCreateGame(game);
      console.log(`✅ ${game.away_team_abbr} @ ${game.home_team_abbr} hinzugefügt`);
      successCount++;
      // Kleine Pause zwischen den Anfragen
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Fehler bei ${game.away_team_abbr} @ ${game.home_team_abbr}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n🎉 Fertig! ${successCount} Spiele hinzugefügt, ${errorCount} Fehler`);
  
  // Seite neu laden um die Spiele anzuzeigen
  if (successCount > 0) {
    console.log('🔄 Lade Admin-Daten neu...');
    if (typeof loadAdminData === 'function') {
      await loadAdminData();
    }
  }
}

// Automatisch ausführen wenn als Script eingebunden
// Kommentiere die nächste Zeile aus, wenn du manuell ausführen möchtest
// addWeek2Games();

console.log('📋 Week 2 Games Script geladen. Führe addWeek2Games() aus, um die Spiele hinzuzufügen.');
