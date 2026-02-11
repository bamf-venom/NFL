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

## ⚙️ Installation & Setup

### 1. Repository klonen

```bash
git clone https://github.com/DEIN-USERNAME/nfl-points.git
cd nfl-points
```

### 2. Firebase Projekt erstellen

1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Erstelle ein neues Projekt
3. Aktiviere **Authentication** (Email/Password)
4. Erstelle eine **Firestore Database**
5. Kopiere deine Firebase-Konfiguration

### 3. Firebase konfigurieren

Erstelle oder bearbeite `js/config.js`:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "DEIN-API-KEY",
  authDomain: "DEIN-PROJEKT.firebaseapp.com",
  projectId: "DEIN-PROJEKT-ID",
  storageBucket: "DEIN-PROJEKT.appspot.com",
  messagingSenderId: "DEINE-SENDER-ID",
  appId: "DEINE-APP-ID"
};
```

### 4. Firestore Security Rules

Kopiere diese Regeln in deine Firestore Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Games
    match /games/{gameId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.is_admin == true;
    }
    
    // Bets
    match /bets/{betId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.user_id;
    }
    
    // Groups
    match /groups/{groupId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        (request.auth.uid in resource.data.member_ids || 
         request.auth.uid == resource.data.created_by);
      allow delete: if request.auth != null && request.auth.uid == resource.data.created_by;
    }
  }
}
```

### 5. Lokal starten

Du kannst die App mit einem einfachen HTTP-Server starten:

```bash
# Mit Python 3
python -m http.server 8000

# Mit Node.js (http-server)
npx http-server

# Mit PHP
php -S localhost:8000
```

Öffne dann `http://localhost:8000` im Browser.

## 🎮 Punkte-System

| Ergebnis | Punkte |
|----------|--------|
| Exaktes Ergebnis | 5 Punkte |
| Richtige Differenz | 3 Punkte |
| Richtiger Sieger | 1 Punkt |
| Falsch | 0 Punkte |

## 👤 Admin-Benutzer erstellen

1. Registriere einen neuen Account
2. Gehe in die Firebase Console → Firestore
3. Finde den User in der `users` Collection
4. Setze `is_admin: true`

## 📱 Screenshots

### Desktop
- Spiele-Übersicht mit Gruppen-Filter
- Leaderboard mit Ranglisten
- Profil mit Statistiken

### Mobile
- Responsive Design für alle Geräte
- Touch-optimierte Navigation
- Hamburger-Menü

## 🛠️ Entwicklung

### Code-Stil
- Vanilla JavaScript (ES6+)
- CSS Custom Properties für Theming
- Mobile-First Responsive Design

### Wichtige Dateien
- `firebase-config.js` - Alle Firebase API Calls
- `auth.js` - Authentifizierung & Session Management
- `main.js` - Navigation & globale Funktionen

## 📄 Lizenz

MIT License - Siehe [LICENSE](LICENSE) für Details.

## 🤝 Beitragen

1. Fork das Repository
2. Erstelle einen Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Committe deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

## 📧 Kontakt

Bei Fragen oder Problemen, erstelle ein Issue oder kontaktiere den Entwickler.

---

**Viel Spaß beim Tippen! 🏈**
