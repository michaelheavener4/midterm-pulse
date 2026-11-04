import {
  OFFICES,
  OFFICE_ORDER,
  STATE_NAMES,
  DATA_SOURCE,
  PUSHBUILD_SOURCE,
  fetchFeed,
  fetchPushbuild,
  buildPushbuildFeeds,
  mergeOfficeFeeds,
  allRaces,
  findPriorRace,
  compareRace,
  leadingCounts,
  officeTotals,
  closestRaces,
  formatNumber,
  formatCompact,
  formatPct,
  formatPoints,
  formatMargin,
  formatSignedPct,
  formatTimeET,
  formatDateET,
  relativeTime,
  getStateStatus,
  sortRaces,
  partyMeta,
  normalizeParty,
  maxAsOf,
} from './data.js';
import { icon } from './icons.js';
import statePaths from './us-map.json';
import localData from './local-issues.json';

const app = document.querySelector('#app');
const LOCAL_ITEMS = localData.items;
const LOCAL_SUBJECTS = [...new Set(LOCAL_ITEMS.map((item) => item.subject).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b))
  .slice(0, 24);
const LOCAL_STATES = [...new Set(LOCAL_ITEMS.map((item) => item.state))]
  .sort((a, b) => (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b));

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'spark' },
  { id: 'senate', label: 'Senate', icon: 'layers' },
  { id: 'house', label: 'House', icon: 'barChart' },
  { id: 'governors', label: 'Governors', icon: 'compass' },
  { id: 'local', label: 'Local issues', icon: 'map' },
  { id: 'compare', label: 'Compare', icon: 'activity' },
  { id: 'watchlist', label: 'Watchlist', icon: 'bookmark' },
];

const ROUTE_OFFICE = { senate: 'senate', house: 'house', governors: 'governor' };
const LEVEL_LABELS = {
  city: 'City',
  county: 'County',
  school: 'School district',
  district: 'District',
  township: 'Township',
};

const store = {
  route: routeFromHash(),
  ready: false,
  loading: true,
  refreshing: false,
  feeds: { 2024: {}, 2026: {} },
  priorReady: false,
  priorError: false,
  errors: {},
  sourceReport: [],
  events: [],
  lastRefreshAt: null,
  nextRefreshAt: 0,
  theme: 'light',
  mapOffice: 'all',
  compareOffice: 'house',
  drawer: null,
  watch: loadWatchlist(),
  office: { query: '', party: 'all', status: 'all', sort: 'closest', limit: 96 },
  local: { state: 'all', level: 'all', subject: 'all', result: 'all', query: '', sort: 'votes', limit: 96 },
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function routeFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return NAV.some((item) => item.id === raw) ? raw : 'overview';
}

function loadWatchlist() {
  try {
    const saved = JSON.parse(localStorage.getItem('midterm-pulse-watchlist') || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function saveWatchlist() {
  localStorage.setItem('midterm-pulse-watchlist', JSON.stringify(store.watch));
}

function initTheme() {
  const saved = localStorage.getItem('midterm-pulse-theme');
  const preferred = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved || preferred, false);
}

function applyTheme(theme, persist = true) {
  store.theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = store.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', store.theme === 'dark' ? '#0b0b0d' : '#f5f5f7');
  if (persist) localStorage.setItem('midterm-pulse-theme', store.theme);
}

function currentRaces() {
  return allRaces(store.feeds, 2026);
}

function officeFeed(office) {
  return store.feeds[2026]?.[office] || null;
}

function priorFeed(office) {
  return store.feeds[2024]?.[office] || null;
}

function findCurrentRace(office, key) {
  return store.feeds[2026]?.[office]?.byKey?.get(key) || null;
}

function raceKey(race) {
  return `race:${race.office}:${race.key}`;
}

function localKey(item) {
  return `local:${item.id}`;
}

function raceWatchMeta(race) {
  return {
    type: 'race',
    office: race.office,
    key: race.key,
    label: race.label,
    medium: race.mediumLabel,
    state: race.state,
    added: Date.now(),
  };
}

function localWatchMeta(item) {
  return {
    type: 'local',
    id: item.id,
    label: item.title,
    jurisdiction: item.jurisdiction,
    state: item.state,
    added: Date.now(),
  };
}

function toggleWatch(key, meta) {
  if (store.watch[key]) {
    delete store.watch[key];
    showToast('Removed from watchlist');
  } else {
    store.watch[key] = meta;
    showToast('Added to watchlist');
  }
  saveWatchlist();
  render();
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 260);
  }, 2200);
}

function leaderLine(race) {
  if (!race?.leaderParty) return '<span class="muted">Awaiting count</span>';
  const party = partyMeta(race.leaderParty);
  const leader = race.candidates.find((candidate) => candidate.party === race.leaderParty) || race.top;
  return `<span class="party-dot" style="background:${party.color}"></span><span class="leader-name">${esc(leader?.name || party.name)}</span><span class="party-code" style="color:${party.color}">${esc(race.leaderParty)}</span>`;
}

function marginLabel(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  const party = value >= 0 ? 'D' : 'R';
  return `${party}+${Math.abs(value).toFixed(digits)}`;
}

function yesNoClass(item) {
  if (item.result === 'approved') return 'approved';
  if (item.result === 'rejected') return 'rejected';
  if (!item.totalVotes) return 'waiting';
  return item.yesVotes >= item.noVotes ? 'passing' : 'failing';
}

function localStatus(item) {
  if (item.result === 'approved') return 'Approved';
  if (item.result === 'rejected') return 'Rejected';
  if (!item.totalVotes) return 'Awaiting count';
  return item.yesVotes >= item.noVotes ? 'Passing' : 'Failing';
}

function localStats() {
  const withVotes = LOCAL_ITEMS.filter((item) => item.totalVotes > 0).length;
  const decided = LOCAL_ITEMS.filter((item) => item.result).length;
  const approved = LOCAL_ITEMS.filter((item) => item.result === 'approved').length;
  const rejected = LOCAL_ITEMS.filter((item) => item.result === 'rejected').length;
  return {
    total: localData.count,
    states: localData.stateCount,
    counties: localData.countyCount,
    cities: localData.cityCount,
    withVotes,
    decided,
    approved,
    rejected,
  };
}

function partyBar(d, r, other = 0, none = 0, label = false) {
  const total = Math.max(1, d + r + other + none);
  const part = (value) => `${(value / total) * 100}%`;
  return `<div class="party-bar"${label ? ` aria-label="${d} Democratic, ${r} Republican, ${other} other, ${none} without a count"` : ''}>
    <span class="bar-d" style="width:${part(d)}"></span>
    <span class="bar-r" style="width:${part(r)}"></span>
    <span class="bar-o" style="width:${part(other)}"></span>
    <span class="bar-n" style="width:${part(none)}"></span>
  </div>`;
}

function officeSummary(office) {
  const feed = officeFeed(office);
  const races = feed?.races || [];
  const leads = leadingCounts(races);
  const totals = officeTotals(races);
  const called = races.filter((race) => race.called || race.winnerParty).length;
  const calledCounts = { D: 0, R: 0, other: 0 };
  for (const race of races) {
    if (!race.winnerParty && !race.called) continue;
    const party = race.winnerParty || race.leaderParty;
    if (party === 'D') calledCounts.D += 1;
    else if (party === 'R') calledCounts.R += 1;
    else if (party) calledCounts.other += 1;
  }
  return { feed, races, leads, totals, called, calledCounts };
}

function summaryCard(office) {
  const meta = OFFICES[office];
  const summary = officeSummary(office);
  const racesInFeed = summary.races.length;
  const reporting = summary.totals.avgReporting;
  return `<a class="summary-card accent-${meta.accent}" href="#/${office === 'governor' ? 'governors' : office}">
    <div class="summary-top">
      <span class="eyebrow">${esc(meta.label)}</span>
      <span class="summary-icon">${icon(office === 'governor' ? 'compass' : office === 'house' ? 'barChart' : 'layers', 19)}</span>
    </div>
    <div class="summary-tally">
      <div><strong class="dem">${summary.leads.D}</strong><span>D leading</span></div>
      <div><strong class="rep">${summary.leads.R}</strong><span>R leading</span></div>
      <div><strong>${summary.totals.withVotes}</strong><span>with votes</span></div>
    </div>
    ${partyBar(summary.leads.D, summary.leads.R, summary.leads.other, summary.leads.none, true)}
    <div class="summary-foot">
      <span>${racesInFeed} of ${meta.totalSeats} tracked</span>
      <span>${reporting == null ? '—' : formatPct(reporting, 0)} avg reporting</span>
    </div>
  </a>`;
}

function renderBoot() {
  app.innerHTML = `<div class="boot">
    <div class="boot-mark"><span></span><span></span><span></span></div>
    <p>Connecting to official state election feeds…</p>
  </div>`;
}

function renderFatal() {
  app.innerHTML = `<div class="boot boot-error">
    <div class="error-glyph">${icon('activity', 34)}</div>
    <h1>Feeds are taking a moment.</h1>
    <p>The live results services did not answer. State election feeds can briefly rate-limit during heavy traffic.</p>
    <button class="button primary" data-action="retry">${icon('refresh', 17)} Try again</button>
    <a class="text-link" href="${DATA_SOURCE}" target="_blank" rel="noreferrer">View the data source ${icon('external', 14)}</a>
  </div>`;
}

function shell(content) {
  const watchCount = Object.keys(store.watch).length;
  const asOf = maxAsOf(store.feeds, 2026);
  const hasErrors = Object.keys(store.errors).length > 0;
  const status = store.refreshing ? 'Syncing' : hasErrors ? 'Partial feed' : 'Live';
  const statusClass = store.refreshing ? 'syncing' : hasErrors ? 'partial' : 'live';
  const nav = NAV.map((item) => `<a class="nav-link ${store.route === item.id ? 'active' : ''}" href="#/${item.id}">
    ${icon(item.icon, 16)}<span>${esc(item.label)}</span>
  </a>`).join('');
  const mobileNav = NAV.filter((item) => ['overview', 'senate', 'house', 'local', 'watchlist'].includes(item.id)).map((item) => `<a class="mobile-link ${store.route === item.id ? 'active' : ''}" href="#/${item.id}">
    ${icon(item.icon, 20)}<span>${esc(item.label === 'Local issues' ? 'Local' : item.label)}</span>
  </a>`).join('');

  app.innerHTML = `<div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#/overview" aria-label="Midterm Pulse home">
        <span class="brand-mark"><i></i><i></i><i></i></span>
        <span>Midterm<span>Pulse</span></span>
      </a>
      <div class="top-status">
        <span class="live-chip ${statusClass}"><span class="live-dot"></span>${status}</span>
        <span class="top-updated" data-updated>${asOf ? `Updated ${relativeTime(asOf)}` : 'Connecting…'}</span>
      </div>
      <div class="top-actions">
        <a class="icon-button watch-button" href="#/watchlist" aria-label="Watchlist">
          ${icon('bookmark', 19)}
          ${watchCount ? `<span class="watch-count">${watchCount}</span>` : ''}
        </a>
        <button class="icon-button" data-action="toggle-theme" aria-label="Switch to ${store.theme === 'dark' ? 'light' : 'dark'} appearance">
          ${icon(store.theme === 'dark' ? 'sun' : 'moon', 19)}
        </button>
        <button class="icon-button ${store.refreshing ? 'spinning' : ''}" data-action="refresh" aria-label="Refresh results">
          ${icon('refresh', 19)}
        </button>
      </div>
    </header>
    <nav class="main-nav" aria-label="Primary">${nav}</nav>
    ${hasErrors && !store.refreshing ? `<div class="feed-notice">${icon('info', 16)} Some offices did not answer this refresh. Showing the last successful count for those feeds.</div>` : ''}
    <main class="page">${content}</main>
    <footer class="site-footer">
      <div>
        <span class="footer-brand"><span class="brand-mark small"><i></i><i></i><i></i></span> Midterm Pulse</span>
        <p>Raw counts from official state election feeds. No projections, no modeled calls.</p>
      </div>
      <div class="footer-links">
        <a href="${DATA_SOURCE}" target="_blank" rel="noreferrer">OpenAmerica ${icon('external', 13)}</a>
        <a href="${PUSHBUILD_SOURCE}" target="_blank" rel="noreferrer">Pushbuild ${icon('external', 13)}</a>
        <a href="https://ballotpedia.org/Local_ballot_measure_elections_in_2026" target="_blank" rel="noreferrer">Ballotpedia local measures ${icon('external', 13)}</a>
      </div>
      <p class="footer-note">Local issue counts are unofficial until certified. Federal feeds refresh every 60 seconds; source coverage varies by state.</p>
    </footer>
    <nav class="mobile-nav" aria-label="Mobile navigation">${mobileNav}</nav>
    ${drawerTemplate()}
  </div>`;
  document.body.classList.toggle('drawer-open', Boolean(store.drawer));
  document.title = `${pageTitle()} · Midterm Pulse`;
  restoreFocus();
}

function pageTitle() {
  if (store.route === 'overview') return '2026 live midterm results';
  if (store.route === 'senate') return 'Live Senate results';
  if (store.route === 'house') return 'Live House results';
  if (store.route === 'governors') return 'Live governor results';
  if (store.route === 'local') return 'Local ballot issues';
  if (store.route === 'compare') return '2026 vs 2024';
  if (store.route === 'watchlist') return 'Watchlist';
  return '2026 live results';
}

function restoreFocus() {
  const focusId = store.focusId;
  if (!focusId) return;
  const element = document.getElementById(focusId);
  if (!element) return;
  const selection = store.focusSelection;
  element.focus({ preventScroll: true });
  if (selection != null && typeof element.setSelectionRange === 'function') {
    element.setSelectionRange(selection, selection);
  }
  store.focusId = null;
  store.focusSelection = null;
}

function render() {
  const active = document.activeElement;
  if (active?.id) {
    store.focusId = active.id;
    if (typeof active.selectionStart === 'number') store.focusSelection = active.selectionStart;
  }
  let content = '';
  if (store.route === 'overview') content = overviewPage();
  else if (ROUTE_OFFICE[store.route]) content = officePage(ROUTE_OFFICE[store.route]);
  else if (store.route === 'local') content = localPage();
  else if (store.route === 'compare') content = comparePage();
  else if (store.route === 'watchlist') content = watchlistPage();
  shell(content);
  updateLiveText();
}

function updateLiveText() {
  const asOf = maxAsOf(store.feeds, 2026);
  document.querySelectorAll('[data-updated]').forEach((element) => {
    element.textContent = asOf ? `Updated ${relativeTime(asOf)}` : 'Connecting…';
  });
  document.querySelectorAll('[data-desk-time]').forEach((element) => {
    element.textContent = asOf ? formatTimeET(asOf) : '—';
  });
  document.querySelectorAll('[data-countdown]').forEach((element) => {
    const seconds = Math.max(0, Math.ceil((store.nextRefreshAt - Date.now()) / 1000));
    element.textContent = store.refreshing ? 'syncing' : `${seconds}s`;
  });
}

function overviewPage() {
  const races = currentRaces();
  const leads = leadingCounts(races);
  const totalVotes = races.reduce((sum, race) => sum + race.total, 0);
  const feedStates = new Set(races.map((race) => race.state)).size;
  const local = localStats();
  const closest = closestRaces(races, { limit: 6 });
  const shifts = allComparable().slice(0, 5);
  const decidedLocal = LOCAL_ITEMS.filter((item) => item.result && item.totalVotes > 0).slice(0, 3);

  return `<section class="hero">
    <div class="hero-copy">
      <div class="eyebrow live-eyebrow"><span class="live-dot"></span> Election night · November 3, 2026</div>
      <h1>The country,<br><span>counted live.</span></h1>
      <p>Senate, House and governor races — plus local ballot issues down to cities and counties. Raw counts from multiple official state feeds, merged and refreshed as they land.</p>
      <div class="hero-actions">
        <a class="button primary" href="#/senate">${icon('layers', 17)} Explore the races</a>
        <a class="button quiet" href="#/compare">${icon('activity', 17)} Compare with 2024</a>
      </div>
      <p class="no-calls">${icon('info', 14)} No projections. No modeled calls. Just the count.</p>
    </div>
    <aside class="hero-aside">
      <div class="snapshot-head">
        <span class="live-chip live"><span class="live-dot"></span>Live desk</span>
        <span data-updated>${maxAsOf(store.feeds, 2026) ? `Updated ${relativeTime(maxAsOf(store.feeds, 2026))}` : 'Connecting…'}</span>
      </div>
      <div class="snapshot-tally">
        <div><strong class="dem">${leads.D}</strong><span>D leading</span></div>
        <div><strong class="rep">${leads.R}</strong><span>R leading</span></div>
        <div><strong>${leads.other + leads.none}</strong><span>other / waiting</span></div>
      </div>
      <div class="snapshot-rule"></div>
      <div class="snapshot-meta">
        <div><span>Votes counted</span><strong>${formatCompact(totalVotes)}</strong></div>
        <div><span>States reporting</span><strong>${feedStates}</strong></div>
        <div><span>Local issues</span><strong>${formatNumber(local.total)}</strong></div>
      </div>
      <div class="snapshot-foot">
        <span>${formatNumber(local.counties)} counties · ${formatNumber(local.cities)} cities</span>
        <span class="snapshot-refresh">Next refresh <b data-countdown>60s</b></span>
      </div>
    </aside>
  </section>

  <section class="summary-grid" aria-label="Race summary">
    ${OFFICE_ORDER.map(summaryCard).join('')}
    <a class="summary-card accent-teal" href="#/local">
      <div class="summary-top">
        <span class="eyebrow">Local ballot issues</span>
        <span class="summary-icon">${icon('map', 19)}</span>
      </div>
      <div class="summary-tally">
        <div><strong>${formatNumber(local.total)}</strong><span>measures</span></div>
        <div><strong>${local.states}</strong><span>states</span></div>
        <div><strong>${local.decided}</strong><span>decided</span></div>
      </div>
      <div class="party-bar local-bar"><span class="bar-yes" style="width:${local.total ? Math.min(100, (local.withVotes / local.total) * 100) : 0}%"></span><span class="bar-n" style="width:100%"></span></div>
      <div class="summary-foot"><span>${formatNumber(local.cities)} cities</span><span>${formatNumber(local.counties)} counties</span></div>
    </a>
  </section>

  ${store.sourceReport.length ? `<section class="coverage-strip" aria-label="Live sources">
    <span class="coverage-label">${icon('activity', 15)} Live source merge</span>
    <div class="coverage-sources">
      ${store.sourceReport.map((source) => `<a href="${esc(source.url || '#')}" target="_blank" rel="noreferrer"><strong>${esc(source.label)}</strong><span>${formatNumber(source.races)} race record${source.races === 1 ? '' : 's'} · ${source.states} state${source.states === 1 ? '' : 's'}</span></a>`).join('')}
    </div>
    <span class="coverage-note">Each race uses its most complete live count</span>
  </section>` : ''}

  <div class="dashboard-grid">
    <section class="card map-card">
      <div class="card-head">
        <div>
          <span class="eyebrow">The map</span>
          <h2>Where the night stands</h2>
        </div>
        <div class="segmented" role="group" aria-label="Map office">
          ${mapTabs(true)}
        </div>
      </div>
      ${usMap(store.mapOffice, true)}
      <div class="map-legend">
        <span><i class="legend-swatch d"></i>D leading</span>
        <span><i class="legend-swatch r"></i>R leading</span>
        <span><i class="legend-swatch split"></i>Split</span>
        <span><i class="legend-swatch none"></i>No count yet</span>
      </div>
    </section>

    <section class="card live-desk">
      <div class="card-head">
        <div>
          <span class="eyebrow">Live desk</span>
          <h2>Latest from the counts</h2>
        </div>
        <span class="desk-clock" data-desk-time>${formatTimeET(maxAsOf(store.feeds, 2026))}</span>
      </div>
      <div class="event-list">
        ${store.events.length ? store.events.slice(0, 8).map(eventItem).join('') : '<div class="empty-inline">Waiting for the first state update…</div>'}
      </div>
      <div class="desk-footer">
        <span>${icon('clock', 15)} Auto-refreshing every 60 seconds</span>
        <span data-countdown>60s</span>
      </div>
    </section>
  </div>

  <div class="split-grid">
    <section class="card">
      <div class="card-head">
        <div>
          <span class="eyebrow">Margins</span>
          <h2>Closest races</h2>
        </div>
        <span class="card-note">At least 5% reporting</span>
      </div>
      <div class="mini-race-list">
        ${closest.length ? closest.map(miniRaceRow).join('') : '<div class="empty-inline">Closest races will appear as county and precinct counts arrive.</div>'}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div>
          <span class="eyebrow">Since 2024</span>
          <h2>Biggest shifts</h2>
        </div>
        <a class="text-link" href="#/compare">Full comparison ${icon('chevronRight', 14)}</a>
      </div>
      <div class="shift-list">
        ${!store.priorReady ? '<div class="empty-inline">Loading the 2024 certified baseline…</div>' : shifts.length ? shifts.map(shiftMiniRow).join('') : '<div class="empty-inline">Comparisons unlock as both years report votes.</div>'}
      </div>
    </section>
  </div>

  <section class="local-feature card">
    <div class="local-feature-copy">
      <span class="eyebrow">Down the ballot</span>
      <h2>Local issues, city by city.</h2>
      <p>${formatNumber(local.total)} local measures across ${local.states} states, ${formatNumber(local.counties)} counties and ${formatNumber(local.cities)} cities. School bonds, housing, taxes, data centers and more.</p>
      <div class="coverage-chips">
        <span>${formatNumber(LOCAL_ITEMS.filter((item) => item.level === 'city').length)} city measures</span>
        <span>${formatNumber(LOCAL_ITEMS.filter((item) => item.level === 'county').length)} county measures</span>
        <span>${formatNumber(LOCAL_ITEMS.filter((item) => item.level === 'school').length)} school measures</span>
      </div>
      <a class="button quiet" href="#/local">${icon('map', 17)} Browse local issues</a>
    </div>
    <div class="local-feature-results">
      <div class="feature-result-head"><span>Recent local outcomes</span><span>${local.approved} approved · ${local.rejected} rejected</span></div>
      ${decidedLocal.length ? decidedLocal.map(localMiniRow).join('') : '<div class="empty-inline">Local results will land here as they are published.</div>'}
      <div class="feature-result-foot">Local counts from Ballotpedia · unofficial until certified</div>
    </div>
  </section>`;
}

function mapTabs() {
  return ['all', ...OFFICE_ORDER].map((office) => `<button class="segment ${store.mapOffice === office ? 'active' : ''}" data-action="set-map-office" data-office="${office}">${office === 'all' ? 'All' : esc(OFFICES[office].label)}</button>`).join('');
}

function usMap(office, interactive = false) {
  const races = office === 'all' ? currentRaces() : officeFeed(office)?.races || [];
  const mapLabel = office === 'all' ? 'All races' : OFFICES[office].label;
  const statesWithRaces = new Set(races.map((race) => race.state));
  const paths = Object.entries(statePaths).map(([state, geometry]) => {
    const status = getStateStatus(races, state);
    let tone = 'none';
    if (!statesWithRaces.has(state)) tone = 'no-feed';
    else if (status.leader === 'D') tone = 'd';
    else if (status.leader === 'R') tone = 'r';
    else if (status.leader === 'split') tone = 'split';
    else if (status.leader === 'other') tone = 'other';
    const name = STATE_NAMES[state] || state;
    const title = statesWithRaces.has(state)
      ? `${name}: ${status.counts.D} D, ${status.counts.R} R, ${status.counts.other} other leading`
      : `${name}: no race in the available feeds`;
    const click = interactive ? ` data-action="open-state" data-state="${state}" role="button" tabindex="0"` : '';
    return `<path class="state-path ${tone}" d="${geometry.d}"${click} aria-label="${esc(title)}"><title>${esc(title)}</title></path>`;
  }).join('');
  const labels = Object.entries(statePaths).map(([state, geometry]) => {
    const status = getStateStatus(races, state);
    const tone = statesWithRaces.has(state) ? (status.leader === 'D' ? 'd' : status.leader === 'R' ? 'r' : 'n') : 'n';
    return `<text class="map-label ${tone}" x="${geometry.cx}" y="${geometry.cy}">${state}</text>`;
  }).join('');
  return `<div class="map-wrap">
    <svg class="us-map" viewBox="0 0 976 610" role="img" aria-label="${esc(mapLabel)} results map">
      <defs>
        <pattern id="split-pattern" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3.5" height="7" fill="#2f6fed"></rect>
          <rect x="3.5" width="3.5" height="7" fill="#e5484d"></rect>
        </pattern>
      </defs>
      <g>${paths}</g>
      <g class="map-labels" aria-hidden="true">${labels}</g>
    </svg>
    <div class="map-caption"><span>${races.length} races tracked</span><span>${statesWithRaces.size} states reporting</span></div>
  </div>`;
}

function eventItem(event) {
  const time = event.time ? formatTimeET(event.time) : '';
  const clickable = event.office && event.key;
  return `<button class="event-item ${clickable ? 'clickable' : ''}" ${clickable ? `data-action="open-race" data-office="${event.office}" data-key="${esc(event.key)}"` : 'disabled'}>
    <span class="event-icon ${esc(event.type || 'info')}">${icon(event.icon || 'activity', 16)}</span>
    <span class="event-copy"><strong>${esc(event.title)}</strong><span>${esc(event.detail)}</span></span>
    <time>${esc(time)}</time>
  </button>`;
}

function miniRaceRow(race) {
  const compared = compareRace(race, findPriorRace(race, priorFeed(race.office)));
  return `<button class="mini-race" data-action="open-race" data-office="${race.office}" data-key="${esc(race.key)}">
    <span class="mini-race-main"><span class="office-kicker">${esc(OFFICES[race.office].lower)}</span><strong>${esc(race.label)}</strong><span class="mini-lead">${leaderLine(race)}</span></span>
    <span class="mini-race-side">
      <strong class="${race.leaderParty === 'D' ? 'dem' : race.leaderParty === 'R' ? 'rep' : ''}">${formatMargin(race)}</strong>
      <span>${formatPct(race.reporting, 0)} in${compared ? ` · ${formatPoints(compared.swing)} since ’24` : ''}</span>
    </span>
  </button>`;
}

function shiftMiniRow({ race, compared }) {
  const tone = compared.swing >= 0 ? 'dem' : 'rep';
  return `<button class="mini-race" data-action="open-race" data-office="${race.office}" data-key="${esc(race.key)}">
    <span class="mini-race-main"><span class="office-kicker">${esc(OFFICES[race.office].lower)}</span><strong>${esc(race.label)}</strong><span class="mini-lead">${leaderLine(race)}</span></span>
    <span class="mini-race-side"><strong class="${tone}">${formatSignedPct(compared.swing)}</strong><span>${formatPoints(compared.before)} → ${formatPoints(compared.current)}</span></span>
  </button>`;
}

function localMiniRow(item) {
  const status = yesNoClass(item);
  return `<button class="feature-result" data-action="open-local" data-id="${item.id}">
    <span class="feature-result-main"><strong>${esc(item.measure || item.title.split(',')[0])}</strong><span>${esc(item.jurisdiction)} · ${esc(item.stateName || item.state)}</span></span>
    <span class="status-pill ${status}">${esc(localStatus(item))}</span>
    <span class="feature-result-pct">${formatPct(item.yesPct, 0)} yes</span>
  </button>`;
}

function officePage(office) {
  const meta = OFFICES[office];
  const feed = officeFeed(office);
  const races = feed?.races || [];
  const summary = officeSummary(office);
  const filtered = filterRaces(races);
  const visible = filtered.slice(0, store.office.limit);
  const prior = priorFeed(office);

  return `<section class="page-head office-head">
    <div>
      <div class="eyebrow">${esc(meta.scope)} · 2026</div>
      <h1>${office === 'governor' ? 'Governors' : meta.label}</h1>
      <p>${office === 'senate' ? 'Thirty-three Class II seats are on the ballot. Every count below comes straight from a state election office.' : office === 'house' ? 'All 435 seats are on the ballot. Use the filters to cut through the chamber.' : 'Thirty-six governorships are up in 2026, with control of statehouses and 2028 maps in the balance.'}</p>
    </div>
    <div class="head-stats">
      <div><strong class="dem">${summary.leads.D}</strong><span>D leading</span></div>
      <div><strong class="rep">${summary.leads.R}</strong><span>R leading</span></div>
      <div><strong>${summary.totals.withVotes}</strong><span>with votes</span></div>
      <div><strong>${formatCompact(summary.totals.totalVotes)}</strong><span>votes counted</span></div>
    </div>
  </section>

  <section class="card office-map-card">
    <div class="card-head compact">
      <div><span class="eyebrow">Map</span><h2>${esc(meta.label)} by state</h2></div>
      <span class="card-note">${races.length} races tracked${prior ? ` · 2024 baseline loaded` : ''}</span>
    </div>
    ${usMap(office, true)}
  </section>

  <section class="card race-table-card">
    <div class="filter-bar">
      <label class="search-field" for="office-search">${icon('search', 17)}<input id="office-search" type="search" autocomplete="off" placeholder="Search state, district or candidate" value="${esc(store.office.query)}"></label>
      <select id="office-party" aria-label="Filter by leader">
        <option value="all"${store.office.party === 'all' ? ' selected' : ''}>All leaders</option>
        <option value="D"${store.office.party === 'D' ? ' selected' : ''}>Democrat leading</option>
        <option value="R"${store.office.party === 'R' ? ' selected' : ''}>Republican leading</option>
        <option value="O"${store.office.party === 'O' ? ' selected' : ''}>Other / waiting</option>
      </select>
      <select id="office-status" aria-label="Filter by race status">
        <option value="all"${store.office.status === 'all' ? ' selected' : ''}>All races</option>
        <option value="close"${store.office.status === 'close' ? ' selected' : ''}>Within 5 pts</option>
        <option value="counted"${store.office.status === 'counted' ? ' selected' : ''}>Has votes</option>
        <option value="waiting"${store.office.status === 'waiting' ? ' selected' : ''}>Awaiting votes</option>
        <option value="watched"${store.office.status === 'watched' ? ' selected' : ''}>Watchlist</option>
      </select>
      <select id="office-sort" aria-label="Sort races">
        <option value="closest"${store.office.sort === 'closest' ? ' selected' : ''}>Closest margin</option>
        <option value="reporting"${store.office.sort === 'reporting' ? ' selected' : ''}>Most reporting</option>
        <option value="votes"${store.office.sort === 'votes' ? ' selected' : ''}>Most votes</option>
        <option value="swing"${store.office.sort === 'swing' ? ' selected' : ''}>Biggest 2024 shift</option>
        <option value="state"${store.office.sort === 'state' ? ' selected' : ''}>State</option>
      </select>
    </div>
    <div class="list-meta"><span>${formatNumber(filtered.length)} ${filtered.length === 1 ? meta.raceNoun : meta.raceNounPlural}</span><span>${prior ? '2024 certified baseline' : 'Loading 2024 baseline…'}</span></div>
    <div class="race-list">
      <div class="race-list-head"><span>Race</span><span>Leader</span><span>Reporting</span><span>2024</span><span>Votes</span><span></span></div>
      ${visible.length ? visible.map((race) => raceRow(race, prior)).join('') : emptyState('No races match those filters.', 'Try clearing the search or switching the leader filter.')}
    </div>
    ${filtered.length > visible.length ? `<button class="load-more" data-action="load-more-office">Show ${Math.min(96, filtered.length - visible.length)} more ${meta.raceNounPlural}</button>` : ''}
  </section>`;
}

function filterRaces(races) {
  const query = store.office.query.trim().toLowerCase();
  let filtered = races.filter((race) => {
    if (query) {
      const haystack = `${race.label} ${race.mediumLabel} ${race.state} ${STATE_NAMES[race.state] || ''} ${race.candidates.map((candidate) => candidate.name).join(' ')}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (store.office.party === 'D' && race.leaderParty !== 'D') return false;
    if (store.office.party === 'R' && race.leaderParty !== 'R') return false;
    if (store.office.party === 'O' && (race.leaderParty === 'D' || race.leaderParty === 'R')) return false;
    if (store.office.status === 'close' && !(race.margin != null && race.margin <= 5)) return false;
    if (store.office.status === 'counted' && !race.hasVotes) return false;
    if (store.office.status === 'waiting' && race.hasVotes) return false;
    if (store.office.status === 'watched' && !store.watch[raceKey(race)]) return false;
    return true;
  });
  filtered = sortRaces(filtered, store.office.sort, { [races[0]?.office || 'senate']: priorFeed(races[0]?.office || 'senate') });
  return filtered;
}

function raceRow(race, prior) {
  const compared = compareRace(race, findPriorRace(race, prior));
  const watched = Boolean(store.watch[raceKey(race)]);
  const party = partyMeta(race.leaderParty);
  const marginTone = race.leaderParty === 'D' ? 'dem' : race.leaderParty === 'R' ? 'rep' : '';
  return `<div class="race-row" data-action="open-race" data-office="${race.office}" data-key="${esc(race.key)}" role="button" tabindex="0" aria-label="Open ${esc(race.label)}">
    <div class="race-cell race-name-cell">
      <span class="race-topline"><span class="office-kicker">${esc(race.shortLabel)}</span>${race.uncontested ? '<span class="tiny-pill">Uncontested</span>' : ''}</span>
      <strong>${esc(race.label)}</strong>
      <span class="race-sub">${race.hasVotes ? `${race.candidates.length} candidates · ${formatNumber(race.total)} votes` : 'Awaiting first count'}</span>
    </div>
    <div class="race-cell leader-cell">
      ${race.leaderParty ? `<span class="leader-pill" style="--party:${party.color};--party-soft:${party.soft}">${esc(race.leaderParty)}</span><span class="leader-detail"><strong>${esc(race.top?.name || party.name)}</strong><span>${formatMargin(race)}</span></span>` : '<span class="leader-detail"><strong>Not reporting</strong><span>—</span></span>'}
    </div>
    <div class="race-cell reporting-cell">
      <div class="reporting-line"><span>${formatPct(race.reporting, 0)}</span><span>${race.reporting == null ? 'no estimate' : 'estimated'}</span></div>
      <div class="reporting-track"><span style="width:${Math.max(0, Math.min(100, race.reporting || 0))}%"></span></div>
    </div>
    <div class="race-cell prior-cell">
      ${prior && compared ? `<strong class="${compared.before >= 0 ? 'dem' : 'rep'}">${marginLabel(compared.before)}</strong><span class="swing-chip ${compared.swing >= 0 ? 'dem' : 'rep'}">${formatPoints(compared.swing)}</span>` : '<span class="muted">—</span>'}
    </div>
    <div class="race-cell votes-cell"><strong>${formatCompact(race.total)}</strong><span>${race.hasVotes ? 'counted' : 'awaiting'}</span></div>
    <div class="race-cell action-cell"><button class="star-button ${watched ? 'active' : ''}" data-action="toggle-watch-race" data-office="${race.office}" data-key="${esc(race.key)}" aria-label="${watched ? 'Remove from' : 'Add to'} watchlist">${icon(watched ? 'bookmarkFilled' : 'bookmark', 17)}</button></div>
  </div>`;
}

function localPage() {
  const stats = localStats();
  const filtered = filterLocal();
  const visible = filtered.slice(0, store.local.limit);
  const stateLabel = store.local.state === 'all' ? 'all states' : STATE_NAMES[store.local.state] || store.local.state;
  return `<section class="page-head local-head">
    <div>
      <div class="eyebrow">Down the ballot · 2026</div>
      <h1>Local ballot issues</h1>
      <p>City halls, county commissions and school boards are deciding bonds, taxes, housing rules and data-center limits. Follow the counts from ${formatNumber(stats.total)} measures across ${formatNumber(stats.cities)} cities and ${formatNumber(stats.counties)} counties.</p>
    </div>
    <div class="local-stat-grid">
      <div><strong>${formatNumber(stats.total)}</strong><span>measures</span></div>
      <div><strong>${formatNumber(stats.cities)}</strong><span>cities</span></div>
      <div><strong>${formatNumber(stats.counties)}</strong><span>counties</span></div>
      <div><strong>${stats.decided}</strong><span>decided</span></div>
    </div>
  </section>

  <div class="coverage-strip">
    <span>${icon('map', 15)} ${formatNumber(stats.total)} measures · ${stats.states} states · ${formatNumber(stats.counties)} counties · ${formatNumber(stats.cities)} cities</span>
    <span>${stats.withVotes} reporting counts · ${stats.approved} approved · ${stats.rejected} rejected</span>
  </div>

  <section class="card local-table-card">
    <div class="filter-bar local-filters">
      <label class="search-field" for="local-search">${icon('search', 17)}<input id="local-search" type="search" autocomplete="off" placeholder="Search city, county or measure" value="${esc(store.local.query)}"></label>
      <select id="local-state" aria-label="Filter by state">
        <option value="all"${store.local.state === 'all' ? ' selected' : ''}>All states</option>
        ${LOCAL_STATES.map((state) => `<option value="${state}"${store.local.state === state ? ' selected' : ''}>${esc(STATE_NAMES[state] || state)}</option>`).join('')}
      </select>
      <select id="local-level" aria-label="Filter by jurisdiction">
        <option value="all"${store.local.level === 'all' ? ' selected' : ''}>All jurisdictions</option>
        <option value="city"${store.local.level === 'city' ? ' selected' : ''}>Cities</option>
        <option value="county"${store.local.level === 'county' ? ' selected' : ''}>Counties</option>
        <option value="school"${store.local.level === 'school' ? ' selected' : ''}>School districts</option>
        <option value="district"${store.local.level === 'district' ? ' selected' : ''}>Districts</option>
        <option value="township"${store.local.level === 'township' ? ' selected' : ''}>Townships</option>
      </select>
      <select id="local-subject" aria-label="Filter by subject">
        <option value="all"${store.local.subject === 'all' ? ' selected' : ''}>All subjects</option>
        ${LOCAL_SUBJECTS.map((subject) => `<option value="${esc(subject)}"${store.local.subject === subject ? ' selected' : ''}>${esc(subject)}</option>`).join('')}
      </select>
      <select id="local-result" aria-label="Filter by result">
        <option value="all"${store.local.result === 'all' ? ' selected' : ''}>All measures</option>
        <option value="counted"${store.local.result === 'counted' ? ' selected' : ''}>Has a count</option>
        <option value="decided"${store.local.result === 'decided' ? ' selected' : ''}>Decided</option>
        <option value="waiting"${store.local.result === 'waiting' ? ' selected' : ''}>Awaiting count</option>
      </select>
      <select id="local-sort" aria-label="Sort local measures">
        <option value="state"${store.local.sort === 'state' ? ' selected' : ''}>State</option>
        <option value="votes"${store.local.sort === 'votes' ? ' selected' : ''}>Most votes</option>
        <option value="closest"${store.local.sort === 'closest' ? ' selected' : ''}>Closest result</option>
        <option value="jurisdiction"${store.local.sort === 'jurisdiction' ? ' selected' : ''}>Jurisdiction</option>
      </select>
    </div>
    <div class="list-meta"><span>${formatNumber(filtered.length)} measures · ${esc(stateLabel)}</span><span>Ballotpedia local results · unofficial</span></div>
    <div class="local-list">
      ${visible.length ? visible.map(localRow).join('') : emptyState('No local measures match those filters.', 'Try another state, jurisdiction or search term.')}
    </div>
    ${filtered.length > visible.length ? `<button class="load-more" data-action="load-more-local">Show more measures · ${formatNumber(filtered.length - visible.length)} remaining</button>` : ''}
  </section>

  <p class="source-note">${icon('info', 15)} Local measure index and vote counts come from Ballotpedia’s 2026 local ballot measure coverage. Counts are unofficial until certified by the relevant county or city canvass.</p>`;
}

function filterLocal() {
  const query = store.local.query.trim().toLowerCase();
  let items = LOCAL_ITEMS.filter((item) => {
    if (store.local.state !== 'all' && item.state !== store.local.state) return false;
    if (store.local.level !== 'all' && item.level !== store.local.level) return false;
    if (store.local.subject !== 'all' && item.subject !== store.local.subject) return false;
    if (store.local.result === 'counted' && item.totalVotes === 0) return false;
    if (store.local.result === 'decided' && !item.result) return false;
    if (store.local.result === 'waiting' && item.totalVotes > 0) return false;
    if (query) {
      const haystack = `${item.title} ${item.measure} ${item.jurisdiction} ${item.county || ''} ${item.city || ''} ${item.subject} ${item.description}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  items = [...items];
  if (store.local.sort === 'votes') items.sort((a, b) => b.totalVotes - a.totalVotes || a.state.localeCompare(b.state));
  else if (store.local.sort === 'closest') {
    items.sort((a, b) => {
      const aMargin = a.totalVotes ? Math.abs((a.yesPct ?? 50) - 50) : 999;
      const bMargin = b.totalVotes ? Math.abs((b.yesPct ?? 50) - 50) : 999;
      return aMargin - bMargin;
    });
  } else if (store.local.sort === 'jurisdiction') items.sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || a.title.localeCompare(b.title));
  else items.sort((a, b) => a.state.localeCompare(b.state) || a.jurisdiction.localeCompare(b.jurisdiction) || a.title.localeCompare(b.title));
  return items;
}

function localRow(item) {
  const watched = Boolean(store.watch[localKey(item)]);
  const status = yesNoClass(item);
  const hasVotes = item.totalVotes > 0;
  const yesPct = hasVotes ? item.yesPct ?? ((item.yesVotes / item.totalVotes) * 100) : 0;
  const noPct = hasVotes ? item.noPct ?? ((item.noVotes / item.totalVotes) * 100) : 0;
  return `<div class="local-row" data-action="open-local" data-id="${item.id}" role="button" tabindex="0" aria-label="Open ${esc(item.title)}">
    <div class="local-main">
      <div class="local-topline"><span class="level-pill ${item.level}">${esc(LEVEL_LABELS[item.level] || item.level)}</span><span class="local-place">${esc(item.jurisdiction)} · ${esc(item.stateName || item.state)}${item.county && item.county !== item.jurisdiction ? ` · ${esc(item.county)}` : ''}</span></div>
      <strong class="local-title">${esc(item.title)}</strong>
      <span class="local-subject">${esc(item.subject || item.type || 'Local measure')}${item.type ? ` · ${esc(item.type)}` : ''}</span>
    </div>
    <div class="local-result">
      <span class="status-pill ${status}">${esc(localStatus(item))}</span>
      <div class="yesno-bar"><span class="yes" style="width:${yesPct}%"></span><span class="no" style="width:${noPct}%"></span></div>
      <div class="yesno-numbers"><span class="yes">${hasVotes ? formatPct(yesPct, 1) : '—'} yes</span><span class="no">${hasVotes ? formatPct(noPct, 1) : '—'} no</span></div>
    </div>
    <div class="local-votes"><strong>${hasVotes ? formatCompact(item.totalVotes) : '—'}</strong><span>${hasVotes ? 'votes' : 'awaiting count'}</span></div>
    <div class="local-action"><button class="star-button ${watched ? 'active' : ''}" data-action="toggle-watch-local" data-id="${item.id}" aria-label="${watched ? 'Remove from' : 'Add to'} watchlist">${icon(watched ? 'bookmarkFilled' : 'bookmark', 17)}</button></div>
  </div>`;
}

function allComparable() {
  const output = [];
  for (const office of OFFICE_ORDER) {
    const prior = priorFeed(office);
    if (!prior) continue;
    for (const race of officeFeed(office)?.races || []) {
      const compared = compareRace(race, findPriorRace(race, prior));
      if (compared) output.push({ race, prior: findPriorRace(race, prior), compared });
    }
  }
  return output.sort((a, b) => Math.abs(b.compared.swing) - Math.abs(a.compared.swing));
}

function comparablesFor(office) {
  const prior = priorFeed(office);
  if (!prior) return [];
  return (officeFeed(office)?.races || [])
    .map((race) => {
      const previous = findPriorRace(race, prior);
      const compared = compareRace(race, previous);
      return compared ? { race, previous, compared } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.compared.swing) - Math.abs(a.compared.swing));
}

function comparePage() {
  const office = store.compareOffice;
  const meta = OFFICES[office];
  const comparisons = comparablesFor(office);
  const average = comparisons.length
    ? comparisons.reduce((sum, item) => sum + item.compared.swing, 0) / comparisons.length
    : null;
  const biggestD = comparisons.filter((item) => item.compared.swing > 0)[0];
  const biggestR = [...comparisons].reverse().find((item) => item.compared.swing < 0);
  return `<section class="page-head compare-head">
    <div>
      <div class="eyebrow">The two-year swing · 2024 certified vs 2026 live</div>
      <h1>What changed since 2024?</h1>
      <p>Each race is plotted by its two-party margin. The vertical distance from the diagonal is the swing — positive toward Democrats, negative toward Republicans.</p>
    </div>
    <div class="compare-tabs">
      ${OFFICE_ORDER.map((item) => `<button class="compare-tab ${office === item ? 'active' : ''}" data-action="set-compare-office" data-office="${item}">${esc(OFFICES[item].label)}</button>`).join('')}
    </div>
  </section>

  <section class="compare-stats">
    <div class="card stat-card"><span class="eyebrow">Comparable races</span><strong>${comparisons.length}</strong><span>${esc(meta.label)} with votes in both years</span></div>
    <div class="card stat-card"><span class="eyebrow">Average swing</span><strong class="${average == null ? '' : average >= 0 ? 'dem' : 'rep'}">${formatSignedPct(average)}</strong><span>two-party margin change</span></div>
    <div class="card stat-card"><span class="eyebrow">Largest D shift</span><strong class="dem">${biggestD ? formatSignedPct(biggestD.compared.swing) : '—'}</strong><span>${biggestD ? esc(biggestD.race.label) : 'waiting for counts'}</span></div>
    <div class="card stat-card"><span class="eyebrow">Largest R shift</span><strong class="rep">${biggestR ? formatSignedPct(biggestR.compared.swing) : '—'}</strong><span>${biggestR ? esc(biggestR.race.label) : 'waiting for counts'}</span></div>
  </section>

  <section class="card scatter-card">
    <div class="card-head">
      <div><span class="eyebrow">Swing map</span><h2>${esc(meta.label)}: 2024 → 2026</h2></div>
      <div class="scatter-legend"><span><i class="legend-dot d"></i>D leading</span><span><i class="legend-dot r"></i>R leading</span><span><i class="legend-dot o"></i>Other</span></div>
    </div>
    ${!store.priorReady ? '<div class="chart-loading"><span></span><p>Loading 2024 certified results…</p></div>' : comparisons.length ? scatterChart(comparisons) : emptyState('No comparable races yet.', 'The chart fills in as 2026 votes are reported.')}
    <p class="chart-note">${icon('info', 14)} House comparisons carry a redistricting caveat in ${esc([...new Set(comparisons.filter((item) => item.compared.redistricted).map((item) => item.race.state))].join(', ') || 'several states')}. A redrawn district is not the same electorate as 2024.</p>
  </section>

  <section class="card shifts-card">
    <div class="card-head"><div><span class="eyebrow">Ranked</span><h2>Biggest ${esc(meta.label.toLowerCase())} shifts</h2></div><span class="card-note">Minimum 1,000 votes</span></div>
    <div class="shift-table">
      ${comparisons.slice(0, 14).map(shiftRow).join('') || emptyState('Waiting for comparable results.', 'Counts are still arriving.')}
    </div>
  </section>`;
}

function scatterChart(comparisons) {
  const width = 760;
  const height = 470;
  const pad = { top: 24, right: 26, bottom: 46, left: 52 };
  const values = comparisons.flatMap((item) => [item.compared.before, item.compared.current]);
  const maxAbs = Math.max(20, Math.ceil(Math.max(...values.map((value) => Math.abs(value))) / 10) * 10);
  const scaleX = (value) => pad.left + ((value + maxAbs) / (maxAbs * 2)) * (width - pad.left - pad.right);
  const scaleY = (value) => height - pad.bottom - ((value + maxAbs) / (maxAbs * 2)) * (height - pad.top - pad.bottom);
  const ticks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];
  const grid = ticks.map((tick) => `<g class="${tick === 0 ? 'axis-main' : 'axis-grid'}">
      <line x1="${scaleX(tick)}" x2="${scaleX(tick)}" y1="${pad.top}" y2="${height - pad.bottom}"></line>
      <line x1="${pad.left}" x2="${width - pad.right}" y1="${scaleY(tick)}" y2="${scaleY(tick)}"></line>
      <text x="${scaleX(tick)}" y="${height - pad.bottom + 19}" text-anchor="middle">${tick > 0 ? '+' : ''}${tick}</text>
      <text x="${pad.left - 10}" y="${scaleY(tick) + 4}" text-anchor="end">${tick > 0 ? '+' : ''}${tick}</text>
    </g>`).join('');
  const points = comparisons.map(({ race, compared }) => {
    const x = scaleX(compared.before);
    const y = scaleY(compared.current);
    const radius = Math.max(2.7, Math.min(6, Math.sqrt(race.total) / 130));
    const color = race.leaderParty === 'D' ? 'var(--dem)' : race.leaderParty === 'R' ? 'var(--rep)' : 'var(--other)';
    return `<circle class="scatter-point" cx="${x}" cy="${y}" r="${radius}" fill="${color}" data-action="open-race" data-office="${race.office}" data-key="${esc(race.key)}" role="button" tabindex="0"><title>${esc(race.label)}: 2024 ${formatPoints(compared.before)}, 2026 ${formatPoints(compared.current)}, swing ${formatSignedPct(compared.swing)}</title></circle>`;
  }).join('');
  return `<div class="scatter-wrap">
    <svg class="scatter" viewBox="0 0 ${width} ${height}" role="img" aria-label="2024 versus 2026 two-party margin scatter plot">
      <g class="grid">${grid}</g>
      <line class="diagonal" x1="${scaleX(-maxAbs)}" y1="${scaleY(-maxAbs)}" x2="${scaleX(maxAbs)}" y2="${scaleY(maxAbs)}"></line>
      <g>${points}</g>
      <text class="axis-title" x="${(pad.left + width - pad.right) / 2}" y="${height - 7}" text-anchor="middle">2024 two-party margin</text>
      <text class="axis-title" transform="translate(13 ${(pad.top + height - pad.bottom) / 2}) rotate(-90)" text-anchor="middle">2026 two-party margin</text>
    </svg>
    <div class="scatter-quadrants" aria-hidden="true"><span>R+ in ’24 → D+ now</span><span>D+ in ’24 → R+ now</span></div>
  </div>`;
}

function shiftRow({ race, compared }) {
  const tone = compared.swing >= 0 ? 'dem' : 'rep';
  return `<button class="shift-row" data-action="open-race" data-office="${race.office}" data-key="${esc(race.key)}">
    <span class="shift-race"><span class="office-kicker">${esc(race.shortLabel)}</span><strong>${esc(race.label)}</strong></span>
    <span class="shift-before"><span>2024</span><strong>${formatPoints(compared.before)}</strong></span>
    <span class="shift-current"><span>2026</span><strong>${formatPoints(compared.current)}</strong></span>
    <span class="shift-swing ${tone}"><span>Swing</span><strong>${formatSignedPct(compared.swing)}</strong></span>
    <span class="shift-reporting">${formatPct(race.reporting, 0)} in</span>
  </button>`;
}

function watchlistPage() {
  const entries = Object.entries(store.watch).sort((a, b) => (b[1].added || 0) - (a[1].added || 0));
  const raceEntries = entries.filter(([, meta]) => meta.type === 'race');
  const localEntries = entries.filter(([, meta]) => meta.type === 'local');
  return `<section class="page-head watch-head">
    <div><div class="eyebrow">Your desk</div><h1>Watchlist</h1><p>Keep the races and local measures you care about in one place. Saved in this browser.</p></div>
    ${entries.length ? `<button class="button quiet" data-action="clear-watchlist">${icon('close', 16)} Clear watchlist</button>` : ''}
  </section>
  ${entries.length ? `
    <section class="watch-section">
      <div class="section-label"><span>Races</span><span>${raceEntries.length}</span></div>
      <div class="watch-grid">${raceEntries.length ? raceEntries.map(watchRaceCard).join('') : '<div class="empty-inline">No races saved yet.</div>'}</div>
    </section>
    <section class="watch-section">
      <div class="section-label"><span>Local ballot issues</span><span>${localEntries.length}</span></div>
      <div class="watch-grid">${localEntries.length ? localEntries.map(watchLocalCard).join('') : '<div class="empty-inline">No local measures saved yet.</div>'}</div>
    </section>` : emptyState('Your watchlist is empty.', 'Tap the bookmark beside any race or local measure to pin it here.', 'bookmark')}`;
}

function watchRaceCard([key, meta]) {
  const race = findCurrentRace(meta.office, meta.key);
  if (!race) {
    return `<div class="watch-card"><span class="office-kicker">${esc(OFFICES[meta.office]?.label || meta.office)}</span><strong>${esc(meta.label)}</strong><p class="muted">This race is not in the current feed.</p><button class="text-link" data-action="remove-watch" data-watch-key="${esc(key)}">Remove</button></div>`;
  }
  const compared = compareRace(race, findPriorRace(race, priorFeed(race.office)));
  return `<div class="watch-card watch-race-card" data-action="open-race" data-office="${race.office}" data-key="${esc(race.key)}" role="button" tabindex="0">
    <div class="watch-card-head"><span class="office-kicker">${esc(OFFICES[race.office].lower)} · ${esc(race.shortLabel)}</span><button class="star-button active" data-action="remove-watch" data-watch-key="${esc(key)}" aria-label="Remove from watchlist">${icon('bookmarkFilled', 17)}</button></div>
    <strong class="watch-title">${esc(race.label)}</strong>
    <div class="watch-leader">${leaderLine(race)}</div>
    <div class="watch-numbers"><span><b>${formatMargin(race)}</b> margin</span><span><b>${formatPct(race.reporting, 0)}</b> in</span>${compared ? `<span><b class="${compared.swing >= 0 ? 'dem' : 'rep'}">${formatSignedPct(compared.swing)}</b> swing</span>` : ''}</div>
    <div class="reporting-track"><span style="width:${Math.max(0, Math.min(100, race.reporting || 0))}%"></span></div>
  </div>`;
}

function watchLocalCard([key, meta]) {
  const item = LOCAL_ITEMS.find((entry) => entry.id === meta.id);
  if (!item) {
    return `<div class="watch-card"><strong>${esc(meta.label)}</strong><p class="muted">This measure is no longer in the local index.</p><button class="text-link" data-action="remove-watch" data-watch-key="${esc(key)}">Remove</button></div>`;
  }
  const status = yesNoClass(item);
  const voted = item.totalVotes > 0;
  return `<div class="watch-card watch-local-card" data-action="open-local" data-id="${item.id}" role="button" tabindex="0">
    <div class="watch-card-head"><span class="office-kicker">${esc(LEVEL_LABELS[item.level] || item.level)} · ${esc(item.state)}</span><button class="star-button active" data-action="remove-watch" data-watch-key="${esc(key)}" aria-label="Remove from watchlist">${icon('bookmarkFilled', 17)}</button></div>
    <strong class="watch-title">${esc(item.title)}</strong>
    <p class="watch-place">${esc(item.jurisdiction)}${item.county && item.county !== item.jurisdiction ? ` · ${esc(item.county)}` : ''}</p>
    <div class="watch-numbers"><span class="status-pill ${status}">${esc(localStatus(item))}</span>${voted ? `<span><b class="dem">${formatPct(item.yesPct, 1)}</b> yes</span><span><b class="rep">${formatPct(item.noPct, 1)}</b> no</span>` : '<span class="muted">Awaiting first count</span>'}</div>
  </div>`;
}

function emptyState(title, detail, glyph = 'search') {
  return `<div class="empty-state"><span>${icon(glyph, 26)}</span><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;
}

function drawerTemplate() {
  if (!store.drawer) return '';
  const { type } = store.drawer;
  let content = '';
  if (type === 'race') content = raceDrawer(store.drawer.office, store.drawer.key);
  else if (type === 'local') content = localDrawer(store.drawer.id);
  else if (type === 'state') content = stateDrawer(store.drawer.state);
  if (!content) return '';
  return `<div class="scrim" data-action="close-drawer" aria-hidden="true"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="${type === 'local' ? 'Local ballot measure details' : type === 'state' ? 'State results' : 'Race details'}">
      <button class="drawer-close" data-action="close-drawer" aria-label="Close">${icon('close', 20)}</button>
      ${content}
    </aside>`;
}

function raceDrawer(office, key) {
  const race = findCurrentRace(office, key);
  if (!race) return `<div class="drawer-inner">${emptyState('Race not in feed.', 'Try refreshing the results.')}</div>`;
  const prior = findPriorRace(race, priorFeed(office));
  const compared = compareRace(race, prior);
  const watched = Boolean(store.watch[raceKey(race)]);
  const meta = OFFICES[office];
  const reporting = Math.max(0, Math.min(100, race.reporting || 0));
  const pct = (candidate) => candidate.pct ?? (race.total ? (candidate.votes / race.total) * 100 : 0);
  return `<div class="drawer-inner">
    <div class="drawer-eyebrow"><span class="office-kicker">${esc(meta.label)} · ${esc(race.state)}</span><span class="status-pill ${race.called || race.winnerParty ? 'approved' : race.hasVotes ? 'counted' : 'waiting'}">${race.called || race.winnerParty ? `Called ${race.winnerParty ? partyMeta(race.winnerParty).name : ''}` : race.hasVotes ? 'Counting' : 'Awaiting count'}</span></div>
    <h2>${esc(race.label)}</h2>
    <div class="drawer-actions">
      <button class="button quiet small ${watched ? 'saved' : ''}" data-action="toggle-watch-race" data-office="${race.office}" data-key="${esc(race.key)}">${icon(watched ? 'bookmarkFilled' : 'bookmark', 16)} ${watched ? 'Saved' : 'Save race'}</button>
      <button class="button quiet small" data-action="share" data-title="${esc(race.label)}">${icon('share', 16)} Share</button>
    </div>
    <div class="drawer-hero-margin">
      <div><span class="eyebrow">Current margin</span><strong class="${race.leaderParty === 'D' ? 'dem' : race.leaderParty === 'R' ? 'rep' : ''}">${formatMargin(race)}</strong><span>${race.leaderParty ? `${partyMeta(race.leaderParty).name} leading` : 'No leader yet'}</span></div>
      <div><span class="eyebrow">Est. reporting</span><strong>${formatPct(race.reporting, 1)}</strong><span>${formatCompact(race.total)} votes counted</span></div>
    </div>
    <div class="reporting-track large"><span style="width:${reporting}%"></span></div>
    <div class="drawer-section">
      <div class="section-label"><span>Candidates</span><span>${formatNumber(race.total)} votes</span></div>
      <div class="candidate-list">
        ${race.candidates.length ? race.candidates.map((candidate) => {
          const party = partyMeta(candidate.party);
          return `<div class="candidate ${candidate.winner ? 'winner' : ''}">
            <div class="candidate-top"><span class="candidate-name"><i class="party-dot" style="background:${party.color}"></i>${esc(candidate.name)}${candidate.incumbent ? '<span class="tiny-pill">Inc.</span>' : ''}${candidate.winner ? `<span class="tiny-pill win">${icon('check', 12)} winner</span>` : ''}</span><span class="candidate-votes"><strong>${formatNumber(candidate.votes)}</strong><span>${formatPct(pct(candidate), 1)}</span></span></div>
            <div class="candidate-track"><span style="width:${Math.max(0, Math.min(100, pct(candidate)))}%;background:${party.color}"></span></div>
          </div>`;
        }).join('') : '<div class="empty-inline">No candidate list published yet.</div>'}
      </div>
    </div>
    <div class="drawer-section compare-box">
      <div class="section-label"><span>Since 2024</span><span>${compared ? 'Certified baseline' : store.priorReady ? 'Not comparable' : 'Loading baseline'}</span></div>
      ${compared ? `<div class="compare-values">
          <div><span>2024</span><strong class="${compared.before >= 0 ? 'dem' : 'rep'}">${marginLabel(compared.before)}</strong></div>
          <div class="compare-arrow">${icon('chevronRight', 16)}</div>
          <div><span>2026</span><strong class="${compared.current >= 0 ? 'dem' : 'rep'}">${marginLabel(compared.current)}</strong></div>
          <div class="compare-swing ${compared.swing >= 0 ? 'dem' : 'rep'}"><span>Swing</span><strong>${formatSignedPct(compared.swing)}</strong></div>
        </div>
        <div class="dual-bar"><span class="prior" style="width:${Math.min(100, Math.abs(compared.before)) / 2}%"></span><span class="current" style="width:${Math.min(100, Math.abs(compared.current)) / 2}%"></span></div>
        ${compared.redistricted ? `<p class="caveat">${icon('info', 14)} This House district was redrawn for 2026. The 2024 comparison is directional, not a like-for-like electorate.</p>` : ''}`
        : `<p class="muted">${store.priorReady ? 'Both years need vote counts before a swing can be calculated.' : 'Fetching the 2024 certified results…'}</p>`}
    </div>
    <div class="drawer-source source-ledger">
      <div class="source-ledger-head"><span>Sources</span><span>${race.sources?.length || 0} live check${(race.sources?.length || 0) === 1 ? '' : 's'}</span></div>
      <div class="source-ledger-list">
        ${(race.sources || []).map((source) => `<div class="source-ledger-row">
          <span class="source-ledger-name">${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.label)} ${icon('external', 12)}</a>` : esc(source.label)}<small>${esc(source.name || '')}</small></span>
          <span class="source-ledger-value">${formatNumber(source.total)} votes${source.reporting == null ? '' : ` · ${formatPct(source.reporting, 1)} in`}${source.updatedAt ? ` · ${relativeTime(source.updatedAt)}` : ''}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function localDrawer(id) {
  const item = LOCAL_ITEMS.find((entry) => entry.id === id);
  if (!item) return `<div class="drawer-inner">${emptyState('Measure not found.', 'Try another local measure.')}</div>`;
  const watched = Boolean(store.watch[localKey(item)]);
  const hasVotes = item.totalVotes > 0;
  const yesPct = hasVotes ? item.yesPct ?? ((item.yesVotes / item.totalVotes) * 100) : 0;
  const noPct = hasVotes ? item.noPct ?? ((item.noVotes / item.totalVotes) * 100) : 0;
  const status = yesNoClass(item);
  return `<div class="drawer-inner">
    <div class="drawer-eyebrow"><span class="office-kicker">${esc(LEVEL_LABELS[item.level] || item.level)} · ${esc(item.stateName)}</span><span class="status-pill ${status}">${esc(localStatus(item))}</span></div>
    <h2>${esc(item.title)}</h2>
    <div class="drawer-actions">
      <button class="button quiet small ${watched ? 'saved' : ''}" data-action="toggle-watch-local" data-id="${item.id}">${icon(watched ? 'bookmarkFilled' : 'bookmark', 16)} ${watched ? 'Saved' : 'Save measure'}</button>
      <button class="button quiet small" data-action="share" data-title="${esc(item.title)}">${icon('share', 16)} Share</button>
    </div>
    <div class="local-place-block">${icon('map', 16)} ${esc(item.jurisdiction)}${item.county && item.county !== item.jurisdiction ? ` · ${esc(item.county)}` : ''} · ${esc(item.stateName)}</div>
    <div class="local-vote-hero">
      <div class="vote-side yes"><span>Yes</span><strong>${hasVotes ? formatPct(yesPct, 1) : '—'}</strong><small>${hasVotes ? formatNumber(item.yesVotes) : 'awaiting count'}</small></div>
      <div class="vote-bar"><span class="yes" style="width:${yesPct}%"></span><span class="no" style="width:${noPct}%"></span></div>
      <div class="vote-side no"><span>No</span><strong>${hasVotes ? formatPct(noPct, 1) : '—'}</strong><small>${hasVotes ? formatNumber(item.noVotes) : 'awaiting count'}</small></div>
    </div>
    <div class="drawer-section">
      <div class="section-label"><span>What it does</span><span>${esc(item.measure || item.type)}</span></div>
      <p class="measure-description">${esc(item.description || 'Description not published in the source table.')}</p>
      <div class="measure-meta">
        <div><span>Jurisdiction</span><strong>${esc(item.jurisdiction)}</strong></div>
        <div><span>Type</span><strong>${esc(item.type || '—')}</strong></div>
        <div><span>Subject</span><strong>${esc(item.subject || '—')}</strong></div>
        <div><span>Total votes</span><strong>${hasVotes ? formatNumber(item.totalVotes) : '—'}</strong></div>
      </div>
    </div>
    ${item.sourceUrl ? `<div class="drawer-source"><span>Source: Ballotpedia local ballot measure coverage</span><a href="${esc(item.sourceUrl)}" target="_blank" rel="noreferrer">Measure page ${icon('external', 13)}</a></div>` : ''}
  </div>`;
}

function stateDrawer(state) {
  const name = STATE_NAMES[state] || state;
  const races = currentRaces().filter((race) => race.state === state);
  const localItems = LOCAL_ITEMS.filter((item) => item.state === state);
  if (!races.length && !localItems.length) return `<div class="drawer-inner">${emptyState(`${name} is not in the available feeds yet.`, 'This state may publish through a different official feed.')}</div>`;
  return `<div class="drawer-inner">
    <div class="drawer-eyebrow"><span class="office-kicker">State snapshot</span><span class="status-pill counted">${races.length} races</span></div>
    <h2>${esc(name)}</h2>
    <p class="drawer-intro">${localItems.length ? `${formatNumber(localItems.length)} local measures are also on the ballot in this state.` : 'No local measures indexed for this state yet.'}</p>
    <div class="drawer-section">
      <div class="section-label"><span>Federal & state races</span><span>Live counts</span></div>
      <div class="state-race-list">${races.map((race) => `<button class="state-race" data-action="open-race" data-office="${race.office}" data-key="${esc(race.key)}"><span><span class="office-kicker">${esc(OFFICES[race.office].lower)}</span><strong>${esc(race.label)}</strong></span><span>${leaderLine(race)}</span><strong class="${race.leaderParty === 'D' ? 'dem' : race.leaderParty === 'R' ? 'rep' : ''}">${formatMargin(race)}</strong></button>`).join('') || '<div class="empty-inline">No race in the current feed.</div>'}</div>
    </div>
    ${localItems.length ? `<div class="drawer-section"><div class="section-label"><span>Local measures</span><span>${formatNumber(localItems.length)}</span></div><div class="state-local-list">${localItems.slice(0, 6).map((item) => `<button class="state-local" data-action="open-local" data-id="${item.id}"><span>${esc(item.jurisdiction)}</span><strong>${esc(item.title)}</strong><span class="status-pill ${yesNoClass(item)}">${esc(localStatus(item))}</span></button>`).join('')}</div><button class="text-link" data-action="filter-state-local" data-state="${state}">Browse all ${esc(name)} local measures ${icon('chevronRight', 14)}</button></div>` : ''}
  </div>`;
}

async function loadLive({ initial = false, force = false } = {}) {
  if (store.refreshing) return store.ready;
  store.refreshing = true;
  if (!initial) render();
  const previous = store.feeds[2026] || {};
  const openPromise = Promise.allSettled(OFFICE_ORDER.map((office) => fetchFeed(2026, office)));
  const pushPromise = fetchPushbuild({ force })
    .then((bundle) => buildPushbuildFeeds(bundle, 2026))
    .catch((error) => ({ error }));
  const [results, push] = await Promise.all([openPromise, pushPromise]);
  const next = { ...previous };
  const errors = {};
  results.forEach((result, index) => {
    const office = OFFICE_ORDER[index];
    const sources = [];
    if (result.status === 'fulfilled') sources.push(result.value);
    if (push?.[office]) sources.push(push[office]);
    if (previous[office]) sources.push(previous[office]);
    if (sources.length) next[office] = mergeOfficeFeeds(office, 2026, sources);
    else errors[office] = result.reason?.message || 'Feed unavailable';
  });
  if (push?.error) errors.pushbuild = push.error.message || 'Supplemental feed unavailable';
  else if ((push?.coverage?.states || 0) === 0) errors.pushbuild = 'Supplemental feed unavailable';
  const any = Object.keys(next).length > 0;
  if (any) {
    if (initial || !store.ready) seedEvents(next);
    else detectEvents(previous, next);
    store.feeds[2026] = next;
    store.sourceReport = sourceReport(next);
    store.ready = true;
  }
  store.errors = errors;
  store.refreshing = false;
  store.lastRefreshAt = Date.now();
  store.nextRefreshAt = Date.now() + 60_000;
  if (!initial) render();
  return any;
}

function sourceReport(feeds) {
  const sources = new Map();
  for (const office of OFFICE_ORDER) {
    for (const source of feeds[office]?.sources || []) {
      const entry = sources.get(source.id) || {
        id: source.id,
        label: source.label,
        name: source.name,
        url: source.url,
        races: 0,
        states: 0,
      };
      entry.races += source.races;
      entry.states = Math.max(entry.states, source.states || 0);
      sources.set(source.id, entry);
    }
  }
  return [...sources.values()];
}

async function loadPrior() {
  const results = await Promise.allSettled(OFFICE_ORDER.map((office) => fetchFeed(2024, office)));
  const next = {};
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') next[OFFICE_ORDER[index]] = result.value;
  });
  if (!Object.keys(next).length) store.priorError = true;
  store.feeds[2024] = next;
  store.priorReady = true;
  render();
}

function seedEvents(feeds) {
  const races = allRaces({ 2026: feeds }, 2026);
  const asOf = maxAsOf({ 2026: feeds }, 2026);
  const latest = [...races].filter((race) => race.hasVotes).sort((a, b) => (b.reporting || 0) - (a.reporting || 0))[0];
  store.events = [
    {
      time: new Date().toISOString(),
      type: 'info',
      icon: 'activity',
      title: 'Live desk connected',
      detail: `${races.length} races across ${new Set(races.map((race) => race.state)).size} states, including ${LOCAL_ITEMS.length} local measures.`,
    },
    ...(asOf ? [{
      time: asOf,
      type: 'count',
      icon: 'clock',
      title: 'Latest official count',
      detail: `Most recent state feed timestamp: ${formatTimeET(asOf)}.`,
    }] : []),
    ...(latest ? [{
      time: new Date().toISOString(),
      office: latest.office,
      key: latest.key,
      type: 'count',
      icon: 'barChart',
      title: `${latest.label} leads the reporting board`,
      detail: `${formatPct(latest.reporting, 0)} of the estimated vote is in.`,
    }] : []),
  ];
}

function detectEvents(previous, next) {
  const events = [];
  const now = new Date().toISOString();
  for (const office of OFFICE_ORDER) {
    const before = previous[office];
    const after = next[office];
    if (!after) continue;
    for (const race of after.races) {
      const old = before?.byKey?.get(race.key);
      if (!old) {
        if (race.hasVotes) {
          events.push({ time: now, office: race.office, key: race.key, type: 'count', icon: 'plus', title: `${race.label} entered the feed`, detail: `${formatNumber(race.total)} votes counted so far.` });
        }
        continue;
      }
      if ((race.called || race.winnerParty) && !(old.called || old.winnerParty)) {
        const winner = race.winnerParty || race.leaderParty;
        events.push({ time: now, office: race.office, key: race.key, type: 'call', icon: 'check', title: `${race.label} called`, detail: winner ? `${partyMeta(winner).name} projected by the source state feed.` : 'Source feed marked this race called.' });
      } else if (old.leaderParty && race.leaderParty && old.leaderParty !== race.leaderParty) {
        events.push({ time: now, office: race.office, key: race.key, type: 'lead', icon: 'activity', title: `Lead change in ${race.label}`, detail: `${partyMeta(race.leaderParty).name} now leads by ${formatMargin(race)}.` });
      } else if (old.reporting != null && race.reporting != null && Math.floor(race.reporting / 10) > Math.floor(old.reporting / 10)) {
        events.push({ time: now, office: race.office, key: race.key, type: 'count', icon: 'barChart', title: `${race.label} passes ${Math.floor(race.reporting / 10) * 10}% reporting`, detail: `${formatNumber(race.total)} votes counted.` });
      }
    }
  }
  const additions = events.slice(0, 10);
  if (!additions.length) {
    additions.push({ time: now, type: 'quiet', icon: 'refresh', title: 'Feeds checked', detail: 'No new race-level counts in the last refresh.' });
  }
  store.events = [...additions, ...store.events].slice(0, 28);
}

async function refreshNow() {
  if (store.refreshing) return;
  await loadLive({ force: true });
  const count = currentRaces().length;
  showToast(`Feeds refreshed · ${formatNumber(count)} races tracked`);
}

function startTimers() {
  setInterval(() => {
    updateLiveText();
    if (document.visibilityState === 'visible' && Date.now() > store.nextRefreshAt && !store.refreshing) loadLive();
  }, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() > store.nextRefreshAt && !store.refreshing) loadLive();
  });
}

function navigate(route) {
  if (store.route === route) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  store.route = route;
  store.drawer = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'toggle-theme') {
    applyTheme(store.theme === 'dark' ? 'light' : 'dark');
    render();
    return;
  }
  if (action === 'refresh') {
    event.preventDefault();
    refreshNow();
    return;
  }
  if (action === 'retry') {
    window.location.reload();
    return;
  }
  if (action === 'open-race') {
    store.drawer = { type: 'race', office: target.dataset.office, key: target.dataset.key };
    render();
    return;
  }
  if (action === 'open-local') {
    store.drawer = { type: 'local', id: target.dataset.id };
    render();
    return;
  }
  if (action === 'open-state') {
    store.drawer = { type: 'state', state: target.dataset.state };
    render();
    return;
  }
  if (action === 'close-drawer') {
    store.drawer = null;
    render();
    return;
  }
  if (action === 'toggle-watch-race') {
    event.stopPropagation();
    const race = findCurrentRace(target.dataset.office, target.dataset.key);
    if (race) toggleWatch(raceKey(race), raceWatchMeta(race));
    return;
  }
  if (action === 'toggle-watch-local') {
    event.stopPropagation();
    const item = LOCAL_ITEMS.find((entry) => entry.id === target.dataset.id);
    if (item) toggleWatch(localKey(item), localWatchMeta(item));
    return;
  }
  if (action === 'remove-watch') {
    event.stopPropagation();
    delete store.watch[target.dataset.watchKey];
    saveWatchlist();
    showToast('Removed from watchlist');
    render();
    return;
  }
  if (action === 'set-map-office') {
    store.mapOffice = target.dataset.office;
    render();
    return;
  }
  if (action === 'set-compare-office') {
    store.compareOffice = target.dataset.office;
    render();
    return;
  }
  if (action === 'load-more-office') {
    store.office.limit += 96;
    render();
    return;
  }
  if (action === 'load-more-local') {
    store.local.limit += 96;
    render();
    return;
  }
  if (action === 'share') {
    sharePage(target.dataset.title || 'Midterm Pulse');
    return;
  }
  if (action === 'clear-watchlist') {
    store.watch = {};
    saveWatchlist();
    showToast('Watchlist cleared');
    render();
    return;
  }
  if (action === 'filter-state-local') {
    store.local.state = target.dataset.state;
    store.local.level = 'all';
    store.local.subject = 'all';
    store.local.result = 'all';
    store.local.query = '';
    store.local.limit = 96;
    store.drawer = null;
    store.route = 'local';
    window.history.pushState(null, '', '#/local');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  }
}

async function sharePage(title) {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title, text: `${title} — live 2026 results on Midterm Pulse`, url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    }
  } catch {
    showToast('Share cancelled');
  }
}

function handleInput(event) {
  if (event.target.id === 'office-search') {
    store.office.query = event.target.value;
    store.office.limit = 96;
    render();
  }
  if (event.target.id === 'local-search') {
    store.local.query = event.target.value;
    store.local.limit = 96;
    render();
  }
}

function handleChange(event) {
  const id = event.target.id;
  if (id === 'office-party') store.office.party = event.target.value;
  else if (id === 'office-status') store.office.status = event.target.value;
  else if (id === 'office-sort') store.office.sort = event.target.value;
  else if (id === 'local-state') store.local.state = event.target.value;
  else if (id === 'local-level') store.local.level = event.target.value;
  else if (id === 'local-subject') store.local.subject = event.target.value;
  else if (id === 'local-result') store.local.result = event.target.value;
  else if (id === 'local-sort') store.local.sort = event.target.value;
  else return;
  if (id.startsWith('office-')) store.office.limit = 96;
  if (id.startsWith('local-')) store.local.limit = 96;
  render();
}

function handleKeydown(event) {
  if (event.key === 'Escape' && store.drawer) {
    store.drawer = null;
    render();
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-action][role="button"]')) {
    event.preventDefault();
    event.target.click();
  }
}

async function boot() {
  initTheme();
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('hashchange', () => {
    const next = routeFromHash();
    if (next === store.route) return;
    store.route = next;
    store.drawer = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  });
  renderBoot();
  const ok = await loadLive({ initial: true });
  if (!ok || !store.ready) {
    renderFatal();
    return;
  }
  render();
  startTimers();
  loadPrior();
}

boot();
