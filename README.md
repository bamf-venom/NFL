# 🏈 NFL POINTS

Eine Web-App zum Tippen von NFL-Spielergebnissen mit Freunden und Gruppen.

![NFL POINTS](https://img.shields.io/badge/NFL-POINTS-blue?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## 📋 Features

- **🎯 Spiele tippen** - Tippe die Ergebnisse aller NFL-Spiele
- **👥 Gruppen** - Erstelle oder trete Gruppen bei und vergleiche dich mit Freunden
- **🏆 Leaderboard** - Globale und Gruppen-Ranglisten
- **📊 Punkte-System** - Verdiene Punkte basierend auf deinen Tipps
- **👤 Profile** - Personalisiere dein Profil mit eigenem Profilbild
- **📱 Responsive** - Optimiert für Desktop und Mobile
- **🔐 Admin-Panel** - Verwalte Spiele und Benutzer

## 🚀 Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Backend:** Firebase (Firestore, Authentication)
- **Styling:** Custom CSS mit CSS Variables
- **Icons:** Font Awesome 6

## 📁 Projektstruktur

```
Web/
├── index.html              # Landing Page
├── pages/
│   ├── games.html          # Spiele-Übersicht
│   ├── game-detail.html    # Spiel-Details & Tippen
│   ├── leaderboard.html    # Rangliste
│   ├── groups.html         # Gruppen-Übersicht
│   ├── group-detail.html   # Gruppen-Details
│   ├── group-join.html     # Gruppe beitreten
│   ├── profile.html        # Benutzerprofil
│   └── admin.html          # Admin-Panel
├── css/
│   ├── colors.css          # Farbvariablen
│   ├── base.css            # Basis-Styles
│   ├── components.css      # UI-Komponenten
│   ├── layout.css          # Layout-Styles
│   ├── games.css           # Spiele-Styles
│   ├── leaderboard-groups.css
│   ├── profile-admin.css
│   ├── animations.css      # Animationen
│   ├── utilities.css       # Utility-Klassen
│   └── mobile.css          # Responsive Styles
├── js/
│   ├── config.js           # Konfiguration
│   ├── firebase-config.js  # Firebase Setup & API
│   ├── auth.js             # Authentifizierung
│   ├── main.js             # Hauptlogik & Navigation
│   ├── games.js            # Spiele-Logik
│   ├── game-detail.js      # Spiel-Detail-Logik
│   ├── leaderboard.js      # Ranglisten-Logik
│   ├── groups.js           # Gruppen-Logik
│   ├── group-detail.js     # Gruppen-Detail-Logik
│   ├── profile.js          # Profil-Logik
│   ├── admin.js            # Admin-Logik
│   ├── custom-select.js    # Custom Select Component
│   └── loader.js           # Ladeanimationen
└── logos/                  # NFL Team Logos (SVG)
```


