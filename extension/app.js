(function () {
  "use strict";

  var DATA = null;
  var PROV_GEO = window.PK_PROVINCES_GEO;
  var WORLD_TOPO = window.PK_WORLD_TOPO;
  var YEARS = [];
  var PROVINCES = [];

  var RAW_PARTY_COLOR = {
    "PPP": "#E4002B", "PPPP": "#E4002B",
    "PML-N": "#015B33", "PML(N)": "#015B33",
    "PML-Q": "#1F8A4C", "PML-Q (Q)": "#1F8A4C", "PML-Coun": "#1F8A4C",
    "PTI": "#DF1E1E",
    "MQM": "#D4A017", "MQM-P": "#D4A017",
    "ANP": "#D32F2F",
    "JUI-F": "#2E7D32", "JUI": "#2E7D32", "JUI-W.P": "#2E7D32",
    "JI": "#0D47A1",
    "BNP": "#6D4C41",
    "IND": "#8A8F98",
    "IND (PTI)": "#F2994A",
    "IJI": "#3F9142",
    "Pakistan Muslim League(QA)": "#2F9E58",
    "Muttahidda Majlis-e-Amal Pakistan": "#1565C0",
    "PDA": "#C23047"
  };

  var THEME = {
    dark: {
      text: "#e8edf2", textMid: "#aab4c2", textLo: "#6b7686",
      tooltipBg: "#0d1319", tooltipBorder: "#223",
      gridLine: "rgba(255,255,255,0.06)", axisLine: "rgba(255,255,255,0.12)",
      mapNoData: "#1b232e", mapBorder: "rgba(255,255,255,0.18)",
      globeOcean1: "#1a2e3d", globeOcean2: "#070c10", globeLand: "#2b3a33",
      globeGraticule: "rgba(255,255,255,0.07)", globeLandStroke: "rgba(255,255,255,0.1)", globeOuterStroke: "rgba(255,255,255,0.12)",
      othersBar: "#4b5563"
    },
    light: {
      text: "#161b22", textMid: "#4b5668", textLo: "#8a94a6",
      tooltipBg: "#ffffff", tooltipBorder: "#d8dee6",
      gridLine: "rgba(15,23,32,0.08)", axisLine: "rgba(15,23,32,0.18)",
      mapNoData: "#dde2e7", mapBorder: "rgba(15,23,32,0.18)",
      globeOcean1: "#dbe6ee", globeOcean2: "#aebfcc", globeLand: "#8fa892",
      globeGraticule: "rgba(15,23,32,0.14)", globeLandStroke: "rgba(15,23,32,0.15)", globeOuterStroke: "rgba(15,23,32,0.2)",
      othersBar: "#9aa3b2"
    }
  };
  var currentTheme = "dark";
  function T() { return THEME[currentTheme]; }
  var THEME_STORAGE_KEY = "pk_elections_theme";
  function getStoredTheme() {
    try { return localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { return null; }
  }
  function setStoredTheme(t) {
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch (e) { /* storage unavailable */ }
  }
  function applyTheme(theme) {
    currentTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    setStoredTheme(currentTheme);
    if (!DATA) return;
    renderPowerChart(state.year);
    renderTurnoutChart(state.year);
    renderProvinceChart(state.year);
    renderTopPartiesChart();
    if (mapInitialized) { renderPakMap(); recolorGlobe(); }
  }
  (function initThemeEarly() {
    var stored = getStoredTheme();
    currentTheme = stored === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
  })();

  var CAPTIONS = {
    "1970": "Pakistan's first direct general election under universal adult franchise. The Awami League swept East Pakistan while the PPP led in the West — a divide that preceded the 1971 split.",
    "1977": "The PPP won a landslide amid opposition claims of rigging. Unrest followed, and the result was set aside by a military takeover months later.",
    "1988": "The first election after General Zia's rule ended — the PPP, led by Benazir Bhutto, formed the government.",
    "1990": "The IJI alliance, led by the PML, swept to power following the earlier dismissal of the Bhutto government.",
    "1993": "The PPP returned to power under Benazir Bhutto after the PML-N government was dismissed earlier that year.",
    "1997": "The PML-N won a landmark two-thirds majority under Nawaz Sharif.",
    "2002": "The first election after the 1999 military takeover. PML-Q emerged as the largest party and formed a coalition government.",
    "2008": "Held months after Benazir Bhutto's assassination, this election saw the PPP win the most seats and lead a coalition government.",
    "2013": "The PML-N returned to power with a majority — Pakistan's first civilian-to-civilian democratic transition.",
    "2018": "The PTI, led by Imran Khan, became the largest party for the first time and formed a coalition government.",
    "2024": "A closely contested race: independents (many backed by PTI) won the most seats, with a PML-N-led coalition eventually forming the government."
  };

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
  function colorForParty(name) {
    if (!name) return "#4b5563";
    if (RAW_PARTY_COLOR[name]) return RAW_PARTY_COLOR[name];
    var h = hashStr(name) % 360;
    return "hsl(" + h + " 50% 50%)";
  }
  function compactNum(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return Math.round(n).toLocaleString();
  }
  function fullNum(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Math.round(n).toLocaleString();
  }
  function pct(n, d) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return n.toFixed(d === undefined ? 1 : d) + "%";
  }

  var seatsByYear = {};
  function recomputeDerived() {
    YEARS = DATA.meta.years;
    PROVINCES = DATA.meta.provinces;
    seatsByYear = {};
    YEARS.forEach(function (y) { seatsByYear[y] = DATA.seats.filter(function (s) { return s.year === y; }); });
  }

  function nationalRecord(year) {
    for (var i = 0; i < DATA.national_trend.length; i++) if (DATA.national_trend[i].year === year) return DATA.national_trend[i];
    return null;
  }
  function leadingPartyForYear(year) {
    var counts = {};
    seatsByYear[year].forEach(function (s) { if (s.winner_party) counts[s.winner_party] = (counts[s.winner_party] || 0) + 1; });
    var best = null, bestN = -1;
    Object.keys(counts).forEach(function (p) { if (counts[p] > bestN) { bestN = counts[p]; best = p; } });
    return { party: best, seats: bestN };
  }
  function topPartiesForYear(year, topN) {
    var counts = {};
    seatsByYear[year].forEach(function (s) { if (s.winner_party) counts[s.winner_party] = (counts[s.winner_party] || 0) + 1; });
    var sorted = Object.keys(counts).map(function (p) { return [p, counts[p]]; }).sort(function (a, b) { return b[1] - a[1]; });
    return sorted.slice(0, topN).map(function (x) { return x[0]; });
  }

  // ===================================================================
  // State
  // ===================================================================
  var state = {
    year: null,
    tab: "overview",
    table: { search: "", year: null, province: "ALL", sortKey: "winner_votes", sortDir: "desc", page: 1, pageSize: 12 },
    mapMetric: "party",
    isPlaying: false,
    playTimer: null,
    playStepMs: 5200
  };

  // ===================================================================
  // Year pills
  // ===================================================================
  var yearPillsEl = document.getElementById("yearPills");
  function renderYearPills() {
    yearPillsEl.innerHTML = "";
    YEARS.forEach(function (y) {
      var btn = document.createElement("button");
      btn.className = "year-pill" + (y === state.year ? " active" : "");
      btn.textContent = y;
      btn.dataset.year = y;
      btn.addEventListener("click", function () {
        if (state.isPlaying) stopExplainer();
        selectYear(y);
      });
      yearPillsEl.appendChild(btn);
    });
  }

  function setActivePill(year) {
    Array.prototype.forEach.call(yearPillsEl.children, function (el) {
      el.classList.toggle("active", el.dataset.year === year);
      el.classList.toggle("playing", state.isPlaying && el.dataset.year === year);
    });
  }

  // ===================================================================
  // Theme toggle
  // ===================================================================
  document.getElementById("themeToggle").addEventListener("click", function () {
    applyTheme(currentTheme === "light" ? "dark" : "light");
  });

  // ===================================================================
  // KPI row
  // ===================================================================
  var kpiRowEl = document.getElementById("kpiRow");
  function renderKPIs(year) {
    var rec = nationalRecord(year);
    var idx = YEARS.indexOf(year);
    var prevRec = idx > 0 ? nationalRecord(YEARS[idx - 1]) : null;
    var lead = leadingPartyForYear(year);

    function delta(curr, prev, fmt) {
      if (prev === null || curr === null || curr === undefined || prev === undefined) return "";
      var d = curr - prev;
      if (Math.abs(d) < 1e-9) return "<span class=\"delta\">No change vs " + YEARS[idx - 1] + "</span>";
      var dir = d > 0 ? "up" : "down";
      var arrow = d > 0 ? "↑" : "↓";
      return "<span class=\"delta " + dir + "\">" + arrow + " " + fmt(Math.abs(d)) + " vs " + YEARS[idx - 1] + "</span>";
    }

    var cards = [
      { lbl: "Seats contested", val: fullNum(rec.seats), sfx: "", accent: "var(--flag-green-br)", delta: "" },
      { lbl: "Registered voters", val: compactNum(rec.registered_voters), sfx: "", accent: "var(--flag-gold)", delta: prevRec ? delta(rec.registered_voters, prevRec.registered_voters, compactNum) : "" },
      { lbl: "Votes cast", val: compactNum(rec.votes_cast), sfx: "", accent: "var(--accent-blue)", delta: prevRec ? delta(rec.votes_cast, prevRec.votes_cast, compactNum) : "" },
      { lbl: "National turnout", val: pct(rec.turnout_pct), sfx: "", accent: "var(--flag-green-br)", delta: prevRec ? delta(rec.turnout_pct, prevRec.turnout_pct, function (v) { return v.toFixed(1) + "pp"; }) : "" },
      { lbl: "Parties contested", val: fullNum(rec.parties_contested), sfx: "", accent: "var(--accent-red)", delta: "" },
      { lbl: "Leading party", val: lead.party || "—", sfx: lead.seats + " seats", accent: colorForParty(lead.party), delta: "" }
    ];

    kpiRowEl.innerHTML = cards.map(function (c) {
      return '<div class="kpi" style="--kpi-accent:' + c.accent + '">' +
        '<div class="lbl">' + c.lbl + "</div>" +
        '<div class="val">' + c.val + (c.sfx ? '<span class="sfx">' + c.sfx + "</span>" : "") + "</div>" +
        (c.delta || "") +
        "</div>";
    }).join("");
  }

  // ===================================================================
  // Power chart (stacked horizontal bars, six-party-group blocs)
  // ===================================================================
  var chartPower = echarts.init(document.getElementById("chartPower"));
  function renderPowerLegend() {
    var sg = DATA.sixgroup_trend;
    document.getElementById("powerLegend").innerHTML = sg.groups.map(function (g) {
      return '<span class="chip"><span class="sw" style="background:' + sg.colors[g] + '"></span>' + g + "</span>";
    }).join("");
  }

  function buildPowerSeries(selectedYear) {
    var sg = DATA.sixgroup_trend;
    var selIdx = YEARS.indexOf(selectedYear);
    return sg.groups.map(function (g) {
      return {
        name: g, type: "bar", stack: "s",
        itemStyle: { color: sg.colors[g] },
        data: sg.series[g].map(function (v, i) {
          return { value: v, itemStyle: { opacity: i === selIdx ? 1 : 0.42 } };
        })
      };
    });
  }
  function renderPowerChart(selectedYear) {
    chartPower.setOption({
      backgroundColor: "transparent",
      grid: { left: 46, right: 18, top: 6, bottom: 24 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: T().tooltipBg, borderColor: T().tooltipBorder, textStyle: { color: T().text, fontSize: 12 } },
      xAxis: { type: "value", axisLabel: { color: T().textLo, fontSize: 11 }, splitLine: { lineStyle: { color: T().gridLine } } },
      yAxis: { type: "category", data: YEARS, axisLabel: { color: T().textMid, fontSize: 12, fontFamily: "Chivo Mono, monospace" }, axisLine: { show: false }, axisTick: { show: false } },
      series: buildPowerSeries(selectedYear)
    }, true);
  }

  // ===================================================================
  // Turnout / registration combo chart
  // ===================================================================
  var chartTurnout = echarts.init(document.getElementById("chartTurnout"));
  function renderTurnoutChart(selectedYear) {
    var years = DATA.national_trend.map(function (r) { return r.year; });
    var turnout = DATA.national_trend.map(function (r) { return r.turnout_pct; });
    var registered = DATA.national_trend.map(function (r) { return r.registered_voters; });
    var selIdx = years.indexOf(selectedYear);
    chartTurnout.setOption({
      backgroundColor: "transparent",
      grid: { left: 42, right: 46, top: 18, bottom: 28 },
      tooltip: {
        trigger: "axis", backgroundColor: T().tooltipBg, borderColor: T().tooltipBorder, textStyle: { color: T().text, fontSize: 12 },
        formatter: function (params) {
          var y = params[0].axisValue;
          var lines = ["<b>" + y + "</b>"];
          params.forEach(function (p) {
            if (p.seriesName === "Turnout %") lines.push("Turnout: " + p.data.toFixed(1) + "%");
            else lines.push("Registered voters: " + fullNum(p.data));
          });
          return lines.join("<br/>");
        }
      },
      legend: { data: ["Turnout %", "Registered voters"], top: 0, textStyle: { color: T().textMid, fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
      xAxis: { type: "category", data: years, axisLabel: { color: T().textLo, fontSize: 11, fontFamily: "Chivo Mono, monospace" }, axisLine: { lineStyle: { color: T().axisLine } } },
      yAxis: [
        { type: "value", min: 0, max: 100, axisLabel: { color: T().textLo, fontSize: 11, formatter: "{value}%" }, splitLine: { lineStyle: { color: T().gridLine } } },
        { type: "value", axisLabel: { color: T().textLo, fontSize: 11, formatter: function (v) { return compactNum(v); } }, splitLine: { show: false } }
      ],
      series: [
        { name: "Registered voters", type: "bar", yAxisIndex: 1, data: registered, itemStyle: { color: "rgba(216,180,92,0.35)", borderRadius: [4, 4, 0, 0] }, barWidth: "46%" },
        {
          name: "Turnout %", type: "line", yAxisIndex: 0, data: turnout, smooth: true, symbolSize: 7,
          lineStyle: { color: "#16a35f", width: 3 }, itemStyle: { color: "#16a35f" },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(22,163,95,0.35)" }, { offset: 1, color: "rgba(22,163,95,0)" }] } },
          markPoint: selIdx >= 0 ? { data: [{ coord: [selIdx, turnout[selIdx]], itemStyle: { color: "#d8b45c" } }], symbolSize: 14, label: { show: false } } : undefined
        }
      ]
    }, true);
  }

  // ===================================================================
  // Province bar chart (selected year)
  // ===================================================================
  var chartProvince = echarts.init(document.getElementById("chartProvince"));
  function renderProvinceChart(year) {
    document.getElementById("provYearLbl").textContent = year;
    var top = topPartiesForYear(year, 6);
    var pyps = DATA.province_year_party_seats[year] || {};
    var series = top.map(function (party) {
      return {
        name: party, type: "bar", stack: "s", itemStyle: { color: colorForParty(party) },
        data: PROVINCES.map(function (p) { return (pyps[p] && pyps[p][party]) || 0; })
      };
    });
    var others = PROVINCES.map(function (p) {
      var obj = pyps[p] || {};
      var total = 0; Object.keys(obj).forEach(function (k) { total += obj[k]; });
      var topSum = 0; top.forEach(function (tp) { topSum += (obj[tp] || 0); });
      return Math.max(0, total - topSum);
    });
    series.push({ name: "Others", type: "bar", stack: "s", itemStyle: { color: T().othersBar }, data: others });

    chartProvince.setOption({
      backgroundColor: "transparent",
      grid: { left: 70, right: 18, top: 8, bottom: 28 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: T().tooltipBg, borderColor: T().tooltipBorder, textStyle: { color: T().text, fontSize: 12 } },
      legend: { top: 0, right: 0, textStyle: { color: T().textMid, fontSize: 10.5 }, itemWidth: 10, itemHeight: 8, type: "scroll" },
      xAxis: { type: "value", axisLabel: { color: T().textLo, fontSize: 11 }, splitLine: { lineStyle: { color: T().gridLine } } },
      yAxis: { type: "category", data: PROVINCES, axisLabel: { color: T().textMid, fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
      series: series
    }, true);
  }

  // ===================================================================
  // Top parties all-time
  // ===================================================================
  var chartTopParties = echarts.init(document.getElementById("chartTopParties"));
  function renderTopPartiesChart() {
    var rows = DATA.top_parties_all_time.slice().reverse();
    chartTopParties.setOption({
      backgroundColor: "transparent",
      grid: { left: 96, right: 24, top: 6, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: T().tooltipBg, borderColor: T().tooltipBorder, textStyle: { color: T().text, fontSize: 12 } },
      xAxis: { type: "value", axisLabel: { color: T().textLo, fontSize: 11 }, splitLine: { lineStyle: { color: T().gridLine } } },
      yAxis: { type: "category", data: rows.map(function (r) { return r.party; }), axisLabel: { color: T().textMid, fontSize: 11.5 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: "bar", data: rows.map(function (r) { return { value: r.seats, itemStyle: { color: r.party === "Others" ? T().othersBar : colorForParty(r.party) } }; }),
        barWidth: "62%", label: { show: true, position: "right", color: T().textMid, fontSize: 11, fontFamily: "Chivo Mono, monospace" }
      }]
    }, true);
  }

  // ===================================================================
  // Constituency explorer table
  // ===================================================================
  var tblYearSel = document.getElementById("tblYearSel");
  var tblProvSel = document.getElementById("tblProvSel");
  function populateTableSelects() {
    tblYearSel.innerHTML = '<option value="ALL">All years</option>' + YEARS.map(function (y) { return '<option value="' + y + '">' + y + "</option>"; }).join("");
    tblProvSel.innerHTML = '<option value="ALL">All provinces</option>' + PROVINCES.map(function (p) { return '<option value="' + p + '">' + p + "</option>"; }).join("");
    tblYearSel.value = state.table.year;
  }

  document.getElementById("tblSearch").addEventListener("input", function (e) { state.table.search = e.target.value.toLowerCase(); state.table.page = 1; renderTable(); });
  tblYearSel.addEventListener("change", function (e) { state.table.year = e.target.value; state.table.page = 1; renderTable(); });
  tblProvSel.addEventListener("change", function (e) { state.table.province = e.target.value; state.table.page = 1; renderTable(); });
  Array.prototype.forEach.call(document.querySelectorAll("#dataTable thead th"), function (th) {
    th.addEventListener("click", function () {
      var key = th.dataset.key;
      if (state.table.sortKey === key) { state.table.sortDir = state.table.sortDir === "asc" ? "desc" : "asc"; }
      else { state.table.sortKey = key; state.table.sortDir = "desc"; }
      Array.prototype.forEach.call(document.querySelectorAll("#dataTable thead th"), function (t) { t.classList.remove("sorted", "asc", "desc"); });
      th.classList.add("sorted", state.table.sortDir);
      renderTable();
    });
  });
  document.getElementById("pgPrev").addEventListener("click", function () { if (state.table.page > 1) { state.table.page--; renderTable(); } });
  document.getElementById("pgNext").addEventListener("click", function () { state.table.page++; renderTable(); });

  function partyTag(name) {
    if (!name) return "—";
    return '<span class="party-tag"><span class="sw" style="background:' + colorForParty(name) + '"></span>' + name + "</span>";
  }

  function renderTable() {
    var t = state.table;
    document.getElementById("tblYearLbl").textContent = t.year === "ALL" ? "All years" : t.year;
    var rows = DATA.seats.filter(function (s) {
      if (t.year !== "ALL" && s.year !== t.year) return false;
      if (t.province !== "ALL" && s.province !== t.province) return false;
      if (t.search) {
        var hay = (s.constituency + " " + s.winner_candidate + " " + s.winner_party + " " + (s.runner_up_party || "")).toLowerCase();
        if (hay.indexOf(t.search) === -1) return false;
      }
      return true;
    });
    rows.sort(function (a, b) {
      var av = a[t.sortKey], bv = b[t.sortKey];
      if (av === null || av === undefined) av = typeof bv === "number" ? -Infinity : "";
      if (bv === null || bv === undefined) bv = typeof av === "number" ? -Infinity : "";
      if (typeof av === "string") { av = av.toLowerCase(); bv = (bv || "").toLowerCase(); }
      var cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return t.sortDir === "asc" ? cmp : -cmp;
    });

    var total = rows.length;
    var maxPage = Math.max(1, Math.ceil(total / t.pageSize));
    if (t.page > maxPage) t.page = maxPage;
    var startIdx = (t.page - 1) * t.pageSize;
    var pageRows = rows.slice(startIdx, startIdx + t.pageSize);

    document.getElementById("tblBody").innerHTML = pageRows.map(function (r) {
      return "<tr>" +
        '<td class="strong">' + r.constituency + " <span style=\"color:var(--text-lo);font-weight:500\">(" + r.year + ")</span></td>" +
        "<td>" + (r.province || "—") + "</td>" +
        "<td>" + partyTag(r.winner_party) + "</td>" +
        "<td>" + (r.winner_candidate || "—") + "</td>" +
        '<td class="strong mono">' + fullNum(r.winner_votes) + "</td>" +
        "<td>" + partyTag(r.runner_up_party) + "</td>" +
        '<td class="mono">' + (r.margin !== null && r.margin !== undefined ? fullNum(r.margin) : "—") + "</td>" +
        '<td class="mono">' + (r.turnout !== null && r.turnout !== undefined ? r.turnout.toFixed(1) + "%" : "—") + "</td>" +
        "</tr>";
    }).join("");

    document.getElementById("tblCount").textContent = total.toLocaleString() + " seats";
    document.getElementById("pgInfo").textContent = "Page " + t.page + " of " + maxPage;
    document.getElementById("pgPrev").disabled = t.page <= 1;
    document.getElementById("pgNext").disabled = t.page >= maxPage;
  }

  // ===================================================================
  // Tabs
  // ===================================================================
  var mapInitialized = false;
  Array.prototype.forEach.call(document.querySelectorAll(".tab-btn"), function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
  });
  function switchTab(tab) {
    state.tab = tab;
    Array.prototype.forEach.call(document.querySelectorAll(".tab-btn"), function (b) { b.classList.toggle("active", b.dataset.tab === tab); });
    document.getElementById("tabOverview").classList.toggle("active", tab === "overview");
    document.getElementById("tabMap").classList.toggle("active", tab === "map");
    if (tab === "map") {
      if (!mapInitialized) { initGlobe(); initPakMap(); mapInitialized = true; }
      requestAnimationFrame(function () {
        pakMapChart.resize();
        chartProvinceDetail.resize();
        resizeGlobe();
      });
    }
  }

  // ===================================================================
  // Pakistan choropleth map (ECharts map series)
  // ===================================================================
  echarts.registerMap("PAK_ADM1", PROV_GEO);
  var pakMapChart = echarts.init(document.getElementById("pakMapHost"));
  var chartProvinceDetail = echarts.init(document.getElementById("chartProvinceDetail"));

  document.getElementById("mapMetricSel").addEventListener("change", function (e) {
    state.mapMetric = e.target.value;
    renderPakMap();
  });

  function provinceAverage(year, province, field) {
    var rows = seatsByYear[year].filter(function (s) { return s.province === province && s[field] !== null && s[field] !== undefined; });
    if (!rows.length) return null;
    var sum = 0; rows.forEach(function (r) { sum += r[field]; });
    return sum / rows.length;
  }
  function provinceSum(year, province, field) {
    var rows = seatsByYear[year].filter(function (s) { return s.province === province && s[field] !== null && s[field] !== undefined; });
    if (!rows.length) return null;
    var sum = 0; rows.forEach(function (r) { sum += r[field]; });
    return sum;
  }
  function provinceLeadingParty(year, province) {
    var obj = (DATA.province_year_party_seats[year] || {})[province] || {};
    var best = null, bestN = -1, seats = 0;
    Object.keys(obj).forEach(function (p) { seats += obj[p]; if (obj[p] > bestN) { bestN = obj[p]; best = p; } });
    return { party: best, seats: bestN, totalSeats: seats };
  }

  function initPakMap() { renderPakMap(); pakMapChart.on("click", function (params) { showProvinceDetail(params.name); }); }

  function renderPakMap() {
    var year = state.year;
    document.getElementById("mapYearLbl").textContent = year;
    var metric = state.mapMetric;
    var legendEl = document.getElementById("mapLegend");
    var data = [];
    var visualMap = null;

    if (metric === "party") {
      legendEl.style.display = "flex";
      var legendParts = [];
      PROV_GEO.features.forEach(function (f) {
        var name = f.properties.name;
        if (!f.properties.hasData) { data.push({ name: name, value: null, itemStyle: { areaColor: T().mapNoData } }); return; }
        var lead = provinceLeadingParty(year, name);
        var color = colorForParty(lead.party);
        data.push({ name: name, value: lead.seats, itemStyle: { areaColor: color } });
        if (lead.party) legendParts.push({ party: lead.party, color: color });
      });
      var seen = {};
      legendEl.innerHTML = legendParts.filter(function (lp) { if (seen[lp.party]) return false; seen[lp.party] = true; return true; })
        .map(function (lp) { return '<span class="chip"><span class="sw" style="background:' + lp.color + '"></span>' + lp.party + "</span>"; }).join("") +
        '<span class="chip"><span class="sw" style="background:' + T().mapNoData + '"></span>No NA seats in dataset</span>';
    } else {
      legendEl.style.display = "none"; legendEl.innerHTML = "";
      var field = metric === "turnout" ? "turnout" : metric === "registered" ? "registered" : "margin_pct";
      var vals = [];
      PROV_GEO.features.forEach(function (f) {
        var name = f.properties.name;
        if (!f.properties.hasData) { data.push({ name: name, value: null, itemStyle: { areaColor: T().mapNoData } }); return; }
        var v = metric === "registered" ? provinceSum(year, name, field) : provinceAverage(year, name, field);
        data.push({ name: name, value: v });
        if (v !== null) vals.push(v);
      });
      var vmin = vals.length ? Math.min.apply(null, vals) : 0;
      var vmax = vals.length ? Math.max.apply(null, vals) : 1;
      visualMap = {
        min: vmin, max: vmax, left: 10, bottom: 10, calculable: true, orient: "horizontal",
        textStyle: { color: T().textMid, fontSize: 10 },
        inRange: { color: metric === "registered" ? ["#2a2410", "#d8b45c"] : ["#0e2a1e", "#16a35f"] }
      };
    }

    pakMapChart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item", backgroundColor: T().tooltipBg, borderColor: T().tooltipBorder, textStyle: { color: T().text, fontSize: 12 },
        formatter: function (p) {
          if (!p.data || p.data.value === null || p.data.value === undefined) return "<b>" + p.name + "</b><br/>No National Assembly seats in this dataset";
          if (metric === "party") {
            var lead = provinceLeadingParty(year, p.name);
            return "<b>" + p.name + "</b><br/>Leading: " + (lead.party || "—") + " (" + lead.seats + "/" + lead.totalSeats + " seats)";
          }
          if (metric === "turnout") return "<b>" + p.name + "</b><br/>Avg. turnout: " + p.data.value.toFixed(1) + "%";
          if (metric === "registered") return "<b>" + p.name + "</b><br/>Registered voters: " + fullNum(p.data.value);
          return "<b>" + p.name + "</b><br/>Avg. winning margin: " + p.data.value.toFixed(1) + "%";
        }
      },
      visualMap: visualMap,
      series: [{
        type: "map", map: "PAK_ADM1", roam: true, scaleLimit: { min: 0.8, max: 6 },
        label: { show: true, color: "#cdd5df", fontSize: 10.5 },
        itemStyle: { borderColor: T().mapBorder, borderWidth: 1 },
        emphasis: { label: { color: "#fff" }, itemStyle: { borderColor: "#d8b45c", borderWidth: 2, shadowBlur: 14, shadowColor: "rgba(216,180,92,0.6)" } },
        select: { itemStyle: { borderColor: "#d8b45c", borderWidth: 2.5 } },
        data: data
      }]
    }, true);
  }

  function showProvinceDetail(province) {
    var feat = PROV_GEO.features.filter(function (f) { return f.properties.name === province; })[0];
    if (!feat || !feat.properties.hasData) {
      document.getElementById("provinceDetailTitle").textContent = province + " — no National Assembly seats in this dataset";
      document.getElementById("provinceDetailNote").textContent = "";
      chartProvinceDetail.clear();
      return;
    }
    var year = state.year;
    var lead = provinceLeadingParty(year, province);
    document.getElementById("provinceDetailTitle").textContent = province + " — " + year + " breakdown";
    document.getElementById("provinceDetailNote").textContent = lead.totalSeats + " seats decided";
    var obj = (DATA.province_year_party_seats[year] || {})[province] || {};
    var rows = Object.keys(obj).map(function (p) { return [p, obj[p]]; }).sort(function (a, b) { return b[1] - a[1]; });
    chartProvinceDetail.setOption({
      backgroundColor: "transparent",
      grid: { left: 90, right: 24, top: 6, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: T().tooltipBg, borderColor: T().tooltipBorder, textStyle: { color: T().text, fontSize: 12 } },
      xAxis: { type: "value", axisLabel: { color: T().textLo, fontSize: 11 }, splitLine: { lineStyle: { color: T().gridLine } } },
      yAxis: { type: "category", data: rows.map(function (r) { return r[0]; }).reverse(), axisLabel: { color: T().textMid, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: "bar", barWidth: "55%",
        data: rows.map(function (r) { return { value: r[1], itemStyle: { color: colorForParty(r[0]) } }; }).reverse(),
        label: { show: true, position: "right", color: T().textMid, fontSize: 11 }
      }]
    }, true);
  }

  // ===================================================================
  // Rotating globe (d3-geo orthographic, no WebGL -> safe inside Tableau's
  // sandboxed extension iframe)
  // ===================================================================
  var globeSvg, globeProjection, globePath, globeTimer;
  var globeOceanCircle, globeGradStop1, globeGradStop2, globeGraticuleSel, globeLandPath, globeLabelText;
  var PAK_CENTER = [69.3451, 30.3753];

  function recolorGlobe() {
    if (!globeSvg) return;
    globeGradStop1.attr("stop-color", T().globeOcean1);
    globeGradStop2.attr("stop-color", T().globeOcean2);
    globeOceanCircle.attr("stroke", T().globeOuterStroke);
    globeGraticuleSel.attr("stroke", T().globeGraticule);
    globeLandPath.attr("fill", T().globeLand).attr("stroke", T().globeLandStroke);
    globeLabelText.attr("fill", T().textMid);
  }

  function resizeGlobe() {
    var host = document.getElementById("globeHost");
    var w = host.clientWidth || 300, h = host.clientHeight || 380;
    if (globeSvg) { globeSvg.attr("viewBox", "0 0 " + w + " " + h); }
    if (globeProjection) {
      var r = Math.min(w, h) / 2 - 10;
      globeProjection.translate([w / 2, h / 2]).scale(r);
    }
    if (globeSvg) globeSvg.selectAll("path").attr("d", globePath);
  }

  function initGlobe() {
    var host = document.getElementById("globeHost");
    var w = host.clientWidth || 300, h = host.clientHeight || 380;
    var r = Math.min(w, h) / 2 - 10;

    globeProjection = d3.geoOrthographic().scale(r).translate([w / 2, h / 2]).rotate([-PAK_CENTER[0], -PAK_CENTER[1] + 8]).clipAngle(90);
    globePath = d3.geoPath(globeProjection);

    globeSvg = d3.select(host).append("svg").attr("viewBox", "0 0 " + w + " " + h).style("width", "100%").style("height", "100%");

    var defs = globeSvg.append("defs");
    var grad = defs.append("radialGradient").attr("id", "oceanGrad").attr("cx", "35%").attr("cy", "32%");
    globeGradStop1 = grad.append("stop").attr("offset", "0%").attr("stop-color", T().globeOcean1);
    globeGradStop2 = grad.append("stop").attr("offset", "100%").attr("stop-color", T().globeOcean2);

    globeOceanCircle = globeSvg.append("circle").attr("cx", w / 2).attr("cy", h / 2).attr("r", r).attr("fill", "url(#oceanGrad)").attr("stroke", T().globeOuterStroke);

    var graticule = d3.geoGraticule();
    globeGraticuleSel = globeSvg.append("path").datum(graticule()).attr("class", "graticule").attr("d", globePath)
      .attr("fill", "none").attr("stroke", T().globeGraticule).attr("stroke-width", 0.6);

    var land = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.land);
    var landPath = globeSvg.append("path").datum(land).attr("d", globePath)
      .attr("fill", T().globeLand).attr("stroke", T().globeLandStroke).attr("stroke-width", 0.5);
    globeLandPath = landPath;

    var marker = globeSvg.append("circle").attr("r", 5).attr("fill", "#d8b45c").attr("stroke", "#0b0f14").attr("stroke-width", 1.5);
    var pulse = globeSvg.append("circle").attr("r", 5).attr("fill", "none").attr("stroke", "#d8b45c").attr("stroke-width", 1.5).attr("opacity", 0.7);

    globeLabelText = globeSvg.append("text").attr("x", 10).attr("y", h - 14).attr("fill", T().textMid).attr("font-size", 10.5).attr("font-family", "Inter, sans-serif")
      .text("Pakistan • 30.37°N, 69.35°E");

    var t0 = Date.now();
    globeTimer = d3.timer(function () {
      var elapsed = (Date.now() - t0) / 1000;
      var lambda = -PAK_CENTER[0] + elapsed * 4.2;
      globeProjection.rotate([lambda, -PAK_CENTER[1] + 8]);
      landPath.attr("d", globePath);
      globeGraticuleSel.attr("d", globePath);

      var proj = globeProjection(PAK_CENTER);
      var visible = d3.geoDistance(PAK_CENTER, [-lambda, PAK_CENTER[1]]) < 1.5707963267948966;
      if (proj && visible) {
        marker.attr("cx", proj[0]).attr("cy", proj[1]).attr("display", null);
        var pulseR = 5 + (elapsed % 1.6) * 7;
        pulse.attr("cx", proj[0]).attr("cy", proj[1]).attr("r", pulseR).attr("opacity", Math.max(0, 0.7 - (elapsed % 1.6) / 1.6 * 0.7)).attr("display", null);
      } else {
        marker.attr("display", "none");
        pulse.attr("display", "none");
      }
    });
  }

  window.addEventListener("resize", function () {
    chartPower.resize(); chartTurnout.resize(); chartProvince.resize(); chartTopParties.resize();
    if (mapInitialized) { pakMapChart.resize(); chartProvinceDetail.resize(); resizeGlobe(); }
  });

  // ===================================================================
  // Play / Explainer tour
  // ===================================================================
  var playBtn = document.getElementById("playBtn");
  var playBtnLbl = document.getElementById("playBtnLbl");
  var explainBar = document.getElementById("explainBar");
  var explainFill = document.getElementById("explainFill");
  var explainYearEl = document.getElementById("explainYear");
  var explainTextEl = document.getElementById("explainText");
  var fillRaf = null;

  playBtn.addEventListener("click", function () { state.isPlaying ? stopExplainer() : startExplainer(); });
  document.getElementById("explainStop").addEventListener("click", stopExplainer);

  function startExplainer() {
    state.isPlaying = true;
    playBtn.classList.add("is-playing");
    playBtnLbl.textContent = "Pause tour";
    explainBar.classList.add("active");
    switchTab("map");
    tourStep(0);
  }
  function stopExplainer() {
    state.isPlaying = false;
    playBtn.classList.remove("is-playing");
    playBtnLbl.textContent = "Play Explainer";
    explainBar.classList.remove("active");
    if (state.playTimer) { clearTimeout(state.playTimer); state.playTimer = null; }
    if (fillRaf) { cancelAnimationFrame(fillRaf); fillRaf = null; }
    setActivePill(state.year);
  }
  function tourStep(idx) {
    if (!state.isPlaying) return;
    if (idx >= YEARS.length) { stopExplainer(); return; }
    var year = YEARS[idx];
    selectYear(year);
    explainYearEl.textContent = year;
    explainTextEl.textContent = CAPTIONS[year] || "";
    animateFill(state.playStepMs);
    state.playTimer = setTimeout(function () { tourStep(idx + 1); }, state.playStepMs);
  }
  function animateFill(duration) {
    var start = Date.now();
    if (fillRaf) cancelAnimationFrame(fillRaf);
    function step() {
      if (!state.isPlaying) return;
      var p = Math.min(1, (Date.now() - start) / duration);
      explainFill.style.width = (p * 100) + "%";
      if (p < 1) fillRaf = requestAnimationFrame(step);
    }
    step();
  }

  // ===================================================================
  // Global year selection
  // ===================================================================
  function selectYear(year) {
    state.year = year;
    setActivePill(year);
    renderKPIs(year);
    renderPowerChart(year);
    renderTurnoutChart(year);
    renderProvinceChart(year);
    if (mapInitialized) {
      renderPakMap();
      document.getElementById("provinceDetailTitle").textContent = "Click a province to see its breakdown";
      document.getElementById("provinceDetailNote").textContent = "";
      chartProvinceDetail.clear();
    }
    state.table.year = year;
    tblYearSel.value = year;
    state.table.page = 1;
    renderTable();
  }

  // ===================================================================
  // Boot / live-data lifecycle
  // ===================================================================
  function boot(initialData) {
    DATA = initialData;
    recomputeDerived();
    state.year = YEARS[YEARS.length - 1];
    state.table.year = state.year;
    renderYearPills();
    populateTableSelects();
    renderPowerLegend();
    renderTopPartiesChart();
    selectYear(state.year);
  }

  function refresh(newData) {
    DATA = newData;
    recomputeDerived();
    if (YEARS.indexOf(state.year) === -1) state.year = YEARS[YEARS.length - 1];
    renderYearPills();
    populateTableSelects();
    renderPowerLegend();
    renderTopPartiesChart();
    selectYear(state.year);
  }

  window.PK_TABLEAU_SOURCE.init(boot, refresh).then(function (liveOk) {
    var badge = document.getElementById("envBadge");
    var badgeText = document.getElementById("envBadgeText");
    if (liveOk) {
      badgeText.textContent = "Running inside Tableau — live data";
      badge.querySelector(".dot").style.background = "#16a35f";
    } else {
      badgeText.textContent = "Standalone preview";
      boot(window.PK_ELECTIONS_DATA);
    }
  }).catch(function (err) {
    console.warn("Live Tableau data unavailable, using bundled dataset:", err);
    document.getElementById("envBadgeText").textContent = "Standalone preview (live data failed)";
    boot(window.PK_ELECTIONS_DATA);
  });
})();
