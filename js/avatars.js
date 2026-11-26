// Avatar-Bibliothek für das Profilbild: eigene Zeichnungen mit Football-Motiven (avatars/<id>.svg,
// 256 x 256, voll bedeckt - die App schneidet sie rund zu). Am Nutzer steht nur "avatar:<id>"
// (siehe safePictureSrc in main.js). Neue Avatare: Datei in avatars/ ablegen und hier eintragen.
const AVATAR_LIBRARY = [
  // Spieler und Figuren
  { id: 'player-navy', de: 'Spieler Marine', en: 'Player navy' },
  { id: 'player-red', de: 'Spieler Rot', en: 'Player red' },
  { id: 'player-green', de: 'Spieler Grün', en: 'Player green' },
  { id: 'player-black', de: 'Spieler Schwarz', en: 'Player black' },
  { id: 'player-gold', de: 'Spieler Gold', en: 'Player gold' },
  { id: 'player-white', de: 'Spieler Weiß', en: 'Player white' },
  { id: 'quarterback', de: 'Quarterback', en: 'Quarterback' },
  { id: 'receiver', de: 'Receiver', en: 'Receiver' },
  { id: 'running-back', de: 'Runningback', en: 'Running back' },
  { id: 'referee', de: 'Schiedsrichter', en: 'Referee' },
  { id: 'coach', de: 'Trainer', en: 'Coach' },
  { id: 'goat', de: 'G.O.A.T.', en: 'G.O.A.T.' },
  { id: 'hall-of-fame', de: 'Ruhmeshalle', en: 'Hall of Fame' },
  // Helme
  { id: 'helmet-navy', de: 'Helm Marine', en: 'Helmet navy' },
  { id: 'helmet-red', de: 'Helm Rot', en: 'Helmet red' },
  { id: 'helmet-green', de: 'Helm Grün', en: 'Helmet green' },
  { id: 'helmet-black', de: 'Helm Schwarz', en: 'Helmet black' },
  { id: 'helmet-gold', de: 'Helm Gold', en: 'Helmet gold' },
  { id: 'helmet-orange', de: 'Helm Orange', en: 'Helmet orange' },
  // Trikots
  { id: 'jersey-1', de: 'Trikot 1 Schwarz-Gold', en: 'Jersey 1 black and gold' },
  { id: 'jersey-7', de: 'Trikot 7 Rot-Weiß', en: 'Jersey 7 red and white' },
  { id: 'jersey-12', de: 'Trikot 12 Marine-Gold', en: 'Jersey 12 navy and gold' },
  { id: 'jersey-15', de: 'Trikot 15 Rot-Gold', en: 'Jersey 15 red and gold' },
  { id: 'jersey-4', de: 'Trikot 4 Grün-Gold', en: 'Jersey 4 green and gold' },
  { id: 'jersey-18', de: 'Trikot 18 Orange-Marine', en: 'Jersey 18 orange and navy' },
  { id: 'jersey-8', de: 'Trikot 8 Lila-Gold', en: 'Jersey 8 purple and gold' },
  { id: 'jersey-13', de: 'Trikot 13 Aqua-Orange', en: 'Jersey 13 aqua and orange' },
  { id: 'jersey-20', de: 'Trikot 20 Hellblau-Silber', en: 'Jersey 20 light blue and silver' },
  { id: 'jersey-22', de: 'Trikot 22 Weiß-Marine', en: 'Jersey 22 white and navy' },
  { id: 'jersey-32', de: 'Trikot 32 Braun-Orange', en: 'Jersey 32 brown and orange' },
  // Bälle
  { id: 'ball-classic', de: 'Football klassisch', en: 'Classic football' },
  { id: 'ball-night', de: 'Football Nachtspiel', en: 'Night game football' },
  { id: 'ball-gold', de: 'Goldener Football', en: 'Golden football' },
  // Auszeichnungen
  { id: 'trophy', de: 'Pokal', en: 'Trophy' },
  { id: 'crown', de: 'Krone', en: 'Crown' },
  { id: 'bolt', de: 'Blitz', en: 'Blitz' },
  { id: 'ring', de: 'Meisterschaftsring', en: 'Championship ring' },
  // Spielfeld und Ausrüstung
  { id: 'flag', de: 'Wurfflagge', en: 'Penalty flag' },
  { id: 'pylon', de: 'Pylone', en: 'Pylon' },
  { id: 'whistle', de: 'Pfeife', en: 'Whistle' },
  { id: 'scoreboard', de: 'Anzeigetafel', en: 'Scoreboard' },
  { id: 'cleat', de: 'Stollenschuh', en: 'Cleat' },
  { id: 'goalpost', de: 'Torpfosten', en: 'Goalpost' },
  { id: 'playbook', de: 'Spielzug-Tafel', en: 'Playbook' },
  { id: 'stadium-lights', de: 'Flutlicht', en: 'Stadium lights' },
  // Logos
  { id: 'logo-p', de: 'NFL POINTS Logo', en: 'NFL POINTS logo' },
  { id: 'logo-p-dark', de: 'NFL POINTS Logo dunkel', en: 'NFL POINTS logo dark' },
  { id: 'nfl-points', de: 'NFL POINTS', en: 'NFL POINTS' }
];
