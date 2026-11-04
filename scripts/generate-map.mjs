import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoAlbersUsa, geoPath } from 'd3-geo';

const statesTopo = JSON.parse(readFileSync(new URL('../node_modules/us-atlas/states-10m.json', import.meta.url)));
const countiesTopo = JSON.parse(readFileSync(new URL('../node_modules/us-atlas/counties-10m.json', import.meta.url)));
const states = feature(statesTopo, statesTopo.objects.states).features;
const counties = feature(countiesTopo, countiesTopo.objects.counties).features;
const fips = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'
};
const projection = geoAlbersUsa().fitExtent([[16, 20], [960, 590]], { type: 'FeatureCollection', features: states });
const path = geoPath(projection);
const roundPath = (d) => d.replace(/-?\d+(?:\.\d+)?/g, (number) => `${Math.round(Number(number) * 10) / 10}`);

const stateOut = {};
for (const f of states) {
  const abbr = fips[String(f.id).padStart(2, '0')];
  if (!abbr) continue;
  const [cx, cy] = path.centroid(f);
  const [[x0, y0], [x1, y1]] = path.bounds(f);
  stateOut[abbr] = {
    d: roundPath(path(f)),
    cx: +cx.toFixed(1),
    cy: +cy.toFixed(1),
    bbox: [+x0.toFixed(1), +y0.toFixed(1), +x1.toFixed(1), +y1.toFixed(1)],
  };
}
writeFileSync(new URL('../src/us-map.json', import.meta.url), JSON.stringify(stateOut) + '\n');

const countyOut = {};
for (const f of counties) {
  const id = String(f.id).padStart(5, '0');
  const state = fips[id.slice(0, 2)];
  if (!state) continue;
  const d = path(f);
  if (!d) continue;
  const [cx, cy] = path.centroid(f);
  countyOut[id] = {
    s: state,
    n: f.properties.name,
    d: roundPath(d),
    cx: +cx.toFixed(1),
    cy: +cy.toFixed(1),
  };
}
writeFileSync(new URL('../src/county-map.json', import.meta.url), JSON.stringify(countyOut) + '\n');

console.log('states:', Object.keys(stateOut).length, 'counties:', Object.keys(countyOut).length);
