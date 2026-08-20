/* ---------------- i18n ---------------- */
const DICT = {
  ar: {
    brand: "كورة لايف",
    eyebrow_hero: "لوحة النتائج المباشرة",
    hero_title: "نتائج مباريات كرة القدم، لحظة بلحظة.",
    hero_desc: "تابع مباريات اليوم والنتائج المباشرة من مصدر بيانات رياضي موثوق.",
    hero_stat_label: "مباراة اليوم",
    live_now: "مباراة مباشرة الآن",
    date_label: "التاريخ",
    today: "اليوم",
    search_placeholder: "ابحث عن فريق...",
    section_eyebrow: "مركز المباريات",
    section_title: "مباريات اليوم",
    filter_all: "الكل",
    filter_live: "مباشر",
    filter_scheduled: "لم تبدأ",
    filter_finished: "انتهت",
    state_loading: "جاري تحميل المباريات...",
    state_empty: "لا توجد مباريات مطابقة لهذا البحث أو الفلتر.",
    state_empty_favorites: "مفيش بطولات مفضلة لسه. دوس على ⭐ جنب أي بطولة عشان تضيفها.",
    scope_all: "الكل",
    scope_favorites: "المفضلة",
    scope_top: "أهم المباريات",
    state_error: "تعذّر تحميل المباريات، حاول مرة أخرى.",
    status_live: "مباشر",
    status_finished: "انتهت",
    venue_label: "الملعب",
    referee_label: "الحكم",
    footer_tag: "منصة نتائج مباريات كرة القدم مباشرة",
    theme_toggle: "تبديل المظهر",
    lang_toggle: "English",
    league_fallback: "بطولة",
    team_fallback: "الفريق",
  },
  en: {
    brand: "Kora Live",
    eyebrow_hero: "LIVE SCOREBOARD",
    hero_title: "Football scores, live.",
    hero_desc: "Follow today's fixtures and live scores from a trusted sports data source.",
    hero_stat_label: "matches today",
    live_now: "matches live now",
    date_label: "Date",
    today: "Today",
    search_placeholder: "Search a team...",
    section_eyebrow: "MATCH CENTER",
    section_title: "Today's Fixtures",
    filter_all: "All",
    filter_live: "Live",
    filter_scheduled: "Upcoming",
    filter_finished: "Finished",
    state_loading: "Loading fixtures…",
    state_empty: "No matches for this search or filter.",
    state_empty_favorites: "No favorite leagues yet. Tap ⭐ next to a league to add it.",
    scope_all: "All",
    scope_favorites: "Favorites",
    scope_top: "Top matches",
    state_error: "Couldn't load fixtures, please try again.",
    status_live: "LIVE",
    status_finished: "FT",
    venue_label: "Venue",
    referee_label: "Referee",
    footer_tag: "Live football scores platform",
    theme_toggle: "Toggle theme",
    lang_toggle: "العربية",
    league_fallback: "League",
    team_fallback: "Team",
  }
};

const TOP_LEAGUE_IDS = [
  2, 3, 848,       // UEFA Champions League, Europa League, Conference League
  39, 40,          // Premier League, Championship
  140, 141,        // La Liga, La Liga 2
  135, 136,        // Serie A, Serie B
  78, 79,          // Bundesliga, 2. Bundesliga
  61, 62,          // Ligue 1, Ligue 2
  88, 94, 203,     // Eredivisie, Primeira Liga, Super Lig
  307,             // Saudi Pro League
  233,             // Egyptian Premier League
  1, 4, 9, 32      // World Cup, Euro, Copa America, World Cup Qualifiers
];

const state = {
  lang: localStorage.getItem("lang") || "ar",
  date: localDate(),
  filter: "all",
  scope: "all",
  query: "",
  matches: [],
  favLeagues: JSON.parse(localStorage.getItem("favLeagues") || "[]")
};

function t(key) {
  return DICT[state.lang][key] || DICT.ar[key] || key;
}

function applyLang() {
  const dir = state.lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = state.lang;
  document.documentElement.dir = dir;
  document.title = state.lang === "ar"
    ? "كورة لايف | نتائج مباريات كرة القدم"
    : "Kora Live | Football Scores";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });

  document.getElementById("selectedDate").textContent = formatDate(state.date);
  updateDateButtons();
}

/* ---------------- Date helpers ---------------- */
function localDate(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const get = t => parts.find(x => x.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(date) {
  const locale = state.lang === "ar" ? "ar-EG" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long"
  }).format(new Date(`${date}T12:00:00`));
}

function updateDateButtons() {
  const prev = document.querySelector("#prevDay small");
  const next = document.querySelector("#nextDay small");
  if (prev) prev.textContent = formatShortDate(shiftDate(state.date,-1));
  if (next) next.textContent = formatShortDate(shiftDate(state.date,1));
  const today = document.getElementById("todayBtn");
  today.classList.toggle("active", state.date === localDate());
  document.getElementById("prevDay").classList.toggle("active", state.date !== localDate());
  document.getElementById("nextDay").classList.toggle("active", false);
}
function formatShortDate(date) {
  return new Intl.DateTimeFormat(state.lang === "ar" ? "ar-EG" : "en-GB", {timeZone:"Africa/Cairo",day:"numeric",month:"short"}).format(new Date(`${date}T12:00:00`));
}

function formatTime(iso) {
  const locale = state.lang === "ar" ? "ar-EG" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}

/* ---------------- Utils ---------------- */
function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function statusType(s) {
  const live = ["1H", "2H", "ET", "BT", "P", "LIVE", "HT"];
  const finished = ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD"];
  if (live.includes(s)) return "live";
  if (finished.includes(s)) return "finished";
  return "scheduled";
}

function isFriendlyMatch(m) {
  const text = `${m.league?.name || ""} ${m.league?.type || ""} ${m.league?.country || ""}`.toLowerCase();
  return /friend|friendly|amistoso|amical|club friendly|international friendly|مباراة ودية|وديات/.test(text);
}

function displayLeagueName(m) {
  if (isFriendlyMatch(m)) return state.lang === "ar" ? "مباريات ودية" : "Friendlies";
  return m.league?.name || t("league_fallback");
}

function statusLabel(m) {
  const type = statusType(m.status.short);
  if (type === "live") return `● ${m.status.elapsed ? m.status.elapsed + "'" : t("status_live")}`;
  if (type === "finished") return t("status_finished");
  return formatTime(m.date);
}

/* ---------------- Data loading ---------------- */
let apiClientPromise;
function getApiClient() {
  return apiClientPromise || (apiClientPromise = import("./api.js").then(m => m.api));
}

async function loadMatches(options = {}) {
  const stateEl = document.getElementById("state");
  const hadMatches = state.matches.length > 0;
  const requestedDate = state.date;

  // Do not clear the existing cards while refreshing.
  if (!hadMatches) {
    stateEl.textContent = t("state_loading");
    stateEl.style.display = "block";
  }

  try {
    const api = await getApiClient();
    const data = await api.getFixtures({ date: requestedDate }, { force: options.force === true });
    const freshMatches = Array.isArray(data?.response)
      ? data.response
      : Array.isArray(data?.results)
        ? data.results
        : [];

    // A temporary empty response must not erase already displayed data
    // during an automatic refresh of the same date.
    if (freshMatches.length === 0 && hadMatches && requestedDate === state.date && !options.allowEmptyReplace) {
      stateEl.style.display = "none";
      return;
    }

    state.matches = freshMatches;
    document.getElementById("selectedDate").textContent = formatDate(state.date);
    document.getElementById("matchCount").textContent = state.matches.length.toLocaleString("en-US");

    const liveCount = state.matches.filter(m => statusType(m.status.short) === "live").length;
    const liveBadge = document.getElementById("liveBadge");
    if (liveBadge) {
      liveBadge.hidden = liveCount === 0;
      const liveCountEl = document.getElementById("liveCount");
      if (liveCountEl) liveCountEl.textContent = liveCount.toLocaleString("en-US");
    }

    render();
    updateDateButtons();
  } catch (e) {
    // Keep the last successful state. api.js already falls back to its
    // persistent cache, so this is only reached when no cached data exists.
    if (hadMatches) {
      stateEl.style.display = "none";
      console.warn("Kora Plus: refresh failed; keeping previous matches", e);
      return;
    }
    stateEl.textContent = e.message || t("state_error");
    stateEl.style.display = "block";
  }
}

/* ---------------- Render ---------------- */
function render() {
  const grid = document.getElementById("matchesGrid");
  const stateEl = document.getElementById("state");
  const q = state.query.trim().toLowerCase();

  let list = state.matches.filter(m => {
    const type = statusType(m.status.short);
    const matchesFilter = state.filter === "all" || state.filter === type;
    const matchesQuery = !q ||
      (m.home.name || "").toLowerCase().includes(q) ||
      (m.away.name || "").toLowerCase().includes(q);
    const matchesScope =
      state.scope === "all" ? true :
      state.scope === "favorites" ? state.favLeagues.includes(m.league.id) :
      state.scope === "top" ? TOP_LEAGUE_IDS.includes(m.league.id) : true;
    return matchesFilter && matchesQuery && matchesScope;
  });

  renderTopMatches(list);
  renderLeagueDirectory(state.matches);
  if (!list.length) {
    grid.innerHTML = "";
    stateEl.textContent = (state.scope === "favorites" && !state.favLeagues.length)
      ? t("state_empty_favorites")
      : t("state_empty");
    stateEl.style.display = "block";
    return;
  }
  stateEl.style.display = "none";

  const groups = new Map();
  for (const m of list) {
    const leagueKey = isFriendlyMatch(m) ? "friendly" : `${m.league.id}`;
    const key = `${leagueKey}-${displayLeagueName(m)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    const aFav = state.favLeagues.includes(a[0].league.id) ? 0 : 1;
    const bFav = state.favLeagues.includes(b[0].league.id) ? 0 : 1;
    return aFav - bFav;
  });

  grid.innerHTML = sortedGroups.map(group => {
    const league = group[0].league;
    const isFav = state.favLeagues.includes(league.id);
    return `
      <article class="league-card">
        <div class="league-head">
          ${league.logo ? `<img src="${esc(league.logo)}" alt="" loading="lazy">` : ""}
          <div class="league-names">
            <strong>${esc(isFriendlyMatch(group[0]) ? (state.lang === "ar" ? "مباريات ودية" : "Friendlies") : (league.name || t("league_fallback")))}</strong>
            <small>${esc(league.country || "")}</small>
          </div>
          <button class="fav-btn ${isFav ? "active" : ""}" data-league="${league.id}" aria-label="favorite">★</button>
        </div>
        ${group.map(matchRow).join("")}
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".fav-btn").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.league);
      const idx = state.favLeagues.indexOf(id);
      if (idx === -1) state.favLeagues.push(id); else state.favLeagues.splice(idx, 1);
      localStorage.setItem("favLeagues", JSON.stringify(state.favLeagues));
      render();
    };
  });
}


function renderLeagueDirectory(allMatches) {
  const el = document.getElementById("leagueList");
  if (!el) return;
  const groups = new Map();
  for (const m of allMatches) {
    const friendly = isFriendlyMatch(m);
    const id = friendly ? "friendly" : String(m.league?.id ?? "unknown");
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: friendly ? (state.lang === "ar" ? "مباريات ودية" : "Friendlies") : (m.league?.name || t("league_fallback")),
        country: friendly ? (state.lang === "ar" ? "وديات" : "Friendlies") : (m.league?.country || ""),
        logo: friendly ? "" : (m.league?.logo || ""),
        count: 0
      });
    }
    groups.get(id).count++;
  }
  const leagues = [...groups.values()].sort((a,b) => {
    if (a.id === "friendly") return 1;
    if (b.id === "friendly") return -1;
    return b.count - a.count || a.name.localeCompare(b.name);
  });
  if (!leagues.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = leagues.map(l => `
    <button class="league-directory-item" data-league-id="${esc(l.id)}">
      <span class="league-directory-logo">${l.logo ? `<img src="${esc(l.logo)}" alt="" loading="lazy">` : "⚽"}</span>
      <span class="league-directory-copy"><strong>${esc(l.name)}</strong><small>${esc(l.country)}</small></span>
      <b>${l.count}</b>
    </button>
  `).join("");
  el.querySelectorAll(".league-directory-item").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.leagueId;
      state.scope = "all";
      state.query = "";
      const input = document.getElementById("searchInput");
      if (input) input.value = "";
      state.matches = state.matches;
      if (id === "friendly") {
        const friendly = state.matches.filter(isFriendlyMatch);
        renderFilteredList(friendly);
      } else {
        const matches = state.matches.filter(m => String(m.league?.id) === id);
        renderFilteredList(matches);
      }
      document.getElementById("matchesGrid")?.scrollIntoView({behavior:"smooth", block:"start"});
    };
  });
}

function renderFilteredList(list) {
  const grid = document.getElementById("matchesGrid");
  const stateEl = document.getElementById("state");
  renderTopMatches(list);
  if (!list.length) {
    grid.innerHTML = "";
    stateEl.textContent = t("state_empty");
    stateEl.style.display = "block";
    return;
  }
  stateEl.style.display = "none";
  const groups = new Map();
  list.forEach(m => {
    const key = isFriendlyMatch(m) ? "friendly" : `${m.league?.id}-${m.league?.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });
  grid.innerHTML = [...groups.values()].map(group => {
    const league = group[0].league || {};
    const friendly = isFriendlyMatch(group[0]);
    return `<article class="league-card"><div class="league-head">${league.logo && !friendly ? `<img src="${esc(league.logo)}" alt="" loading="lazy">` : ""}<div class="league-names"><strong>${esc(displayLeagueName(group[0]))}</strong><small>${esc(friendly ? (state.lang === "ar" ? "وديات" : "Friendlies") : (league.country || ""))}</small></div></div>${group.map(matchRow).join("")}</article>`;
  }).join("");
}

function renderTopMatches(list) {
  const el = document.getElementById("topMatches");
  if (!el) return;
  const top = [...list].sort((a,b) => {
    const av = statusType(a.status.short)==="live" ? 0 : 1;
    const bv = statusType(b.status.short)==="live" ? 0 : 1;
    return av-bv;
  }).slice(0,3);
  if (!top.length) {
    el.innerHTML = `<div class="state">لا توجد مباريات متاحة حاليًا</div>`;
    return;
  }
  el.innerHTML = top.map(m => {
    const type=statusType(m.status.short);
    const score=(m.goals.home==null&&m.goals.away==null)?"—":`${m.goals.home??0} - ${m.goals.away??0}`;
    return `<article class="featured-match"><div class="featured-league"><span>${esc(displayLeagueName(m))}</span>${type==="live"?'<span class="live-pill">LIVE</span>':''}</div><div class="featured-teams"><div class="featured-team">${m.home.logo?`<img src="${esc(m.home.logo)}" alt="" loading="lazy">`:''}<strong>${esc(m.home.name||t("team_fallback"))}</strong></div><div class="featured-score"><strong>${score}</strong><small>${statusLabel(m)}</small></div><div class="featured-team">${m.away.logo?`<img src="${esc(m.away.logo)}" alt="" loading="lazy">`:''}<strong>${esc(m.away.name||t("team_fallback"))}</strong></div></div><div class="featured-venue">${esc(m.venue?.name||"")}</div></article>`;
  }).join("");
}

function matchRow(m) {
  const type = statusType(m.status.short);
  const homeLogo = m.home.logo ? `<img src="${esc(m.home.logo)}" alt="" loading="lazy">` : "";
  const awayLogo = m.away.logo ? `<img src="${esc(m.away.logo)}" alt="" loading="lazy">` : "";

  const score = m.goals.home == null && m.goals.away == null
    ? "—"
    : `${m.goals.home ?? 0} - ${m.goals.away ?? 0}`;

  const details = [];
  if (m.venue && m.venue.name) details.push(`<span><b>${t("venue_label")}</b>${esc(m.venue.name)}</span>`);
  if (m.referee) details.push(`<span><b>${t("referee_label")}</b>${esc(m.referee)}</span>`);

  return `
    <details class="match" data-id="${m.id}">
      <summary>
        <div class="side home">
          <span class="team-name">${esc(m.home.name || t("team_fallback"))}</span>
          ${homeLogo}
        </div>
        <div class="score-box">
          <span class="score">${score}</span>
          <span class="status ${type}">${statusLabel(m)}</span>
        </div>
        <div class="side away">
          ${awayLogo}
          <span class="team-name">${esc(m.away.name || t("team_fallback"))}</span>
        </div>
      </summary>
      ${details.length ? `<div class="match-detail">${details.join("")}</div>` : ""}
    </details>
  `;
}

/* ---------------- Events ---------------- */
document.getElementById("prevDay").onclick = () => { state.date = shiftDate(state.date, -1); updateDateButtons(); loadMatches({allowEmptyReplace:true}); };
document.getElementById("nextDay").onclick = () => { state.date = shiftDate(state.date, 1); updateDateButtons(); loadMatches({allowEmptyReplace:true}); };
document.getElementById("todayBtn").onclick = () => { state.date = localDate(); updateDateButtons(); loadMatches({allowEmptyReplace:true}); };

document.querySelectorAll(".scope").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".scope").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.scope = btn.dataset.scope;
    render();
  };
});

document.querySelectorAll(".filter").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    render();
  };
});

let searchTimer;
document.getElementById("searchInput").oninput = (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = e.target.value; render(); }, 150);
};

document.getElementById("searchBtn").onclick = () => { document.getElementById("searchInput")?.focus(); document.getElementById("searchInput")?.scrollIntoView({behavior:"smooth",block:"center"}); };
document.getElementById("bottomSearch")?.addEventListener("click", e => { e.preventDefault(); document.getElementById("searchInput")?.focus(); document.getElementById("searchInput")?.scrollIntoView({behavior:"smooth",block:"center"}); });
document.getElementById("themeBtn").onclick = () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem("dark", document.documentElement.classList.contains("dark") ? "1" : "0");
};
if (localStorage.getItem("dark") === "1") document.documentElement.classList.add("dark");

document.getElementById("langBtn").onclick = () => {
  state.lang = state.lang === "ar" ? "en" : "ar";
  localStorage.setItem("lang", state.lang);
  applyLang();
  render();
};

/* ---------------- Init ---------------- */
applyLang();
updateDateButtons();
loadMatches();

// Gentle auto-refresh for live matches on today's view.
setInterval(() => {
  if (state.date === localDate()) loadMatches();
}, 1800000);
