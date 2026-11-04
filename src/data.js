export const API_BASE = 'https://openamerica.io/elections/results.json';
export const DATA_SOURCE = 'https://openamerica.io/elections/api/';
export const PUSHBUILD_SOURCE = 'https://pushbuild.com/apis/elections/';
export const PUSHBUILD_INDEX = 'https://api.pushbuild.com/portal/elections/live/index.json';
export const PUSHBUILD_STATE = (state) => `https://api.pushbuild.com/portal/elections/live/${state}.json`;

export const OFFICES = {
  senate: {
    id: 'senate',
    feed: 'Senate',
    label: 'Senate',
    lower: 'Senate',
    raceNoun: 'Senate race',
    raceNounPlural: 'Senate races',
    totalSeats: 33,
    scope: 'Class II seats',
    accent: 'blue',
  },
  house: {
    id: 'house',
    feed: 'House',
    label: 'House',
    lower: 'House',
    raceNoun: 'House race',
    raceNounPlural: 'House races',
    totalSeats: 435,
    scope: 'all 435 seats',
    accent: 'violet',
  },
  governor: {
    id: 'governor',
    feed: 'Governor',
    label: 'Governors',
    lower: 'Governor',
    raceNoun: 'Governor race',
    raceNounPlural: 'Governor races',
    totalSeats: 36,
    scope: '36 governorships',
    accent: 'amber',
  },
};

export const OFFICE_ORDER = ['senate', 'house', 'governor'];

export const PARTIES = {
  D: { code: 'D', name: 'Democrat', adjective: 'Democratic', color: '#2f6fed', soft: 'rgba(47,111,237,.13)' },
  R: { code: 'R', name: 'Republican', adjective: 'Republican', color: '#e5484d', soft: 'rgba(229,72,77,.13)' },
  I: { code: 'I', name: 'Independent', adjective: 'Independent', color: '#8b7cf6', soft: 'rgba(139,124,246,.14)' },
  L: { code: 'L', name: 'Libertarian', adjective: 'Libertarian', color: '#d6a21e', soft: 'rgba(214,162,30,.14)' },
  G: { code: 'G', name: 'Green', adjective: 'Green', color: '#35a45a', soft: 'rgba(53,164,90,.14)' },
  C: { code: 'C', name: 'Constitution', adjective: 'Constitution', color: '#a16a3b', soft: 'rgba(161,106,59,.14)' },
  W: { code: 'W', name: 'Working Families', adjective: 'Working Families', color: '#5b9d86', soft: 'rgba(91,157,134,.14)' },
  O: { code: 'O', name: 'Other', adjective: 'other', color: '#8e8e93', soft: 'rgba(142,142,147,.14)' },
};

const PARTY_ALIASES = {
  DEM: 'D',
  DEMOCRAT: 'D',
  DEMOCRATIC: 'D',
  'DEMOCRATIC PARTY': 'D',
  DFL: 'D',
  'DEMOCRATIC-FARMER-LABOR': 'D',
  REP: 'R',
  REPUBLICAN: 'R',
  'REPUBLICAN PARTY': 'R',
  GOP: 'R',
  IND: 'I',
  INDEPENDENT: 'I',
  IAP: 'I',
  NPP: 'I',
  UNA: 'I',
  NON: 'I',
  NOPTY: 'I',
  NOL: 'I',
  PND: 'I',
  LIB: 'L',
  LIBERTARIAN: 'L',
  LBT: 'L',
  GRN: 'G',
  GREEN: 'G',
  GRE: 'G',
  GP: 'G',
  CON: 'C',
  CONSTITUTION: 'C',
  WFP: 'W',
  WORKING: 'W',
  'WORKING FAMILIES': 'W',
};

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

export const REDISTRICTED_2026 = new Set(['AL', 'CA', 'FL', 'LA', 'NC', 'OH', 'TN', 'TX', 'UT']);

export const FEED_STATES = [
  'AR', 'AZ', 'CO', 'CT', 'FL', 'GA', 'IA', 'ID', 'IN', 'LA', 'MI',
  'MN', 'NC', 'PA', 'RI', 'SC', 'TX', 'UT', 'VA', 'VT', 'WA', 'WV',
];

const collator = new Intl.Collator('en', { sensitivity: 'base' });

export function normalizeParty(value = '') {
  const key = String(value).trim().toUpperCase();
  if (PARTIES[key]) return key;
  return PARTY_ALIASES[key] || (key ? 'O' : 'O');
}

export function partyMeta(code) {
  return PARTIES[normalizeParty(code)] || PARTIES.O;
}

export function ordinal(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  return `${num}${['th', 'st', 'nd', 'rd'][num % 10] || 'th'}`;
}

export function raceLabel(race, style = 'full') {
  const state = STATE_NAMES[race.state] || race.state;
  if (race.office === 'house') {
    const district = race.district === '00' ? 'at-large' : `${ordinal(Number(race.district))} district`;
    if (style === 'short') return `${race.state}-${race.district}`;
    if (style === 'medium') return `${state} ${race.district === '00' ? 'at-large' : race.district}`;
    return `${state} ${district}`;
  }
  if (style === 'short') return `${race.state} ${race.office === 'governor' ? 'Gov' : 'Sen'}`;
  if (style === 'medium') return `${state} ${race.office === 'governor' ? 'governor' : 'Senate'}`;
  return `${state} ${race.office === 'governor' ? 'governor' : 'Senate'}`;
}

export function normalizeRace(office, key, raw, meta = {}) {
  const [state, district = null] = key.split('-');
  const cands = (raw.cands || [])
    .map((candidate) => ({
      name: candidate.n || 'Unnamed candidate',
      party: normalizeParty(candidate.p),
      rawParty: candidate.p || '',
      votes: Number(candidate.v) || 0,
      pct: candidate.pct == null ? null : Number(candidate.pct),
      incumbent: Boolean(candidate.inc),
      winner: Boolean(candidate.w),
      bioguide: candidate.b || '',
    }))
    .sort((a, b) => b.votes - a.votes || collator.compare(a.name, b.name));

  const total = Number(raw.total) || cands.reduce((sum, c) => sum + c.votes, 0);
  const reporting = raw.pct_in == null ? null : Number(raw.pct_in);
  const top = cands[0];
  const second = cands[1];
  const leaderParty = raw.leader ? normalizeParty(raw.leader) : (total > 0 && top ? top.party : '');
  // Margin from raw votes where available. Feed percentages are rounded, so a
  // percentage-point difference collapses genuinely different races to 0.0.
  const margin = top && second
    ? top.votes > 0 && total > 0
      ? (top.votes - second.votes) / total * 100
      : top.pct != null && second.pct != null ? top.pct - second.pct : null
    : null;
  const dVotes = cands.filter((c) => c.party === 'D').reduce((sum, c) => sum + c.votes, 0);
  const rVotes = cands.filter((c) => c.party === 'R').reduce((sum, c) => sum + c.votes, 0);
  const twoPartyTotal = dVotes + rVotes;
  const twoPartyMargin = twoPartyTotal > 0 ? ((dVotes - rVotes) / twoPartyTotal) * 100 : null;

  return {
    office,
    key,
    state,
    district,
    label: raceLabel({ office, state, district }, 'full'),
    mediumLabel: raceLabel({ office, state, district }, 'medium'),
    shortLabel: raceLabel({ office, state, district }, 'short'),
    candidates: cands,
    leaderParty,
    called: Boolean(raw.called),
    winnerParty: raw.winner ? normalizeParty(raw.winner) : '',
    reporting,
    total,
    uncontested: Boolean(raw.uncontested),
    top,
    second,
    margin,
    dVotes,
    rVotes,
    twoPartyMargin,
    hasVotes: total > 0,
    sourceId: meta.sourceId || 'openamerica',
    sourceLabel: meta.sourceLabel || 'OpenAmerica',
    sourceName: meta.sourceName || 'Official state election office',
    sourceUrl: meta.sourceUrl || DATA_SOURCE,
    sourceUpdatedAt: meta.sourceUpdatedAt || null,
    sourceFetchedAt: meta.sourceFetchedAt || null,
  };
}

export function normalizeFeed(feed, office, year, meta = {}) {
  const sourceMeta = {
    sourceId: 'openamerica',
    sourceLabel: 'OpenAmerica',
    sourceName: 'Official state election office',
    sourceUrl: DATA_SOURCE,
    sourceUpdatedAt: feed?.as_of || null,
    ...meta,
  };
  const races = Object.entries(feed?.races || {})
    .map(([key, raw]) => normalizeRace(office, key, raw, sourceMeta))
    .sort((a, b) => collator.compare(a.state, b.state) || collator.compare(a.district || '', b.district || ''));
  const byKey = new Map(races.map((race) => [race.key, race]));
  return {
    ...feed,
    office,
    year,
    races,
    byKey,
    raceCount: races.length,
  };
}

export async function fetchFeed(year, office, { signal } = {}) {
  const url = `${API_BASE}?year=${year}&office=${OFFICES[office].feed}`;
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Feed request failed (${response.status})`);
  }
  const payload = await response.json();
  if (payload?.api !== 1) {
    throw new Error('Unexpected results feed version');
  }
  return normalizeFeed(payload, office, year);
}

const PUSHBUILD_STATES = [
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'IA', 'ID', 'IN', 'LA', 'MD', 'MN',
  'MO', 'NC', 'NE', 'NM', 'NV', 'OH', 'OK', 'PA', 'RI', 'SC', 'SD', 'UT', 'VA', 'VT', 'WA',
];

const AT_LARGE_STATES = new Set(['AK', 'DE', 'ND', 'SD', 'VT', 'WY']);

const ORDINAL_WORDS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
  'twenty-first': 21, 'twenty-second': 22, 'twenty-third': 23, 'twenty-fourth': 24,
  'twenty-fifth': 25, 'twenty-sixth': 26, 'twenty-seventh': 27, 'twenty-eighth': 28,
  'twenty-ninth': 29, thirtieth: 30, 'thirty-first': 31, 'thirty-second': 32,
  'thirty-third': 33, 'thirty-fourth': 34, 'thirty-fifth': 35, 'thirty-sixth': 36,
  'thirty-seventh': 37, 'thirty-eighth': 38, 'thirty-ninth': 39, fortieth: 40,
  'forty-first': 41, 'forty-second': 42, 'forty-third': 43, 'forty-fourth': 44,
  'forty-fifth': 45, 'forty-sixth': 46, 'forty-seventh': 47, 'forty-eighth': 48,
  'forty-ninth': 49, fiftieth: 50, 'fifty-first': 51, 'fifty-second': 52,
};

let pushbuildCache = {
  index: null,
  states: new Map(),
  lastFullAt: 0,
};

function cleanContestName(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function numeric(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function reportingPercent(value) {
  if (!Array.isArray(value)) return value == null ? null : Number(value);
  const counted = Number(value[0]);
  const total = Number(value[1]);
  if (!Number.isFinite(counted) || !Number.isFinite(total) || total <= 0) return null;
  return (counted / total) * 100;
}

function houseDistrict(state, name) {
  const text = cleanContestName(name);
  if (/\bat[- ]large\b/i.test(text)) return '00';
  let match = text.match(/district\s*(?:no\.?\s*)?0*(\d{1,2})\b/i);
  if (match) return String(Number(match[1])).padStart(2, '0');
  match = text.match(/0*(\d{1,2})(?:st|nd|rd|th)\s+(?:congressional\s+)?district\b/i);
  if (match) return String(Number(match[1])).padStart(2, '0');
  const word = text.match(/\b([a-z]+(?:-[a-z]+)?)\s+district\b/i);
  if (word && ORDINAL_WORDS[word[1].toLowerCase()]) return String(ORDINAL_WORDS[word[1].toLowerCase()]).padStart(2, '0');
  match = text.match(/(?:representative(?:\s+in)?\s+congress|congress)(?:\s*[-–—]\s*|\s+)(?:district\s*)?0*(\d{1,2})\s*$/i);
  if (match) return String(Number(match[1])).padStart(2, '0');
  return AT_LARGE_STATES.has(state) ? '00' : null;
}

function pushbuildContestOffice(state, name) {
  const text = cleanContestName(name);
  const lower = text.toLowerCase();
  if (/\bstate\s+senat(?:e|or)\b|\bstate\s+house\b|\bhouse\s+of\s+delegates\b|\bgeneral\s+assembly\b|\bstate\s+representative\b|\blegislative\s+district\b/i.test(lower)) return null;
  const senate = /\b(?:u\.?\s*s\.?|united\s+states)\s+senat(?:e|or)\b|\bsenator\s+in\s+congress\b|\bmember,?\s+(?:of\s+)?(?:the\s+)?(?:united\s+states\s+senate)\b/i.test(text);
  if (senate) return { office: 'senate', district: null, special: /special/i.test(text) };
  if (/^governor\b/i.test(text) || /^for\s+governor$/i.test(text)) return { office: 'governor', district: null, special: false };
  const house = /\b(?:u\.?\s*s\.?|united\s+states)\s+(?:house|representative)\b|\brepresentative\s+in\s+congress\b|\brepresentative\s+to\s+(?:the\s+)?(?:1\d\dth\s+)?(?:united\s+states\s+)?congress\b|\bmember,?\s+(?:of\s+)?(?:the\s+)?house\s+of\s+representatives\b|\bcongressional\s+district\b.*\brepresentative\b|\bu\.?\s*s\.?\s+representative\b/i.test(text);
  if (!house) return null;
  const district = houseDistrict(state, text);
  if (!district) return null;
  return { office: 'house', district, special: /special/i.test(text) };
}

function pushbuildRaceKey(state, parsed) {
  if (parsed.office === 'house') return `${state}-${parsed.district}`;
  if (parsed.office === 'senate' && parsed.special) return `${state}-special`;
  return state;
}

function pushbuildRawContest(contest) {
  const cands = (contest.cands || [])
    .map((candidate) => {
      if (!Array.isArray(candidate)) return null;
      return {
        n: candidate[0] || 'Unnamed candidate',
        p: candidate[1] || '',
        v: numeric(candidate[2]),
        pct: candidate[3] == null ? null : Number(candidate[3]),
      };
    })
    .filter(Boolean);
  return {
    cands,
    total: numeric(contest.total),
    pct_in: reportingPercent(contest.reporting),
    uncontested: cands.length === 1,
    called: false,
  };
}

async function fetchJson(url, { signal } = {}) {
  const response = await fetch(url, {
    signal,
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
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

export async function fetchPushbuild({ signal, force = false } = {}) {
  const full = force || !pushbuildCache.index || Date.now() - pushbuildCache.lastFullAt > 5 * 60_000;
  let index = pushbuildCache.index;
  const errors = [];
  try {
    index = await fetchJson(PUSHBUILD_INDEX, { signal });
  } catch (error) {
    errors.push({ scope: 'index', message: error.message });
    if (!index) index = { states: PUSHBUILD_STATES.map((state) => ({ state, updated: null })), fetched: null };
  }
  const entries = index?.states || [];
  const nextStates = new Map();
  const pending = [];
  for (const entry of entries) {
    const state = entry.state;
    if (!state) continue;
    const cached = pushbuildCache.states.get(state);
    const age = Date.now() - (cached?.receivedAt || 0);
    if (!full && cached && entry.updated && cached.updated === entry.updated && age < 6 * 60_000) {
      nextStates.set(state, cached);
    } else {
      pending.push(entry);
    }
  }
  const fetched = await mapLimit(pending, 6, async (entry) => {
    const state = entry.state;
    try {
      const data = await fetchJson(PUSHBUILD_STATE(state), { signal });
      const record = { data, receivedAt: Date.now(), updated: entry.updated || data.updated || null };
      nextStates.set(state, record);
      return record;
    } catch (error) {
      errors.push({ scope: state, message: error.message });
      const cached = pushbuildCache.states.get(state);
      if (cached) nextStates.set(state, cached);
      return null;
    }
  });
  void fetched;
  pushbuildCache = {
    index,
    states: nextStates,
    lastFullAt: full ? Date.now() : pushbuildCache.lastFullAt,
  };
  return {
    index,
    states: [...nextStates.entries()].map(([state, record]) => ({ state, ...record })),
    errors,
    fetchedAt: Date.now(),
  };
}

export function buildPushbuildFeeds(bundle, year) {
  const races = { senate: [], house: [], governor: [] };
  let latest = null;
  for (const record of bundle?.states || []) {
    const data = record.data;
    if (!data || data.test) continue;
    const state = data.state || record.state;
    if (!state) continue;
    const updated = data.updated || record.updated || null;
    const fetchedAt = data.fetched || new Date(record.receivedAt || Date.now()).toISOString();
    if (updated && (!latest || new Date(updated) > new Date(latest))) latest = updated;
    for (const contest of data.contests || []) {
      const parsed = pushbuildContestOffice(state, contest.name);
      if (!parsed || (parsed.office === 'house' && parsed.special)) continue;
      const key = pushbuildRaceKey(state, parsed);
      const normalized = normalizeRace(parsed.office, key, pushbuildRawContest(contest), {
        sourceId: 'pushbuild',
        sourceLabel: 'Pushbuild',
        sourceName: data.source || 'Official state election office',
        sourceUrl: data.sourceUrl || PUSHBUILD_SOURCE,
        sourceUpdatedAt: updated,
        sourceFetchedAt: fetchedAt,
      });
      races[parsed.office].push(normalized);
    }
  }
  const output = {};
  for (const office of OFFICE_ORDER) {
    const list = races[office].sort((a, b) => collator.compare(a.state, b.state) || collator.compare(a.district || '', b.district || ''));
    output[office] = {
      api: 1,
      year,
      office,
      live: true,
      stale: false,
      counting: list.some((race) => race.hasVotes),
      final: false,
      as_of: latest,
      source: 'state',
      races: list,
      byKey: new Map(list.map((race) => [race.key, race])),
      raceCount: list.length,
    };
  }
  output.coverage = {
    states: new Set((bundle?.states || []).map((record) => record.data?.state || record.state)).size,
    errors: bundle?.errors || [],
    as_of: latest,
  };
  return output;
}

function raceSource(race) {
  return {
    id: race.sourceId,
    label: race.sourceLabel,
    name: race.sourceName,
    url: race.sourceUrl,
    total: race.total,
    reporting: race.reporting,
    updatedAt: race.sourceUpdatedAt,
  };
}

function mergeSources(left = [], right = []) {
  const merged = new Map(left.map((source) => [source.id, source]));
  for (const source of right) merged.set(source.id, source);
  return [...merged.values()];
}

function timestamp(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function chooseRace(left, right) {
  if (left.sourceId === right.sourceId) {
    const newness = timestamp(right.sourceUpdatedAt) - timestamp(left.sourceUpdatedAt);
    if (newness !== 0) return newness > 0 ? right : left;
  }
  if (left.hasVotes !== right.hasVotes) return right.hasVotes ? right : left;
  if (left.total !== right.total) return right.total > left.total ? right : left;
  const newness = timestamp(right.sourceUpdatedAt) - timestamp(left.sourceUpdatedAt);
  return newness > 0 ? right : left;
}

export function mergeOfficeFeeds(office, year, feeds = []) {
  const map = new Map();
  for (const feed of feeds) {
    if (!feed) continue;
    for (const race of feed.races || []) {
      const existing = map.get(race.key);
      if (!existing) {
        map.set(race.key, { ...race, sources: [raceSource(race)] });
        continue;
      }
      const chosen = chooseRace(existing, race);
      map.set(race.key, {
        ...chosen,
        sources: mergeSources(existing.sources, [raceSource(race)]),
      });
    }
  }
  const races = [...map.values()].sort((a, b) => collator.compare(a.state, b.state) || collator.compare(a.district || '', b.district || ''));
  const sourceMap = new Map();
  for (const race of races) {
    for (const source of race.sources || []) {
      if (!source.id) continue;
      const entry = sourceMap.get(source.id) || {
        id: source.id,
        label: source.label,
        name: source.name,
        url: source.url,
        races: 0,
        states: new Set(),
      };
      entry.races += 1;
      entry.states.add(race.state);
      sourceMap.set(source.id, entry);
    }
  }
  const asOf = feeds
    .flatMap((feed) => [feed?.as_of, ...(feed?.races || []).map((race) => race.sourceUpdatedAt)])
    .filter(Boolean)
    .sort((a, b) => timestamp(b) - timestamp(a))[0] || null;
  return {
    api: 1,
    year,
    office,
    live: feeds.some((feed) => feed?.live),
    stale: feeds.some((feed) => feed?.stale),
    counting: races.some((race) => race.hasVotes),
    final: feeds.length > 0 && feeds.every((feed) => feed?.final),
    as_of: asOf,
    source: 'merged',
    races,
    byKey: new Map(races.map((race) => [race.key, race])),
    raceCount: races.length,
    sources: [...sourceMap.values()].map((source) => ({ ...source, states: source.states.size })),
  };
}

export function allRaces(feeds, year = 2026) {
  return OFFICE_ORDER.flatMap((office) => feeds?.[year]?.[office]?.races || []);
}

export function findPriorRace(race, priorFeed) {
  return priorFeed?.byKey?.get(race.key) || null;
}

export function compareRace(race, prior) {
  if (!prior || !prior.hasVotes || !race.hasVotes) return null;
  // A swing needs a real two-party baseline in both years. An uncontested or
  // one-party 2024 race produces a +/-100 "margin" with nothing behind it, and
  // swings computed off that baseline are artifacts, not shifts.
  if (race.uncontested || prior.uncontested) return null;
  if (!(race.dVotes > 0 && race.rVotes > 0 && prior.dVotes > 0 && prior.rVotes > 0)) return null;
  const current = race.twoPartyMargin;
  const before = prior.twoPartyMargin;
  if (current == null || before == null) return null;
  if (Math.abs(before) >= 99.999) return null;
  return {
    current,
    before,
    swing: current - before,
    reporting: race.reporting,
    priorReporting: prior.reporting,
    redistricted: race.office === 'house' && REDISTRICTED_2026.has(race.state),
    priorLabel: prior.leaderParty ? partyMeta(prior.leaderParty).name : '—',
  };
}

export function leadingCounts(races) {
  const counts = { D: 0, R: 0, other: 0, none: 0 };
  for (const race of races) {
    if (!race.hasVotes || !race.leaderParty) counts.none += 1;
    else if (race.leaderParty === 'D') counts.D += 1;
    else if (race.leaderParty === 'R') counts.R += 1;
    else counts.other += 1;
  }
  return counts;
}

export function officeTotals(races) {
  const totalVotes = races.reduce((sum, race) => sum + race.total, 0);
  const reporting = races.filter((race) => race.reporting != null && race.reporting >= 99.999).length;
  const withVotes = races.filter((race) => race.hasVotes).length;
  const counted = races.filter((race) => race.reporting != null);
  const avgReporting = counted.length
    ? counted.reduce((sum, race) => sum + race.reporting, 0) / counted.length
    : null;
  return {
    totalVotes,
    reporting,
    withVotes,
    avgReporting,
    races: races.length,
  };
}

export function stateGroups(races) {
  const groups = new Map();
  for (const race of races) {
    if (!groups.has(race.state)) {
      groups.set(race.state, { state: race.state, name: STATE_NAMES[race.state] || race.state, races: [] });
    }
    groups.get(race.state).races.push(race);
  }
  return [...groups.values()].sort((a, b) => collator.compare(a.state, b.state));
}

export function closestRaces(races, { minReporting = 5, minVotes = 1000, limit = 6, requireBothParties = true } = {}) {
  return races
    .filter((race) => race.hasVotes && race.margin != null && race.margin > 0 && (race.reporting ?? 0) >= minReporting && race.total >= minVotes)
    .filter((race) => !requireBothParties || (race.dVotes > 0 && race.rVotes > 0))
    .sort((a, b) => a.margin - b.margin
      || Math.abs((a.top?.votes || 0) - (a.second?.votes || 0)) - Math.abs((b.top?.votes || 0) - (b.second?.votes || 0))
      || b.total - a.total)
    .slice(0, limit);
}

export function prominentRaces(races, limit = 6) {
  return [...races]
    .filter((race) => race.hasVotes)
    .sort((a, b) => (b.reporting ?? 0) - (a.reporting ?? 0) || b.total - a.total)
    .slice(0, limit);
}

export function formatNumber(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-US').format(Number(value));
}

export function formatCompact(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value));
}

export function formatPct(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatPoints(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;
}

export function formatSignedPct(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)} pts`;
}

export function formatMargin(race) {
  if (race?.margin == null) return '—';
  // Sub-point margins get two decimals so genuinely different close races do
  // not all read as the same 0.0.
  const digits = race.margin < 1 ? 2 : 1;
  return `${race.margin.toFixed(digits)} pts`;
}

export function marginParty(race) {
  if (!race?.leaderParty) return 'none';
  return race.leaderParty === 'D' || race.leaderParty === 'R' ? race.leaderParty : 'other';
}

export function formatTimeET(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function formatDateET(iso, options = {}) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function relativeTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.round(diff / 1000);
  if (sec < 15) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function getStateStatus(races, state) {
  const stateRaces = races.filter((race) => race.state === state);
  if (!stateRaces.length) return { state, races: [], hasFeed: false };
  const counts = leadingCounts(stateRaces);
  const decided = counts.D + counts.R + counts.other;
  let leader = 'none';
  if (counts.D > counts.R) leader = 'D';
  else if (counts.R > counts.D) leader = 'R';
  else if (counts.D > 0 && counts.R > 0) leader = 'split';
  else if (counts.other > 0) leader = 'other';
  return {
    state,
    name: STATE_NAMES[state] || state,
    races: stateRaces,
    hasFeed: true,
    counts,
    leader,
    decided,
    splitD: counts.D,
    splitR: counts.R,
  };
}

export function maxAsOf(feeds, year = 2026) {
  let max = null;
  for (const office of OFFICE_ORDER) {
    const iso = feeds?.[year]?.[office]?.as_of;
    if (!iso) continue;
    if (!max || new Date(iso) > new Date(max)) max = iso;
  }
  return max;
}

export function sortRaces(races, sort, priorByOffice = {}) {
  const copy = [...races];
  const swingAbs = (race) => {
    const prior = priorByOffice[race.office]?.byKey?.get(race.key);
    const compared = compareRace(race, prior);
    return compared ? Math.abs(compared.swing) : -1;
  };
  if (sort === 'closest') {
    copy.sort((a, b) => {
      if (a.margin == null && b.margin == null) return b.total - a.total;
      if (a.margin == null) return 1;
      if (b.margin == null) return -1;
      return a.margin - b.margin;
    });
  } else if (sort === 'reporting') {
    copy.sort((a, b) => (b.reporting ?? -1) - (a.reporting ?? -1) || b.total - a.total);
  } else if (sort === 'votes') {
    copy.sort((a, b) => b.total - a.total);
  } else if (sort === 'swing') {
    copy.sort((a, b) => swingAbs(b) - swingAbs(a));
  } else if (sort === 'state') {
    copy.sort((a, b) => collator.compare(a.state, b.state) || collator.compare(a.district || '', b.district || ''));
  }
  return copy;
}
