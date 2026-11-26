// Avatar-Bibliothek für das Profilbild: eigene Zeichnungen mit Football-Motiven (avatars/<id>.svg,
// 256 x 256, voll bedeckt - die App schneidet sie rund zu). Am Nutzer steht nur "avatar:<id>"
// (siehe safePictureSrc in main.js). Neue Avatare: Datei in avatars/ ablegen und hier eintragen.
const AVATAR_LIBRARY = [
  // Spieler
  { id: 'player-navy', de: 'Spieler Marine', en: 'Player navy' },
  { id: 'player-red', de: 'Spieler Rot', en: 'Player red' },
  { id: 'player-green', de: 'Spieler Grün', en: 'Player green' },
  { id: 'player-black', de: 'Spieler Schwarz', en: 'Player black' },
  { id: 'player-gold', de: 'Spieler Gold', en: 'Player gold' },
  { id: 'player-white', de: 'Spieler Weiß', en: 'Player white' },
  // Helme
  { id: 'helmet-navy', de: 'Helm Marine', en: 'Helmet navy' },
  { id: 'helmet-red', de: 'Helm Rot', en: 'Helmet red' },
  { id: 'helmet-green', de: 'Helm Grün', en: 'Helmet green' },
  { id: 'helmet-black', de: 'Helm Schwarz', en: 'Helmet black' },
  { id: 'helmet-gold', de: 'Helm Gold', en: 'Helmet gold' },
  { id: 'helmet-orange', de: 'Helm Orange', en: 'Helmet orange' },
  // Trikots
  { id: 'jersey-1', de: 'Trikot 1', en: 'Jersey 1' },
  { id: 'jersey-7', de: 'Trikot 7', en: 'Jersey 7' },
  { id: 'jersey-12', de: 'Trikot 12', en: 'Jersey 12' },
  // Bälle
  { id: 'ball-classic', de: 'Football klassisch', en: 'Classic football' },
  { id: 'ball-night', de: 'Football Nachtspiel', en: 'Night game football' },
  { id: 'ball-gold', de: 'Goldener Football', en: 'Golden football' },
  { id: 'flame-ball', de: 'Flammen-Football', en: 'Flaming football' },
  // Auszeichnungen
  { id: 'trophy', de: 'Pokal', en: 'Trophy' },
  { id: 'crown', de: 'Krone', en: 'Crown' },
  { id: 'bolt', de: 'Blitz', en: 'Blitz' },
  // Ausrüstung und Stadion
  { id: 'goalpost', de: 'Torpfosten', en: 'Goalpost' },
  { id: 'whistle', de: 'Pfeife', en: 'Whistle' },
  { id: 'playbook', de: 'Spielzug-Tafel', en: 'Playbook' },
  { id: 'scoreboard', de: 'Anzeigetafel', en: 'Scoreboard' },
  { id: 'stadium-lights', de: 'Flutlicht', en: 'Stadium lights' },
  { id: 'cleat', de: 'Stollenschuh', en: 'Cleat' }
];
