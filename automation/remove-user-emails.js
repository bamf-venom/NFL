// ==================== NFL POINTS - Einmalig: Feld "email" aus den Nutzer-Dokumenten entfernen ====================
// Die E-Mail-Adresse gehört in Firebase Authentication, nicht ins Nutzer-Dokument users/{uid}: Dieses
// Dokument darf jeder angemeldete Spieler lesen (Rangliste). Die App schreibt das Feld nicht mehr;
// dieses Skript entfernt die schon vorhandenen Felder (FieldValue.delete()). Die Adressen selbst gehen
// nicht verloren, sie liegen weiter in Firebase Authentication.
//
// WICHTIG: Das Repo und seine Actions-Logs sind öffentlich. Das Skript gibt deshalb NUR Anzahlen aus -
// niemals Adressen, Benutzernamen oder IDs (auch Fehlermeldungen werden von Pfaden bereinigt).
//
//   node remove-user-emails.js                          Trockenlauf (Standard): zählt nur, ändert nichts
//   node remove-user-emails.js --apply --confirm=<Anzahl>
//                      Feld "email" entfernen. --confirm muss genau die Anzahl der Dokumente mit Feld
//                      "email" nennen, die der Trockenlauf gemeldet hat. Stimmt sie nicht mehr (z.B. weil
//                      sich jemand neu registriert hat), bricht das Skript ab und ändert nichts.
//
// Einmal-Skript: nach getaner Arbeit wieder aus dem Repo nehmen.

function parseArgs(argv) {
  const opts = { apply: false, confirm: null };
  for (const arg of argv) {
    if (arg === '--apply') opts.apply = true;
    else if (arg.startsWith('--confirm=')) opts.confirm = arg.slice(10).trim();
    else throw new Error(`Unbekanntes Argument: ${arg}`);
  }
  return opts;
}

const hasField = (data, name) => Object.prototype.hasOwnProperty.call(data, name);

// Fehlermeldungen können Dokumentpfade (und damit IDs) enthalten - die kommen nicht ins öffentliche Log.
function safeMessage(error) {
  const text = String((error && error.message) || error || 'unbekannter Fehler');
  return text.replace(/projects\/\S+/g, 'projects/<entfernt>').slice(0, 300);
}

// db = Firestore (Admin SDK), FieldValue = admin.firestore.FieldValue; getrennt übergeben, damit
// der Ablauf ohne echte Datenbank getestet werden kann.
async function run(db, FieldValue, opts, log = console.log) {
  const snap = await db.collection('users').get();
  const withEmail = snap.docs.filter(doc => hasField(doc.data(), 'email'));
  // Zur Sicherheit: Felder, deren Name "mail" enthält, aber nicht "email" heißt (nur Anzahl, wird nicht angefasst)
  const otherMailFields = snap.docs.filter(doc =>
    Object.keys(doc.data()).some(key => /mail/i.test(key) && key !== 'email')).length;

  log(`Nutzer-Dokumente: ${snap.size}, davon mit Feld "email": ${withEmail.length}.`);
  log(`Dokumente mit anderem Feld, dessen Name "mail" enthält: ${otherMailFields} (werden nicht angefasst).`);

  if (!opts.apply) {
    log('\nTrockenlauf: es wurde nichts geändert. Zum Entfernen "apply" einschalten und als Bestätigung die Anzahl der Dokumente mit Feld "email" eintragen.');
    return { total: snap.size, withEmail: withEmail.length, removed: 0 };
  }

  if (withEmail.length === 0) {
    log('Nichts zu tun: kein Nutzer-Dokument hat ein Feld "email".');
    return { total: snap.size, withEmail: 0, removed: 0 };
  }
  if (opts.confirm !== String(withEmail.length)) {
    throw new Error(`Abbruch: Bestätigung stimmt nicht. Aktuell haben ${withEmail.length} Dokumente ein Feld "email" - genau diese Zahl als Bestätigung eintragen (erst Trockenlauf wiederholen, wenn sie sich geändert hat). Nichts geändert.`);
  }

  log(`\nEntferne das Feld "email" aus ${withEmail.length} Nutzer-Dokumenten...`);
  let removed = 0;
  for (let i = 0; i < withEmail.length; i += 400) {
    const chunk = withEmail.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach(doc => batch.update(doc.ref, { email: FieldValue.delete() }));
    await batch.commit();
    removed += chunk.length;
  }

  // Gegenprobe mit frischem Lesen
  const after = await db.collection('users').get();
  const stillWithEmail = after.docs.filter(doc => hasField(doc.data(), 'email')).length;
  log(`Entfernt: ${removed}. Nutzer-Dokumente danach: ${after.size}, davon noch mit Feld "email": ${stillWithEmail}.`);
  if (stillWithEmail > 0 || after.size !== snap.size) {
    throw new Error(`Gegenprobe fehlgeschlagen: ${stillWithEmail} Dokumente haben noch ein Feld "email", Dokumentanzahl vorher ${snap.size}, nachher ${after.size}.`);
  }
  return { total: after.size, withEmail: withEmail.length, removed };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  await run(admin.firestore(), admin.firestore.FieldValue, opts);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fehler:', safeMessage(error));
      process.exit(1);
    });
}

module.exports = { parseArgs, run, safeMessage };
