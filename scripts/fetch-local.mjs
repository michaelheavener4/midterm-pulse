import { load } from 'cheerio';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const INDEX_URL = 'https://ballotpedia.org/Local_ballot_measure_elections_in_2026';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36';
const STATE_CODES = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS',
  Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA',
  Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT',
  Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
  Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV',
  Wisconsin: 'WI', Wyoming: 'WY', 'Washington, D.C.': 'DC',
};

function clean(text = '') {
  return text.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

function absolute(href = '') {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `https://ballotpedia.org${href}`;
  return '';
}

function parseVotes(text = '') {
  const match = clean(text).match(/([\d,]+)\s*(?:\(([\d.]+)%\))?/);
  if (!match) return { votes: 0, pct: null };
  return {
    votes: Number(match[1].replace(/,/g, '')) || 0,
    pct: match[2] == null ? null : Number(match[2]),
  };
}

function splitJurisdiction(title, stateName) {
  const marker = `, ${stateName},`;
  const index = title.indexOf(marker);
  const prefix = index > -1 ? title.slice(0, index).trim() : title.split(',')[0].trim();
  const rest = index > -1 ? title.slice(index + marker.length).trim() : '';
  const lowerPrefix = prefix.toLowerCase();
  const lowerRest = rest.toLowerCase();
  let level = 'city';
  if (lowerPrefix.includes('school') || lowerPrefix.includes('unified') || lowerPrefix.includes('public schools') || lowerPrefix.includes('community college')) level = 'school';
  else if (lowerPrefix.includes('township')) level = 'township';
  else if (lowerPrefix.includes('county') || /^county\b/.test(lowerRest)) level = 'county';
  else if (lowerPrefix.includes('district')) level = 'district';
  else if (lowerPrefix.includes('city') || lowerPrefix.includes('town') || lowerPrefix.includes('village') || lowerPrefix.includes('borough')) level = 'city';
  const countyMatch = title.match(/\(([^)]*County)\)/);
  const county = countyMatch
    ? clean(countyMatch[1])
    : level === 'county' && lowerPrefix.includes('county')
      ? prefix
      : null;
  return {
    jurisdiction: prefix,
    level,
    county,
    city: level === 'city' || level === 'township' ? prefix : null,
  };
}

function parseStatePage(html, stateName) {
  const $ = load(html);
  const state = STATE_CODES[stateName];
  const items = [];
  const dateHeadings = $('h2, h3').toArray().filter((element) => /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/i.test(clean($(element).text())));
  const hasDateHeadings = dateHeadings.length > 0;
  let sectionDate = hasDateHeadings ? '' : '2026-11-03';
  let jurisdictionHeading = '';

  $('h2, h3, h4, table').each((_, element) => {
    const tag = element.tagName;
    if (tag === 'h2') {
      if (hasDateHeadings) sectionDate = '';
      jurisdictionHeading = '';
      return;
    }
    if (tag === 'h3') {
      const text = clean($(element).text());
      if (hasDateHeadings) sectionDate = /^November\s+3\b/i.test(text) ? '2026-11-03' : '';
      jurisdictionHeading = '';
      return;
    }
    if (tag === 'h4') {
      jurisdictionHeading = clean($(element).text());
      return;
    }
    if (tag !== 'table' || sectionDate !== '2026-11-03') return;

    const rows = $(element).find('tr');
    if (rows.length < 2) return;
    const headers = rows.first().find('th, td').map((__, cell) => clean($(cell).text()).toLowerCase()).get();
    const indexOf = (needle) => headers.findIndex((header) => header.includes(needle));
    const nameIndex = Math.max(0, indexOf('name'));
    const typeIndex = indexOf('type');
    const subjectIndex = indexOf('subject');
    const descriptionIndex = indexOf('description');
    const resultIndex = indexOf('result');
    const yesIndex = indexOf('yes');
    const noIndex = indexOf('no');

    rows.slice(1).each((__, row) => {
      const cells = $(row).find('td');
      if (!cells.length) return;
      const title = clean(cells.eq(nameIndex).text());
      if (!title) return;
      const link = absolute(cells.eq(nameIndex).find('a').first().attr('href'));
      const type = typeIndex > -1 ? clean(cells.eq(typeIndex).text()) : '';
      if (!type) return;
      const subject = subjectIndex > -1 ? clean(cells.eq(subjectIndex).text()) : '';
      const description = descriptionIndex > -1 ? clean(cells.eq(descriptionIndex).text()) : '';
      const resultText = resultIndex > -1 ? clean(cells.eq(resultIndex).text()) : '';
      const yes = parseVotes(yesIndex > -1 ? cells.eq(yesIndex).text() : '');
      const no = parseVotes(noIndex > -1 ? cells.eq(noIndex).text() : '');
      const meta = splitJurisdiction(title, stateName);
      const result = /^a\b/i.test(resultText) || /approved/i.test(resultText)
        ? 'approved'
        : /^d\b/i.test(resultText) || /defeated|rejected/i.test(resultText)
          ? 'rejected'
          : '';
      const totalVotes = yes.votes + no.votes;
      const id = createHash('sha1').update(`${state}|${title}`).digest('hex').slice(0, 12);
      const jurisdiction = meta.level === 'county' && !meta.jurisdiction.toLowerCase().includes('county') && jurisdictionHeading.endsWith('County')
        ? jurisdictionHeading
        : meta.jurisdiction;
      items.push({
        id,
        state,
        stateName,
        electionDate: sectionDate,
        jurisdiction,
        level: meta.level,
        county: meta.county || (jurisdictionHeading.endsWith('County') ? jurisdictionHeading : null),
        city: meta.city,
        countyHeading: jurisdictionHeading.endsWith('County') ? jurisdictionHeading : null,
        title,
        measure: (title.match(/\b(?:Measure|Question|Issue|Proposition|Prop\.?|Article|Amendment)\s+[A-Z0-9-]+/i) || [])[0] || '',
        type,
        subject,
        description: description.slice(0, 420),
        result,
        resultText,
        yesVotes: yes.votes,
        noVotes: no.votes,
        yesPct: yes.pct,
        noPct: no.pct,
        totalVotes,
        sourceUrl: link,
      });
    });
  });

  return items;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const indexHtml = await fetchText(INDEX_URL);
const $index = load(indexHtml);
const stateUrls = new Map();
$index('a[href$="_2026_local_ballot_measures"]').each((_, element) => {
  const href = $index(element).attr('href') || '';
  const match = href.match(/^\/([A-Za-z_\s,.]+)_2026_local_ballot_measures/);
  if (!match) return;
  const stateName = match[1].replace(/_/g, ' ');
  if (!STATE_CODES[stateName]) return;
  stateUrls.set(stateName, `https://ballotpedia.org${href.split('#')[0]}`);
});

console.log(`Fetching ${stateUrls.size} state pages…`);
const pages = await mapLimit([...stateUrls.entries()], 4, async ([stateName, url], index) => {
  if (index > 0) await new Promise((resolve) => setTimeout(resolve, 120));
  try {
    const html = await fetchText(url);
    const items = parseStatePage(html, stateName);
    console.log(`${stateName}: ${items.length} local measures`);
    return items;
  } catch (error) {
    console.warn(`${stateName} failed: ${error.message}`);
    return [];
  }
});

const all = pages.flat().sort((a, b) => a.state.localeCompare(b.state) || a.jurisdiction.localeCompare(b.jurisdiction) || a.title.localeCompare(b.title));
const stateCount = new Set(all.map((item) => item.state)).size;
const countyCount = new Set(all.filter((item) => item.county).map((item) => `${item.state}|${item.county}`)).size;
const cityCount = new Set(all.filter((item) => item.city).map((item) => `${item.state}|${item.city}`)).size;
const payload = {
  generatedAt: new Date().toISOString(),
  source: 'Ballotpedia',
  sourceUrl: INDEX_URL,
  attribution: 'Local ballot measure index and result tables from Ballotpedia. Times and counts are unofficial until certified.',
  stateCount,
  countyCount,
  cityCount,
  count: all.length,
  items: all,
};
await writeFile(new URL('../src/local-issues.json', import.meta.url), `${JSON.stringify(payload)}\n`);
console.log(`Wrote ${all.length} measures across ${stateCount} states, ${countyCount} counties, ${cityCount} cities.`);
