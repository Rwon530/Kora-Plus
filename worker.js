const API_ORIGIN = "https://v3.football.api-sports.io";
const ALLOWED_ORIGIN = "*";

const PUBLIC_PATHS = new Set([
  "fixtures", "fixtures/events", "fixtures/lineups", "fixtures/statistics",
  "fixtures/headtohead", "predictions", "standings", "leagues", "teams", "players"
]);

const CACHE_TTL = {
  "fixtures": 15, "fixtures/events": 15, "fixtures/statistics": 60,
  "fixtures/lineups": 300, "fixtures/headtohead": 3600,
  "predictions": 3600, "standings": 3600, "leagues": 86400,
  "teams": 86400, "players": 86400
};

function cors() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  };
}

function json(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cors(),
      ...extra
    }
  });
}

async function proxy(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");

  if (!PUBLIC_PATHS.has(path)) return json({error:"Endpoint not allowed"},404);
  if (!env.FOOTBALL_API_KEY) {
    return json({error:"FOOTBALL_API_KEY is not configured in Cloudflare Secrets"},500);
  }

  const target = new URL(`${API_ORIGIN}/${path}`);
  url.searchParams.forEach((v,k) => target.searchParams.set(k,v));

  const ttl = CACHE_TTL[path] ?? 30;
  const cache = caches.default;
  const cacheKey = new Request(target.toString(), {method:"GET"});
  const cached = await cache.match(cacheKey);

  if (cached) {
    const h = new Headers(cached.headers);
    Object.entries(cors()).forEach(([k,v]) => h.set(k,v));
    return new Response(cached.body,{status:cached.status,headers:h});
  }

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method:"GET",
      headers:{
        "x-apisports-key":env.FOOTBALL_API_KEY,
        "Accept":"application/json"
      }
    });
  } catch {
    return json({error:"Network error while contacting Football API"},502);
  }

  const body = await upstream.text();
  const headers = new Headers({
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":`public, max-age=${ttl}`,
    ...cors()
  });

  for (const name of [
    "x-ratelimit-requests-limit",
    "x-ratelimit-requests-remaining",
    "x-ratelimit-requests-reset"
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name,value);
  }

  const response = new Response(body,{status:upstream.status,headers});
  if (upstream.ok) ctx.waitUntil(cache.put(cacheKey,response.clone()));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null,{headers:cors()});
    }

    const url = new URL(request.url);

    // Secure API route.
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return proxy(request,env,ctx);
    }

    // Serve index.html, CSS and JS from the same Worker.
    if (env.ASSETS) return env.ASSETS.fetch(request);

    return json({error:"ASSETS binding is missing. Deploy with wrangler.toml."},500);
  }
};
