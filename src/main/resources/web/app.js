/* ═══════════════════════════════════════════════════════════
   Pulse · SPA (hash-роутер, безопасный DOM, API-клиент)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ───────────────────────── Утилиты ───────────────────────── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  /* Привязка с заменой: повторная подписка НЕ дублируется (для устойчивых узлов каркаса). */
  function on(el, type, fn) {
    if (!el) return;
    var slot = el.__plisten || (el.__plisten = {});
    if (slot[type]) el.removeEventListener(type, slot[type]);
    slot[type] = fn;
    el.addEventListener(type, fn);
  }
  var I18N = window.PulseI18n || {
    langs: [{ code: 'ru', name: 'Русский', short: 'RU', bcp47: 'ru-RU' }],
    t: function (k) { return k; },
    lang: function () { return 'ru'; },
    bcp47: function () { return 'ru-RU'; },
    langInfo: function () { return { code: 'ru', name: 'Русский', short: 'RU', bcp47: 'ru-RU' }; },
    setLang: function () {},
    applyServerDefault: function () {},
    daysShort: function () { return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']; },
    daysFull: function () { return ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']; },
    translateWeekday: function (x) { return x; },
    translateHistLabels: function (x) { return x || []; },
    translateUptime: function (x) { return x || '—'; },
    applyDom: function () {}
  };
  var t = I18N.t;

  function fmt(n) {
    try { return new Intl.NumberFormat(I18N.bcp47()).format(n == null ? 0 : n); }
    catch (e) { return String(n == null ? 0 : n); }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }
  function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    var p = [];
    if (d > 0) p.push(t('dur.d', d));
    if (h > 0) p.push(t('dur.h', h));
    if (m > 0) p.push(t('dur.m', m));
    return p.join(' ') || t('dur.s', sec);
  }

  function fmtDurShort(sec) {
    sec = Math.max(0, Math.floor(sec));
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    if (d > 0) return t('dur.short.dh', d, h);
    if (h > 0) return m ? t('dur.short.hm', h, m) : t('dur.short.h', h);
    if (m > 0) return t('dur.short.m', m);
    return t('dur.short.s', sec);
  }
  function tzConf() {
    var tz = store.get('tz', 'server');
    return tz === 'server' && conf.zone ? conf.zone : undefined;
  }
  function fmtTs(ms, withDay) {
    if (!ms) return '—';
    var opts = { hour: '2-digit', minute: '2-digit' };
    if (withDay) opts.day = 'numeric', opts.month = 'numeric', opts.year = '2-digit';
    opts.timeZone = tzConf();
    var loc = I18N.bcp47();
    try { return new Date(ms).toLocaleString(loc, opts); }
    catch (e) { return new Date(ms).toLocaleString(loc, { hour: '2-digit', minute: '2-digit' }); }
  }
  function fmtTsInZone(ms, withDay, zone) {
    if (!ms) return '—';
    var opts = { hour: '2-digit', minute: '2-digit' };
    if (withDay) opts.day = 'numeric', opts.month = 'numeric', opts.year = '2-digit';
    if (zone) opts.timeZone = zone;
    try { return new Date(ms).toLocaleString(I18N.bcp47(), opts); }
    catch (e) { return fmtTs(ms, withDay); }
  }
  function fmtDateOnly(ms) {
    if (!ms) return '—';
    var opts = { day: 'numeric', month: 'short', year: '2-digit' };
    opts.timeZone = tzConf();
    try { return new Date(ms).toLocaleString(I18N.bcp47(), opts); }
    catch (e) { return ''; }
  }
  function chroma(k) { return (getComputedStyle(document.documentElement).getPropertyValue(k) || '').trim(); }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function gradStops(colorA, colorB, steps) {
    var out = [], ca = parseInt(colorA.slice(1), 16), cb = parseInt(colorB.slice(1), 16);
    for (var i = 0; i < steps; i++) {
      var st = i / (steps - 1);
      var r = Math.round((ca >> 16 & 255) + ((cb >> 16 & 255) - (ca >> 16 & 255)) * st);
      var g = Math.round((ca >> 8 & 255) + ((cb >> 8 & 255) - (ca >> 8 & 255)) * st);
      var b = Math.round((ca & 255) + ((cb & 255) - (ca & 255)) * st);
      out.push('rgb(' + r + ',' + g + ',' + b + ')');
    }
    return out;
  }
  function avatarHtml(uuid, size) {
    var img = document.createElement('img');
    img.className = 'avatar';
    img.alt = '';
    img.width = size; img.height = size;
    img.src = '/head/' + encodeURIComponent(uuid) + '?s=' + (size || 64);
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', function () { img.style.opacity = '.25'; });
    return img;
  }
  function normalizeUuid(value) { return String(value || '').replace(/-/g, '').trim().toLowerCase(); }
  function debounce(fn, ms) {
    var tm = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(tm);
      tm = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 250);
  }
  /* Нативный спарклайн (Canvas 2D) вместо Chart.js — исключает ResizeObserver-петлю. */
  function drawSpark(cv, vals, color) {
    if (!cv) return;
    var g = cv.getContext('2d');
    if (!vals || !vals.length) {
      g.clearRect(0, 0, cv.width, cv.height);
      return;
    }
    var w = cv.parentElement ? cv.parentElement.clientWidth : 120;
    if (w <= 0) w = 120;
    var h = 30;
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);

    var max = Math.max.apply(null, vals);
    var min = Math.min.apply(null, vals);
    var rng = (max - min) || 1;
    var pad = 2;

    var pts = vals.map(function (v, i) {
      var x = pad + (i / Math.max(1, vals.length - 1)) * (w - 2 * pad);
      var y = (h - pad) - ((v - min) / rng) * (h - 2 * pad);
      return [x, y];
    });

    g.beginPath();
    pts.forEach(function (pt, i) {
      if (i === 0) g.moveTo(pt[0], pt[1]);
      else g.lineTo(pt[0], pt[1]);
    });
    g.strokeStyle = color;
    g.lineWidth = 1.8;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();

    g.lineTo(pts[pts.length - 1][0], h);
    g.lineTo(pts[0][0], h);
    g.closePath();
    g.fillStyle = color;
    g.globalAlpha = 0.15;
    g.fill();
    g.globalAlpha = 1;
  }

  /* ───────────────────────── Состояние ───────────────────────── */
  var KEY = 'pulse.';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { } }
  };
  var conf = { src: 'crafatar', days: 30, refresh: 60, servers: [], version: '', serverName: '', zone: undefined, env: null, dapEnabled: false, dapInstalled: false };
  var activeServer = store.get('srv', 'local');
  var viewSeq = 0;
  var charts = {};
  var playerState = { page: 0, limit: 25, sort: 'playtime', filter: 'all', q: '' };
  var lastDataAt = Number(store.get('lastDataAt.' + activeServer, 0)) || 0;
  var dataStale = !!lastDataAt;
  var statusSeq = 0;
  var manualRefresh = false;
  var dataBatch = null;
  var serverZones = {};

  function daysFor(period) {
    return ({ '24h': 1, '7d': 7, '30d': 30, 'all': 366, 'custom': 30 })[period] || 30;
  }
  function currentPeriod() {
    var period = store.get('period', '7d');
    if (['24h', '7d', '30d', 'all', 'custom'].indexOf(period) < 0) return '7d';
    if (period === 'custom') {
      var range = store.get('periodRange', null);
      if (!range || !range.from || !range.to) return '7d';
    }
    return period;
  }

  function periodQuery(periodOverride) {
    var period = periodOverride || currentPeriod();
    var query = 'period=' + encodeURIComponent(period);
    if (period === 'custom') {
      var range = store.get('periodRange', null) || {};
      if (range.from && range.to) query += '&from=' + encodeURIComponent(range.from) + '&to=' + encodeURIComponent(range.to);
    }
    return query;
  }
  function periodPath(periodOverride) { return '/api/period?' + periodQuery(periodOverride); }
  function fetchPeriod(periodOverride) { return j(periodPath(periodOverride)); }
  function dateInZone(ms, zone) {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
      var values = {};
      parts.forEach(function (p) { if (p.type !== 'literal') values[p.type] = p.value; });
      return values.year + '-' + values.month + '-' + values.day;
    } catch (e) {
      var d = new Date(ms);
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
  }
  function isoDateOffset(iso, days) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function openPeriodRangeModal() {
    var today = dateInZone(Date.now(), serverZones[activeServer] || conf.zone);
    var saved = store.get('periodRange', null) || {};
    var fromDefault = saved.from || isoDateOffset(today, -6);
    var toDefault = saved.to || today;
    openModal(t('period.customTitle'), function (body, hide) {
      var form = document.createElement('form');
      form.className = 'period-form';
      form.innerHTML =
        '<label>' + esc(t('period.from')) + '<input class="inp" id="period-from" type="date" required></label>' +
        '<label>' + esc(t('period.to')) + '<input class="inp" id="period-to" type="date" required></label>' +
        '<div class="period-form-error" id="period-form-error" role="alert" hidden></div>' +
        '<div class="period-form-actions"><button type="button" class="btn-secondary" id="period-cancel">' + esc(t('common.close')) + '</button>' +
        '<button type="submit" class="btn-primary">' + esc(t('period.apply')) + '</button></div>';
      body.appendChild(form);
      var fromInput = $('#period-from', form), toInput = $('#period-to', form), error = $('#period-form-error', form);
      fromInput.value = fromDefault; toInput.value = toDefault;
      on($('#period-cancel', form), 'click', hide);
      on(form, 'submit', function (e) {
        e.preventDefault();
        var from = fromInput.value, to = toInput.value;
        if (!from || !to || from > to || to > dateInZone(Date.now(), serverZones[activeServer] || conf.zone)) {
          error.textContent = t('period.customInvalid');
          error.hidden = false;
          return;
        }
        store.set('periodRange', { from: from, to: to });
        store.set('period', 'custom');
        if (hide) hide();
        renderPeriod();
        route();
      });
    }, 'period-modal');
  }
  function periodCaption(data, periodOverride) {
    if (!data) return '';
    var period = periodOverride || currentPeriod();
    var zone = data.zone || conf.zone || '';
    var range = store.get('periodRange', null) || {};
    var from = period === 'custom' && range.from ? range.from : fmtTsInZone(data.from, true, zone);
    var to = period === 'custom' && range.to ? range.to : fmtTsInZone(Math.max(data.from || 0, (data.to || 1) - 1), true, zone);
    var label = period === 'all' ? t('period.allHistory') + ' · ' : '';
    return label + t('period.range', from, to, zone) + ' · ' + t('period.accounting');
  }
  function periodDelta(current, previous) {
    if (previous === null || previous === undefined) return { text: t('period.noComparison'), cls: 'badge-flat' };
    current = Number(current) || 0; previous = Number(previous) || 0;
    if (previous === 0 && current > 0) return { text: t('period.newActivity'), cls: 'badge-up' };
    var pct = previous === 0 ? 0 : Math.round((current - previous) * 100 / previous);
    var signed = pct > 0 ? '+' + pct : String(pct);
    return { text: t('period.vsPrevious', signed), cls: pct > 0 ? 'badge-up' : pct < 0 ? 'badge-down' : 'badge-flat' };
  }
  function periodHelpButton(key) {
    return '<button class="metric-help" type="button" data-help-key="' + esc(key) + '" aria-label="' + esc(t(key)) + '" title="' + esc(t(key)) + '">?</button>';
  }
  function bindMetricHelp(root) {
    $$('.metric-help', root).forEach(function (button) {
      on(button, 'click', function () {
        var key = button.dataset.helpKey;
        openModal(t('period.helpTitle'), function (body) {
          var text = document.createElement('p');
          text.style.cssText = 'margin:0;color:var(--muted);line-height:1.6';
          text.textContent = t(key);
          body.appendChild(text);
        });
      });
    });
  }

  function isPanelDataPath(path) {
    return path.indexOf('/api/') === 0
      && path.indexOf('/api/meta') !== 0
      && path.indexOf('/api/servers') !== 0
      && path.indexOf('/api/online') !== 0
      && path.indexOf('/api/login') !== 0
      && path.indexOf('/api/logout') !== 0
      && path.indexOf('/api/link/') !== 0
      && path.indexOf('/api/dap/action') !== 0
      && path.indexOf('/api/events') !== 0;
  }
  function paintFreshness() {
    var el = $('#freshness-text');
    if (el) {
      var timedOut = lastDataAt && Date.now() - lastDataAt > Math.max(120, (conf.refresh || 60) * 3) * 1000;
      var stale = dataStale || !!timedOut;
      el.classList.toggle('stale', stale);
      var stamp = store.get('tz', 'server') === 'server'
        ? fmtTsInZone(lastDataAt, true, serverZones[activeServer] || conf.zone)
        : fmtTs(lastDataAt, true);
      el.textContent = !lastDataAt ? t('top.freshWaiting') : stale
        ? t('top.freshStale', stamp)
        : t('top.freshAt', stamp);
    }
    var btn = $('#refresh-btn');
    if (btn) btn.disabled = manualRefresh;
  }
  function markDataFresh(timestamp) {
    var at = Number(timestamp);
    lastDataAt = at > 0 ? at : Date.now();
    dataStale = false;
    store.set('lastDataAt.' + activeServer, lastDataAt);
    paintFreshness();
  }
  function markDataStale() {
    dataStale = true;
    if (dataBatch && dataBatch.seq === viewSeq && dataBatch.server === activeServer) dataBatch.failed = true;
    paintFreshness();
  }
  function loadFreshnessForServer() {
    lastDataAt = Number(store.get('lastDataAt.' + activeServer, 0)) || 0;
    dataStale = !!lastDataAt;
    paintFreshness();
  }
  function setActiveServer(name) {
    activeServer = name;
    store.set('srv', name);
    loadFreshnessForServer();
  }
  function beginDataRequest(server, seq) {
    if (!dataBatch || dataBatch.server !== server || dataBatch.seq !== seq) {
      dataBatch = { server: server, seq: seq, pending: 0, failed: false, success: false, timestamp: 0, freshMarked: false, settled: false };
    }
    dataBatch.settled = false;
    dataBatch.pending++;
    return dataBatch;
  }
  function finishDataRequest(batch, ok, payload, server, seq) {
    if (!batch || batch.settled) return;
    if (ok) {
      batch.success = true;
      var generated = Number(payload && payload.generatedAt) || Date.now();
      batch.timestamp = Math.max(batch.timestamp, generated);
      if (payload && payload.zone) serverZones[server] = payload.zone;
    } else batch.failed = true;
    batch.pending = Math.max(0, batch.pending - 1);
    if (batch.pending !== 0) return;
    batch.settled = true;
    if (server !== activeServer || seq !== viewSeq || batch.server !== server || batch.seq !== seq) return;
    if (batch.failed) markDataStale();
    else if (batch.success && !batch.freshMarked) { markDataFresh(batch.timestamp); batch.freshMarked = true; }
    if (manualRefresh) { manualRefresh = false; paintFreshness(); }
  }

  /* ───────────────────────── API-клиент ───────────────────────── */
  function apiBase() { return activeServer === 'local' ? '' : '/api/servers/' + encodeURIComponent(activeServer); }
  function apiUrl(path) {
    if (path === '/api/meta' || path === '/api/servers' || path === '/api/login' || path === '/api/logout' || path.indexOf('/api/link/') === 0 || path.indexOf('/api/dap/') === 0) return path;
    return apiBase() + path;
  }
  async function j(path) {
    var headers = {};
    if (sessionStorage.getItem('pulse_token')) headers['X-Pulse-Token'] = sessionStorage.getItem('pulse_token');
    var r, serverAtStart = activeServer, requestSeq = viewSeq, trackData = isPanelDataPath(path);
    var batch = trackData ? beginDataRequest(serverAtStart, requestSeq) : null;
    function finish(ok, data) { if (trackData) finishDataRequest(batch, ok, data, serverAtStart, requestSeq); }
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;
    try { r = await fetch(apiUrl(path), { headers: headers, signal: controller ? controller.signal : undefined }); }
    catch (e) { clearTimeout(timeout); finish(false); return { __networkError: true, __timeout: !!(e && e.name === 'AbortError') }; }
    if (r.status === 401) {
      clearTimeout(timeout);
      if (path !== '/api/login') await openLogin();
      finish(false);
      return null;
    }
    var payload = null, raw = '';
    try {
      raw = await r.text();
      clearTimeout(timeout);
      payload = raw ? JSON.parse(raw) : null;
    } catch (e) {
      clearTimeout(timeout);
      finish(false);
      return { error: t('err.badHttp', r.status), __httpError: true, __parseError: true, status: r.status };
    }
    if (!r.ok) {
      var httpError = payload && payload.error ? payload.error : t('err.badHttp', r.status);
      finish(false);
      return { error: httpError, hint: payload && payload.hint, __httpError: true, status: r.status };
    }
    var periodRequest = path.indexOf('/api/period?') === 0;
    var unavailablePeriod = periodRequest && payload && payload.unsupported === true;
    finish(!!(unavailablePeriod || (payload && !payload.error && (!periodRequest || isValidPeriodResponse(payload)))), payload);
    return payload;
  }
  async function postJson(path, bodyObj) {
    var headers = { 'Content-Type': 'application/json' };
    if (sessionStorage.getItem('pulse_token')) headers['X-Pulse-Token'] = sessionStorage.getItem('pulse_token');
    var r;
    var controller = path === '/api/chat/send' && typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;
    try {
      r = await fetch(apiUrl(path), { method: 'POST', headers: headers, body: JSON.stringify(bodyObj || {}), signal: controller ? controller.signal : undefined });
    } catch (e) {
      clearTimeout(timeout);
      return { ok: false, error: t('err.noLocalPanel'), uncertain: true, __networkError: true };
    }
    if (r.status === 401) {
      clearTimeout(timeout);
      if (path !== '/api/login') await openLogin();
      return null;
    }
    var payload = null;
    try { payload = await r.json(); }
    catch (e) { clearTimeout(timeout); return { ok: false, error: t('err.badHttp', r.status), uncertain: true, status: r.status }; }
    clearTimeout(timeout);
    if (!r.ok) return { ok: false, error: (payload && payload.error) || t('err.badHttp', r.status), status: r.status };
    return payload;
  }
  function copyText(text, btn, doneLabel) {
    function markDone() {
      if (!btn) return;
      var orig = btn.dataset.origLabel || btn.textContent;
      btn.dataset.origLabel = orig;
      btn.textContent = doneLabel || t('common.copied');
      setTimeout(function () { btn.textContent = orig; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(markDone).catch(function () { fallbackCopy(text); markDone(); });
    } else {
      fallbackCopy(text); markDone();
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    ta.remove();
  }
  function encodeLinkCodeClient(name, url, token) {
    var payload = JSON.stringify({ v: 1, name: name || 'server', url: url || '', token: token || '' });
    var utf8 = encodeURIComponent(payload).replace(/%([0-9A-F]{2})/g, function (_, p1) {
      return String.fromCharCode(parseInt(p1, 16));
    });
    var b64 = btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'pulse://' + b64;
  }
  function decodeLinkCodeClient(raw) {
    if (!raw) return null;
    var s = raw.trim();
    var idx = s.toLowerCase().indexOf('pulse://');
    if (idx > 0) s = s.slice(idx).split(/\s+/)[0];
    if (s.toLowerCase().indexOf('pulse://') !== 0) return null;
    var b64 = s.slice(8).trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    try {
      var bin = atob(b64);
      var utf8 = decodeURIComponent(bin.split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      var obj = JSON.parse(utf8);
      if (!obj || !obj.url) return null;
      return { name: obj.name || '', url: obj.url || '', token: obj.token || '' };
    } catch (e) {
      return null;
    }
  }

  /* ───────────────────────── Вход ───────────────────────── */
  var loginPromise = null;
  function openLogin() {
    if (loginPromise) return loginPromise;
    loginPromise = new Promise(function (resolve) {
      var modal = $('#login-modal');
      var pass = $('#login-pass');
      var err = $('#login-err');
      var btn = $('#login-btn');
      modal.hidden = false;
      err.classList.remove('show');
      pass.value = '';
      setTimeout(function () { pass.focus(); }, 50);
      function onKey(e) { if (e.key === 'Enter') submit(); }
      function submit() {
        if (btn.disabled) return;
        btn.disabled = true;
        err.classList.remove('show');
        var pw = pass.value;
        fetch(apiUrl('/api/login'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw })
        }).then(function (r) {
          if (r.status !== 200) throw new Error('bad');
          return r.json();
        }).then(function (d) {
          if (d && d.token) sessionStorage.setItem('pulse_token', d.token);
          else sessionStorage.setItem('pulse_token', '1');
          modal.hidden = true;
          pass.removeEventListener('keydown', onKey);
          resolve(true);
          location.reload();
        }).catch(function () {
          err.textContent = t('login.wrongPass');
          err.classList.add('show');
          btn.disabled = false;
          pass.focus();
        });
      }
      $('#login-form').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
      pass.addEventListener('keydown', onKey);
      pass.addEventListener('input', function () { err.classList.remove('show'); });
    });
    return loginPromise;
  }

  /* ───────────────────────── Chart-хелпер ───────────────────────── */
  var pendingCharts = {};
  function chart(id, cfg) {
    var cv = $('#' + id);
    if (!cv || !window.Chart) return null;
    if (cv.offsetWidth === 0 && cv.offsetHeight === 0) {
      pendingCharts[id] = cfg;
      return null;
    }
    if (charts[id]) {
      try {
        if (!charts[id].canvas || !charts[id].canvas.isConnected) {
          charts[id].destroy();
          charts[id] = null;
        } else {
          charts[id].data.labels = cfg.data.labels;
          charts[id].data.datasets = cfg.data.datasets;
          if (cfg.options) charts[id].options = cfg.options;
          charts[id].update('none');
          return charts[id];
        }
      } catch (e) {
        try { charts[id].destroy(); } catch (e2) { }
        charts[id] = null;
      }
    }
    try { charts[id] = new Chart(cv.getContext('2d'), cfg); }
    catch (e) { console.error('Pulse chart error (' + id + ')', e); charts[id] = null; }
    return charts[id];
  }
  function flushPendingCharts() {
    Object.keys(pendingCharts).forEach(function (id) {
      var cfg = pendingCharts[id];
      if (!cfg) return;
      var cv = $('#' + id);
      if (!cv || (cv.offsetWidth === 0 && cv.offsetHeight === 0)) return;
      delete pendingCharts[id];
      if (charts[id]) { try { charts[id].destroy(); } catch (e) { } }
      try { charts[id] = new Chart(cv.getContext('2d'), cfg); }
      catch (e) { console.error('Pulse chart error (' + id + ')', e); charts[id] = null; }
    });
  }
  function clearCharts() {
    Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) { } });
    charts = {};
    pendingCharts = {};
  }
  function baseScales(y1, y2) {
    var s = {
      x: { grid: { display: false }, ticks: { color: '#68718a', font: { size: 10 }, maxTicksLimit: 10 } },
      y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#68718a', font: { size: 10 } }, beginAtZero: true }
    };
    if (y2) s.y1 = Object.assign({}, s.y, { position: 'left' }), s.y2 = Object.assign({}, s.y, { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } });
    else s.y = Object.assign({}, s.y);
    return s;
  }
  function lineCfg(labels, datasets, extra) {
    var cfg = {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, labels: { usePointStyle: true, boxWidth: 7, color: '#9aa4ba' } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: baseScales()
      }
    };
    if (extra) Object.assign(cfg.options, extra.options || {}), Object.assign(cfg, extra.data || {});
    return cfg;
  }
  function barCfg(labels, datasets, extra) {
    var cfg = {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, labels: { usePointStyle: true, boxWidth: 7, color: '#9aa4ba' } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: baseScales()
      }
    };
    if (extra) Object.assign(cfg.options, extra.options || {}), Object.assign(cfg, extra.data || {});
    return cfg;
  }
  function doughnutCfg(labels, values, colors) {
    return {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#12161f', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'right', labels: { color: '#9aa4ba', boxWidth: 8, font: { size: 10 } } } }
      }
    };
  }

  /* ───────────────────────── Модалка ───────────────────────── */
  function openModal(title, build, extraClass) {
    var modal = document.createElement('div');
    modal.className = 'modal';
    var card = document.createElement('div');
    card.className = 'modal-card' + (extraClass ? ' ' + extraClass : '');
    var head = document.createElement('div');
    head.className = 'modal-head';
    var h3 = document.createElement('h3'); h3.textContent = title;
    var close = document.createElement('button');
    close.className = 'modal-close'; close.textContent = '✕'; close.setAttribute('aria-label', t('common.close'));
    head.appendChild(h3); head.appendChild(close);
    card.appendChild(head);
    var body = document.createElement('div'); card.appendChild(body);
    modal.appendChild(card);
    var previousFocus = document.activeElement;
    function hide() {
      modal.remove();
      document.removeEventListener('keydown', onKey);
      if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus();
    }
    function onKey(e) {
      var stack = $$('.modal');
      if (stack[stack.length - 1] !== modal) return;
      if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
      if (e.key === 'Tab') {
        var focusable = $$('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]', modal).filter(function (node) { return node.getClientRects().length > 0; });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    }
    close.addEventListener('click', hide);
    modal.addEventListener('click', function (e) { if (e.target === modal) hide(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(modal);
    try { build(body, hide); } catch (e) { console.error(e); }
    if (!modal.contains(document.activeElement)) close.focus();
    return hide;
  }

  /* ───────────────────────── Роутер ───────────────────────── */
  function parseHash() {
    var h;
    try { h = decodeURIComponent((location.hash || '#/overview').replace(/^#/, '')); }
    catch (e) { return { view: 'overview', args: [] }; }
    var parts = h.split('/').filter(Boolean);
    if (!parts.length) return { view: 'overview', args: [] };
    var view = parts[0], args = parts.slice(1);
    if (view !== 'overview' && view !== 'players' && view !== 'player' && view !== 'chat' && view !== 'deaths' && view !== 'server' && view !== 'analytics' && view !== 'dap') return { view: 'overview', args: [] };
    return { view: view, args: args };
  }
  function navigate(hash) {
    if (location.hash === '#' + hash) { route(); }
    else location.hash = hash;
    if ($('.sidebar')) $('.sidebar').classList.remove('open');
    if ($('#drawer-overlay')) $('#drawer-overlay').hidden = true;
  }
  var lastView = null; // Запоминаем предыдущий экран
  var navigationSeq = 0;
  var navigationKey = null;
  function route(isBackgroundRefresh) {
    var r = parseHash();
    var nextNavigationKey = r.view + ':' + (r.args[0] || '') + ':' + activeServer + ':' + I18N.lang();
    if (navigationKey !== nextNavigationKey) { navigationKey = nextNavigationKey; navigationSeq++; }
    if (r.view !== 'chat' && window.PulseModules && window.PulseModules.chat && window.PulseModules.chat.dispose) window.PulseModules.chat.dispose();
    if (r.view !== 'dap' && window.PulseModules && window.PulseModules.macronuxdam && window.PulseModules.macronuxdam.dispose) window.PulseModules.macronuxdam.dispose();
    renderPeriod();
    setActiveNav(r.view);
    viewSeq++;
    var seq = viewSeq;
    var box = $('#view');

    // Переход в ДРУГОЙ раздел (или к другому игроку) — отматываем наверх.
    // Тот же раздел или фоновый апдейт — сохраняем текущий скролл.
    var viewKey = r.view + ':' + (r.args[0] || '') + ':' + I18N.lang();
    var viewChanged = (lastView !== viewKey);
    var savedScroll = box ? box.scrollTop : 0;
    if (viewChanged && !isBackgroundRefresh) {
      if (box) box.scrollTop = 0;
    }
    lastView = viewKey;

    try {
      if (r.view === 'players') runPlayers(seq);
      else if (r.view === 'player') runPlayer(r.args[0] || '', seq);
      else if (r.view === 'deaths') runDeaths(seq);
      else if (r.view === 'server') runServer(seq);
      else if (r.view === 'analytics') runAnalytics(seq);
      else if (r.view === 'chat') runChat(seq);
      else if (r.view === 'dap') runDap(seq);
      else runOverview(seq);
    } catch (e) { console.error(e); }

    // Восстанавливаем скролл на случай, если разметка перестроилась
    if (!viewChanged && box && savedScroll > 0) {
      box.scrollTop = savedScroll;
    }

    setTimeout(flushPendingCharts, 100);
  }
  function setActiveNav(view) {
    var map = { overview: '/overview', players: '/players', chat: '/chat', deaths: '/deaths', server: '/server', analytics: '/analytics', dap: '/dap', player: '/players' };
    $$('.nav-link').forEach(function (b) {
      b.classList.toggle('active', b.dataset.route === map[view]);
    });
  }
  function staticShell(html) {
    var box = $('#view');
    var curTitle = box.querySelector('.view-title, .view-sub');
    var temp = document.createElement('div');
    temp.innerHTML = html; /* статический шаблон без данных */
    var newTitle = temp.querySelector('.view-title, .view-sub');
    if (curTitle && newTitle && newTitle.textContent && curTitle.textContent === newTitle.textContent && box.dataset.lang === I18N.lang()) {
      return box; /* каркас уже на месте — не перестраиваем, не теряем скролл и холсты */
    }
    clearCharts();
    box.innerHTML = '';
    box.dataset.lang = I18N.lang();
    while (temp.firstChild) box.appendChild(temp.firstChild);
    return box;
  }
  function skeleton(text) {
    var d = document.createElement('div');
    d.className = 'empty';
    d.textContent = text || t('common.loading');
    return d;
  }

  /* ───────────────────────── Каркас: статус/поиск/период ───────────────────────── */
  function renderBrand() {
    $('#brand-ver').textContent = conf.version ? 'v' + conf.version : '';
    $('#ping-label').textContent = t('ping.connecting');
  }
  function renderServers() {
    var list = $('#srv-list');
    list.innerHTML = '';
    var items = [];
    if (conf.servers && conf.servers.length) {
      items.push({ name: '_all', display: '🌐 ' + t('srv.allServers'), online: true, all: true, count: conf.servers.length + 1 });
    }
    items = items.concat([{ name: 'local', display: conf.serverName || t('srv.thisServer'), online: true, local: true }]).concat(conf.servers || []);
    items.forEach(function (s) {
      var name = (s.name !== undefined) ? s.name : s;
      var display = (s.display !== undefined) ? s.display : (s.name !== undefined ? s.name : s);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'srv-pill' + (name === activeServer ? ' active' : '');
      var dot = document.createElement('span');
      dot.className = 'dot' + (s.online ? ' dot-online' : ' dot-offline');
      var nm = document.createElement('span'); nm.className = 'srv-name'; nm.textContent = display;
      b.appendChild(dot); b.appendChild(nm);
      var badge = document.createElement('span');
      badge.className = 'srv-badge';
      if (s.all) {
        badge.textContent = String(s.count);
      } else if (s.local) {
        badge.textContent = t('srv.badgeThis');
      } else if (s.online) {
        badge.textContent = s.onlinePlayers != null ? t('srv.badgeOnlCount', s.onlinePlayers) : (s.pingMs > 0 ? t('unit.ms', s.pingMs) : t('srv.badgeOnline'));
        b.title = (s.url || '') + (s.pingMs ? ' · ' + t('srv.pingTitle', s.pingMs) : '');
      } else {
        badge.textContent = t('srv.badgeOffline');
        b.title = (s.url ? s.url + ' — ' : '') + (s.error || t('top.serverUnavail'));
      }
      b.appendChild(badge);
      b.addEventListener('click', function () {
        setActiveServer(name);
        lastView = null;
        renderServers(); startRefresh(); refreshStatus(0); route();
      });
      list.appendChild(b);
    });
    if (!conf.servers || !conf.servers.length) {
      var addHint = document.createElement('button');
      addHint.type = 'button';
      addHint.className = 'srv-pill';
      addHint.style.opacity = '0.78';
      addHint.style.border = '1px dashed var(--line-strong)';
      addHint.innerHTML = '<span style="color:var(--accent-b);font-weight:700">+</span><span class="srv-name">' + esc(t('srv.connectAnother')) + '</span>';
      addHint.addEventListener('click', function () { openLinkModal('add'); });
      list.appendChild(addHint);
    }
  }
  function renderPeriod() {
    var active = currentPeriod();
    var view = parseHash().view;
    var enabled = view === 'overview' || view === 'analytics';
    $$('#period .seg-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.period === active);
      b.setAttribute('aria-pressed', b.dataset.period === active ? 'true' : 'false');
      b.disabled = !enabled;
      b.title = enabled ? '' : t('period.independent');
    });
    paintFreshness();
  }
  function refreshStatus(routeAfter) {
    var requestSeq = ++statusSeq;
    var serverAtStart = activeServer;
    j('/api/online').then(function (d) {
      if (requestSeq !== statusSeq || serverAtStart !== activeServer) return;
      var dot = $('#status-dot'), text = $('#status-text');
      if (!d || d.error || d.__networkError) {
        markDataStale();
        if (dot) { dot.classList.remove('dot-online'); dot.classList.add('dot-offline'); }
        if (text) text.textContent = (d && d.error) ? t('top.unavailErr', d.error) : t('top.serverUnavail');
        if ($('#ping-label')) $('#ping-label').textContent = t('ping.noPanel');
        return;
      }
      var online = (d.online || []).length;
      var tps = d.tps && d.tps[0] != null ? Number(d.tps[0]) : null;
      var up = d.uptimeSeconds ? fmtDur(d.uptimeSeconds) : '—';
      if (text) text.textContent = t('top.statusLine', online, (tps == null ? '—' : tps.toFixed(1)), up);
      if (dot) { dot.classList.remove('dot-online', 'dot-offline'); dot.classList.add('dot-online'); }
      if ($('#ping-label')) $('#ping-label').textContent = activeServer === 'local' ? t('ping.active') : t('ping.bridge', activeServer);
    }, function () {
      if (requestSeq !== statusSeq || serverAtStart !== activeServer) return;
      if ($('#status-dot')) $('#status-dot').classList.add('dot-offline');
      if ($('#ping-label')) $('#ping-label').textContent = t('ping.noConn');
      markDataStale();
    });
  }

  function renderRemoteErrorIfAny(d) {
    if (!d || (!d.error && !d.__networkError)) return false;
    markDataStale();
    var box = $('#view');
    clearCharts();
    lastView = null;
    var errMsg = d.error || t('err.defaultMsg');
    var hintMsg = d.hint || (activeServer !== 'local'
      ? t('err.defaultHintRemote')
      : t('err.defaultHintLocal'));
    box.innerHTML = '';
    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.maxWidth = '640px';
    panel.style.margin = '24px auto';
    panel.innerHTML =
      '<div class="view-title" style="font-size:18px;margin-bottom:6px">' + esc(t('err.noConnServer', activeServer)) + '</div>' +
      '<div class="view-sub" style="margin-bottom:14px">' + esc(t('err.noConnSub')) + '</div>' +
      '<div class="link-alert err" style="margin-bottom:14px">' +
      '  <div class="link-alert-title">' + esc(errMsg) + '</div>' +
      '  <div>' + esc(hintMsg) + '</div>' +
      '</div>' +
      '<div class="link-actions" style="justify-content:flex-start">' +
      '  <button type="button" class="btn-primary" id="err-open-link">' + esc(t('err.configureLink')) + '</button>' +
      (activeServer !== 'local' ? '  <button type="button" class="btn-secondary" id="err-back-local">' + esc(t('err.backToLocal')) + '</button>' : '') +
      '  <button type="button" class="btn-secondary" id="err-retry">' + esc(t('err.retry')) + '</button>' +
      '</div>';
    box.appendChild(panel);
    if ($('#err-open-link')) $('#err-open-link').addEventListener('click', function () { openLinkModal('list'); });
    if ($('#err-back-local')) $('#err-back-local').addEventListener('click', function () {
      setActiveServer('local');
      renderServers(); startRefresh(); refreshStatus(0); route();
    });
    if ($('#err-retry')) $('#err-retry').addEventListener('click', function () { refreshStatus(0); route(); });
    return true;
  }
  function showPeriodError(selector, data) {
    var el = $(selector);
    if (!el) return;
    el.textContent = (data && data.error) ||
      (!data || data.__networkError || data.__httpError ? t('err.defaultMsg') : t('period.customUnsupported'));
    el.hidden = false;
    el.classList.add('link-alert', 'err');
  }
  function isValidPeriodResponse(data) {
    if (!data || data.error || data.__networkError || data.__httpError || !data.current || typeof data.current !== 'object') return false;
    var series = ['seconds', 'sessions', 'players', 'avgSession', 'kills', 'deaths', 'kd', 'daysList'];
    if (!Array.isArray(data.labels) || !data.labels.length) return false;
    for (var i = 0; i < series.length; i++) {
      if (!Array.isArray(data[series[i]]) || data[series[i]].length !== data.labels.length) return false;
    }
    var totals = ['seconds', 'players', 'sessions', 'newPlayers'];
    for (var j = 0; j < totals.length; j++) {
      if (data.current[totals[j]] == null || !isFinite(Number(data.current[totals[j]]))) return false;
    }
    return true;
  }
  function clearPeriodError(selector) {
    var el = $(selector);
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
    el.classList.remove('link-alert', 'err');
  }
  function clearChart(id) {
    if (charts[id]) { try { charts[id].destroy(); } catch (e) { } delete charts[id]; }
    delete pendingCharts[id];
    var cv = $('#' + id);
    if (cv && cv.getContext) { try { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); } catch (e) { } }
  }

  /* ───────────────────────── Мастер связывания панелей ───────────────────────── */
  function openLinkModal(initialTab, prefill) {
    openModal(t('lk.modalTitle'), function (body, hide) {
      body.innerHTML = '<div class="empty">' + esc(t('lk.loading')) + '</div>';

      function loadAndRender(activeTab, customPrefill) {
        j('/api/link/info').then(function (info) {
          if (!info || info.error) {
            body.innerHTML = '<div class="link-alert err"><div class="link-alert-title">' + esc(t('lk.accessErr')) + '</div>' +
              '<div>' + esc((info && info.error) || t('lk.loadFailed')) + '</div></div>';
            return;
          }
          conf.servers = info.servers || [];
          renderServers();
          drawModalContent(info, activeTab || 'add', customPrefill || null);
        });
      }

      function drawModalContent(info, tab, pf) {
        var servers = info.servers || [];
        body.innerHTML =
          '<div class="link-tabs">' +
          '  <button type="button" class="link-tab' + (tab === 'add' ? ' active' : '') + '" data-ltab="add">' + esc(t('lk.tabAdd')) + '</button>' +
          '  <button type="button" class="link-tab' + (tab === 'this' ? ' active' : '') + '" data-ltab="this">' + esc(t('lk.tabThis')) + '</button>' +
          '  <button type="button" class="link-tab' + (tab === 'list' ? ' active' : '') + '" data-ltab="list">' + esc(t('lk.tabList', servers.length)) + '</button>' +
          '</div>' +
          '<div id="ltab-pane-add" class="link-pane' + (tab === 'add' ? ' active' : '') + '"></div>' +
          '<div id="ltab-pane-this" class="link-pane' + (tab === 'this' ? ' active' : '') + '"></div>' +
          '<div id="ltab-pane-list" class="link-pane' + (tab === 'list' ? ' active' : '') + '"></div>';

        $$('.link-tab', body).forEach(function (b) {
          b.addEventListener('click', function () {
            drawModalContent(info, b.dataset.ltab, null);
          });
        });

        buildAddPane($('#ltab-pane-add', body), info, pf);
        buildThisServerPane($('#ltab-pane-this', body), info);
        buildListPane($('#ltab-pane-list', body), info);
      }

      function buildAddPane(pane, info, pf) {
        pane.innerHTML =
          '<div class="link-step-box">' +
          '  <h4>' + esc(t('lk.howToTitle')) + '</h4>' +
          '  <ol class="link-steps">' +
          '    <li>' + t('lk.howToStep1') + '</li>' +
          '    <li>' + t('lk.howToStep2') + '</li>' +
          '  </ol>' +
          '</div>' +
          '<div class="link-field">' +
          '  <label>' + esc(t('lk.quickCodeLabel')) + '</label>' +
          '  <input type="text" id="lk-code" placeholder="' + esc(t('lk.quickCodePlaceholder')) + '">' +
          '  <div class="link-hint" id="lk-code-hint">' + t('lk.quickCodeHint') + '</div>' +
          '</div>' +
          '<div class="link-grid-2">' +
          '  <div class="link-field">' +
          '    <label>' + esc(t('lk.srvNameLabel')) + '</label>' +
          '    <input type="text" id="lk-name" placeholder="' + esc(t('lk.srvNamePlaceholder')) + '">' +
          '  </div>' +
          '  <div class="link-field">' +
          '    <label>' + esc(t('lk.srvUrlLabel')) + '</label>' +
          '    <input type="text" id="lk-url" placeholder="' + esc(t('lk.srvUrlPlaceholder')) + '">' +
          '  </div>' +
          '</div>' +
          '<div class="link-field">' +
          '  <label>' + t('lk.srvTokenLabel') + '</label>' +
          '  <input type="text" id="lk-token" placeholder="' + esc(t('lk.srvTokenPlaceholder')) + '">' +
          '</div>' +
          '<div id="lk-result"></div>' +
          '<div class="link-actions">' +
          '  <button type="button" class="btn-secondary" id="lk-btn-test">' + esc(t('lk.btnTest')) + '</button>' +
          '  <button type="button" class="btn-primary" id="lk-btn-save">' + esc(t('lk.btnSave')) + '</button>' +
          '</div>';

        var codeInp = $('#lk-code', pane);
        var codeHint = $('#lk-code-hint', pane);
        var nameInp = $('#lk-name', pane);
        var urlInp = $('#lk-url', pane);
        var tokInp = $('#lk-token', pane);
        var resBox = $('#lk-result', pane);
        var testBtn = $('#lk-btn-test', pane);
        var saveBtn = $('#lk-btn-save', pane);

        if (pf) {
          if (pf.name) nameInp.value = pf.name;
          if (pf.url) urlInp.value = pf.url;
          if (pf.token) tokInp.value = pf.token;
        }

        codeInp.addEventListener('input', function () {
          var parsed = decodeLinkCodeClient(codeInp.value);
          if (parsed) {
            if (parsed.name) nameInp.value = parsed.name;
            if (parsed.url) urlInp.value = parsed.url;
            if (parsed.token) tokInp.value = parsed.token;
            codeHint.style.color = 'var(--green)';
            codeHint.textContent = t('lk.quickCodeOk', parsed.name || 'server');
          } else if (codeInp.value.trim()) {
            codeHint.style.color = 'var(--amber)';
            codeHint.textContent = t('lk.quickCodeWarn');
          } else {
            codeHint.style.color = '';
            codeHint.innerHTML = t('lk.quickCodeHint');
          }
        });

        function collectPayload(force) {
          return {
            code: codeInp.value.trim(),
            name: nameInp.value.trim(),
            url: urlInp.value.trim(),
            token: tokInp.value.trim(),
            force: !!force
          };
        }

        function renderProbeFeedback(r, isSaved) {
          resBox.innerHTML = '';
          if (!r) return;
          if (r.name && !nameInp.value.trim()) nameInp.value = r.name;
          if (r.normalizedUrl && !urlInp.value.trim()) urlInp.value = r.normalizedUrl;

          var alert = document.createElement('div');
          alert.className = 'link-alert ' + (r.ok ? 'ok' : 'err');
          var title = document.createElement('div');
          title.className = 'link-alert-title';
          if (r.ok && isSaved) {
            title.textContent = t('lk.savedOk', r.name || nameInp.value);
          } else if (r.ok) {
            title.textContent = t('lk.connOk', r.pingMs || 0);
          } else {
            title.textContent = '✕ ' + (r.error || t('lk.connFail'));
          }
          alert.appendChild(title);

          var details = document.createElement('div');
          if (r.ok) {
            details.textContent = t('lk.detailsAddress', r.normalizedUrl || urlInp.value) +
              (r.remoteServerName ? t('lk.detailsServer', r.remoteServerName) : '') +
              (r.onlinePlayers != null ? t('lk.detailsOnline', r.onlinePlayers) : '');
          } else {
            details.textContent = r.hint || t('lk.defaultFailHint');
          }
          alert.appendChild(details);

          if (r.ok && isSaved) {
            var actRow = document.createElement('div');
            actRow.style.marginTop = '10px';
            actRow.style.display = 'flex';
            actRow.style.gap = '8px';
            var goBtn = document.createElement('button');
            goBtn.type = 'button';
            goBtn.className = 'btn-primary';
            goBtn.textContent = t('lk.goToStats', r.name || nameInp.value);
            goBtn.addEventListener('click', function () {
              var target = r.name || nameInp.value.trim();
              setActiveServer(target);
              lastView = null;
              hide();
              renderServers();
              startRefresh();
              refreshStatus(0);
              route();
            });
            var listBtn = document.createElement('button');
            listBtn.type = 'button';
            listBtn.className = 'btn-secondary';
            listBtn.textContent = t('lk.toServerList', (r.servers && r.servers.length) || conf.servers.length);
            listBtn.addEventListener('click', function () {
              loadAndRender('list');
            });
            actRow.appendChild(goBtn);
            actRow.appendChild(listBtn);
            alert.appendChild(actRow);
          } else if (!r.ok && r.canForceSave) {
            var forceWrap = document.createElement('div');
            forceWrap.style.marginTop = '10px';
            var forceBtn = document.createElement('button');
            forceBtn.type = 'button';
            forceBtn.className = 'btn-secondary';
            forceBtn.textContent = t('lk.forceSaveBtn');
            forceBtn.addEventListener('click', function () { doSave(true); });
            forceWrap.appendChild(forceBtn);
            alert.appendChild(forceWrap);
          }
          resBox.appendChild(alert);
        }

        testBtn.addEventListener('click', function () {
          testBtn.disabled = true;
          resBox.innerHTML = '<div class="faint" style="font-size:12px">' + esc(t('lk.testingConn')) + '</div>';
          postJson('/api/link/test', collectPayload(false)).then(function (r) {
            testBtn.disabled = false;
            renderProbeFeedback(r, false);
          });
        });

        function doSave(force) {
          saveBtn.disabled = true;
          resBox.innerHTML = '<div class="faint" style="font-size:12px">' + esc(t('lk.savingConn')) + '</div>';
          postJson('/api/link/add', collectPayload(force)).then(function (r) {
            saveBtn.disabled = false;
            if (r && r.servers) {
              conf.servers = r.servers;
              renderServers();
              $$('.link-tab', body).forEach(function (tb) {
                if (tb.dataset.ltab === 'list') tb.textContent = t('lk.tabList', r.servers.length);
              });
            }
            renderProbeFeedback(r, !!(r && r.ok));
          });
        }

        saveBtn.addEventListener('click', function () { doSave(false); });
      }

      function buildThisServerPane(pane, info) {
        var browserOrigin = (location.hostname && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
          ? (location.protocol + '//' + location.host)
          : (info.suggestedUrl || ('http://127.0.0.1:' + (info.port || 25624)));

        var hostAlertHtml = '';
        var bh = info.bindHost || info.boundHost || '0.0.0.0';
        if (!info.externalReady) {
          hostAlertHtml =
            '<div class="link-alert warn">' +
            '  <div class="link-alert-title">' + esc(t('lk.extClosedTitle', bh)) + '</div>' +
            '  <div>' + esc(t('lk.extClosedDesc')) + '</div>' +
            '  <div style="margin-top:8px"><button type="button" class="btn-primary" id="lk-enable-ext">' + esc(t('lk.enableExtBtn')) + '</button></div>' +
            '</div>';
        } else {
          hostAlertHtml =
            '<div class="link-alert ok">' +
            '  <div class="link-alert-title">' + esc(t('lk.extReadyTitle', info.port)) + '</div>' +
            '  <div>' + t('lk.extReadyDesc', esc(bh)) + '</div>' +
            '</div>';
        }

        pane.innerHTML =
          hostAlertHtml +
          '<div class="link-grid-2">' +
          '  <div class="link-field">' +
          '    <label>' + esc(t('lk.thisNameLabel')) + '</label>' +
          '    <input type="text" id="this-name" value="' + esc(info.serverName || 'main') + '">' +
          '  </div>' +
          '  <div class="link-field">' +
          '    <label>' + esc(t('lk.thisUrlLabel')) + '</label>' +
          '    <input type="text" id="this-url" value="' + esc(browserOrigin) + '">' +
          '    <div class="link-hint">' + t('lk.thisUrlHint', esc(info.port)) + '</div>' +
          '  </div>' +
          '</div>' +
          '<div class="link-field">' +
          '  <label>' + esc(t('lk.step1CodeLabel')) + '</label>' +
          '  <div class="link-code-box">' +
          '    <code id="this-code-val"></code>' +
          '    <button type="button" class="btn-primary" id="this-copy-code">' + esc(t('lk.copyCodeBtn')) + '</button>' +
          '  </div>' +
          '</div>' +
          '<div class="link-field">' +
          '  <label>' + esc(t('lk.step2CmdLabel')) + '</label>' +
          '  <div class="link-code-box">' +
          '    <code id="this-cmd-val"></code>' +
          '    <button type="button" class="btn-secondary" id="this-copy-cmd">' + esc(t('lk.copyCmdBtn')) + '</button>' +
          '  </div>' +
          '</div>' +
          '<div class="link-field" style="margin-top:6px;padding-top:10px;border-top:1px solid var(--line)">' +
          '  <label>' + t('lk.secretTokLabel') + '</label>' +
          '  <div class="link-code-box">' +
          '    <code id="this-token-val">' + esc(info.linkToken || '') + '</code>' +
          '    <button type="button" class="btn-secondary" id="this-copy-tok">' + esc(t('lk.copyBtn')) + '</button>' +
          '    <button type="button" class="btn-danger" id="this-regen-tok" title="' + esc(t('lk.regenTokTitle')) + '">' + esc(t('lk.regenTokBtn')) + '</button>' +
          '  </div>' +
          '</div>';

        var nmInp = $('#this-name', pane);
        var urlInp = $('#this-url', pane);
        var codeEl = $('#this-code-val', pane);
        var cmdEl = $('#this-cmd-val', pane);

        function refreshGeneratedCode() {
          var code = encodeLinkCodeClient(nmInp.value.trim() || 'server', urlInp.value.trim(), info.linkToken || '');
          codeEl.textContent = code;
          cmdEl.textContent = '/pulse link add ' + code;
        }
        refreshGeneratedCode();
        nmInp.addEventListener('input', refreshGeneratedCode);
        urlInp.addEventListener('input', refreshGeneratedCode);

        $('#this-copy-code', pane).addEventListener('click', function () {
          copyText(codeEl.textContent, $('#this-copy-code', pane));
        });
        $('#this-copy-cmd', pane).addEventListener('click', function () {
          copyText(cmdEl.textContent, $('#this-copy-cmd', pane));
        });
        $('#this-copy-tok', pane).addEventListener('click', function () {
          copyText(info.linkToken || '', $('#this-copy-tok', pane));
        });

        var extBtn = $('#lk-enable-ext', pane);
        if (extBtn) {
          extBtn.addEventListener('click', function () {
            extBtn.disabled = true;
            extBtn.textContent = t('lk.restartingExt');
            postJson('/api/link/enable-remote', {}).then(function () {
              setTimeout(function () { loadAndRender('this'); }, 500);
            });
          });
        }

        $('#this-regen-tok', pane).addEventListener('click', function () {
          var btn = $('#this-regen-tok', pane);
          btn.disabled = true;
          postJson('/api/link/regenerate-token', {}).then(function (r) {
            btn.disabled = false;
            if (r && r.linkToken) {
              info.linkToken = r.linkToken;
              $('#this-token-val', pane).textContent = r.linkToken;
              refreshGeneratedCode();
            }
          });
        });
      }

      function buildListPane(pane, info) {
        var list = info.servers || [];
        if (!list.length) {
          pane.innerHTML =
            '<div class="empty" style="padding:28px 12px">' +
            '  <div style="margin-bottom:10px">' + esc(t('lk.emptyList')) + '</div>' +
            '  <button type="button" class="btn-primary" id="lst-go-add">' + esc(t('lk.addFirstBtn')) + '</button>' +
            '</div>';
          $('#lst-go-add', pane).addEventListener('click', function () {
            drawModalContent(info, 'add', null);
          });
          return;
        }

        var wrap = document.createElement('div');
        wrap.className = 'link-srv-list';

        list.forEach(function (s) {
          var card = document.createElement('div');
          card.className = 'link-srv-card';

          var dot = document.createElement('span');
          dot.className = 'dot ' + (s.online ? 'dot-online' : 'dot-offline');
          card.appendChild(dot);

          var main = document.createElement('div');
          main.className = 'link-srv-main';
          var nm = document.createElement('div');
          nm.className = 'link-srv-name';
          nm.textContent = s.name + (s.remoteServerName && s.remoteServerName !== s.name ? ' (' + s.remoteServerName + ')' : '');
          var url = document.createElement('div');
          url.className = 'link-srv-url';
          url.textContent = (s.url || '') + (s.hasToken ? t('lk.tokenConfigured') : t('lk.noToken'));
          var meta = document.createElement('div');
          meta.className = 'link-srv-meta ' + (s.online ? 'ok' : 'err');
          if (s.online) {
            meta.textContent = t('lk.onlineMeta', s.pingMs || 0) + (s.onlinePlayers != null ? t('lk.onlinePlayersMeta', s.onlinePlayers) : '');
          } else {
            meta.textContent = '✕ ' + (s.error || t('lk.unavail')) + (s.hint ? ' — ' + s.hint : '');
          }
          main.appendChild(nm);
          main.appendChild(url);
          main.appendChild(meta);
          card.appendChild(main);

          var acts = document.createElement('div');
          acts.className = 'link-actions';
          acts.style.marginTop = '0';

          var openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'btn-primary';
          openBtn.style.padding = '6px 10px';
          openBtn.textContent = t('lk.openBtn');
          openBtn.addEventListener('click', function () {
            setActiveServer(s.name);
            lastView = null;
            hide();
            renderServers();
            startRefresh();
            refreshStatus(0);
            route();
          });

          var testBtn = document.createElement('button');
          testBtn.type = 'button';
          testBtn.className = 'btn-secondary';
          testBtn.style.padding = '6px 10px';
          testBtn.textContent = t('lk.checkBtn');
          testBtn.addEventListener('click', function () {
            testBtn.disabled = true;
            meta.className = 'link-srv-meta';
            meta.textContent = t('lk.checkingShort');
            postJson('/api/link/test', { name: s.name }).then(function (r) {
              testBtn.disabled = false;
              if (!r) return;
              dot.className = 'dot ' + (r.ok ? 'dot-online' : 'dot-offline');
              meta.className = 'link-srv-meta ' + (r.ok ? 'ok' : 'err');
              if (r.ok) {
                meta.textContent = t('lk.onlineMeta', r.pingMs || 0) + (r.onlinePlayers != null ? t('lk.onlinePlayersMeta', r.onlinePlayers) : '');
              } else {
                meta.textContent = '✕ ' + (r.error || t('lk.unavail')) + (r.hint ? ' — ' + r.hint : '');
              }
            });
          });

          var editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'btn-secondary';
          editBtn.style.padding = '6px 10px';
          editBtn.textContent = t('lk.editBtn');
          editBtn.addEventListener('click', function () {
            drawModalContent(info, 'add', { name: s.name, url: s.url, token: '' });
          });

          var delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn-danger';
          delBtn.textContent = t('lk.deleteBtn');
          delBtn.addEventListener('click', function () {
            delBtn.disabled = true;
            postJson('/api/link/remove', { name: s.name }).then(function (r) {
              if (r && r.servers) {
                conf.servers = r.servers;
                if (activeServer === s.name) {
                  setActiveServer('local');
                  startRefresh();
                  refreshStatus(0);
                  route();
                }
                renderServers();
              }
              loadAndRender('list');
            });
          });

          acts.appendChild(openBtn);
          acts.appendChild(testBtn);
          acts.appendChild(editBtn);
          acts.appendChild(delBtn);
          card.appendChild(acts);
          wrap.appendChild(card);
        });

        pane.innerHTML = '';
        pane.appendChild(wrap);
      }

      loadAndRender(initialTab || 'add', prefill || null);
    }, 'link-modal-card');
  }

  /* Глобальный поиск (Ctrl+K / "/") */
  var searchItems = [];
  var searchIdx = 0;
  function openSearch() {
    var inp = $('#gsearch-input');
    inp.focus(); inp.select(); showSearch();
  }
  function showSearch() {
    var res = $('#gsearch-res');
    var q = $('#gsearch-input').value.trim();
    if (q.length < 1) { res.innerHTML = ''; searchItems = []; return; }
    j('/api/players?q=' + encodeURIComponent(q) + '&limit=10').then(function (d) {
      var rows = d && d.rows ? d.rows : [];
      searchItems = rows; searchIdx = 0;
      res.innerHTML = '';
      var box = document.createElement('div');
      res.appendChild(box);
      if (!rows.length) {
        var e = document.createElement('div'); e.className = 'sr-empty'; e.textContent = t('common.nothingFound');
        res.appendChild(e); return;
      }
      rows.forEach(function (r, i) {
        var b = document.createElement('button'); b.className = 'sr-item'; b.type = 'button';
        var img = avatarHtml(r.uuid, 26);
        var nm = document.createElement('span'); nm.textContent = r.name;
        var meta = document.createElement('span'); meta.className = 'sr-meta';
        meta.textContent = r.sessions ? t('common.sessionsShort', fmt(r.sessions)) : (r.seconds ? fmtDurShort(r.seconds) : '');
        b.appendChild(img); b.appendChild(nm); b.appendChild(meta);
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () { hideSearch(); navigate('/player/' + encodeURIComponent(r.name)); });
        res.appendChild(b);
      });
      paintSearchFocus();
    });
  }
  function paintSearchFocus() {
    $$('#gsearch-res .sr-item').forEach(function (b, i) { b.classList.toggle('focus', i === searchIdx); });
  }
  function hideSearch() {
    $('#gsearch-res').innerHTML = '';
    searchItems = [];
  }

  /* ───────────────────────── Вид: Обзор ───────────────────────── */
  function runOverview(seq) {
    var html =
      '<div class="view-title">' + esc(t('ov.title')) + '</div>' +
      '<div class="view-sub" id="ov-sub">' + esc(t('ov.sub')) + '</div>' +
      '<div class="period-caption" id="ov-period-caption"></div>' +
      '<div class="period-error" id="ov-period-error" hidden></div>' +
      '<div class="kpi-row">' +
      '  <div class="kpi"><span class="kpi-label">' + esc(t('ov.kpiOnline')) + '</span><span class="kpi-value" id="k1-v">—</span><div class="kpi-foot"><canvas id="k1-s" class="kpi-spark"></canvas></div></div>' +
      '  <div class="kpi"><span class="kpi-label" id="k2-label">' + esc(t('period.players')) + '</span>' + periodHelpButton('ov.tipPlayers') + '<span class="kpi-value" id="k2-v">—</span><div class="kpi-foot" id="k2-f"></div></div>' +
      '  <div class="kpi"><span class="kpi-label" id="k3-label">' + esc(t('period.playtime')) + '</span>' + periodHelpButton('ov.tipPlaytime') + '<span class="kpi-value" id="k3-v">—</span><div class="kpi-foot" id="k3-f"></div><div class="kpi-foot"><canvas id="k3-s" class="kpi-spark"></canvas></div></div>' +
      '  <div class="kpi"><span class="kpi-label">' + esc(t('ov.kpiHealth')) + '</span><span class="kpi-value" id="k4-v">—</span><div class="kpi-foot" id="k4-f"></div></div>' +
      '</div>' +
      '<div class="comparison-strip" id="period-comparison"></div>' +
      '<div class="grid">' +
      '  <div class="col-8 panel"><h3 class="panel-title">' + esc(t('ov.actTitle')) + ' <span class="seg" id="ov-act-seg" style="margin-left:auto">' +
      '    <button class="seg-btn active" data-act="seconds">' + esc(t('ov.segTime')) + '</button>' +
      '    <button class="seg-btn" data-act="sessions">' + esc(t('ov.segSessions')) + '</button>' +
      '    <button class="seg-btn" data-act="players">' + esc(t('ov.segPlayers')) + '</button>' +
      '    <button class="seg-btn" data-act="avgSession">' + esc(t('ov.segAvgSession')) + '</button></span></h3>' +
      '    <div class="chart-sm"><canvas id="ov-act"></canvas></div>' +
      '  </div>' +
      '  <div class="col-4 panel"><h3 class="panel-title">' + esc(t('ov.onlineTitle')) + ' <span class="panel-title-link">' + esc(t('ov.onlineLive')) + '</span></h3><div id="ov-online" class="pchips"></div></div>' +
      '</div>' +
      '<div class="grid">' +
      '  <div class="col-6 panel"><h3 class="panel-title">' + esc(t('ov.heatTitle')) + periodHelpButton('help.heatmap') + '</h3><div class="period-caption">' + esc(t('period.allHistory')) + '</div><div class="heat-wrap" id="ov-heat"></div></div>' +
      '  <div class="col-6 panel"><h3 class="panel-title">' + esc(t('ov.recTitle')) + '</h3><div class="period-caption">' + esc(t('period.allHistory')) + '</div><div class="rec-grid" id="ov-rec"></div></div>' +
      '</div>';
    staticShell(html);
    bindMetricHelp($('#view'));

    var accA = chroma('--accent-a') || '#7c5cff';
    var accB = chroma('--accent-b') || '#4aa8ff';
    var green = chroma('--green') || '#2fd58f';
    var amber = chroma('--amber') || '#ffd75e';
    var red = chroma('--red') || '#ff5d6c';
    var grad = gradStops(accA, accB, 7);
    var periodPromise = fetchPeriod();

    $$('#ov-act-seg .seg-btn').forEach(function (b) {
      on(b, 'click', function () {
        $$('#ov-act-seg .seg-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        drawAct();
      });
    });

    function drawAct() {
      periodPromise.then(function (d) {
        if (seq !== viewSeq) return;
        if (!isValidPeriodResponse(d)) {
          showPeriodError('#ov-period-error', d);
          clearChart('ov-act');
          return;
        }
        var type = $('#ov-act-seg .seg-btn.active') ? $('#ov-act-seg .seg-btn.active').dataset.act : 'seconds';
        var seconds = Array.isArray(d.seconds) ? d.seconds : [];
        var sessions = Array.isArray(d.sessions) ? d.sessions : [];
        var players = Array.isArray(d.players) ? d.players : [];
        var averages = Array.isArray(d.avgSession) ? d.avgSession : [];
        var series = {
          seconds: { label: t('ov.chartPlaytimeH'), data: seconds.map(function (v) { return +(v / 3600).toFixed(1); }) },
          sessions: { label: t('ov.chartSessions'), data: sessions },
          players: { label: t('ov.chartUniquePlayers'), data: players },
          avgSession: { label: t('ov.chartAvgSessionM'), data: averages.map(function (v) { return +(v / 60).toFixed(1); }) }
        }[type] || {};
        chart('ov-act', lineCfg(d.labels, [{
          label: series.label, data: series.data, borderColor: grad[grad.length - 1],
          backgroundColor: rgba(accA, .25), fill: true, tension: .3, pointRadius: 0, borderWidth: 2
        }]));
      });
    }

    var pending = null;
    Promise.all([
      j('/api/summary'), j('/api/online'), periodPromise, j('/api/server-stats?range=6h'),
      j('/api/heatmap'), j('/api/recommend')
    ]).then(function (res) {
      var s = res[0], onl = res[1], act = res[2], st6 = res[3], hm = res[4], rc = res[5];
      if (seq !== viewSeq) return;
      if (s === null) return;
      var onlineError = !onl || onl.error || onl.__networkError || onl.__httpError || !Array.isArray(onl.online);
      if (onlineError) markDataStale();
      var periodUnavailable = !isValidPeriodResponse(act);
      if (periodUnavailable) {
        showPeriodError('#ov-period-error', act);
        $('#ov-period-caption').textContent = '';
        clearChart('ov-act');
      } else {
        clearPeriodError('#ov-period-error');
        $('#ov-period-caption').innerHTML = esc(periodCaption(act)) + ' ' + periodHelpButton('ov.tipSessionAccounting');
        bindMetricHelp($('#ov-period-caption'));
      }

      /* KPI 1: Онлайн + spark (за последние 6h) */
      var onlineCount = onlineError ? 0 : onl.online.length;
      var totalAcc = (s && !s.error && s.totalAccounts) || 0;
      $('#k1-v').innerHTML = onlineError ? '—' : fmt(onlineCount) + (totalAcc > 0 ? ' <small>' + esc(t('common.of', fmt(totalAcc))) + '</small>' : '');

      var spark1 = (st6 && st6.online) ? st6.online.slice(-60) : [];
      drawSpark($('#k1-s'), spark1, green);

      /* KPI 2/3: unique players and playtime for the selected period */
      var current = periodUnavailable ? {} : act.current;
      var previous = periodUnavailable ? null : act.previous;
      var playersInRange = Number(current.players) || 0;
      var secondsInRange = Number(current.seconds) || 0;
      $('#k2-v').textContent = periodUnavailable ? '—' : fmt(playersInRange);
      $('#k3-v').textContent = periodUnavailable ? '—' : fmtDurShort(secondsInRange);
      var foot2 = $('#k2-f');
      var playersDelta = periodDelta(playersInRange, previous && previous.players);
      foot2.innerHTML = periodUnavailable ? '' : '<span class="period-delta badge ' + playersDelta.cls + '">' + esc(playersDelta.text) + '</span>';
      var playtimeDelta = periodDelta(secondsInRange, previous && previous.seconds);
      $('#k3-f').innerHTML = periodUnavailable ? '' : '<span class="period-delta badge ' + playtimeDelta.cls + '">' + esc(playtimeDelta.text) + '</span>';

      var comparison = $('#period-comparison');
      var sessionDelta = periodDelta(current.sessions, previous && previous.sessions);
      var newPlayerDelta = periodDelta(current.newPlayers, previous && previous.newPlayers);
      comparison.innerHTML = periodUnavailable ? '' :
        '<div>' + periodHelpButton('ov.tipSessions') + '<span>' + esc(t('period.sessions')) + ': ' + fmt(current.sessions || 0) + '</span> <span class="period-delta badge ' + sessionDelta.cls + '">' + esc(sessionDelta.text) + '</span></div>' +
        '<div>' + periodHelpButton('ov.tipNewPlayers') + '<span>' + esc(t('period.newPlayers')) + ': ' + fmt(current.newPlayers || 0) + '</span> <span class="period-delta badge ' + newPlayerDelta.cls + '">' + esc(newPlayerDelta.text) + '</span></div>';
      bindMetricHelp(comparison);
      $('#k2-v').title = t('period.sessionStart');

      var sp3 = periodUnavailable ? [] : act.seconds;
      drawSpark($('#k3-s'), sp3.map(function (v) { return +(v / 3600).toFixed(1); }), accA);

      /* KPI 4: TPS / Здоровье */
      var tps = onl && onl.tps && onl.tps[0] != null && isFinite(Number(onl.tps[0])) ? Number(onl.tps[0]) : null;
      var mspt = onl && onl.mspt != null && isFinite(Number(onl.mspt)) ? Number(onl.mspt) : null;
      var k4v = $('#k4-v');
      k4v.innerHTML = 'TPS ' + (tps == null ? '—' : tps.toFixed(1)) + ' <small>MSPT ' + (mspt == null ? '—' : Math.round(mspt) + ' ms') + '</small>';
      var k4f = $('#k4-f'); k4f.innerHTML = '';
      k4v.classList.toggle('kpi-health', tps != null && tps >= 19);
      k4v.classList.toggle('warn', tps != null && tps < 19 && tps >= 16);
      k4v.classList.toggle('bad', tps != null && tps < 16);

      drawAct();

      /* Онлайн-игроки */
      var onlineBox = $('#ov-online');
      onlineBox.innerHTML = '';
      var players = onlineError ? [] : onl.online;
      if (onlineError) {
        var onlineErr = document.createElement('div'); onlineErr.className = 'link-alert err'; onlineErr.textContent = (onl && onl.error) || t('err.defaultMsg');
        onlineBox.appendChild(onlineErr);
      } else if (!players.length) {
        var e = document.createElement('div'); e.className = 'empty'; e.textContent = t('ov.nobodyOnline');
        onlineBox.appendChild(e);
      }
      players.forEach(function (p) {
        var d = document.createElement('button'); d.className = 'pchip'; d.type = 'button';
        d.appendChild(avatarHtml(p.uuid, 30));
        var main = document.createElement('div'); main.className = 'pc-main';
        var nm = document.createElement('div'); nm.className = 'pc-name'; nm.textContent = p.name || '?';
        if (p.afk) { var afk = document.createElement('span'); afk.className = 'badge badge-afk'; afk.textContent = 'AFK'; nm.appendChild(afk); }
        var meta = document.createElement('div'); meta.className = 'pc-meta';
        meta.textContent = [p.world, p.onlineSeconds != null ? fmtDurShort(p.onlineSeconds) : null].filter(Boolean).join(' · ');
        main.appendChild(nm); main.appendChild(meta);
        var ping = document.createElement('div');
        ping.className = 'pc-ping ping-' + (p.ping <= 80 ? 'good' : p.ping <= 180 ? 'ok' : 'bad');
        ping.textContent = p.ping != null ? t('unit.ms', p.ping) : '—';
        d.appendChild(main); d.appendChild(ping);
        d.addEventListener('click', function () { navigate('/player/' + encodeURIComponent(p.name)); });
        onlineBox.appendChild(d);
      });

      /* Тепловая карта */
      var dayLabels = I18N.daysShort();
      if (hm && !hm.error) renderHeat($('#ov-heat'), hm.grid || [], hm.max || 0, dayLabels, function (day, hour, v) {
        if (v <= 0) return;
        j('/api/heatmap/cell?day=' + day + '&hour=' + hour).then(function (d) {
          if (!d || seq !== viewSeq) return;
          openModal(dayLabels[day] + ', ' + hour + ':00', function (body, hide) {
            var list = d.players || [];
            if (!list.length) { body.appendChild(skeleton(t('ov.heatEmptySlot'))); return; }
            list.forEach(function (r) {
              var row = document.createElement('div');
              row.className = 'pchip'; row.style.cursor = 'pointer';
              row.appendChild(avatarHtml(r.uuid, 26));
              var box = document.createElement('div'); box.className = 'pc-main';
              var nm = document.createElement('div'); nm.textContent = r.name; nm.className = 'pc-name';
              var meta = document.createElement('div'); meta.className = 'pc-meta'; meta.textContent = fmtDurShort(r.seconds);
              box.appendChild(nm); box.appendChild(meta);
              row.appendChild(box);
              row.addEventListener('click', function () { hide(); navigate('/player/' + encodeURIComponent(r.name)); });
              body.appendChild(row);
            });
          });
        });
      });

      /* Рекомендации */
      if (rc && !rc.error) renderRecs($('#ov-rec'), rc);

      pending = null;
    });
  }

  function renderHeat(el, grid, max, dayNames, onClick) {
    el.innerHTML = '';
    var heat = document.createElement('div');
    heat.className = 'heat';
    var accA = chroma('--accent-a') || '#7c5cff';
    var names = I18N.daysShort();
    /* header row of hours */
    heat.appendChild(elLabel('', '', 'day-label'));
    for (var h = 0; h < 24; h++) heat.appendChild(elLabel(h, 'hour-label', 'hour-label'));
    (grid || []).forEach(function (row, w) {
      var dName = names[w % names.length] || (dayNames && dayNames[w % dayNames.length]) || '';
      heat.appendChild(elLabel(dName, 'day-label', 'day-label'));
      for (var h2 = 0; h2 < 24; h2++) {
        var v = +row[h2] || 0;
        var cell = document.createElement('div');
        cell.className = 'cell' + (v <= 0 ? ' zero' : '');
        if (max > 0 && v > 0) cell.style.background = rgba(accA, .12 + .72 * (v / max));
        cell.title = dName + ' ' + h2 + ':00 · ' + (v <= 0 ? t('common.none') : fmtDurShort(v));
        (function (wd, hh, vv) {
          cell.addEventListener('click', function () { onClick(wd, hh, vv); });
        })(w, h2, v);
        heat.appendChild(cell);
      }
    });
    el.appendChild(heat);
    var legend = document.createElement('div');
    legend.className = 'heat-legend';
    legend.appendChild(elLabel(t('common.less'), 'faint', ''));
    for (var i = 1; i <= 5; i++) {
      var lg = document.createElement('span'); lg.className = 'lg';
      lg.style.background = rgba(accA, i / 5); legend.appendChild(lg);
    }
    var more = document.createElement('span'); more.className = 'faint'; more.textContent = t('common.more');
    legend.appendChild(more);
    el.appendChild(legend);
    function elLabel(txt, cls, labelCls) {
      var d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = txt;
      return d;
    }
  }

  function renderRecs(el, rc) {
    el.innerHTML = '';
    function windowCard(title, color, win) {
      var card = document.createElement('div');
      card.className = 'rec-card' + (color === 'maint' ? ' maint' : '');
      var tEl = document.createElement('div'); tEl.className = 'rec-title'; tEl.textContent = title;
      card.appendChild(tEl);
      var arr = [].concat(win || []);
      if (!arr.length) {
        var e = document.createElement('div'); e.className = 'faint'; e.style.fontSize = '12px'; e.textContent = t('ov.recInsufficient');
        card.appendChild(e); return card;
      }
      arr.slice(0, 3).forEach(function (w) {
        var row = document.createElement('div'); row.className = 'rec-day';
        var dn = document.createElement('span'); dn.className = 'rec-day-name';
        dn.textContent = w.weekday != null ? I18N.translateWeekday(w.weekday, false) : I18N.translateWeekday(w.weekdayName, false);
        var tm = document.createElement('span'); tm.className = 'rec-day-time';
        tm.textContent = w.startHour + ':00' + (w.hours > 1 ? '–' + (w.startHour + w.hours) + ':00' : '');
        var sec = document.createElement('span'); sec.className = 'rec-day-sec'; sec.textContent = fmtDurShort(w.seconds);
        row.appendChild(dn); row.appendChild(tm); row.appendChild(sec);
        card.appendChild(row);
      });
      return card;
    }
    el.appendChild(windowCard(t('ov.recBestEvents'), 'green', rc.bestWindows || []));
    el.appendChild(windowCard(t('ov.recMaint'), 'maint', rc.maintenanceWindow || rc.maintenanceWindowsPerDay || []));
  }

  /* ───────────────────────── Вид: Игроки ───────────────────────── */
  function runPlayers(seq) {
    var html =
      '<div class="view-title">' + esc(t('pl.title')) + '</div>' +
      '<div class="view-sub">' + esc(t('pl.sub')) + '</div>' +
      '<div class="toolbar">' +
      '  <input type="text" id="pl-q" placeholder="' + esc(t('pl.searchPlaceholder')) + '">' +
      '  <div class="chips" id="pl-chips">' +
      '    <button class="chip active" data-filter="all">' + esc(t('pl.filterAll')) + '</button>' +
      '    <button class="chip" data-filter="online">' + esc(t('pl.filterOnline')) + '</button>' +
      '    <button class="chip" data-filter="new">' + esc(t('pl.filterNew')) + '</button>' +
      '    <button class="chip" data-filter="kd">' + esc(t('pl.filterKd')) + '</button>' +
      '  </div>' +
      '  <span class="seg" style="margin-left:auto">' +
      '    <button class="seg-btn" id="pl-csv">CSV</button>' +
      '    <button class="seg-btn" id="pl-json">JSON</button>' +
      '  </span>' +
      '</div>' +
      '<div class="panel"><div class="tbl-wrap"><table class="tbl pl-tbl"><thead><tr>' +
      '<th>#</th><th>' + esc(t('pl.colPlayer')) + '</th><th>' + esc(t('pl.colTime')) + '</th><th>' + esc(t('pl.colSessions')) + '</th><th>K/D</th><th>' + esc(t('pl.colFirstJoin')) + '</th><th>' + esc(t('pl.colLastSeen')) + '</th>' +
      '</tr></thead><tbody id="pl-body"></tbody></table></div>' +
      '<div class="pager"><span id="pl-info"></span><button id="pl-prev">' + esc(t('pl.prev')) + '</button><button id="pl-next">' + esc(t('pl.next')) + '</button></div></div>';
    staticShell(html);
    var accA = chroma('--accent-a') || '#7c5cff';

    on($('#pl-q'), 'input', debounce(function () { playerState.q = $('#pl-q').value.trim(); playerState.page = 0; load(); }, 250));
    $$('#pl-chips .chip').forEach(function (c) {
      on(c, 'click', function () {
        playerState.filter = c.dataset.filter;
        playerState.page = 0;
        $$('#pl-chips .chip').forEach(function (x) { x.classList.toggle('active', x === c); });
        load();
      });
    });
    on($('#pl-prev'), 'click', function () { if (playerState.page > 0) { playerState.page--; load(); } });
    on($('#pl-next'), 'click', function () { playerState.page++; load(); });
    on($('#pl-csv'), 'click', function () { exportAll('csv'); });
    on($('#pl-json'), 'click', function () { exportAll('json'); });

    function query(extra) {
      var p = [];
      p.push('limit=' + playerState.limit);
      p.push('offset=' + (playerState.page * playerState.limit));
      var sortParam = playerState.filter === 'kd' ? 'kd' : (playerState.filter === 'new' ? 'firstJoin' : 'playtime');
      p.push('sort=' + sortParam);
      if (playerState.filter === 'online') p.push('online=1');
      if (playerState.filter === 'new') p.push('new=1');
      if (playerState.q) p.push('q=' + encodeURIComponent(playerState.q));
      return '/api/players?' + p.join('&') + (extra ? extra : '');
    }
    function load() {
      j(query()).then(function (d) {
        if (!d || seq !== viewSeq) return;
        if (renderRemoteErrorIfAny(d)) return;
        var body = $('#pl-body');
        body.innerHTML = '';
        var rows = d.rows || [];
        if (!rows.length) {
          var tr = document.createElement('tr');
          var td = document.createElement('td'); td.colSpan = 7;
          td.appendChild(skeleton(t('common.nothingFound')));
          tr.appendChild(td); body.appendChild(tr);
        }
        var maxSec = Math.max.apply(null, rows.map(function (r) { return r.seconds || 0; }).concat([1]));
        rows.forEach(function (r) {
          var tr = document.createElement('tr');
          tr.className = 'row-clk';
          var td = document.createElement('td');
          var rank = document.createElement('span');
          rank.className = 'rank-medal rank-' + (r.rank <= 3 ? r.rank : 'x');
          rank.textContent = '#' + r.rank;
          td.appendChild(rank);
          var td2 = document.createElement('td');
          var cell = document.createElement('div'); cell.className = 'player-cell';
          cell.appendChild(avatarHtml(r.uuid, 26));
          var nm = document.createElement('span'); nm.className = 'pn'; nm.textContent = (r.online ? '● ' : '') + r.name;
          cell.appendChild(nm);
          td2.appendChild(cell);
          var td3 = document.createElement('td');
          td3.className = 'cell-playtime';

          var wrap3 = document.createElement('div');
          wrap3.className = 'playtime-cell';

          var pb = document.createElement('div');
          pb.className = 'bar';
          pb.title = fmtDur(r.seconds);

          var fill = document.createElement('i');
          fill.style.width = Math.max(4, Math.round((r.seconds / maxSec) * 100)) + '%';
          fill.style.background = 'linear-gradient(90deg,' + accA + ',#4aa8ff)';
          pb.appendChild(fill);

          var secTxt = document.createElement('span');
          secTxt.className = 'playtime-txt';
          secTxt.textContent = fmtDurShort(r.seconds);

          wrap3.appendChild(pb);
          wrap3.appendChild(secTxt);
          td3.appendChild(wrap3);
          var td4 = document.createElement('td'); td4.textContent = fmt(r.sessions); td4.className = 'num';
          var td5 = document.createElement('td');
          var kd = document.createElement('span');
          kd.className = (r.kd || 0) >= 1.5 ? '' : 'muted';
          kd.textContent = (r.kd || 0).toFixed(2); td5.appendChild(kd);
          var td6 = document.createElement('td'); td6.textContent = fmtDateOnly(r.firstJoin); td6.className = 'muted';
          var td7 = document.createElement('td'); td7.textContent = fmtDateOnly(r.lastJoin); td7.className = 'muted';
          [td, td2, td3, td4, td5, td6, td7].forEach(function (x) { tr.appendChild(x); });
          tr.addEventListener('click', function () { navigate('/player/' + encodeURIComponent(r.name)); });
          body.appendChild(tr);
        });
        var total = d.total || rows.length;
        var from = playerState.page * playerState.limit + 1;
        var to = from + rows.length - 1;
        $('#pl-info').textContent = t('pl.pagerInfo', fmt(total), fmt(from), fmt(to));
        $('#pl-prev').disabled = playerState.page === 0;
        $('#pl-next').disabled = to >= total || !rows.length;
      });
    }
    function exportAll(kind) {
      var url = query('&limit=5000&offset=0');
      j(url).then(function (d) {
        if (!d || seq !== viewSeq) return;
        var rows = d.rows || [];
        if (kind === 'csv') {
          var lines = ['rank;name;uuid;seconds;sessions;kills;deaths;kd;firstJoin;lastJoin'];
          rows.forEach(function (r) {
            lines.push([r.rank, r.name, r.uuid, r.seconds, r.sessions, r.kills, r.deaths, (r.kd || 0).toFixed(2), r.firstJoin, r.lastJoin].join(';'));
          });
          download('pulse-players.csv', '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
        } else {
          download('pulse-players.json', JSON.stringify(rows, null, 2), 'application/json');
        }
      });
    }
    load();
  }

  /* ───────────────────────── Вид: Последние смерти ───────────────────────── */
  function runDeaths(seq) {
    var html =
      '<div class="view-title">' + esc(t('deaths.title')) + '</div>' +
      '<div class="view-sub">' + esc(t('deaths.sub')) + '</div>' +
      '<div class="panel"><h3 class="panel-title">' + esc(t('deaths.recent')) + '</h3>' +
      '<div class="tbl-wrap"><table class="tbl death-tbl"><thead><tr>' +
      '<th>' + esc(t('deaths.time')) + '</th><th>' + esc(t('deaths.player')) + '</th><th>' + esc(t('deaths.server')) + '</th>' +
      '<th>' + esc(t('deaths.world')) + '</th><th>' + esc(t('deaths.coordinates')) + '</th><th>' + esc(t('deaths.cause')) + '</th>' +
      '</tr></thead><tbody id="death-rows"></tbody></table></div></div>';
    staticShell(html);

    j('/api/deaths?limit=100').then(function (d) {
      if (!d || seq !== viewSeq) return;
      if (renderRemoteErrorIfAny(d)) return;
      var body = $('#death-rows');
      body.innerHTML = '';

      var rows = d.deaths || [];
      if (!rows.length) {
        var empty = document.createElement('tr');
        var cell = document.createElement('td'); cell.colSpan = 6;
        cell.appendChild(skeleton(t('deaths.noDeaths'))); empty.appendChild(cell); body.appendChild(empty);
        return;
      }
      rows.forEach(function (death) {
        var tr = document.createElement('tr'); tr.style.cursor = 'default';
        [fmtTs(death.time, true), death.name, death.server, death.world].forEach(function (value) {
          var td = document.createElement('td'); td.textContent = value || '—'; tr.appendChild(td);
        });
        var coordCell = document.createElement('td');
        var coord = document.createElement('button'); coord.type = 'button'; coord.className = 'death-coordinate';
        coord.textContent = death.x + ', ' + death.y + ', ' + death.z;
        coord.title = t('deaths.copyCoordinates');
        coord.addEventListener('click', function () { copyText(death.x + ' ' + death.y + ' ' + death.z, coord, t('common.copied')); });
        coordCell.appendChild(coord); tr.appendChild(coordCell);
        var cause = document.createElement('td'); cause.textContent = death.cause || '—'; tr.appendChild(cause);
        body.appendChild(tr);
      });
    });
  }

  /* ───────────────────────── Вид: Игрок ───────────────────────── */
  var lastPlayerName = null;
  function runPlayer(name, seq) {
    var html =
      '<div class="view-sub"><button class="icon-btn" id="pl-back" title="' + t('pr.backTitle') + '" type="button" style="width:auto;padding:0 10px">' + t('pr.backBtn') + '</button></div>' +
      '<div class="panel phero"><div id="ph-av"></div><div class="ph-main">' +
      '  <div class="ph-name" id="ph-name">…</div>' +
      '  <div class="ph-meta" id="ph-meta"></div>' +
      '  <div class="ph-badges" id="ph-badges"></div>' +
      '</div><div class="col-4" style="flex:0 0 auto;width:min(320px,40%)" id="ph-playbar"></div></div>' +
      '<div class="grid">' +
      '  <div class="col-8 panel"><h3 class="panel-title">' + t('pr.weeklyActivity') + ' <span class="panel-title-link"><button class="tab-btn" id="cmp-btn" style="padding:2px 8px;font-size:11px">' + t('pr.compareBtn') + '</button></span></h3>' +
      '    <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px" id="ph-daybars"></div>' +
      '  </div>' +
      '  <div class="col-4 panel"><h3 class="panel-title">' + t('pr.timeForWeek') + '</h3><div class="chart-sm"><canvas id="ph-week"></canvas></div></div>' +
      '</div>' +
      '<div class="tabs">' +
      '  <button class="tab-btn active" data-tab="overview">' + t('pr.tabOverview') + '</button>' +
      '  <button class="tab-btn" data-tab="sessions">' + t('pr.tabSessions') + '</button>' +
      '  <button class="tab-btn" data-tab="combat">' + t('pr.tabCombat') + '</button>' +
      '  <button class="tab-btn" data-tab="ext">' + t('pr.tabPlugins') + '</button>' +
      '</div>' +
      '<div class="tab-pane active" id="tp-overview"></div>' +
      '<div class="tab-pane" id="tp-sessions"></div>' +
      '<div class="tab-pane" id="tp-combat"></div>' +
      '<div class="tab-pane" id="tp-ext"></div>' +
      '<div class="modal" id="cmp-modal" hidden><div class="modal-card"><div class="modal-head"><h3>' + t('pr.cmpTitle') + '</h3><button class="modal-close" id="cmp-close">✕</button></div><div id="cmp-body"></div></div></div>';
    staticShell(html);

    on($('#pl-back'), 'click', function () { navigate('/players'); });
    $$('.tab-btn').forEach(function (b) {
      on(b, 'click', function () {
        $$('.tab-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        $$('.tab-pane').forEach(function (p) { p.classList.toggle('active', p.id === 'tp-' + b.dataset.tab); });
        flushPendingCharts();
      });
    });

    if (lastPlayerName !== name) {
      lastPlayerName = name;
      ['ph-av', 'ph-meta', 'ph-badges', 'ph-playbar', 'ph-daybars', 'tp-overview', 'tp-sessions', 'tp-combat', 'tp-ext'].forEach(function (id) {
        var e = $('#' + id); if (e) e.innerHTML = '';
      });
      if ($('#ph-name')) $('#ph-name').textContent = t('common.loading');
    }
    if (!name) { var box = $('#ph-name'); box.textContent = t('pr.enterName'); return; }
    var accA = chroma('--accent-a') || '#7c5cff';
    var grad = gradStops(accA, chroma('--accent-b') || '#4aa8ff', 7);

    Promise.all([
      j('/api/player?name=' + encodeURIComponent(name)),
      j('/api/combat?name=' + encodeURIComponent(name)),
      j('/api/online'),
      j('/api/player/sessions?name=' + encodeURIComponent(name) + '&limit=40')
    ]).then(function (res) {
      var p = res[0], cbt = res[1], onl = res[2], sess = res[3];
      if (!p || seq !== viewSeq) return;
      if (p.error) { $('#ph-name').textContent = p.error; return; }

      /* при повтором входе чистим hero, чтобы не накопились дубли */
      ['ph-av', 'ph-meta', 'ph-badges', 'ph-playbar', 'ph-daybars'].forEach(function (id) {
        var e = $('#' + id); if (e) e.innerHTML = '';
      });
      ['tp-overview', 'tp-sessions', 'tp-combat', 'tp-ext'].forEach(function (id) {
        var e = $('#' + id); if (e) e.innerHTML = '';
      });

      /* hero */
      $('#ph-av').appendChild(avatarHtml(p.uuid, 64));
      var nmEl = $('#ph-name');
      nmEl.textContent = p.name;
      var online = (onl && (onl.online || []).some(function (o) { return (o.name || '').toLowerCase() === (p.name || '').toLowerCase(); }));
      var st = document.createElement('span');
      st.className = 'ph-status ' + (online ? 'ph-online' : 'ph-offline');
      st.textContent = online ? t('pr.online') : t('pr.offline', p.lastSeenRelative || t('pr.never'));
      nmEl.appendChild(st);

      var meta = $('#ph-meta');
      function addMeta(k, v) {
        if (v === null || v === undefined || v === '') return;
        var s = document.createElement('span');
        var kb = document.createElement('b'); kb.textContent = k + ': ';
        s.appendChild(kb); s.appendChild(document.createTextNode(String(v)));
        meta.appendChild(s);
      }
      addMeta(t('pr.metaRank'), p.rank ? '#' + p.rank : '');
      var countryMeta = document.createElement('span'); countryMeta.className = 'country-meta';
      var countryLabel = document.createElement('b'); countryLabel.textContent = t('pr.metaCountry') + ': ';
      var countryValue = document.createElement('span'); countryValue.textContent = p.country || t('pr.countryUnknown');
      var countrySource = document.createElement('small'); countrySource.className = 'country-source';
      countrySource.textContent = p.countryOverride ? t('pr.countryManual') : '';
      countryMeta.appendChild(countryLabel); countryMeta.appendChild(countryValue); countryMeta.appendChild(countrySource);
      var countryEditor = null;
      if (activeServer !== '_all') {
        var countryEdit = document.createElement('button'); countryEdit.type = 'button';
        countryEdit.className = 'country-edit-btn'; countryEdit.textContent = t('pr.countryEdit');
        countryMeta.appendChild(countryEdit);
        countryEditor = document.createElement('div'); countryEditor.className = 'country-editor'; countryEditor.hidden = true;
        var countryInput = document.createElement('input'); countryInput.className = 'country-input';
        countryInput.type = 'text'; countryInput.maxLength = 2; countryInput.placeholder = 'RU';
        countryInput.setAttribute('aria-label', t('pr.countryCodeHint'));
        countryInput.title = t('pr.countryCodeHint');
        countryInput.value = p.countryOverride || p.country || '';
        var countrySave = document.createElement('button'); countrySave.type = 'button';
        countrySave.className = 'country-action primary'; countrySave.textContent = t('pr.countrySave');
        var countryAuto = document.createElement('button'); countryAuto.type = 'button';
        countryAuto.className = 'country-action'; countryAuto.textContent = t('pr.countryAuto');
        var countryStatus = document.createElement('small'); countryStatus.className = 'country-status';
        countryEditor.appendChild(countryInput); countryEditor.appendChild(countrySave);
        countryEditor.appendChild(countryAuto); countryEditor.appendChild(countryStatus);
        meta.appendChild(countryMeta); meta.appendChild(countryEditor);

        countryEdit.addEventListener('click', function () {
          countryStatus.textContent = '';
          countryEditor.hidden = !countryEditor.hidden;
          if (!countryEditor.hidden) { countryInput.focus(); countryInput.select(); }
        });
        function saveCountry(value) {
          countrySave.disabled = true; countryAuto.disabled = true; countryStatus.textContent = '';
          postJson('/api/player/country', { name: p.name, country: value }).then(function (result) {
            if (!result || !result.ok) {
              countryStatus.textContent = result && result.error ? result.error : t('err.noLocalPanel');
              return;
            }
            p.country = result.country || '';
            p.countryOverride = result.countryOverride || '';
            countryValue.textContent = p.country || t('pr.countryUnknown');
            countrySource.textContent = p.countryOverride ? t('pr.countryManual') : '';
            countryInput.value = p.countryOverride || '';
            countryEditor.hidden = true;
          }).finally(function () {
            countrySave.disabled = false; countryAuto.disabled = false;
          });
        }
        countrySave.addEventListener('click', function () {
          var value = countryInput.value.trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(value)) {
            countryStatus.textContent = t('pr.countryCodeHint');
            countryInput.focus();
            return;
          }
          saveCountry(value);
        });
        countryAuto.addEventListener('click', function () { saveCountry(''); });
      } else {
        meta.appendChild(countryMeta);
      }
      addMeta(t('pr.metaFirstJoin'), fmtDateOnly(p.firstJoin));
      addMeta(t('pr.metaSessions'), fmt(p.sessions));

      var badges = $('#ph-badges');
      function badge(txt) {
        var b = document.createElement('span'); b.className = 'bbadge'; b.textContent = txt; badges.appendChild(b);
      }
      if (p.streak > 1) badge(t('pr.badgeStreak', p.streak));
      if (p.afkPercent > 20) badge('AFK ' + p.afkPercent + '%');
      badge('K/D ' + ((p.combat && p.combat.kd) || cbt && cbt.kd || 0).toFixed(2));

      /* playbar актив/афк за всё время */
      var pbx = $('#ph-playbar');
      var total = (p.activeSeconds || 0) + (p.afkSeconds || 0);
      var actPct = total > 0 ? (p.activeSeconds / total) * 100 : 100;
      var bar = document.createElement('div'); bar.className = 'playbar';
      var a = document.createElement('div'); a.className = 'pb-active'; a.style.width = actPct.toFixed(1) + '%';
      var b2 = document.createElement('div'); b2.className = 'pb-afk'; b2.style.width = (100 - actPct).toFixed(1) + '%';
      bar.appendChild(a); bar.appendChild(b2);
      var labs = document.createElement('div'); labs.className = 'playbar-labels';
      var l1 = document.createElement('span'); l1.innerHTML = esc(t('pr.activeLabel')) + ' <b>' + fmtDur(p.activeSeconds) + '</b>';
      var l2 = document.createElement('span'); l2.innerHTML = 'AFK <b>' + fmtDur(p.afkSeconds) + '</b>';
      labs.appendChild(l1); labs.appendChild(l2);
      var l3 = document.createElement('div'); l3.className = 'panel-sub';
      l3.textContent = t('pr.summaryLine', fmtDurShort(p.avgSessionSeconds), fmtDurShort(p.maxSessionSeconds), fmtDurShort(p.last7DaysSeconds));
      pbx.appendChild(bar); pbx.appendChild(labs); pbx.appendChild(l3);

      /* мини-теплокарта: daybars */
      var daybars = $('#ph-daybars');
      (p.dayWindows || []).slice(0, 7).forEach(function (dw) {
        var dn = document.createElement('span'); dn.className = 'muted'; dn.style.fontSize = '12px'; dn.textContent = I18N.translateWeekday(dw.dayName);
        var sub = document.createElement('span');
        sub.className = 'muted'; sub.style.fontSize = '11px'; sub.textContent = dw.windows.join(', ') || '—';
        daybars.appendChild(dn); daybars.appendChild(sub);
      });

      /* недельный бар */
      var days = p.days || [];
      chart('ph-week', barCfg(I18N.daysShort(), [{
        label: t('pr.chartActH'), data: days.map(function (v) { return +(v / 3600).toFixed(2); }),
        backgroundColor: grad, borderRadius: 4
      }], { options: { plugins: { legend: { display: false } } } }));

      /* вкладка Обзор */
      var ovp = $('#tp-overview');
      var ovGrid = document.createElement('div'); ovGrid.className = 'grid';
      ovGrid.style.marginBottom = '0';
      ovGrid.innerHTML = '';
      function ovPanel(title, build) {
        var dv = document.createElement('div'); dv.className = 'panel col-6';
        var tEl = document.createElement('h3'); tEl.className = 'panel-title'; tEl.textContent = title;
        dv.appendChild(tEl);
        build(dv);
        return dv;
      }
      ovGrid.appendChild(ovPanel(t('pr.heatPanel'), function (dv) {
        var wrap = document.createElement('div'); wrap.className = 'heat-wrap';
        dv.appendChild(wrap);
        renderHeat(wrap, p.playerHeatGrid || [], p.playerHeatMax || 0, I18N.daysShort(), function () { });
      }));
      ovGrid.appendChild(ovPanel(t('pr.favHours'), function (dv) {
        var hh = document.createElement('div');
        var hours = p.hours || [];
        var hmax = Math.max.apply(null, hours.map(function (x) { return x.seconds; }).concat([1]));
        hours.slice().sort(function (x, y) { return y.seconds - x.seconds; }).slice(0, 10).forEach(function (h) {
          var row = document.createElement('div'); row.className = 'rec-day'; row.style.padding = '3px 0';
          var tEl = document.createElement('span'); tEl.className = 'rec-day-name'; tEl.style.minWidth = '48px'; tEl.style.width = '48px'; tEl.textContent = h.hour + ':00';
          var bar = document.createElement('div'); bar.className = 'bar'; bar.style.flex = '1';
          var i = document.createElement('i'); i.style.width = Math.round((h.seconds / hmax) * 100) + '%';
          i.style.background = 'linear-gradient(90deg,' + accA + ',#4aa8ff)';
          bar.appendChild(i);
          row.appendChild(tEl); row.appendChild(bar);
          hh.appendChild(row);
        });
        dv.appendChild(hh);
      }));
      ovGrid.appendChild(ovPanel(t('pr.nickHistory'), function (dv) {
        var list = document.createElement('div'); list.className = 'session-list';
        (p.names || []).slice(0, 12).forEach(function (n) {
          var it = document.createElement('div'); it.className = 'session-item';
          var nm2 = document.createElement('b'); nm2.textContent = n;
          it.appendChild(nm2);
          list.appendChild(it);
        });
        if (!(p.names || []).length) list.appendChild(skeleton(t('common.noData')));
        dv.appendChild(list);
      }));
      ovp.appendChild(ovGrid);

      /* вкладка Сессии */
      var sp = $('#tp-sessions');
      var sList = document.createElement('div'); sList.className = 'session-list';
      var srows = (sess && sess.sessions) ? sess.sessions : [];
      if (!srows.length) sList.appendChild(skeleton(t('pr.noSessions')));
      srows.forEach(function (s2) {
        var it = document.createElement('div'); it.className = 'session-item';
        var nm3 = document.createElement('b'); nm3.textContent = fmtTs(s2.join, true);
        it.appendChild(nm3);
        var mid = document.createElement('span'); mid.className = 'muted';
        mid.textContent = (s2.world ? s2.world + ' · ' : '') + t('pr.lasted', fmtDurShort(s2.activeSeconds));
        it.appendChild(mid);
        var rt = document.createElement('span'); rt.className = 'si-right muted';
        rt.textContent = s2.quit ? t('pr.until', fmtTs(s2.quit)) : t('pr.stillOnline');
        it.appendChild(rt);
        sList.appendChild(it);
      });
      sp.appendChild(sList);

      /* вкладка Боевая */
      var cp = $('#tp-combat');
      var c = cbt || {};
      var cells = document.createElement('div'); cells.className = 'kpi-row'; cells.style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';
      function mu(label, value, cls) {
        var d = document.createElement('div'); d.className = 'kpi';
        var l = document.createElement('span'); l.className = 'kpi-label'; l.textContent = label;
        var v = document.createElement('span'); v.className = 'kpi-value'; if (cls) v.className += ' ' + cls;
        v.textContent = value;
        d.appendChild(l); d.appendChild(v); cells.appendChild(d);
      }
      mu(t('pr.kills'), fmt(c.kills));
      mu(t('pr.deaths'), fmt(c.deaths));
      mu('K/D', (c.kd || 0).toFixed(2), (c.kd || 0) >= 1 ? 'kpi-health' : '');
      mu(t('pr.mobKills'), fmt(c.mobKills));
      cp.appendChild(cells);
      var streakBox = document.createElement('div'); streakBox.className = 'grid'; streakBox.style.marginBottom = '0';
      [t('pr.bestKillStreak'), t('pr.onlineStreak')].forEach(function (title, i) {
        var dv = document.createElement('div'); dv.className = 'panel col-6';
        var tEl = document.createElement('h3'); tEl.className = 'panel-title'; tEl.textContent = title;
        var val = document.createElement('div'); val.className = 'kpi-value';
        val.textContent = i === 0 ? fmt(c.bestStreak) : fmt(c.onlineStreak || 0);
        dv.appendChild(tEl); dv.appendChild(val);
        streakBox.appendChild(dv);
      });
      cp.appendChild(streakBox);

      /* вкладка Плагины */
      var ep = $('#tp-ext');
      var extGrid = document.createElement('div'); extGrid.className = 'ext-grid';
      var exts = p.extensions || [];
      if (!exts.length) extGrid.appendChild(skeleton(t('pr.noPluginData')));
      exts.forEach(function (e) {
        var card = document.createElement('div'); card.className = 'ext-card';
        var pl = document.createElement('div'); pl.className = 'ext-plugin'; pl.textContent = e.plugin;
        var key = document.createElement('div'); key.className = 'ext-key'; key.textContent = e.key;
        var pay = document.createElement('div'); pay.className = 'ext-payload';
        pay.textContent = typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload);
        card.appendChild(pl); card.appendChild(key); card.appendChild(pay);
        extGrid.appendChild(card);
      });
      ep.appendChild(extGrid);

      /* сравнение */
      var cmpBtn = $('#cmp-btn');
      var cmpModal = $('#cmp-modal');
      on(cmpBtn, 'click', function () {
        cmpModal.hidden = false;
        var body = $('#cmp-body'); body.innerHTML = '';
        var row = document.createElement('div'); row.className = 'rec-day'; row.style.padding = '8px 0';
        var inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = t('pr.cmpPlaceholder');
        inp.style.cssText = 'flex:1;padding:8px 10px;background:var(--inset);border:1px solid var(--line);border-radius:8px;color:var(--text)';
        var go = document.createElement('button'); go.className = 'btn'; go.style.cssText += ';padding:8px 12px'; go.textContent = t('pr.cmpGo');
        row.appendChild(inp); row.appendChild(go);
        var resBox = document.createElement('div');
        body.appendChild(row);
        body.appendChild(resBox);
        go.addEventListener('click', function () {
          var nm = inp.value.trim();
          if (!nm) return;
          resBox.innerHTML = '';
          j('/api/compare?a=' + encodeURIComponent(p.name) + '&b=' + encodeURIComponent(nm)).then(function (d) {
            if (!d || seq !== viewSeq) return;
            resBox.innerHTML = '';
            if (!d.a || !d.b) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = t('pr.cmpNotFound'); resBox.appendChild(e); return; }
            var tbl = document.createElement('table'); tbl.className = 'tbl';
            var thead = document.createElement('thead');
            var hr = document.createElement('tr');
            [t('pr.cmpMetric'), d.a.name, d.b.name].forEach(function (x) {
              var th = document.createElement('th'); th.textContent = x; hr.appendChild(th);
            });
            thead.appendChild(hr); tbl.appendChild(thead);
            var tb = document.createElement('tbody');
            function cmpRow(label, va, vb) {
              var tr = document.createElement('tr');
              var l = document.createElement('td'); l.textContent = label; l.className = 'muted';
              var ca = document.createElement('td'); ca.textContent = va;
              var cb = document.createElement('td'); cb.textContent = vb;
              tr.appendChild(l); tr.appendChild(ca); tr.appendChild(cb);
              tb.appendChild(tr);
            }
            cmpRow(t('pr.cmpPlaytime'), fmtDur(d.a.activeSeconds), fmtDur(d.b.activeSeconds));
            cmpRow(t('pr.cmpSessions'), fmt(d.a.sessions), fmt(d.b.sessions));
            cmpRow(t('pr.cmpAvgSession'), fmtDurShort(d.a.avgSessionSeconds), fmtDurShort(d.b.avgSessionSeconds));
            cmpRow(t('pr.cmpMaxSession'), fmtDurShort(d.a.maxSessionSeconds), fmtDurShort(d.b.maxSessionSeconds));
            cmpRow(t('pr.cmpFirstJoin'), fmtDateOnly(d.a.firstJoin), fmtDateOnly(d.b.firstJoin));
            cmpRow(t('pr.cmpLast7d'), fmtDurShort(d.a.last7DaysSeconds), fmtDurShort(d.b.last7DaysSeconds));
            tbl.appendChild(tb);
            resBox.appendChild(tbl);
          });
        });
      });
      on($('#cmp-close'), 'click', function () { cmpModal.hidden = true; });
    });
  }

  /* ───────────────────────── Вид: Сервер ───────────────────────── */
  var serverRange = null;
  function runServer(seq) {
    var range = serverRange || '24h';
    var html =
      '<div class="view-title">' + t('sv.title') + '</div>' +
      '<div class="view-sub">' + t('sv.sub') + '</div>' +
      '<div class="toolbar"><div class="chips" id="srv-range">' +
      '  <button class="chip" data-range="1h">' + t('sv.r1h') + '</button>' +
      '  <button class="chip" data-range="6h">' + t('sv.r6h') + '</button>' +
      '  <button class="chip" data-range="24h">' + t('sv.r24h') + '</button>' +
      '  <button class="chip" data-range="7d">' + t('sv.r7d') + '</button></div></div>' +
      '<div class="tabs">' +
      '  <button class="tab-btn active" data-tab="load">' + t('sv.tabLoad') + '</button>' +
      '  <button class="tab-btn" data-tab="pop">' + t('sv.tabPop') + '</button>' +
      '  <button class="tab-btn" data-tab="ret">' + t('sv.tabRet') + '</button>' +
      '  <button class="tab-btn" data-tab="env">' + t('sv.tabEnv') + '</button>' +
      '</div>' +
      '<div class="tab-pane active" id="sv-load">' +
      '  <div class="grid"><div class="col-6 panel"><h3 class="panel-title">TPS</h3><canvas id="ch-tps" class="chart"></canvas></div>' +
      '  <div class="col-6 panel"><h3 class="panel-title">' + t('sv.chartOnlinePeak') + '</h3><canvas id="ch-onl" class="chart"></canvas></div></div>' +
      '  <div class="grid"><div class="col-6 panel"><h3 class="panel-title">' + t('sv.panelMemory') + '</h3><canvas id="ch-mem" class="chart"></canvas></div>' +
      '  <div class="col-6 panel"><h3 class="panel-title">' + t('sv.panelCombat') + '</h3><div class="period-caption">' + t('period.fixedWeek') + '</div><canvas id="ch-kd" class="chart"></canvas></div></div>' +
      '  <div class="grid"><div class="col-6 panel"><h3 class="panel-title">MSPT (ms)' + periodHelpButton('help.mspt') + '</h3><canvas id="ch-mspt" class="chart"></canvas></div>' +
      '  <div class="col-6 panel"><h3 class="panel-title">' + t('sv.panelWorldLoad') + '</h3><canvas id="ch-worldload" class="chart"></canvas></div></div>' +
      '</div>' +
      '<div class="tab-pane" id="sv-pop">' +
      '  <div class="grid"><div class="col-5 panel"><h3 class="panel-title">' + t('sv.panelGeo') + '</h3><canvas id="ch-country" style="max-height:280px"></canvas></div>' +
      '  <div class="col-7 panel"><h3 class="panel-title">' + t('sv.panelClients') + '</h3><canvas id="ch-client" class="chart"></canvas></div></div>' +
      '  <div class="grid"><div class="col-4 panel"><h3 class="panel-title">' + t('sv.panelSessionLen') + '</h3><div class="period-caption">' + t('period.last30Days') + '</div><canvas id="ch-sess" class="chart"></canvas></div>' +
      '  <div class="col-8 panel"><h3 class="panel-title">' + t('sv.panelGrowth') + '</h3><div class="period-caption">' + t('period.fixedWeek') + '</div><canvas id="ch-growth" class="chart"></canvas></div></div>' +
      '</div>' +
      '<div class="tab-pane" id="sv-ret">' +
      '  <div class="panel"><h3 class="panel-title">' + t('sv.panelCohorts') + periodHelpButton('help.cohorts') + '</h3><div class="period-caption">' + t('period.last8Weeks') + '</div><div style="overflow-x:auto" id="cohort-box"></div></div>' +
      '  <div class="grid"><div class="col-6 panel"><h3 class="panel-title">' + t('sv.returnedAfter') + periodHelpButton('help.retention') + ' <span class="seg" id="ret-days">' +
      '    <button class="seg-btn active" data-days="d1">' + t('sv.d1') + '</button><button class="seg-btn" data-days="d3">' + t('sv.d3') + '</button>' +
      '    <button class="seg-btn" data-days="d7">' + t('sv.d7') + '</button><button class="seg-btn" data-days="d30">' + t('sv.d30') + '</button></span></h3>' +
      '  <div id="ret-list" class="pchips" style="max-height:340px"></div></div>' +
      '  <div class="col-6 panel"><h3 class="panel-title">' + t('sv.panelPeak') + '</h3><div class="period-caption">' + t('period.fixedWeek') + '</div><canvas id="ch-peak" class="chart"></canvas></div></div>' +
      '</div>' +
      '<div class="tab-pane" id="sv-env"><div class="env-grid" id="env-grid"></div></div>';
    staticShell(html);
    bindMetricHelp($('#view'));

    $$('.tab-btn').forEach(function (b) {
      on(b, 'click', function () {
        $$('.tab-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        $$('.tab-pane').forEach(function (p) { p.classList.toggle('active', p.id === 'sv-' + b.dataset.tab); });
        flushPendingCharts();
      });
    });
    var accA = chroma('--accent-a') || '#7c5cff';
    var accB = chroma('--accent-b') || '#4aa8ff';
    var green = chroma('--green') || '#2fd58f';
    var amber = chroma('--amber') || '#ffd75e';
    var red = chroma('--red') || '#ff5d6c';
    var colors = [accA, accB, green, amber, red, '#9aa4ba', '#ff8fb3'];
    var serverPeriodPromise = fetchPeriod('7d');

    function loadRange() {
      $$('#srv-range .chip').forEach(function (c) {
        c.classList.toggle('active', c.dataset.range === range);
      });
      j('/api/server-stats?range=' + range).then(function (d) {
        if (!d || seq !== viewSeq) return;
        if (renderRemoteErrorIfAny(d)) return;
        chart('ch-tps', lineCfg(d.labels, [{
          label: 'TPS', data: d.tps, borderColor: green, backgroundColor: rgba(green, .15), fill: true, tension: .25, pointRadius: 0
        }]));
        chart('ch-onl', lineCfg(d.labels, [{
          label: t('sv.chartOnlinePeak'), data: d.online, borderColor: accA, backgroundColor: rgba(accA, .2), fill: true, tension: 0, pointRadius: 0
        }]));
        chart('ch-mem', lineCfg(d.labels, [
          { label: t('sv.chartMemMb'), data: d.usedMemory, borderColor: amber, backgroundColor: rgba(amber, .15), fill: true, tension: .25, pointRadius: 0 },
          { label: t('sv.chartMax'), data: d.maxMemory, borderColor: '#68718a', borderDash: [5, 4], fill: false, tension: .25, pointRadius: 0 }
        ]));
        if (d.mspt) {
          chart('ch-mspt', lineCfg(d.labels, [
            { label: 'MSPT (ms)', data: d.mspt, borderColor: accB, backgroundColor: rgba(accB, .15), fill: true, tension: .25, pointRadius: 0 }
          ]));
        }
        if (d.chunks || d.entities) {
          chart('ch-worldload', lineCfg(d.labels, [
            { label: t('sv.chartChunks'), data: d.chunks || [], borderColor: accA, backgroundColor: rgba(accA, .12), fill: true, tension: .25, pointRadius: 0 },
            { label: t('sv.chartEntities'), data: d.entities || [], borderColor: amber, backgroundColor: rgba(amber, .12), fill: false, tension: .25, pointRadius: 0 }
          ]));
        }
      });
    }
    function loadKd() {
      serverPeriodPromise.then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        chart('ch-kd', barCfg(d.labels, [
          { label: t('sv.chartKills'), data: d.kills, backgroundColor: rgba(accA, .7), borderRadius: 3 },
          { label: t('sv.chartDeaths'), data: d.deaths, backgroundColor: rgba(red, .55), borderRadius: 3 }
        ]));
      });
    }
    function loadPop() {
      j('/api/distribution').then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        var cc = (d.countries || []).slice(0, 10);
        chart('ch-country', doughnutCfg(cc.map(function (x) { return x.label; }), cc.map(function (x) { return x.count; }), colors));
        var cl = d.clients || [];
        chart('ch-client', barCfg(cl.map(function (x) { return x.label; }), [{
          label: t('sv.chartPlayers'), data: cl.map(function (x) { return x.count; }), backgroundColor: gradStops(accA, accB, Math.max(2, cl.length)), borderRadius: 4
        }]));
      });
      j('/api/session-hist').then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        chart('ch-sess', barCfg(I18N.translateHistLabels(d.labels), [{
          label: t('sv.chartSessions'), data: d.counts, backgroundColor: rgba(accB, .7), borderRadius: 4
        }]));
      });
      j('/api/growth?days=7').then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        chart('ch-growth', barCfg(d.labels, [
          { label: t('ov.chartUniquePlayers'), data: d.players, backgroundColor: rgba(accA, .6), borderRadius: 3, yAxisID: 'y' },
          { label: t('sv.chartNew'), data: d.newPlayers, backgroundColor: rgba(green, .6), borderRadius: 3, yAxisID: 'y' }
        ]));
      });
    }
    function loadRet() {
      j('/api/cohorts').then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        var box = $('#cohort-box');
        box.innerHTML = '';
        var tb = document.createElement('table'); tb.className = 'cohort-tbl';
        var thead = document.createElement('thead');
        var hr = document.createElement('tr');
        var th = document.createElement('th'); th.textContent = t('sv.cohortWeek'); hr.appendChild(th);
        for (var i = 0; i < d.maxWeeks; i++) {
          var hh = document.createElement('th'); hh.textContent = t('sv.cohortPlusW', i); hr.appendChild(hh);
        }
        thead.appendChild(hr); tb.appendChild(thead);
        var tbody = document.createElement('tbody');
        (d.rows || []).forEach(function (r) {
          var tr = document.createElement('tr'); tr.className = 'row-clk';
          var cell0 = document.createElement('td'); cell0.className = 'cohort-size'; cell0.textContent = r.label + ' · ' + fmt(r.size); tr.appendChild(cell0);
          var byOff = {};
          (r.cells || []).forEach(function (c) { byOff[c.offset] = c.count; });
          for (var j = 0; j < d.maxWeeks; j++) {
            var td = document.createElement('td');
            var cnt = byOff[j];
            if (cnt === undefined || cnt === null) {
              td.appendChild(document.createTextNode('—'));
            } else {
              var pct = r.size ? Math.round(cnt * 100 / r.size) : 0;
              var boxEl = document.createElement('div'); boxEl.className = 'cell-box';
              boxEl.style.background = pct > 0 ? rgba(pct >= 50 ? green : (pct >= 25 ? amber : accA), .12 + .6 * (pct / 100)) : 'transparent';
              boxEl.textContent = pct + '%';
              td.appendChild(boxEl);
            }
            tr.appendChild(td);
          }
          (function (rr) {
            tr.addEventListener('click', function () { showCohortPlayers(rr); });
          })(r);
          tbody.appendChild(tr);
        });
        tb.appendChild(tbody);
        box.appendChild(tb);
      });
      j('/api/retention/players?day=' + ($('#ret-days .seg-btn.active') ? $('#ret-days .seg-btn.active').dataset.days : 'd1')).then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        var box = $('#ret-list');
        box.innerHTML = '';
        var list = d.players || [];
        if (!list.length) box.appendChild(skeleton(t('sv.nobodyReturned')));
        list.forEach(function (pl) {
          var b = document.createElement('button'); b.className = 'pchip'; b.type = 'button';
          b.appendChild(avatarHtml(pl.uuid, 26));
          var main = document.createElement('div'); main.className = 'pc-main';
          var nm = document.createElement('div'); nm.className = 'pc-name'; nm.textContent = pl.name;
          main.appendChild(nm);
          b.appendChild(main);
          b.addEventListener('click', function () { navigate('/player/' + encodeURIComponent(pl.name)); });
          box.appendChild(b);
        });
      });
      j('/api/peak?days=7').then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        chart('ch-peak', lineCfg(d.labels, [
          { label: t('sv.chartMaxOnline'), data: d.maxOnline, borderColor: accA, backgroundColor: rgba(accA, .15), fill: true, tension: .25, pointRadius: 0 },
          { label: t('sv.chartAvgOnline'), data: d.avgOnline, borderColor: green, fill: false, tension: .25, pointRadius: 0 }
        ]));
      });
    }
    function showCohortPlayers(row) {
      j('/api/retention/players?day=d1').then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        openModal(t('sv.cohortModalTitle', row.label), function (body, hide) {
          if (!(d.players || []).length) body.appendChild(skeleton(t('common.noData')));
          (d.players || []).forEach(function (pl) {
            var b = document.createElement('button'); b.className = 'pchip'; b.type = 'button'; b.style.width = '100%';
            b.appendChild(avatarHtml(pl.uuid, 26));
            var main = document.createElement('div'); main.className = 'pc-main';
            var nm = document.createElement('div'); nm.className = 'pc-name'; nm.textContent = pl.name;
            main.appendChild(nm); b.appendChild(main);
            b.addEventListener('click', function () { if (hide) hide(); navigate('/player/' + encodeURIComponent(pl.name)); });
            body.appendChild(b);
          });
        });
      });
    }
    function loadEnv() {
      j('/api/serverinfo').then(function (d) {
        if (!d || d.error || seq !== viewSeq) return;
        var g = $('#env-grid'); g.innerHTML = '';
        var items = [
          [t('sv.envServerVer'), d.serverVersion],
          [t('sv.envMcVer'), d.minecraftVersion],
          [t('sv.envBukkitVer'), d.bukkitVersion],
          ['Java', d.javaVersion],
          ['MSPT', d.mspt != null ? d.mspt + ' ms' : null],
          [t('sv.envMode'), d.onlineMode ? t('sv.envOnlineMode') : t('sv.envOfflineMode')],
          ['Whitelist', d.whitelist ? t('sv.envWlOn') : t('sv.envWlOff')],
          [t('sv.envPlugins'), fmt(d.plugins)],
          ['Uptime', I18N.translateUptime(d.uptime)],
          ['MOTD', conf.env && conf.env.motd]
        ];
        items.forEach(function (kv) {
          if (kv[1] === undefined || kv[1] === null || kv[1] === '') return;
          var c = document.createElement('div'); c.className = 'env-card';
          var k = document.createElement('div'); k.className = 'env-k'; k.textContent = kv[0];
          var v = document.createElement('div'); v.className = 'env-v'; v.textContent = String(kv[1]);
          c.appendChild(k); c.appendChild(v); g.appendChild(c);
        });
        var worlds = d.worlds || [];
        var wCard = document.createElement('div'); wCard.className = 'env-card';
        var wk = document.createElement('div'); wk.className = 'env-k'; wk.textContent = t('sv.envWorlds');
        var wv = document.createElement('div'); wv.className = 'env-v';
        wv.textContent = worlds.map(function (w) {
          var meta = [t('srv.badgeOnlCount', w.players)];
          if (w.chunks != null) meta.push(w.chunks + ' ch');
          if (w.entities != null) meta.push(w.entities + ' ent');
          return w.name + ' (' + meta.join(', ') + ')';
        }).join(' · ') || '—';
        wCard.appendChild(wk); wCard.appendChild(wv); g.appendChild(wCard);
      });
    }

    $$('#srv-range .chip').forEach(function (c) {
      on(c, 'click', function () { range = c.dataset.range; serverRange = range; loadServer(); });
    });
    $$('#ret-days .seg-btn').forEach(function (b) {
      on(b, 'click', function () {
        $$('#ret-days .seg-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        loadRet();
      });
    });
    function loadServer() {
      loadRange(); loadKd(); loadPop(); loadRet(); loadEnv();
    }
    loadServer();
  }

  /* ───────────────────────── Вид: Аналитика ───────────────────────── */
  function runAnalytics(seq) {
    var P = currentPeriod();
    var html =
      '<div class="view-title">' + t('an.title') + '</div>' +
      '<div class="view-sub">' + t('an.sub') + '</div>' +
      '<div class="period-caption" id="an-period-caption"></div>' +
      '<div class="period-error" id="an-period-error" hidden></div>' +
      '<div class="panel" style="margin-bottom:16px"><h3 class="panel-title">' + t('an.actPeriod') + '</h3>' +
      '<div class="period-caption">' + periodHelpButton('ov.tipSessionAccounting') + '</div>' +
      '  <div class="seg" id="an-type" style="margin-bottom:12px">' +
      '    <button class="seg-btn active" data-act="seconds">' + t('an.segHours') + '</button>' +
      '    <button class="seg-btn" data-act="players">' + t('nav.players') + '</button>' +
      '    <button class="seg-btn" data-act="sessions">' + t('pl.colSessions') + '</button>' +
      '    <button class="seg-btn" data-act="kd">K/D</button></div>' +
      '  <canvas id="an-act" class="chart"></canvas></div>' +
      '<div class="grid">' +
      '  <div class="col-6 panel"><h3 class="panel-title">' + t('an.cohortTitle') + periodHelpButton('help.cohorts') + '</h3><div class="period-caption">' + t('period.last8Weeks') + '</div><div style="overflow-x:auto" id="an-cohort"></div></div>' +
      '  <div class="col-6 panel"><h3 class="panel-title">' + t('an.sessLen30') + '</h3><div class="period-caption">' + t('period.last30Days') + '</div><canvas id="an-sess" class="chart"></canvas></div>' +
      '</div>' +
      '<div class="grid">' +
      '  <div class="col-4 panel"><h3 class="panel-title">' + t('an.newPlayers') + '</h3><div class="period-caption">' + t('period.last7Days') + '</div><div class="pchips" id="an-new" style="max-height:330px"></div></div>' +
      '  <div class="col-4 panel"><h3 class="panel-title">' + t('an.topKd') + ' <span class="panel-title-link">' + t('an.forWeek') + '</span></h3><div class="period-caption">' + t('period.fixedWeek') + '</div><div class="pchips" id="an-kd" style="max-height:330px"></div></div>' +
      '  <div class="col-4 panel"><h3 class="panel-title">' + t('an.presenceStreak') + '</h3><div class="period-caption">' + t('period.liveNow') + '</div><div id="an-streak" class="pchips" style="max-height:330px"></div></div>' +
      '</div>' +
      '<div class="panel"><h3 class="panel-title">' + t('an.matrixTitle') + ' <span class="panel-title-link">' + t('an.matrixSub') + '</span></h3>' +
      '  <div style="overflow-x:auto" id="an-matrix"></div></div>';
    staticShell(html);
    bindMetricHelp($('#view'));
    var periodPromise = fetchPeriod();

    var accA = chroma('--accent-a') || '#7c5cff';
    var accB = chroma('--accent-b') || '#4aa8ff';
    var green = chroma('--green') || '#2fd58f';
    var red = chroma('--red') || '#ff5d6c';
    var amber = chroma('--amber') || '#ffd75e';

    function loadAct() {
      var type = $('#an-type .seg-btn.active') ? $('#an-type .seg-btn.active').dataset.act : 'seconds';
      periodPromise.then(function (d) {
        if (seq !== viewSeq) return;
        if (!isValidPeriodResponse(d)) {
          showPeriodError('#an-period-error', d);
          $('#an-period-caption').textContent = '';
          clearChart('an-act');
          return;
        }
        clearPeriodError('#an-period-error');
        $('#an-period-caption').textContent = periodCaption(d);
        var datasets = [];
        if (type === 'seconds') {
          datasets.push({ label: t('ov.chartPlaytimeH'), data: (d.seconds || []).map(function (v) { return +(v / 3600).toFixed(1); }), borderColor: accA, backgroundColor: rgba(accA, .6), borderRadius: 3 });
        } else if (type === 'players') {
          datasets.push({ label: t('ov.chartUniquePlayers'), data: d.players, borderColor: accB, backgroundColor: rgba(accB, .6), borderRadius: 3 });
          datasets.push({ label: t('sv.chartSessions'), data: d.sessions, borderColor: green, backgroundColor: rgba(green, .3), borderRadius: 3, type: 'line' });
        } else if (type === 'sessions') {
          datasets.push({ label: t('sv.chartSessions'), data: d.sessions, borderColor: green, backgroundColor: rgba(green, .6), borderRadius: 3 });
        } else if (type === 'kd') {
          datasets.push({ label: t('an.killsPerDay'), data: d.kills || [], borderColor: red, backgroundColor: rgba(red, .55), borderRadius: 3 });
          datasets.push({ label: 'K/D', data: d.kd || [], borderColor: amber, type: 'line', tension: .3, pointRadius: 0 });
        }
        chart('an-act', barCfg(d.labels, datasets));
      });
    }
    $$('#an-type .seg-btn').forEach(function (b) {
      on(b, 'click', function () {
        $$('#an-type .seg-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        loadAct();
      });
    });

    j('/api/cohorts').then(function (d) {
      if (!d || d.error || seq !== viewSeq) return;
      var box = $('#an-cohort'); box.innerHTML = '';
      var tb = document.createElement('table'); tb.className = 'cohort-tbl';
      var thead = document.createElement('thead');
      var hr = document.createElement('tr');
      var th0 = document.createElement('th'); th0.textContent = t('an.cohortCol'); hr.appendChild(th0);
      for (var i = 0; i < d.maxWeeks; i++) { var th = document.createElement('th'); th.textContent = t('sv.cohortPlusW', i); hr.appendChild(th); }
      thead.appendChild(hr); tb.appendChild(thead);
      var tbody = document.createElement('tbody');
      (d.rows || []).forEach(function (r) {
        var tr = document.createElement('tr');
        var c0 = document.createElement('td'); c0.className = 'cohort-size'; c0.textContent = r.label + ' · ' + fmt(r.size); tr.appendChild(c0);
        var byOff = {}; (r.cells || []).forEach(function (c) { byOff[c.offset] = c.count; });
        for (var j = 0; j < d.maxWeeks; j++) {
          var td = document.createElement('td');
          var cnt = byOff[j];
          if (cnt === undefined) { td.textContent = '—'; }
          else {
            var pct = r.size ? Math.round(cnt * 100 / r.size) : 0;
            var bx = document.createElement('div'); bx.className = 'cell-box';
            bx.style.background = pct > 0 ? rgba(pct >= 50 ? green : (pct >= 25 ? amber : accB), .1 + .6 * (pct / 100)) : 'transparent';
            bx.textContent = pct + '%';
            td.appendChild(bx);
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
      tb.appendChild(tbody);
      box.appendChild(tb);
    });
    j('/api/session-hist').then(function (d) {
      if (!d || d.error || seq !== viewSeq) return;
      chart('an-sess', barCfg(I18N.translateHistLabels(d.labels), [{ label: t('sv.chartSessions'), data: d.counts, backgroundColor: gradStops(accA, accB, 7), borderRadius: 4 }]));
    });
    j('/api/new-players?days=7').then(function (d) {
      if (!d || d.error || seq !== viewSeq) return;
      var box = $('#an-new'); box.innerHTML = '';
      (d.players || []).slice(0, 15).forEach(function (p) {
        var b = document.createElement('button'); b.className = 'pchip'; b.type = 'button';
        b.appendChild(avatarHtml(p.uuid, 26));
        var main = document.createElement('div'); main.className = 'pc-main';
        var nm = document.createElement('div'); nm.className = 'pc-name'; nm.textContent = p.name;
        var mt = document.createElement('div'); mt.className = 'pc-meta'; mt.textContent = t('an.firstJoinMeta', fmtDateOnly(p.firstJoin), fmtDurShort(p.seconds));
        main.appendChild(nm); main.appendChild(mt);
        b.appendChild(main);
        b.addEventListener('click', function () { navigate('/player/' + encodeURIComponent(p.name)); });
        box.appendChild(b);
      });
      if (!(d.players || []).length) box.appendChild(skeleton(t('an.noNewbies')));
    });
    j('/api/topkillers?period=week').then(function (d) {
      if (!d || d.error || seq !== viewSeq) return;
      var box = $('#an-kd'); box.innerHTML = '';
      (d.players || []).slice(0, 10).forEach(function (p) {
        var b = document.createElement('button'); b.className = 'pchip'; b.type = 'button';
        b.appendChild(avatarHtml(p.uuid, 26));
        var main = document.createElement('div'); main.className = 'pc-main';
        var nm = document.createElement('div'); nm.className = 'pc-name'; nm.textContent = p.name;
        var mt = document.createElement('div'); mt.className = 'pc-meta'; mt.textContent = t('an.killsWeekMeta', fmt(p.kills));
        main.appendChild(nm); main.appendChild(mt);
        b.appendChild(main);
        b.addEventListener('click', function () { navigate('/player/' + encodeURIComponent(p.name)); });
        box.appendChild(b);
      });
      if (!(d.players || []).length) box.appendChild(skeleton(t('an.noFightsWeek')));
    });
    j('/api/online').then(function (d) {
      if (!d || d.error || seq !== viewSeq) return;
      var box = $('#an-streak'); box.innerHTML = '';
      var players = (d.online || []).sort(function (a, b) { return (b.onlineSeconds || 0) - (a.onlineSeconds || 0); }).slice(0, 10);
      players.forEach(function (p) {
        var b = document.createElement('button'); b.className = 'pchip'; b.type = 'button';
        b.appendChild(avatarHtml(p.uuid, 26));
        var main = document.createElement('div'); main.className = 'pc-main';
        var nm = document.createElement('div'); nm.className = 'pc-name'; nm.textContent = p.name;
        var mt = document.createElement('div'); mt.className = 'pc-meta'; mt.textContent = t('an.onServerMeta', fmtDurShort(p.onlineSeconds));
        main.appendChild(nm); main.appendChild(mt);
        b.appendChild(main);
        b.addEventListener('click', function () { navigate('/player/' + encodeURIComponent(p.name)); });
        box.appendChild(b);
      });
      if (!players.length) box.appendChild(skeleton(t('an.nobodyOnlineNow')));
    });

    /* Матрица кто-когда */
    periodPromise.then(function (d) {
      if (seq !== viewSeq) return;
      if (!isValidPeriodResponse(d)) {
        showPeriodError('#an-period-error', d);
        $('#an-matrix').innerHTML = '';
        return;
      }
      clearPeriodError('#an-period-error');
      var wrap = $('#an-matrix'); wrap.innerHTML = '';
      var daysList = (Array.isArray(d.daysList) ? d.daysList : []).map(function (day) {
        return (Array.isArray(day) ? day : []).filter(function (pl) { return pl && normalizeUuid(pl.uuid); }).map(function (pl) {
          return { uuid: normalizeUuid(pl.uuid), rawUuid: pl.uuid, name: pl.name || '', seconds: Number(pl.seconds) || 0 };
        });
      });
      var tall = {};
      var names = {};
      daysList.forEach(function (dl) {
        (dl || []).forEach(function (pl) {
          tall[pl.uuid] = (tall[pl.uuid] || 0) + pl.seconds;
          if (pl.name) names[pl.uuid] = pl.name;
        });
      });
      var top = Object.keys(tall).sort(function (a, b) { return tall[b] - tall[a]; }).slice(0, 30);
      var tb = document.createElement('table'); tb.className = 'cohort-tbl'; tb.style.minWidth = 'max-content';
      var thead = document.createElement('thead');
      var hr = document.createElement('tr');
      var thN = document.createElement('th'); thN.textContent = t('pl.colPlayer'); hr.appendChild(thN);
      var labels = Array.isArray(d.labels) ? d.labels : [];
      labels.forEach(function (l) { var th = document.createElement('th'); th.textContent = l; hr.appendChild(th); });
      thead.appendChild(hr); tb.appendChild(thead);
      var tbody = document.createElement('tbody');
      var maxV = Object.keys(tall).reduce(function (m, k) { return Math.max(m, tall[k]); }, 1);
      top.forEach(function (uuid) {
        var tr = document.createElement('tr'); tr.className = 'row-clk';
        var nmCell = document.createElement('td'); nmCell.className = 'cohort-size'; nmCell.style.textAlign = 'left';
        var playerName = names[uuid] || uuid;
        nmCell.textContent = playerName;
        tr.appendChild(nmCell);
        daysList.forEach(function (dl) {
          var td = document.createElement('td');
          var hit = (dl || []).find(function (pl) { return pl.uuid === uuid; });
          if (hit && hit.seconds > 0) {
            var a = hit.seconds / maxV;
            td.style.background = rgba(accA, .1 + .75 * a);
            td.textContent = '·';
          }
          tr.appendChild(td);
        });
        (function (nm) {
          tr.addEventListener('click', function () { navigate('/player/' + encodeURIComponent(nm)); });
        })(playerName);
        tbody.appendChild(tr);
      });
      tb.appendChild(tbody);
      wrap.appendChild(tb);
      if (!top.length) wrap.appendChild(skeleton(t('an.noDataPeriod')));
    });

    loadAct();
  }

  /* ───────────────────────── Подключаемые модули (MacronuxDAM и др.) ───────────────────────── */
  window.PulseApp = {
    $: $,
    $$: $$,
    on: on,
    t: t,
    fmt: fmt,
    esc: esc,
    fmtDur: fmtDur,
    fmtDurShort: fmtDurShort,
    fmtTs: fmtTs,
    fmtDateOnly: fmtDateOnly,
    chroma: chroma,
    rgba: rgba,
    debounce: debounce,
    j: j,
    postJson: postJson,
    chart: chart,
    clearCharts: clearCharts,
    lineCfg: lineCfg,
    barCfg: barCfg,
    doughnutCfg: doughnutCfg,
    openModal: openModal,
    staticShell: staticShell,
    skeleton: skeleton,
    copyText: copyText,
    daysFor: daysFor,
    currentPeriod: currentPeriod,
    navigate: navigate,
    route: route,
    getViewSeq: function () { return viewSeq; },
    getNavigationSeq: function () { return navigationSeq; },
    getActiveServer: function () { return activeServer; },
    getServerName: function () { return activeServer === 'local' ? (conf.serverName || t('srv.thisServer')) : activeServer; },
    setDapEnabled: function (flag) {
      conf.dapEnabled = !!flag;
      syncDapNav();
    },
    openModulesModal: openModulesModal
  };

  var chatScriptLoading = null;
  function runChat(seq) {
    var existing = window.PulseModules && window.PulseModules.chat;
    if (existing) { existing.run(seq); return; }
    staticShell('<div class="view-title">' + esc(t('nav.chat')) + '</div><div class="bootscreen"><span class="spinner"></span>' + esc(t('common.loading')) + '</div>');
    if (!chatScriptLoading) {
      chatScriptLoading = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = '/modules/chat.js';
        script.onload = function () {
          var module = window.PulseModules && window.PulseModules.chat;
          if (module) resolve(module); else { chatScriptLoading = null; script.remove(); reject(new Error('chat module unavailable')); }
        };
        script.onerror = function () { chatScriptLoading = null; script.remove(); reject(new Error('chat module unavailable')); };
        document.head.appendChild(script);
      });
    }
    chatScriptLoading.then(function (module) {
      if (seq === viewSeq && parseHash().view === 'chat') { $('#view').innerHTML = ''; module.run(seq); }
    }).catch(function () {
      if (seq !== viewSeq || parseHash().view !== 'chat') return;
      var box = $('#view');
      clearCharts();
      box.innerHTML = '<div class="view-title">' + esc(t('nav.chat')) + '</div><div class="link-alert err" role="alert">' + esc(t('chat.loadError')) + '</div><button type="button" class="btn-secondary" id="chat-module-retry">' + esc(t('err.retry')) + '</button>';
      on($('#chat-module-retry'), 'click', function () { route(); });
    });
  }

  var dapScriptLoading = null;
  function loadDapModuleScript() {
    if (window.PulseModules && window.PulseModules.macronuxdam) {
      return Promise.resolve(window.PulseModules.macronuxdam);
    }
    if (dapScriptLoading) return dapScriptLoading;
    dapScriptLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/modules/macronuxdam.js';
      s.async = true;
      s.onload = function () {
        if (window.PulseModules && window.PulseModules.macronuxdam) {
          resolve(window.PulseModules.macronuxdam);
        } else {
          dapScriptLoading = null;
          reject(new Error('Модуль MacronuxDAM не инициализировался'));
        }
      };
      s.onerror = function () {
        dapScriptLoading = null;
        reject(new Error('Не удалось докачать клиентский модуль /modules/macronuxdam.js'));
      };
      document.head.appendChild(s);
    });
    return dapScriptLoading;
  }

  function syncDapNav() {
    var navBtn = $('#nav-dap');
    if (navBtn) navBtn.hidden = !(conf.dapEnabled && conf.dapInstalled);
  }

  function runDap(seq) {
    if (!conf.dapInstalled) {
      navigate('/overview');
      return;
    }
    if (!conf.dapEnabled) {
      var box = staticShell(
        '<div class="view-head">' +
        '  <div>' +
        '    <h1 class="view-title">🧩 Модуль MacronuxDAM выключен</h1>' +
        '    <p class="view-sub">Поддержка Discord-бота MacronuxDAM вынесена из ядра панели в отдельный подключаемый и докачиваемый модуль.</p>' +
        '  </div>' +
        '</div>' +
        '<div class="panel" style="max-width:680px;margin:24px auto;text-align:center;padding:28px">' +
        '  <div style="font-size:36px;margin-bottom:10px">🤖</div>' +
        '  <div style="font-size:16px;font-weight:700;margin-bottom:8px">Модуль MacronuxDAM сейчас отключён</div>' +
        '  <p style="font-size:13px;color:var(--muted);margin-bottom:18px">' +
        '    Вы можете включить модуль в один клик или докачать бота MacronuxDAM напрямую с GitHub на свой сервер / VPS.' +
        '  </p>' +
        '  <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
        '    <button type="button" class="btn-primary" id="dap-off-enable">✅ Включить модуль MacronuxDAM</button>' +
        '    <button type="button" class="btn-secondary" id="dap-off-modmgr">🧩 Открыть менеджер модулей</button>' +
        '  </div>' +
        '</div>'
      );
      on($('#dap-off-modmgr', box), 'click', openModulesModal);
      on($('#dap-off-enable', box), 'click', function () {
        postJson('/api/dap/action', { type: 'set_enabled', enabled: true }).then(function (r) {
          if (r && r.ok) {
            conf.dapEnabled = true;
            syncDapNav();
            runDap(seq);
          }
        });
      });
      return;
    }

    var viewBox = $('#view');
    if (viewBox && !$('#dap-pane', viewBox)) {
      viewBox.innerHTML = '';
      viewBox.appendChild(skeleton('Загрузка подключаемого модуля MacronuxDAM…'));
    }
    loadDapModuleScript().then(function (mod) {
      if (seq !== viewSeq) return;
      mod.run(seq);
    }).catch(function (err) {
      var b = $('#view');
      if (b) {
        b.innerHTML = '<div class="panel" style="margin:20px;color:#fc8181">' +
          esc(err && err.message ? err.message : 'Ошибка загрузки модуля MacronuxDAM') + '</div>';
      }
    });
  }

  function openModulesModal() {
    openModal('🧩 Подключаемые и докачиваемые модули Pulse', function (body, hide) {
      body.innerHTML = '<div class="empty">Загрузка состояния модулей…</div>';
      j('/api/dap/module').then(function (st) {
        if (!st || st.__networkError) {
          body.innerHTML = '<div class="link-alert err">Не удалось получить статус модулей.</div>';
          return;
        }
        var enabled = !!st.enabled;
        var installed = !!st.installed;
        var dbExists = !!st.dbExists;
        var running = !!(st.process && st.process.running);
        conf.dapEnabled = enabled;
        conf.dapInstalled = installed;
        syncDapNav();

        body.innerHTML =
          '<div style="display:flex;flex-direction:column;gap:14px">' +
          '  <div style="font-size:12.5px;color:var(--muted);line-height:1.5">' +
          '    Дополнительные интеграции вынесены из основной панели в отдельные модули. По умолчанию они скрыты и не нагружают интерфейс, пока вы их не включите или не докачаете.' +
          '  </div>' +
          '  <div class="panel" style="background:var(--inset);padding:16px;display:flex;flex-direction:column;gap:12px">' +
          '    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
          '      <div>' +
          '        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '          <span style="font-size:15px;font-weight:700">🛡️ MacronuxDAM (Discord AI AutoMod)</span>' +
          '          <span class="dap-badge ' + (enabled ? 'llm' : 'regex') + '">' + (enabled ? 'ВКЛЮЧЁН' : 'ВЫКЛЮЧЕН') + '</span>' +
          '          <span class="dap-badge ' + (installed ? 'automod' : 'user_report') + '">' + (installed ? 'ФАЙЛЫ УСТАНОВЛЕНЫ' : 'НЕ СКАЧАН') + '</span>' +
          (running ? '<span class="dap-badge llm">🟢 РАБОТАЕТ (PID ' + esc(String(st.process.pid)) + ')</span>' : '') +
          '        </div>' +
          '        <div style="font-size:12px;color:var(--muted);margin-top:4px">' +
          '          Поддержка Discord-бота автомодерации (ИИ-фильтр, банворды, правила, вердикты, запуск процесса и автопоиск на VPS).' +
          '        </div>' +
          '      </div>' +
          '      <div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '        <button type="button" class="' + (enabled ? 'btn-secondary' : 'btn-primary') + '" id="mod-dap-toggle"' + (!enabled && !installed ? ' disabled title="Сначала установите или найдите бота"' : '') + '>' +
          (enabled ? '🔌 Выключить модуль' : installed ? '✅ Включить модуль' : 'Сначала установите бота') +
          '        </button>' +
          (enabled && installed ? '<button type="button" class="btn-primary" id="mod-dap-open">Открыть MacronuxDAM →</button>' : '') +
          '      </div>' +
          '    </div>' +
          '    <div style="font-size:12px;padding:10px 12px;border-radius:8px;background:rgba(0,0,0,.18);display:grid;grid-template-columns:125px 1fr;gap:5px 10px">' +
          '      <span style="color:var(--muted)">Файлы бота:</span>' +
          '      <span>' + (installed ? '✅ Найдены' : '⚠️ Не установлены') + (dbExists ? (' · БД modbot.db (' + fmt(st.dbSizeKb || 0) + ' КБ)') : ' · БД ещё не создана') + '</span>' +
          '      <span style="color:var(--muted)">Папка (botDir):</span>' +
          '      <code style="word-break:break-all">' + esc(st.botDir || 'plugins/pulse/modules/MacronuxDAM') + '</code>' +
          '      <span style="color:var(--muted)">Репозиторий:</span>' +
          '      <code style="word-break:break-all">' + esc(st.repoUrl || 'https://github.com/Meneleet-official/MacronuxDAM') + '</code>' +
          '    </div>' +
          '    <div style="border-top:1px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:8px">' +
          '      <div style="font-size:12.5px;font-weight:600">📥 Докачать бота MacronuxDAM отдельно (GitHub) или найти на VPS</div>' +
          '      <div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '        <input type="text" class="inp" id="mod-dap-target" value="' + esc(st.botDir || '') + '" placeholder="Путь установки (оставьте пустым для plugins/pulse/modules/MacronuxDAM)" style="flex:1;min-width:220px">' +
          '        <button type="button" class="btn-primary" id="mod-dap-download">📥 Докачать из GitHub</button>' +
          '        <button type="button" class="btn-secondary" id="mod-dap-discover">🔍 Найти на VPS</button>' +
          '      </div>' +
          '      <div style="font-size:11px;color:var(--muted)">Команда в игре/консоли: <code>/pulse module macronuxdam &lt;enable|disable|download|discover&gt;</code></div>' +
          '      <div id="mod-dap-msg" style="font-size:12.5px;min-height:18px"></div>' +
          '    </div>' +
          '  </div>' +
          '</div>';

        var msgEl = $('#mod-dap-msg', body);
        function showMsg(txt, ok) {
          if (!msgEl) return;
          msgEl.style.color = ok ? '#5ce6a8' : '#fc8181';
          msgEl.textContent = txt;
        }

        on($('#mod-dap-toggle', body), 'click', function () {
          var next = !enabled;
          var btn = $('#mod-dap-toggle', body);
          btn.disabled = true;
          postJson('/api/dap/action', { type: 'set_enabled', enabled: next }).then(function (r) {
            btn.disabled = false;
            if (r && r.ok) {
              conf.dapEnabled = !!r.enabled;
              conf.dapInstalled = !!r.installed;
              syncDapNav();
              if (!conf.dapEnabled && parseHash().view === 'dap') {
                navigate('/overview');
              }
              if (hide) hide();
              openModulesModal();
            } else {
              showMsg((r && r.error) || 'Не удалось изменить состояние модуля', false);
            }
          });
        });

        if ($('#mod-dap-open', body)) {
          on($('#mod-dap-open', body), 'click', function () {
            if (hide) hide();
            navigate('/dap');
          });
        }

        on($('#mod-dap-download', body), 'click', function () {
          var btn = $('#mod-dap-download', body);
          var target = ($('#mod-dap-target', body).value || '').trim();
          btn.disabled = true;
          showMsg('⏳ Скачивание MacronuxDAM из GitHub (git clone / ZIP) и создание modbot.db…', true);
          postJson('/api/dap/action', { type: 'download_bot', targetDir: target }).then(function (r) {
            btn.disabled = false;
            if (r && r.ok) {
              conf.dapEnabled = true;
              conf.dapInstalled = !!r.installed;
              syncDapNav();
              showMsg('✅ ' + (r.message || 'MacronuxDAM успешно докачан и включён!'), true);
              setTimeout(function () {
                if (hide) hide();
                openModulesModal();
              }, 800);
            } else {
              showMsg('❌ ' + ((r && r.error) || 'Ошибка скачивания'), false);
            }
          });
        });

        on($('#mod-dap-discover', body), 'click', function () {
          var btn = $('#mod-dap-discover', body);
          var target = ($('#mod-dap-target', body).value || '').trim();
          btn.disabled = true;
          showMsg('⏳ Поиск установленного MacronuxDAM на VPS / сервере…', true);
          postJson('/api/dap/action', { type: 'discover', searchRoot: target, autoApply: true }).then(function (r) {
            btn.disabled = false;
            if (r && r.ok) {
              var cands = r.candidates || [];
              if (r.autoApplied || cands.length > 0) {
                postJson('/api/dap/action', { type: 'set_enabled', enabled: true }).then(function (enabledResult) {
                  if (!enabledResult || !enabledResult.ok) {
                    showMsg((enabledResult && enabledResult.error) || 'Не удалось включить модуль', false);
                    return;
                  }
                  conf.dapEnabled = !!enabledResult.enabled;
                  conf.dapInstalled = !!enabledResult.installed;
                  syncDapNav();
                  if (hide) hide();
                  openModulesModal();
                });
              } else {
                showMsg('⚠️ Установленный бот не найден на диске. Нажмите «📥 Докачать из GitHub» выше.', false);
              }
            } else {
              showMsg('❌ ' + ((r && r.error) || 'Ошибка поиска'), false);
            }
          });
        });
      });
    }, 'modal-wide');
  }

  /* ───────────────────────── Выбор языка ───────────────────────── */
  function openLangModal() {
    openModal(t('side.langTitle'), function (body, hide) {
      var grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;padding:4px 0';
      var cur = I18N.lang();
      (I18N.langs || []).forEach(function (l) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pchip';
        if (l.code === cur) b.style.borderColor = 'var(--accent-a)';
        var badge = document.createElement('span');
        badge.style.cssText = 'font-size:12px;font-weight:700;padding:4px 6px;border-radius:6px;background:var(--inset);color:var(--accent-b)';
        badge.textContent = l.short || l.code.toUpperCase();
        var main = document.createElement('div');
        main.className = 'pc-main';
        var nm = document.createElement('div');
        nm.className = 'pc-name';
        nm.textContent = l.name;
        var mt = document.createElement('div');
        mt.className = 'pc-meta';
        mt.textContent = l.bcp47 || l.code;
        main.appendChild(nm);
        main.appendChild(mt);
        b.appendChild(badge);
        b.appendChild(main);
        b.addEventListener('click', function () {
          I18N.setLang(l.code);
          I18N.applyDom(document);
          paintThemeUi();
          renderBrand();
          renderServers();
          refreshStatus(0);
          if (hide) hide();
          route();
        });
        grid.appendChild(b);
      });
      body.appendChild(grid);
    });
  }

  /* ───────────────────────── Инициализация ───────────────────────── */
  function bindStatic() {
    if ($('#link-panels-btn')) {
      $('#link-panels-btn').addEventListener('click', function () {
        openLinkModal(conf.servers && conf.servers.length ? 'list' : 'add');
      });
    }
    if ($('#modules-btn')) {
      $('#modules-btn').addEventListener('click', openModulesModal);
    }
    if ($('#lang-btn')) {
      $('#lang-btn').addEventListener('click', openLangModal);
    }
    $('#burger-btn').addEventListener('click', function () {
      var sb = $('.sidebar');
      sb.classList.toggle('open');
      $('#drawer-overlay').hidden = !sb.classList.contains('open');
    });
    $('#drawer-overlay').addEventListener('click', function () {
      $('.sidebar').classList.remove('open');
      $('#drawer-overlay').hidden = true;
    });
    $$('.nav-link').forEach(function (b) {
      b.addEventListener('click', function () { navigate(b.dataset.route); });
    });
    $('#period').addEventListener('click', function (e) {
      var b = e.target.closest('.seg-btn');
      if (!b || b.disabled) return;
      if (b.dataset.period === 'custom') { openPeriodRangeModal(); return; }
      store.set('period', b.dataset.period);
      renderPeriod();
      route();
    });
    on($('#refresh-btn'), 'click', function () {
      if (manualRefresh) return;
      manualRefresh = true;
      paintFreshness();
      refreshStatus(0);
      route(true);
      setTimeout(function () {
        if (manualRefresh) { manualRefresh = false; paintFreshness(); }
      }, 15000);
    });

    var gs = $('#gsearch-input');
    gs.addEventListener('input', debounce(showSearch, 180));
    gs.addEventListener('focus', showSearch);
    gs.addEventListener('keydown', function (e) {
      var items = $$('#gsearch-res .sr-item');
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); searchIdx = Math.min(searchIdx + 1, items.length - 1); paintSearchFocus(); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); searchIdx = Math.max(searchIdx - 1, 0); paintSearchFocus(); }
      else if (e.key === 'Enter' && searchItems.length) {
        e.preventDefault();
        var item = searchItems[searchIdx] || searchItems[0];
        hideSearch(); gs.value = '';
        navigate('/player/' + encodeURIComponent(item.name));
      } else if (e.key === 'Escape') { hideSearch(); gs.blur(); }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search')) hideSearch();
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); openSearch();
      } else if (e.key === '/' && !$('.login-modal:not([hidden])') && !e.target.closest('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault(); openSearch();
      }
    });

    $('#theme-btn').addEventListener('click', function () {
      var cur = store.get('theme', 'dark');
      var next = cur === 'dark' ? 'light' : 'dark';
      store.set('theme', next);
      document.documentElement.setAttribute('data-theme', next);
      paintThemeUi();
      route();
    });
    $('#tz-btn').addEventListener('click', function () {
      var cur = store.get('tz', 'server');
      store.set('tz', cur === 'server' ? 'local' : 'server');
      paintThemeUi();
      route();
    });
  }
  function paintThemeUi() {
    var theme = store.get('theme', 'dark');
    $('#theme-label').textContent = theme === 'dark' ? t('side.themeDark') : t('side.themeLight');
    $('#tz-label').textContent = store.get('tz', 'server') === 'server' ? t('side.tzServer') : t('side.tzLocal');
    if ($('#lang-label')) {
      var info = I18N.langInfo ? I18N.langInfo() : null;
      $('#lang-label').textContent = info ? (info.name + ' (' + (info.short || info.code.toUpperCase()) + ')') : I18N.lang().toUpperCase();
    }
  }

  var SSE = null;
  var sseActive = false;
  var lastSseEventAt = 0;
  var refreshTimer = null;
  function startRefresh() {
    if (SSE) { try { SSE.close(); } catch (e) { } SSE = null; }
    sseActive = false;
    lastSseEventAt = 0;
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (activeServer === 'local') {
      try {
        SSE = new EventSource('/api/events');
        SSE.onopen = function () { sseActive = true; };
        SSE.addEventListener('refresh', function () { sseActive = true; lastSseEventAt = Date.now(); refreshStatus(0); route(true); });
        SSE.onerror = function () { sseActive = false; };
      } catch (e) { sseActive = false; }
    }
    refreshTimer = setInterval(function () {
      paintFreshness();
      if (sseActive && activeServer === 'local' && lastSseEventAt && Date.now() - lastSseEventAt < Math.max(60, (conf.refresh || 60) * 2) * 1000) return;
      if (sseActive && activeServer === 'local') sseActive = false;
      refreshStatus(0);
      route(true);
    }, Math.max(30, conf.refresh || 60) * 1000);
  }

  function applyMeta(m) {
    conf.src = m.src || 'crafatar';
    conf.days = m.days || 30;
    conf.refresh = m.refresh || 60;
    conf.servers = m.servers || [];
    if (activeServer !== 'local'
        && !(activeServer === '_all' && conf.servers.length)
        && !conf.servers.some(function (s) { return (s.name || s) === activeServer; })) {
      setActiveServer('local');
    }
    conf.version = m.version || '';
    conf.serverName = m.serverName || '';
    conf.zone = m.zone || undefined;
    conf.env = m.env || null;
    conf.dapEnabled = !!m.dapEnabled;
    conf.dapInstalled = !!m.dapInstalled;
    syncDapNav();
    if (m.defaultLang) {
      I18N.applyServerDefault(m.defaultLang);
      I18N.applyDom(document);
      paintThemeUi();
    }
  }

  function boot() {
    if (window.Chart) {
      Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font') || 'Segoe UI';
      Chart.defaults.color = '#9aa4ba';
      Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
    }
    var theme = store.get('theme', 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    I18N.applyDom(document);
    paintThemeUi();
    bindStatic();
    renderPeriod();
    paintFreshness();

    fetch('/api/meta').then(function (r) { return r.json(); }).then(function (m) {
      applyMeta(m);
      renderBrand();
      renderServers();
    }).catch(function () {
      $('#ping-label').textContent = t('ping.noServer');
      $('#status-text').textContent = '';
    }).finally(function () {
      window.addEventListener('hashchange', route);
      route();
      refreshStatus(0);
      startRefresh();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
