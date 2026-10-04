// Gibt die internationalen Spiele (Spielort ausserhalb der USA) einer Saison als
// fertigen Code-Block für INTERNATIONAL_GAMES in js/config.js aus.
// Braucht keine Zugangsdaten (öffentliche ESPN-Schnittstelle).
//
// Aufruf (einmal pro neuer Saison, sobald der Spielplan feststeht):
//   node fetch-international-games.js 2027

const season = process.argv[2];
if (!season) {
  console.error('Aufruf: node fetch-international-games.js <Saison>   (z.B. 2027)');
  process.exit(1);
}

// ESPN-Kürzel -> unsere Datenbank (siehe check-scores.js)
const ABBR = { WSH: 'WAS' };
const CITY_EN = { 'Saint-Denis': 'Paris', 'Rio De Janeiro': 'Rio de Janeiro', 'Sao Paulo': 'São Paulo' };
const CITY_DE = { Munich: 'München', 'Mexico City': 'Mexiko-Stadt' };

async function main() {
  const lines = [];
  for (let week = 1; week <= 18; week++) {
    // "dates=<Saison>" statt "year=": ESPN ignoriert year und liefert dann immer
    // die aktuelle Saison, egal welche man anfragt
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&dates=${season}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN-Fehler Woche ${week}: ${res.status}`);
    const data = await res.json();
    if (String(data.season?.year) !== String(season)) {
      throw new Error(`ESPN lieferte Saison ${data.season?.year} statt ${season} (Woche ${week})`);
    }
    const events = data.events || [];

    for (const event of events) {
      const comp = event.competitions?.[0];
      const venue = comp?.venue;
      const country = venue?.address?.country;
      if (!country || /^(USA|United States)$/i.test(country)) continue;

      const abbrs = comp.competitors
        .map(c => ABBR[c.team.abbreviation] || c.team.abbreviation)
        .sort();
      const city = CITY_EN[venue.address.city] || venue.address.city;
      const cityDe = CITY_DE[city];
      const parts = [`city: '${city}'`];
      if (cityDe) parts.push(`city_de: '${cityDe}'`);
      parts.push(`stadium: '${venue.fullName}'`);
      lines.push(`  '${season}_${week}_${abbrs.join('_')}': { ${parts.join(', ')} },`);
    }
  }
  console.log(lines.join('\n'));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
