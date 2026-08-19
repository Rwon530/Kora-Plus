/* API abstraction: frontend never sees the API-Football secret. */
const CONFIG = Object.freeze({
  proxyBase: "/api",
  defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
  cacheTTL: {
    fixtures: 30_000,
    live: 15_000,
    events: 15_000,
    statistics: 60_000,
    standings: 3_600_000,
    leagues: 86_400_000,
    teams: 86_400_000,
    players: 86_400_000,
    predictions: 3_600_000
  }
});

const memoryCache = new Map();
const inflight = new Map();

function keyFor(path, params = {}) {
  const qs = new URLSearchParams();
  Object.keys(params).sort().forEach(k => {
    const v = params[k];
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  return `${path}?${qs.toString()}`;
}

async function request(path, params = {}, options = {}) {
  const key = keyFor(path, params);
  const ttl = options.ttl ?? 30_000;
  const force = options.force === true;
  const now = Date.now();

  if (!force) {
    const cached = memoryCache.get(key);
    if (cached && now - cached.time < ttl) return cached.data;

    try {
      const raw = localStorage.getItem(`kp:${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (now - parsed.time < ttl) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {}
  }

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    const qs = new URLSearchParams();
    Object.entries({...params, timezone: params.timezone ?? CONFIG.defaultTimezone}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, v);
    });

    const response = await fetch(`${CONFIG.proxyBase}/${path}?${qs}`, {
      headers: { "Accept": "application/json" }
    });

    let body = null;
    try { body = await response.json(); } catch {}

    if (!response.ok) {
      const error = new Error(body?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    if (body?.error) {
      const error = new Error(body.error);
      error.apiErrors = body.errors;
      error.status = body.status;
      throw error;
    }

    const record = { time: now, data: body };
    memoryCache.set(key, record);
    try { localStorage.setItem(`kp:${key}`, JSON.stringify(record)); } catch {}
    return body;
  })();

  inflight.set(key, promise);
  try { return await promise; } finally { inflight.delete(key); }
}

export const api = {
  getLiveMatches: (params = {}, options = {}) =>
    request("fixtures", { live: "all", ...params }, {ttl: CONFIG.cacheTTL.live, ...options}),

  getFixtures: (params = {}, options = {}) =>
    request("fixtures", params, {ttl: CONFIG.cacheTTL.fixtures, ...options}),

  getMatchDetails: (fixture, options = {}) =>
    request("fixtures", { id: fixture }, {ttl: CONFIG.cacheTTL.fixtures, ...options}),

  getMatchEvents: (fixture, options = {}) =>
    request("fixtures/events", { fixture }, {ttl: CONFIG.cacheTTL.events, ...options}),

  getLineups: (fixture, options = {}) =>
    request("fixtures/lineups", { fixture }, {ttl: CONFIG.cacheTTL.events, ...options}),

  getMatchStatistics: (fixture, options = {}) =>
    request("fixtures/statistics", { fixture }, {ttl: CONFIG.cacheTTL.statistics, ...options}),

  getStandings: (league, season, options = {}) =>
    request("standings", { league, season }, {ttl: CONFIG.cacheTTL.standings, ...options}),

  getLeagues: (params = {}, options = {}) =>
    request("leagues", params, {ttl: CONFIG.cacheTTL.leagues, ...options}),

  getTeams: (params = {}, options = {}) =>
    request("teams", params, {ttl: CONFIG.cacheTTL.teams, ...options}),

  getPlayers: (params = {}, options = {}) =>
    request("players", params, {ttl: CONFIG.cacheTTL.players, ...options}),

  getHeadToHead: (h2h, options = {}) =>
    request("fixtures/headtohead", { h2h }, {ttl: CONFIG.cacheTTL.fixtures, ...options}),

  getPredictions: (fixture, options = {}) =>
    request("predictions", { fixture }, {ttl: CONFIG.cacheTTL.predictions, ...options}),

  searchLeagues: (search) => request("leagues", { search }, {ttl: CONFIG.cacheTTL.leagues}),
  searchTeams: (search) => request("teams", { search }, {ttl: CONFIG.cacheTTL.teams}),
  searchPlayers: (search, page = 1) => request("players", { search, page }, {ttl: CONFIG.cacheTTL.players})
};

export { CONFIG };