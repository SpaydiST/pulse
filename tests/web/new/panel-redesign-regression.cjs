'use strict';

// Browser regression checks for the Minecraft chat and MacronuxDAM redesign.
// The localhost server below is the only API target. Fixtures never contact a
// Minecraft server, Discord, or a running bot.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PULSE_PLAYWRIGHT || 'playwright');

const webRoot = path.resolve(__dirname, '../../../src/main/resources/web');
const qaDir = path.resolve(__dirname, '../../../build/panel-qa/redesign');
const port = Number(process.env.PULSE_TEST_PORT || 41764);
const origin = `http://127.0.0.1:${port}`;
const requests = [];
let fixture;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitUntil(predicate, message, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await wait(25);
  }
  assert.ok(await predicate(), message);
}

function makeChatMessage(id, name, text, source = 'player', time = Date.now() - (300 - id) * 1000) {
  return { id, time, uuid: source === 'player' ? `uuid-${name}` : null, name, text, source };
}

function newFixture() {
  return {
    dap: {
      dbExists: true,
      enabled: true,
      guilds: [{ guildId: 'guild-1', guildName: 'Test Guild', memberCount: 42, violationsCount: 3 }, { guildId: 'guild-2', guildName: 'Second Guild', memberCount: 18, violationsCount: 1 }],
      violations: [
        { id: 1, guildId: 'guild-1', userId: 'user-1', userName: 'Raven', userDisplayName: 'Raven', originalText: 'rude test message', translatedText: '', action: 'pending', method: 'llm', ruleId: '4.1', ruleTitle: 'Оскорбления', channelName: 'general', channelId: 'ch-1', createdAt: new Date(Date.now() - 60000).toISOString(), jumpUrl: 'https://discord.com/channels/guild-1/ch-1/1' },
        { id: 2, guildId: 'guild-1', userId: 'user-2', userName: 'Sparrow', userDisplayName: 'Sparrow', originalText: 'a resolved test message', translatedText: '', action: 'dismissed', method: 'regex', ruleId: '4.2', ruleTitle: 'Спам', channelName: 'general', channelId: 'ch-1', createdAt: new Date(Date.now() - 120000).toISOString() },
        { id: 3, guildId: 'guild-2', userId: 'user-3', userName: 'Owl', userDisplayName: 'Owl', originalText: 'second guild case', translatedText: '', action: 'pending', method: 'user_report', ruleId: '4.1', ruleTitle: 'Оскорбления', channelName: 'reports', channelId: 'ch-2', createdAt: new Date(Date.now() - 180000).toISOString() }
      ],
      actions: [
        { id: 71, guildId: 'guild-1', userId: 'user-1', displayName: 'Raven', action: 'timeout', durationSeconds: 3600, reason: 'Queued moderation test', status: 'pending', createdAt: new Date(Date.now() - 60000).toISOString() },
        { id: 72, guildId: 'guild-1', userId: 'user-2', displayName: 'Sparrow', action: 'warn', reason: 'Applied moderation test', status: 'applied', resultMessage: 'Applied by fixture', createdAt: new Date(Date.now() - 120000).toISOString() },
        { id: 73, guildId: 'guild-1', userId: 'user-3', displayName: 'Owl', action: 'ban', reason: 'Failed moderation test', status: 'failed', resultMessage: 'Fixture failure', createdAt: new Date(Date.now() - 180000).toISOString() }
      ],
      logs: [
        { t: new Date(Date.now() - 60000).toISOString(), event: 'violation_detected', user_id: 'user-1', rule_id: '4.1', text: 'fixture log alpha' },
        { t: new Date(Date.now() - 120000).toISOString(), event: 'decision', action: 'dismiss', user_id: 'user-2', rule_id: '4.2', text: 'fixture log beta' }
      ],
      logLines: ['[fixture] bot started', '[fixture] moderation completed'],
      delay: new Map()
    },
    chat: {
      runs: {
        local: { runId: 'run-local-1', startedAt: Date.now() - 3600000, messages: Array.from({ length: 105 }, (_, i) => makeChatMessage(i + 1, `Player${i + 1}`, `Local message ${i + 1}`)), canSend: true, sendDisabledReason: '' },
        alpha: { runId: 'run-alpha-1', startedAt: Date.now() - 1800000, messages: [makeChatMessage(1, 'AlphaPlayer', 'Alpha only message')], canSend: true, sendDisabledReason: '' }
      },
      sendDelay: 0,
      abortNextSend: false,
      interceptedSends: [],
      acceptedSends: new Map(),
      denied: false,
      deniedReason: 'Отправка отключена тестовым разрешением.'
    },
    delays: new Map(),
    httpFailures: new Set()
  };
}

function chatPageResponse(run, url) {
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 100, 500));
  const before = url.searchParams.has('before') ? Number(url.searchParams.get('before')) : null;
  const after = url.searchParams.has('after') ? Number(url.searchParams.get('after')) : null;
  const q = (url.searchParams.get('q') || '').toLocaleLowerCase();
  const player = (url.searchParams.get('player') || '').toLocaleLowerCase();
  let rows = run.messages.filter((m) => (!q || `${m.name} ${m.text}`.toLocaleLowerCase().includes(q)) && (!player || m.name.toLocaleLowerCase() === player || String(m.uuid || '').toLocaleLowerCase() === player));
  if (before !== null) rows = rows.filter((m) => Number(m.id) < before).slice(-limit);
  else if (after !== null) rows = rows.filter((m) => Number(m.id) > after).slice(0, limit);
  else rows = rows.slice(-limit);
  const first = run.messages.length ? Number(run.messages[0].id) : 0;
  const last = run.messages.length ? Number(run.messages[run.messages.length - 1].id) : 0;
  let hasMore = false;
  if (before !== null) hasMore = run.messages.some((m) => Number(m.id) < Number(rows[0] ? rows[0].id : before));
  else if (after === null) hasMore = rows.length > 0 && Number(rows[0].id) > first;
  else hasMore = rows.length === limit && Number(rows[rows.length - 1].id) < last;
  return {
    runId: run.runId,
    startedAt: run.startedAt,
    generatedAt: Date.now(),
    messages: rows,
    hasMore,
    latestId: last,
    canSend: fixture.chat.denied ? false : run.canSend,
    sendDisabledReason: fixture.chat.denied ? fixture.chat.deniedReason : run.sendDisabledReason
  };
}

function dapOverview(url) {
  const days = Number(url.searchParams.get('days')) || 7;
  const guild = url.searchParams.get('guild') || '_all';
  return {
    dbExists: fixture.dap.dbExists,
    dbSizeKb: 256,
    botDir: '/fixture/macronuxdam',
    process: { running: true, pid: 1001, uptimeSeconds: 600, llmProvider: 'fixture', llmModel: 'fixture-model' },
    guilds: fixture.dap.guilds,
    guildId: guild === '_all' ? null : guild,
    kpis: { pendingCount: 1, totalViolations: 3, realViolations: 2, punishedCount: 1, accuracyPct: 75, dismissedCount: 1, skippedCount: 0, serverBanwordsCount: 2 },
    rulesCatalog: [{ id: '4.1', title: 'Оскорбления' }, { id: '4.2', title: 'Спам' }],
    charts: { daily: { labels: ['D1', 'D2'], violations: [1, 2], punishments: [0, 1], dismissed: [0, 0] }, methods: { llm: 2, regex: 1 }, actions: { timeout: 1, dismiss: 1 } },
    topOffenders: [], topRules: [], topModerators: [],
    serverConfig: { guildId: guild === '_all' ? 'guild-1' : guild, guildName: 'Test Guild', memberCount: 42, modChannelName: 'moderation', modRoleName: 'Staff', targetLanguage: 'ru', llmEnabled: true },
    channels: [{ name: 'general', channelId: 'ch-1', type: 'text' }],
    roles: [{ name: 'Staff', roleId: 'role-1', color: '#55aaee', isStaff: true }],
    periodDays: days
  };
}

function fixtureResponse(apiPath, url, serverName) {
  if (apiPath === '/api/meta') return { version: 'fixture', days: 30, refresh: 3600, servers: [{ name: 'alpha', display: 'Alpha', online: true, onlinePlayers: 1 }], serverName: 'Fixture', zone: 'Europe/Moscow', dapEnabled: true, dapInstalled: true };
  if (apiPath === '/api/servers') return { servers: [{ name: 'alpha', display: 'Alpha', online: true, onlinePlayers: 1 }] };
  if (apiPath === '/api/online') return { online: [{ name: 'FixturePlayer', uuid: 'fixture-uuid', ping: 32, world: 'world', onlineSeconds: 900 }], tps: [20], mspt: 42, uptimeSeconds: 3600 };
  if (apiPath === '/api/summary') return { totalAccounts: 2, online: 1, last24h: { players: 1, seconds: 1200 }, last7d: { players: 2, seconds: 5400 } };
  if (apiPath === '/api/period') return { current: { players: 2, seconds: 5400 }, previous: null, labels: ['D1'], seconds: [3600], sessions: [1], players: [2], avgSession: [3600], kills: [0], deaths: [0], kd: [0], generatedAt: Date.now(), comparisonAvailable: false };
  if (apiPath === '/api/serverinfo') return { tps: 20, mspt: 42, uptimeSeconds: 3600 };
  if (apiPath === '/api/dap/module') return { installed: true, enabled: true, dbExists: true, process: { running: true } };
  if (apiPath === '/api/dap/overview') return dapOverview(url);
  if (apiPath === '/api/dap/violations') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const guild = url.searchParams.get('guild') || '_all';
    const status = url.searchParams.get('status') || 'all';
    const rows = fixture.dap.violations.filter((v) => (guild === '_all' || v.guildId === guild) && (status === 'all' || (status === 'pending' ? v.action === 'pending' : v.action === status)) && (!q || `${v.userName} ${v.userId} ${v.originalText}`.toLowerCase().includes(q)));
    const offset = Number(url.searchParams.get('offset')) || 0;
    const limit = Number(url.searchParams.get('limit')) || 30;
    return { rows: rows.slice(offset, offset + limit), total: rows.length, page: Math.floor(offset / limit), pageSize: limit };
  }
  if (apiPath === '/api/dap/web_actions') {
    const guild = url.searchParams.get('guild') || '_all';
    return { actions: fixture.dap.actions.filter((a) => guild === '_all' || a.guildId === guild), total: fixture.dap.actions.length };
  }
  if (apiPath === '/api/dap/logs') return { telemetry: fixture.dap.logs, logLines: fixture.dap.logLines, logFile: 'fixture.log' };
  if (apiPath === '/api/dap/banwords') return { serverWords: ['fixture-word'], exceptions: [], rulesCatalog: [{ id: '4.1', title: 'Оскорбления' }] };
  if (apiPath === '/api/dap/action') return { ok: true, id: 81, message: 'Fixture action queued' };
  if (apiPath === '/api/chat') {
    const run = fixture.chat.runs[serverName] || fixture.chat.runs.local;
    return chatPageResponse(run, url);
  }
  if (apiPath === '/api/chat/send') return { ok: false, error: 'Unexpected GET /api/chat/send' };
  if (apiPath.startsWith('/api/')) return {};
  return {};
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
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
    if (req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch (_) { body = {}; }
      entry.body = body;
      if (apiPath === '/api/chat/send') {
        if (fixture.chat.sendDelay) await wait(fixture.chat.sendDelay);
        const requestId = String(body.requestId || '');
        const prior = fixture.chat.acceptedSends.get(requestId);
        if (prior) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ ok: true, message: prior, duplicate: true }));
          return;
        }
        const run = fixture.chat.runs[serverName] || fixture.chat.runs.local;
        const latestNumericId = run.messages.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
        const message = makeChatMessage(latestNumericId + 1, 'Panel Administrator', body.message || '', 'panel', Date.now());
        fixture.chat.acceptedSends.set(requestId, message);
        run.messages.push(message);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ok: true, message, duplicate: false }));
        return;
      }
      const bodyData = fixtureResponse(apiPath, url, serverName);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(bodyData));
      return;
    }
    const delay = fixture.delays.get(apiPath) || fixture.dap.delay.get(apiPath) || 0;
    if (delay) await wait(delay);
    if (fixture.httpFailures.has(apiPath)) {
      entry.status = 503;
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'fixture service unavailable' }));
      return;
    }
    entry.status = 200;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(fixtureResponse(apiPath, url, serverName)));
    return;
  }

  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(webRoot, relative);
  if (!file.startsWith(webRoot + path.sep) && file !== path.join(webRoot, 'index.html')) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

async function loadPage(browser, viewport = { width: 1440, height: 960 }, hash = '#/overview') {
  const context = await browser.newContext({ viewport, timezoneId: 'Europe/Moscow', acceptDownloads: true });
  const page = await context.newPage();
  page.__requestFailures = [];
  page.__requests = [];
  page.on('request', (request) => page.__requests.push({ url: request.url(), method: request.method() }));
  page.on('requestfailed', (request) => page.__requestFailures.push({ url: request.url(), error: request.failure() && request.failure().errorText }));
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) => route.abort());
  await page.goto(origin + hash, { waitUntil: 'domcontentloaded' });
  await page.locator('#refresh-btn').waitFor({ state: 'visible', timeout: 10000 });
  return { context, page };
}

async function openChat(browser, options = {}) {
  const { context, page } = await loadPage(browser, options.viewport || { width: 1440, height: 960 }, '#/chat');
  await page.locator('.chat-page').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#chat-status').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('#chat-status')?.classList.contains('chat-status--loading'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => !!document.querySelector('#chat-count')?.textContent.trim(), null, { timeout: 8000 });
  return { context, page };
}

async function openDap(browser, options = {}) {
  const { context, page } = await loadPage(browser, options.viewport || { width: 1440, height: 960 }, '#/dap');
  await page.locator('#dap-subtabs').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#dap-pane').waitFor({ state: 'visible', timeout: 5000 });
  return { context, page };
}

function apiRequests(pathName, method = 'GET') { return requests.filter((r) => r.path === pathName && r.method === method); }
function queryOf(entry) { return new URL(entry.url, origin).searchParams; }
function reset() { fixture = newFixture(); requests.length = 0; }

async function setTheme(page, theme) {
  const current = await page.locator('html').getAttribute('data-theme');
  if (current === theme) return;
  const burger = page.locator('#burger-btn');
  if (await burger.isVisible()) {
    await burger.click();
    await page.locator('#theme-btn').click();
    await page.locator('#drawer-overlay').evaluate((e) => e.click()).catch(() => {});
  } else {
    await page.locator('#theme-btn').click();
  }
  await page.waitForFunction((wanted) => document.documentElement.getAttribute('data-theme') === wanted, theme, { timeout: 2000 }).catch(async () => {
    await page.locator('html').evaluate((el, wanted) => el.setAttribute('data-theme', wanted), theme);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const sizes = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
  assert.ok(sizes.doc <= sizes.viewport && sizes.body <= sizes.viewport, `${label}: horizontal overflow ${JSON.stringify(sizes)}`);
}

async function run() {
  fs.mkdirSync(qaDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PULSE_BROWSER || undefined });
  const failures = [];
  const tests = [];
  let activeSuite = 'chat';
  const test = (name, fn) => tests.push({ name, fn, suite: activeSuite });

  test('chat loads newest 100 in ascending order and older pages prepend without moving the live cursor', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      const rows = page.locator('#chat-feed .chat-row');
      await waitUntil(async () => await rows.count() === 100, 'chat should load the newest 100 messages');
      const ids = await rows.evaluateAll((els) => els.map((el) => Number(el.dataset.messageId)));
      assert.equal(ids[0], 6, 'initial page should begin with the oldest of the latest 100');
      assert.equal(ids[99], 105, 'initial page should end at the live cursor');
      assert.deepEqual(ids, [...ids].sort((a, b) => a - b), 'initial chat rows are not chronological');
      const anchor = await page.locator('#chat-feed').evaluate((feed) => {
        feed.scrollTop = Math.floor(feed.scrollHeight * 0.45);
        const row = Array.from(feed.querySelectorAll('.chat-row')).find((el) => el.getBoundingClientRect().bottom > feed.getBoundingClientRect().top);
        return row ? { id: row.dataset.messageId, top: row.getBoundingClientRect().top } : null;
      });
      assert.ok(anchor, 'could not establish scroll anchor before loading older chat');
      await page.locator('#chat-older').click();
      await waitUntil(async () => await rows.count() === 105, 'older page did not prepend earlier messages');
      const afterOlder = await rows.evaluateAll((els) => els.map((el) => Number(el.dataset.messageId)));
      assert.deepEqual(afterOlder, Array.from({ length: 105 }, (_, i) => i + 1), 'older page is not in chronological order or has duplicates');
      await waitUntil(async () => {
        const top = await page.locator(`.chat-row[data-message-id="${anchor.id}"]`).evaluate((el) => el.getBoundingClientRect().top);
        return Math.abs(top - anchor.top) <= 3;
      }, 'loading older messages did not restore the reading position after smooth scrolling');
      await page.locator('#chat-refresh').click();
      await waitUntil(() => apiRequests('/api/chat').some((r) => queryOf(r).has('after')), 'refresh did not request incremental chat');
      const lastAfter = apiRequests('/api/chat').filter((r) => queryOf(r).has('after')).at(-1);
      assert.equal(queryOf(lastAfter).get('after'), '105', 'loading an older page changed the live cursor');
    } finally { await context.close(); }
  });

  test('empty startup shows first message on next live refresh', async () => {
    reset();
    fixture.chat.runs.local.messages = [];
    const { context, page } = await openChat(browser);
    try {
      await page.locator('#chat-empty').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#chat-feed .chat-row').count(), 0);
      fixture.chat.runs.local.messages.push(makeChatMessage(1, 'FirstPlayer', 'First message after startup'));
      await page.locator('#chat-refresh').click();
      await page.locator('#chat-feed .chat-row').filter({ hasText: 'First message after startup' }).waitFor({ state: 'visible', timeout: 3000 });
      assert.equal(await page.locator('#chat-feed .chat-row').count(), 1);
    } finally { await context.close(); }
  });

  test('live cursor drains more than 100 unseen messages without skipping rows', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      await waitUntil(async () => await page.locator('#chat-feed .chat-row').count() === 100, 'initial live page did not load');
      const run = fixture.chat.runs.local;
      for (let id = 106; id <= 206; id++) run.messages.push(makeChatMessage(id, `Burst${id}`, `Burst message ${id}`));
      await page.locator('#chat-refresh').click();
      await page.locator('#chat-feed .chat-row').filter({ hasText: 'Burst message 206' }).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await wait(150);
      const ids = await page.locator('#chat-feed .chat-row').evaluateAll((els) => els.map((el) => Number(el.dataset.messageId)).filter((id) => id >= 106));
      assert.equal(ids.length, 101, `expected all 101 unseen messages, rendered ${ids.length}; missing messages can be skipped when cursor advances`);
      assert.deepEqual(ids, Array.from({ length: 101 }, (_, i) => 106 + i), 'live burst messages are missing or out of order');
      const afterQueries = apiRequests('/api/chat').filter((r) => queryOf(r).has('after')).map((r) => queryOf(r).get('after'));
      assert.ok(afterQueries.length >= 2 && afterQueries.includes('205'), `client must continue from the last returned message before the high-water mark; cursors=${afterQueries.join(',')}`);
    } finally { await context.close(); }
  });

  test('search and player filter are sent to the current server and clear stale results', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      await page.locator('#chat-query').fill('message 9');
      await waitUntil(() => apiRequests('/api/chat').some((r) => queryOf(r).get('q') === 'message 9'), 'message search did not reach /api/chat');
      await page.locator('#chat-feed .chat-row').first().waitFor({ state: 'visible' });
      const queryRows = await page.locator('#chat-feed .chat-row .chat-message-text').allInnerTexts();
      assert.ok(queryRows.length && queryRows.every((s) => s.toLowerCase().includes('message 9')), `search returned nonmatching rows: ${queryRows.slice(0, 3)}`);
      const beforeClear = apiRequests('/api/chat').length;
      await page.locator('#chat-query').fill('');
      await waitUntil(() => apiRequests('/api/chat').length > beforeClear, 'clearing message search did not reload chat');
      await page.locator('#chat-player').fill('Player42');
      await waitUntil(() => apiRequests('/api/chat').some((r) => queryOf(r).get('player') === 'Player42'), 'player filter did not reach /api/chat');
      const playerRows = await page.locator('#chat-feed .chat-row').count();
      assert.equal(playerRows, 1, 'exact player filter should leave only the matching player row');
      assert.match(await page.locator('#chat-feed').innerText(), /Local message 42/);
    } finally { await context.close(); }
  });

  test('chat rows render untrusted player names and text as text, never markup', async () => {
    reset();
    fixture.chat.runs.local.messages = [makeChatMessage(1, '<img src=x onerror=alert(1)>', '<script>window.__chatXss=1</script>')];
    const { context, page } = await openChat(browser);
    try {
      await page.locator('.chat-row[data-message-id="1"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#chat-feed img, #chat-feed script').count(), 0, 'untrusted chat content created markup');
      assert.equal(await page.evaluate(() => window.__chatXss), undefined, 'untrusted chat text executed');
      assert.match(await page.locator('.chat-row[data-message-id="1"]').innerText(), /<img src=x onerror=alert\(1\)>/);
      assert.match(await page.locator('.chat-row[data-message-id="1"]').innerText(), /<script>window\.__chatXss=1<\/script>/);
    } finally { await context.close(); }
  });

  test('composer only posts on explicit submit, preserves a draft, and deduplicates a double submit', async () => {
    reset(); fixture.chat.sendDelay = 300;
    const { context, page } = await openChat(browser);
    try {
      await page.locator('#chat-message').fill('/hello from panel');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'chat-message', 'slash input moved focus into global search');
      await wait(200);
      assert.equal(apiRequests('/api/chat/send', 'POST').length, 0, 'typing a draft sent it without explicit submit');
      await page.locator('#chat-compose').evaluate((form) => form.requestSubmit());
      await waitUntil(() => apiRequests('/api/chat/send', 'POST').length === 1, 'explicit submit did not post to mocked chat endpoint');
      await page.locator('#chat-compose').evaluate((form) => form.requestSubmit());
      await wait(450);
      const posts = apiRequests('/api/chat/send', 'POST');
      assert.equal(posts.length, 1, `double submit sent ${posts.length} requests`);
      assert.equal(posts[0].body.message, '/hello from panel');
      assert.ok(posts[0].body.requestId, 'send did not include an idempotency requestId');
      await page.locator('.chat-row--panel').filter({ hasText: '/hello from panel' }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('#chat-message').inputValue(), '', 'successful send did not clear the draft');
    } finally { await context.close(); }
  });

  test('uncertain send retries preserve the requestId and draft until accepted', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      fixture.chat.abortNextSend = true;
      await page.route('**/api/chat/send', async (route) => {
        if (!fixture.chat.abortNextSend) { await route.continue(); return; }
        fixture.chat.abortNextSend = false;
        const body = JSON.parse(route.request().postData() || '{}');
        fixture.chat.interceptedSends.push(body);
        const run = fixture.chat.runs.local;
        const lastId = run.messages.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
        const accepted = makeChatMessage(lastId + 1, 'Panel Administrator', body.message || '', 'panel', Date.now());
        fixture.chat.acceptedSends.set(String(body.requestId || ''), accepted);
        run.messages.push(accepted);
        await route.abort('connectionreset');
      });
      await page.locator('#chat-message').fill('retry after uncertain connection');
      await page.locator('#chat-send:not(:disabled)').waitFor({ state: 'visible', timeout: 4000 });
      await page.locator('#chat-compose').evaluate((form) => form.requestSubmit());
      const submitState = await page.evaluate(() => ({
        message: document.querySelector('#chat-message')?.value,
        sendDisabled: document.querySelector('#chat-send')?.disabled,
        sendLabel: document.querySelector('#chat-send')?.textContent,
        status: document.querySelector('#chat-status')?.className
      }));
      try {
        await waitUntil(() => fixture.chat.interceptedSends.length === 1, 'first mocked send was not intercepted', 3000);
      } catch (error) {
        throw new Error(`${error.message}; submitState=${JSON.stringify(submitState)}; browserRequests=${JSON.stringify(page.__requests.filter((r) => r.url.includes('/chat/send')))}; failedRequests=${JSON.stringify(page.__requestFailures)}`);
      }
      await waitUntil(async () => {
        const feedback = await page.locator('#chat-send-feedback').innerText();
        return !!feedback && !(await page.locator('#chat-send').isDisabled());
      }, 'uncertain send did not restore the composer for retry');
      assert.equal(await page.locator('#chat-message').inputValue(), 'retry after uncertain connection', 'uncertain request cleared the draft');
      await page.locator('#chat-compose').evaluate((form) => form.requestSubmit());
      await waitUntil(() => apiRequests('/api/chat/send', 'POST').length === 1, 'retry was not attempted');
      const firstAttempt = fixture.chat.interceptedSends[0];
      const retry = apiRequests('/api/chat/send', 'POST')[0].body;
      assert.equal(firstAttempt.requestId, retry.requestId, 'retry used a new idempotency key and could duplicate the game message');
      await page.locator('.chat-row--panel').filter({ hasText: 'retry after uncertain connection' }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('.chat-row--panel').filter({ hasText: 'retry after uncertain connection' }).count(), 1, 'idempotent retry produced duplicate panel rows');
      assert.equal(await page.locator('#chat-message').inputValue(), '', 'accepted retry did not clear the draft');
    } finally { await context.close(); }
  });

  test('sending while live messages arrive does not skip the incoming message cursor', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      await waitUntil(async () => await page.locator('#chat-feed .chat-row').count() === 100, 'initial page did not load');
      const run = fixture.chat.runs.local;
      run.messages.push(makeChatMessage(106, 'UnpolledPlayer', 'Arrived before panel send'));
      await page.locator('#chat-message').fill('Panel message follows');
      await page.locator('#chat-compose').evaluate((form) => form.requestSubmit());
      await page.locator('.chat-row--panel').filter({ hasText: 'Panel message follows' }).waitFor({ state: 'visible' });
      await page.locator('.chat-row[data-message-id="106"]').waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
      assert.equal(await page.locator('.chat-row[data-message-id="106"]').count(), 1, 'panel send advanced the live cursor past an unseen player message');
      const after = apiRequests('/api/chat').filter((r) => queryOf(r).has('after'));
      assert.ok(after.some((r) => queryOf(r).get('after') === '105'), 'send acknowledgment skipped the incremental request from the last player cursor');
      const ids = await page.locator('#chat-feed .chat-row').evaluateAll((els) => els.map((el) => Number(el.dataset.messageId)).filter((id) => id >= 106));
      assert.deepEqual(ids, [106, 107], 'intervening player message and panel message were not rendered in ID order');
    } finally { await context.close(); }
  });

  test('a panel send that does not match the active chat search is not inserted into filtered results', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      await page.locator('#chat-query').fill('Player42');
      await waitUntil(() => apiRequests('/api/chat').some((r) => queryOf(r).get('q') === 'Player42'), 'filtered chat request did not start');
      await page.locator('#chat-feed .chat-row').filter({ hasText: 'Local message 42' }).waitFor({ state: 'visible', timeout: 3000 });
      await page.locator('#chat-message').fill('An unfiltered panel announcement');
      await page.locator('#chat-compose').evaluate((form) => form.requestSubmit());
      await waitUntil(() => apiRequests('/api/chat/send', 'POST').length === 1, 'panel message was not sent');
      await waitUntil(() => apiRequests('/api/chat').filter((r) => queryOf(r).get('q') === 'Player42' && queryOf(r).has('after')).length > 0, 'sent message did not use the active filtered cursor');
      assert.equal(await page.locator('.chat-row--panel').count(), 0, 'panel message bypassed the active player/search filter');
      assert.match(await page.locator('#chat-send-feedback').innerText(), /отправлено|sent/i);
    } finally { await context.close(); }
  });

  test('server restart resets the feed and announces a new run', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      await waitUntil(async () => await page.locator('#chat-feed .chat-row').count() === 100, 'initial feed did not load');
      const run = fixture.chat.runs.local;
      run.runId = 'run-local-2'; run.startedAt = Date.now(); run.messages = [makeChatMessage(1, 'RestartedPlayer', 'New run only')];
      await page.locator('#chat-refresh').click();
      await page.locator('#chat-feed .chat-row').filter({ hasText: 'New run only' }).waitFor({ state: 'visible', timeout: 5000 });
      await waitUntil(async () => await page.locator('#chat-feed .chat-row').count() === 1, 'old run rows remained after reset');
      assert.match(await page.locator('#chat-feed').innerText(), /заново|restarted|run/i, 'run reset was not explained to the operator');
    } finally { await context.close(); }
  });

  test('switching server never mixes cached message feeds', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      await page.locator('#chat-feed .chat-row').filter({ hasText: 'Local message 105' }).waitFor({ state: 'visible' });
      await page.locator('#srv-list .srv-pill').filter({ hasText: 'Alpha' }).click();
      await page.locator('#chat-server').waitFor({ state: 'visible' });
      await page.locator('#chat-feed .chat-row').filter({ hasText: 'Alpha only message' }).waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await page.locator('#chat-feed .chat-row').count(), 1, 'old local messages were mixed into the Alpha server feed');
      assert.equal(apiRequests('/api/chat').at(-1).server, 'alpha', 'chat request did not use the selected server prefix');
      await page.locator('#srv-list .srv-pill').filter({ hasText: 'Fixture' }).click();
      await page.locator('#chat-feed .chat-row').filter({ hasText: 'Local message 105' }).waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await page.locator('#chat-feed .chat-row').filter({ hasText: 'Alpha only message' }).count(), 0, 'Alpha message leaked into the restored local feed');
    } finally { await context.close(); }
  });

  test('all-server chat is read-only and never issues a broadcast request', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      const before = apiRequests('/api/chat').length;
      await page.locator('#srv-list .srv-pill').filter({ hasText: 'Все серверы' }).click();
      await page.locator('#chat-server-notice').waitFor({ state: 'visible', timeout: 4000 });
      assert.equal(await page.locator('#chat-send').isDisabled(), true, 'send remained enabled on aggregate server selection');
      assert.equal(await apiRequests('/api/chat').length, before, 'aggregate chat issued a server-wide history request');
      assert.equal(await apiRequests('/api/chat/send', 'POST').length, 0, 'aggregate chat broadcast was sent');
    } finally { await context.close(); }
  });

  test('send permission reason disables the composer and prevents POST', async () => {
    reset(); fixture.chat.denied = true;
    const { context, page } = await openChat(browser);
    try {
      await page.locator('#chat-send-disabled').waitFor({ state: 'visible' });
      assert.match(await page.locator('#chat-send-disabled').innerText(), /отправка отключена/i);
      assert.equal(await page.locator('#chat-message').isDisabled(), true);
      assert.equal(await page.locator('#chat-send').isDisabled(), true);
      assert.equal(await apiRequests('/api/chat/send', 'POST').length, 0);
    } finally { await context.close(); }
  });

  test('pause stops incremental polling and route cleanup clears timers while draft survives return', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      await waitUntil(async () => await page.locator('#chat-feed .chat-row').count() === 100, 'initial chat did not load');
      await page.locator('#chat-live').click();
      assert.equal(await page.locator('#chat-live').getAttribute('aria-pressed'), 'false', 'pause button did not enter paused state');
      const pausedCount = apiRequests('/api/chat').length;
      await wait(3200);
      assert.equal(apiRequests('/api/chat').length, pausedCount, 'paused chat continued polling');
      await page.locator('#chat-message').fill('draft survives route change');
      await page.evaluate(() => { location.hash = '#/overview'; });
      await page.locator('#k2-v').waitFor({ state: 'visible', timeout: 5000 });
      const offRouteCount = apiRequests('/api/chat').length;
      await wait(3200);
      assert.equal(apiRequests('/api/chat').length, offRouteCount, 'chat polling timer survived leaving the route');
      await page.evaluate(() => { location.hash = '#/chat'; });
      await page.locator('.chat-page').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await page.locator('#chat-message').inputValue(), 'draft survives route change', 'route cleanup discarded the per-server draft');
    } finally { await context.close(); }
  });

  test('1440 desktop and 390 mobile chat layouts fit in dark and light themes', async () => {
    reset();
    const { context, page } = await openChat(browser);
    try {
      await waitUntil(async () => await page.locator('#chat-feed .chat-row').count() === 100, 'chat feed did not populate for screenshots');
      for (const theme of ['dark', 'light']) {
        await page.setViewportSize({ width: 1440, height: 960 }); await setTheme(page, theme);
        await page.screenshot({ path: path.join(qaDir, `chat-desktop-1440-${theme}.png`), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 }); await wait(100);
        await assertNoHorizontalOverflow(page, `chat ${theme} 390px`);
        const bounds = await page.evaluate(() => {
          const page = document.querySelector('.chat-page').getBoundingClientRect();
          const nodes = ['#chat-refresh', '#chat-live', '#chat-query', '#chat-player', '#chat-feed', '#chat-message', '#chat-send'].map((selector) => [selector, document.querySelector(selector)]).filter(([, el]) => el && !el.hidden && el.getClientRects().length);
          return nodes.map(([name, el]) => { const r = el.getBoundingClientRect(); return { name, left: r.left, right: r.right, pageLeft: page.left, pageRight: page.right }; }).filter((r) => r.left < r.pageLeft - 1 || r.right > r.pageRight + 1);
        });
        assert.deepEqual(bounds, [], `chat controls escape content bounds in ${theme}: ${JSON.stringify(bounds)}`);
        await page.screenshot({ path: path.join(qaDir, `chat-mobile-390-${theme}.png`), fullPage: true });
      }
    } finally { await context.close(); }
  });

  activeSuite = 'dap';

  test('DAP defaults to pending cases and exposes 7, 30, and 90 day data periods', async () => {
    reset();
    const { context, page } = await openDap(browser);
    try {
      await page.locator('#dap-case-list .dap-case-card').first().waitFor({ state: 'visible', timeout: 6000 });
      const initial = apiRequests('/api/dap/violations').at(-1);
      assert.equal(queryOf(initial).get('status'), 'pending', 'moderation did not default to pending cases');
      assert.ok(await page.locator('#dap-filter-reset').isVisible(), 'filter reset control is missing');
      for (const days of ['7', '30', '90']) {
        await page.locator('#dap-period').selectOption(days);
        await waitUntil(() => apiRequests('/api/dap/overview').some((r) => queryOf(r).get('days') === days), `${days}-day period did not reload overview`);
        await waitUntil(() => apiRequests('/api/dap/violations').some((r) => queryOf(r).get('days') === days), `${days}-day period did not reload cases`);
      }
      assert.deepEqual(await page.locator('#dap-period option').evaluateAll((els) => els.map((el) => el.value)), ['7', '30', '90']);
    } finally { await context.close(); }
  });

  test('moderation master-detail supports next, previous, and mobile back to the case list', async () => {
    reset();
    const { context, page } = await openDap(browser, { viewport: { width: 390, height: 844 } });
    try {
      await page.locator('#dap-case-list .dap-case-card').first().waitFor({ state: 'visible', timeout: 6000 });
      const cards = page.locator('#dap-case-list .dap-case-card');
      assert.ok(await cards.count() >= 2, 'fixture should expose multiple pending cases for navigation');
      await cards.nth(0).click();
      await page.locator('.dap-root.dap-detail-open').waitFor({ state: 'visible', timeout: 2000 });
      const firstId = await cards.nth(0).getAttribute('data-case-id');
      const secondId = await cards.nth(1).getAttribute('data-case-id');
      await page.locator('#dap-case-next').click();
      await waitUntil(async () => await page.locator(`#dap-case-list .dap-case-card[data-case-id="${secondId}"]`).getAttribute('aria-pressed') === 'true', 'next did not select the following case');
      await page.locator('#dap-case-prev').click();
      await waitUntil(async () => await page.locator(`#dap-case-list .dap-case-card[data-case-id="${firstId}"]`).getAttribute('aria-pressed') === 'true', 'previous did not return to the first case');
      await page.locator('#dap-case-back').click();
      assert.equal(await page.locator('.dap-root').evaluate((el) => el.classList.contains('dap-detail-open')), false, 'mobile back did not restore the list layout');
      await assertNoHorizontalOverflow(page, 'DAP mobile master-detail');
    } finally { await context.close(); }
  });

  test('moderation filters reset and search text survives a background host refresh', async () => {
    reset();
    const { context, page } = await openDap(browser);
    try {
      await page.locator('#dap-case-list .dap-case-card').first().waitFor({ state: 'visible', timeout: 6000 });
      await page.locator('#dap-f-q').fill('Raven');
      await waitUntil(() => apiRequests('/api/dap/violations').some((r) => queryOf(r).get('q') === 'Raven'), 'moderation search did not reach the API');
      await page.locator('#dap-refresh').click();
      await wait(120);
      assert.equal(await page.locator('#dap-f-q').inputValue(), 'Raven', 'background refresh discarded moderator search text');
      await page.locator('#dap-filter-reset').click();
      await waitUntil(async () => await page.locator('#dap-f-q').inputValue() === '', 'filter reset did not clear search text');
      const last = apiRequests('/api/dap/violations').at(-1);
      assert.ok(!queryOf(last).get('q'), 'reset filters still sent the previous search');
      assert.equal(queryOf(last).get('status'), 'pending', 'reset did not return to the pending review default');
    } finally { await context.close(); }
  });

  test('late moderation response cannot replace the selected guild or active tab', async () => {
    reset();
    const { context, page } = await openDap(browser);
    try {
      await page.locator('#dap-case-list .dap-case-card').first().waitFor({ state: 'visible', timeout: 6000 });
      fixture.dap.delay.set('/api/dap/violations', 450);
      await page.locator('#dap-guild-sel').selectOption('guild-1');
      await waitUntil(() => apiRequests('/api/dap/violations').some((r) => queryOf(r).get('guild') === 'guild-1'), 'guild 1 case request did not start');
      await page.locator('#dap-guild-sel').selectOption('guild-2');
      await page.locator('#dap-case-list .dap-case-card[data-case-id="3"]').waitFor({ state: 'visible', timeout: 5000 });
      await wait(600);
      const visibleIds = await page.locator('#dap-case-list .dap-case-card').evaluateAll((els) => els.map((el) => el.dataset.caseId));
      assert.deepEqual(visibleIds, ['3'], `late guild response replaced the current case list: ${visibleIds.join(',')}`);

      await page.locator('#dap-guild-sel').selectOption('guild-1');
      await waitUntil(() => apiRequests('/api/dap/violations').some((r) => queryOf(r).get('guild') === 'guild-1'), 'guild 1 case request did not restart');
      await page.locator('#dap-subtabs [data-dtab="actions"]').click();
      await page.locator('#dap-queue-list').waitFor({ state: 'visible', timeout: 5000 });
      await wait(600);
      assert.equal(await page.locator('#dap-queue-list').isVisible(), true, 'late moderation response replaced the active action queue tab');
      assert.equal(await page.locator('#dap-case-list').count(), 0, 'stale moderation list rendered over the action queue');
    } finally { await context.close(); }
  });

  test('action queue clearly distinguishes pending, applied, and failed statuses and filters them', async () => {
    reset();
    const { context, page } = await openDap(browser);
    try {
      await page.locator('#dap-subtabs [data-dtab="actions"]').click();
      await page.locator('#dap-queue-list').waitFor({ state: 'visible', timeout: 6000 });
      for (const [status, selector, label] of [
        ['pending', '.dap-queue-pending', /ожидает|pending/i],
        ['applied', '.dap-queue-applied', /применено|applied/i],
        ['failed', '.dap-queue-failed', /ошибка|failed/i]
      ]) {
        const card = page.locator(selector).first();
        await card.waitFor({ state: 'visible', timeout: 3000 });
        assert.match(await card.innerText(), label, `${status} action status is not explained in the queue`);
      }
      await page.locator('#dap-queue-status').selectOption('failed');
      await waitUntil(async () => await page.locator('#dap-queue-list .dap-queue-card').count() === 1, 'queue status filter did not reduce to failed action');
      assert.ok(await page.locator('#dap-queue-list .dap-queue-failed').isVisible());
      assert.equal(await page.locator('#dap-queue-list .dap-queue-pending').count(), 0);
    } finally { await context.close(); }
  });

  test('moderation logs search and source filter update telemetry and console results', async () => {
    reset();
    const { context, page } = await openDap(browser);
    try {
      await page.locator('#dap-subtabs [data-dtab="logs"]').click();
      await page.locator('#dap-lg-q').waitFor({ state: 'visible', timeout: 6000 });
      await page.locator('#dap-lg-q').fill('alpha');
      await wait(100);
      assert.match(await page.locator('#dap-pane').innerText(), /fixture log alpha/i, 'log search hid the matching telemetry line');
      assert.doesNotMatch(await page.locator('#dap-pane').innerText(), /fixture log beta/i, 'log search retained a nonmatching telemetry line');
      await page.locator('#dap-lg-kind').selectOption('console');
      await wait(100);
      const text = await page.locator('#dap-pane').innerText();
      assert.match(text, /fixture log alpha/i, 'console source filter lost the matching console line');
      assert.doesNotMatch(text, /fixture log beta/i, 'console source filter retained telemetry');
      await page.locator('#dap-lg-kind').selectOption('telemetry');
      await wait(100);
      assert.match(await page.locator('#dap-pane').innerText(), /fixture log alpha/i, 'telemetry source filter lost a matching event');
    } finally { await context.close(); }
  });

  test('logs can be copied and downloaded as text from the panel', async () => {
    reset();
    const { context, page } = await openDap(browser);
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
      await page.locator('#dap-subtabs [data-dtab="logs"]').click();
      await page.locator('#dap-log-copy').waitFor({ state: 'visible', timeout: 6000 });
      await page.locator('#dap-log-copy').click();
      await wait(100);
      const clipboard = await page.evaluate(() => navigator.clipboard && navigator.clipboard.readText()).catch(() => '');
      const copyFeedback = await page.locator('#dap-pane').innerText();
      assert.ok(clipboard.includes('fixture') || /скопирован|copied/i.test(copyFeedback), 'copy log action gave no evidence of success');
      const downloadPromise = page.waitForEvent('download', { timeout: 4000 });
      await page.locator('#dap-log-download').click();
      const download = await downloadPromise;
      assert.match(download.suggestedFilename(), /\.txt$/i, 'log download did not produce a TXT file');
    } finally { await context.close(); }
  });

  test('1440 desktop and 390 mobile moderation layouts fit in dark and light themes', async () => {
    reset();
    const { context, page } = await openDap(browser);
    try {
      await page.locator('#dap-case-list .dap-case-card').first().waitFor({ state: 'visible', timeout: 6000 });
      for (const theme of ['dark', 'light']) {
        await page.setViewportSize({ width: 1440, height: 960 }); await setTheme(page, theme);
        await page.screenshot({ path: path.join(qaDir, `dap-desktop-1440-${theme}.png`), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 }); await wait(100);
        await assertNoHorizontalOverflow(page, `DAP ${theme} 390px`);
        const root = page.locator('.dap-root');
        assert.equal(await root.count(), 1, 'DAP root container missing');
        const tabs = page.locator('#dap-subtabs .dap-tab');
        for (let index = 0; index < await tabs.count(); index++) {
          const tab = tabs.nth(index);
          await tab.scrollIntoViewIfNeeded();
          const visible = await tab.evaluate((el) => {
            const strip = el.closest('#dap-subtabs').getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return r.left >= strip.left - 1 && r.right <= strip.right + 1 && r.top >= strip.top - 1 && r.bottom <= strip.bottom + 1;
          });
          assert.ok(visible, `DAP tab ${index} is clipped at 390px in ${theme}`);
        }
        await page.locator('#dap-subtabs [data-dtab="overview"]').click();
        await page.screenshot({ path: path.join(qaDir, `dap-mobile-390-${theme}.png`), fullPage: true });
      }
    } finally { await context.close(); }
  });

  const scope = process.env.PULSE_TEST_SCOPE;
  const nameFilter = (process.env.PULSE_TEST_NAME || '').toLowerCase();
  const selectedTests = tests.filter((entry) => (!scope || entry.suite === scope) && (!nameFilter || entry.name.toLowerCase().includes(nameFilter)));
  for (const entry of selectedTests) {
    try { await entry.fn(); console.log(`PASS ${entry.name}`); }
    catch (error) { failures.push({ name: entry.name, error }); console.error(`FAIL ${entry.name}\n${error.stack || error}`); }
  }
  await browser.close();
  console.log(`\n${selectedTests.length - failures.length}/${selectedTests.length} ${scope || 'redesign'} browser checks passed`);
  if (failures.length) process.exitCode = 1;
}

server.listen(port, '127.0.0.1', async () => {
  try { await run(); }
  catch (error) { console.error(error.stack || error); process.exitCode = 1; }
  finally { server.close(); }
});
