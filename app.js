import { api } from "./api.js";

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const main = $("#main");
const toast = $("#toast");

const state = {
  route: location.hash.replace("#","") || "home",
  selectedDate: localISODate(),
  matchTab: "summary",
  match: null,
  matches: [],
  leagues: [],
  liveTimer: null
};

function localISODate(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0,10);
}
function esc(v="") {
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function logo(url, alt="") {
  return url ? `<img class="team-logo" src="${esc(url)}" alt="${esc(alt)}" loading="lazy">` : `<div class="team-logo"></div>`;
}
function fmtTime(date) {
  try { return new Intl.DateTimeFormat("ar-EG",{hour:"2-digit",minute:"2-digit"}).format(new Date(date)); }
  catch { return "--:--"; }
}
function statusClass(short) {
  if (["1H","2H","ET","P","BT","HT"].includes(short)) return "live";
  if (["FT","AET","PEN"].includes(short)) return "done";
  return "";
}
function statusText(f) {
  const s = f?.fixture?.status;
  if (!s) return "غير معروف";
  if (s.short === "NS") return fmtTime(f.fixture.date);
  if (s.short === "1H" || s.short === "2H") return `${s.elapsed ?? ""}'`;
  return s.long || s.short;
}
function isLive(f) { return ["1H","2H","ET","P","BT","HT"].includes(f?.fixture?.status?.short); }

function setActiveNav() {
  $$("[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === state.route));
}

function skeleton(count=4) {
  return `<div class="grid grid-4">${Array.from({length:count},()=>`<div class="card skeleton skel-card"></div>`).join("")}</div>`;
}
function empty(msg="لا توجد بيانات متاحة حاليًا") {
  return `<div class="card empty">${esc(msg)}</div>`;
}
function errorBox(err) {
  let msg = err?.status === 429 ? "تم الوصول إلى حد طلبات API. حاول بعد قليل."
    : /Network/i.test(err?.message||"") ? "تعذر الاتصال بالخادم. تحقق من الشبكة."
    : err?.message || "حدث خطأ غير متوقع.";
  return `<div class="card empty error"><strong>تعذر تحميل البيانات</strong><p>${esc(msg)}</p><button class="tab" onclick="location.reload()">إعادة المحاولة</button></div>`;
}
function showToast(msg) {
  toast.textContent = msg; toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),2400);
}

function matchCard(f) {
  const h=f.teams?.home||{}, a=f.teams?.away||{}, g=f.goals||{};
  return `<article class="card match-card" data-match="${f.fixture.id}">
    <div class="match-meta"><span>${esc(f.league?.name||"بطولة")}</span><span class="status ${statusClass(f.fixture.status?.short)}">${esc(statusText(f))}</span></div>
    <div class="match-teams">
      <div>${logo(h.logo,h.name)}<div class="team-name">${esc(h.name)}</div></div>
      <div><div class="match-score">${g.home ?? "-"} : ${g.away ?? "-"}</div><div class="small-muted">${esc(f.fixture.status?.short||"")}</div></div>
      <div>${logo(a.logo,a.name)}<div class="team-name">${esc(a.name)}</div></div>
    </div>
  </article>`;
}
function bindMatchCards(root=document) {
  $$(".match-card",root).forEach(c => c.addEventListener("click",()=>navigate(`match/${c.dataset.match}`)));
}

async function renderHome() {
  main.innerHTML = `<section class="hero">
    <div class="hero-grid">
      <div><div class="small-muted" style="color:#a8cfff">منصة كرة القدم</div><h1>كل المباريات في مكان واحد</h1>
      <p>نتائج مباشرة، تفاصيل المباريات، التشكيلات، الإحصائيات والترتيب — ببيانات حقيقية من مزود الـAPI.</p>
      <a class="tab" style="display:inline-block;background:white;color:#0b4eb4;border:0" href="#matches">عرض مباريات اليوم</a></div>
      <div id="featured" class="featured">${skeleton(1)}</div>
    </div>
  </section>
  <div class="section"><div class="ad-slot">مساحة إعلانية — أعلى الصفحة</div></div>
  <section class="section"><div class="section-head"><h2>مباريات مباشرة</h2><a class="link" href="#matches">كل المباريات</a></div><div id="liveHome">${skeleton()}</div></section>
  <section class="section"><div class="section-head"><h2>مباريات اليوم</h2><a class="link" href="#matches">التفاصيل</a></div><div id="todayHome">${skeleton()}</div></section>`;

  try {
    const live = await api.getLiveMatches();
    const today = await api.getFixtures({date:state.selectedDate});
    const liveList = live?.response || [];
    const todayList = today?.response || [];
    $("#liveHome").innerHTML = liveList.length ? `<div class="grid grid-4">${liveList.slice(0,8).map(matchCard).join("")}</div>` : empty("لا توجد مباريات مباشرة حاليًا");
    $("#todayHome").innerHTML = todayList.length ? `<div class="grid grid-4">${todayList.slice(0,8).map(matchCard).join("")}</div>` : empty();
    const featured = liveList[0] || todayList[0];
    $("#featured").innerHTML = featured ? `<div class="small-muted" style="color:#dcecff">${esc(featured.league?.name||"أبرز مباراة")}</div>
      <div class="featured-teams" style="margin-top:14px">
        <div>${logo(featured.teams.home.logo,featured.teams.home.name)}<div>${esc(featured.teams.home.name)}</div></div>
        <div><div class="score-big">${featured.goals.home ?? "-"} : ${featured.goals.away ?? "-"}</div><span class="status ${statusClass(featured.fixture.status.short)}">${esc(statusText(featured))}</span></div>
        <div>${logo(featured.teams.away.logo,featured.teams.away.name)}<div>${esc(featured.teams.away.name)}</div></div>
      </div>` : empty("لا توجد مباراة بارزة حاليًا");
    bindMatchCards(main);
    startLiveRefresh();
  } catch(e) {
    $("#liveHome").innerHTML=errorBox(e); $("#todayHome").innerHTML="";
    $("#featured").innerHTML=empty("لا توجد بيانات متاحة حاليًا");
  }
}

function startLiveRefresh() {
  clearInterval(state.liveTimer);
  state.liveTimer = setInterval(async ()=>{
    if (state.route !== "home" && !state.route.startsWith("match/")) return;
    try {
      if (state.route === "home") {
        const live = await api.getLiveMatches({}, {force:true});
        const list = live?.response || [];
        const box=$("#liveHome");
        if(box) { box.innerHTML = list.length ? `<div class="grid grid-4">${list.slice(0,8).map(matchCard).join("")}</div>` : empty("لا توجد مباريات مباشرة حاليًا"); bindMatchCards(box); }
      }
    } catch {}
  },15000);
}

async function renderMatches() {
  main.innerHTML = `<div class="section-head"><h1 style="margin:0">المباريات</h1></div>
    <div class="toolbar">
      <button class="tab active" data-day="today">اليوم</button><button class="tab" data-day="yesterday">أمس</button><button class="tab" data-day="tomorrow">غدًا</button>
      <input class="input" id="matchDate" type="date" value="${state.selectedDate}">
      <select class="select" id="statusFilter"><option value="all">كل الحالات</option><option value="live">مباشر</option><option value="done">انتهت</option><option value="upcoming">قادمة</option></select>
    </div>
    <div class="ad-slot">مساحة إعلانية — بين أقسام المباريات</div>
    <section class="section"><div id="matchesList">${skeleton()}</div></section>`;
  const load = async () => {
    const box=$("#matchesList"); box.innerHTML=skeleton();
    try {
      const data=await api.getFixtures({date:state.selectedDate});
      state.matches=data?.response||[];
      drawMatches();
    } catch(e) { box.innerHTML=errorBox(e); }
  };
  const setDate = d => { state.selectedDate=localISODate(d); $("#matchDate").value=state.selectedDate; load(); };
  $$("[data-day]").forEach(b=>b.onclick=()=>{
    const n=b.dataset.day;
    const d=new Date(); if(n==="yesterday") d.setDate(d.getDate()-1); if(n==="tomorrow") d.setDate(d.getDate()+1);
    setDate(d); $$("[data-day]").forEach(x=>x.classList.toggle("active",x===b));
  });
  $("#matchDate").onchange=e=>setDate(new Date(`${e.target.value}T12:00:00`));
  $("#statusFilter").onchange=drawMatches;
  await load();
}
function drawMatches() {
  const filter=$("#statusFilter")?.value||"all";
  let list=state.matches;
  if(filter==="live") list=list.filter(isLive);
  if(filter==="done") list=list.filter(f=>["FT","AET","PEN"].includes(f.fixture.status.short));
  if(filter==="upcoming") list=list.filter(f=>["NS","TBD"].includes(f.fixture.status.short));
  $("#matchesList").innerHTML=list.length ? `<div class="grid grid-4">${list.map(matchCard).join("")}</div>` : empty();
  bindMatchCards($("#matchesList"));
}

async function renderMatch(id) {
  main.innerHTML=`<div id="matchPage">${skeleton(2)}</div>`;
  try {
    const d=await api.getMatchDetails(id);
    const f=d?.response?.[0];
    if(!f) { main.innerHTML=empty("المباراة غير موجودة"); return; }
    state.match=f;
    const h=f.teams.home,a=f.teams.away,g=f.goals||{};
    main.innerHTML=`<section class="card match-header">
      <div class="small-muted">${esc(f.league?.name||"")} · ${esc(f.fixture?.venue?.name||"الملعب غير متاح")}</div>
      <div class="teams" style="margin-top:20px">
        <div>${logo(h.logo,h.name)}<div class="team-title">${esc(h.name)}</div></div>
        <div><div class="match-result">${g.home??"-"} : ${g.away??"-"}</div><div class="status ${statusClass(f.fixture.status.short)}">${esc(statusText(f))}</div><div class="match-info">${esc(new Date(f.fixture.date).toLocaleString("ar-EG"))}</div></div>
        <div>${logo(a.logo,a.name)}<div class="team-title">${esc(a.name)}</div></div>
      </div>
    </section>
    <div class="section tabs" id="matchTabs">
      ${["summary","events","lineups","stats","standings","h2h","players","predictions"].map((x,i)=>`<button class="tab ${i===0?"active":""}" data-tab="${x}">${["ملخص","الأحداث","التشكيلة","الإحصائيات","الترتيب","المواجهات","اللاعبون","التوقعات"][i]}</button>`).join("")}
    </div>
    <div id="matchContent">${skeleton(2)}</div>`;
    $$("#matchTabs .tab").forEach(b=>b.onclick=()=>{state.matchTab=b.dataset.tab;$$("#matchTabs .tab").forEach(x=>x.classList.toggle("active",x===b));loadMatchTab(id,b.dataset.tab);});
    await loadMatchTab(id,"summary");
    if(isLive(f)) startLiveRefresh();
  } catch(e) { $("#matchPage").innerHTML=errorBox(e); }
}

async function loadMatchTab(id, tab) {
  const box=$("#matchContent"); if(!box)return;
  box.innerHTML=skeleton(2);
  try {
    if(tab==="summary") {
      const [ev,st]=await Promise.allSettled([api.getMatchEvents(id),api.getMatchStatistics(id)]);
      const events=ev.status==="fulfilled"?(ev.value?.response||[]):[];
      const stats=st.status==="fulfilled"?(st.value?.response||[]):[];
      box.innerHTML=`<div class="grid grid-2">
        <div class="card"><h3>آخر الأحداث</h3>${events.length?eventHTML(events.slice(-8).reverse(),state.match):empty()}</div>
        <div class="card"><h3>الإحصائيات</h3>${stats.length?statsHTML(stats):empty("لا توجد إحصائيات متاحة حاليًا")}</div>
      </div>`;
    } else if(tab==="events") {
      const d=await api.getMatchEvents(id); box.innerHTML=`<div class="card"><h3>Timeline المباراة</h3>${d?.response?.length?eventHTML(d.response,state.match):empty()}</div>`;
    } else if(tab==="lineups") {
      const d=await api.getLineups(id); box.innerHTML=renderLineups(d?.response||[]);
    } else if(tab==="stats") {
      const d=await api.getMatchStatistics(id); box.innerHTML=`<div class="card"><h3>إحصائيات المباراة</h3>${d?.response?.length?statsHTML(d.response):empty("لا توجد إحصائيات متاحة حاليًا")}</div>`;
    } else if(tab==="standings") {
      const d=await api.getStandings(state.match.league.id,state.match.league.season);
      box.innerHTML=standingsHTML(d?.response?.[0]?.league?.standings||[]);
    } else if(tab==="h2h") {
      const h=state.match.teams.home.id,a=state.match.teams.away.id;
      const d=await api.getHeadToHead(`${h}-${a}`); const list=d?.response||[];
      box.innerHTML=list.length?`<div class="grid grid-3">${list.slice(0,10).map(matchCard).join("")}</div>`:empty();
      bindMatchCards(box);
    } else if(tab==="players") {
      const d=await fetchPlayersForMatch(id); box.innerHTML=playersHTML(d);
    } else if(tab==="predictions") {
      const d=await api.getPredictions(id); box.innerHTML=predictionHTML(d?.response?.[0]);
    }
  } catch(e) { box.innerHTML=errorBox(e); }
}
async function fetchPlayersForMatch(id) {
  return (await api.getMatchDetails(id))?.response?.[0]?.players || [];
}
function eventHTML(events,f) {
  return `<div class="event-list">${events.map(e=>{
    const icon=e.type==="Goal"?"⚽":e.type==="Card"?"🟨":"↔";
    const who=e.player?.name||"حدث"; const team=e.team?.id===f.teams.home.id?f.teams.home.name:f.teams.away.name;
    return `<div class="event"><div class="event-time">${e.time?.elapsed??""}'${e.time?.extra?`+${e.time.extra}`:""}</div><div class="event-center"><span class="event-icon">${icon}</span><div><b>${esc(who)}</b><div class="small-muted">${esc(e.detail||e.type)} · ${esc(team)}</div></div></div><div></div></div>`;
  }).join("")}</div>`;
}
function statsHTML(stats) {
  const a=stats[0]?.statistics||[], b=stats[1]?.statistics||[];
  const map=new Map(b.map(x=>[x.type,x.value]));
  return `<div class="stats">${a.map(x=>{
    const av=parseNum(x.value), bv=parseNum(map.get(x.type)), total=(av||0)+(bv||0);
    const ap=total?Math.round(av/total*100):50, bp=100-ap;
    return `<div class="stat-row"><div><b>${esc(x.value??"-")}</b></div><div class="small-muted">${esc(x.type)}</div><div><b>${esc(map.get(x.type)??"-")}</b></div>
      <div></div><div class="bar"><i style="width:${ap}%"></i></div><div></div></div>`;
  }).join("")}</div>`;
}
function parseNum(v){const n=parseFloat(String(v??"").replace("%",""));return Number.isFinite(n)?n:0;}
function renderLineups(list) {
  if(!list.length) return empty("لا توجد تشكيلات متاحة حاليًا");
  return `<div class="grid grid-2">${list.map(x=>{
    const players=x.startXI||[];
    const formation=x.formation||"";
    const rows=groupFormation(players,formation);
    return `<div class="card"><div class="section-head"><h3>${esc(x.team?.name||"")}</h3><span class="status">${esc(formation)}</span></div>
      <div class="lineup-pitch"><div class="lineup-grid">${rows.map(r=>`<div class="line">${r.map(p=>`<div class="player-dot"><span>${esc(p.number??"")}</span><small>${esc(p.player?.name||"")}</small></div>`).join("")}</div>`).join("")}</div></div>
      <div class="small-muted" style="margin-top:12px">البدلاء: ${esc((x.substitutes||[]).slice(0,8).map(p=>p.player?.name).filter(Boolean).join("، ")||"غير متاح")}</div>
      <div class="small-muted">المدرب: ${esc(x.coach?.name||"غير متاح")}</div>
    </div>`;
  }).join("")}</div>`;
}
function groupFormation(players,formation) {
  const nums=(formation||"4-3-3").split("-").map(Number).filter(Boolean);
  const out=[players.filter(p=>p.player?.pos==="G").slice(0,1)];
  let remaining=players.filter(p=>p.player?.pos!=="G");
  for(const n of nums){out.push(remaining.splice(0,n));}
  if(remaining.length) out.push(remaining);
  return out.filter(x=>x.length);
}
function standingsHTML(groups) {
  const rows=groups.flat();
  if(!rows.length)return empty();
  return `<div class="card"><div class="table-wrap"><table><thead><tr><th>#</th><th>الفريق</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th><th>فارق</th><th>نقاط</th><th>آخر 5</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rank??"-"}</td><td style="text-align:right">${logo(r.team?.logo,r.team?.name)} ${esc(r.team?.name||"")}</td><td>${r.all?.played??"-"}</td><td>${r.all?.win??"-"}</td><td>${r.all?.draw??"-"}</td><td>${r.all?.lose??"-"}</td><td>${r.all?.goals?.for??"-"}</td><td>${r.all?.goals?.against??"-"}</td><td>${r.goalsDiff??"-"}</td><td><b>${r.points??"-"}</b></td><td><div class="form">${String(r.form||"").slice(-5).split("").map(x=>`<i class="${x.toLowerCase()}"></i>`).join("")}</div></td></tr>`).join("")}</tbody></table></div></div>`;
}
function playersHTML(list) {
  if(!list.length)return empty("لا توجد بيانات لاعبين متاحة حاليًا");
  const arr=list.flatMap(x=>x.players||[]).slice(0,40);
  return arr.length?`<div class="grid grid-3">${arr.map(p=>`<div class="card player-card">${p.player?.photo?`<img class="player-photo" src="${esc(p.player.photo)}" alt="${esc(p.player.name)}" loading="lazy">`:"<div class='player-photo'></div>"}<div><b>${esc(p.player?.name||"")}</b><div class="small-muted">${esc(p.player?.position||"")} · ${esc(p.player?.nationality||"")}</div><div class="small-muted">التقييم: ${esc(p.statistics?.[0]?.games?.rating||"-")}</div></div></div>`).join("")}</div>`:empty();
}
function predictionHTML(p) {
  if(!p)return empty("لا توجد توقعات متاحة حاليًا");
  const pct=p.predictions?.percent||{};
  return `<div class="grid grid-3"><div class="card"><div class="small-muted">الفائز المتوقع</div><h2>${esc(p.predictions?.winner?.name||"غير متاح")}</h2><p>${esc(p.predictions?.advice||"")}</p></div>
  <div class="card"><div class="small-muted">الاحتمالات</div><p>المضيف: <b>${esc(pct.home||"-")}</b></p><p>تعادل: <b>${esc(pct.draw||"-")}</b></p><p>الضيف: <b>${esc(pct.away||"-")}</b></p></div>
  <div class="card"><div class="small-muted">التوقع</div><h2>${esc(p.predictions?.under_over||"-")}</h2></div></div>`;
}

async function renderLeagues() {
  main.innerHTML=`<div class="section-head"><h1>البطولات</h1></div><div class="toolbar"><input id="leagueSearch" class="input" placeholder="ابحث عن بطولة..." minlength="3"></div><div id="leagueList">${skeleton()}</div>`;
  const load=async(search="")=>{
    $("#leagueList").innerHTML=skeleton();
    try {
      const d=await api.getLeagues(search?{search}:{current:true});
      state.leagues=d?.response||[];
      $("#leagueList").innerHTML=state.leagues.length?`<div class="grid grid-3">${state.leagues.slice(0,60).map(l=>`<article class="card league-card"><img class="league-logo" src="${esc(l.league?.logo||"")}" alt="" loading="lazy"><div><b>${esc(l.league?.name||"")}</b><div class="small-muted">${esc(l.country?.name||"")}</div><div class="small-muted">الموسم: ${esc(l.seasons?.at(-1)?.year||"")}</div></div></article>`).join("")}</div>`:empty();
    }catch(e){$("#leagueList").innerHTML=errorBox(e);}
  };
  await load();
  let t; $("#leagueSearch").oninput=e=>{clearTimeout(t);const q=e.target.value.trim();t=setTimeout(()=>q.length>=3?load(q):load(),350);};
}
async function renderStandings() {
  main.innerHTML=`<div class="section-head"><h1>جدول الترتيب</h1></div><div class="toolbar"><input id="leagueId" class="input" type="number" placeholder="League ID مثال 39"><input id="season" class="input" type="number" value="${new Date().getFullYear()-1}"><button class="tab" id="loadStandings">عرض الترتيب</button></div><div id="standingBox">${empty("أدخل League ID والموسم لعرض الترتيب")}</div>`;
  $("#loadStandings").onclick=async()=>{
    const league=$("#leagueId").value,season=$("#season").value;
    if(!league||!season)return showToast("أدخل رقم البطولة والموسم");
    $("#standingBox").innerHTML=skeleton(1);
    try{const d=await api.getStandings(league,season);$("#standingBox").innerHTML=standingsHTML(d?.response?.[0]?.league?.standings||[]);}
    catch(e){$("#standingBox").innerHTML=errorBox(e);}
  };
}
async function renderTeams() {
  main.innerHTML=`<div class="section-head"><h1>الفرق</h1></div><div class="toolbar"><input id="teamSearch" class="input" placeholder="ابحث عن فريق..." minlength="3"></div><div id="teamList">${skeleton()}</div>`;
  const load=async q=>{
    $("#teamList").innerHTML=skeleton();
    try{const d=await api.getTeams({search:q});const arr=d?.response||[];$("#teamList").innerHTML=arr.length?`<div class="grid grid-3">${arr.map(x=>`<article class="card league-card"><img class="league-logo" src="${esc(x.team?.logo||"")}" alt="" loading="lazy"><div><b>${esc(x.team?.name||"")}</b><div class="small-muted">${esc(x.team?.country||"")}</div><div class="small-muted">${esc(x.venue?.name||"")}</div></div></article>`).join("")}</div>`:empty("اكتب اسم فريق للبحث");}
    catch(e){$("#teamList").innerHTML=errorBox(e);}
  };
  $("#teamSearch").oninput=e=>{clearTimeout(renderTeams.t);const q=e.target.value.trim();renderTeams.t=setTimeout(()=>q.length>=3?load(q):($("#teamList").innerHTML=empty("اكتب اسم فريق للبحث")),350);};
  $("#teamList").innerHTML=empty("اكتب اسم فريق للبحث");
}
async function renderPlayers() {
  main.innerHTML=`<div class="section-head"><h1>اللاعبين</h1></div><div class="toolbar"><input id="playerSearch" class="input" placeholder="ابحث عن لاعب..." minlength="3"></div><div id="playerList">${empty("اكتب اسم لاعب للبحث")}</div>`;
  $("#playerSearch").oninput=e=>{
    clearTimeout(renderPlayers.t);const q=e.target.value.trim();
    renderPlayers.t=setTimeout(async()=>{
      if(q.length<3){$("#playerList").innerHTML=empty("اكتب اسم لاعب للبحث");return;}
      $("#playerList").innerHTML=skeleton(3);
      try{const d=await api.searchPlayers(q);const arr=d?.response||[];$("#playerList").innerHTML=arr.length?`<div class="grid grid-3">${arr.map(x=>`<article class="card player-card"><img class="player-photo" src="${esc(x.player?.photo||"")}" alt="" loading="lazy"><div><b>${esc(x.player?.name||"")}</b><div class="small-muted">${esc(x.player?.nationality||"")} · ${esc(x.player?.age||"-")} سنة</div><div class="small-muted">${esc(x.player?.position||"")}</div></div></article>`).join("")}</div>`:empty("لا توجد بيانات متاحة حاليًا");}
      catch(e){$("#playerList").innerHTML=errorBox(e);}
    },350);
  };
}
function renderSearch() {
  main.innerHTML=`<div class="section-head"><h1>بحث</h1></div><div class="card"><input id="globalSearch" class="input" style="width:100%" placeholder="فريق، لاعب أو بطولة..." minlength="3"><div id="searchResults" class="search-results" style="margin-top:12px">${empty("ابدأ بكتابة 3 أحرف على الأقل")}</div></div>`;
  let timer;
  $("#globalSearch").oninput=e=>{
    clearTimeout(timer);const q=e.target.value.trim();if(q.length<3){$("#searchResults").innerHTML=empty("ابدأ بكتابة 3 أحرف على الأقل");return;}
    timer=setTimeout(()=>globalSearch(q),350);
  };
}
async function globalSearch(q) {
  $("#searchResults").innerHTML=skeleton(2);
  try{
    const [teams,players,leagues]=await Promise.allSettled([api.searchTeams(q),api.searchPlayers(q),api.searchLeagues(q)]);
    const t=teams.status==="fulfilled"?(teams.value?.response||[]):[], p=players.status==="fulfilled"?(players.value?.response||[]):[], l=leagues.status==="fulfilled"?(leagues.value?.response||[]):[];
    const html=[...t.slice(0,5).map(x=>`<div class="search-item">${logo(x.team?.logo,x.team?.name)}<div><b>${esc(x.team?.name)}</b><div class="small-muted">فريق · ${esc(x.team?.country||"")}</div></div></div>`),
      ...p.slice(0,5).map(x=>`<div class="search-item"><img class="player-photo" src="${esc(x.player?.photo||"")}" alt=""><div><b>${esc(x.player?.name)}</b><div class="small-muted">لاعب · ${esc(x.player?.nationality||"")}</div></div></div>`),
      ...l.slice(0,5).map(x=>`<div class="search-item">${logo(x.league?.logo,x.league?.name)}<div><b>${esc(x.league?.name)}</b><div class="small-muted">بطولة · ${esc(x.country?.name||"")}</div></div></div>`)];
    $("#searchResults").innerHTML=html.length?html.join(""):empty("لا توجد نتائج مطابقة");
  }catch(e){$("#searchResults").innerHTML=errorBox(e);}
}

async function route() {
  clearInterval(state.liveTimer);
  state.route=location.hash.replace("#","")||"home"; setActiveNav();
  const [base,id]=state.route.split("/");
  if(base==="home") return renderHome();
  if(base==="matches") return renderMatches();
  if(base==="match" && id) return renderMatch(id);
  if(base==="leagues") return renderLeagues();
  if(base==="standings") return renderStandings();
  if(base==="teams") return renderTeams();
  if(base==="players") return renderPlayers();
  if(base==="search") return renderSearch();
  navigate("home");
}
function navigate(r){location.hash=r;}
$("#themeBtn").onclick=()=>{
  const dark=document.documentElement.dataset.theme==="dark";
  document.documentElement.dataset.theme=dark?"light":"dark";
  localStorage.setItem("kp-theme",dark?"light":"dark");
};
$("#searchBtn").onclick=()=>navigate("search");
const savedTheme=localStorage.getItem("kp-theme")||"light";
document.documentElement.dataset.theme=savedTheme;
window.addEventListener("hashchange",route);
route();
