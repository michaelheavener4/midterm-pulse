export const API_BASE = 'https://openamerica.io/elections/results.json';
export const DATA_SOURCE = 'https://openamerica.io/elections/api/';

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
  REP: 'R',
  REPUBLICAN: 'R',
  GOP: 'R',
  IND: 'I',
  INDEPENDENT: 'I',
  LIB: 'L',
  LIBERTARIAN: 'L',
  GRN: 'G',
  GREEN: 'G',
  CON: 'C',
  CONSTITUTION: 'C',
  WFP: 'W',
  WORKING: 'W',
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

export function normalizeRace(office, key, raw) {
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
  const leaderParty = raw.leader ? normalizeParty(raw.leader) : '';
  const top = cands[0];
  const second = cands[1];
  const margin = top && second && top.pct != null && second.pct != null ? top.pct - second.pct : null;
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
  };
}

export function normalizeFeed(feed, office, year) {
  const races = Object.entries(feed?.races || {})
    .map(([key, raw]) => normalizeRace(office, key, raw))
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

export function allRaces(feeds, year = 2026) {
  return OFFICE_ORDER.flatMap((office) => feeds?.[year]?.[office]?.races || []);
}

export function findPriorRace(race, priorFeed) {
  return priorFeed?.byKey?.get(race.key) || null;
}

export function compareRace(race, prior) {
  if (!prior || !prior.hasVotes || !race.hasVotes) return null;
  const current = race.twoPartyMargin;
  const before = prior.twoPartyMargin;
  if (current == null || before == null) return null;
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
    .filter((race) => race.hasVotes && race.margin != null && (race.reporting ?? 0) >= minReporting && race.total >= minVotes)
    .filter((race) => !requireBothParties || (race.dVotes > 0 && race.rVotes > 0))
    .sort((a, b) => a.margin - b.margin)
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
  return `${race.margin.toFixed(1)} pts`;
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
