/* Private visitor dashboard for thestroudlab.com.
 *
 * Reads statistics from the GoatCounter API (https://www.goatcounter.com/help/api)
 * using a token the owner pastes in once. The token is kept in this browser's
 * storage and only ever sent to <code>.goatcounter.com. Nothing here is secret:
 * without a valid token the page cannot show anything.
 *
 * GoatCounter allows 4 API requests per second and 500 per hour, so requests
 * are queued, spaced out, retried on 429, and cached for five minutes.
 */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var KEY = 'gcdash.v1';
  var CACHE_MS = 5 * 60 * 1000;
  var creds = null;
  var state = { range: '30', from: null, to: null, data: null };
  var world = null;

  /* ---------------------------------------------------------------- storage */

  function store(kind) {
    try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch (e) { return null; }
  }
  function loadCreds() {
    var s = store('local'), t = store('session'), raw = null;
    try { raw = (s && s.getItem(KEY)) || (t && t.getItem(KEY)); } catch (e) {}
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function saveCreds(c, remember) {
    var s = store(remember ? 'local' : 'session');
    try { if (s) s.setItem(KEY, JSON.stringify(c)); } catch (e) {}
  }
  function clearCreds() {
    ['local', 'session'].forEach(function (k) {
      var s = store(k);
      try {
        if (!s) return;
        s.removeItem(KEY);
        for (var i = s.length - 1; i >= 0; i--) {
          var key = s.key(i);
          if (key && key.indexOf('gcdash.cache:') === 0) s.removeItem(key);
        }
      } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------- API */

  var queue = Promise.resolve();
  var lastCall = 0;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function api(path, params, opts) {
    params = params || {};
    var qs = Object.keys(params).filter(function (k) { return params[k] != null; }).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    var url = 'https://' + creds.site + '.goatcounter.com/api/v0' + path + (qs ? '?' + qs : '');
    var cacheKey = 'gcdash.cache:' + url;
    var cache = store('session');
    if (!(opts && opts.fresh) && cache) {
      try {
        var hit = JSON.parse(cache.getItem(cacheKey) || 'null');
        if (hit && Date.now() - hit.t < CACHE_MS) return Promise.resolve(hit.v);
      } catch (e) {}
    }
    var run = function () { return attempt(url, 0); };
    var p = queue.then(run, run);
    queue = p.catch(function () {});
    return p.then(function (v) {
      try { if (cache) cache.setItem(cacheKey, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
      return v;
    });
  }

  function attempt(url, tries) {
    var wait = Math.max(0, 550 - (Date.now() - lastCall));  // each call also sends a CORS preflight
    return sleep(wait).then(function () {
      lastCall = Date.now();
      return fetch(url, { headers: { Authorization: 'Bearer ' + creds.token }, credentials: 'omit', cache: 'no-store' });
    }).then(function (res) {
      if (res.status === 429 && tries < 4) {
        var ra = parseFloat(res.headers.get('Retry-After'));
        setStatus('GoatCounter asked us to slow down, retrying…');
        return sleep((isFinite(ra) ? ra * 1000 : 1500) * (tries + 1)).then(function () { return attempt(url, tries + 1); });
      }
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = t;
          try { var j = JSON.parse(t); msg = j.error || (j.errors && JSON.stringify(j.errors)) || t; } catch (e) {}
          var err = new Error(res.status + ': ' + msg);
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    });
  }

  /* ----------------------------------------------------------------- dates */

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function iso(d) { return new Date(Math.floor(d.getTime() / 3600000) * 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function dayCount(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000) + 1; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function fmtDay(s, withYear) {
    var d = parseYmd(s);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : '');
  }

  function currentRange() {
    var today = startOfDay(new Date());
    var from, to;
    if (state.range === 'custom') { from = parseYmd(state.from); to = parseYmd(state.to); }
    else if (state.range === 'today') { from = today; to = today; }
    else { to = today; from = addDays(today, -(parseInt(state.range, 10) - 1)); }
    var n = dayCount(from, to);
    var pTo = addDays(from, -1), pFrom = addDays(from, -n);
    return {
      from: from, to: to, days: n, prevFrom: pFrom, prevTo: pTo,
      q: { start: iso(from), end: iso(new Date(addDays(to, 1).getTime() - 1000)) },
      pq: { start: iso(pFrom), end: iso(new Date(addDays(pTo, 1).getTime() - 1000)) }
    };
  }

  /* ---------------------------------------------------------------- format */

  function num(n) { return (n || 0).toLocaleString('en-US'); }
  function compact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return num(n);
  }
  function pct(a, b) { return b ? (100 * a / b) : 0; }
  function flag(code) {
    if (!code || !/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
  }
  var SIZE_NAMES = { phone: 'Phones', tablet: 'Tablets', desktop: 'Computers', desktophd: 'Large monitors', unknown: 'Unknown' };

  /* ------------------------------------------------------------------- DOM */

  function el(tag, attrs, kids) {
    var n = /^(svg|g|path|rect|line|circle|text|polyline|title)$/.test(tag) ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] == null) return;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.setAttribute('class', attrs[k]);
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function empty(node, msg) { clear(node).appendChild(el('div', { class: 'empty', text: msg || 'Nothing recorded in this period yet.' })); }
  function setStatus(t) { $('status').textContent = t || ''; }

  /* --------------------------------------------------------------- tooltip */

  var tip = $('tip');
  function showTip(evt, rows) {
    clear(tip);
    rows.forEach(function (r) { tip.appendChild(r); });
    tip.hidden = false;
    var x = evt.clientX + 14, y = evt.clientY + 14;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = evt.clientY - h - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function tipLine(value, label, color) {
    return el('div', { class: 'row' }, [
      color ? el('span', { class: 'key', style: 'background:' + color }) : null,
      el('strong', { text: value }), el('span', { class: 'sub', text: label })
    ]);
  }

  /* ------------------------------------------------------------ bar lists */

  function barList(node, items, opts) {
    opts = opts || {};
    clear(node);
    if (!items.length) return empty(node, opts.emptyMsg);
    var max = Math.max.apply(null, items.map(function (i) { return i.count; })) || 1;
    var total = opts.total || items.reduce(function (s, i) { return s + i.count; }, 0);
    items.forEach(function (it) {
      var clickable = !!(opts.onClick && it.clickable !== false);
      var row = el(clickable ? 'button' : 'div', { class: 'bl-row', type: clickable ? 'button' : null, title: it.hint || null });
      var name = el('span', { class: 'bl-name' }, [
        it.flag ? el('span', { class: 'bl-flag', text: it.flag }) : null,
        it.name,
        it.sub ? el('small', { text: it.sub }) : null
      ]);
      var pctTxt = total ? pct(it.count, total).toFixed(pct(it.count, total) < 10 ? 1 : 0) + '%' : '';
      row.appendChild(name);
      row.appendChild(el('span', { class: 'bl-num' }, [num(it.count), opts.noPct ? null : el('small', { text: pctTxt })]));
      row.appendChild(el('span', { class: 'bl-bar' }, [el('i', { style: 'width:' + (100 * it.count / max).toFixed(2) + '%' })]));
      if (clickable) row.addEventListener('click', function () { opts.onClick(it); });
      node.appendChild(row);
    });
    if (opts.more) node.appendChild(el('div', { class: 'muted small', style: 'padding:6px 8px', text: 'Showing the top ' + items.length + '.' }));
  }

  /* -------------------------------------------------------------- drawer */

  function openDrawer(title, sub, loader) {
    $('drawer-title').textContent = title;
    $('drawer-sub').textContent = sub || '';
    var body = $('drawer-body');
    empty(body, 'Loading…');
    $('drawer').hidden = false;
    $('drawer-close').focus();
    loader().then(function (r) { barList(body, r.items, r.opts); }).catch(function (e) { empty(body, 'Could not load: ' + e.message); });
  }
  function closeDrawer() { $('drawer').hidden = true; }
  $('drawer-close').addEventListener('click', closeDrawer);
  $('drawer').addEventListener('click', function (e) { if (e.target === $('drawer')) closeDrawer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  function detail(page, id, title, sub, mapper) {
    var r = currentRange();
    openDrawer(title, sub, function () {
      return api('/stats/' + page + '/' + encodeURIComponent(id), { start: r.q.start, end: r.q.end, limit: 100 }).then(function (d) {
        return { items: (d.stats || []).map(mapper || function (s) { return { name: s.name || '(unknown)', count: s.count }; }), opts: { more: d.more } };
      });
    });
  }

  /* ---------------------------------------------------------- load & draw */

  var loadSeq = 0;
  function load(fresh) {
    var seq = ++loadSeq;
    var r = currentRange();
    var o = fresh ? { fresh: true } : null;
    var q = r.q, lim = function (n) { return { start: q.start, end: q.end, limit: n }; };
    $('main').classList.add('is-loading');
    setStatus('Loading…');
    var jobs = [
      api('/stats/total', q, o),
      api('/stats/total', r.pq, o),
      api('/stats/hits', lim(100), o),
      api('/stats/locations', lim(100), o),
      api('/stats/toprefs', lim(50), o),
      api('/stats/browsers', lim(20), o),
      api('/stats/systems', lim(20), o),
      api('/stats/sizes', lim(20), o),
      api('/stats/languages', lim(20), o),
      api('/stats/campaigns', lim(20), o)
    ];
    return Promise.all(jobs).then(function (res) {
      if (seq !== loadSeq) return;  // a newer range was picked while this one loaded
      var d = {
        range: r, total: res[0], prev: res[1], hits: res[2], locations: res[3], refs: res[4],
        browsers: res[5], systems: res[6], sizes: res[7], languages: res[8], campaigns: res[9]
      };
      state.data = d;
      draw(d);
      setStatus('Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    }).catch(function (e) {
      if (seq !== loadSeq) return;
      if (e.status === 401 || e.status === 403) {
        lock('That token was refused by GoatCounter (' + e.message + '). Make sure it has the “Read statistics” permission.');
        return;
      }
      setStatus('Could not load: ' + e.message);
    }).then(function () { if (seq === loadSeq) $('main').classList.remove('is-loading'); });
  }

  function draw(d) {
    var r = d.range;
    $('from').value = ymd(r.from); $('to').value = ymd(r.to);
    $('top-sub').textContent = app.dataset.domain + ' · ' +
      (r.days === 1 ? fmtDay(ymd(r.from), true) : fmtDay(ymd(r.from), r.from.getFullYear() !== r.to.getFullYear()) + ' to ' + fmtDay(ymd(r.to), true));
    var pages = (d.hits.hits || []).filter(function (h) { return !h.event; });
    var events = (d.hits.hits || []).filter(function (h) { return h.event; });
    drawTiles(d, pages, events);
    drawTrend(d);
    drawMap(d);
    drawHeat(d);
    drawRefs(d);
    drawPages(pages, d);
    drawEvents(events);
    drawTech(d);
  }

  /* ---------------------------------------------------------------- tiles */

  function tile(label, value, deltaNode, opts) {
    opts = opts || {};
    return el('div', { class: 'tile' + (opts.hero ? ' tile--hero' : '') }, [
      el('div', { class: 'tile__label', text: label }),
      el('div', { class: 'tile__value' + (opts.text ? ' tile__value--text' : ''), text: value }),
      deltaNode ? el('div', { class: 'tile__delta' }, deltaNode) : null,
      opts.spark || null
    ]);
  }

  function drawTiles(d, pages, events) {
    var node = clear($('tiles'));
    var r = d.range;
    var cur = (d.total.total || 0) - (d.total.total_events || 0);
    var prev = (d.prev.total || 0) - (d.prev.total_events || 0);
    var days = d.total.stats || [];
    var delta;
    if (prev > 0) {
      var ch = 100 * (cur - prev) / prev;
      delta = [el('b', { class: ch >= 0 ? 'up' : 'down', text: (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(Math.abs(ch) < 10 ? 1 : 0) + '%' }),
        ' vs the previous ' + (r.days === 1 ? 'day' : r.days + ' days') + ' (' + num(prev) + ')'];
    } else {
      delta = [prev === 0 && cur > 0 ? 'No visits in the previous period to compare with' : 'Previous ' + (r.days === 1 ? 'day' : r.days + ' days') + ': ' + num(prev)];
    }
    var sparkVals = r.days === 1 && days.length ? hourlyOf(days) : days.map(function (s) { return s.daily; });
    node.appendChild(tile('Visitors', compact(cur), delta, { hero: true, spark: sparkline(sparkVals, 320, 36, 'tile__spark') }));

    var busiest = days.reduce(function (b, s) { return s.daily > (b ? b.daily : -1) ? s : b; }, null);
    if (r.days > 1) {
      node.appendChild(tile('Daily average', num(Math.round(cur / Math.max(1, days.length))), ['across ' + days.length + ' days']));
      node.appendChild(tile('Busiest day', busiest && busiest.daily ? num(busiest.daily) : '–', busiest && busiest.daily ? [fmtDay(busiest.day, true)] : null));
    } else {
      var hrs = hourlyOf(days), peak = hrs.indexOf(Math.max.apply(null, hrs.concat([0])));
      node.appendChild(tile('Busiest hour', hrs.length && hrs[peak] ? hourLabel(peak) : '–', hrs[peak] ? [num(hrs[peak]) + ' visitors'] : null));
    }
    var locs = (d.locations.stats || []).filter(function (s) { return s.id; });
    node.appendChild(tile('Countries', num(locs.length) + (d.locations.more ? '+' : ''),
      locs[0] ? [flag(locs[0].id) + ' ' + locs[0].name + ' leads with ' + pct(locs[0].count, sumCount(d.locations.stats)).toFixed(0) + '%'] : null));
    var refs = (d.refs.stats || []).filter(function (s) { return s.name; });
    node.appendChild(tile('Top source', refs[0] ? refName(refs[0].name) : '–', refs[0] ? [num(refs[0].count) + ' visitors'] : null, { text: true }));
    var dl = events.filter(function (e) { return /^download\//.test(e.path); }).reduce(function (s, e) { return s + e.count; }, 0);
    node.appendChild(tile('Clicks and downloads', num(d.total.total_events || 0), [num(dl) + ' file download' + (dl === 1 ? '' : 's')]));
  }
  function sumCount(stats) { return (stats || []).reduce(function (s, x) { return s + x.count; }, 0); }
  function hourlyOf(days) {
    var h = new Array(24).fill(0);
    days.forEach(function (s) { (s.hourly || []).forEach(function (v, i) { h[i] += v; }); });
    return h;
  }
  function hourLabel(h) { return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); }

  function sparkline(vals, w, h, cls) {
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'none', class: cls || null, 'aria-hidden': 'true', width: cls ? null : w, height: cls ? null : h });
    if (!vals.length) return svg;
    var max = Math.max.apply(null, vals) || 1, n = vals.length;
    var xs = function (i) { return n === 1 ? w / 2 : 1 + i * (w - 2) / (n - 1); };
    var ys = function (v) { return h - 2 - (v / max) * (h - 4); };
    var pts = vals.map(function (v, i) { return xs(i).toFixed(1) + ',' + ys(v).toFixed(1); });
    svg.appendChild(el('path', { class: 'area', d: 'M' + xs(0) + ',' + h + ' L' + pts.join(' L') + ' L' + xs(n - 1) + ',' + h + ' Z' }));
    svg.appendChild(el('polyline', { class: 'line', points: pts.join(' '), 'vector-effect': 'non-scaling-stroke' }));
    return svg;
  }

  /* ---------------------------------------------------------------- trend */

  function bucket(stats, days) {
    // Returns [{label, from, value}] at hourly (1 day), daily (<=120 days) or weekly resolution.
    if (days === 1) {
      return hourlyOf(stats).map(function (v, i) { return { label: hourLabel(i), value: v }; });
    }
    var pts = stats.map(function (s) { return { label: fmtDay(s.day), day: s.day, value: s.daily }; });
    if (days <= 120) return pts;
    var out = [];
    for (var i = 0; i < pts.length; i += 7) {
      var chunk = pts.slice(i, i + 7);
      out.push({ label: 'Week of ' + chunk[0].label, day: chunk[0].day, value: chunk.reduce(function (s, p) { return s + p.value; }, 0) });
    }
    return out;
  }

  function niceMax(v) {
    if (v <= 4) return 4;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }

  function drawTrend(d) {
    var node = clear($('trend'));
    var r = d.range;
    var cur = bucket(d.total.stats || [], r.days);
    var prev = bucket(d.prev.stats || [], r.days);
    var legend = clear($('trend-legend'));
    legend.appendChild(el('span', {}, [el('i', { style: 'background:var(--accent)' }), 'This period']));
    legend.appendChild(el('span', {}, [el('i', { style: 'background:var(--compare)' }), 'Previous period']));
    if (!cur.length) return empty(node);

    var W = 1000, H = 280, L = 44, R = 12, T = 12, B = 28;
    var n = cur.length;
    var max = niceMax(Math.max.apply(null, cur.concat(prev).map(function (p) { return p.value; }).concat([1])));
    var x = function (i) { return L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Visitors per ' + (r.days === 1 ? 'hour' : r.days > 120 ? 'week' : 'day') });

    var grid = el('g', { class: 'grid' });
    for (var t = 0; t <= 4; t++) {
      var v = max * t / 4, yy = y(v);
      if (t > 0) grid.appendChild(el('line', { x1: L, x2: W - R, y1: yy, y2: yy }));
      svg.appendChild(el('text', { x: L - 8, y: yy + 4, 'text-anchor': 'end', text: compact(Math.round(v)) }));
    }
    svg.appendChild(grid);
    svg.appendChild(el('line', { class: 'baseline', x1: L, x2: W - R, y1: y(0), y2: y(0) }));

    var ticks = Math.min(n, 7);
    for (var k = 0; k < ticks; k++) {
      var i = Math.round(k * (n - 1) / Math.max(1, ticks - 1));
      svg.appendChild(el('text', { x: x(i), y: H - 8, 'text-anchor': k === 0 && n > 1 ? 'start' : k === ticks - 1 && n > 1 ? 'end' : 'middle', text: cur[i].label.replace('Week of ', '') }));
    }

    var path = function (pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(p.value).toFixed(1); }).join(' '); };
    if (prev.length) svg.appendChild(el('path', { class: 'line line--compare', d: path(prev.slice(0, n)) }));
    svg.appendChild(el('path', { class: 'area', d: path(cur) + ' L' + x(n - 1) + ',' + y(0) + ' L' + x(0) + ',' + y(0) + ' Z' }));
    svg.appendChild(el('path', { class: 'line', d: path(cur) }));

    var cross = el('line', { class: 'cross', y1: T, y2: y(0), visibility: 'hidden' });
    var dot = el('circle', { class: 'dot', r: 5, visibility: 'hidden' });
    svg.appendChild(cross); svg.appendChild(dot);
    var hit = el('rect', { x: L, y: 0, width: W - L - R, height: H, fill: 'transparent', tabindex: 0 });
    svg.appendChild(hit);
    var move = function (evt, idx) {
      if (idx == null) {
        var box = svg.getBoundingClientRect();
        var px = (evt.clientX - box.left) * W / box.width;
        idx = Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
      }
      cross.setAttribute('x1', x(idx)); cross.setAttribute('x2', x(idx)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(idx)); dot.setAttribute('cy', y(cur[idx].value)); dot.setAttribute('visibility', 'visible');
      var rows = [el('div', { class: 'sub', text: cur[idx].label + (cur[idx].day && r.days > 1 && r.days <= 120 ? ', ' + DOW[(parseYmd(cur[idx].day).getDay() + 6) % 7] : '') }),
        tipLine(num(cur[idx].value), 'visitors', 'var(--accent)')];
      if (prev[idx]) rows.push(tipLine(num(prev[idx].value), 'previous period (' + prev[idx].label + ')', 'var(--compare)'));
      showTip(evt, rows);
    };
    var focusIdx = n - 1;
    hit.addEventListener('pointermove', function (e) { move(e); });
    hit.addEventListener('pointerleave', function () { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); });
    hit.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      focusIdx = Math.max(0, Math.min(n - 1, focusIdx + (e.key === 'ArrowRight' ? 1 : -1)));
      var b = svg.getBoundingClientRect();
      move({ clientX: b.left + x(focusIdx) * b.width / W, clientY: b.top + y(cur[focusIdx].value) * b.height / H }, focusIdx);
    });
    hit.addEventListener('blur', hideTip);
    node.appendChild(svg);

    var tw = clear($('trend-table'));
    var table = el('table', {}, [el('thead', {}, [el('tr', {}, [el('th', { text: r.days === 1 ? 'Hour' : r.days > 120 ? 'Week' : 'Day' }), el('th', { class: 'num', text: 'Visitors' }), el('th', { class: 'num', text: 'Previous period' })])])]);
    var tb = el('tbody');
    cur.forEach(function (p, i) { tb.appendChild(el('tr', {}, [el('td', { text: p.label }), el('td', { class: 'num', text: num(p.value) }), el('td', { class: 'num', text: prev[i] ? num(prev[i].value) : '–' })])); });
    table.appendChild(tb);
    tw.appendChild(table);
  }
  $('btn-trend-table').addEventListener('click', function () {
    var t = $('trend-table'); t.hidden = !t.hidden;
    this.textContent = t.hidden ? 'Table' : 'Hide table';
  });

  /* ------------------------------------------------------------------ map */

  function seqColor(v, max) {
    if (!v) return 'var(--seq-0)';
    var t = Math.sqrt(v / max);  // square-root scale so small countries still show
    return 'var(--seq-' + Math.max(1, Math.min(7, Math.ceil(t * 7))) + ')';
  }

  function drawMap(d) {
    var stats = d.locations.stats || [];
    var byId = {};
    stats.forEach(function (s) { if (s.id) byId[s.id] = s; });
    var total = sumCount(stats);
    var max = Math.max.apply(null, stats.map(function (s) { return s.count; }).concat([1]));

    var list = $('countries');
    barList(list, stats.map(function (s) {
      return { id: s.id, name: s.name || 'Unknown', flag: flag(s.id), count: s.count, clickable: !!s.id };
    }), { total: total, more: d.locations.more, onClick: function (it) { countryDetail(it.id, it.name); } });

    var node = $('map');
    var paint = function () {
      clear(node);
      var svg = el('svg', { viewBox: '0 0 ' + world.w + ' ' + world.h, role: 'img', 'aria-label': 'World map of visitors by country' });
      world.countries.forEach(function (c) {
        var s = byId[c.id];
        var p = el('path', { d: c.d, class: s ? 'has' : null, style: 'fill:' + seqColor(s ? s.count : 0, max) });
        p.addEventListener('pointermove', function (e) {
          showTip(e, [el('div', { class: 'sub', text: flag(c.id) + ' ' + ((s && s.name) || c.n) }),
            tipLine(s ? num(s.count) : '0', s ? 'visitors · ' + pct(s.count, total).toFixed(1) + '%' : 'visitors')]);
        });
        p.addEventListener('pointerleave', hideTip);
        if (s) p.addEventListener('click', function () { hideTip(); countryDetail(c.id, s.name || c.n); });
        svg.appendChild(p);
      });
      node.appendChild(svg);
      var scale = el('div', { class: 'heat-scale' }, ['Fewer']);
      for (var i = 1; i <= 7; i++) scale.appendChild(el('span', { class: 'sw', style: 'background:var(--seq-' + i + ')' }));
      scale.appendChild(document.createTextNode('More (max ' + num(max) + ')'));
      node.appendChild(scale);
    };
    if (world) return paint();
    empty(node, 'Loading map…');
    fetch('/assets/stats/world.json').then(function (r) { return r.json(); }).then(function (w) { world = w; paint(); })
      .catch(function () { empty(node, 'Map unavailable.'); });
  }

  function countryDetail(id, name) {
    detail('locations', id, flag(id) + ' ' + name, 'Visitors by region or state', function (s) {
      return { name: s.name || '(region not known)', count: s.count };
    });
  }

  /* -------------------------------------------------------------- heatmap */

  function drawHeat(d) {
    var node = clear($('heat'));
    node.classList.add('heat');
    var grid = [0, 1, 2, 3, 4, 5, 6].map(function () { return new Array(24).fill(0); });
    var dayCounts = new Array(7).fill(0);
    (d.total.stats || []).forEach(function (s) {
      var w = (parseYmd(s.day).getDay() + 6) % 7;
      dayCounts[w]++;
      (s.hourly || []).forEach(function (v, h) { grid[w][h] += v; });
    });
    var max = Math.max.apply(null, [].concat.apply([], grid).concat([0]));
    $('tz-note').textContent = 'Hours in your GoatCounter time zone';
    if (!max) return empty(node);

    var cw = 22, ch = 22, L = 36, T = 18;
    var W = L + 24 * cw, H = T + 7 * ch;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Visitors by weekday and hour' });
    [0, 6, 12, 18].forEach(function (h) { svg.appendChild(el('text', { x: L + h * cw + 2, y: 11, text: hourLabel(h) })); });
    grid.forEach(function (row, w) {
      svg.appendChild(el('text', { x: 0, y: T + w * ch + 15, text: DOW[w] }));
      row.forEach(function (v, h) {
        var c = el('rect', { class: 'cell', x: L + h * cw, y: T + w * ch, width: cw, height: ch, style: 'fill:' + seqColor(v, max) });
        c.addEventListener('pointermove', function (e) {
          showTip(e, [el('div', { class: 'sub', text: DOW[w] + ', ' + hourLabel(h) + ' to ' + hourLabel((h + 1) % 24) }),
            tipLine(num(v), 'visitors' + (dayCounts[w] > 1 ? ' over ' + dayCounts[w] + ' ' + DOW[w] + 's' : ''))]);
        });
        c.addEventListener('pointerleave', hideTip);
        svg.appendChild(c);
      });
    });
    node.appendChild(svg);
    var best = { v: -1 };
    grid.forEach(function (row, w) { row.forEach(function (v, h) { if (v > best.v) best = { v: v, w: w, h: h }; }); });
    node.appendChild(el('div', { class: 'heat-scale' }, [
      el('span', { style: 'margin-right:auto', text: 'Peak: ' + DOW[best.w] + ' around ' + hourLabel(best.h) }), 'Fewer'
    ].concat([1, 2, 3, 4, 5, 6, 7].map(function (i) { return el('span', { class: 'sw', style: 'background:var(--seq-' + i + ')' }); })).concat(['More'])));
  }

  /* ------------------------------------------------------------ referrers */

  var SCHEME = { c: 'campaign', g: 'search or app' };
  function refName(n) { return (n || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''); }
  function drawRefs(d) {
    var stats = d.refs.stats || [];
    barList($('refs'), stats.map(function (s) {
      return { id: s.id, name: refName(s.name) || 'Direct, bookmarks, or unknown', hint: s.name || null, sub: s.ref_scheme && SCHEME[s.ref_scheme] ? SCHEME[s.ref_scheme] : '', count: s.count, clickable: !!s.name };
    }), { more: d.refs.more, onClick: function (it) {
      detail('toprefs', it.id, it.name, 'Exact referring links', function (s) { return { name: refName(s.name) || '(no path)', count: s.count }; });
    } });
  }

  /* ---------------------------------------------------------------- pages */

  function drawPages(pages, d) {
    var node = clear($('pages'));
    if (!pages.length) return empty(node);
    var max = Math.max.apply(null, pages.map(function (p) { return p.count; }));
    var table = el('table', {}, [el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Page' }), el('th', { class: 'spark', text: 'Trend' }), el('th', { class: 'num', text: 'Visitors' })
    ])])]);
    var tb = el('tbody');
    pages.forEach(function (p) {
      var vals = (p.stats || []).map(function (s) { return s.daily; });
      if (d.range.days === 1) vals = hourlyOf(p.stats || []);
      var tr = el('tr', { class: 'clickable', tabindex: 0 }, [
        el('td', {}, [el('span', { class: 'pg-title', text: p.title || p.path }), el('span', { class: 'pg-path', text: p.path })]),
        el('td', { class: 'spark' }, [sparkline(vals, 120, 26)]),
        el('td', { class: 'num' }, [
          el('div', { text: num(p.count) }),
          el('div', { class: 'bl-bar', style: 'height:4px;margin-top:3px' }, [el('i', { style: 'width:' + (100 * p.count / max).toFixed(1) + '%;margin-left:auto;border-radius:3px 0 0 3px' })])
        ])
      ]);
      var open = function () {
        var r = currentRange();
        openDrawer(p.title || p.path, 'Where visitors to ' + p.path + ' came from', function () {
          return api('/stats/hits/' + p.path_id, { start: r.q.start, end: r.q.end, limit: 100 }).then(function (res) {
            return { items: (res.refs || []).map(function (s) { return { name: refName(s.name) || 'Direct, bookmarks, or unknown', count: s.count }; }), opts: { more: res.more } };
          });
        });
      };
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    node.appendChild(el('div', { class: 'tablewrap', style: 'max-height:32rem;margin:0' }, [table]));
    if (d.hits.more) node.appendChild(el('p', { class: 'muted small', text: 'Showing the top ' + pages.length + ' pages and events.' }));
  }

  /* --------------------------------------------------------------- events */

  var EVENT_KIND = { download: 'Download', outbound: 'Link out', email: 'Email' };
  function drawEvents(events) {
    barList($('events'), events.map(function (e) {
      var kind = e.path.split('/')[0];
      var rest = e.path.slice(kind.length + 1);
      return { name: e.title && e.title !== e.path ? e.title : rest || e.path, sub: (EVENT_KIND[kind] || kind) + (rest && e.title ? ' · ' + rest : ''), count: e.count };
    }), { emptyMsg: 'No clicks recorded yet. Downloads, outbound links, and email links are counted automatically.' });
  }

  /* ----------------------------------------------------------------- tech */

  function drawTech(d) {
    var total = sumCount(d.sizes.stats);
    barList($('sizes'), (d.sizes.stats || []).filter(function (s) { return s.count; }).map(function (s) {
      return { id: s.id, name: SIZE_NAMES[s.id] || s.name || s.id, count: s.count };
    }), { total: total, onClick: function (it) { detail('sizes', it.id, it.name, 'Exact screen widths'); } });

    barList($('browsers'), (d.browsers.stats || []).map(function (s) { return { id: s.id, name: s.name || 'Unknown', count: s.count, clickable: !!s.name }; }),
      { more: d.browsers.more, onClick: function (it) { detail('browsers', it.id, it.name, 'Browser versions'); } });
    barList($('systems'), (d.systems.stats || []).map(function (s) { return { id: s.id, name: s.name || 'Unknown', count: s.count, clickable: !!s.name }; }),
      { more: d.systems.more, onClick: function (it) { detail('systems', it.id, it.name, 'System versions'); } });
    var langs = (d.languages.stats || []).filter(function (s) { return s.name && s.name !== '(unknown)'; });
    barList($('languages'), langs.map(function (s) { return { name: s.name, count: s.count }; }),
      { more: d.languages.more, emptyMsg: 'No language data. Tick “Collect language” under Settings in GoatCounter to record it.' });
    barList($('campaigns'), (d.campaigns.stats || []).map(function (s) { return { id: s.id, name: s.name || 'Unknown', count: s.count }; }),
      { more: d.campaigns.more, emptyMsg: 'No campaign links used yet. Add ?utm_campaign=name to a link you share to track it here.',
        onClick: function (it) { detail('campaigns', it.id, it.name, 'Sources for this campaign'); } });
  }

  /* ------------------------------------------------------------- controls */

  function markRange() {
    Array.prototype.forEach.call($('ranges').children, function (b) {
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(b.dataset.range === state.range));
    });
  }
  $('ranges').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-range]');
    if (!b) return;
    state.range = b.dataset.range;
    markRange();
    try { store('local').setItem('gcdash.range', state.range); } catch (err) {}
    load();
  });
  $('btn-custom').addEventListener('click', function () {
    var f = $('from').value, t = $('to').value;
    if (!f || !t) return setStatus('Pick both dates first.');
    if (f > t) { var x = f; f = t; t = x; }
    state.range = 'custom'; state.from = f; state.to = t;
    markRange();
    load();
  });
  $('btn-refresh').addEventListener('click', function () { load(true); });
  $('btn-lock').addEventListener('click', function () { clearCreds(); lock(); });

  // The site's tracker skips any browser with localStorage.skipgc = 't'. Same
  // origin as the site, so toggling it here covers every page.
  function paintSkip() {
    var on = false;
    try { on = localStorage.getItem('skipgc') === 't'; } catch (e) {}
    var b = $('btn-skip');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? '✓ Not counting my visits' : 'Stop counting my visits';
  }
  $('btn-skip').addEventListener('click', function () {
    try {
      if (localStorage.getItem('skipgc') === 't') localStorage.removeItem('skipgc');
      else localStorage.setItem('skipgc', 't');
    } catch (e) {}
    paintSkip();
  });

  /* ------------------------------------------------------------ lock flow */

  function lock(msg) {
    creds = null;
    $('dash').hidden = true;
    $('lock').hidden = false;
    $('lock-error').textContent = msg || '';
    $('lock-site').value = (loadCreds() || {}).site || app.dataset.site || '';
    $('lock-token').value = '';
    ($('lock-site').value ? $('lock-token') : $('lock-site')).focus();
  }

  function unlock() {
    $('lock').hidden = true;
    $('dash').hidden = false;
    $('gc-link').href = 'https://' + creds.site + '.goatcounter.com/';
    var today = ymd(new Date());
    $('to').value = today; $('to').max = today; $('from').max = today;
    $('from').value = ymd(addDays(new Date(), -29));
    try { var saved = localStorage.getItem('gcdash.range'); if (saved) state.range = saved; } catch (e) {}
    markRange();
    paintSkip();
    load();
  }

  $('lock-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var site = $('lock-site').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.goatcounter\.com.*$/, '');
    var token = $('lock-token').value.trim();
    if (!/^[a-z0-9-]+$/.test(site) || !token) { $('lock-error').textContent = 'Enter the site code and a token.'; return; }
    creds = { site: site, token: token };
    $('lock-error').textContent = 'Checking…';
    api('/stats/total', { start: iso(startOfDay(new Date())) }, { fresh: true }).then(function () {
      saveCreds(creds, $('lock-remember').checked);
      $('lock-error').textContent = '';
      unlock();
    }).catch(function (err) {
      creds = null;
      $('lock-error').textContent = err.status === 401 || err.status === 403
        ? 'GoatCounter refused that token. Check it has the “Read statistics” permission.'
        : 'Could not reach GoatCounter (' + err.message + '). Check the site code.';
    });
  });

  creds = loadCreds();
  if (creds && creds.site && creds.token) unlock(); else lock();
})();
