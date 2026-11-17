/*
 * Reads live election data from the Tableau worksheet this Viz Extension is
 * running in (via the Tableau Extensions API), and reshapes it into the same
 * dataset shape the dashboard expects (see scripts/build_data.py for the
 * offline/standalone equivalent). Falls back to the bundled data.js when not
 * running inside Tableau, so the page still works as a standalone preview.
 */
window.PK_TABLEAU_SOURCE = (function () {
  "use strict";

  function normalizeFieldName(name) {
    var m = name.match(/^[A-Z]+\((.+)\)$/);
    return m ? m[1] : name;
  }

  async function fetchRows(worksheet) {
    var rows = [];
    var reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
    for (var p = 0; p < reader.pageCount; p++) {
      var page = await reader.getPageAsync(p);
      var cols = page.columns;
      var data = page.data;
      for (var i = 0; i < data.length; i++) {
        var row = {};
        for (var j = 0; j < cols.length; j++) {
          var key = normalizeFieldName(cols[j].fieldName);
          var cell = data[i][cols[j].index];
          row[key] = cell ? cell.value : null;
        }
        rows.push(row);
      }
    }
    await reader.releaseAsync();
    return rows;
  }

  function isTrue(v) {
    return v === true || v === "True" || v === "true" || v === 1;
  }
  function isEmpty(v) {
    return v === null || v === undefined || v === "" || v === "%null%";
  }
  function str(v) {
    return isEmpty(v) ? null : v;
  }
  function num(v) {
    return isEmpty(v) ? null : Number(v);
  }

  function buildDataset(rows) {
    var years = [];
    var provincesSet = {};
    var winnerRows = [];
    var allByYear = {};

    rows.forEach(function (r) {
      var year = String(r["Year"]);
      r["__year"] = year;
      if (years.indexOf(year) === -1) years.push(year);
      var prov = str(r["Province"]);
      if (prov) provincesSet[prov] = true;
      (allByYear[year] = allByYear[year] || []).push(r);
      if (isTrue(r["Is Winner"])) winnerRows.push(r);
    });
    years.sort(function (a, b) { return Number(a) - Number(b); });
    var provinces = Object.keys(provincesSet).sort();

    var seats = winnerRows.map(function (r) {
      var naKey = str(r["NA"]) || str(r["Constituency"]);
      var seatTotal = allByYear[r.__year].filter(function (x) {
        return (str(x["NA"]) || str(x["Constituency"])) === naKey;
      });
      return {
        year: r.__year,
        constituency: str(r["Constituency"]),
        na: naKey,
        province: str(r["Province"]),
        district: str(r["District"]),
        division: str(r["Division"]),
        winner_party: str(r["Party"]),
        winner_candidate: str(r["Candidate Name"]),
        winner_votes: num(r["Winner Votes"]),
        runner_up_party: str(r["Runner Up Party"]),
        runner_up_votes: num(r["Second Max Votes"]),
        margin: num(r["Margin"]),
        margin_pct: num(r["Margin Pct"]),
        turnout: num(r["Turnout Pct"]),
        registered: num(r["Registered Voters Filled"]),
        candidates_count: seatTotal.length
      };
    });

    var nationalTrend = years.map(function (year) {
      var yearRows = allByYear[year];
      var yearWinners = seats.filter(function (s) { return s.year === year; });
      var registered = 0, votesCast = 0, turnoutSum = 0, turnoutN = 0;
      var partiesSet = {};
      yearWinners.forEach(function (s) {
        if (s.registered) registered += s.registered;
        if (s.turnout !== null) { turnoutSum += s.turnout; turnoutN++; }
      });
      yearRows.forEach(function (r) {
        var v = num(r["Votes"]);
        if (v) votesCast += v;
        var p = str(r["Party"]);
        if (p) partiesSet[p] = true;
      });
      return {
        year: year,
        seats: yearWinners.length,
        registered_voters: Math.round(registered),
        votes_cast: Math.round(votesCast),
        rejected_votes: 0,
        turnout_pct: turnoutN ? Math.round((turnoutSum / turnoutN) * 100) / 100 : null,
        parties_contested: Object.keys(partiesSet).length
      };
    });

    var sixGroupsSet = {};
    var sixGroupSeries = {};
    years.forEach(function (year) { sixGroupSeries[year] = {}; });
    winnerRows.forEach(function (r) {
      var six = str(r["Six Parties"]);
      if (!six) return;
      sixGroupsSet[six] = true;
      sixGroupSeries[r.__year][six] = (sixGroupSeries[r.__year][six] || 0) + 1;
    });
    var sixGroups = Object.keys(sixGroupsSet).sort();
    var PARTY_GROUP_COLOR = {
      "PTI": "#01411C", "PPP (s)/PDA": "#E4002B", "PML (s)/IJI/PNA": "#0B6E4F",
      "Religious Parties": "#1B4D3E", "Province Parties": "#C9A227",
      "Independent Parties": "#6B7280", "Other Parties": "#9CA3AF"
    };
    var sixgroupTrend = {
      years: years,
      groups: sixGroups,
      colors: sixGroups.reduce(function (acc, g) { acc[g] = PARTY_GROUP_COLOR[g] || "#888888"; return acc; }, {}),
      series: sixGroups.reduce(function (acc, g) {
        acc[g] = years.map(function (y) { return sixGroupSeries[y][g] || 0; });
        return acc;
      }, {})
    };

    var partyTotals = {};
    winnerRows.forEach(function (r) {
      var p = str(r["Party"]);
      if (!p) return;
      partyTotals[p] = (partyTotals[p] || 0) + 1;
    });
    var sortedParties = Object.keys(partyTotals).map(function (p) { return [p, partyTotals[p]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var topN = 10;
    var top = sortedParties.slice(0, topN);
    var othersTotal = sortedParties.slice(topN).reduce(function (s, x) { return s + x[1]; }, 0);
    var topPartiesAllTime = top.map(function (x) { return { party: x[0], seats: x[1] }; });
    if (othersTotal) topPartiesAllTime.push({ party: "Others", seats: othersTotal });

    var provinceYearParty = {};
    years.forEach(function (y) { provinceYearParty[y] = {}; });
    winnerRows.forEach(function (r) {
      var y = r.__year, prov = str(r["Province"]), party = str(r["Party"]);
      if (!prov || !party) return;
      provinceYearParty[y][prov] = provinceYearParty[y][prov] || {};
      provinceYearParty[y][prov][party] = (provinceYearParty[y][prov][party] || 0) + 1;
    });

    return {
      meta: {
        source: "Live Tableau data source",
        years: years,
        provinces: provinces,
        seat_count_latest: nationalTrend.length ? nationalTrend[nationalTrend.length - 1].seats : 0,
        total_rows: rows.length
      },
      national_trend: nationalTrend,
      sixgroup_trend: sixgroupTrend,
      top_parties_all_time: topPartiesAllTime,
      province_year_party_seats: provinceYearParty,
      seats: seats
    };
  }

  async function init(onReady, onChange) {
    // Only talk to Tableau when loaded as an extension (manifest URL carries ?ext=1).
    // As a plain Web Page object (e.g. Tableau Public) boot straight from bundled data.
    if (!/[?&]ext=1(&|$)/.test(window.location.search)) {
      return false;
    }
    if (!(window.tableau && tableau.extensions)) {
      return false;
    }
    // Not an extension host (e.g. a plain Web Page object on Tableau Public):
    // initializeAsync may never settle, so cap the wait and fall back to the
    // bundled data instead of leaving the dashboard blank.
    try {
      await Promise.race([
        tableau.extensions.initializeAsync(),
        new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error("Tableau extension init timed out")); }, 3500);
        })
      ]);
    } catch (e) {
      return false;
    }
    if (!tableau.extensions.worksheetContent) {
      return false;
    }
    var worksheet = tableau.extensions.worksheetContent.worksheet;

    async function refresh() {
      var rows = await fetchRows(worksheet);
      return buildDataset(rows);
    }

    var first = await refresh();
    onReady(first);

    worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, function () {
      refresh().then(onChange).catch(function (e) { console.warn("Live data refresh failed:", e); });
    });

    return true;
  }

  return { init: init };
})();
