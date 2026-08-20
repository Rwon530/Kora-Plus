const API_ORIGIN="https://v3.football.api-sports.io";
const ALLOWED_ORIGIN="*";
const PUBLIC_PATHS=new Set(["fixtures","fixtures/events","fixtures/lineups","fixtures/statistics","fixtures/headtohead","predictions","standings","leagues","teams","players"]);
const CACHE_TTL={fixtures:1800,"fixtures/events":1800,"fixtures/statistics":21600,"fixtures/lineups":21600,"fixtures/headtohead":86400,predictions:21600,standings:86400,leagues:604800,teams:604800,players:604800};

function cors(){return {"Access-Control-Allow-Origin":ALLOWED_ORIGIN,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Accept"};}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...cors(),...extra}});}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function upstream(target,env){
  try{
    const r=await fetch(target,{headers:{"x-apisports-key":env.FOOTBALL_API_KEY,"Accept":"application/json"}});
    const body=await r.text();
    return {r,body};
  }catch(error){
    return {error};
  }
}

async function proxy(request,env,ctx){
  const url=new URL(request.url);
  const path=url.pathname.replace(/^\/api\//,"").replace(/\/+$/,"");
  if(!PUBLIC_PATHS.has(path))return json({error:"Endpoint not allowed"},404);
  if(!env.FOOTBALL_API_KEY)return json({error:"FOOTBALL_API_KEY is not configured in Cloudflare Secrets"},500);

  const target=new URL(`${API_ORIGIN}/${path}`);
  url.searchParams.forEach((v,k)=>target.searchParams.set(k,v));

  const ttl=CACHE_TTL[path]??30;
  const cache=caches.default;
  const cacheKey=new Request(target.toString(),{method:"GET"});
  const hit=await cache.match(cacheKey);
  if(hit){
    const h=new Headers(hit.headers);
    Object.entries(cors()).forEach(([k,v])=>h.set(k,v));
    h.set("X-Kora-Cache","HIT");
    return new Response(hit.body,{status:hit.status,headers:h});
  }

  const result=await upstream(target.toString(),env);
  if(!result || result.error)return json({error:"Network error while contacting Football API"},502);

  if(!result.r.ok){
    let b=null;try{b=JSON.parse(result.body)}catch{}
    return json({error:b?.message||`Football API HTTP ${result.r.status}`,errors:b?.errors||null},result.r.status);
  }

  const h=new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":`public, max-age=${ttl}`,...cors(),"X-Kora-Cache":"MISS"});
  for(const n of ["x-ratelimit-requests-limit","x-ratelimit-requests-remaining","x-ratelimit-requests-reset"]){
    const v=result.r.headers.get(n);if(v)h.set(n,v);
  }
  const response=new Response(result.body,{status:200,headers:h});
  ctx.waitUntil(cache.put(cacheKey,response.clone()));
  return response;
}

export default {async fetch(request,env,ctx){
  if(request.method==="OPTIONS")return new Response(null,{headers:cors()});
  const url=new URL(request.url);
  if(url.pathname==="/api"||url.pathname.startsWith("/api/"))return proxy(request,env,ctx);
  if(env.ASSETS)return env.ASSETS.fetch(request);
  return json({error:"ASSETS binding is missing. Deploy with wrangler.toml."},500);
}};
