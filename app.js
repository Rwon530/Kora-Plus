/* Kora Plus - free API edition (UI layer — data layer untouched) */
const DICT={ar:{brand:"كورة بلس",home:"الرئيسية",matches:"المباريات",leagues:"البطولات",standings:"الترتيب",search:"بحث",heroEyebrow:"منصة كرة القدم",heroTitle:"كل المباريات في مكان واحد",heroDesc:"نتائج المباريات والتحديثات المباشرة وأهم البطولات والمباريات.",today:"مباريات اليوم",important:"أهم المباريات",importantSub:"مختارة بعناية",importantLeagues:"البطولات المهمة",live:"مباشر",notStarted:"لم تبدأ",finished:"انتهت",postponed:"مؤجلة",all:"الكل",loading:"جاري تحميل المباريات...",emptyTitle:"لا توجد مباريات في هذا اليوم",emptyDesc:"جرّب اختيار يوم آخر أو العودة إلى اليوم الحالي.",emptySearch:"لا توجد نتائج مطابقة لبحثك.",errorTitle:"تعذر تحميل المباريات",errorDesc:"حدثت مشكلة في الاتصال بالخادم. حاول مرة أخرى.",retry:"إعادة المحاولة",goToday:"الذهاب إلى اليوم",previous:"السابق",next:"التالي",todayBtn:"اليوم",searchPlaceholder:"ابحث عن فريق أو بطولة...",cached:"بيانات محفوظة مؤقتاً",venue:"الملعب",lastUpdated:"آخر تحديث",staleWarning:"تعذر تحديث النتائج الآن — البيانات المعروضة ليست حديثة",retryNow:"تحديث الآن"},en:{brand:"Kora Plus",home:"Home",matches:"Matches",leagues:"Leagues",standings:"Standings",search:"Search",heroEyebrow:"FOOTBALL PLATFORM",heroTitle:"All matches in one place",heroDesc:"Fixtures, live scores, major leagues and important matches.",today:"Today's Matches",important:"Important Matches",importantSub:"Selected matches",importantLeagues:"Top Leagues",live:"Live",notStarted:"Not started",finished:"Finished",postponed:"Postponed",all:"All",loading:"Loading matches...",emptyTitle:"No matches on this day",emptyDesc:"Try another day or jump back to today.",emptySearch:"No results match your search.",errorTitle:"Couldn't load matches",errorDesc:"There was a connection problem. Please try again.",retry:"Retry",goToday:"Go to today",previous:"Previous",next:"Next",todayBtn:"Today",searchPlaceholder:"Search team or league...",cached:"Cached data",venue:"Venue",lastUpdated:"Last updated",staleWarning:"Couldn't refresh results — showing older data",retryNow:"Refresh now"}};
const TOP=new Set([2,3,848,39,40,140,141,135,136,78,79,61,62,88,94,203,307,233,1,4,9,32]);
const state={lang:localStorage.getItem("lang")||"ar",date:localDate(),filter:"all",query:"",matches:[],loading:false,error:"",usingCache:false,lastUpdated:0,stale:false};
const t=k=>(DICT[state.lang]||DICT.ar)[k]||k;

function localDate(d=new Date()){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const g=x=>p.find(v=>v.type===x)?.value;return `${g("year")}-${g("month")}-${g("day")}`}
function shiftDate(date,days){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function dateLabel(date){return new Intl.DateTimeFormat(state.lang==="ar"?"ar-EG":"en-GB",{timeZone:"Africa/Cairo",weekday:"long",day:"numeric",month:"long"}).format(new Date(`${date}T12:00:00`))}
function timeLabel(iso){return new Intl.DateTimeFormat(state.lang==="ar"?"ar-EG":"en-GB",{timeZone:"Africa/Cairo",hour:"2-digit",minute:"2-digit"}).format(new Date(iso))}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}

/* ---- status classification ---- */
const LIVE_CODES=["1H","2H","ET","BT","P","LIVE","HT","INT","SUSP"];
const FINISHED_CODES=["FT","AET","PEN"];
const POSTPONED_CODES=["PST","CANC","ABD","AWD","WO"];
const MAX_PLAUSIBLE_LIVE_MS=150*60000; /* 2.5h — a match still "live" past this is almost certainly stuck data upstream, not a real live state */
function typeOf(s){
  if(LIVE_CODES.includes(s))return"live";
  if(FINISHED_CODES.includes(s))return"finished";
  if(POSTPONED_CODES.includes(s))return"postponed";
  return"scheduled";
}
/* Same as typeOf, but distrusts an impossibly long-running "live" status
   (a known data-quality issue on lower-tier/reserve competitions where the
   provider never pushes a final full-time update). Use this everywhere a
   match's live/finished state drives UI or polling decisions. */
function matchType(m){
  const type=typeOf(m?.status?.short);
  if(type==="live"&&m?.date){
    const kickoff=new Date(m.date).getTime();
    if(!Number.isNaN(kickoff)&&Date.now()-kickoff>MAX_PLAUSIBLE_LIVE_MS)return"finished";
  }
  return type;
}
function statusLabel(m){
  const type=matchType(m);
  if(type==="live")return `${m?.status?.elapsed?m.status.elapsed+"'":t("live")}`;
  if(type==="finished")return t("finished");
  if(type==="postponed")return t("postponed");
  return m?.date?timeLabel(m.date):t("notStarted");
}

function normalizeMatch(raw={}){const fixture=raw.fixture||{};const teams=raw.teams||{};const league=raw.league||{};const goals=raw.goals||{};return {...raw,id:raw.id??fixture.id,date:raw.date??fixture.date,status:(raw.status??fixture.status??{}),home:raw.home??teams.home??{},away:raw.away??teams.away??{},goals,league,venue:raw.venue??fixture.venue,referee:raw.referee??fixture.referee};}
function key(date){return `kora-free-fixtures:${date}`}
function cached(date){try{const x=JSON.parse(localStorage.getItem(key(date))||"null");return x&&Array.isArray(x.data)?{data:x.data.map(normalizeMatch),time:x.time||0}:null}catch{return null}}
function save(date,data){try{localStorage.setItem(key(date),JSON.stringify({time:Date.now(),data}))}catch{}}
let apiPromise;
function api(){return apiPromise||(apiPromise=import("./api.js").then(m=>m.api))}
let consecutiveFailures=0;

async function load({force=false}={}){
  if(state.loading)return;
  state.loading=true;state.error="";
  const old=cached(state.date);
  if(old?.data?.length&&!state.matches.length){state.matches=old.data;state.usingCache=true;state.lastUpdated=old.time}
  render();
  try{
    const client=await api();
    const data=await client.getFixtures({date:state.date},{force});
    const rawRows=Array.isArray(data?.response)?data.response:Array.isArray(data?.results)?data.results:[];
    let rows=rawRows.map(normalizeMatch).filter(m=>m.id||m.home?.name||m.away?.name);

    /* The daily "fixtures?date=" list isn't always refreshed in-play on every
       plan. The dedicated "fixtures?live=all" endpoint is what actually
       carries real-time status/score, so overlay it onto today's matches —
       this is the fix for matches that are genuinely live but still show
       as "not started" on screen. Best-effort: if it fails, keep the
       schedule data we already have rather than losing the whole page. */
    if(state.date===localDate()){
      try{
        const liveData=await client.getLiveMatches({},{force});
        const liveRows=(Array.isArray(liveData?.response)?liveData.response:Array.isArray(liveData?.results)?liveData.results:[]).map(normalizeMatch);
        const liveById=new Map(liveRows.filter(m=>m.id!=null).map(m=>[m.id,m]));
        if(liveById.size)rows=rows.map(m=>{
          const live=m.id!=null?liveById.get(m.id):null;
          return live?{...m,status:live.status,goals:live.goals,score:live.score??m.score}:m;
        });
      }catch{/* live overlay is best-effort */}
    }

    if(rows.length){state.matches=rows;state.usingCache=false;state.stale=false;state.lastUpdated=Date.now();save(state.date,rows);consecutiveFailures=0}
    else if(!state.matches.length){state.matches=[];state.stale=false;consecutiveFailures=0}
    else{state.stale=false;consecutiveFailures=0} /* upstream returned an empty list for a day we already have — keep current data */
  }catch(e){
    consecutiveFailures++;
    if(!state.matches.length)state.error=e?.message||t("errorTitle");
    else state.stale=true; /* fetch failed but we have something to show — flag it instead of pretending it's fresh */
  }finally{
    state.loading=false;render();
  }
}

function visible(){
  const q=state.query.trim().toLowerCase();
  return state.matches.filter(m=>{
    const typ=matchType(m);
    const text=[m?.home?.name,m?.away?.name,m?.league?.name,m?.league?.country].join(" ").toLowerCase();
    return(state.filter==="all"||typ===state.filter)&&(!q||text.includes(q));
  });
}

/* ---------------- Card builders ---------------- */
function statusClass(type){return type==="live"?"live":type==="finished"?"done":type==="postponed"?"postponed":""}

function matchCard(m){
  const home=m?.home||{},away=m?.away||{},typ=matchType(m);
  const gh=m?.goals?.home,ga=m?.goals?.away;
  const hasScore=!(gh==null&&ga==null);
  const score=hasScore?`${gh??0} - ${ga??0}`:"";
  const homeImg=home.logo?`<img class="team-logo" src="${esc(home.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`:`<div class="team-logo"></div>`;
  const awayImg=away.logo?`<img class="team-logo" src="${esc(away.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`:`<div class="team-logo"></div>`;
  const leagueLogo=m?.league?.logo?`<img src="${esc(m.league.logo)}" alt="" loading="lazy" onerror="this.style.display='none'">`:"";
  const liveDot=typ==="live"?`<span class="dot"></span>`:"";
  return `<article class="card match-card">
    <div class="match-meta">
      <div class="league-tag">${leagueLogo}<span>${esc(m?.league?.name||"—")}</span></div>
      <span class="status ${statusClass(typ)}">${liveDot}${esc(statusLabel(m))}</span>
    </div>
    <div class="match-teams">
      <div class="team">${homeImg}<div class="team-name">${esc(home.name||"—")}</div></div>
      <div class="match-center">
        ${hasScore?`<div class="match-score">${score}</div>`:`<div class="match-vs">${state.lang==="ar"?"ضد":"vs"}</div><div class="match-time">${(typ==="scheduled"||typ==="postponed")&&m.date?timeLabel(m.date):""}</div>`}
      </div>
      <div class="team">${awayImg}<div class="team-name">${esc(away.name||"—")}</div></div>
    </div>
    ${m?.venue?.name?`<div class="match-venue"><span>⚲</span><span class="v-name">${esc(m.venue.name)}</span></div>`:""}
  </article>`;
}

function skeletonCard(){
  return `<div class="card skel-card">
    <div class="skeleton skel-row"></div>
    <div class="skel-teams">
      <div><div class="skeleton skel-logo"></div><div class="skeleton skel-name"></div></div>
      <div class="skeleton skel-center"></div>
      <div><div class="skeleton skel-logo"></div><div class="skeleton skel-name"></div></div>
    </div>
    <div class="skeleton skel-venue"></div>
  </div>`;
}
function skeletonRow(n,cls){return `<div class="${cls}">${Array.from({length:n}).map(skeletonCard).join("")}</div>`}

function stateCard({icon,title,desc,actionLabel,action,ghost}){
  return `<div class="card state-card ${action?'error':''}">
    <div class="state-icon">${icon}</div>
    <div class="state-title">${esc(title)}</div>
    <div class="state-desc">${esc(desc)}</div>
    ${actionLabel?`<button class="btn ${ghost?'ghost':''}" data-action="${action}">${esc(actionLabel)}</button>`:""}
  </div>`;
}

function importantRows(rows){
  return [...rows]
    .filter(m=>TOP.has(m?.league?.id) || matchType(m)==="live")
    .sort((a,b)=>{
      const liveA=matchType(a)==="live"?0:1;
      const liveB=matchType(b)==="live"?0:1;
      if(liveA!==liveB)return liveA-liveB;
      const topA=TOP.has(a?.league?.id)?0:1;
      const topB=TOP.has(b?.league?.id)?0:1;
      if(topA!==topB)return topA-topB;
      return new Date(a?.date||0)-new Date(b?.date||0);
    })
    .slice(0,8);
}

function importantSection(rows){
  if(state.loading&&!state.matches.length){
    return `<section class="section" id="important">
      <div class="section-head"><div><small>${t("importantSub")}</small><h2>${t("important")}</h2></div></div>
      ${skeletonRow(3,"important-scroller")}
    </section>`;
  }
  const items=importantRows(rows);
  if(!items.length)return "";
  return `<section class="section" id="important">
    <div class="section-head"><div><small>${t("importantSub")}</small><h2>${t("important")}</h2></div><span class="link">${items.length}</span></div>
    <div class="important-scroller">${items.map(matchCard).join("")}</div>
  </section>`;
}

function leagueGroups(rows){
  const groups=new Map();
  rows.forEach(m=>{const k=`${m?.league?.id||0}-${m?.league?.name||""}`;(groups.get(k)||groups.set(k,[]).get(k)).push(m)});
  return [...groups.values()].sort((a,b)=>(TOP.has(a[0]?.league?.id)?0:1)-(TOP.has(b[0]?.league?.id)?0:1));
}

function leaguesRow(rows){
  const groups=leagueGroups(rows);
  if(!groups.length)return "";
  return `<section class="section" id="leagues">
    <div class="section-head"><div><h2>${t("importantLeagues")}</h2></div></div>
    <div class="leagues-row">${groups.map(g=>{
      const l=g[0]?.league||{};
      const anchor=`league-${l.id||0}`;
      const logo=l.logo?`<img src="${esc(l.logo)}" alt="" loading="lazy" onerror="this.style.display='none'">`:"";
      return `<a class="league-chip" href="#${anchor}" data-scroll="${anchor}">${logo}<span>${esc(l.name||t("leagues"))}</span></a>`;
    }).join("")}</div>
  </section>`;
}

function groupedMatchesList(rows){
  const groups=leagueGroups(rows);
  return groups.map(g=>{
    const l=g[0]?.league||{};
    const logo=l.logo?`<img src="${esc(l.logo)}" alt="" loading="lazy" onerror="this.style.display='none'">`:"";
    return `<div class="league-group" id="league-${l.id||0}">
      <div class="league-group-head">${logo}<div><h3>${esc(l.name||t("matches"))}</h3><small>${esc(l.country||"")}</small></div></div>
      <div class="grid grid-3">${g.map(matchCard).join("")}</div>
    </div>`;
  }).join("");
}

function todaySection(rows){
  const hasAnyData=state.matches.length>0;
  let body="";
  if(state.error&&!hasAnyData){
    body=stateCard({icon:"⚠",title:t("errorTitle"),desc:t("errorDesc"),actionLabel:t("retry"),action:"refresh"});
  }else if(state.loading&&!hasAnyData){
    body=skeletonRow(3,"grid grid-3");
  }else if(!state.loading&&!rows.length){
    body=stateCard({icon:"⚽",title:t("emptyTitle"),desc:state.query?t("emptySearch"):t("emptyDesc"),actionLabel:t("goToday"),action:"today",ghost:true});
  }
  const filters=[["all",t("all")],["live",t("live")],["scheduled",t("notStarted")],["finished",t("finished")]];
  const staleBanner=state.stale&&hasAnyData?`<div class="stale-banner">
      <span>⚠</span>
      <div class="stale-text">
        <b>${t("staleWarning")}</b>
        ${state.lastUpdated?`<small>${t("lastUpdated")}: ${timeLabel(state.lastUpdated)}</small>`:""}
      </div>
      <button class="btn ghost" data-action="refresh">${t("retryNow")}</button>
    </div>`:"";
  return `<div class="section" id="matches">
    <div class="section-head"><div><small>${t("today")}</small><h2>${t("matches")} — ${esc(dateLabel(state.date))}</h2></div><span class="link">${state.matches.length}</span></div>
    ${staleBanner}
    <div class="search-row">
      <span class="search-icon">⌕</span>
      <input class="input search-input" id="searchInput" value="${esc(state.query)}" placeholder="${t("searchPlaceholder")}">
    </div>
    <div class="filter-tabs" role="tablist">
      ${filters.map(([v,label])=>`<button class="filter-tab ${state.filter===v?"active":""}" data-filter="${v}">${esc(label)}</button>`).join("")}
    </div>
    ${body}
  </div>`;
}

/* ---------------- Render ---------------- */
function render(){
  const main=document.getElementById("main");
  if(!main)return;
  document.documentElement.lang=state.lang;
  document.documentElement.dir=state.lang==="ar"?"rtl":"ltr";
  document.documentElement.dataset.theme=localStorage.getItem("theme")||"dark";
  document.title=state.lang==="ar"?"كورة بلس | نتائج ومباريات كرة القدم":"Kora Plus | Football Scores";

  const rows=visible();
  const featured=importantRows(state.matches)[0];
  const today=localDate();
  const dayPos=state.date===today?"today":(state.date<today?"prev":"next");

  main.innerHTML=`
    <div class="date-nav-top" role="tablist" aria-label="${t("todayBtn")}">
      <button class="date-nav-btn ${dayPos==="prev"?"active":""}" data-action="prev">${t("previous")}</button>
      <button class="date-nav-btn ${dayPos==="today"?"active":""}" data-action="today">${t("todayBtn")}</button>
      <button class="date-nav-btn ${dayPos==="next"?"active":""}" data-action="next">${t("next")}</button>
    </div>

    <section class="hero" id="home">
      <div class="hero-inner">
        <div class="hero-grid-desktop">
          <div>
            <small class="hero-eyebrow">${t("heroEyebrow")}</small>
            <h1>${t("heroTitle")}</h1>
            <p>${t("heroDesc")}</p>
          </div>
          <div class="hero-featured">
            ${state.loading&&!featured&&!state.matches.length?`
              <div class="featured-card"><div class="skeleton skel-row" style="width:40%"></div>
                <div class="skel-teams" style="margin-top:14px">
                  <div><div class="skeleton skel-logo"></div><div class="skeleton skel-name"></div></div>
                  <div class="skeleton skel-center"></div>
                  <div><div class="skeleton skel-logo"></div><div class="skeleton skel-name"></div></div>
                </div>
              </div>`
            :featured?`
              <div class="featured-card">
                <div class="featured-top"><span>${esc(featured.league?.name||"")}</span><span>${esc(dateLabel(state.date))}</span></div>
                <div class="featured-teams">
                  <div>${featured.home?.logo?`<img class="team-logo" src="${esc(featured.home.logo)}" alt="" loading="lazy">`:""}<div class="team-name">${esc(featured.home?.name||"—")}</div></div>
                  <div class="featured-center">
                    <div class="score-big">${featured.goals?.home==null&&featured.goals?.away==null?(state.lang==="ar"?"ضد":"vs"):`${featured.goals?.home??0} - ${featured.goals?.away??0}`}</div>
                    <small>${esc(statusLabel(featured))}</small>
                  </div>
                  <div>${featured.away?.logo?`<img class="team-logo" src="${esc(featured.away.logo)}" alt="" loading="lazy">`:""}<div class="team-name">${esc(featured.away?.name||"—")}</div></div>
                </div>
              </div>`
            :`<div class="featured-card" style="text-align:center;color:#cfe0fb;font-size:13px;padding:20px 0">${t("emptyDesc")}</div>`}
          </div>
        </div>
      </div>
    </section>

    ${importantSection(state.matches)}
    ${todaySection(rows)}
    ${rows.length?leaguesRow(rows):""}
    ${rows.length?`<div>${groupedMatchesList(rows)}</div>`:""}
  `;

  main.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.action;
    if(a==="prev"||a==="next"){state.date=shiftDate(state.date,a==="next"?1:-1);state.matches=[];state.error="";load().then(queueNextRefresh)}
    else if(a==="today"){state.date=localDate();state.matches=[];state.error="";load().then(queueNextRefresh)}
    else load({force:true}).then(queueNextRefresh);
  });
  main.querySelectorAll("[data-scroll]").forEach(a=>a.addEventListener("click",e=>{
    e.preventDefault();
    document.getElementById(a.dataset.scroll)?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  const search=main.querySelector("#searchInput");
  if(search)search.oninput=e=>{
    const pos=e.target.value.length;
    state.query=e.target.value;
    render();
    const next=main.querySelector("#searchInput");
    if(next){next.focus();next.setSelectionRange(pos,pos)}
  };
  main.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
}

/* ---------------- Chrome (theme / search / nav) ---------------- */
document.getElementById("themeBtn")?.addEventListener("click",()=>{
  const next=(document.documentElement.dataset.theme||"dark")==="dark"?"light":"dark";
  document.documentElement.dataset.theme=next;localStorage.setItem("theme",next);
});
document.getElementById("searchBtn")?.addEventListener("click",()=>{
  document.getElementById("matches")?.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>document.getElementById("searchInput")?.focus(),350);
});

function setActiveRoute(route){
  document.querySelectorAll("[data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===route));
}
function navigateRoute(route){
  setActiveRoute(route);
  const top=()=>window.scrollTo({top:0,behavior:"smooth"});
  if(route==="home"){top();return}
  if(route==="search"){
    document.getElementById("matches")?.scrollIntoView({behavior:"smooth",block:"start"});
    setTimeout(()=>document.getElementById("searchInput")?.focus(),350);
    return;
  }
  if(route==="matches"){document.getElementById("matches")?.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(route==="leagues"){document.getElementById("leagues")?.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(route==="standings"){document.getElementById("standings")?.scrollIntoView({behavior:"smooth",block:"start"});return}
  top();
}
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-route]");
  if(!a)return;
  e.preventDefault();
  navigateRoute(a.dataset.route);
});
setActiveRoute("home");

if(!localStorage.getItem("theme"))localStorage.setItem("theme","dark");
window.addEventListener("online",()=>load({force:true}));

/* Adaptive live-score polling, aligned with the Worker's cache window so
   polling faster than that would just re-read the same cached response:
   fast-ish while a live match is on screen, moderate while viewing today,
   slow for other days, paused while the tab is hidden. On repeated
   failures (e.g. upstream rate-limit) the delay backs off automatically
   instead of hammering a struggling API. */
let refreshTimer=null;
function nextRefreshDelay(){
  const hasLive=state.matches.some(m=>matchType(m)==="live");
  const isToday=state.date===localDate();
  let base=hasLive?90000:isToday?300000:900000;
  if(consecutiveFailures>0)base=Math.min(base*Math.pow(2,Math.min(consecutiveFailures,4)),1800000);
  return base;
}
function queueNextRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{
    if(document.visibilityState==="visible")await load({force:true});
    queueNextRefresh();
  },nextRefreshDelay());
}
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible")load({force:true}).then(queueNextRefresh);
});

load().then(queueNextRefresh);
