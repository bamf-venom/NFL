# NFL BETT - Statische Web-Version

Eine reine HTML/CSS/JavaScript Implementierung der NFL Betting App, vorbereitet für Firebase Integration.

## Struktur

```
Web/
├── index.html              # Landing Page mit Login/Register
├── css/
│   └── style.css           # Alle CSS Styles
├── js/
│   ├── config.js           # NFL Teams Konfiguration & Logos
│   ├── firebase-config.js  # Firebase Konfiguration & Helpers
│   ├── auth.js             # Authentifizierung
│   ├── main.js             # Allgemeine Funktionen (Navbar, etc.)
│   ├── games.js            # Spiele-Seite
│   ├── game-detail.js      # Spiel-Details & Wetten
│   ├── leaderboard.js      # Rangliste
│   ├── groups.js           # Gruppen-Übersicht
│   ├── group-detail.js     # Gruppen-Details
│   ├── profile.js          # Profil-Seite
│   └── admin.js            # Admin Panel
├── pages/
│   ├── games.html          # Spiele-Übersicht
│   ├── game-detail.html    # Spiel-Details
│   ├── leaderboard.html    # Rangliste
│   ├── groups.html         # Gruppen-Übersicht
│   ├── group-detail.html   # Gruppen-Details
│   ├── group-join.html     # Gruppen-Beitritt
│   ├── profile.html        # Profil
│   └── admin.html          # Admin Panel
└── logos/                  # NFL Team Logos (SVG)
```

## Lokale Nutzung (ohne Firebase)

Die App verwendet aktuell `localStorage` zum Speichern von Daten. Dies ist ideal zum Testen.

### Demo starten:
```bash
cd Web
python3 -m http.server 8080
# Öffne http://localhost:8080
```

### Test-Accounts:
- **Admin**: info@mbpvfx.com / Moritz610
- **Neuer User**: Einfach registrieren

## Firebase Integration

### 1. Firebase Projekt erstellen
1. Gehe zu https://console.firebase.google.com/
2. Erstelle ein neues Projekt
3. Aktiviere **Authentication** (E-Mail/Passwort)
4. Aktiviere **Firestore Database**

### 2. Firebase Konfiguration
Ersetze in `js/firebase-config.js` die Platzhalter:
```javascript
const firebaseConfig = {
  apiKey: "DEIN_API_KEY",
  authDomain: "DEIN_PROJECT_ID.firebaseapp.com",
  projectId: "DEIN_PROJECT_ID",
  storageBucket: "DEIN_PROJECT_ID.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID"
};
```

### 3. Firebase SDK aktivieren
In allen HTML-Dateien, entkommentiere die Firebase Script-Zeilen:
```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
```

### 4. Code anpassen
In jedem JS-File sind die Firebase-Aufrufe bereits vorbereitet (auskommentiert). 
Ersetze die localStorage-Aufrufe durch die Firebase-Funktionen.

Beispiel in `auth.js`:
```javascript
// Statt localStorage:
// const users = JSON.parse(localStorage.getItem('users') || '[]');

// Mit Firebase:
currentUser = await firebaseLogin(email, password);
```

### Firestore Sicherheitsregeln
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Games collection
    match /games/{gameId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.is_admin == true;
    }
    
    // Bets collection
    match /bets/{betId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.user_id;
      allow update: if request.auth.uid == resource.data.user_id;
    }
    
    // Groups collection
    match /groups/{groupId} {
      allow read: if request.auth.uid in resource.data.member_ids;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.admin_id;
    }
  }
}
```

## Features

- **Authentifizierung**: Login/Register mit E-Mail
- **Spiele**: NFL Spiele anzeigen, nach Wochen filtern
- **Wetten**: Ergebnisse tippen, Punkte sammeln
- **Gruppen**: Private Gruppen erstellen, mit Einladungscode beitreten
- **Rangliste**: Global und pro Gruppe
- **Admin**: Spiele erstellen, Ergebnisse eintragen, Benutzer verwalten
- **Responsive**: Mobile-optimiert

## Punkte-System
- 3 Punkte pro richtig getipptem Team-Score
- 1 Punkt für richtigen Gewinner

## Made by MBP
