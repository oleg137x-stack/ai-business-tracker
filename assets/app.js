/* AI Business / Marketing Tracker.
   One codebase, two trackers. Everything below reads the active tracker's
   config, so a third tracker is a TRACKERS entry, not a rewrite. */

(function () {
  "use strict";

  var START = "2026-10-01";

  /* ---------- sector -> industry map (business tracker) ---------- */

  var SECTORS = {
    "Financial": ["Banks", "Payments", "Fintech", "Insurance", "Asset & Wealth Management", "Exchanges & Market Infrastructure"],
    "Retail & Consumer": ["Retail & E-commerce", "Consumer Products", "Food & Beverage", "Restaurants", "Apparel & Luxury"],
    "Health": ["Pharma & Biotech", "Healthcare Providers", "Health Insurers", "Medical Devices"],
    "Technology": ["Big Tech & Cloud", "Software & SaaS", "Semiconductors & Hardware", "IT Services & Consulting"],
    "Telecom & Media": ["Telecom", "Media & Entertainment", "Advertising & Marketing", "Gaming"],
    "Energy & Resources": ["Oil & Gas", "Utilities & Power", "Renewables", "Metals & Mining", "Chemicals"],
    "Industrial": ["Industrial Manufacturing", "Aerospace & Defense", "Automotive", "Construction & Engineering"],
    "Transport": ["Airlines", "Logistics & Delivery", "Rail & Shipping"],
    "Services & Other": ["Professional Services", "Real Estate", "Education", "Agriculture", "Hospitality & Travel"]
  };

  /* ---------- tracker configuration ---------- */

  var TRACKERS = {
    business: {
      title: "AI BUSINESS TRACKER",
      strap: "What companies did with AI, and what it produced",
      data: "data/business.json",
      weekly: "data/weekly-business.json",
      digestTitle: "Top AI News in Global Business This Week",
      digestTitleRu: "Главные AI-новости в мировом бизнесе за неделю",
      groupBy: "sector",
      tagFields: ["industry", "ai_type", "status"],
      /* facets render as chip rows, in order */
      facets: [
        { key: "sector", label: "SECTOR", field: "sector", children: "industry" },
        { key: "industry", label: "INDUSTRY", field: "industry", nested: true },
        { key: "status", label: "STATUS", field: "status" },
        { key: "ai_type", label: "AI TYPE", field: "ai_type" }
      ],
      /* extra labelled lines above the outcome */
      fields: [],
      searchFields: ["company", "title", "description", "vendor", "industry"],
      csv: ["event_date", "company", "sector", "industry", "status", "ai_type", "title", "description", "outcome", "metric", "investment_amount", "vendor", "source_name", "source_url"]
    },
    marketing: {
      title: "AI MARKETING TRACKER",
      strap: "How AI is launched, positioned and marketed",
      data: "data/marketing.json",
      weekly: "data/weekly-marketing.json",
      digestTitle: "Top AI Marketing Moves This Week",
      digestTitleRu: "Главное в маркетинге AI за неделю",
      groupBy: "activity_type",
      tagFields: ["activity_type", "channel", "audience"],
      facets: [
        { key: "activity_type", label: "ACTIVITY", field: "activity_type" },
        { key: "channel", label: "CHANNEL", field: "channel" },
        { key: "audience", label: "AUDIENCE", field: "audience" },
        { key: "promoter_type", label: "PROMOTER", field: "promoter_type" }
      ],
      fields: [
        { label: "ANGLE", field: "angle", ru: "angle_ru" },
        { label: "CRAFT", field: "craft_note" }
      ],
      searchFields: ["company", "title", "description", "angle", "craft_note", "subject", "agency"],
      csv: ["event_date", "company", "activity_type", "channel", "audience", "promoter_type", "subject", "title", "description", "angle", "craft_note", "outcome", "metric", "spend", "agency", "source_name", "source_url", "asset_url"]
    }
  };

  /* Hashtags for the share preview: one per facet, in both languages.
     A value missing from here simply produces no tag rather than a bad one. */
  var TAGS = {
    /* industries */
    "Banks": ["banks", "банки"],
    "Payments": ["payments", "платежи"],
    "Fintech": ["fintech", "финтех"],
    "Insurance": ["insurance", "страхование"],
    "Asset & Wealth Management": ["assetManagement", "управлениеАктивами"],
    "Exchanges & Market Infrastructure": ["marketInfrastructure", "биржи"],
    "Retail & E-commerce": ["retail", "ритейл"],
    "Consumer Products": ["consumerProducts", "потребительскиеТовары"],
    "Food & Beverage": ["foodAndBeverage", "продуктыПитания"],
    "Restaurants": ["restaurants", "рестораны"],
    "Apparel & Luxury": ["apparel", "одежда"],
    "Pharma & Biotech": ["pharma", "фарма"],
    "Healthcare Providers": ["healthcare", "здравоохранение"],
    "Health Insurers": ["healthInsurance", "медстрахование"],
    "Medical Devices": ["medtech", "медтехника"],
    "Big Tech & Cloud": ["bigTech", "бигтех"],
    "Software & SaaS": ["software", "софт"],
    "Semiconductors & Hardware": ["semiconductors", "полупроводники"],
    "IT Services & Consulting": ["itServices", "ИТуслуги"],
    "Telecom": ["telecom", "телеком"],
    "Media & Entertainment": ["media", "медиа"],
    "Advertising & Marketing": ["advertising", "реклама"],
    "Gaming": ["gaming", "гейминг"],
    "Oil & Gas": ["oilAndGas", "нефтьИГаз"],
    "Utilities & Power": ["utilities", "энергетика"],
    "Renewables": ["renewables", "возобновляемаяЭнергия"],
    "Metals & Mining": ["mining", "металлургия"],
    "Chemicals": ["chemicals", "химия"],
    "Industrial Manufacturing": ["manufacturing", "промышленность"],
    "Aerospace & Defense": ["aerospace", "аэрокосмос"],
    "Automotive": ["automotive", "автопром"],
    "Construction & Engineering": ["construction", "строительство"],
    "Airlines": ["airlines", "авиакомпании"],
    "Logistics & Delivery": ["logistics", "логистика"],
    "Rail & Shipping": ["railAndShipping", "железныеДорогиИМоре"],
    "Professional Services": ["professionalServices", "профуслуги"],
    "Real Estate": ["realEstate", "недвижимость"],
    "Education": ["education", "образование"],
    "Agriculture": ["agriculture", "агро"],
    "Hospitality & Travel": ["travel", "туризм"],
    /* AI types */
    "Generative AI": ["generativeAI", "генеративныйИИ"],
    "Agentic AI": ["agenticAI", "ИИагенты"],
    "Predictive ML": ["predictiveML", "предиктивноеML"],
    "NLP": ["NLP", "NLP"],
    "Computer Vision": ["computerVision", "компьютерноеЗрение"],
    "Conversational AI": ["conversationalAI", "разговорныйИИ"],
    "Robotics": ["robotics", "робототехника"],
    "Other": ["AI", "ИИ"],
    /* statuses */
    "Announced": ["announced", "анонсировано"],
    "Pilot": ["pilot", "пилот"],
    "Deployed": ["deployed", "внедрено"],
    "Scaling": ["scaling", "масштабирование"],
    "Investment": ["investment", "инвестиции"],
    /* marketing: activity */
    "Model launch": ["modelLaunch", "запускМодели"],
    "Feature promo": ["featurePromo", "промоФункции"],
    "Ad campaign": ["adCampaign", "рекламнаяКампания"],
    "Brand film / video": ["brandFilm", "брендРолик"],
    "Keynote / event": ["keynote", "кейноут"],
    "Developer conference": ["devConference", "конференцияРазработчиков"],
    "Sponsorship / partnership": ["sponsorship", "спонсорство"],
    "PR & media relations": ["PR", "PR"],
    "Brand & identity": ["branding", "брендинг"],
    "Creator & influencer": ["creators", "креаторы"],
    "Pricing & positioning": ["positioning", "позиционирование"],
    "Earned-media moment": ["earnedMedia", "органическийОхват"],
    /* marketing: channel */
    "TV & streaming": ["tv", "ТВ"],
    "Online video": ["onlineVideo", "онлайнВидео"],
    "Social": ["social", "соцсети"],
    "Out-of-home": ["outOfHome", "наружнаяРеклама"],
    "Print": ["print", "пресса"],
    "Owned newsroom / blog": ["ownedMedia", "собственныеКаналы"],
    "Live event": ["liveEvent", "мероприятие"],
    "Podcast": ["podcast", "подкаст"],
    "Press briefing": ["pressBriefing", "прессбрифинг"],
    "Developer channels": ["devChannels", "каналыРазработчиков"],
    "Multi-channel": ["multiChannel", "мультиканал"],
    /* marketing: audience */
    "Consumer": ["consumer", "потребители"],
    "Developer": ["developers", "разработчики"],
    "Enterprise buyer": ["enterprise", "корпоративныеКлиенты"],
    "Investor": ["investors", "инвесторы"],
    "Policy & public": ["policy", "политикаИОбщество"]
  };

  function hashtags(r, ru) {
    return (cfg().tagFields || []).map(function (f) {
      var t = TAGS[r[f]];
      return t ? "#" + t[ru ? 1 : 0] : "";
    }).filter(Boolean);
  }

  var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  var MONTHS_RU = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

  /* ---------- state ---------- */

  var state = {
    tracker: "business",
    view: "feed",
    dlang: "en",
    mlang: "en",
    sort: "newest",
    q: "",
    d1: START,
    d2: today(),
    outcome: "all",
    sel: {},          /* facet key -> value, "ALL" means unset */
    week: null,       /* ISO monday, null = latest */
    open: null,       /* record id for the share modal */
    openDigest: false /* share modal showing the whole week's digest */
  };

  var cache = {};     /* tracker -> { rows: [], weekly: {} } */

  /* ---------- small helpers ---------- */

  function $(id) { return document.getElementById(id); }
  function today() { return new Date().toISOString().slice(0, 10); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function cfg() { return TRACKERS[state.tracker]; }
  function rows() { return (cache[state.tracker] || {}).rows || []; }
  function weekly() { return (cache[state.tracker] || {}).weekly || {}; }

  function fmtDate(iso) {
    var p = String(iso).split("-");
    return MONTHS[+p[1] - 1] + " " + p[2];
  }

  function fmtYear(iso) { return String(iso).slice(0, 4); }

  /* Monday of the ISO week containing iso, as YYYY-MM-DD. */
  function weekStart(iso) {
    var d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }

  function weekEnd(monday) {
    var d = new Date(monday + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  }

  /* "20–26 Oct 2026", spanning months and years where needed. */
  function weekRange(monday, ru) {
    var a = new Date(monday + "T00:00:00Z"), b = new Date(weekEnd(monday) + "T00:00:00Z");
    var mo = ru ? MONTHS_RU : MONTHS.map(function (m) { return m[0] + m.slice(1).toLowerCase(); });
    var left = a.getUTCMonth() === b.getUTCMonth()
      ? String(a.getUTCDate())
      : a.getUTCDate() + " " + mo[a.getUTCMonth()];
    if (a.getUTCFullYear() !== b.getUTCFullYear()) {
      left = a.getUTCDate() + " " + mo[a.getUTCMonth()] + " " + a.getUTCFullYear();
    }
    return left + "–" + b.getUTCDate() + " " + mo[b.getUTCMonth()] + " " + b.getUTCFullYear();
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /* "Measured only" means something was actually reported. A record whose
     outcome opens with "Not disclosed" is not measured, even when `metric`
     holds a scale figure such as a device count or an approval window. */
  function hasMetric(r) {
    var outcome = (r.outcome || "").trim().toLowerCase();
    if (!outcome || outcome.indexOf("not disclosed") === 0) return false;
    if ((r.metric || "").trim()) return true;
    return /\d/.test(outcome);
  }

  /* ---------- hash routing ---------- */

  function readHash() {
    var h = location.hash.replace(/^#/, "");
    if (!h) return;
    h.split("&").forEach(function (pair) {
      var i = pair.indexOf("="), k = i < 0 ? pair : pair.slice(0, i),
          v = i < 0 ? "" : decodeURIComponent(pair.slice(i + 1));
      if (k === "t" && TRACKERS[v]) state.tracker = v;
      else if (k === "v" && (v === "feed" || v === "digest")) state.view = v;
      else if (k === "w" && /^\d{4}-\d{2}-\d{2}$/.test(v)) state.week = v;
      else if (k === "q") state.q = v;
      else if (k === "id") state.open = v;
      else if (k === "oc" && v === "m") state.outcome = "m";
      else if (k.indexOf("f.") === 0) state.sel[k.slice(2)] = v;
    });
  }

  var writingHash = false;

  function writeHash() {
    var parts = ["t=" + state.tracker];
    if (state.view !== "feed") parts.push("v=" + state.view);
    if (state.view === "digest" && state.week) parts.push("w=" + state.week);
    if (state.q) parts.push("q=" + encodeURIComponent(state.q));
    if (state.outcome === "m") parts.push("oc=m");
    Object.keys(state.sel).forEach(function (k) {
      if (state.sel[k] && state.sel[k] !== "ALL") parts.push("f." + k + "=" + encodeURIComponent(state.sel[k]));
    });
    writingHash = true;
    location.replace("#" + parts.join("&"));
    setTimeout(function () { writingHash = false; }, 0);
  }

  /* ---------- data loading ---------- */

  function load(tracker) {
    if (cache[tracker]) return Promise.resolve(cache[tracker]);
    var c = TRACKERS[tracker];
    return Promise.all([
      fetch(c.data, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      fetch(c.weekly, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    ]).then(function (res) {
      var list = Array.isArray(res[0]) ? res[0] : [];
      list = list.filter(function (r) { return r && r.event_date >= START; });
      cache[tracker] = { rows: list, weekly: res[1] || {} };
      return cache[tracker];
    });
  }

  /* ---------- filtering ---------- */

  function filtered() {
    var c = cfg(), q = state.q.trim().toLowerCase();
    return rows().filter(function (r) {
      for (var i = 0; i < c.facets.length; i++) {
        var f = c.facets[i], v = state.sel[f.key];
        if (!v || v === "ALL") continue;
        if (f.children) {
          /* a sector selection matches every industry inside it */
          if (r[f.field] !== v) return false;
        } else if (r[f.field] !== v) return false;
      }
      if (state.outcome === "m" && !hasMetric(r)) return false;
      if (r.event_date < state.d1 || r.event_date > state.d2) return false;
      if (q) {
        var hay = c.searchFields.map(function (k) { return r[k] || ""; }).join(" ").toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (state.sort === "company") return String(a.company).localeCompare(String(b.company));
      if (state.sort === "oldest") return String(a.event_date).localeCompare(String(b.event_date));
      return String(b.event_date).localeCompare(String(a.event_date));
    });
  }

  function anyFilter() {
    if (state.q || state.outcome === "m") return true;
    if (state.d1 !== START || state.d2 !== today()) return true;
    return cfg().facets.some(function (f) { return state.sel[f.key] && state.sel[f.key] !== "ALL"; });
  }

  /* ---------- rendering: facets ---------- */

  function chipRow(label, key, values, current) {
    var html = '<div class="frow"><span class="flabel">' + esc(label) + '</span><div class="chips">';
    html += values.map(function (v) {
      var on = (current || "ALL") === v;
      return '<button type="button" class="chip" data-facet="' + esc(key) + '" data-value="' +
        esc(v) + '" aria-pressed="' + on + '">' + esc(v === "ALL" ? "ALL" : v.toUpperCase()) + "</button>";
    }).join("");
    return html + "</div></div>";
  }

  function renderFacets() {
    var c = cfg(), all = rows(), html = "";

    c.facets.forEach(function (f) {
      if (f.nested) {
        /* only shown once its parent has a selection */
        var parent = c.facets.filter(function (p) { return p.children === f.key; })[0];
        var pv = parent && state.sel[parent.key];
        if (!pv || pv === "ALL") return;
        var kids = (SECTORS[pv] || []).filter(function (k) {
          return all.some(function (r) { return r[f.field] === k; });
        });
        if (!kids.length) return;
        html += chipRow(f.label, f.key, ["ALL"].concat(kids), state.sel[f.key]);
        return;
      }
      /* values present in the data, in config order where we have one */
      var seen = {}, vals = [];
      all.forEach(function (r) {
        var v = r[f.field];
        if (v && !seen[v]) { seen[v] = 1; vals.push(v); }
      });
      if (f.children) vals = Object.keys(SECTORS).filter(function (s) { return seen[s]; });
      else vals.sort();
      if (!vals.length) return;
      html += chipRow(f.label, f.key, ["ALL"].concat(vals), state.sel[f.key]);
    });

    html += '<div class="frow"><span class="flabel">OUTCOME</span><div class="chips">' +
      '<button type="button" class="chip" data-outcome="all" aria-pressed="' + (state.outcome === "all") + '">ALL</button>' +
      '<button type="button" class="chip" data-outcome="m" aria-pressed="' + (state.outcome === "m") + '">MEASURED ONLY</button>' +
      "</div></div>";

    $("facets").innerHTML = html;
  }

  /* ---------- rendering: feed ---------- */

  function facetLine(r) {
    var c = cfg();
    return c.facets.map(function (f) { return r[f.field]; })
      .filter(Boolean)
      .map(function (v) { return v.toUpperCase(); })
      .join(" · ");
  }

  function entryHtml(r) {
    var c = cfg(), h = "";
    h += '<article class="entry" id="e-' + esc(r.id) + '">';
    h += '<div class="entry-date">' + esc(fmtDate(r.event_date)) + "<br />" + esc(fmtYear(r.event_date)) + "</div>";
    h += "<div>";
    h += '<h2 class="entry-co">' + esc(String(r.company).toUpperCase()) +
         ' &nbsp;<span class="entry-facets">' + esc(facetLine(r)) + "</span></h2>";

    h += '<div class="entry-body">' + esc(r.description || r.title) + "</div>";

    c.fields.forEach(function (f) {
      if (!r[f.field]) return;
      h += '<div class="field"><span class="flab">' + esc(f.label) +
           '</span><span class="fval">' + esc(r[f.field]) + "</span></div>";
    });

    if (r.outcome || r.metric) {
      /* the outcome sentence is the record; metric is only a fallback when
         nothing was reported in prose, and the stated figure is prepended
         only when the outcome does not already carry it. */
      var oc = r.outcome;
      if (!oc || oc.toLowerCase() === "not disclosed") oc = r.metric || r.outcome;
      if (r.investment_amount && oc.indexOf(r.investment_amount) < 0) {
        oc = r.investment_amount + " · " + oc;
      }
      h += '<div class="field outcome"><span class="flab">OUTCOME</span><span class="fval">' + esc(oc) + "</span></div>";
    }

    h += '<div class="entry-links">';
    if (r.source_url) {
      h += '<a href="' + esc(r.source_url) + '" target="_blank" rel="noopener">' +
           esc(r.source_name || "Source") + " ↗</a>";
    }
    if (r.asset_url) {
      h += '<a href="' + esc(r.asset_url) + '" target="_blank" rel="noopener">WATCH ↗</a>';
    }
    h += '<button type="button" class="chip share" data-share="' + esc(r.id) +
         '" aria-label="Share preview" title="Share preview">→</button>';
    h += "</div></div></article>";
    return h;
  }

  function renderFeed() {
    var list = filtered();
    $("count").textContent = list.length + (list.length === 1 ? " ENTRY" : " ENTRIES");
    $("feed").innerHTML = list.length
      ? list.map(entryHtml).join("")
      : '<p class="empty">No entries match these filters. Reset to see everything.</p>';
  }

  /* ---------- rendering: digest ---------- */

  function weeksAvailable() {
    var seen = {}, out = [];
    rows().forEach(function (r) {
      var w = weekStart(r.event_date);
      if (!seen[w]) { seen[w] = 1; out.push(w); }
    });
    var current = weekStart(today());
    if (!seen[current]) out.push(current);
    return out.sort().reverse();
  }

  function digestText(markdown) {
    var head = $("digest-head").textContent;
    var intro = $("digest-intro").textContent;
    var items = [].slice.call($("digest-list").querySelectorAll("li[data-url]"));
    var lines = items.map(function (li) {
      var t = li.getAttribute("data-line");
      return markdown
        ? "- " + t + " [" + (state.dlang === "ru" ? "Ссылка" : "Link") + "](" + li.getAttribute("data-url") + ")"
        : "- " + t + " " + li.getAttribute("data-url");
    });
    return [head, intro].filter(Boolean).join("\n\n") + (lines.length ? "\n\n" + lines.join("\n") : "");
  }

  function renderDigest() {
    var c = cfg(), weeks = weeksAvailable();
    if (!state.week || weeks.indexOf(state.week) < 0) state.week = weeks[0];
    var idx = weeks.indexOf(state.week);
    var ru = state.dlang === "ru";

    $("week-label").textContent = weekRange(state.week, ru).toUpperCase();
    $("week-prev").disabled = idx >= weeks.length - 1;
    $("week-next").disabled = idx <= 0;

    var from = state.week, to = weekEnd(state.week);
    var list = filtered().filter(function (r) { return r.event_date >= from && r.event_date <= to; })
      .sort(function (a, b) { return String(b.event_date).localeCompare(String(a.event_date)); });

    $("digest-count").textContent = list.length + (list.length === 1 ? " ENTRY · " : " ENTRIES · ") +
      weekRange(state.week, false).toUpperCase();

    $("digest-head").textContent = (ru ? c.digestTitleRu : c.digestTitle) +
      " (" + weekRange(state.week, ru) + ")";

    var w = weekly()[state.week] || {};
    var intro = ru ? (w.intro_ru || "") : (w.intro || "");
    var narrowed = anyFilter();
    $("digest-intro").textContent = narrowed ? "" : intro;
    $("digest-intro").hidden = narrowed || !intro;
    $("digest-note").hidden = !narrowed || !intro;
    $("digest-note").textContent = ru
      ? "ФИЛЬТРЫ АКТИВНЫ · ОБЗОР НЕДЕЛИ СКРЫТ, ТАК КАК ОН ОПИСЫВАЕТ ВСЮ НЕДЕЛЮ"
      : "FILTERS ACTIVE · THE WEEKLY SUMMARY IS HIDDEN BECAUSE IT DESCRIBES THE WHOLE WEEK";

    if (!list.length) {
      $("digest-list").innerHTML = '<li class="digest-group">' +
        (ru ? "НА ЭТОЙ НЕДЕЛЕ ЗАПИСЕЙ НЕТ" : "NO ENTRIES IN THIS WEEK") + "</li>";
      return;
    }

    var bullet = function (r) {
      var line = (ru ? r.digest_line_ru : r.digest_line) || r.digest_line || r.title;
      return '<li data-url="' + esc(r.source_url) + '" data-line="' + esc(line) + '">' +
        esc(line) + ' <a href="' + esc(r.source_url) + '" target="_blank" rel="noopener">[' +
        (ru ? "Ссылка" : "Link") + "]</a></li>";
    };

    if (list.length > 15) {
      var groups = {}, order = [];
      list.forEach(function (r) {
        var g = r[c.groupBy] || "OTHER";
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(r);
      });
      $("digest-list").innerHTML = order.map(function (g) {
        return '<li class="digest-group">' + esc(g.toUpperCase()) + "</li>" + groups[g].map(bullet).join("");
      }).join("");
    } else {
      $("digest-list").innerHTML = list.map(bullet).join("");
    }
  }

  /* ---------- share modal ---------- */

  function postText(r, ru) {
    var c = cfg(), out = [];
    var d = (ru && r.description_ru) ? r.description_ru : r.description;
    out.push(d || ((ru && r.title_ru) ? r.title_ru : r.title));
    c.fields.forEach(function (f) {
      var v = (ru && f.ru && r[f.ru]) ? r[f.ru] : r[f.field];
      if (v && f.label === "ANGLE") out.push(v);
    });
    var oc = (ru && r.outcome_ru) ? r.outcome_ru : r.outcome;
    if (oc) out.push((ru ? "Результат: " : "Outcome: ") + oc);
    out.push(r.asset_url || r.source_url);
    var tags = hashtags(r, ru);
    if (tags.length) out.push(tags.join(" "));
    return out.join("\n\n");
  }

  /* The digest preview is the whole week as one postable block: heading,
     intro and bullets, in whichever language the modal is set to. */
  function digestPost(ru) {
    var c = cfg(), w = weekly()[state.week] || {};
    var from = state.week, to = weekEnd(state.week);
    var list = filtered().filter(function (r) { return r.event_date >= from && r.event_date <= to; })
      .sort(function (a, b) { return String(b.event_date).localeCompare(String(a.event_date)); });
    var out = [(ru ? c.digestTitleRu : c.digestTitle) + " (" + weekRange(state.week, ru) + ")"];
    var intro = ru ? (w.intro_ru || w.intro) : w.intro;
    if (intro && !anyFilter()) out.push(intro);
    list.forEach(function (r) {
      var line = (ru ? r.digest_line_ru : r.digest_line) || r.digest_line || r.title;
      out.push("— " + line + " " + r.source_url);
    });
    return { text: out.join("\n\n"), count: list.length, head: out[0],
             intro: (intro && !anyFilter()) ? intro : "", rows: list };
  }

  function renderDigestModal() {
    var ru = state.mlang === "ru", post = digestPost(ru);
    var h = '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Share preview of this week\'s digest">';
    h += '<div class="modal-head"><span class="modal-title">SHARE PREVIEW · WEEKLY DIGEST</span><span class="chips">';
    h += '<span class="group"><button type="button" class="chip" data-mlang="en" aria-pressed="' + (!ru) + '">EN</button>' +
         '<button type="button" class="chip" data-mlang="ru" aria-pressed="' + ru + '">RU</button></span>';
    h += '<button type="button" class="chip" id="modal-close" aria-label="Close">✕</button></span></div>';

    h += '<div class="post"><h3>' + esc(post.head) + "</h3>";
    if (post.intro) h += "<p>" + esc(post.intro) + "</p>";
    h += '<ul style="padding-left:20px;margin:12px 0 0">';
    h += post.rows.map(function (r) {
      var line = (ru ? r.digest_line_ru : r.digest_line) || r.digest_line || r.title;
      return '<li style="margin-bottom:10px">' + esc(line) +
        ' <a href="' + esc(r.source_url) + '" target="_blank" rel="noopener">' +
        esc(r.source_name || (ru ? "Источник" : "Source")) + " ↗</a></li>";
    }).join("");
    h += "</ul>";
    if (!post.count) h += '<p>' + (ru ? "На этой неделе записей нет." : "No entries in this week.") + "</p>";
    h += "</div>";

    h += '<div class="chips" style="margin-top:18px">' +
      '<button type="button" class="chip" id="modal-copy-text">COPY TEXT</button>' +
      '<button type="button" class="chip" id="modal-copy-link">COPY LINK</button></div>';
    h += "</div></div>";

    document.body.insertAdjacentHTML("beforeend", h);
    var mt = document.querySelector(".modal-backdrop");
    mt.dataset.text = post.text;
    mt.dataset.link = location.origin + location.pathname +
      "#t=" + state.tracker + "&v=digest&w=" + state.week;
    $("modal-close").focus();
  }

  function closeModal() {
    state.open = null;
    state.openDigest = false;
    renderModal();
  }

  function renderModal() {
    var old = document.querySelector(".modal-backdrop");
    if (old) old.remove();
    if (state.openDigest) { renderDigestModal(); return; }
    if (!state.open) return;

    var r = rows().filter(function (x) { return x.id === state.open; })[0];
    if (!r) { state.open = null; return; }

    var c = cfg(), ru = state.mlang === "ru";
    var missingRu = ru && !r.title_ru && !r.description_ru;

    var h = '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Share preview">';
    h += '<div class="modal-head"><span class="modal-title">SHARE PREVIEW</span><span class="chips">';
    h += '<span class="group"><button type="button" class="chip" data-mlang="en" aria-pressed="' + (!ru) + '">EN</button>' +
         '<button type="button" class="chip" data-mlang="ru" aria-pressed="' + ru + '">RU</button></span>';
    h += '<button type="button" class="chip" id="modal-close" aria-label="Close">✕</button></span></div>';

    h += '<div class="post">';
    h += '<div class="post-meta">' + esc(String(r.company).toUpperCase()) + " · " +
         esc(fmtDate(r.event_date)) + " " + esc(fmtYear(r.event_date)) + "</div>";
    var d = (ru && r.description_ru) ? r.description_ru : r.description;
    h += "<p>" + esc(d || ((ru && r.title_ru) ? r.title_ru : r.title)) + "</p>";
    c.fields.forEach(function (f) {
      if (f.label !== "ANGLE") return;
      var v = (ru && f.ru && r[f.ru]) ? r[f.ru] : r[f.field];
      if (v) h += "<p>" + esc(v) + "</p>";
    });
    var oc = (ru && r.outcome_ru) ? r.outcome_ru : r.outcome;
    if (oc) h += "<p>" + esc(ru ? "Результат: " : "Outcome: ") + esc(oc) + "</p>";
    /* Show the source the way the feed does — its name as a link — rather
       than a raw URL. The copied text still carries the bare URL, which is
       what a post needs. */
    h += '<div class="post-links">';
    if (r.source_url) {
      h += '<a href="' + esc(r.source_url) + '" target="_blank" rel="noopener">' +
           esc(r.source_name || "Source") + " ↗</a>";
    }
    if (r.asset_url) {
      h += '<a href="' + esc(r.asset_url) + '" target="_blank" rel="noopener">' +
           (ru ? "Смотреть" : "Watch") + " ↗</a>";
    }
    h += "</div>";
    var tagList = hashtags(r, ru);
    if (tagList.length) h += '<div class="post-tags">' + esc(tagList.join(" ")) + "</div>";
    if (missingRu) h += '<div class="pending">TRANSLATION PENDING · SHOWING ENGLISH</div>';
    h += "</div>";

    h += '<div class="chips" style="margin-top:18px">' +
      '<button type="button" class="chip" id="modal-copy-text">COPY TEXT</button>' +
      '<button type="button" class="chip" id="modal-copy-link">COPY LINK</button></div>';
    h += "</div></div>";

    document.body.insertAdjacentHTML("beforeend", h);
    var mt = document.querySelector(".modal-backdrop");
    mt.dataset.text = postText(r, ru && !missingRu);
    mt.dataset.link = location.origin + location.pathname + "#t=" + state.tracker + "&id=" + encodeURIComponent(r.id);
    $("modal-close").focus();
  }

  /* ---------- copy ---------- */

  function copy(btn, text) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = "COPIED";
      setTimeout(function () { btn.textContent = old; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  }

  function fallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* nothing more to try */ }
    ta.remove();
  }

  function downloadCsv() {
    var c = cfg(), list = filtered();
    var cell = function (v) {
      v = v == null ? "" : String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    var csv = c.csv.join(",") + "\n" +
      list.map(function (r) { return c.csv.map(function (k) { return cell(r[k]); }).join(","); }).join("\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ai-" + state.tracker + "-tracker-" + today() + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ---------- chrome ---------- */

  function setPressed(selector, attr, value) {
    [].forEach.call(document.querySelectorAll(selector), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset[attr] === value));
    });
  }

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    setPressed("[data-theme-set]", "themeSet", t);
    try { localStorage.setItem("tracker-theme", t); } catch (e) { /* private mode */ }
  }

  function renderAll() {
    var c = cfg();
    document.title = c.title.replace(/\b\w+/g, function (w) {
      return w === "AI" ? "AI" : w[0] + w.slice(1).toLowerCase();
    }) + " — " + c.strap;
    $("strap").textContent = c.strap;
    setPressed("[data-tracker]", "tracker", state.tracker);
    setPressed("[data-view]", "view", state.view);
    setPressed("[data-dlang]", "dlang", state.dlang);
    $("view-feed").hidden = state.view !== "feed";
    $("view-digest").hidden = state.view !== "digest";
    renderFacets();
    var active = c.facets.filter(function (f) { return state.sel[f.key] && state.sel[f.key] !== "ALL"; }).length +
      (state.outcome === "m" ? 1 : 0) + (state.q ? 1 : 0);
    $("filters-toggle").textContent = active ? "FILTERS · " + active + " ACTIVE" : "FILTERS";
    renderFeed();
    if (state.view === "digest") renderDigest();
    renderModal();
    writeHash();
  }

  function switchTracker(t) {
    if (state.tracker === t) return;
    state.tracker = t;
    state.sel = {};
    state.outcome = "all";
    state.q = "";
    state.week = null;
    state.open = null;
    state.openDigest = false;
    $("q").value = "";
    load(t).then(renderAll);
  }

  function resetFilters() {
    state.sel = {};
    state.outcome = "all";
    state.q = "";
    state.d1 = START;
    state.d2 = today();
    state.sort = "newest";
    $("q").value = "";
    $("d1").value = state.d1;
    $("d2").value = state.d2;
    $("sort").value = "newest";
    renderAll();
  }

  /* ---------- events ---------- */

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("button");

    if (ev.target.closest(".modal-backdrop") && !ev.target.closest(".modal")) {
      closeModal(); return;
    }
    if (!b) return;

    if (b.dataset.tracker) { switchTracker(b.dataset.tracker); return; }
    if (b.dataset.themeSet) { applyTheme(b.dataset.themeSet); return; }
    if (b.dataset.view) { state.view = b.dataset.view; state.openDigest = false; state.open = null; renderAll(); return; }
    if (b.dataset.facet) {
      var k = b.dataset.facet;
      state.sel[k] = b.dataset.value;
      /* changing a parent clears its child */
      cfg().facets.forEach(function (f) { if (f.children && f.key === k) delete state.sel[f.children]; });
      renderAll(); return;
    }
    if (b.dataset.outcome) { state.outcome = b.dataset.outcome; renderAll(); return; }
    if (b.dataset.share) { state.open = b.dataset.share; state.openDigest = false; renderModal(); return; }
    if (b.dataset.mlang) {
      state.mlang = b.dataset.mlang;
      try { localStorage.setItem("tracker-lang", state.mlang); } catch (e) { /* private mode */ }
      renderModal(); return;
    }
    if (b.dataset.dlang) {
      state.dlang = b.dataset.dlang;
      try { localStorage.setItem("tracker-lang", state.dlang); } catch (e) { /* private mode */ }
      setPressed("[data-dlang]", "dlang", state.dlang);
      renderDigest(); return;
    }

    switch (b.id) {
      case "filters-toggle":
        b.setAttribute("aria-expanded", b.getAttribute("aria-expanded") === "true" ? "false" : "true");
        break;
      case "reset": resetFilters(); break;
      case "csv": downloadCsv(); break;
      case "week-prev": {
        var ws = weeksAvailable(), i = ws.indexOf(state.week);
        if (i < ws.length - 1) { state.week = ws[i + 1]; renderDigest(); writeHash(); }
        break;
      }
      case "week-next": {
        var wn = weeksAvailable(), j = wn.indexOf(state.week);
        if (j > 0) { state.week = wn[j - 1]; renderDigest(); writeHash(); }
        break;
      }
      case "copy-text": copy(b, digestText(false)); break;
      case "copy-md": copy(b, digestText(true)); break;
      case "share-digest": state.openDigest = true; state.open = null; renderModal(); break;
      case "modal-close": closeModal(); break;
      case "modal-copy-text": copy(b, document.querySelector(".modal-backdrop").dataset.text); break;
      case "modal-copy-link": copy(b, document.querySelector(".modal-backdrop").dataset.link); break;
    }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && (state.open || state.openDigest)) closeModal();
  });

  window.addEventListener("hashchange", function () {
    if (writingHash) return;
    var was = state.tracker;
    readHash();
    if (state.tracker !== was) { load(state.tracker).then(renderAll); } else { renderAll(); }
  });

  /* ---------- boot ---------- */

  function boot() {
    var t = "dark", l = "en";
    try {
      t = localStorage.getItem("tracker-theme") || "dark";
      l = localStorage.getItem("tracker-lang") || "en";
    } catch (e) { /* private mode */ }
    state.dlang = state.mlang = (l === "ru" ? "ru" : "en");

    readHash();
    applyTheme(t === "light" ? "light" : "dark");

    $("d1").value = state.d1;
    $("d2").value = state.d2;
    $("q").value = state.q;
    $("sort").value = state.sort;

    $("q").addEventListener("input", function () { state.q = this.value; renderFeed(); writeHash(); });
    $("d1").addEventListener("change", function () { state.d1 = this.value || START; renderAll(); });
    $("d2").addEventListener("change", function () { state.d2 = this.value || today(); renderAll(); });
    $("sort").addEventListener("change", function () { state.sort = this.value; renderFeed(); });

    load(state.tracker).then(function () {
      renderAll();
      if (state.open) {
        var el = document.getElementById("e-" + state.open);
        if (el) el.scrollIntoView({ block: "center" });
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
