// ==================== NFL PLAYOFFS 2025-26 SEASON ====================
// Wild Card Weekend (Week 19), Divisional Playoffs (Week 20), 
// Conference Championships (Week 21), Super Bowl (Week 22)
// Alle Spiele sind beendet (finished) mit finalen Ergebnissen

const PLAYOFF_GAMES_2025_26 = [
  // ==================== WILD CARD WEEKEND (Week 19) - January 10-13, 2026 ====================
  
  // AFC Wild Card
  {
    home_team: 'New England Patriots',
    away_team: 'Los Angeles Chargers',
    home_team_abbr: 'NE',
    away_team_abbr: 'LAC',
    game_date: '2026-01-10T20:00:00',
    week: 19,
    season: '2025',
    home_score: 16,
    away_score: 3,
    status: 'finished'
  },
  {
    home_team: 'Buffalo Bills',
    away_team: 'Jacksonville Jaguars',
    home_team_abbr: 'BUF',
    away_team_abbr: 'JAX',
    game_date: '2026-01-11T19:00:00',
    week: 19,
    season: '2025',
    home_score: 27,
    away_score: 24,
    status: 'finished'
  },
  {
    home_team: 'Houston Texans',
    away_team: 'Pittsburgh Steelers',
    home_team_abbr: 'HOU',
    away_team_abbr: 'PIT',
    game_date: '2026-01-11T22:30:00',
    week: 19,
    season: '2025',
    home_score: 30,
    away_score: 6,
    status: 'finished'
  },
  
  // NFC Wild Card
  {
    home_team: 'Chicago Bears',
    away_team: 'Green Bay Packers',
    home_team_abbr: 'CHI',
    away_team_abbr: 'GB',
    game_date: '2026-01-11T19:00:00',
    week: 19,
    season: '2025',
    home_score: 31,
    away_score: 27,
    status: 'finished'
  },
  {
    home_team: 'San Francisco 49ers',
    away_team: 'Philadelphia Eagles',
    home_team_abbr: 'SF',
    away_team_abbr: 'PHI',
    game_date: '2026-01-12T19:00:00',
    week: 19,
    season: '2025',
    home_score: 23,
    away_score: 19,
    status: 'finished'
  },
  {
    home_team: 'Los Angeles Rams',
    away_team: 'Carolina Panthers',
    home_team_abbr: 'LAR',
    away_team_abbr: 'CAR',
    game_date: '2026-01-12T22:30:00',
    week: 19,
    season: '2025',
    home_score: 34,
    away_score: 31,
    status: 'finished'
  },
  
  // ==================== DIVISIONAL PLAYOFFS (Week 20) - January 17-18, 2026 ====================
  
  // AFC Divisional
  {
    home_team: 'Denver Broncos',
    away_team: 'Buffalo Bills',
    home_team_abbr: 'DEN',
    away_team_abbr: 'BUF',
    game_date: '2026-01-17T20:00:00',
    week: 20,
    season: '2025',
    home_score: 33,
    away_score: 30,
    status: 'finished'
  },
  {
    home_team: 'New England Patriots',
    away_team: 'Houston Texans',
    home_team_abbr: 'NE',
    away_team_abbr: 'HOU',
    game_date: '2026-01-18T19:00:00',
    week: 20,
    season: '2025',
    home_score: 28,
    away_score: 16,
    status: 'finished'
  },
  
  // NFC Divisional
  {
    home_team: 'Seattle Seahawks',
    away_team: 'San Francisco 49ers',
    home_team_abbr: 'SEA',
    away_team_abbr: 'SF',
    game_date: '2026-01-17T23:30:00',
    week: 20,
    season: '2025',
    home_score: 41,
    away_score: 6,
    status: 'finished'
  },
  {
    home_team: 'Los Angeles Rams',
    away_team: 'Chicago Bears',
    home_team_abbr: 'LAR',
    away_team_abbr: 'CHI',
    game_date: '2026-01-18T22:30:00',
    week: 20,
    season: '2025',
    home_score: 20,
    away_score: 17,
    status: 'finished'
  },
  
  // ==================== CONFERENCE CHAMPIONSHIPS (Week 21) - January 25, 2026 ====================
  
  // AFC Championship
  {
    home_team: 'Denver Broncos',
    away_team: 'New England Patriots',
    home_team_abbr: 'DEN',
    away_team_abbr: 'NE',
    game_date: '2026-01-25T21:00:00',
    week: 21,
    season: '2025',
    home_score: 7,
    away_score: 10,
    status: 'finished'
  },
  
  // NFC Championship
  {
    home_team: 'Seattle Seahawks',
    away_team: 'Los Angeles Rams',
    home_team_abbr: 'SEA',
    away_team_abbr: 'LAR',
    game_date: '2026-01-25T00:30:00',
    week: 21,
    season: '2025',
    home_score: 31,
    away_score: 27,
    status: 'finished'
  },
  
  // ==================== SUPER BOWL LX (Week 22) - February 8, 2026 ====================
  {
    home_team: 'Seattle Seahawks',
    away_team: 'New England Patriots',
    home_team_abbr: 'SEA',
    away_team_abbr: 'NE',
    game_date: '2026-02-08T00:30:00',
    week: 22,
    season: '2025',
    home_score: 29,
    away_score: 13,
    status: 'finished'
  }
];

// Funktion zum Hinzufügen aller Playoff-Spiele mit Punkten
async function addPlayoffGames() {
  console.log('🏈 Starte Hinzufügen der NFL Playoff-Spiele 2025-26...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const game of PLAYOFF_GAMES_2025_26) {
    try {
      // Erstelle das Spiel mit firebaseCreateGame (ohne Punkte)
      const gameId = db.collection('_').doc().id;
      const gameDoc = {
        id: gameId,
        home_team: game.home_team,
        away_team: game.away_team,
        home_team_abbr: game.home_team_abbr,
        away_team_abbr: game.away_team_abbr,
        game_date: firebase.firestore.Timestamp.fromDate(new Date(game.game_date)),
        week: game.week,
        season: game.season,
        home_score: game.home_score,
        away_score: game.away_score,
        status: game.status,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      await collections.games().doc(gameId).set(gameDoc);
      
      const weekName = game.week === 19 ? 'Wild Card' : 
                       game.week === 20 ? 'Divisional' : 
                       game.week === 21 ? 'Conference Championship' : 
                       'Super Bowl';
      
      console.log(`✅ ${weekName}: ${game.away_team_abbr} @ ${game.home_team_abbr} (${game.away_score}:${game.home_score}) hinzugefügt`);
      successCount++;
      
      // Kleine Pause zwischen den Anfragen
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Fehler bei ${game.away_team_abbr} @ ${game.home_team_abbr}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n🎉 Fertig! ${successCount} Playoff-Spiele hinzugefügt, ${errorCount} Fehler`);
  console.log('📊 Übersicht:');
  console.log('   - Wild Card Weekend (Woche 19): 6 Spiele');
  console.log('   - Divisional Playoffs (Woche 20): 4 Spiele');
  console.log('   - Conference Championships (Woche 21): 2 Spiele');
  console.log('   - Super Bowl LX (Woche 22): 1 Spiel');
  
  // Cache invalidieren
  if (typeof invalidateCache === 'function') {
    invalidateCache('games');
  }
  
  // Seite neu laden um die Spiele anzuzeigen
  if (successCount > 0 && typeof loadAdminData === 'function') {
    console.log('🔄 Lade Admin-Daten neu...');
    await loadAdminData();
  }
  
  return { successCount, errorCount };
}

console.log('📋 NFL Playoff Games 2025-26 Script geladen.');
console.log('🏈 Führe addPlayoffGames() aus, um alle Playoff-Spiele hinzuzufügen.');
console.log('');
console.log('Enthaltene Runden:');
console.log('   - Wild Card Weekend (Woche 19)');
console.log('   - Divisional Playoffs (Woche 20)');
console.log('   - Conference Championships (Woche 21)');
console.log('   - Super Bowl LX (Woche 22)');
