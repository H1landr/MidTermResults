/* =========================================================
   THE AMERICAN DECISION 2026
   Live midterm results dashboard
   Data: civicAPI (unofficial)
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Constants ---------- */

  const API_BASE = "https://civicapi.org/api/v2";
  const ELECTION_DATE = "2026-11-03";
  const START_MS = new Date("2026-11-03T18:00:00-05:00").getTime(); // 6:00 PM EST
  const END_MS = START_MS + 8 * 60 * 60 * 1000;                 // 2:00 AM EST
  const REFRESH_MS = 15 * 60 * 1000;
  const CACHE_KEY = "american-decision-2026-cache-v1";
  const PREVIEW = new URLSearchParams(window.location.search).has("preview");
  const PREVIEW_OFFSET = PREVIEW ? START_MS + 10 * 60 * 1000 - Date.now() : 0;

  const STATES = [
    ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
    ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
    ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
    ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
    ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
    ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
    ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
    ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
    ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
    ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
    ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
    ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
    ["WI", "Wisconsin"], ["WY", "Wyoming"]
  ];

  const STATE_NAME = Object.fromEntries(STATES);
  const STATE_CODES = STATES.map(function (s) { return s[0]; });

  // Seats held before the 2026 election. 22 Republican, 13 Democratic.
  const SENATE_HELD = {
    AL: "R", AK: "R", AR: "R", CO: "D", DE: "D", FL: "R", GA: "D", ID: "R",
    IL: "D", IA: "R", KS: "R", KY: "R", LA: "R", ME: "R", MI: "D", MN: "D",
    MS: "R", MT: "R", NE: "R", NH: "D", NJ: "D", NM: "D", NC: "R", OH: "R",
    OK: "R", OR: "D", RI: "D", SC: "R", SD: "R", TN: "R", TX: "R", VA: "D",
    WV: "R", WY: "R"
  };

  // Senate seats with no incumbent on the November general-election ballot.
  const SENATE_OPEN = new Set([
    "AL", "IL", "IA", "KY", "LA", "MI", "MN", "MT", "NC", "NH", "OK", "TX", "WY"
  ]);

  // Races to watch: open seats, incumbent races and recent statewide battlegrounds.
  const KEY_SENATE = new Set([
    "AK", "FL", "GA", "IA", "LA", "ME", "MI", "MN", "MT",
    "NC", "NE", "NH", "NJ", "NM", "OH", "SC", "TX", "VA"
  ]);

  // Incumbent last name / party used only for a small "INC" marker on cards.
  const INCUMBENT = {
    AK: { last: "Sullivan", party: "R" },
    AR: { last: "Cotton", party: "R" },
    CO: { last: "Hickenlooper", party: "D" },
    DE: { last: "Coons", party: "D" },
    FL: { last: "Moody", party: "R" },
    GA: { last: "Ossoff", party: "D" },
    ID: { last: "Risch", party: "R" },
    KS: { last: "Marshall", party: "R" },
    ME: { last: "Collins", party: "R" },
    MA: { last: "Markey", party: "D" },
    MS: { last: "Hyde-Smith", party: "R" },
    NE: { last: "Ricketts", party: "R" },
    NJ: { last: "Booker", party: "D" },
    NM: { last: "Lujan", party: "D" },
    OH: { last: "Husted", party: "R" },
    OR: { last: "Merkley", party: "D" },
    RI: { last: "Reed", party: "D" },
    SC: { last: "Graham", party: "R" },
    SD: { last: "Rounds", party: "R" },
    TN: { last: "Hagerty", party: "R" },
    VA: { last: "Warner", party: "D" },
    WV: { last: "Capito", party: "R" }
  };

  // First statewide poll-closing wave, Eastern Time.
  const POLL_CLOSE = {
    AL: "8:00 PM", AK: "12:00 AM", AZ: "9:00 PM", AR: "8:30 PM",
    CA: "11:00 PM", CO: "9:00 PM", CT: "8:00 PM", DE: "8:00 PM",
    FL: "7:00 PM", GA: "7:00 PM", HI: "12:00 AM", ID: "10:00 PM",
    IL: "8:00 PM", IN: "6:00 PM", IA: "9:00 PM", KS: "8:00 PM",
    KY: "6:00 PM", LA: "9:00 PM", ME: "8:00 PM", MD: "8:00 PM",
    MA: "8:00 PM", MI: "8:00 PM", MN: "9:00 PM", MS: "8:00 PM",
    MO: "8:00 PM", MT: "10:00 PM", NE: "9:00 PM", NV: "10:00 PM",
    NH: "7:00 PM", NJ: "8:00 PM", NM: "9:00 PM", NY: "9:00 PM",
    NC: "7:30 PM", ND: "8:00 PM", OH: "7:30 PM", OK: "8:00 PM",
    OR: "11:00 PM", PA: "8:00 PM", RI: "8:00 PM", SC: "7:00 PM",
    SD: "8:00 PM", TN: "8:00 PM", TX: "8:00 PM", UT: "10:00 PM",
    VT: "7:00 PM", VA: "7:00 PM", WA: "11:00 PM", WV: "7:30 PM",
    WI: "9:00 PM", WY: "9:00 PM"
  };

  const POLL_WAVES = [
    { min: 1080, time: "6:00 PM", states: "Kentucky, most of Indiana" },
    { min: 1140, time: "7:00 PM", states: "Georgia, South Carolina, Virginia, Vermont, most of Florida and New Hampshire" },
    { min: 1170, time: "7:30 PM", states: "North Carolina, Ohio, West Virginia" },
    { min: 1200, time: "8:00 PM", states: "Alabama, Connecticut, Delaware, Illinois, Kansas, Maine, Maryland, Massachusetts, Michigan, Mississippi, Missouri, New Jersey, North Dakota, Oklahoma, Pennsylvania, Rhode Island, South Dakota, Tennessee, Texas" },
    { min: 1230, time: "8:30 PM", states: "Arkansas" },
    { min: 1260, time: "9:00 PM", states: "Arizona, Colorado, Iowa, Louisiana, Minnesota, Nebraska, New Mexico, New York, Wisconsin, Wyoming" },
    { min: 1320, time: "10:00 PM", states: "Idaho, Montana, Nevada, Utah" },
    { min: 1380, time: "11:00 PM", states: "California, Oregon, Washington" },
    { min: 1440, time: "12:00 AM", states: "Alaska, Hawaii" },
    { min: 1500, time: "1:00 AM", states: "Aleutian Islands, Alaska" }
  ];

  const POLL_MIN = Object.fromEntries(
    Object.keys(POLL_CLOSE).map(function (code) {
      const s = POLL_CLOSE[code];
      const bits = s.split(" ");
      const hm = bits[0].split(":").map(Number);
      let h = hm[0];
      const m = hm[1];
      if (bits[1] === "PM" && h !== 12) h += 12;
      if (bits[1] === "AM" && h === 12) h = 24;
      return [code, h * 60 + m];
    })
  );

  /* ---------- Application state ---------- */

  const app = {
    races: [],
    phase: "pre",
    openChamber: null,
    search: "",
    stateFilter: "",
    sort: "state",
    calledOnly: false,
    lastChecked: null,
    lastSuccessAt: null,
    lastError: null,
    failedStates: [],
    successStates: 0,
    isRefreshing: false,
    refreshQueued: false,
    fetchProgress: null,
    nextRefresh: null,
    newCalls: [],
    modalId: null,
    lastPollNext: null,
    toastTimer: null,
    dataSource: "seed"
  };

  /* ---------- Small utilities ---------- */

  function nowMs() { return Date.now() + PREVIEW_OFFSET; }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function debounce(fn, ms) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function lastName(name) {
    const parts = normalizeText(name).replace(/[^a-z\- ]/g, " ").trim().split(/\s+/);
    return parts.length ? parts[parts.length - 1] : "";
  }

  function titleFor(race) {
    if (race.office === "S") return race.stateName + " U.S. Senate";
    if (race.district && /-AL$/i.test(race.district)) return race.stateName + " At-Large";
    return race.stateName + " District " + (race.districtNum || "");
  }

  function officeLabel(race) {
    return race.office === "S" ? "U.S. SENATE" : "U.S. HOUSE";
  }

  function formatVotes(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function formatPct(n) {
    const x = Number(n);
    if (!isFinite(x) || x <= 0) return "0.0%";
    if (x > 0 && x < 0.1) return "<0.1%";
    return x.toFixed(1) + "%";
  }

  function formatMargin(n) {
    if (n == null || !isFinite(n)) return "—";
    return "+" + Number(n).toFixed(1);
  }

  function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  const ET_TIME = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true
  });
  const ET_TIME_SECONDS = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
  });
  const ET_DATE = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  function timeET(ms) {
    return ET_TIME.format(new Date(ms)).replace(/\u202f/g, " ") + " ET";
  }
  function timeETS(ms) {
    return ET_TIME_SECONDS.format(new Date(ms)).replace(/\u202f/g, " ") + " ET";
  }
  function dateET(ms) {
    return ET_DATE.format(new Date(ms));
  }
  function timeShortET(ms) {
    return ET_TIME.format(new Date(ms)).replace(/\u202f/g, " ");
  }

  /* ---------- Parties ---------- */

  function partyCode(value) {
    const s = String(value || "").toLowerCase();
    if (s === "d" || s === "r" || s === "i" || s === "l" || s === "g" || s === "wf" || s === "np" || s === "o") {
      return s.toUpperCase();
    }
    if (s.indexOf("democrat") !== -1) return "D";
    if (s.indexOf("republican") !== -1) return "R";
    if (s.indexOf("independent") !== -1) return "I";
    if (s.indexOf("libertarian") !== -1) return "L";
    if (s.indexOf("green") !== -1) return "G";
    if (s.indexOf("working families") !== -1) return "WF";
    if (s.indexOf("nonpartisan") !== -1) return "NP";
    return "O";
  }

  function partyClass(code) {
    if (code === "D") return "d";
    if (code === "R") return "r";
    if (code === "I") return "i";
    return "o";
  }

  function partyName(code) {
    return {
      D: "Democratic", R: "Republican", I: "Independent", L: "Libertarian",
      G: "Green", WF: "Working Families", NP: "Nonpartisan", O: "Other"
    }[code] || "Other";
  }

  function partyShort(code) {
    if (code === "D") return "DEM";
    if (code === "R") return "GOP";
    if (code === "I") return "IND";
    return "OTHER";
  }

  /* ---------- Race model ---------- */

  function finalizeRace(race) {
    const candidates = (race.candidates || []).filter(function (c) {
      return c && c.name;
    }).map(function (c) {
      return {
        name: String(c.name).trim(),
        party: partyCode(c.party),
        votes: Number(c.votes) || 0,
        percent: Number(c.percent) || 0,
        winner: !!c.winner
      };
    });

    race.id = Number(race.id);
    race.office = race.office === "S" ? "S" : "H";
    race.state = String(race.state || "").toUpperCase();
    race.stateName = STATE_NAME[race.state] || race.state;
    race.district = race.district || "";
    race.name = race.name || (race.office === "S" ? race.stateName + " U.S. Senate" : race.stateName + " U.S. House");
    race.special = !!race.special;
    race.reporting = clamp(Number(race.reporting) || 0, 0, 100);
    race.candidates = candidates;
    race.totalVotes = candidates.reduce(function (sum, c) { return sum + (Number(c.votes) || 0); }, 0);
    race.called = candidates.some(function (c) { return c.winner; });
    race.winner = candidates.find(function (c) { return c.winner; }) || null;
    race.winnerParty = race.winner ? race.winner.party : null;
    race.held = race.office === "S" ? (SENATE_HELD[race.state] || null) : null;
    race.key = race.office === "S" && KEY_SENATE.has(race.state);
    race.open = race.office === "S" && SENATE_OPEN.has(race.state);
    race.flip = !!(race.called && race.office === "S" && race.winnerParty && race.held && race.winnerParty !== race.held);
    race.districtNum = (function () {
      const m = String(race.district || "").match(/(\d+)\s*$/);
      return m ? Number(m[1]) : 999;
    })();

    const sorted = candidates.slice().sort(function (a, b) {
      return (b.votes - a.votes) || (b.percent - a.percent);
    });
    race.calledAt = race.calledAt ? Number(race.calledAt) : null;
    race.newCall = false;

    race.margin = (sorted.length >= 2 && race.totalVotes > 0)
      ? Math.abs((sorted[0].percent || 0) - (sorted[1].percent || 0))
      : null;

    return race;
  }

  function normalizeRaw(raw) {
    const office = raw.type === "US Senate" ? "S" : "H";
    const seen = new Map();

    (raw.candidates || []).forEach(function (c) {
      const name = String(c.name || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      const p = partyCode(c.party);
      const votes = Number(c.votes) || 0;
      const percent = Number(c.percent) || 0;

      if (!seen.has(key)) {
        seen.set(key, {
          name: name,
          party: p,
          votes: votes,
          percent: percent,
          winner: !!c.winner
        });
      } else {
        const item = seen.get(key);
        item.votes += votes;
        item.percent += percent;
        item.winner = item.winner || !!c.winner;
        if (item.party !== "D" && item.party !== "R" && (p === "D" || p === "R")) {
          item.party = p;
        }
      }
    });

    return finalizeRace({
      id: raw.id,
      office: office,
      state: raw.province,
      district: raw.district || "",
      name: raw.election_name,
      special: /special/i.test(raw.election_name || ""),
      reporting: raw.percent_reporting,
      candidates: Array.from(seen.values()),
      calledAt: null
    });
  }

  function decodeSeed(seed) {
    if (!seed || !Array.isArray(seed.races)) return [];
    return seed.races.map(function (row) {
      const id = row[0];
      const office = row[1];
      const state = row[2];
      const district = row[3];
      const name = row[4];
      const special = !!row[5];
      const reporting = row[6];
      const candidates = (row[7] || []).map(function (c) {
        return {
          name: c[0],
          party: c[1],
          votes: c[2],
          percent: c[3],
          winner: !!c[4]
        };
      });
      return finalizeRace({
        id: id, office: office, state: state, district: district, name: name,
        special: special, reporting: reporting, candidates: candidates, calledAt: null
      });
    });
  }

  function sortRaces(list) {
    return list.slice().sort(function (a, b) {
      if (a.office !== b.office) return a.office === "S" ? -1 : 1;
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      return (a.districtNum || 0) - (b.districtNum || 0);
    });
  }

  function isIncumbent(race, candidate) {
    if (race.office !== "S") return false;
    const inc = INCUMBENT[race.state];
    if (!inc) return false;
    return inc.party === candidate.party && lastName(candidate.name) === inc.last.toLowerCase();
  }

  function orderedCandidates(race) {
    const indexed = race.candidates.map(function (c, i) { return { c: c, i: i }; });

    if (race.totalVotes > 0) {
      indexed.sort(function (a, b) {
        if (a.c.winner !== b.c.winner) return a.c.winner ? -1 : 1;
        if (b.c.votes !== a.c.votes) return b.c.votes - a.c.votes;
        if (b.c.percent !== a.c.percent) return b.c.percent - a.c.percent;
        return a.i - b.i;
      });
    } else {
      indexed.sort(function (a, b) {
        const ai = isIncumbent(race, a.c) ? 0 : (a.c.party === "D" || a.c.party === "R" ? 1 : 2);
        const bi = isIncumbent(race, b.c) ? 0 : (b.c.party === "D" || b.c.party === "R" ? 1 : 2);
        return (ai - bi) || (a.i - b.i);
      });
    }

    return indexed.map(function (x) { return x.c; });
  }

  function topTwo(race) {
    const ordered = orderedCandidates(race);
    if (ordered.length <= 2) return ordered;

    let first = ordered[0];
    let second = ordered[1];

    if ((first.party === "D" || first.party === "R") && second.party === first.party) {
      const other = ordered.find(function (c, i) {
        return i > 0 && (c.party === "D" || c.party === "R") && c.party !== first.party;
      });
      if (other) second = other;
    }
    return [first, second];
  }

  function partyShares(race) {
    let d = 0, r = 0, o = 0;
    race.candidates.forEach(function (c) {
      const p = Number(c.percent) || 0;
      if (c.party === "D") d += p;
      else if (c.party === "R") r += p;
      else o += p;
    });
    let total = d + r + o;
    if (total > 100) {
      d = (d / total) * 100;
      r = (r / total) * 100;
      o = (o / total) * 100;
      total = 100;
    }
    return {
      d: clamp(d, 0, 100),
      r: clamp(r, 0, 100),
      o: clamp(o, 0, 100),
      total: total
    };
  }

  function calledCount(office, party) {
    return app.races.filter(function (r) {
      return r.office === office && r.called && r.winnerParty === party;
    }).length;
  }

  function totalCalled(office) {
    return app.races.filter(function (r) {
      return (!office || r.office === office) && r.called;
    }).length;
  }

  function coverageMinutes(t) {
    return 18 * 60 + (t - START_MS) / 60000;
  }

  function pollStatus(race) {
    if (race.reporting > 0) return race.reporting + "% REPORTING";
    if (app.phase === "pre") return "POLLS CLOSE " + (POLL_CLOSE[race.state] || "—");
    if (app.phase === "final") return "FINAL • NO VOTES";
    const close = POLL_MIN[race.state];
    const mins = coverageMinutes(nowMs());
    if (close != null && mins >= close) return "AWAITING VOTES";
    return "POLLS CLOSE " + (POLL_CLOSE[race.state] || "—");
  }

  function pollMini(race) {
    if (race.totalVotes > 0) return formatVotes(race.totalVotes) + " VOTES";
    if (app.phase === "pre") return "POLLS CLOSE " + (POLL_CLOSE[race.state] || "—") + " ET";
    const close = POLL_MIN[race.state];
    const mins = coverageMinutes(nowMs());
    if (close != null && mins >= close) return "AWAITING FIRST REPORT";
    return "POLLS CLOSE " + (POLL_CLOSE[race.state] || "—") + " ET";
  }

  /* ---------- Time phase ---------- */

  function getPhase(t) {
    if (PREVIEW) return "live";
    if (t < START_MS) return "pre";
    if (t < END_MS) return "live";
    return "final";
  }

  function computeNextRefresh(t) {
    if (t < START_MS) return START_MS;
    if (t >= END_MS) return null;
    const n = Math.floor((t - START_MS) / REFRESH_MS) + 1;
    const next = START_MS + n * REFRESH_MS;
    return next < END_MS ? next : null;
  }

  /* ---------- DOM helpers ---------- */

  const $ = function (id) { return document.getElementById(id); };

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  /* ---------- Data access ---------- */

  async function fetchJSON(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeout || 14000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchState(code) {
    const url = API_BASE + "/race/search?startDate=" + ELECTION_DATE +
      "&endDate=" + ELECTION_DATE +
      "&country=US&province=" + encodeURIComponent(code) +
      "&election_type=General&limit=500&_=" + Date.now();

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const json = await fetchJSON(url, 14000);
        if (!json || !Array.isArray(json.races)) throw new Error("Malformed state feed");
        const races = json.races.filter(function (r) {
          return r.type === "US Senate" || r.type === "House of Representatives";
        }).map(normalizeRaw);
        if (!races.length) throw new Error("No federal races in state feed");
        return { code: code, races: races };
      } catch (err) {
        lastError = err;
        if (attempt === 0) await sleep(450);
      }
    }
    return { code: code, error: lastError || new Error("State feed failed") };
  }

  async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;

    async function worker() {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await fn(items[index], index);
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: app.lastChecked ? app.lastChecked.getTime() : nowMs(),
        races: app.races
      }));
    } catch (err) {
      // Local storage can be unavailable for file:// pages or in private mode.
    }
  }

  function loadCache(seedTime) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.races) || parsed.races.length < 400) return null;
      const savedAt = new Date(parsed.savedAt).getTime();
      if (!isFinite(savedAt)) return null;
      if (Date.now() - savedAt > 36 * 60 * 60 * 1000) return null;
      if (seedTime && savedAt <= seedTime) return null;
      return {
        savedAt: savedAt,
        races: parsed.races.map(function (r) { return finalizeRace(r); })
      };
    } catch (err) {
      return null;
    }
  }

  /* ---------- Refresh ---------- */

  async function fetchNational() {
    const url = API_BASE + "/race/search?startDate=" + ELECTION_DATE +
      "&endDate=" + ELECTION_DATE +
      "&country=US&election_type=General&limit=2000&_=" + Date.now();

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const json = await fetchJSON(url, 20000);
        if (!json || !Array.isArray(json.races)) throw new Error("Malformed national results feed");

        const races = json.races.filter(function (r) {
          return (r.type === "US Senate" || r.type === "House of Representatives") &&
            r.province && r.province !== "US" && /^[A-Z]{2}$/.test(r.province);
        }).map(normalizeRaw);

        if (races.length < 400) throw new Error("National results feed returned too few races");
        return races;
      } catch (err) {
        lastError = err;
        if (attempt === 0) await sleep(700);
      }
    }
    throw lastError || new Error("National results feed unavailable");
  }

  async function refreshAll(reason) {
    if (app.isRefreshing) {
      if (reason === "start") app.refreshQueued = true;
      return;
    }
    if (app.phase === "final" && reason === "auto") return;

    app.isRefreshing = true;
    app.fetchProgress = { done: 0, total: 1 };
    app.lastError = null;
    renderRefreshState();
    renderDataAlert();

    const previousById = new Map();
    app.races.forEach(function (r) { previousById.set(r.id, r); });
    const previousCalled = new Set(app.races.filter(function (r) { return r.called; }).map(function (r) { return r.id; }));

    try {
      const fetched = await fetchNational();
      app.fetchProgress.done = 1;

      fetched.forEach(function (r) {
        const prev = previousById.get(r.id);
        if (prev && prev.calledAt) r.calledAt = prev.calledAt;
        if (r.called && !previousCalled.has(r.id)) {
          if (!r.calledAt) r.calledAt = nowMs();
          r.newCall = true;
        }
      });

      const newCalls = fetched.filter(function (r) { return r.newCall; });

      app.races = sortRaces(fetched);
      app.lastChecked = new Date(nowMs());
      app.lastSuccessAt = app.lastChecked;
      app.failedStates = [];
      app.successStates = 1;
      app.newCalls = newCalls;
      app.dataSource = "live";
      if (!PREVIEW) saveCache();

      app.phase = getPhase(nowMs());
      app.nextRefresh = computeNextRefresh(nowMs());
      renderAll();

      if (newCalls.length) {
        showToast(newCalls.length + " new race call" + (newCalls.length === 1 ? "" : "s") + " added.");
      } else if (reason === "manual") {
        showToast("Results refreshed from civicAPI.");
      }
    } catch (err) {
      app.lastError = String(err && err.message ? err.message : err);
      app.lastChecked = new Date(nowMs());
      app.successStates = 0;
      app.failedStates = [];
      app.nextRefresh = computeNextRefresh(nowMs());
      renderRefreshState();
      renderDataAlert();
      showToast("Update failed — keeping the last results on screen.", true);
    } finally {
      app.isRefreshing = false;
      app.fetchProgress = null;
      renderRefreshState();
      renderDataAlert();
      renderTicker();
      updateClocks();

      if (app.refreshQueued && app.phase !== "final") {
        app.refreshQueued = false;
        setTimeout(function () { refreshAll("queued"); }, 350);
      }
    }
  }

  /* ---------- Render: coverage clock ---------- */

  function updateNextPollLabel() {
    const el = $("nextPollLabel");
    if (!el) return;

    if (app.phase === "pre") {
      el.textContent = "KY, IN \u2022 6:00 PM ET";
      return;
    }
    if (app.phase === "final") {
      el.textContent = "POLLS CLOSED";
      return;
    }

    const index = pollNextIndex();
    if (index < 0) {
      el.textContent = "FINAL POLLS \u2022 1:00 AM ET";
      return;
    }
    const wave = POLL_WAVES[index];
    const firstState = wave.states.split(",")[0];
    el.textContent = firstState.toUpperCase() + " \u2022 " + wave.time + " ET";
  }

  function updateClocks(t) {
    const now = t == null ? nowMs() : t;
    const phase = app.phase;
    const called = totalCalled();

    const badge = $("phaseBadge");
    if (badge) {
      let label = "PRE-SHOW";
      let cls = "phase-badge pre";
      if (PREVIEW) { label = "LIVE PREVIEW"; cls = "phase-badge preview"; }
      else if (phase === "live") { label = app.isRefreshing ? "UPDATING" : "LIVE"; cls = "phase-badge live"; }
      else if (phase === "final") { label = "FINAL"; cls = "phase-badge final"; }
      badge.className = cls;
      badge.textContent = label;
    }

    let clock = "00:00:00";
    let label = "COVERAGE CONCLUDED AT 2:00 AM ET";
    let progress = 100;
    let nextLabel = "AUTO-REFRESH STOPPED";

    if (phase === "pre") {
      clock = formatCountdown(START_MS - now);
      label = "UNTIL LIVE COVERAGE BEGINS";
      progress = 0;
      nextLabel = "FIRST UPDATE " + timeShortET(START_MS);
    } else if (phase === "live") {
      const target = app.nextRefresh || END_MS;
      clock = formatCountdown(target - now);
      label = app.isRefreshing ? "FETCHING LATEST RESULTS" : (app.nextRefresh ? "NEXT DATA UPDATE IN" : "COVERAGE ENDS IN");
      progress = clamp(((now - START_MS) / (END_MS - START_MS)) * 100, 0, 100);
      nextLabel = app.nextRefresh ? "NEXT " + timeShortET(app.nextRefresh) : "FINAL SNAPSHOT AT 2:00 AM";
    }

    setText("coverageClock", clock);
    setText("coverageLabel", label);
    setText("nextRefreshTop", nextLabel);
    const progressEl = $("coverageProgress");
    if (progressEl) progressEl.style.width = progress + "%";
    setText("crawlClock", timeET(now));
    updateNextPollLabel();

    const navStatus = $("navStatus");
    if (navStatus) {
      navStatus.textContent = phase === "pre"
        ? "AWAITING 6:00 PM ET"
        : phase === "final"
          ? "FINAL SNAPSHOT"
          : called + " RACES CALLED • AUTO 15 MIN";
    }
    const navDot = $("navDot");
    if (navDot) {
      navDot.className = "live-dot " + (phase === "live" ? "" : "muted");
    }

    const utilityModeText = $("utilityModeText");
    if (utilityModeText) {
      utilityModeText.textContent = phase === "final" ? "STOPPED" : "15 MIN";
    }
    const utilityDot = $("utilityDot");
    if (utilityDot) {
      utilityDot.className = "live-dot " + (phase === "live" ? "" : "muted");
    }

    const boardStatus = $("boardStatus");
    if (boardStatus) {
      const calledLabel = called + (called === 1 ? " RACE CALLED" : " RACES CALLED");
      boardStatus.textContent = phase === "pre"
        ? "PRE-SHOW • POLLS NOT YET CLOSED"
        : phase === "final"
          ? "FINAL • " + calledLabel
          : "LIVE • " + calledLabel;
    }
    const boardDot = $("boardDot");
    if (boardDot) {
      boardDot.className = "live-dot " + (phase === "live" ? "" : "muted");
    }

    const title = phase === "pre"
      ? "The American Decision 2026 | Live at 6 PM ET"
      : phase === "final"
        ? "FINAL: 2026 Midterm Results | The American Decision"
        : "LIVE: " + called + " races called | The American Decision 2026";
    if (document.title !== title) document.title = title;
  }

  /* ---------- Render: balance of power ---------- */

  function renderPower() {
    const hd = calledCount("H", "D");
    const hr = calledCount("H", "R");
    const hOther = totalCalled("H") - hd - hr;
    const hCalled = hd + hr + hOther;
    const hOut = Math.max(0, 435 - hCalled);

    const sd = calledCount("S", "D");
    const sr = calledCount("S", "R");
    const sOther = totalCalled("S") - sd - sr;
    const sCalled = sd + sr + sOther;
    const sOut = Math.max(0, 35 - sCalled);
    const sDTotal = 34 + sd;
    const sRTotal = 31 + sr;

    setText("houseCalled", hCalled);
    setText("houseDCalled", hd);
    setText("houseRCalled", hr);
    setText("houseOut", hOut);
    setText("senateCalled", sCalled);
    setText("senateDCalled", sDTotal);
    setText("senateRCalled", sRTotal);
    setText("senateOut", sOut);

    const houseBarD = $("houseBarD");
    const houseBarR = $("houseBarR");
    const houseBarO = $("houseBarO");
    if (houseBarD) houseBarD.style.width = (hd / 435 * 100) + "%";
    if (houseBarR) houseBarR.style.width = (hr / 435 * 100) + "%";
    if (houseBarO) houseBarO.style.width = (hOther / 435 * 100) + "%";

    const senateBarD = $("senateBarD");
    const senateBarR = $("senateBarR");
    const senateBarO = $("senateBarO");
    if (senateBarD) senateBarD.style.width = sDTotal + "%";
    if (senateBarR) senateBarR.style.width = sRTotal + "%";
    if (senateBarO) senateBarO.style.width = sOther + "%";

    const houseBar = $("houseBar");
    if (houseBar) {
      houseBar.setAttribute("aria-label",
        "House: " + hd + " Democratic seats called, " + hr + " Republican seats called, " + hOut + " outstanding, 218 needed for control.");
    }
    const senateBar = $("senateBar");
    if (senateBar) {
      senateBar.setAttribute("aria-label",
        "Senate: " + sDTotal + " Democratic caucus seats, " + sRTotal + " Republican seats, " + sOut + " outstanding, 51 needed for control.");
    }

    const houseNeedChip = $("houseNeedChip");
    if (houseNeedChip) {
      houseNeedChip.textContent = hd >= 218
        ? "DEMS CLINCH HOUSE"
        : hr >= 218
          ? "GOP CLINCH HOUSE"
          : "DEMS NEED NET +3";
    }
    const senateNeedChip = $("senateNeedChip");
    if (senateNeedChip) {
      senateNeedChip.textContent = sDTotal >= 51
        ? "DEMS CLINCH SENATE"
        : sRTotal >= 51
          ? "GOP CLINCH SENATE"
          : "DEMS NEED NET +4";
    }

    setText("houseNote", hCalled > 0
      ? hCalled + " of 435 called"
      : "215 + 3 = 218");
    setText("senateNote", sCalled > 0
      ? "D " + sDTotal + " \u2022 R " + sRTotal + " \u2022 " + sOut + " up"
      : "47 + 4 = 51");
  }

  /* ---------- Render: race cards ---------- */

  function cardHtml(race) {
    const display = topTwo(race);
    const shares = partyShares(race);
    const hasVotes = race.totalVotes > 0;
    const status = race.called ? "CALLED" : pollStatus(race);
    const statusClass = race.called ? "called" : (hasVotes ? "live" : (app.phase === "pre" ? "" : "closed"));

    const chips = [];
    if (race.key) chips.push('<span class="chip key">★ KEY RACE</span>');
    if (race.open) chips.push('<span class="chip">OPEN SEAT</span>');
    if (race.flip) chips.push('<span class="chip flip">' + (race.winnerParty === "D" ? "DEM" : race.winnerParty === "R" ? "GOP" : "IND") + ' FLIP</span>');
    if (race.newCall) chips.push('<span class="chip new">NEW CALL</span>');

    const badgeOff = race.office === "S" ? "SEN" : (race.districtNum !== 999 ? "D" + race.districtNum : "AL");
    const sub = race.office === "S"
      ? (race.special ? "SPECIAL ELECTION" : "GENERAL ELECTION")
      : (race.district ? race.district + " • GENERAL" : "AT-LARGE • GENERAL");

    const classes = ["race-card"];
    if (race.key) classes.push("is-key");
    if (race.called) classes.push("is-called");
    if (race.flip) classes.push("is-flip");
    if (race.newCall) classes.push("is-new");

    const candHtml = display.map(function (c, index) {
      const leader = hasVotes && index === 0;
      const pct = hasVotes ? formatPct(c.percent) : "—";
      const inc = isIncumbent(race, c) ? ' <span class="inc">INC</span>' : "";
      return '<div class="cand ' + (leader ? "leader" : "") + '">' +
        '<span class="party-dot ' + partyClass(c.party) + '" title="' + escapeHtml(partyName(c.party)) + '"></span>' +
        '<span class="cand-name">' + escapeHtml(c.name) + inc + '</span>' +
        '<span class="cand-pct ' + (hasVotes ? "" : "muted") + '">' + pct + '</span>' +
        '</div>';
    }).join("");

    const aria = titleFor(race) + ". " + status + ". " + display.map(function (c) {
      return c.name + " " + (hasVotes ? formatPct(c.percent) : "no votes reported");
    }).join(", ") + ".";

    return '<button type="button" class="' + classes.join(" ") + '" data-race-id="' + race.id + '" aria-label="' + escapeHtml(aria) + '">' +
      '<div class="race-top">' +
        '<span class="race-badge"><span class="st">' + escapeHtml(race.state) + '</span><span class="off">' + escapeHtml(badgeOff) + '</span></span>' +
        '<span class="race-info">' +
          '<span class="race-office">' + escapeHtml(officeLabel(race)) + '</span>' +
          '<span class="race-title">' + escapeHtml(titleFor(race)) + '</span>' +
          '<span class="race-sub">' + escapeHtml(sub) + '</span>' +
        '</span>' +
        '<span class="race-status ' + statusClass + '">' + escapeHtml(status) + '</span>' +
      '</div>' +
      (chips.length ? '<div class="chips">' + chips.join("") + '</div>' : "") +
      '<div class="cand-list">' + candHtml + '</div>' +
      '<div class="vote-bar" aria-hidden="true">' +
        '<span class="d" style="width:' + (hasVotes ? shares.d : 0) + '%"></span>' +
        '<span class="o" style="width:' + (hasVotes ? shares.o : 0) + '%"></span>' +
        '<span class="r" style="width:' + (hasVotes ? shares.r : 0) + '%"></span>' +
      '</div>' +
      '<div class="race-foot">' +
        '<span>' + escapeHtml(pollMini(race)) + '</span>' +
        '<span>' + (hasVotes ? (race.margin != null ? 'MARGIN ' + formatMargin(race.margin) : '—') : 'AWAITING FIRST VOTES') + '</span>' +
      '</div>' +
    '</button>';
  }

  function groupByState(list) {
    const map = new Map();
    list.forEach(function (r) {
      if (!map.has(r.state)) map.set(r.state, []);
      map.get(r.state).push(r);
    });
    return Array.from(map.entries()).sort(function (a, b) { return a[0].localeCompare(b[0]); });
  }

  function stateGroupHtml(state, races) {
    return '<div class="state-group">' +
      '<div class="state-group-head"><h3>' + escapeHtml(STATE_NAME[state] || state) + '</h3>' +
      '<span>' + races.length + ' district' + (races.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="cards">' + races.map(cardHtml).join("") + '</div>' +
      '</div>';
  }

  function officeGroupHtml(title, races) {
    if (!races.length) return "";
    return '<div class="office-group">' +
      '<div class="office-group-head"><h3>' + escapeHtml(title) + '</h3><span>' + races.length + ' races</span></div>' +
      '<div class="cards">' + races.map(cardHtml).join("") + '</div>' +
      '</div>';
  }

  function filteredRaces() {
    if (!app.openChamber) return [];
    const office = app.openChamber === "house" ? "H" : "S";
    let list = app.races.filter(function (r) { return r.office === office; });

    if (app.stateFilter) {
      list = list.filter(function (r) { return r.state === app.stateFilter; });
    }

    if (app.calledOnly) {
      list = list.filter(function (r) { return r.called; });
    }

    if (app.search) {
      const tokens = app.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
      list = list.filter(function (r) {
        const hay = [
          r.state, r.stateName, r.district, r.name, r.office === "S" ? "senate" : "house",
          r.candidates.map(function (c) { return c.name + " " + partyName(c.party); }).join(" ")
        ].join(" ").toLowerCase();
        return tokens.every(function (tok) { return hay.indexOf(tok) !== -1; });
      });
    }

    if (app.sort === "closest") {
      list.sort(function (a, b) {
        const am = a.totalVotes > 0 && a.margin != null ? a.margin : Infinity;
        const bm = b.totalVotes > 0 && b.margin != null ? b.margin : Infinity;
        if (am !== bm) return am - bm;
        if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
        return a.state.localeCompare(b.state);
      });
    } else if (app.sort === "reporting") {
      list.sort(function (a, b) {
        return (b.reporting - a.reporting) || (b.totalVotes - a.totalVotes) || a.state.localeCompare(b.state);
      });
    } else if (app.sort === "votes") {
      list.sort(function (a, b) {
        return (b.totalVotes - a.totalVotes) || a.state.localeCompare(b.state);
      });
    } else {
      list = sortRaces(list);
    }

    return list;
  }

  function renderRaceGrid() {
    const grid = $("raceGrid");
    const empty = $("emptyState");
    const board = $("raceBoard");
    if (!grid) return;

    if (!app.openChamber) {
      if (board) board.hidden = true;
      grid.innerHTML = "";
      grid.style.display = "";
      if (empty) empty.hidden = true;
      setText("resultsCount", "Choose a chamber to open its races.");
      return;
    }

    if (board) board.hidden = false;

    const isHouse = app.openChamber === "house";
    setText("raceBoardKicker", isHouse ? "LIVE HOUSE RACES" : "LIVE SENATE RACES");
    setText("raceBoardTitle", isHouse ? "U.S. HOUSE RACES" : "U.S. SENATE RACES");
    setText("raceBoardSub", isHouse
      ? "ALL 435 VOTING DISTRICTS \u2022 UNOFFICIAL RESULTS"
      : "35 SEATS \u2022 22 R / 13 D \u2022 UNOFFICIAL RESULTS");

    const list = filteredRaces();
    const baseCount = isHouse ? 435 : 35;
    const grouped = app.sort === "state" && isHouse;

    grid.classList.toggle("is-grouped", grouped);

    if (!list.length) {
      grid.innerHTML = "";
      grid.style.display = "none";
      if (empty) {
        empty.hidden = false;
        const heading = empty.querySelector("h3");
        const copy = empty.querySelector("p");
        if (heading) heading.textContent = app.calledOnly ? "No called races yet" : "No races match";
        if (copy) {
          copy.textContent = app.calledOnly
            ? "Race calls will appear here as results come in. Clear the filter to see the full board."
            : "Try a different state, candidate or filter. Clear the search to see every race in this chamber.";
        }
      }
    } else {
      grid.style.display = "";
      if (empty) empty.hidden = true;

      if (grouped) {
        grid.innerHTML = groupByState(list).map(function (entry) {
          return stateGroupHtml(entry[0], entry[1]);
        }).join("");
      } else {
        grid.innerHTML = list.map(cardHtml).join("");
      }
    }

    let countText;
    if (list.length === baseCount) {
      countText = "Showing " + baseCount + (isHouse ? " House" : " Senate") + " races";
    } else {
      countText = "Showing " + list.length + " of " + baseCount + (isHouse ? " House" : " Senate") + " races";
    }
    if (app.calledOnly) countText += " \u2022 called only";
    setText("resultsCount", countText);
  }

  /* ---------- Render: latest calls ---------- */

  function renderLatestCalls() {
    const box = $("latestCalls");
    if (!box) return;
    const called = app.races.filter(function (r) { return r.called && r.winner; }).sort(function (a, b) {
      return (b.calledAt || 0) - (a.calledAt || 0) || a.state.localeCompare(b.state);
    });

    setText("callsCount", called.length);
    const latestDot = $("latestDot");
    if (latestDot) latestDot.className = "live-dot " + (called.length ? "" : "muted");

    if (!called.length) {
      const emptyText = app.phase === "pre"
        ? "No races called yet. First polls close at 6:00 PM ET in Kentucky and most of Indiana."
        : "No races called yet. Calls will appear here as they are made.";
      box.innerHTML = '<p class="side-empty">' + escapeHtml(emptyText) + '</p>';
      return;
    }

    const visible = called.slice(0, 5);
    const html = visible.map(function (r) {
      const winner = r.winner;
      return '<button type="button" class="call-item" data-race-id="' + r.id + '" aria-label="Open ' + escapeHtml(titleFor(r)) + '">' +
        '<span class="call-badge">' + escapeHtml(r.state) + '</span>' +
        '<span class="call-copy">' +
          '<span class="call-office">' + escapeHtml(r.office === "S" ? "SENATE" : "HOUSE " + (r.districtNum !== 999 ? r.districtNum : "AL")) + '</span>' +
          '<span class="call-name">' + escapeHtml(winner.name) + (r.newCall ? '<span class="call-new">NEW</span>' : '') + '</span>' +
        '</span>' +
        '<span class="call-party ' + partyClass(r.winnerParty) + '">' + partyShort(r.winnerParty) + '</span>' +
        '</button>';
    }).join("");

    box.innerHTML = html;
  }

  /* ---------- Render: poll timeline ---------- */

  function pollNextIndex() {
    if (app.phase === "pre") return 0;
    if (app.phase === "final") return -1;
    const mins = coverageMinutes(nowMs());
    return POLL_WAVES.findIndex(function (w) { return w.min > mins; });
  }

  function renderPollTimeline() {
    const box = $("pollTimeline");
    if (!box) return;
    const next = pollNextIndex();
    if (app.lastPollNext === next && box.children.length) return;
    app.lastPollNext = next;

    box.innerHTML = POLL_WAVES.map(function (w, i) {
      return '<div class="poll-row ' + (i === next ? "next" : "") + '">' +
        '<span class="poll-time">' + escapeHtml(w.time) + '</span>' +
        '<span class="poll-states">' + escapeHtml(w.states) + '</span>' +
        '</div>';
    }).join("");
  }

  /* ---------- Render: ticker ---------- */

  function renderTicker() {
    const a = $("crawlA");
    const b = $("crawlB");
    const labelEl = $("crawlLabel");
    if (!a || !b || !labelEl) return;

    const called = totalCalled();
    const items = [];

    if (app.phase === "pre") {
      items.push("PRE-SHOW: Live results coverage begins at 6:00 PM ET.");
      items.push("First polls close at 6:00 PM ET in Kentucky and most of Indiana.");
      items.push("Democrats need a net gain of 3 in the House and 4 in the Senate.");
      items.push("All 435 House seats and 35 Senate seats are on the ballot.");
      if (app.lastChecked) items.push("Data desk checked " + timeET(app.lastChecked.getTime()) + ".");
    } else if (app.phase === "live") {
      items.push("LIVE: " + called + " of 470 races called.");
      if (app.newCalls.length) {
        items.push((app.newCalls.length === 1 ? "NEW CALL: " : "NEW CALLS: ") + app.newCalls.slice(0, 4).map(function (r) {
          return r.state + " " + (r.office === "S" ? "Senate" : "House " + (r.districtNum !== 999 ? r.districtNum : "AL")) + " — " + r.winner.name;
        }).join(" • ") + ".");
      }
      items.push("Democrats need a net gain of 3 in the House and 4 in the Senate.");
      if (app.lastChecked) items.push("Last data check " + timeET(app.lastChecked.getTime()) + ".");
    } else {
      items.push("FINAL SNAPSHOT: " + called + " of 470 races called before coverage ended at 2:00 AM ET.");
      items.push("Unofficial results. Vote totals and race calls can change until certified.");
      if (app.lastChecked) items.push("Final data check " + timeET(app.lastChecked.getTime()) + ".");
    }

    const text = items.join("  •  ");
    if (a.textContent !== text) {
      a.textContent = text;
      b.textContent = text;
    }

    let label = "PRE-SHOW";
    let cls = "crawl-label";
    if (app.phase === "live") {
      label = app.isRefreshing ? "UPDATING" : "LIVE";
      cls = "crawl-label";
    } else if (app.phase === "final") {
      label = "FINAL";
    }
    labelEl.className = cls;
    labelEl.innerHTML = '<span class="live-dot ' + (app.phase === "live" ? "" : "muted") + '"></span> ' + label;
  }

  /* ---------- Render: refresh state and alerts ---------- */

  function renderRefreshState() {
    const btn = $("refreshBtn");
    if (btn) {
      btn.disabled = app.isRefreshing || app.phase === "final";
      btn.innerHTML = app.isRefreshing
        ? "UPDATING…"
        : app.phase === "final"
          ? "COVERAGE ENDED"
          : app.phase === "pre"
            ? "↻ REFRESH DATA"
            : "↻ REFRESH NOW";
    }

    let updated;
    if (app.isRefreshing && app.fetchProgress) {
      updated = "Updating national results feed…";
    } else if (app.lastError && app.lastSuccessAt) {
      updated = "Update issue • last good " + timeET(app.lastSuccessAt.getTime());
    } else if (app.lastChecked) {
      updated = "Last checked " + timeET(app.lastChecked.getTime());
    } else {
      updated = "Awaiting first data check";
    }
    setText("resultsUpdated", updated);

    if (app.lastError && app.lastSuccessAt) {
      setText("boardUpdated", "LAST GOOD " + timeET(app.lastSuccessAt.getTime()));
    } else if (app.lastChecked) {
      const prefix = app.phase === "final" ? "FINAL SNAPSHOT " : "DATA CHECKED ";
      setText("boardUpdated", prefix + timeET(app.lastChecked.getTime()));
    } else {
      setText("boardUpdated", "AWAITING FIRST DATA CHECK");
    }

    let status;
    let dotClass = "ok-dot";
    if (app.isRefreshing) {
      status = "Updating…";
      dotClass = "ok-dot warn";
    } else if (app.lastError && !app.successStates) {
      status = "Offline snapshot";
      dotClass = "ok-dot err";
    } else if (app.phase === "final") {
      status = "Coverage ended";
      dotClass = "ok-dot";
    } else if (app.phase === "live") {
      status = "Live • auto-refresh";
      dotClass = "ok-dot";
    } else {
      status = app.lastChecked ? "Pre-show snapshot" : "Awaiting live window";
      dotClass = "ok-dot";
    }
    setText("dataStatus", status);
    const dataDot = $("dataDot");
    if (dataDot) dataDot.className = dotClass;
  }

  function renderDataAlert() {
    const alert = $("dataAlert");
    if (!alert) return;

    if (app.isRefreshing) {
      alert.hidden = true;
      return;
    }

    if (app.lastError && app.successStates === 0) {
      alert.hidden = false;
      alert.className = "data-alert data-alert-global error";
      alert.textContent = "Live data connection issue. Showing the last saved snapshot" +
        (app.lastSuccessAt ? " from " + timeET(app.lastSuccessAt.getTime()) : "") +
        ". The desk will retry automatically.";
      return;
    }

    alert.hidden = true;
  }

  /* ---------- Render: all ---------- */

  function renderAll() {
    renderPower();
    renderRaceGrid();
    renderLatestCalls();
    renderPollTimeline();
    renderTicker();
    renderRefreshState();
    renderDataAlert();
    updateClocks();
  }

  /* ---------- Chamber expansion, filters and events ---------- */

  function updateChamberButtons() {
    const house = $("houseCard");
    const senate = $("senateCard");
    const houseOpen = app.openChamber === "house";
    const senateOpen = app.openChamber === "senate";

    if (house) {
      house.classList.toggle("active", houseOpen);
      house.setAttribute("aria-expanded", houseOpen ? "true" : "false");
      house.setAttribute("aria-label", houseOpen
        ? "U.S. House totals — close House races"
        : "U.S. House totals — open all 435 House races");
    }
    if (senate) {
      senate.classList.toggle("active", senateOpen);
      senate.setAttribute("aria-expanded", senateOpen ? "true" : "false");
      senate.setAttribute("aria-label", senateOpen
        ? "U.S. Senate totals — close Senate races"
        : "U.S. Senate totals — open all 35 Senate races");
    }

    setText("houseToggleText", houseOpen ? "HIDE HOUSE RACES" : "VIEW ALL 435 HOUSE RACES");
    setText("senateToggleText", senateOpen ? "HIDE SENATE RACES" : "VIEW ALL 35 SENATE RACES");
    setText("houseToggleIcon", houseOpen ? "\u25B4" : "\u25BE");
    setText("senateToggleIcon", senateOpen ? "\u25B4" : "\u25BE");
  }

  function closeChamber(shouldScroll) {
    const previous = app.openChamber;
    app.openChamber = null;
    updateChamberButtons();
    renderRaceGrid();

    if (shouldScroll) {
      const target = previous === "senate" ? $("senateCard") : $("houseCard");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function openChamber(chamber) {
    app.openChamber = chamber;
    app.search = "";
    app.stateFilter = "";
    app.sort = "state";
    app.calledOnly = false;

    const search = $("searchInput");
    if (search) search.value = "";
    const sort = $("sortSelect");
    if (sort) sort.value = "state";
    const calledOnly = $("calledOnly");
    if (calledOnly) calledOnly.checked = false;

    updateChamberButtons();
    populateStateFilter();
    renderRaceGrid();

    const board = $("raceBoard");
    if (board) {
      board.hidden = false;
      setTimeout(function () {
        board.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }

  function toggleChamber(chamber) {
    if (app.openChamber === chamber) {
      closeChamber(false);
    } else {
      openChamber(chamber);
    }
  }

  function populateStateFilter() {
    const select = $("stateFilter");
    if (!select) return;

    if (!app.openChamber) {
      select.innerHTML = '<option value="">ALL STATES</option>';
      select.value = "";
      return;
    }

    const office = app.openChamber === "house" ? "H" : "S";
    const available = new Set(app.races.filter(function (r) {
      return r.office === office;
    }).map(function (r) { return r.state; }));

    if (app.stateFilter && !available.has(app.stateFilter)) app.stateFilter = "";

    const codes = Array.from(available).sort(function (a, b) {
      return (STATE_NAME[a] || a).localeCompare(STATE_NAME[b] || b);
    });

    let html = '<option value="">ALL STATES</option>';
    codes.forEach(function (code) {
      html += '<option value="' + escapeHtml(code) + '">' + escapeHtml(STATE_NAME[code] || code) + '</option>';
    });
    select.innerHTML = html;
    select.value = app.stateFilter;
  }

  function bindEvents() {
    document.querySelectorAll("[data-chamber]").forEach(function (el) {
      el.addEventListener("click", function () {
        toggleChamber(el.dataset.chamber);
      });
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggleChamber(el.dataset.chamber);
        }
      });
    });

    const boardClose = $("raceBoardClose");
    if (boardClose) {
      boardClose.addEventListener("click", function () { closeChamber(true); });
    }

    const search = $("searchInput");
    if (search) {
      search.addEventListener("input", debounce(function () {
        app.search = search.value.trim();
        renderRaceGrid();
      }, 140));
    }

    const stateFilter = $("stateFilter");
    if (stateFilter) {
      stateFilter.addEventListener("change", function () {
        app.stateFilter = stateFilter.value;
        renderRaceGrid();
      });
    }

    const sortSelect = $("sortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", function () {
        app.sort = sortSelect.value;
        renderRaceGrid();
      });
    }

    const calledOnly = $("calledOnly");
    if (calledOnly) {
      calledOnly.addEventListener("change", function () {
        app.calledOnly = calledOnly.checked;
        renderRaceGrid();
      });
    }

    const refreshBtn = $("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        if (app.isRefreshing) return;
        if (app.phase === "final") {
          showToast("Coverage ended at 2:00 AM ET. This is the final snapshot.");
          return;
        }
        refreshAll("manual");
      });
    }

    const grid = $("raceGrid");
    if (grid) {
      grid.addEventListener("click", function (ev) {
        const card = ev.target.closest(".race-card");
        if (card) openRace(Number(card.dataset.raceId));
      });
    }

    const latestCalls = $("latestCalls");
    if (latestCalls) {
      latestCalls.addEventListener("click", function (ev) {
        const item = ev.target.closest(".call-item");
        if (item && item.dataset.raceId) openRace(Number(item.dataset.raceId));
      });
    }

    const modal = $("raceModal");
    const modalClose = $("modalClose");
    if (modalClose) {
      modalClose.addEventListener("click", function () { if (modal) modal.close(); });
    }
    if (modal) {
      modal.addEventListener("click", function (ev) {
        if (ev.target === modal) modal.close();
      });
      modal.addEventListener("close", function () {
        document.body.classList.remove("modal-open");
        app.modalId = null;
      });
    }

    document.addEventListener("keydown", function (ev) {
      const tag = (ev.target && ev.target.tagName) || "";
      if (ev.key === "/" && app.openChamber && !/INPUT|TEXTAREA|SELECT/.test(tag)) {
        ev.preventDefault();
        if (search) search.focus();
      }
    });

    window.addEventListener("online", function () {
      showToast("Network restored. Refreshing the results desk.");
      if (app.phase !== "final") refreshAll("manual");
    });
    window.addEventListener("offline", function () {
      showToast("Network connection lost — keeping the last results.", true);
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) updateClocks();
    });
  }


  /* ---------- Modal ---------- */

  function modalStatusPill(race) {
    if (race.called) return '<span class="pill called">CALLED</span>';
    if (race.totalVotes > 0) return '<span class="pill live">' + race.reporting + '% REPORTING</span>';
    return '<span class="pill neutral">AWAITING VOTES</span>';
  }

  function modalSummaryHtml(race) {
    const ordered = orderedCandidates(race);
    const cands = ordered.map(function (c) {
      const pct = race.totalVotes > 0 ? formatPct(c.percent) : "—";
      const winner = c.winner ? '<span class="winner-tag">WINNER</span>' : "";
      const inc = isIncumbent(race, c) ? ' <span class="inc">INC</span>' : "";
      const width = race.totalVotes > 0 ? clamp(c.percent, 0, 100) : 0;
      return '<div class="modal-cand">' +
        '<div class="modal-cand-top">' +
          '<span class="party-dot ' + partyClass(c.party) + '"></span>' +
          '<span class="modal-cand-name">' + escapeHtml(c.name) + inc + winner + '</span>' +
          '<span class="modal-cand-votes">' + (race.totalVotes > 0 ? formatVotes(c.votes) + ' votes' : 'No votes reported') + '</span>' +
          '<span class="modal-cand-pct">' + pct + '</span>' +
        '</div>' +
        '<div class="modal-cand-bar"><span style="width:' + width + '%;background:' + (c.party === "D" ? "var(--dem)" : c.party === "R" ? "var(--gop)" : "var(--gold)") + '"></span></div>' +
      '</div>';
    }).join("");

    return '<div class="modal-status">' +
        modalStatusPill(race) +
        '<span>' + (POLL_CLOSE[race.state] ? 'Polls close ' + POLL_CLOSE[race.state] + ' ET' : '') + '</span>' +
        '<span>Source: civicAPI</span>' +
      '</div>' +
      '<div class="modal-summary">' +
        '<div class="modal-stat"><b>' + (race.totalVotes > 0 ? formatVotes(race.totalVotes) : '—') + '</b><span>Total votes</span></div>' +
        '<div class="modal-stat"><b>' + (race.margin != null ? formatMargin(race.margin) : '—') + '</b><span>Margin</span></div>' +
        '<div class="modal-stat"><b>' + race.reporting + '%</b><span>Reporting</span></div>' +
        '<div class="modal-stat"><b>' + (race.called ? 'CALLED' : 'OPEN') + '</b><span>Status</span></div>' +
      '</div>' +
      '<div class="modal-section-title">Candidates</div>' +
      '<div class="modal-cands">' + cands + '</div>' +
      '<p class="modal-note">Unofficial results. Vote totals and race calls can change as ballots are counted. Source: civicAPI.</p>';
  }

  function setModalHeader(race) {
    setText("modalKicker", officeLabel(race) + (race.district ? " • " + race.district : " • " + race.state));
    setText("modalTitle", titleFor(race));
    setText("modalSub", "UNOFFICIAL RESULTS • SOURCE: CIVICAPI");
  }

  function openRace(id) {
    const race = app.races.find(function (r) { return r.id === id; });
    const modal = $("raceModal");
    const body = $("modalBody");
    if (!race || !modal || !body) return;

    app.modalId = id;
    setModalHeader(race);
    body.innerHTML = modalSummaryHtml(race) +
      '<div class="modal-section-title">County detail</div>' +
      '<p class="modal-note" style="border-top:0;padding-top:0;">Loading county-level results from the source feed…</p>';

    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    document.body.classList.add("modal-open");

    const close = $("modalClose");
    if (close) close.focus();

    fetchJSON(API_BASE + "/race/" + encodeURIComponent(id), 14000).then(function (detail) {
      if (app.modalId !== id) return;

      const fresh = normalizeRaw({
        id: race.id,
        type: race.office === "S" ? "US Senate" : "House of Representatives",
        province: race.state,
        district: race.district,
        election_name: race.name,
        percent_reporting: detail.percent_reporting,
        candidates: detail.candidates || race.candidates
      });
      fresh.calledAt = race.calledAt;
      fresh.newCall = race.newCall;

      body.innerHTML = modalSummaryHtml(fresh) + countyHtml(detail, fresh);
    }).catch(function () {
      if (app.modalId !== id) return;
      body.innerHTML = modalSummaryHtml(race) +
        '<div class="modal-section-title">County detail</div>' +
        '<p class="modal-note" style="border-top:0;padding-top:0;">County-level detail is not available right now. The statewide summary above is from the most recent data check.</p>';
    });
  }

  function countyHtml(detail, race) {
    const regions = detail && detail.region_results ? Object.values(detail.region_results) : [];
    const rows = regions.map(function (region) {
      const cs = (region.candidates || []).slice().sort(function (a, b) {
        return (Number(b.votes) || 0) - (Number(a.votes) || 0);
      });
      const total = cs.reduce(function (sum, c) { return sum + (Number(c.votes) || 0); }, 0);
      return {
        name: region.name || "County",
        total: total,
        leader: cs[0] || null,
        reporting: region.percent_reporting
      };
    }).filter(function (r) { return r.total > 0 && r.leader; })
      .sort(function (a, b) { return b.total - a.total; });

    if (!rows.length) {
      return '<div class="modal-section-title">County detail</div>' +
        '<p class="modal-note" style="border-top:0;padding-top:0;">No county-level votes have been reported yet.</p>';
    }

    const shown = rows.slice(0, 12);
    return '<div class="modal-section-title">County detail — top ' + shown.length + ' by votes</div>' +
      '<div class="county-list">' + shown.map(function (r) {
        return '<div class="county-row">' +
          '<span class="county-name">' + escapeHtml(r.name) + '</span>' +
          '<span class="county-lead">' + escapeHtml(r.leader.name) + ' ' + formatPct(r.leader.percent) + '</span>' +
          '<span class="county-rep">' + (r.reporting != null ? r.reporting + '% in' : '') + '</span>' +
          '</div>';
      }).join("") + '</div>' +
      (rows.length > shown.length ? '<p class="modal-note">Showing the top ' + shown.length + ' of ' + rows.length + ' reporting counties.</p>' : '') +
      '<p class="modal-note">County results are unofficial and may lag the statewide totals.</p>';
  }

  /* ---------- Toast ---------- */

  function showToast(message, isError) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "toast show" + (isError ? " error" : "");
    clearTimeout(app.toastTimer);
    app.toastTimer = setTimeout(function () {
      toast.className = "toast";
    }, 3600);
  }

  /* ---------- Initialization ---------- */

  function init() {
    bindEvents();

    const seed = window.ELECTION_SEED || null;
    const seedTime = seed && seed.generatedAt ? new Date(seed.generatedAt).getTime() : 0;
    let races = decodeSeed(seed);

    const cache = loadCache(seedTime);
    if (cache && races.length) {
      app.races = sortRaces(cache.races);
      app.lastChecked = new Date(cache.savedAt);
      app.lastSuccessAt = new Date(cache.savedAt);
      app.dataSource = "cache";
    } else {
      app.races = sortRaces(races);
      if (seedTime) {
        app.lastChecked = new Date(seedTime);
        app.lastSuccessAt = new Date(seedTime);
      }
      app.dataSource = "seed";
    }

    app.phase = getPhase(nowMs());
    app.nextRefresh = computeNextRefresh(nowMs());

    updateChamberButtons();
    populateStateFilter();
    renderAll();
    updateClocks();

    setInterval(function () {
      const t = nowMs();
      const nextPhase = getPhase(t);

      if (nextPhase !== app.phase) {
        const prev = app.phase;
        app.phase = nextPhase;
        app.nextRefresh = computeNextRefresh(t);

        if (prev === "pre" && nextPhase === "live") {
          renderAll();
          refreshAll("start");
        } else if (nextPhase === "final") {
          app.nextRefresh = null;
          renderAll();
          showToast("Coverage window complete. Auto-refresh stopped at 2:00 AM ET.");
        } else {
          renderAll();
        }
      }

      updateClocks(t);

      if (app.phase === "live" && !app.isRefreshing && app.nextRefresh && t >= app.nextRefresh) {
        refreshAll("auto");
      }
    }, 1000);

    // Preview mode exposes the in-memory desk so the layout can be tested with
    // sample vote totals without changing production behavior.
    if (PREVIEW) {
      window.__AMERICAN_DECISION__ = { app: app, renderAll: renderAll, refreshAll: refreshAll };
    }

    // Initial fetch populates the latest snapshot and, before 6 PM, gives the
    // pre-show a fresh data check. The automatic 15-minute cadence begins at 6 PM.
    refreshAll("initial");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


