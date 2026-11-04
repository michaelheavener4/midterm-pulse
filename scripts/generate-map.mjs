import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoAlbersUsa, geoPath } from 'd3-geo';

const topo = JSON.parse(readFileSync(new URL('../node_modules/us-atlas/states-10m.json', import.meta.url)));
const states = feature(topo, topo.objects.states).features;
const fips = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'
};
const projection = geoAlbersUsa().fitExtent([[16, 20], [960, 590]], { type: 'FeatureCollection', features: states });
const path = geoPath(projection);
const out = {};
for (const f of states) {
  const abbr = fips[String(f.id).padStart(2, '0')];
  if (!abbr) continue;
  const [cx, cy] = path.centroid(f);
  out[abbr] = { d: path(f), cx: +cx.toFixed(1), cy: +cy.toFixed(1) };
}
writeFileSync(new URL('../src/us-map.json', import.meta.url), JSON.stringify(out) + '\n');
console.log('states:', Object.keys(out).length, 'bytes:', JSON.stringify(out).length);
