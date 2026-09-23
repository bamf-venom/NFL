# Automatischer Ergebnis-Check + Push-Benachrichtigungen

Drei Skripte laufen alle 15 Minuten über GitHub Actions (`.github/workflows/update-scores.yml`):

- **`check-scores.js`**: holt sich Ergebnisse von der kostenlosen ESPN-Schnittstelle und trägt sie
  in Firestore ein. Wird ein Spiel als beendet erkannt, werden automatisch auch die Punkte aller
  Tipps berechnet (gleiche Logik wie im Admin-Panel der App).
- **`send-bet-reminders.js`**: schickt eine Push-Benachrichtigung an jeden Nutzer, der für ein
  Spiel, das in ca. 1 Stunde beginnt, noch keine Wette platziert hat. Startet mehrere Spiele in
  etwa derselben Stunde, bekommt man trotzdem nur eine gebündelte Erinnerung statt mehrerer
  einzelner Nachrichten.
- **`notify-new-version.js`**: vergleicht `APP_VERSION` (`js/config.js`) mit der zuletzt gemeldeten
  Version (Firestore `meta/app_version`) - bei einem Unterschied bekommt jeder abonnierte Nutzer
  einmalig eine Push-Benachrichtigung "Update verfügbar".

## Einmaliges Setup (musst du selbst machen)

### 1. Firebase Service-Account-Key erstellen

1. Öffne die [Firebase Console](https://console.firebase.google.com/) → dein Projekt `projekt1-95e74`
2. Zahnrad oben links → **Projekteinstellungen** → Tab **Dienstkonten**
3. Klick auf **Neuen privaten Schlüssel generieren** → JSON-Datei wird heruntergeladen
4. **Wichtig:** Diese Datei niemals ins Git-Repo committen! Sie ist bereits in `.gitignore` ausgeschlossen.

### 2. Als GitHub Secrets hinterlegen

1. Öffne dein GitHub-Repo im Browser → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**, für jeden der folgenden drei Secrets:
   - `FIREBASE_SERVICE_ACCOUNT`: kompletter Inhalt der heruntergeladenen JSON-Datei
   - `VAPID_PUBLIC_KEY`: `BP9m9K3SVLgugOANXXViTu2iQ_4oTTCRsNIwQIb5HTRcSuidTrvUEVNBwSHl-LCc4VHEBd5Dq9w6f-5R-bWR61U`
     (identisch mit `VAPID_PUBLIC_KEY` in `js/config.js` - unbedenklich, ist ein öffentlicher Schlüssel)
   - `VAPID_PRIVATE_KEY`: privater Gegenpart dazu, wurde dir separat mitgeteilt (nicht im Repo, nicht
     in dieser README) - falls verloren, mit `node -e "console.log(require('web-push').generateVAPIDKeys())"`
     im `automation`-Ordner ein neues Paar erzeugen und **beide** Werte (hier + `js/config.js`) ersetzen
3. Speichern

Das war's - der Workflow läuft danach automatisch alle 15 Minuten. Du kannst ihn auch manuell
anstoßen: GitHub-Repo → Tab **Actions** → **NFL Ergebnisse automatisch eintragen** → **Run workflow**.

### 3. Firestore-Regeln ergänzen

Die neue Subcollection `users/{uid}/push_subscriptions/{id}` braucht eigene Regeln (Nutzer darf nur
seine eigenen Einträge lesen/schreiben) - der genaue Regel-Text steht in der Obsidian-Notiz
`Push-Benachrichtigungen.md`.

## Lokal testen (optional)

```bash
cd automation
npm install
export FIREBASE_SERVICE_ACCOUNT="$(cat /pfad/zu/deiner-service-account-datei.json)"
export VAPID_PUBLIC_KEY="..."
export VAPID_PRIVATE_KEY="..."
node check-scores.js
node send-bet-reminders.js
node notify-new-version.js
```

## Was die Skripte machen

**check-scores.js:**
1. Holt alle Spiele aus Firestore mit Status `scheduled` oder `live`, deren Anstoßzeit
   bereits vergangen ist
2. Fragt für jede betroffene (Saison, Woche)-Kombination die ESPN-Schnittstelle ab
3. Ist ein Spiel laut ESPN beendet → Endstand + Status `finished` eintragen, Punkte für
   alle Tipps berechnen und Nutzer-Gesamtpunktzahl aktualisieren
4. Läuft ein Spiel gerade → Live-Stand + Status `live` aktualisieren (ohne Punkteberechnung)

**send-bet-reminders.js:**
1. Holt alle `scheduled`-Spiele, deren Anstoßzeit 40-80 Minuten in der Zukunft liegt und die
   noch nicht als `reminder_sent` markiert sind
2. Ermittelt pro Spiel, welche Nutzer noch keine Wette platziert haben
3. Bündelt pro Nutzer alle fälligen Spiele zu EINER Push-Benachrichtigung (kein Spam bei
   mehreren gleichzeitig startenden Spielen)
4. Schickt die Benachrichtigung an alle Geräte des Nutzers (`web-push`); räumt dabei
   Subscriptions auf, die der Browser als nicht mehr gültig meldet (404/410)
5. Markiert die geprüften Spiele als `reminder_sent`, damit sie beim nächsten Lauf
   übersprungen werden

**notify-new-version.js:**
1. Liest die aktuelle `APP_VERSION` direkt aus `js/config.js` (lokal ausgecheckt im Workflow)
2. Vergleicht sie mit `notified_version` in Firestore `meta/app_version`
3. Unverändert → nichts tun. Beim allerersten Lauf überhaupt → nur vermerken, nicht benachrichtigen
   (sonst würde die längst aktuelle Version fälschlich als "neu" gemeldet)
4. Sonst: Push-Benachrichtigung an alle abonnierten Nutzer, `notified_version` aktualisieren
