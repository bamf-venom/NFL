# Automatischer Ergebnis-Check

Dieses Skript läuft alle 15 Minuten über GitHub Actions (`.github/workflows/update-scores.yml`),
holt sich Ergebnisse von der kostenlosen ESPN-Schnittstelle und trägt sie in Firestore ein.
Wird ein Spiel als beendet erkannt, werden automatisch auch die Punkte aller Tipps berechnet
(gleiche Logik wie im Admin-Panel der App).

## Einmaliges Setup (musst du selbst machen, ca. 5 Minuten)

### 1. Firebase Service-Account-Key erstellen

1. Öffne die [Firebase Console](https://console.firebase.google.com/) → dein Projekt `projekt1-95e74`
2. Zahnrad oben links → **Projekteinstellungen** → Tab **Dienstkonten**
3. Klick auf **Neuen privaten Schlüssel generieren** → JSON-Datei wird heruntergeladen
4. **Wichtig:** Diese Datei niemals ins Git-Repo committen! Sie ist bereits in `.gitignore` ausgeschlossen.

### 2. Als GitHub Secret hinterlegen

1. Öffne dein GitHub-Repo im Browser → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `FIREBASE_SERVICE_ACCOUNT`
4. Value: kompletter Inhalt der heruntergeladenen JSON-Datei (einfach den ganzen Dateiinhalt reinkopieren)
5. Speichern

Das war's - der Workflow läuft danach automatisch alle 15 Minuten. Du kannst ihn auch manuell
anstoßen: GitHub-Repo → Tab **Actions** → **NFL Ergebnisse automatisch eintragen** → **Run workflow**.

## Lokal testen (optional)

```bash
cd automation
npm install
export FIREBASE_SERVICE_ACCOUNT="$(cat /pfad/zu/deiner-service-account-datei.json)"
node check-scores.js
```

## Was das Skript macht

1. Holt alle Spiele aus Firestore mit Status `scheduled` oder `live`, deren Anstoßzeit
   bereits vergangen ist
2. Fragt für jede betroffene (Saison, Woche)-Kombination die ESPN-Schnittstelle ab
3. Ist ein Spiel laut ESPN beendet → Endstand + Status `finished` eintragen, Punkte für
   alle Tipps berechnen und Nutzer-Gesamtpunktzahl aktualisieren
4. Läuft ein Spiel gerade → Live-Stand + Status `live` aktualisieren (ohne Punkteberechnung)
