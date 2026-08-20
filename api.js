const CONFIG = Object.freeze({
  proxyBase: "/api",
  defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
  cacheTTL: {fixtures:1800000, live:1800000, events:1800000, statistics:21600000, standings:86400000, leagues:604800000, teams:604800000, players:604800000, predictions:21600000},
  staleMaxAge: {fixtures:86400000, live:600000, events:1800000, statistics:21600000, standings:604800000, leagues:2592000000, teams:2592000000, players:2592000000, predictions:172800000}
});

const memoryCache = new Map();
const inflight = new Map();

function keyFor(path, params={}) {
  const q = new URLSearchParams();
  Object.keys(params).sort().forEach(k => {
    const v=params[k];
    if(v!==undefined && v!==null && v!=="") q.set(k,String(v));
  });
  return `${path}?${q}`;
}

function localRecord(key) {
  try {
    const r=JSON.parse(localStorage.getItem(`kp:${key}`)||"null");
    return r && r.data && r.time ? r : null;
  } catch { return null; }
}

function save(key,data) {
  const r={time:Date.now(),data};
  memoryCache.set(key,r);
  try { localStorage.setItem(`kp:${key}`,JSON.stringify(r)); } catch {}
  return data;
}

function stale(path,key) {
  const r=memoryCache.get(key)||localRecord(key);
  if(!r) return null;
  const max=CONFIG.staleMaxAge[path]??86400000;
  if(Date.now()-r.time<=max) {
    memoryCache.set(key,r);
    return r.data;
  }
  return null;
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchRetry(url) {
  try {
    const res=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
    let body=null; try{body=await res.json();}catch{}
    if(res.ok && !body?.error) return body;
    const e=new Error(body?.error||`HTTP ${res.status}`); e.status=res.status; e.apiErrors=body?.errors;
    throw e;
  } catch(e) {
    throw e;
  }
}

async function request(path,params={},options={}) {
  const key=keyFor(path,params);
  const ttl=options.ttl??30000;
  const force=options.force===true;
  const now=Date.now();

  const m=memoryCache.get(key);
  if(!force && m && now-m.time<ttl) return m.data;

  if(!force){
    const r=localRecord(key);
    if(r){memoryCache.set(key,r); if(now-r.time<ttl) return r.data;}
  }

  if(inflight.has(key)) return inflight.get(key);

  const promise=(async()=>{
    const q=new URLSearchParams();
    Object.entries({...params,timezone:params.timezone??CONFIG.defaultTimezone}).forEach(([k,v])=>{
      if(v!==undefined && v!==null && v!=="") q.set(k,v);
    });
    try{
      return save(key,await fetchRetry(`${CONFIG.proxyBase}/${path}?${q}`));
    }catch(e){
      const old=stale(path,key);
      if(old) { console.warn("Using cached Kora Plus data:",path,e); return old; }
      throw e;
    }
  })();

  inflight.set(key,promise);
  try{return await promise;}finally{inflight.delete(key);}
}

export const api={
  getLiveMatches:(p={},o={})=>request("fixtures",{live:"all",...p},{ttl:CONFIG.cacheTTL.live,...o}),
  getFixtures:(p={},o={})=>request("fixtures",p,{ttl:CONFIG.cacheTTL.fixtures,...o}),
  getMatchDetails:(fixture,o={})=>request("fixtures",{id:fixture},{ttl:CONFIG.cacheTTL.fixtures,...o}),
  getMatchEvents:(fixture,o={})=>request("fixtures/events",{fixture},{ttl:CONFIG.cacheTTL.events,...o}),
  getLineups:(fixture,o={})=>request("fixtures/lineups",{fixture},{ttl:CONFIG.cacheTTL.events,...o}),
  getMatchStatistics:(fixture,o={})=>request("fixtures/statistics",{fixture},{ttl:CONFIG.cacheTTL.statistics,...o}),
  getStandings:(league,season,o={})=>request("standings",{league,season},{ttl:CONFIG.cacheTTL.standings,...o}),
  getLeagues:(p={},o={})=>request("leagues",p,{ttl:CONFIG.cacheTTL.leagues,...o}),
  getTeams:(p={},o={})=>request("teams",p,{ttl:CONFIG.cacheTTL.teams,...o}),
  getPlayers:(p={},o={})=>request("players",p,{ttl:CONFIG.cacheTTL.players,...o}),
  getHeadToHead:(h2h,o={})=>request("fixtures/headtohead",{h2h},{ttl:CONFIG.cacheTTL.fixtures,...o}),
  getPredictions:(fixture,o={})=>request("predictions",{fixture},{ttl:CONFIG.cacheTTL.predictions,...o}),
  searchLeagues:s=>request("leagues",{search:s},{ttl:CONFIG.cacheTTL.leagues}),
  searchTeams:s=>request("teams",{search:s},{ttl:CONFIG.cacheTTL.teams}),
  searchPlayers:(s,page=1)=>request("players",{search:s,page},{ttl:CONFIG.cacheTTL.players})
};

export {CONFIG};
