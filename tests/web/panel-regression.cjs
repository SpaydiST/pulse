'use strict';

// Browser regression checks for the static Pulse panel. The server below only
// serves the checked-out web assets; all /api responses are deterministic
// fixtures, so no Minecraft server or network service is involved.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const { chromium } = require(process.env.PULSE_PLAYWRIGHT || 'playwright');
const webRoot = path.resolve(__dirname, '../../src/main/resources/web');
const qaDir = path.resolve(__dirname, '../../build/panel-qa');
const port = 41763;
const origin = `http://127.0.0.1:${port}`;
const requests = [];
let fixture;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitUntil(predicate, message, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await wait(20);
  }
  assert.ok(predicate(), message);
}
const fmtDay = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const shiftDay = (iso, offset) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return fmtDay(date);
};

function newFixture() {
  return {
    online: { online: [{ name: 'Alex', uuid: 'fixture-uuid', ping: 32, world: 'world', onlineSeconds: 900 }], tps: [10], mspt: 70, uptimeSeconds: 3600 },
    delays: new Map(),
    httpFailures: new Set(),
    unsupportedPeriodServers: new Set(),
    periodResponses: new Map(),
    periods: {
      '24h': { players: 2, seconds: 5400, sessions: 2, newPlayers: 0 },
      '7d': { players: 7, seconds: 100000, sessions: 10, newPlayers: 2 },
      '30d': { players: 14, seconds: 400000, sessions: 30, newPlayers: 5 },
      all: { players: 42, seconds: 2000000, sessions: 250, newPlayers: 42 },
      custom: { players: 3, seconds: 20000, sessions: 4, newPlayers: 1 }
    },
    previous: {
      '24h': { players: 0, seconds: 0, sessions: 0, newPlayers: 0 },
      '7d': { players: 4, seconds: 90000, sessions: 8, newPlayers: 1 },
      '30d': { players: 0, seconds: 0, sessions: 0, newPlayers: 0 },
      custom: { players: 2, seconds: 16000, sessions: 3, newPlayers: 0 }
    }
  };
}

function activePeriodData(url) {
  const period = url.searchParams.get('period') || '7d';
  const current = fixture.periods[period] || fixture.periods['7d'];
  const previous = Object.prototype.hasOwnProperty.call(fixture.previous, period)
    ? fixture.previous[period]
    : null;
  const labels = Array.from({ length: period === '24h' ? 24 : 7 }, (_, i) => `L${i + 1}`);
  const values = (base) => labels.map((_, i) => Math.max(0, Math.round(base * (i + 1) / labels.length)));
  const today = fmtDay(new Date());
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  return {
    from: from ? Date.parse(`${from}T00:00:00+03:00`) : Date.now() - 7 * 86400000,
    to: to ? Date.parse(`${shiftDay(to, 1)}T00:00:00+03:00`) : Date.now(),
    zone: 'Europe/Moscow',
    generatedAt: Date.now(),
    comparisonAvailable: period !== 'all',
    current,
    previous,
    labels,
    seconds: values(current.seconds),
    sessions: values(current.sessions),
    players: values(current.players),
    avgSession: values(current.sessions).map((n) => n ? Math.round(current.seconds / n) : 0),
    kills: values(12),
    deaths: values(8),
    kd: values(1.5),
    daysList: labels.map(() => []),
    accounting: 'session-start',
    today
  };
}

function fixtureResponse(apiPath, url, serverName) {
  const period = url.searchParams.get('period') || '7d';
  const pData = activePeriodData(url);
  const online = serverName === 'alpha'
    ? { ...fixture.online, online: [{ name: 'RemotePlayer', uuid: 'remote-uuid', ping: 50, world: 'remote', onlineSeconds: 60 }] }
    : serverName === '_all'
      ? { ...fixture.online, online: [...fixture.online.online, { name: 'RemotePlayer', uuid: 'remote-uuid', ping: 50, world: 'remote', onlineSeconds: 60 }] }
    : fixture.online;
  switch (apiPath) {
    case '/api/meta':
      return { version: 'test', days: 30, refresh: 3600, servers: [{ name: 'alpha', display: 'Alpha', online: true, onlinePlayers: 1 }], serverName: 'Fixture', zone: 'Europe/Moscow', dapEnabled: false, dapInstalled: false };
    case '/api/servers':
      return { servers: [] };
    case '/api/online':
      return online;
    case '/api/summary':
      return { totalAccounts: 20, online: online.online.length, last24h: { players: 2, seconds: 5400 }, last7d: { players: 7, seconds: 100000 } };
    case '/api/period':
      if (fixture.unsupportedPeriodServers.has(serverName)) return { unsupported: true, error: 'Period data is unavailable for all servers', zone: 'Europe/Moscow', generatedAt: Date.now() };
      if (fixture.periodResponses.has(serverName)) return fixture.periodResponses.get(serverName);
      return pData;
    case '/api/activity': {
      const days = Math.max(1, Math.min(Number(url.searchParams.get('days')) || 7, 90));
      const labels = Array.from({ length: days }, (_, i) => `D${i + 1}`);
      return { labels, seconds: labels.map((_, i) => 3600 * (i + 1)), sessions: labels.map((_, i) => i + 1), players: labels.map((_, i) => i % 9), avgSession: labels.map(() => 600) };
    }
    case '/api/server-stats': {
      const labels = ['T-2', 'T-1', 'Now'];
      return { labels, tps: [19.7, 10, fixture.online.tps && fixture.online.tps[0] != null ? fixture.online.tps[0] : null], mspt: [48, 70, fixture.online.mspt], online: [1, 1, online.online.length], memory: [50, 55, 60], kills: [0, 1, 2], worldLoad: [1, 2, 3] };
    }
    case '/api/serverinfo':
      return { mspt: fixture.online.mspt, tps: fixture.online.tps && fixture.online.tps[0], uptimeSeconds: 3600 };
    case '/api/heatmap':
      return { grid: Array.from({ length: 7 }, () => Array(24).fill(0)), max: 0 };
    case '/api/heatmap/cell':
      return { players: [] };
    case '/api/recommend':
      return { bestWindows: [], maintenanceWindow: [] };
    case '/api/players': {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const rows = [{ rank: 1, name: 'Alex', uuid: 'fixture-uuid', seconds: 3600, sessions: 3, kills: 3, deaths: 1, kd: 3, firstJoin: Date.now() - 10000000, lastJoin: Date.now(), online: true }]
        .filter((r) => !q || r.name.toLowerCase().includes(q));
      return { rows, total: rows.length };
    }
    case '/api/activity/players':
      return { labels: ['D1'], daysList: [[]] };
    case '/api/kill-trend':
      return { labels: ['D1'], kills: [2], deaths: [1], kd: [2] };
    case '/api/growth':
    case '/api/peak':
      return { labels: ['D1'], values: [1], peak: 1 };
    case '/api/cohorts':
      return { maxWeeks: 0, rows: [] };
    case '/api/distribution':
      return { labels: [], values: [] };
    case '/api/session-hist':
      return { labels: [], counts: [] };
    case '/api/new-players':
      return { players: [] };
    case '/api/topkillers':
    case '/api/top':
      return { players: [] };
    case '/api/retention/players':
      return { players: [] };
    case '/api/deaths':
      return { deaths: [], hotspots: [] };
    case '/api/kpis':
      return { kills7: 3, deaths7: 1, killsToday: 1, deathsToday: 0, kdToday: 1, newPlayers7: 2, newPlayersTotal: 8, playtimeWeekHours: 12, online: online.online.length };
    case '/api/compare':
      return {};
    case '/api/player':
      return { name: 'Alex', uuid: 'fixture-uuid', seconds: 3600, sessions: 3, kills: 3, deaths: 1, kd: 3, firstJoin: Date.now() - 10000000, lastJoin: Date.now() };
    case '/api/player/sessions':
      return { sessions: [] };
    case '/api/combat':
      return { kills: [], deaths: [] };
    case '/api/player/heat':
      return { grid: [] };
    default:
      return {};
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, origin);
  const remote = url.pathname.match(/^\/api\/servers\/([^/]+)(\/api\/.*)$/);
  const apiPath = remote ? remote[2] : url.pathname;
  const serverName = remote ? decodeURIComponent(remote[1]) : 'local';
  if (apiPath.startsWith('/api/')) {
    const entry = { path: apiPath, url: req.url, server: serverName, method: req.method, at: Date.now() };
    requests.push(entry);
    if (apiPath === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': fixture connected\n\n');
      req.on('close', () => {});
      return;
    }
    const delay = fixture.delays.get(apiPath) || 0;
    if (delay) await wait(delay);
    if (fixture.httpFailures.has(apiPath)) {
      entry.status = 503;
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'fixture service unavailable' }));
      return;
    }
    const body = fixtureResponse(apiPath, url, serverName);
    entry.status = 200;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
    return;
  }

  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(webRoot, relative);
  if (!file.startsWith(webRoot + path.sep) && file !== path.join(webRoot, 'index.html')) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

function periodRequests() {
  return requests.filter((r) => r.path === '/api/period');
}

async function loadApp(browser, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, timezoneId: 'Europe/Moscow' });
  const page = await context.newPage();
  await page.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) => route.abort());
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('#refresh-btn').waitFor({ state: 'visible', timeout: 10000 });
  return { context, page };
}

async function openPage(browser, viewport = { width: 1280, height: 900 }) {
  const { context, page } = await loadApp(browser, viewport);
  await page.locator('#k2-v').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => {
    const kpi = document.querySelector('#k2-v');
    return kpi && kpi.textContent.trim() && !/^—$/.test(kpi.textContent.trim());
  }, null, { timeout: 10000 }).catch(() => {});
  return { context, page };
}

async function clickPeriod(page, value) {
  const before = periodRequests().length;
  await page.locator(`#period [data-period="${value}"]`).click();
  await page.waitForFunction((n) => {
    const active = document.querySelector('#period .seg-btn.active');
    return active && active.dataset.period === n;
  }, value);
  await waitUntil(
    () => periodRequests().slice(before).some((r) => new URL(r.url, origin).searchParams.get('period') === value),
    `selecting ${value} did not request period data`
  );
}

async function run() {
  const failures = [];
  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });

  test('rolling period changes KPI and refetches period-backed chart data', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      fs.mkdirSync(qaDir, { recursive: true });
      await page.screenshot({ path: path.join(qaDir, 'overview-desktop.png'), fullPage: true });
      const initialKpi = (await page.locator('#k2-v').innerText()).trim();
      await clickPeriod(page, '30d');
      await page.waitForFunction(() => document.querySelector('#k2-v')?.textContent.includes('14'), null, { timeout: 3000 });
      const nextKpi = (await page.locator('#k2-v').innerText()).trim();
      assert.notEqual(nextKpi, initialKpi, `selected-period KPI did not change (${initialKpi})`);
      assert.ok(periodRequests().some((r) => new URL(r.url, origin).searchParams.get('period') === '30d'), '30d did not request period-backed chart/KPI data');
      const chartData = await page.evaluate(() => window.Chart && window.Chart.getChart('ov-act') && window.Chart.getChart('ov-act').data.datasets[0].data);
      assert.ok(Array.isArray(chartData) && chartData.length > 0, 'activity chart did not render period data');
    } finally { await context.close(); }
  });

  test('all-time selection requests the true all period rather than a 90-day window', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      await clickPeriod(page, 'all');
      await page.waitForFunction(() => document.querySelector('#k2-v')?.textContent.includes('42'), null, { timeout: 3000 });
      assert.ok(periodRequests().some((r) => new URL(r.url, origin).searchParams.get('period') === 'all'), 'missing /api/period?period=all request');
      assert.ok(!requests.some((r) => r.path === '/api/activity' && new URL(r.url, origin).searchParams.get('days') === '90'), 'all-time view was reduced to days=90');
      assert.match((await page.locator('#k2-v').innerText()).trim(), /42/, 'all-time KPI did not use all-time fixture data');
    } finally { await context.close(); }
  });

  test('unsupported all-server period keeps live players visible and explains the unavailable chart', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    fixture.unsupportedPeriodServers.add('_all');
    const { context, page } = await openPage(browser);
    try {
      await page.locator('#srv-list .srv-pill').filter({ hasText: 'Все серверы' }).click();
      await waitUntil(() => requests.some((r) => r.server === '_all' && r.path === '/api/period'), 'all-server period request was not made');
      await page.waitForFunction(() => {
        const warning = document.querySelector('#ov-period-error');
        const online = document.querySelector('#ov-online');
        return warning && !warning.hidden && online && online.textContent.includes('Alex');
      }, null, { timeout: 4000 });
      const warning = (await page.locator('#ov-period-error').innerText()).trim();
      assert.match(warning, /Period data is unavailable for all servers/, 'period chart warning should explain the unsupported aggregate');
      assert.match((await page.locator('#k1-v').innerText()).trim(), /2/, 'live online count was hidden with the unsupported period data');
      assert.match(await page.locator('#ov-online').innerText(), /Alex/);
      assert.match(await page.locator('#ov-online').innerText(), /RemotePlayer/);
      assert.equal((await page.locator('#k2-v').innerText()).trim(), '—', 'unavailable period KPI should not show fabricated data');
      assert.ok(!(await page.locator('#freshness-text').evaluate((e) => e.classList.contains('stale'))), 'explicitly unsupported aggregate should count as a successful partial response');
      const chartExists = await page.evaluate(() => !!(window.Chart && window.Chart.getChart('ov-act')));
      assert.equal(chartExists, false, 'period chart should stay empty when aggregate data is unavailable');
    } finally { await context.close(); }
  });

  test('custom date dialog rejects reversed and future ranges, then applies inclusive selected dates', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      const today = await page.evaluate(() => {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
        return `${p.year}-${p.month}-${p.day}`;
      });
      const yesterday = shiftDay(today, -1);
      const tomorrow = shiftDay(today, 1);
      const before = periodRequests().length;
      await page.locator('#period [data-period="custom"]').click();
      const form = page.locator('.period-form');
      await form.waitFor({ state: 'visible', timeout: 3000 });
      const dates = form.locator('input[type="date"]');
      assert.equal(await dates.count(), 2, 'custom period should expose two date fields');
      const apply = form.locator('button[type="submit"]');
      await dates.nth(0).fill(today);
      await dates.nth(1).fill(yesterday);
      await apply.click();
      await page.locator('.period-form-error').waitFor({ state: 'visible', timeout: 2000 });
      assert.equal(periodRequests().length, before, 'reversed range reached the API');

      await dates.nth(0).fill(tomorrow);
      await dates.nth(1).fill(tomorrow);
      await apply.click();
      const futureFeedback = await page.locator('.period-form-error').innerText().catch(() => '');
      const nativeInvalid = await dates.evaluateAll((els) => els.some((el) => !el.checkValidity()));
      assert.ok(futureFeedback.trim() || nativeInvalid, 'future range should show app or browser validation feedback');
      assert.equal(periodRequests().length, before, 'future range reached the API');

      await dates.nth(0).fill(yesterday);
      await dates.nth(1).fill(today);
      await apply.click();
      await waitUntil(() => periodRequests().length > before, 'valid custom range was not requested');
      const custom = periodRequests().map((r) => new URL(r.url, origin)).find((u) => u.searchParams.get('period') === 'custom');
      assert.ok(custom, 'valid custom range was not requested');
      assert.equal(custom.searchParams.get('from'), yesterday, 'custom start date was not sent');
      assert.equal(custom.searchParams.get('to'), today, 'custom end date was not sent');
    } finally { await context.close(); }
  });

  test('zero comparison baseline never renders Infinity, NaN, or infinite percent', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    fixture.periods['30d'].players = 5;
    fixture.previous['30d'].players = 0;
    const { context, page } = await openPage(browser);
    try {
      await clickPeriod(page, '30d');
      await page.waitForFunction(() => document.querySelector('#k2-v')?.textContent.includes('5'), null, { timeout: 3000 });
      const deltaText = await page.locator('#k2-f .period-delta').allInnerTexts();
      assert.ok(deltaText.length, 'period comparison was not rendered');
      assert.ok(!/Infinity|NaN|∞|%/i.test(deltaText.join(' ')), `non-finite zero-baseline delta: ${deltaText.join(' ')}`);
    } finally { await context.close(); }
  });

  test('overview uses actual MSPT and represents missing TPS as unavailable', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    fixture.online.tps = [10]; fixture.online.mspt = 70;
    const { context, page } = await openPage(browser);
    try {
      const healthyValue = (await page.locator('#k4-v').innerText()).replace(/\s+/g, ' ').trim();
      assert.match(healthyValue, /10(?:\.0)?/, `expected TPS=10 in KPI, got ${healthyValue}`);
      assert.match(healthyValue, /70\s*ms/i, `expected actual MSPT=70ms, got ${healthyValue}`);
      assert.doesNotMatch(healthyValue, /100\s*ms/i, 'KPI appears to show 1000/TPS as MSPT');

      fixture.online.tps = [null]; fixture.online.mspt = null;
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => {
        const text = document.querySelector('#k4-v')?.textContent || '';
        return /—|unavailable|недоступ/i.test(text);
      }, null, { timeout: 3000 });
      const unavailable = (await page.locator('#k4-v').innerText()).replace(/\s+/g, ' ').trim();
      assert.doesNotMatch(unavailable, /20(?:\.0)?/, `missing TPS was replaced by a fabricated value: ${unavailable}`);
    } finally { await context.close(); }
  });

  test('HTTP and network refresh failures mark the data stale and keep refresh usable', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      const initialCount = requests.length;
      await page.locator('#refresh-btn').click();
      await wait(120);
      assert.ok(requests.length > initialCount, 'manual refresh did not issue requests');

      fixture.httpFailures.add('/api/period');
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => {
        const freshness = document.querySelector('.freshness');
        const text = `${freshness?.textContent || ''} ${freshness?.className || ''}`;
        return /stale|error|устар|ошиб|связ|не удалось/i.test(text);
      }, null, { timeout: 3000 });
      fixture.httpFailures.delete('/api/period');

      let abortNext = true;
      await page.route('**/api/period?*', async (route) => {
        if (abortNext) { abortNext = false; await route.abort(); }
        else await route.continue();
      });
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => {
        const freshness = document.querySelector('.freshness');
        return /stale|error|устар|ошиб|связ|не удалось/i.test(`${freshness?.textContent || ''} ${freshness?.className || ''}`);
      }, null, { timeout: 3000 });
      assert.equal(abortNext, false, 'network-failure route did not intercept the period request');
    } finally { await context.close(); }
  });

  test('period network failure shows unavailable KPI values instead of zero', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      let aborted = false;
      await page.route('**/api/period?*', async (route) => {
        if (!aborted) { aborted = true; await route.abort(); }
        else await route.continue();
      });
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => {
        const warning = document.querySelector('#ov-period-error');
        const players = document.querySelector('#k2-v')?.textContent.trim();
        const playtime = document.querySelector('#k3-v')?.textContent.trim();
        return warning && !warning.hidden && /—|unavailable|недоступ/i.test(players) && /—|unavailable|недоступ/i.test(playtime);
      }, null, { timeout: 4000 });
      assert.ok(aborted, 'the period request was not failed at the network layer');
      assert.ok(await page.locator('#freshness-text').evaluate((e) => e.classList.contains('stale')), 'network failure did not leave the data stale');
      assert.doesNotMatch((await page.locator('#k2-v').innerText()).trim(), /^0$/, 'network failure rendered zero players');
      assert.doesNotMatch((await page.locator('#k3-v').innerText()).trim(), /^0/, 'network failure rendered zero playtime');
    } finally { await context.close(); }
  });

  test('HTTP 200 period error without unsupported flag leaves stale data and unavailable KPIs', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      fixture.periodResponses.set('local', { error: 'database unavailable', zone: 'Europe/Moscow' });
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => {
        const warning = document.querySelector('#ov-period-error');
        return warning && !warning.hidden && warning.textContent.includes('database unavailable');
      }, null, { timeout: 4000 });
      assert.ok(requests.some((r) => r.path === '/api/period' && r.server === 'local' && r.status === 200), 'period error fixture was not an HTTP 200 payload');
      assert.ok(await page.locator('#freshness-text').evaluate((e) => e.classList.contains('stale')), 'ordinary API error payload was treated as fresh partial data');
      assert.match((await page.locator('#k2-v').innerText()).trim(), /—|unavailable|недоступ/i, 'period player KPI should be unavailable');
      assert.match((await page.locator('#k3-v').innerText()).trim(), /—|unavailable|недоступ/i, 'period playtime KPI should be unavailable');
    } finally { await context.close(); }
  });

  test('malformed HTTP 200 period payload leaves stale data and unavailable KPIs', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      fixture.periodResponses.set('local', {});
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => {
        const warning = document.querySelector('#ov-period-error');
        return warning && !warning.hidden;
      }, null, { timeout: 4000 });
      assert.ok(requests.some((r) => r.path === '/api/period' && r.server === 'local' && r.status === 200), 'malformed period fixture was not an HTTP 200 payload');
      assert.ok(await page.locator('#freshness-text').evaluate((e) => e.classList.contains('stale')), 'malformed period payload was treated as fresh');
      assert.match((await page.locator('#k2-v').innerText()).trim(), /—|unavailable|недоступ/i, 'malformed period payload should leave player KPI unavailable');
      assert.match((await page.locator('#k3-v').innerText()).trim(), /—|unavailable|недоступ/i, 'malformed period payload should leave playtime KPI unavailable');
    } finally { await context.close(); }
  });

  test('a successful player search cannot clear stale state from a failed period batch', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      fixture.httpFailures.add('/api/period');
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => document.querySelector('#freshness-text')?.classList.contains('stale'), null, { timeout: 3000 });
      await page.locator('#gsearch-input').fill('Alex');
      await page.locator('.sr-item').waitFor({ state: 'visible', timeout: 3000 });
      assert.ok(await page.locator('#freshness-text').evaluate((e) => e.classList.contains('stale')), 'successful search incorrectly marked the failed dashboard batch fresh');
      assert.ok(requests.some((r) => r.path === '/api/players' && new URL(r.url, origin).searchParams.get('q') === 'Alex' && r.status === 200), 'fixture search did not succeed');
    } finally { await context.close(); }
  });

  test('online API failure leaves the error view marked stale despite other successful endpoints', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    fixture.httpFailures.add('/api/online');
    const { context, page } = await loadApp(browser);
    try {
      await page.locator('#view .link-alert').waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForFunction(() => document.querySelector('#freshness-text')?.classList.contains('stale'), null, { timeout: 3000 });
      assert.ok(requests.some((r) => r.path === '/api/period' && r.status === 200), 'period fixture did not succeed alongside the online failure');
      assert.ok(requests.some((r) => r.path === '/api/summary' && r.status === 200), 'summary fixture did not succeed alongside the online failure');
      assert.ok(requests.some((r) => r.path === '/api/online' && r.status === 503), 'online endpoint did not fail');
      assert.match(await page.locator('#freshness-text').innerText(), /устарели|stale/i, 'error view is presented as fresh');
    } finally { await context.close(); }
  });

  test('late data from a previous view/server cannot replace the current view', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    fixture.delays.set('/api/summary', 500);
    const { context, page } = await openPage(browser);
    try {
      // The first summary is held while we leave Overview; its late completion
      // must not draw into or route away from the Players view.
      await page.locator('[data-route="/players"]').click();
      await page.locator('#pl-q').waitFor({ state: 'visible' });
      await wait(600);
      assert.ok((await page.locator('#view').innerText()).includes('Alex') || await page.locator('#pl-q').isVisible(), 'late overview response replaced the player view');

      await page.locator('[data-route="/overview"]').click();
      await page.locator('#k2-v').waitFor({ state: 'visible' });
      fixture.delays.delete('/api/summary');
      const localRequestAt = requests.length;
      await page.locator('#srv-list .srv-pill').filter({ hasText: 'Alpha' }).click();
      assert.ok(requests.slice(localRequestAt).some((r) => r.server === 'alpha'), 'server selection did not request the remote server');
      await page.waitForFunction(() => document.querySelector('#ov-online')?.textContent.includes('RemotePlayer'), null, { timeout: 3000 });
    } finally { await context.close(); }
  });

  test('players search and active filter survive a manual background refresh', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser);
    try {
      await page.locator('[data-route="/players"]').click();
      await page.locator('#pl-q').fill('Alex');
      await page.waitForTimeout(350);
      await page.locator('#pl-chips [data-filter="online"]').click();
      await page.locator('#pl-q').waitFor({ state: 'visible' });
      await page.locator('#refresh-btn').click();
      await wait(180);
      assert.equal(await page.locator('#pl-q').inputValue(), 'Alex', 'search query was lost on refresh');
      assert.ok(await page.locator('#pl-chips [data-filter="online"]').evaluate((e) => e.classList.contains('active')), 'online filter was lost on refresh');
    } finally { await context.close(); }
  });

  test('390px overview, Players, Server and Analytics layouts do not overflow in dark or light themes', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser, { width: 390, height: 844 });
    try {
      for (const theme of ['dark', 'light']) {
        const currentTheme = await page.locator('html').getAttribute('data-theme');
        if (currentTheme !== theme) {
          await page.locator('#burger-btn').click();
          await page.locator('#theme-btn').click();
          await page.locator('#drawer-overlay').evaluate((e) => e.click());
          await wait(80);
        }
        for (const [route, marker] of [['/overview', '#k2-v'], ['/players', '#pl-q'], ['/server', '#ch-tps'], ['/analytics', '#an-act']]) {
          await page.evaluate((hash) => { location.hash = `#${hash}`; }, route);
          await page.locator(marker).waitFor({ state: 'attached', timeout: 5000 });
          await wait(100);
          if (route === '/overview') {
            await page.screenshot({ path: path.join(qaDir, 'overview-mobile-390.png'), fullPage: true });
            const periodReachability = await page.locator('#period').evaluate((period) => {
              period.scrollLeft = period.scrollWidth;
              const button = period.querySelector('[data-period="custom"]');
              const r = button.getBoundingClientRect(), p = period.getBoundingClientRect();
              return { visible: r.left >= p.left - 1 && r.right <= p.right + 1, scrollWidth: period.scrollWidth, clientWidth: period.clientWidth };
            });
            assert.ok(periodReachability.visible, `custom-period control is clipped at 390px: ${JSON.stringify(periodReachability)}`);
            const clippedOverviewControls = await page.evaluate(() => Array.from(document.querySelectorAll('#ov-act-seg .seg-btn')).filter((button) => {
              const p = button.closest('.panel').getBoundingClientRect();
              const b = button.getBoundingClientRect();
              return b.left < p.left - 1 || b.right > p.right + 1;
            }).map((button) => button.textContent.trim()));
            assert.equal(clippedOverviewControls.length, 0, `overview chart controls clipped by panel: ${clippedOverviewControls.join(', ')}`);
          }
          if (route === '/analytics') {
            await page.screenshot({ path: path.join(qaDir, 'analytics-mobile-390.png'), fullPage: true });
            const clippedAnalyticsControls = await page.evaluate(() => Array.from(document.querySelectorAll('#an-type .seg-btn')).filter((button) => {
              const p = button.closest('.panel').getBoundingClientRect();
              const b = button.getBoundingClientRect();
              return b.left < p.left - 1 || b.right > p.right + 1;
            }).map((button) => button.textContent.trim()));
            assert.equal(clippedAnalyticsControls.length, 0, `analytics period controls clipped by panel: ${clippedAnalyticsControls.join(', ')}`);
          }
          const overflow = await page.evaluate(() => ({
            doc: document.documentElement.scrollWidth,
            viewport: document.documentElement.clientWidth,
            body: document.body.scrollWidth
          }));
          assert.ok(overflow.doc <= overflow.viewport, `${theme} ${route} horizontal document overflow: ${JSON.stringify(overflow)}`);
        }
      }
    } finally { await context.close(); }
  });

  test('visible topbar children stay inside the header at 1280px, 1440px and 390px', async (browser) => {
    fixture = newFixture(); requests.length = 0;
    const { context, page } = await openPage(browser, { width: 1280, height: 900 });
    try {
      for (const width of [1280, 1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await wait(80);
        const result = await page.evaluate(() => {
          const header = document.querySelector('.topbar');
          const hr = header.getBoundingClientRect();
          const children = Array.from(header.children).filter((el) => {
            const style = getComputedStyle(el);
            return !el.hidden && style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
          });
          return {
            header: { left: hr.left, right: hr.right, top: hr.top, bottom: hr.bottom },
            outside: children.map((el) => {
              const r = el.getBoundingClientRect();
              return { name: el.id || el.className || el.tagName, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            }).filter((r) => r.left < hr.left - 1 || r.right > hr.right + 1 || r.top < hr.top - 1 || r.bottom > hr.bottom + 1)
          };
        });
        assert.equal(result.outside.length, 0, `${width}px topbar children escape header bounds: ${JSON.stringify(result)}`);
      }
    } finally { await context.close(); }
  });

  const browser = await chromium.launch({ headless: true, executablePath: process.env.PULSE_BROWSER || undefined });
  for (const entry of tests) {
    try {
      await entry.fn(browser);
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      failures.push({ name: entry.name, error });
      console.error(`FAIL ${entry.name}\n${error.stack || error}`);
    }
  }
  await browser.close();
  console.log(`\n${tests.length - failures.length}/${tests.length} browser regression checks passed`);
  if (failures.length) process.exitCode = 1;
}

server.listen(port, '127.0.0.1', async () => {
  try {
    await run();
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
