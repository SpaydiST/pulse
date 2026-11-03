/* Pulse · Minecraft live chat */
(function () {
  'use strict';

  var P = window.PulseApp;
  if (!P) return;

  var $ = P.$;
  var esc = P.esc;
  var on = P.on;
  var states = Object.create(null);
  var current = null;
  var currentSeq = 0;
  var pollTimer = null;
  var queryTimer = null;
  var disposed = true;
  var ui = null;
  var renderedContext = null;
  var renderedGeneration = -1;

  var words = {
    ru: {
      title: 'Игровой чат', subtitle: 'История сообщений Minecraft с момента запуска сервера и отправка сообщений в игру.',
      source: 'Minecraft', live: 'В эфире', paused: 'Пауза', resume: 'Продолжить', pause: 'Пауза', refresh: 'Обновить',
      search: 'Поиск по сообщениям', player: 'Игрок', playerPlaceholder: 'Имя игрока',
      send: 'Отправить', composer: 'Сообщение в игровой чат', composerPlaceholder: 'Напишите сообщение…',
      older: 'Загрузить старые сообщения', newMessages: 'Новых сообщений: {0}', jump: 'К последним',
      waiting: 'Загружаем историю чата…', empty: 'В этом запуске сообщений пока нет.', emptyHelp: 'Новые сообщения появятся здесь автоматически.',
      disconnected: 'Нет связи с сервером чата', retry: 'Повторить загрузку', loading: 'Загрузка…',
      startup: 'Запуск сервера', updated: 'Обновлено', count: '{0} сообщений загружено',
      chooseServer: 'Выберите один сервер в списке, чтобы открыть его игровой чат.', allServers: 'Историю чата нельзя просматривать сразу со всех серверов.',
      unavailable: 'Отправка недоступна', sendingOff: 'Отправка отключена для этой панели.',
      sendDisabled: 'Отправка недоступна: {0}', sendUnavailable: 'У панели нет разрешения отправлять сообщения. Настройте доступ к серверу.',
      sendWait: 'Отправка…', sent: 'Сообщение отправлено', sendFailed: 'Не удалось отправить сообщение',
      duplicate: 'Сообщение уже было отправлено', tooLong: 'Сообщение должно содержать не более 500 символов.',
      blank: 'Введите сообщение.', controls: 'Уберите управляющие символы и переносы строк.',
      charCount: '{0} / 500', requestError: 'Не удалось загрузить чат',
      restart: 'Сервер перезапустился. История началась заново.',
      pendingHint: 'Если связь прервалась, повторная отправка безопасна.',
      copied: 'Скопировано', copy: 'Копировать сообщение',
    },
    en: {
      title: 'Minecraft chat', subtitle: 'Minecraft message history since server startup and a way to send messages in game.',
      source: 'Minecraft', live: 'Live', paused: 'Paused', resume: 'Resume', pause: 'Pause', refresh: 'Refresh',
      search: 'Search messages', player: 'Player', playerPlaceholder: 'Player name',
      send: 'Send', composer: 'Message to game chat', composerPlaceholder: 'Write a message…',
      older: 'Load older messages', newMessages: 'New messages: {0}', jump: 'Jump to latest',
      waiting: 'Loading chat history…', empty: 'There are no messages in this server run yet.', emptyHelp: 'New messages will appear here automatically.',
      disconnected: 'Chat server is unreachable', retry: 'Retry loading', loading: 'Loading…',
      startup: 'Server started', updated: 'Updated', count: '{0} messages loaded',
      chooseServer: 'Select one server from the list to open its game chat.', allServers: 'Chat history cannot be viewed across all servers at once.',
      unavailable: 'Sending unavailable', sendingOff: 'Sending is disabled for this panel.',
      sendDisabled: 'Sending unavailable: {0}', sendUnavailable: 'This panel is not allowed to send messages. Configure server access.',
      sendWait: 'Sending…', sent: 'Message sent', sendFailed: 'Could not send the message',
      duplicate: 'Message was already sent', tooLong: 'Messages can contain up to 500 characters.',
      blank: 'Enter a message.', controls: 'Remove control characters and line breaks.',
      charCount: '{0} / 500', requestError: 'Could not load chat',
      restart: 'The server restarted. Chat history has started over.',
      pendingHint: 'If the connection drops, retrying is safe.',
      copied: 'Copied', copy: 'Copy message',
    }
  };

  function lang() {
    var i18n = window.PulseI18n;
    return i18n && typeof i18n.lang === 'function' && i18n.lang() === 'en' ? 'en' : 'ru';
  }
  function t(key) { return words[lang()][key] || key; }
  function fmt(key, value) { return t(key).replace('{0}', String(value)); }
  function serverKey() {
    var key = typeof P.getActiveServer === 'function' ? P.getActiveServer() : 'local';
    return key || 'local';
  }
  function serverName(key) {
    if (key === '_all') return lang() === 'en' ? 'All servers' : 'Все серверы';
    if (typeof P.getServerName === 'function') return P.getServerName() || key;
    return key === 'local' ? (lang() === 'en' ? 'Local server' : 'Локальный сервер') : key;
  }
  function routeIsChat() {
    return String(location.hash || '').replace(/^#/, '').split('/')[1] === 'chat';
  }
  function requestCurrent(ctx, seq, generation) {
    return !disposed && current === ctx && currentSeq === seq &&
      (!P.getViewSeq || P.getViewSeq() === seq) && routeIsChat() &&
      serverKey() === ctx.server && ctx.generation === generation;
  }
  function contextFor(key) {
    if (!states[key]) {
      states[key] = {
        server: key, messages: [], runId: null, startedAt: null, generatedAt: null,
        oldestId: null, latestId: 0, hasMore: false, loaded: false,
        canSend: false, sendDisabledReason: '', query: '', player: '', draft: '',
        requestId: null, requestDraft: null, pendingSend: false, sendError: '',
        live: true, newCount: 0, generation: 0, restartNotice: false, loadingInitial: false,
        loadingOlder: false, polling: false, lastError: '',
      };
    }
    return states[key];
  }
  function requestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function codepoints(value) { return Array.from(value || '').length; }
  function clean(value) { return String(value || '').trim(); }
  function hasControls(value) { return /[\u0000-\u001f\u007f-\u009f]/.test(value); }
  function encodeQuery(ctx, mode, cursor) {
    var parts = ['limit=100'];
    if (mode === 'before' || mode === 'after') parts.push(encodeURIComponent(mode) + '=' + encodeURIComponent(cursor));
    if (ctx.query) parts.push('q=' + encodeURIComponent(ctx.query));
    if (ctx.player) parts.push('player=' + encodeURIComponent(ctx.player));
    return '/api/chat?' + parts.join('&');
  }
  function formatDate(value) {
    if (!value) return '—';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString(lang() === 'en' ? 'en-US' : 'ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function formatTime(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString(lang() === 'en' ? 'en-US' : 'ru-RU', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function shellHtml() {
    var title = t('title');
    var sub = t('subtitle');
    return '<section class="chat-page">' +
      '<header class="chat-heading"><div><div class="view-title">' + esc(title) + '</div><div class="view-sub">' + esc(sub) + '</div></div>' +
      '<div class="chat-heading-actions"><span class="chat-status" id="chat-status" role="status" aria-live="polite"></span>' +
      '<button class="chat-button chat-button--quiet" id="chat-refresh" type="button">↻ ' + esc(t('refresh')) + '</button></div></header>' +
      '<div class="chat-context"><div class="chat-context-main"><span class="chat-source-icon" aria-hidden="true">✦</span>' +
      '<div><strong id="chat-server"></strong><div class="chat-context-meta" id="chat-meta"></div></div></div>' +
      '<button class="chat-live" id="chat-live" type="button" aria-pressed="true"><span class="chat-live-dot"></span><span id="chat-live-label"></span></button></div>' +
      '<div class="chat-toolbar"><label class="chat-search"><span aria-hidden="true">⌕</span><input id="chat-query" type="search" autocomplete="off" aria-label="' + esc(t('search')) + '"></label>' +
      '<label class="chat-player-filter"><span id="chat-player-label"></span><input id="chat-player" type="search" autocomplete="off"></label></div>' +
      '<div class="chat-server-notice" id="chat-server-notice" hidden role="status"></div>' +
      '<section class="chat-card" aria-label="' + esc(t('source')) + '"><div class="chat-history-top">' +
      '<button class="chat-button chat-button--older" id="chat-older" type="button" hidden></button>' +
      '<span class="chat-count" id="chat-count"></span></div>' +
      '<div class="chat-feed" id="chat-feed" role="log" aria-live="polite" aria-relevant="additions text" tabindex="0">' +
      '<div class="chat-empty" id="chat-empty"><span class="chat-empty-mark" aria-hidden="true">⌁</span><strong id="chat-empty-title"></strong><span id="chat-empty-help"></span></div>' +
      '</div><button class="chat-new" id="chat-new" type="button" hidden></button>' +
      '<div class="chat-compose-wrap"><div class="chat-send-disabled" id="chat-send-disabled" hidden></div>' +
      '<form class="chat-compose" id="chat-compose"><label class="chat-composer-label" for="chat-message"></label>' +
      '<input id="chat-message" type="text" maxlength="2000" autocomplete="off" aria-label="' + esc(t('composer')) + '">' +
      '<span class="chat-char-count" id="chat-char-count"></span><button class="chat-send" id="chat-send" type="submit"></button></form>' +
      '<div class="chat-send-feedback" id="chat-send-feedback" role="status" aria-live="polite"></div></div></section>' +
      '<div class="chat-footnote" id="chat-footnote"></div></section>';
  }
  function bind(box) {
    ui = {
      box: box, status: $('#chat-status', box), refresh: $('#chat-refresh', box), server: $('#chat-server', box), meta: $('#chat-meta', box),
      live: $('#chat-live', box), liveLabel: $('#chat-live-label', box), query: $('#chat-query', box), player: $('#chat-player', box),
      playerLabel: $('#chat-player-label', box), notice: $('#chat-server-notice', box), older: $('#chat-older', box), count: $('#chat-count', box),
      feed: $('#chat-feed', box), empty: $('#chat-empty', box), emptyTitle: $('#chat-empty-title', box), emptyHelp: $('#chat-empty-help', box),
      newButton: $('#chat-new', box), compose: $('#chat-compose', box), composerLabel: $('.chat-composer-label', box), message: $('#chat-message', box),
      charCount: $('#chat-char-count', box), send: $('#chat-send', box), disabled: $('#chat-send-disabled', box), feedback: $('#chat-send-feedback', box),
      footnote: $('#chat-footnote', box),
    };
    ui.query.placeholder = t('search');
    ui.player.placeholder = t('playerPlaceholder');
    ui.playerLabel.textContent = t('player');
    ui.composerLabel.textContent = t('composer');
    ui.message.placeholder = t('composerPlaceholder');
    ui.refresh.setAttribute('aria-label', t('refresh'));

    on(ui.refresh, 'click', function () {
      if (!current || current.server === '_all') return;
      if (!current.loaded) fetchPage(current, 'initial');
      else fetchPage(current, 'after', current.latestId);
    });
    on(ui.live, 'click', function () {
      if (!current) return;
      current.live = !current.live;
      current.newCount = 0;
      paintContext(current);
      if (current.live && current.server !== '_all') fetchPage(current, current.loaded ? 'after' : 'initial', current.latestId);
    });
    on(ui.query, 'input', function () { updateFilters(); });
    on(ui.player, 'input', function () { updateFilters(); });
    on(ui.older, 'click', function () { if (current && current.hasMore && !current.loadingOlder) fetchPage(current, 'before', current.oldestId); });
    on(ui.feed, 'scroll', function () {
      if (!current) return;
      if (isNearBottom()) {
        current.newCount = 0;
        if (ui.newButton) ui.newButton.hidden = true;
      }
    });
    on(ui.newButton, 'click', function () {
      if (!ui.feed) return;
      ui.feed.scrollTop = ui.feed.scrollHeight;
      if (current) current.newCount = 0;
      ui.newButton.hidden = true;
    });
    on(ui.compose, 'submit', function (event) { event.preventDefault(); sendMessage(); });
    on(ui.message, 'input', function () {
      if (!current) return;
      if (current.draft !== ui.message.value) {
        current.requestId = null;
        current.requestDraft = null;
        current.sendError = '';
      }
      current.draft = ui.message.value;
      updateComposer(current);
    });
    on(ui.message, 'keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); sendMessage(); }
    });
  }
  function updateFilters() {
    if (!current) return;
    current.query = ui.query.value.trim();
    current.player = ui.player.value.trim();
    if (queryTimer) clearTimeout(queryTimer);
    var ctx = current;
    ctx.generation++;
    ctx.loadingInitial = false;
    ctx.loadingOlder = false;
    ctx.polling = false;
    ctx.messages = [];
    ctx.oldestId = null;
    ctx.latestId = 0;
    ctx.hasMore = false;
    ctx.loaded = false;
    ctx.lastError = '';
    ctx.newCount = 0;
    clearFeed();
    renderedContext = ctx;
    renderedGeneration = ctx.generation;
    paintContext(ctx);
    queryTimer = setTimeout(function () {
      if (disposed || current !== ctx || !routeIsChat() || serverKey() !== ctx.server) return;
      if (ctx.server !== '_all') fetchPage(ctx, 'initial');
    }, 250);
  }
  function clearFeed() {
    if (!ui || !ui.feed) return;
    Array.prototype.slice.call(ui.feed.querySelectorAll('.chat-row,.chat-feed-error,.chat-restart-note')).forEach(function (n) { n.remove(); });
  }
  function isNearBottom() {
    if (!ui || !ui.feed) return true;
    return ui.feed.scrollHeight - ui.feed.scrollTop - ui.feed.clientHeight < 76;
  }
  function paintStatus(kind, value) {
    if (!ui || !ui.status) return;
    ui.status.className = 'chat-status chat-status--' + kind;
    ui.status.textContent = value;
  }
  function setRowTime(row, timestamp) {
    var time = el('time', 'chat-time', formatTime(timestamp));
    time.dateTime = timestamp || '';
    time.title = formatDate(timestamp);
    row.appendChild(time);
  }
  function makeRow(message) {
    var row = el('article', 'chat-row' + (message.source === 'panel' ? ' chat-row--panel' : ''));
    row.dataset.messageId = String(message.id);
    setRowTime(row, message.time);
    var main = el('div', 'chat-row-main');
    var header = el('div', 'chat-row-header');
    var name = el('strong', 'chat-name', message.source === 'panel' ? 'Panel Administrator' : (message.name || 'Unknown player'));
    header.appendChild(name);
    if (message.source === 'panel') header.appendChild(el('span', 'chat-panel-badge', 'PANEL'));
    main.appendChild(header);
    main.appendChild(el('p', 'chat-message-text', message.text || ''));
    row.appendChild(main);
    return row;
  }
  function findRow(id) {
    if (!ui || !ui.feed) return null;
    var existingRows = ui.feed.querySelectorAll('.chat-row');
    for (var i = 0; i < existingRows.length; i++) {
      if (existingRows[i].dataset.messageId === String(id)) return existingRows[i];
    }
    return null;
  }
  function appendMessages(messages, ctx, mode, scrollWasBottom, oldScrollHeight, oldScrollTop) {
    if (!ui || !ui.feed) return;
    var rows = (messages || []).filter(function (m) { return m && m.id !== undefined && m.id !== null; });
    if (mode === 'initial') {
      clearFeed();
      if (ctx.restartNotice) {
        ui.feed.appendChild(el('div', 'chat-restart-note', t('restart')));
        ctx.restartNotice = false;
      }
    }
    var fragment = document.createDocumentFragment();
    var added = 0;
    rows.forEach(function (m) {
      if (!findRow(m.id)) { fragment.appendChild(makeRow(m)); added++; }
    });
    if (mode === 'before') ui.feed.insertBefore(fragment, ui.feed.querySelector('.chat-row'));
    else ui.feed.appendChild(fragment);
    if (mode === 'initial') {
      ui.feed.scrollTop = ui.feed.scrollHeight;
      ctx.newCount = 0;
    } else if (mode === 'before') {
      ui.feed.scrollTop = oldScrollTop + (ui.feed.scrollHeight - oldScrollHeight);
    } else if (scrollWasBottom) {
      ui.feed.scrollTop = ui.feed.scrollHeight;
      ctx.newCount = 0;
    } else if (added) {
      ctx.newCount += added;
    }
    ui.empty.hidden = ctx.messages.length > 0;
    ui.emptyTitle.textContent = ctx.lastError ? t('requestError') : t('empty');
    ui.emptyHelp.textContent = ctx.lastError || t('emptyHelp');
    ui.newButton.hidden = !ctx.newCount;
    ui.newButton.textContent = fmt('newMessages', ctx.newCount);
  }
  function setCursor(ctx, messages, result, mode) {
    var valid = (messages || []).filter(function (m) { return m && m.id !== undefined && m.id !== null; });
    if (mode === 'initial') {
      ctx.messages = valid.slice();
    } else if (mode === 'before') {
      var seen = Object.create(null);
      ctx.messages.forEach(function (m) { seen[String(m.id)] = true; });
      ctx.messages = valid.filter(function (m) { var id = String(m.id); if (seen[id]) return false; seen[id] = true; return true; }).concat(ctx.messages);
    } else {
      var seenAfter = Object.create(null);
      ctx.messages.forEach(function (m) { seenAfter[String(m.id)] = true; });
      ctx.messages = ctx.messages.concat(valid.filter(function (m) { var id = String(m.id); if (seenAfter[id]) return false; seenAfter[id] = true; return true; }));
    }
    if (ctx.messages.length) {
      ctx.oldestId = ctx.messages[0].id;
    } else {
      ctx.oldestId = null;
    }
    if (mode !== 'before') {
      if (mode === 'after' && valid.length >= 100) ctx.latestId = valid[valid.length - 1].id;
      else if (result && result.latestId !== undefined && result.latestId !== null) ctx.latestId = result.latestId;
      else if (valid.length) ctx.latestId = valid[valid.length - 1].id;
      else if (mode === 'initial') ctx.latestId = 0;
    }
    if (mode === 'initial' || mode === 'before') ctx.hasMore = !!(result && result.hasMore);
    if (result && result.runId !== undefined) ctx.runId = result.runId;
    if (result && result.startedAt !== undefined) ctx.startedAt = result.startedAt;
    if (result && result.generatedAt !== undefined) ctx.generatedAt = result.generatedAt;
    ctx.canSend = result && result.canSend === true;
    ctx.sendDisabledReason = result && result.sendDisabledReason ? String(result.sendDisabledReason) : '';
    ctx.loaded = true;
    ctx.lastError = '';
  }
  async function fetchPage(ctx, mode, cursor) {
    if (!ctx || ctx.server === '_all' || disposed) return;
    if (mode === 'initial' && ctx.loadingInitial) return;
    if (mode === 'before' && (ctx.loadingOlder || !ctx.hasMore || cursor === undefined || cursor === null)) return;
    if (mode === 'after' && (ctx.polling || !ctx.loaded || cursor === undefined || cursor === null)) return;
    var seq = currentSeq;
    var generation = ctx.generation;
    var isInitial = mode === 'initial';
    var isOlder = mode === 'before';
    if (isInitial) ctx.loadingInitial = true;
    if (isOlder) ctx.loadingOlder = true;
    if (mode === 'after') ctx.polling = true;
    ctx.lastError = '';
    if (isInitial || isOlder) paintContext(ctx);
    var oldHeight = ui && ui.feed ? ui.feed.scrollHeight : 0;
    var oldTop = ui && ui.feed ? ui.feed.scrollTop : 0;
    var atBottom = isNearBottom();
    try {
      var result = await P.j(encodeQuery(ctx, mode, cursor));
      if (!requestCurrent(ctx, seq, generation)) return;
      if (!result || result.__networkError || result.__httpError || result.error) {
        ctx.lastError = result && result.error ? result.error : t('disconnected');
        paintContext(ctx);
        return;
      }
      if (ctx.runId !== null && result.runId !== undefined && result.runId !== null && String(ctx.runId) !== String(result.runId) && mode !== 'initial') {
        ctx.messages = [];
        ctx.oldestId = null;
        ctx.latestId = 0;
        ctx.hasMore = false;
        ctx.loaded = false;
        ctx.runId = result.runId;
        ctx.startedAt = result.startedAt || null;
        ctx.restartNotice = true;
        ctx.newCount = 0;
        clearFeed();
        paintContext(ctx);
        setTimeout(function () {
          if (requestCurrent(ctx, seq, generation)) fetchPage(ctx, 'initial');
        }, 0);
        return;
      }
      var incoming = Array.isArray(result.messages) ? result.messages : [];
      if (mode === 'initial' && ctx.runId !== null && result.runId !== undefined && result.runId !== null && String(ctx.runId) !== String(result.runId)) {
        ctx.restartNotice = true;
        ctx.messages = [];
        ctx.oldestId = null;
        ctx.latestId = 0;
        ctx.hasMore = false;
        ctx.newCount = 0;
      }
      setCursor(ctx, incoming, result, mode);
      appendMessages(mode === 'before' ? incoming : (mode === 'initial' ? ctx.messages : incoming), ctx, mode, atBottom, oldHeight, oldTop);
      renderedContext = ctx;
      renderedGeneration = ctx.generation;
      paintContext(ctx);
    } catch (error) {
      if (!requestCurrent(ctx, seq, generation)) return;
      ctx.lastError = error && error.message ? error.message : t('requestError');
      paintContext(ctx);
    } finally {
      if (ctx.generation === generation) {
        if (isInitial) ctx.loadingInitial = false;
        if (isOlder) ctx.loadingOlder = false;
        if (mode === 'after') ctx.polling = false;
      }
      if (current === ctx && !disposed && requestCurrent(ctx, currentSeq, ctx.generation)) paintContext(ctx);
    }
  }
  function paintContext(ctx) {
    if (!ui || !ui.box || !ui.box.isConnected || current !== ctx) return;
    ui.server.textContent = serverName(ctx.server);
    ui.meta.textContent = ctx.startedAt ? t('startup') + ': ' + formatDate(ctx.startedAt) + (ctx.generatedAt ? ' · ' + t('updated') + ': ' + formatDate(ctx.generatedAt) : '') : t('waiting');
    ui.live.classList.toggle('is-paused', !ctx.live);
    ui.live.setAttribute('aria-pressed', ctx.live ? 'true' : 'false');
    ui.liveLabel.textContent = ctx.live ? t('live') : t('paused');
    if (ui.query.value !== ctx.query) ui.query.value = ctx.query;
    if (ui.player.value !== ctx.player) ui.player.value = ctx.player;
    if (ui.message.value !== ctx.draft) ui.message.value = ctx.draft;
    ui.notice.hidden = ctx.server !== '_all';
    ui.live.disabled = ctx.server === '_all';
    ui.refresh.disabled = ctx.server === '_all';
    ui.query.disabled = ctx.server === '_all';
    ui.player.disabled = ctx.server === '_all';
    if (ctx.server === '_all') {
      ui.notice.textContent = t('chooseServer') + ' ' + t('allServers');
      paintStatus('paused', t('paused'));
    }
    ui.older.hidden = !ctx.hasMore || ctx.server === '_all';
    ui.older.disabled = ctx.loadingOlder;
    ui.older.textContent = ctx.loadingOlder ? t('loading') : t('older');
    ui.count.textContent = ctx.loaded ? fmt('count', ctx.messages.length) : '';
    ui.empty.hidden = ctx.messages.length > 0 || (!!ctx.lastError && ctx.loaded);
    ui.emptyTitle.textContent = ctx.lastError ? t('requestError') : (ctx.loaded ? t('empty') : t('waiting'));
    ui.emptyHelp.textContent = ctx.lastError || (ctx.loaded ? t('emptyHelp') : '');
    if (ctx.lastError) {
      ui.empty.hidden = false;
      if (!ui.feed.querySelector('.chat-feed-error')) {
        var retry = el('button', 'chat-feed-error', t('retry'));
        retry.type = 'button';
        retry.addEventListener('click', function () { fetchPage(ctx, ctx.loaded ? 'after' : 'initial', ctx.latestId); });
        ui.feed.appendChild(retry);
      }
    } else {
      var errorRow = ui.feed.querySelector('.chat-feed-error');
      if (errorRow) errorRow.remove();
    }
    if (ctx.server === '_all') paintStatus('paused', t('paused'));
    else if (ctx.lastError) paintStatus('offline', t('disconnected'));
    else if (ctx.loadingInitial && !ctx.loaded) paintStatus('loading', t('waiting'));
    else if (ctx.live) paintStatus('live', t('live'));
    else paintStatus('paused', t('paused'));
    ui.newButton.hidden = !ctx.newCount;
    ui.newButton.textContent = fmt('newMessages', ctx.newCount);
    updateComposer(ctx);
    ui.footnote.textContent = ctx.canSend ? t('pendingHint') : '';
  }
  function updateComposer(ctx) {
    if (!ui || !ui.send) return;
    var value = ui.message.value;
    var len = codepoints(value);
    ui.charCount.textContent = fmt('charCount', len);
    ui.charCount.classList.toggle('is-over', len > 500);
    var canSend = ctx.server !== '_all' && ctx.canSend && !ctx.pendingSend && len > 0 && len <= 500 && !hasControls(value);
    ui.message.disabled = ctx.server === '_all' || !ctx.canSend || ctx.pendingSend;
    ui.send.disabled = !canSend;
    ui.send.textContent = ctx.pendingSend ? t('sendWait') : t('send');
    ui.disabled.hidden = ctx.canSend || ctx.server === '_all';
    ui.disabled.textContent = ctx.sendDisabledReason ? fmt('sendDisabled', ctx.sendDisabledReason) : t('sendUnavailable');
    ui.feedback.textContent = ctx.sendError || '';
    ui.feedback.classList.toggle('is-error', !!ctx.sendError);
  }
  async function sendMessage() {
    var ctx = current;
    if (!ctx || !ui || !ctx.canSend || ctx.server === '_all' || ctx.pendingSend) return;
    var message = clean(ui.message.value);
    var length = codepoints(message);
    if (!message) { ctx.sendError = t('blank'); updateComposer(ctx); ui.message.focus(); return; }
    if (hasControls(message)) { ctx.sendError = t('controls'); updateComposer(ctx); ui.message.focus(); return; }
    if (length > 500) { ctx.sendError = t('tooLong'); updateComposer(ctx); ui.message.focus(); return; }
    if (ctx.requestDraft !== message || !ctx.requestId) {
      ctx.requestId = requestId();
      ctx.requestDraft = message;
    }
    ctx.draft = message;
    ctx.pendingSend = true;
    ctx.sendError = '';
    updateComposer(ctx);
    var sendId = ctx.requestId;
    var navigationAtSend = P.getNavigationSeq ? P.getNavigationSeq() : null;
    function requestStillTracked() {
      return ctx.requestId === sendId && ctx.requestDraft === message;
    }
    function sendViewIsCurrent() {
      return !disposed && current === ctx && routeIsChat() && serverKey() === ctx.server &&
        (navigationAtSend === null || P.getNavigationSeq() === navigationAtSend);
    }
    try {
      var result = await P.postJson('/api/chat/send', { message: message, requestId: sendId });
      if (!requestStillTracked()) return;
      ctx.pendingSend = false;
      if (!result || result.ok !== true || !result.message) {
        ctx.sendError = result && result.error ? String(result.error) : t('sendFailed');
        if (sendViewIsCurrent()) updateComposer(ctx);
        return;
      }
      var duplicate = !!result.duplicate;
      ctx.requestId = null;
      ctx.requestDraft = null;
      ctx.draft = '';
      ctx.sendError = duplicate ? t('duplicate') : t('sent');
      if (!sendViewIsCurrent()) return;
      paintContext(ctx);
      // Use the same filtered cursor stream for sent and player messages, preserving order.
      if (ctx.live) fetchPage(ctx, 'after', ctx.latestId);
      if (ui.message) ui.message.focus();
    } catch (error) {
      if (!requestStillTracked()) return;
      ctx.pendingSend = false;
      ctx.sendError = error && error.message ? error.message : t('sendFailed');
      if (sendViewIsCurrent()) updateComposer(ctx);
    }
  }
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      var ctx = current;
      if (disposed || !ctx || !ctx.live || ctx.server === '_all' || !routeIsChat()) return;
      if (P.getViewSeq && P.getViewSeq() !== currentSeq) return;
      if (!ctx.loaded) fetchPage(ctx, 'initial');
      else fetchPage(ctx, 'after', ctx.latestId);
    }, 3000);
  }
  function run(seq) {
    currentSeq = typeof seq === 'number' ? seq : (P.getViewSeq ? P.getViewSeq() : currentSeq);
    disposed = false;
    var key = serverKey();
    var previousContext = current;
    current = contextFor(key);
    var box = $('#view');
    var hadShell = !!(box && $('.chat-page', box));
    if (!hadShell && box) box.innerHTML = '';
    box = P.staticShell(shellHtml());
    var rebuilt = !hadShell || !ui || !ui.feed || !ui.feed.isConnected || ui.box !== box;
    if (rebuilt) bind(box);
    if (rebuilt || previousContext !== current || renderedContext !== current || renderedGeneration !== current.generation) {
      clearFeed();
      if (current.messages.length) appendMessages(current.messages, current, 'initial', true, 0, 0);
      else {
        ui.empty.hidden = false;
        ui.emptyTitle.textContent = current.lastError ? t('requestError') : (current.loaded ? t('empty') : t('waiting'));
        ui.emptyHelp.textContent = current.lastError || (current.loaded ? t('emptyHelp') : '');
      }
      renderedContext = current;
      renderedGeneration = current.generation;
    }
    paintContext(current);
    startPolling();
    if (key === '_all') return;
    if (!current.loaded) fetchPage(current, 'initial');
    else if (current.live) fetchPage(current, 'after', current.latestId);
  }
  function dispose() {
    disposed = true;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (queryTimer) { clearTimeout(queryTimer); queryTimer = null; }
  }

  window.PulseModules = window.PulseModules || {};
  window.PulseModules.chat = { run: run, dispose: dispose };
})();
