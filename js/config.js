// ==================== APP CONFIGURATION ====================

// NFL Teams data
const NFL_TEAMS = [
  { name: 'Arizona Cardinals', abbr: 'ARI' },
  { name: 'Atlanta Falcons', abbr: 'ATL' },
  { name: 'Baltimore Ravens', abbr: 'BAL' },
  { name: 'Buffalo Bills', abbr: 'BUF' },
  { name: 'Carolina Panthers', abbr: 'CAR' },
  { name: 'Chicago Bears', abbr: 'CHI' },
  { name: 'Cincinnati Bengals', abbr: 'CIN' },
  { name: 'Cleveland Browns', abbr: 'CLE' },
  { name: 'Dallas Cowboys', abbr: 'DAL' },
  { name: 'Denver Broncos', abbr: 'DEN' },
  { name: 'Detroit Lions', abbr: 'DET' },
  { name: 'Green Bay Packers', abbr: 'GB' },
  { name: 'Houston Texans', abbr: 'HOU' },
  { name: 'Indianapolis Colts', abbr: 'IND' },
  { name: 'Jacksonville Jaguars', abbr: 'JAX' },
  { name: 'Kansas City Chiefs', abbr: 'KC' },
  { name: 'Las Vegas Raiders', abbr: 'LV' },
  { name: 'Los Angeles Chargers', abbr: 'LAC' },
  { name: 'Los Angeles Rams', abbr: 'LAR' },
  { name: 'Miami Dolphins', abbr: 'MIA' },
  { name: 'Minnesota Vikings', abbr: 'MIN' },
  { name: 'New England Patriots', abbr: 'NE' },
  { name: 'New Orleans Saints', abbr: 'NO' },
  { name: 'New York Giants', abbr: 'NYG' },
  { name: 'New York Jets', abbr: 'NYJ' },
  { name: 'Philadelphia Eagles', abbr: 'PHI' },
  { name: 'Pittsburgh Steelers', abbr: 'PIT' },
  { name: 'San Francisco 49ers', abbr: 'SF' },
  { name: 'Seattle Seahawks', abbr: 'SEA' },
  { name: 'Tampa Bay Buccaneers', abbr: 'TB' },
  { name: 'Tennessee Titans', abbr: 'TEN' },
  { name: 'Washington Commanders', abbr: 'WAS' },
];

// Team logo mapping to local SVG files
const TEAM_LOGOS = {
  'ARI': 'arizona-cardinals-logo.svg',
  'ATL': 'atlanta-falcons-logo.svg',
  'BAL': 'baltimore-ravens-logo.svg',
  'BUF': 'buffalo-bills-logo.svg',
  'CAR': 'carolina-panthers-logo.svg',
  'CHI': 'chicago-bears-logo.svg',
  'CIN': 'cincinnati-bengals-logo.svg',
  'CLE': 'cleveland-browns-logo.svg',
  'DAL': 'dallas-cowboys-logo.svg',
  'DEN': 'denver-broncos-logo.svg',
  'DET': 'detroit-lions-logo.svg',
  'GB': 'green-bay-packers-logo.svg',
  'HOU': 'houston-texans-logo.svg',
  'IND': 'indianapolis-colts-logo.svg',
  'JAX': 'jacksonville-jaguars-logo.svg',
  'KC': 'kansas-city-chiefs-logo.svg',
  'LV': 'oakland-raiders-logo.svg',
  'LAC': 'los-angeles-chargers-logo.svg',
  'LAR': 'la-rams-logo.svg',
  'MIA': 'miami-dolphins-logo.svg',
  'MIN': 'minnesota-vikings-logo.svg',
  'NE': 'new-england-patriots-logo.svg',
  'NO': 'new-orleans-saints-logo.svg',
  'NYG': 'new-york-giants-logo.svg',
  'NYJ': 'new-york-jets-logo.svg',
  'PHI': 'philadelphia-eagles-logo.svg',
  'PIT': 'pittsburgh-steelers-logo.svg',
  'SF': 'san-francisco-49ers-logo.svg',
  'SEA': 'seattle-seahawks-logo.svg',
  'TB': 'tampa-bay-buccaneers-logo.svg',
  'TEN': 'tennessee-titans-logo.svg',
  'WAS': 'washington-commanders-logo.svg',
};

// Official team primary colors (for score-card accents)
const TEAM_COLORS = {
  'ARI': '#97233F', 'ATL': '#A71930', 'BAL': '#241773', 'BUF': '#00338D',
  'CAR': '#0085CA', 'CHI': '#0B162A', 'CIN': '#FB4F14', 'CLE': '#311D00',
  'DAL': '#003594', 'DEN': '#FB4F14', 'DET': '#0076B6', 'GB': '#203731',
  'HOU': '#03202F', 'IND': '#002C5F', 'JAX': '#101820', 'KC': '#E31837',
  'LV': '#000000', 'LAC': '#0080C6', 'LAR': '#003594', 'MIA': '#008E97',
  'MIN': '#4F2683', 'NE': '#002244', 'NO': '#D3BC8D', 'NYG': '#0B2265',
  'NYJ': '#125740', 'PHI': '#004C54', 'PIT': '#FFB612', 'SF': '#AA0000',
  'SEA': '#002244', 'TB': '#D50A0A', 'TEN': '#4B92DB', 'WAS': '#5A1414',
};

// Get team logo URL
function getTeamLogoURL(abbr) {
  const logoFile = TEAM_LOGOS[abbr];
  if (logoFile) {
    // Check if we're in pages subdirectory
    const path = window.location.pathname;
    const prefix = path.includes('/pages/') ? '../logos/' : 'logos/';
    return prefix + logoFile;
  }
  return null;
}

// Get team logo HTML
function getTeamLogoHTML(abbr, size = 40) {
  const logoURL = getTeamLogoURL(abbr);
  if (logoURL) {
    return `<img src="${logoURL}" alt="${abbr}" class="team-logo" style="width: ${size}px; height: ${size}px;">`;
  }
  // Fallback to placeholder
  return `<div class="team-logo-placeholder" style="width: ${size}px; height: ${size}px;">${abbr.substring(0, 2)}</div>`;
}

// Admin email for Firebase (gleiche Email wie Admin-Account)
const ADMIN_EMAIL = 'info@mbpvfx.com';

// Wetten werden so viele Minuten vor Anpfiff gesperrt
const BETTING_LOCK_MINUTES_BEFORE_KICKOFF = 3;

// Öffentlicher VAPID-Schlüssel für Web-Push-Benachrichtigungen (Wett-Erinnerung
// 1h vor Anpfiff, siehe automation/send-bet-reminders.js). Unbedenklich im
// Client-Code, da nur der private Schlüssel (GitHub Actions Secret
// VAPID_PRIVATE_KEY, NICHT im Repo) tatsächlich Nachrichten signieren kann.
const VAPID_PUBLIC_KEY = 'BP9m9K3SVLgugOANXXViTu2iQ_4oTTCRsNIwQIb5HTRcSuidTrvUEVNBwSHl-LCc4VHEBd5Dq9w6f-5R-bWR61U';

// App-Version für die Update-Anzeige in den Einstellungen (settings.js
// vergleicht diese Konstante mit einer frisch vom Server geholten Kopie
// dieser Datei). WICHTIG: bei jedem sichtbaren Deploy hochzählen, sonst
// zeigt die Update-Erkennung nichts an.
const APP_VERSION = '2026.09.23.11';
