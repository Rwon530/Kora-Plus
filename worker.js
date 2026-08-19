/**
 * Cloudflare Worker proxy for API-Football v3.
 *
 * Cloudflare:
 * 1) Add secret: FOOTBALL_API_KEY
 * 2) Deploy this worker
 * 3) Serve index.html/style.css/app.js/api.js from the same origin,
 *    or set PUBLIC_ORIGIN below if the frontend is on another origin.
 *
 * Never put FOOTBALL_API_KEY in frontend code.
 */
const API_ORIGIN = "https://v3.football.api-sports.io";
const ALLOWED_ORIGIN = "*";

const PUBLIC_PATHS = new Set([
  "fixtures", "fixtures/events", "fixtures/lineups", "fixtures/statistics",
  "fixtures/headtohead", "predictions", "standings", "leagues", "teams", "players"
]);

const CACHE_TTL = {
  fixtures: 15,
  "fixtures/events": 15,
  "fixtures/statistics": 60,
  "fixtures/lineups": 300,
  standings: 3600,
  leagues: 86400,
  teams: 86400,
  players: 86400,
  predictions: 3600,
  "fixtures/headtohead": 3600
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      ...extra
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Accept"
        }
      });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return json({ok: true, service: "Kora Plus API proxy"});
    }

    const path = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
    if (!PUBLIC_PATHS.has(path)) return json({error: "Endpoint not allowed"}, 404);
    if (!env.FOOTBALL_API_KEY) return json({error: "Invalid API key configuration"}, 500);

    const target = new URL(`${API_ORIGIN}/${path}`);
    url.searchParams.forEach((value, key) => target.searchParams.set(key, value));

    const cache = caches.default;
    const cacheKey = new Request(target.toString(), {method: "GET"});
    const ttl = CACHE_TTL[path] ?? 30;

    // Only cache GET responses that are safe to cache.
    // Live fixtures/events are intentionally short-lived.
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
      return new Response(cached.body, {status: cached.status, headers});
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        method: "GET",
        headers: {
          "x-apisports-key": env.FOOTBALL_API_KEY,
          "Accept": "application/json"
        }
      });
    } catch {
      return json({error: "Network error while contacting Football API"}, 502);
    }

    const text = await upstream.text();
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttl}`,
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN
    });

    // Preserve API rate-limit visibility for operational debugging.
    for (const h of [
      "x-ratelimit-requests-limit",
      "x-ratelimit-requests-remaining",
      "x-ratelimit-requests-reset"
    ]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    const response = new Response(text, {
      status: upstream.status,
      headers
    });

    if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
};