/* ═══════════════════════════════════════════════════════════
   Pulse · Модуль MacronuxDAM (Discord AI AutoMod)
   Интеграция с Python-ботом автомодерации Discord (F:\Code\DAP).
   Поддерживает:
   - Вынесение наказаний из веб-панели (web_actions queue)
   - Просмотр серверов, каналов, ролей и аватарок Discord
   - Аналитику нарушений, точность ИИ (LLM), банворды, правила
   - Полноценную мультиязычность (Русский / English)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = window.PulseApp;
  if (!P) {
    console.error('[MacronuxDAM] window.PulseApp не найден');
    return;
  }

  var $ = P.$;
  var $$ = P.$$;
  var on = P.on;
  var fmt = P.fmt;
  var esc = P.esc;
  var fmtDurShort = P.fmtDurShort;
  var debounce = P.debounce;
  var j = P.j;
  var postJson = P.postJson;
  var makeChart = P.chart;
  var clearCharts = P.clearCharts;
  var lineCfg = P.lineCfg;
  var doughnutCfg = P.doughnutCfg;
  var openModal = P.openModal;
  var staticShell = P.staticShell;

  // ════════════════════════════════════════════════════════════
  // 1. ДВУЯЗЫЧНЫЙ СЛОВАРЬ (i18n)
  // ════════════════════════════════════════════════════════════
  var DAP_I18N = {
    ru: {
      'dap.title': '🛡️ MacronuxDAM',
      'dap.sub': 'Модерация Discord и управление ботом в одном месте.',
      'dap.tab.overview': 'Модерация',
      'dap.tab.analytics': 'Аналитика',
      'dap.tab.actions': 'Очередь действий',
      'dap.tab.server': 'Сервер и роли',
      'dap.tab.banwords': 'Правила и слова',
      'dap.tab.settings': 'Настройки',
      'dap.tab.logs': 'Логи',
      'work.title': 'Центр модерации',
      'work.sub': 'Разбирайте срабатывания, проверяйте контекст сообщения и применяйте решение.',
      'work.pending': 'На проверке',
      'work.all': 'Все случаи',
      'work.refresh': 'Обновить',
      'work.search': 'Поиск по сообщению, имени или ID',
      'work.status': 'Статус',
      'work.severity': 'Тяжесть',
      'work.ruleContext': 'Контекст правила',
      'work.queue': 'Случаи',
      'work.count': 'Найдено: {0}',
      'work.empty': 'По выбранным фильтрам случаев нет',
      'work.emptyDetail': 'Выберите случай из списка, чтобы увидеть сообщение и действия.',
      'work.message': 'Сообщение',
      'work.translation': 'Перевод',
      'work.context': 'Контекст',
      'work.rule': 'Правило',
      'work.channel': 'Канал',
      'work.detected': 'Обнаружено',
      'work.moderator': 'Решение модератора',
      'work.profile': 'Профиль участника',
      'work.discord': 'Открыть в Discord',
      'work.punish': 'Выбрать наказание',
      'work.analytics': 'Аналитика модерации',
      'work.selected': 'Выбранный случай',
      'work.page': 'Страница {0} из {1}',
      'work.showing': 'Показано {0} из {1}',
      'work.period': 'Период',
      'work.period.7': '7 дней',
      'work.period.30': '30 дней',
      'work.period.90': '90 дней',
      'work.filterReset': 'Сбросить фильтры',
      'work.caseBack': 'К списку',
      'work.casePrev': 'Предыдущий',
      'work.caseNext': 'Следующий',
      'work.stale': 'Не удалось обновить. Показаны последние загруженные данные.',
      'work.loading': 'Загружаем данные модерации…',
      'queue.title': 'Очередь действий',
      'queue.sub': 'Последние команды панели и ответы бота. Здесь видно, что выполнено, ожидает или требует повтора.',
      'queue.empty': 'Действий пока нет',
      'queue.created': 'Создано',
      'queue.result': 'Ответ бота',
      'queue.waiting': 'Ожидает обработки ботом',
      'queue.retry': 'Повторить',
      'queue.cancel': 'Отменить',
      'queue.status': 'Статус очереди',
      'queue.filter.all': 'Все действия',
      'queue.filter.pending': 'Ожидают',
      'queue.filter.applied': 'Выполнены',
      'queue.filter.failed': 'Ошибка',
      'queue.filter.cancelled': 'Отменены',
      'queue.retryFeedback': 'Действие возвращено в очередь бота',
      'queue.cancelFeedback': 'Ожидающее действие отменено',
      'queue.emptyFilter': 'В этом статусе действий нет',

      'proc.active': '<b>MacronuxDAM активен</b> (PID {0} · {1}) · LLM: <b>{2}</b> ({3})',
      'proc.stopped': '<b>Процесс остановлен</b> · БД: <b>{0}</b> · LLM: <b>{1}</b>',
      'proc.checking': 'Проверка статуса бота…',
      'proc.start': '▶ Старт',
      'proc.restart': '🔄 Рестарт',
      'proc.stop': '⏹ Стоп',
      'proc.module': '🧩 Модуль',

      'guild.label': 'Сервер Discord:',
      'guild.all': '🌐 Все серверы Discord ({0})',
      'export.csv': '📥 Экспорт CSV',

      'kpi.total': 'Всего срабатываний',
      'kpi.real': 'Реальных страйков: {0}',
      'kpi.pending': 'Ожидают решения',
      'kpi.pending.sub': 'Требуют вердикта',
      'kpi.punished': 'Вынесено наказаний',
      'kpi.punished.sub': 'Варн / Мут / Бан / Кик',
      'kpi.accuracy': 'Точность детекта',
      'kpi.accuracy.sub': 'Снято (ложных): {0}',
      'kpi.skipped': 'Пропущено',
      'kpi.skipped.sub': 'Без выдачи страйка',
      'kpi.protection': 'Защита сервера',
      'kpi.protection.sub': 'Слов в БД · Исключений: {0}',

      'ch.daily': '📈 Динамика нарушений и решений по дням',
      'ch.methods': '🤖 Методы детекта и типы решений',
      'ch.lbl.viol': 'Нарушения',
      'ch.lbl.pun': 'Наказания',
      'ch.lbl.dis': 'Снято (dismiss)',

      'filter.q': 'Поиск по тексту, нику или ID…',
      'filter.status.all': 'Все статусы',
      'filter.status.pending': '⏳ Ожидают решения',
      'filter.status.punished': '🔨 Наказаны',
      'filter.status.dismissed': '✅ Не нарушение',
      'filter.status.skipped': '⏭️ Пропущены',
      'filter.method.all': 'Все методы',
      'filter.method.reports': 'Жалобы',
      'filter.rule.all': 'Все правила',

      'tbl.numTime': '# / Время',
      'tbl.member': 'Участник Discord',
      'tbl.rule': 'Правило',
      'tbl.method': 'Метод',
      'tbl.msg': 'Сообщение и Перевод',
      'tbl.status': 'Статус',
      'tbl.quick': 'Быстрые действия',
      'tbl.empty': 'По выбранным фильтрам нарушений не найдено',
      'tbl.loading': 'Загрузка журнала…',

      'act.dismiss': '✅ Снять',
      'act.dismiss.tip': 'Пометить как «Не нарушение» (обучает Few-Shot LLM)',
      'act.skip': '⏭️ Скип',
      'act.skip.tip': 'Пропустить без страйка',
      'act.timeout1h': '⏳ Мут 1ч',
      'act.ban': '🔨 Бан',
      'act.more': '⚡ Действия…',
      'act.jump': '🔗 В Discord',

      'top.offenders': '🔥 Топ нарушителей',
      'top.rules': '📜 Топ нарушаемых правил',
      'top.mods': '🏆 Активность модераторов',
      'top.noData': 'Нет данных за период',
      'top.noMods': 'Нет действий модераторов',

      'action.warn': '⚠️ Предупреждение (Варн)',
      'action.timeout': '⏳ Тайм-аут (Мут)',
      'action.untimeout': '🔊 Снять тайм-аут',
      'action.kick': '👢 Кикнуть с сервера',
      'action.ban': '🔨 Забанить',
      'action.unban': '🕊️ Разбанить',
      'action.nick': '✏️ Сменить никнейм',
      'action.dismiss_full': '✅ Ложное срабатывание (Снять)',
      'action.clear_strikes': '🔄 Сбросить все страйки',
      'form.action': 'Действие',
      'form.moderate': 'Модерация',
      'form.manage': 'Управление участником',
      'form.duration': 'Длительность',
      'form.tenMin': '10 мин',
      'form.oneHour': '1 час',
      'form.sixHours': '6 часов',
      'form.oneDay': '1 день',
      'form.sevenDays': '7 дней',
      'form.forever': 'Навсегда',
      'form.seconds': 'секунд',
      'form.nickname': 'Новый никнейм',
      'form.nicknameHint': 'Пусто — сбросить никнейм',
      'form.reason': 'Причина',
      'form.reasonHint': 'Причина для участника и журнала модерации',
      'form.queueHint': 'Команда поступит в очередь бота. Результат появится во вкладке «Очередь действий».',
      'form.cancel': 'Отмена',
      'form.submit': 'Отправить действие',
      'form.sending': 'Передача боту…',
      'confirm.title': 'Подтвердите действие',
      'confirm.body': 'Проверьте выбранное действие и участника перед отправкой в очередь Discord.',
      'confirm.stop': 'Остановить процесс MacronuxDAM?',
      'confirm.send': 'Передать боту',
      'settings.disableTitle': 'Отключить модуль MacronuxDAM?',

      'status.pending': '⏳ Ожидает исполнения',
      'status.applied': '✅ Применено в Discord',
      'status.failed': '❌ Ошибка',
      'status.cancelled': '🚫 Отменено',

      'logs.search': 'Поиск по тексту лога или участнику',
      'logs.kind': 'Источник',
      'logs.kind.all': 'Все события',
      'logs.kind.telemetry': 'События модерации',
      'logs.kind.console': 'Консоль бота',
      'logs.copy': 'Копировать лог',
      'logs.download': 'Скачать TXT',
      'logs.copied': 'Лог скопирован',
      'logs.copyError': 'Не удалось скопировать лог',
      'logs.empty': 'Нет данных для выбранного фильтра',

      'toast.queued': '⏳ Действие передано боту MacronuxDAM для исполнения в Discord!'
    },
    en: {
      'dap.title': '🛡️ MacronuxDAM',
      'dap.sub': 'Discord moderation and bot controls in one place.',
      'dap.tab.overview': 'Moderation',
      'dap.tab.analytics': 'Analytics',
      'dap.tab.actions': 'Action queue',
      'dap.tab.server': 'Server and roles',
      'dap.tab.banwords': 'Rules and words',
      'dap.tab.settings': 'Settings',
      'dap.tab.logs': 'Logs',
      'work.title': 'Moderation center',
      'work.sub': 'Review detections, read the message context, and make a decision.',
      'work.pending': 'Needs review',
      'work.all': 'All cases',
      'work.refresh': 'Refresh',
      'work.search': 'Search messages, names, or IDs',
      'work.status': 'Status',
      'work.severity': 'Severity',
      'work.ruleContext': 'Rule context',
      'work.queue': 'Cases',
      'work.count': 'Found: {0}',
      'work.empty': 'No cases match these filters',
      'work.emptyDetail': 'Select a case to see the message and available actions.',
      'work.message': 'Message',
      'work.translation': 'Translation',
      'work.context': 'Context',
      'work.rule': 'Rule',
      'work.channel': 'Channel',
      'work.detected': 'Detected',
      'work.moderator': 'Moderator decision',
      'work.profile': 'Member profile',
      'work.discord': 'Open in Discord',
      'work.punish': 'Choose action',
      'work.analytics': 'Moderation analytics',
      'work.selected': 'Selected case',
      'work.page': 'Page {0} of {1}',
      'work.showing': 'Showing {0} of {1}',
      'work.period': 'Period',
      'work.period.7': '7 days',
      'work.period.30': '30 days',
      'work.period.90': '90 days',
      'work.filterReset': 'Reset filters',
      'work.caseBack': 'Back to cases',
      'work.casePrev': 'Previous',
      'work.caseNext': 'Next',
      'work.stale': 'Could not refresh. Showing the latest loaded data.',
      'work.loading': 'Loading moderation data…',
      'queue.title': 'Action queue',
      'queue.sub': 'Recent panel commands and bot responses. See what succeeded, is pending, or needs a retry.',
      'queue.empty': 'No actions yet',
      'queue.created': 'Created',
      'queue.result': 'Bot response',
      'queue.waiting': 'Waiting for the bot',
      'queue.retry': 'Retry',
      'queue.cancel': 'Cancel',
      'queue.status': 'Queue status',
      'queue.filter.all': 'All actions',
      'queue.filter.pending': 'Pending',
      'queue.filter.applied': 'Completed',
      'queue.filter.failed': 'Failed',
      'queue.filter.cancelled': 'Cancelled',
      'queue.retryFeedback': 'Action returned to the bot queue',
      'queue.cancelFeedback': 'Pending action cancelled',
      'queue.emptyFilter': 'There are no actions with this status',

      'proc.active': '<b>MacronuxDAM active</b> (PID {0} · {1}) · LLM: <b>{2}</b> ({3})',
      'proc.stopped': '<b>Bot stopped</b> · DB: <b>{0}</b> · LLM: <b>{1}</b>',
      'proc.checking': 'Checking bot status…',
      'proc.start': '▶ Start',
      'proc.restart': '🔄 Restart',
      'proc.stop': '⏹ Stop',
      'proc.module': '🧩 Module',

      'guild.label': 'Discord Server:',
      'guild.all': '🌐 All Discord Servers ({0})',
      'export.csv': '📥 Export CSV',

      'kpi.total': 'Total Triggers',
      'kpi.real': 'Real strikes: {0}',
      'kpi.pending': 'Pending Decisions',
      'kpi.pending.sub': 'Require verdict',
      'kpi.punished': 'Actions Applied',
      'kpi.punished.sub': 'Warn / Timeout / Ban / Kick',
      'kpi.accuracy': 'Detection Accuracy',
      'kpi.accuracy.sub': 'Dismissed (false): {0}',
      'kpi.skipped': 'Skipped',
      'kpi.skipped.sub': 'Without strike',
      'kpi.protection': 'Server Shield',
      'kpi.protection.sub': 'Banwords · Exceptions: {0}',

      'ch.daily': '📈 Violation & Decision Trends by Day',
      'ch.methods': '🤖 Detection Methods & Decision Types',
      'ch.lbl.viol': 'Violations',
      'ch.lbl.pun': 'Punishments',
      'ch.lbl.dis': 'Dismissed',

      'filter.q': 'Search text, username, or ID…',
      'filter.status.all': 'All statuses',
      'filter.status.pending': '⏳ Awaiting decision',
      'filter.status.punished': '🔨 Punished',
      'filter.status.dismissed': '✅ Dismissed',
      'filter.status.skipped': '⏭️ Skipped',
      'filter.method.all': 'All methods',
      'filter.method.reports': 'Reports',
      'filter.rule.all': 'All rules',

      'tbl.numTime': '# / Time',
      'tbl.member': 'Discord Member',
      'tbl.rule': 'Rule',
      'tbl.method': 'Method',
      'tbl.msg': 'Message & Translation',
      'tbl.status': 'Status',
      'tbl.quick': 'Quick Actions',
      'tbl.empty': 'No violations found for selected filters',
      'tbl.loading': 'Loading violations journal…',

      'act.dismiss': '✅ Dismiss',
      'act.dismiss.tip': 'Mark as false positive (trains Few-Shot LLM)',
      'act.skip': '⏭️ Skip',
      'act.skip.tip': 'Skip without strike',
      'act.timeout1h': '⏳ Mute 1h',
      'act.ban': '🔨 Ban',
      'act.more': '⚡ Actions…',
      'act.jump': '🔗 Discord',

      'top.offenders': '🔥 Top Offenders',
      'top.rules': '📜 Most Violated Rules',
      'top.mods': '🏆 Moderator Activity',
      'top.noData': 'No data for selected period',
      'top.noMods': 'No moderator actions',

      'action.warn': '⚠️ Warning (Warn)',
      'action.timeout': '⏳ Timeout (Mute)',
      'action.untimeout': '🔊 Remove Timeout',
      'action.kick': '👢 Kick from Server',
      'action.ban': '🔨 Ban Member',
      'action.unban': '🕊️ Unban Member',
      'action.nick': '✏️ Change Nickname',
      'action.dismiss_full': '✅ False Positive (Dismiss)',
      'action.clear_strikes': '🔄 Clear All Strikes',
      'form.action': 'Action',
      'form.moderate': 'Moderation',
      'form.manage': 'Member management',
      'form.duration': 'Duration',
      'form.tenMin': '10 min',
      'form.oneHour': '1 hour',
      'form.sixHours': '6 hours',
      'form.oneDay': '1 day',
      'form.sevenDays': '7 days',
      'form.forever': 'Forever',
      'form.seconds': 'seconds',
      'form.nickname': 'New nickname',
      'form.nicknameHint': 'Leave blank to reset nickname',
      'form.reason': 'Reason',
      'form.reasonHint': 'Reason shown to the member and in the moderation log',
      'form.queueHint': 'The bot will process this action. Its result will appear in the Action queue tab.',
      'form.cancel': 'Cancel',
      'form.submit': 'Send action',
      'form.sending': 'Sending to bot…',
      'confirm.title': 'Confirm action',
      'confirm.body': 'Review the selected action and member before sending it to the Discord queue.',
      'confirm.stop': 'Stop the MacronuxDAM process?',
      'confirm.send': 'Send to bot',
      'settings.disableTitle': 'Disable the MacronuxDAM module?',

      'status.pending': '⏳ Awaiting Bot Execution',
      'status.applied': '✅ Applied in Discord',
      'status.failed': '❌ Execution Failed',
      'status.cancelled': '🚫 Cancelled',

      'logs.search': 'Search log text or member',
      'logs.kind': 'Source',
      'logs.kind.all': 'All events',
      'logs.kind.telemetry': 'Moderation events',
      'logs.kind.console': 'Bot console',
      'logs.copy': 'Copy log',
      'logs.download': 'Download TXT',
      'logs.copied': 'Log copied',
      'logs.copyError': 'Could not copy log',
      'logs.empty': 'No data for this filter',

      'toast.queued': '⏳ Action sent to MacronuxDAM bot for Discord execution!'
    }
  };

  function t(key, fallback) {
    var lang = (window.PulseI18n && window.PulseI18n.lang && window.PulseI18n.lang()) || 'ru';
    var dict = DAP_I18N[lang] || DAP_I18N.en || DAP_I18N.ru;
    var str = (dict && dict[key] !== undefined) ? dict[key] : (DAP_I18N.en && DAP_I18N.en[key] !== undefined ? DAP_I18N.en[key] : (fallback || key));
    if (arguments.length > 2) {
      for (var i = 2; i < arguments.length; i++) {
        str = str.replace(new RegExp('\\{' + (i - 2) + '\\}', 'g'), arguments[i]);
      }
    }
    return str;
  }

  var dapState = {
    tab: 'overview',
    guild: '_all',
    status: 'pending',
    method: 'all',
    rule: 'all',
    q: '',
    page: 0,
    limit: 30,
    days: 30,
    selectedViolationId: null,
    queueStatus: 'all',
    queueFeedback: '',
    logKind: 'all',
    logQuery: '',
    lastLoadedAt: 0,
    violationsRequestId: 0,
    overviewRequestId: 0,
    queueRequestId: 0,
    banwordsRequestId: 0,
    logsRequestId: 0,
    overviewController: null,
    logsController: null,
    overviewRenderKey: '',
    load: null,
    viewSeq: 0,
    refreshTimer: 0
  };

  function navigateDapTab(tab) {
    dapState.tab = tab;
    var root = document.getElementById('dap-root');
    if (root) {
      root.classList.remove('dap-detail-open');
      $$('.dap-tab', root).forEach(function (button) {
        var active = button.dataset.dtab === dapState.tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.setAttribute('tabindex', active ? '0' : '-1');
      });
      var period = $('#dap-period-control', root);
      var exportButton = $('#dap-export-btn', root);
      if (period) period.hidden = dapState.tab !== 'overview' && dapState.tab !== 'analytics';
      if (exportButton) exportButton.hidden = dapState.tab !== 'overview' && dapState.tab !== 'analytics';
    }
    if (dapState.load) dapState.load();
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'dap-toast';
    toast.innerHTML = '<span>' + esc(msg) + '</span>';
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3800);
  }

  function dapActionLabel(a) {
    var m = {
      pending: t('status.pending', '⏳ Ожидает'),
      dismiss: t('act.dismiss', '✅ Не нарушение'),
      dismissed: t('act.dismiss', '✅ Снято'),
      skip: t('act.skip', '⏭️ Пропущено'),
      skipped: t('act.skip', '⏭️ Пропущено'),
      delete: '🗑️ Удалено',
      timeout: '⏳ Тайм-аут',
      untimeout: '🔊 Снят мут',
      ban: '🔨 Бан',
      unban: '🕊️ Разбан',
      warn: '⚠️ Варн',
      kick: '👢 Кик',
      nick: '✏️ Смена ника',
      reset_nick: '✏️ Сброс ника',
      clear_strikes: '🔄 Сброс страйков',
      reset_user: '🔄 Сброс страйков',
      applied: t('status.applied', '✅ Применено'),
      failed: t('status.failed', '❌ Ошибка')
    };
    return m[a] || a || t('status.pending', '⏳ Ожидает');
  }

  function violationStatusLabel(action) {
    if (!action || action === 'pending') return t('work.pending');
    if (action === 'dismiss' || action === 'dismissed') return t('filter.status.dismissed');
    if (action === 'skip' || action === 'skipped') return t('filter.status.skipped');
    return dapActionLabel(action);
  }

  function dapMethodBadge(m) {
    var map = {
      regex: ['regex', 'Regex / Банворд'],
      llm: ['llm', '🤖 ИИ (LLM)'],
      user_report: ['user_report', '📨 Жалоба'],
      automod: ['automod', '⚡ Автомод'],
      pulse_web: ['llm', '🌐 Веб-панель']
    };
    var pair = map[m] || ['regex', m || 'regex'];
    return '<span class="dap-badge ' + esc(pair[0]) + '">' + esc(pair[1]) + '</span>';
  }

  function roleColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#7f5af0';
  }

  function discordJumpUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && ['discord.com', 'canary.discord.com', 'ptb.discord.com'].includes(url.hostname)
        && url.pathname.startsWith('/channels/') ? url.href : '';
    } catch (e) { return ''; }
  }

  function renderUserAvatar(avatarUrl, name, size) {
    var sz = size || 32;
    var letter = (name || '?').trim().charAt(0).toUpperCase() || 'D';
    if (avatarUrl && avatarUrl.startsWith('http')) {
      return '<img src="' + esc(avatarUrl) + '" class="dap-avatar" style="width:' + sz + 'px;height:' + sz + 'px" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false">' +
        '<span class="dap-avatar-fallback" style="width:' + sz + 'px;height:' + sz + 'px" hidden>' + esc(letter) + '</span>';
    }
    return '<span class="dap-avatar-fallback" style="width:' + sz + 'px;height:' + sz + 'px">' + esc(letter) + '</span>';
  }

  function confirmDapAction(detail, onConfirm) {
    openModal(t('confirm.title'), function (body, hide) {
      body.classList.add('dap-confirm');
      body.innerHTML =
        '<p class="dap-confirm-copy">' + esc(t('confirm.body')) + '</p>' +
        '<div class="dap-confirm-detail">' +
        '<span class="dap-confirm-icon" aria-hidden="true">' + esc(detail.icon || '⚖️') + '</span>' +
        '<div><strong>' + esc(detail.title || '') + '</strong><small>' + esc(detail.subtitle || '') + '</small>' +
        (detail.reason ? '<p>' + esc(detail.reason) + '</p>' : '') + '</div></div>' +
        '<div class="dap-form-footer"><button type="button" class="btn-secondary" data-confirm-cancel>' + esc(t('form.cancel')) + '</button>' +
        '<button type="button" class="btn-primary dap-confirm-submit" data-confirm-submit>' + esc(detail.submit || t('confirm.send')) + '</button></div>';
      body.querySelector('[data-confirm-cancel]').addEventListener('click', hide);
      body.querySelector('[data-confirm-submit]').addEventListener('click', function () {
        var button = body.querySelector('[data-confirm-submit]');
        button.disabled = true;
        hide();
        onConfirm();
      });
    }, 'dap-confirm-modal');
  }

  // ════════════════════════════════════════════════════════════
  // 2. МОДАЛЬНОЕ ОКНО ПРЯМОГО НАКАЗАНИЯ (Discord Punishment Modal)
  // ════════════════════════════════════════════════════════════
  function openDapActionModal(opts, onDone) {
    var gid = opts.guildId;
    var uid = opts.userId;
    var vid = opts.violationId == null ? 0 : opts.violationId;
    var hasViolation = vid !== 0 && String(vid) !== '' && String(vid) !== '0';
    var userName = opts.userName || opts.userDisplayName || String(uid);
    var avatarUrl = opts.userAvatarUrl || opts.avatarUrl || '';
    var viewGuild = dapState.guild;
    var viewTab = dapState.tab;
    var rootAtOpen = document.getElementById('dap-root');
    var getNavigationSeq = P.getNavigationSeq || P.getViewSeq;
    var navigationSeq = getNavigationSeq();

    function viewStillMatches() {
      return !!rootAtOpen && rootAtOpen.isConnected && document.getElementById('dap-root') === rootAtOpen &&
        navigationSeq === getNavigationSeq() && viewGuild === dapState.guild && viewTab === dapState.tab &&
        (!hasViolation || String(dapState.selectedViolationId) === String(vid));
    }

    openModal('⚖️ Решение модератора · ' + userName, function (body, hide) {
      body.classList.add('dap-action-form');
      body.innerHTML =
        '<div class="dap-action-target">' +
        renderUserAvatar(avatarUrl, userName, 40) +
        '  <div><strong>' + esc(userName) + '</strong>' +
        '    <small>Discord ID: <code>' + esc(uid) + '</code>' + (hasViolation ? ' · #' + esc(String(vid)) : '') + '</small>' +
        '  </div>' +
        '</div>' +
        '<div class="dap-form-field">' +
        '  <label for="dap-m-action">' + t('form.action', 'Действие') + '</label>' +
        '  <select id="dap-m-action" class="sel">' +
        '    <optgroup label="' + t('form.moderate', 'Модерация') + '">' +
        '      <option value="warn">' + t('action.warn') + '</option>' +
        '      <option value="timeout" selected>' + t('action.timeout') + '</option>' +
        '      <option value="kick">' + t('action.kick') + '</option>' +
        '      <option value="ban">' + t('action.ban') + '</option>' +
        (hasViolation ? '      <option value="dismiss">' + t('action.dismiss_full') + '</option>' : '') +
        '    </optgroup>' +
        '    <optgroup label="' + t('form.manage', 'Управление участником') + '">' +
        '      <option value="untimeout">' + t('action.untimeout') + '</option>' +
        '      <option value="unban">' + t('action.unban') + '</option>' +
        '      <option value="nick">' + t('action.nick') + '</option>' +
        '      <option value="clear_strikes">' + t('action.clear_strikes') + '</option>' +
        '    </optgroup>' +
        '  </select>' +
        '</div>' +
        '<div id="dap-m-dur-box" class="dap-form-field dap-form-options">' +
        '  <label for="dap-m-dur-sec">' + t('form.duration', 'Длительность') + '</label>' +
        '  <div class="dap-duration-chips" id="dap-m-dur-chips">' +
        '    <button type="button" class="dap-quick-chip" data-sec="600">' + t('form.tenMin', '10 мин') + '</button>' +
        '    <button type="button" class="dap-quick-chip active" data-sec="3600">' + t('form.oneHour', '1 час') + '</button>' +
        '    <button type="button" class="dap-quick-chip" data-sec="21600">' + t('form.sixHours', '6 часов') + '</button>' +
        '    <button type="button" class="dap-quick-chip" data-sec="86400">' + t('form.oneDay', '1 день') + '</button>' +
        '    <button type="button" class="dap-quick-chip" data-sec="604800">' + t('form.sevenDays', '7 дней') + '</button>' +
        '    <button type="button" class="dap-quick-chip" data-sec="0">' + t('form.forever', 'Навсегда') + '</button>' +
        '  </div>' +
        '  <div class="dap-seconds"><input type="number" id="dap-m-dur-sec" class="inp" value="3600" min="0" step="1"><span>' + t('form.seconds', 'секунд') + '</span></div>' +
        '</div>' +
        '<div id="dap-m-nick-box" class="dap-form-field" hidden>' +
        '  <label for="dap-m-newnick">' + t('form.nickname', 'Новый никнейм') + '</label>' +
        '  <input type="text" id="dap-m-newnick" class="inp" placeholder="' + t('form.nicknameHint', 'Пусто — сбросить никнейм') + '">' +
        '</div>' +
        '<div class="dap-form-field">' +
        '  <label for="dap-m-reason">' + t('form.reason', 'Причина') + '</label>' +
        '  <textarea id="dap-m-reason" class="inp" rows="3" placeholder="' + t('form.reasonHint', 'Причина для участника и журнала модерации') + '">' + esc(opts.reason || '') + '</textarea>' +
        '</div>' +
        '<p class="dap-form-hint">' + t('form.queueHint', 'Команда поступит в очередь бота. Результат появится во вкладке «Очередь действий».') + '</p>' +
        '<div id="dap-m-status" class="dap-form-status" role="status"></div>' +
        '<div class="dap-form-footer">' +
        '  <button type="button" class="btn-secondary" id="dap-m-cancel">' + t('form.cancel', 'Отмена') + '</button>' +
        '  <button type="button" class="btn-primary" id="dap-m-submit">' + t('form.submit', 'Отправить действие') + '</button>' +
        '</div>';

      var actSel = $('#dap-m-action', body);
      var durBox = $('#dap-m-dur-box', body);
      var nickBox = $('#dap-m-nick-box', body);
      var durInp = $('#dap-m-dur-sec', body);

      function syncFormVisibility() {
        var a = actSel.value;
        durBox.hidden = a !== 'timeout' && a !== 'ban';
        nickBox.hidden = a !== 'nick';
        var forever = $('#dap-m-dur-chips button[data-sec="0"]', body);
        forever.hidden = a !== 'ban';
        if (a === 'timeout' && Number(durInp.value) <= 0) {
          durInp.value = '3600';
          $$('#dap-m-dur-chips button', body).forEach(function (b) { b.classList.toggle('active', b.dataset.sec === '3600'); });
        }
      }
      actSel.addEventListener('change', syncFormVisibility);
      syncFormVisibility();

      $$('#dap-m-dur-chips button', body).forEach(function (btn) {
        btn.addEventListener('click', function () {
          $$('#dap-m-dur-chips button', body).forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          durInp.value = btn.dataset.sec;
        });
      });

      $('#dap-m-cancel', body).addEventListener('click', hide);

      $('#dap-m-submit', body).addEventListener('click', function () {
        var btn = $('#dap-m-submit', body);
        var st = $('#dap-m-status', body);
        var act = actSel.value;
        var dur = (act === 'timeout' || act === 'ban') ? parseInt(durInp.value || '0', 10) : 0;
        var reason = ($('#dap-m-reason', body).value || '').trim();
        var newNick = ($('#dap-m-newnick', body).value || '').trim();
        if (act === 'timeout' && (!Number.isInteger(dur) || dur < 1 || dur > 2419200)) {
          st.style.color = '#fc8181';
          st.textContent = 'Длительность тайм-аута: от 1 секунды до 28 дней.';
          btn.disabled = false;
          btn.textContent = t('form.submit', 'Отправить действие');
          return;
        }
        if (act === 'ban' && (!Number.isInteger(dur) || dur < 0)) {
          st.style.color = '#fc8181';
          st.textContent = 'Укажите корректную длительность бана.';
          btn.disabled = false;
          btn.textContent = t('form.submit', 'Отправить действие');
          return;
        }
        if (!viewStillMatches()) {
          st.textContent = t('work.stale');
          return;
        }
        confirmDapAction({
          icon: '⚖️',
          title: dapActionLabel(act),
          subtitle: userName + ' · ' + uid,
          reason: reason,
          submit: t('confirm.send')
        }, function () {
          if (!viewStillMatches()) {
            if (body.isConnected) st.textContent = t('work.stale');
            return;
          }
          btn.disabled = true;
          btn.textContent = t('form.sending', 'Передача боту…');
          postJson('/api/dap/action', {
            type: 'execute_action',
            guildId: gid,
            userId: uid,
            violationId: vid,
            action: act,
            durationSeconds: dur,
            reason: reason,
            newNick: newNick
          }).then(function (res) {
            if (!body.isConnected || !viewStillMatches()) return;
            btn.disabled = false;
            btn.textContent = t('form.submit', 'Отправить действие');
            if (res && res.ok) {
              showToast(t('toast.queued', '⏳ Действие передано боту MacronuxDAM для исполнения в Discord!'));
              hide();
              if (onDone) onDone();
            } else {
              st.style.color = '#fc8181';
              st.textContent = (res && res.error) || 'Ошибка применения действия';
            }
          }).catch(function () {
            if (!body.isConnected || !viewStillMatches()) return;
            btn.disabled = false;
            btn.textContent = t('form.submit', 'Отправить действие');
            st.textContent = t('work.stale');
          });
        });
      });
    }, 'dap-action-modal');
  }

  // ════════════════════════════════════════════════════════════
  // 3. ДОСЬЕ УЧАСТНИКА DISCORD
  // ════════════════════════════════════════════════════════════
  function openDapUserModal(guildId, userId, onUpdated) {
    var viewGuild = dapState.guild;
    var viewTab = dapState.tab;
    var rootAtOpen = document.getElementById('dap-root');
    var getNavigationSeq = P.getNavigationSeq || P.getViewSeq;
    var navigationSeq = getNavigationSeq();
    function viewStillMatches() {
      return !!rootAtOpen && rootAtOpen.isConnected && document.getElementById('dap-root') === rootAtOpen &&
        navigationSeq === getNavigationSeq() && viewGuild === dapState.guild && viewTab === dapState.tab;
    }
    openModal('👤 Досье участника Discord · ' + userId, function (body, hide) {
      body.innerHTML = '<div class="empty">Загрузка истории нарушений…</div>';
      var gParam = (guildId && guildId !== '_all') ? guildId : (dapState.guild !== '_all' ? dapState.guild : '');
      j('/api/dap/user?guild=' + encodeURIComponent(gParam) + '&user=' + encodeURIComponent(userId)).then(function (u) {
        if (!body.isConnected || !viewStillMatches()) return;
        if (!u || u.error) {
          body.innerHTML = '<div class="link-alert err">' + esc((u && u.error) || 'Не удалось загрузить профиль') + '</div>';
          return;
        }

        var prof = u.profile || {};
        var displayName = prof.displayName || prof.username || userId;
        var username = prof.username ? '@' + prof.username : '';
        var avatarUrl = prof.avatarUrl || '';
        var roleBadge = prof.topRoleName
          ? '<span class="dap-role-pill" style="background:' + roleColor(prof.topRoleColor) + '22;color:' + roleColor(prof.topRoleColor) + ';border:1px solid ' + roleColor(prof.topRoleColor) + '44">' +
            '<span class="dap-role-dot" style="background:' + roleColor(prof.topRoleColor) + '"></span>' + esc(prof.topRoleName) + '</span>'
          : '';

        var html =
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding:12px 14px;background:var(--inset);border-radius:10px;border:1px solid var(--line)">' +
          '  <div style="display:flex;align-items:center;gap:12px">' +
          renderUserAvatar(avatarUrl, displayName, 46) +
          '    <div>' +
          '      <div style="display:flex;align-items:center;gap:8px">' +
          '        <span style="font-weight:700;font-size:15px;color:var(--text)">' + esc(displayName) + '</span>' +
          (username ? '<span style="font-size:12px;color:var(--muted)">' + esc(username) + '</span>' : '') +
          roleBadge +
          (prof.isModerator ? '<span class="dap-badge ok">🛡️ Staff</span>' : '') +
          (prof.isBot ? '<span class="dap-badge automod">🤖 BOT</span>' : '') +
          '      </div>' +
          '      <div style="font-size:11.5px;color:var(--muted);margin-top:2px">Discord ID: <code>' + esc(u.userId) + '</code>' +
          (prof.joinedAt ? ' · На сервере с: ' + esc(prof.joinedAt.slice(0, 10)) : '') + '</div>' +
          '    </div>' +
          '  </div>' +
          '  <div style="display:flex;gap:8px">' +
          '    <button type="button" class="btn-primary" id="dap-u-punish" style="padding:6px 12px;font-size:12px">⚡ Наказать</button>' +
          '    <button type="button" class="btn-secondary" id="dap-u-reset" style="padding:6px 12px;font-size:12px;color:#fc8181;border-color:rgba(245,101,101,.4)">🔄 Сбросить страйки</button>' +
          '  </div>' +
          '</div>' +
          '<div class="kpi-row" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px">' +
          '  <div class="kpi"><div class="kpi-label">Реальных страйков</div><div class="kpi-val">' + fmt(u.realViolations) + '</div></div>' +
          '  <div class="kpi"><div class="kpi-label">Всего срабатываний</div><div class="kpi-val">' + fmt(u.totalViolations) + '</div></div>' +
          '  <div class="kpi"><div class="kpi-label">Снято / Пропущено</div><div class="kpi-val">' + fmt(u.dismissedCount) + ' / ' + fmt(u.skippedCount) + '</div></div>' +
          '  <div class="kpi"><div class="kpi-label">Рекомендация</div><div class="kpi-val" style="font-size:14px;color:#f6ad55">' + esc(u.suggestedPunishment || '—') + '</div></div>' +
          '</div>' +
          '<div class="tbl-wrap" style="max-height:360px;overflow-y:auto">' +
          '  <table class="tbl"><thead><tr><th>#</th><th>Дата</th><th>Правило</th><th>Метод</th><th>Канал</th><th>Сообщение</th><th>Решение</th></tr></thead><tbody id="dap-u-tbody"></tbody></table>' +
          '</div>';

        body.innerHTML = html;

        var tb = $('#dap-u-tbody', body);
        (u.violations || []).forEach(function (v) {
          var tr = document.createElement('tr');
          var jumpUrl = discordJumpUrl(v.jumpUrl);
          var jumpBtn = jumpUrl ? '<a href="' + esc(jumpUrl) + '" target="_blank" rel="noopener noreferrer" class="dap-jump-btn" style="margin-left:4px">🔗</a>' : '';
          tr.innerHTML =
            '<td>#' + esc(String(v.id)) + '</td>' +
            '<td style="white-space:nowrap;font-size:11.5px;color:var(--muted)">' + esc((v.createdAt || '').slice(0, 16)) + '</td>' +
            '<td><b>' + esc(v.ruleId) + '</b> <span style="color:var(--muted);font-size:11.5px">' + esc(v.ruleTitle || '') + '</span></td>' +
            '<td>' + dapMethodBadge(v.method) + '</td>' +
            '<td><span style="font-size:11.5px;color:var(--muted)">#' + esc(v.channelName || v.channelId || '—') + '</span>' + jumpBtn + '</td>' +
            '<td><div class="dap-msg-box">' + esc(v.originalText || '—') + '</div></td>' +
            '<td><span class="dap-status ' + esc(v.action || 'pending') + '">' + esc(dapActionLabel(v.action)) + '</span></td>';
          tb.appendChild(tr);
        });

        $('#dap-u-punish', body).addEventListener('click', function () {
          openDapActionModal({
            guildId: gParam,
            userId: userId,
            userName: displayName,
            userAvatarUrl: avatarUrl
          }, function () {
            hide();
            if (onUpdated) onUpdated();
          });
        });

        $('#dap-u-reset', body).addEventListener('click', function () {
          confirmDapAction({
            icon: '↻',
            title: t('action.clear_strikes'),
            subtitle: displayName + ' · ' + userId,
            reason: t('action.clear_strikes')
          }, function () {
            if (!body.isConnected || !viewStillMatches()) return;
            postJson('/api/dap/action', { type: 'reset_user', guildId: gParam, userId: userId }).then(function (res) {
              if (!body.isConnected || !viewStillMatches()) return;
              if (res && res.ok) {
                showToast(t('toast.queued', '⏳ Сброс страйков отправлен боту!'));
                hide();
                if (onUpdated) onUpdated();
              } else {
                showToast((res && res.error) || t('work.stale'));
              }
            }).catch(function () {
              if (body.isConnected && viewStillMatches()) showToast(t('work.stale'));
            });
          });
        });
      }).catch(function () {
        if (!body.isConnected || !viewStillMatches()) return;
        body.innerHTML = '<div class="link-alert err">' + esc(t('work.stale')) + '</div>';
      });
    }, 'modal-wide');
  }

  // ════════════════════════════════════════════════════════════
  // 4. ГЛАВНАЯ ТОЧКА ВХОДА (runDap)
  // ════════════════════════════════════════════════════════════
  function runDap(seq) {
    dapState.viewSeq = seq;
    var days = dapState.days || 30;
    var box = staticShell(
      '<div class="dap-root" id="dap-root">' +
      '  <header class="dap-header">' +
      '    <div class="dap-heading"><div class="dap-eyebrow">DISCORD · MACRONUXDAM</div><h1 class="view-title">' + t('dap.title', '🛡️ MacronuxDAM') + '</h1><p class="view-sub">' + t('dap.sub') + '</p></div>' +
      '    <div class="dap-header-tools">' +
      '      <div class="dap-live-status"><span class="dot" id="dap-proc-dot"></span><span id="dap-proc-text" aria-live="polite">' + t('proc.checking') + '</span></div>' +
      '      <details class="dap-proc-bar" id="dap-proc-bar"><summary>' + t('proc.module') + ' <span aria-hidden="true">⌄</span></summary>' +
      '        <div class="dap-process-actions">' +
      '          <button type="button" class="dap-act-btn ok" data-bot-cmd="start">' + t('proc.start') + '</button>' +
      '          <button type="button" class="dap-act-btn" data-bot-cmd="restart">' + t('proc.restart') + '</button>' +
      '          <button type="button" class="dap-act-btn danger" data-bot-cmd="stop">' + t('proc.stop') + '</button>' +
      '          <button type="button" class="dap-act-btn" id="dap-btn-modmgr">' + t('proc.module') + '</button>' +
      '        </div>' +
      '      </details>' +
      '    </div>' +
      '  </header>' +
      '  <nav class="dap-toolbar" aria-label="MacronuxDAM">' +
      '    <div class="dap-subtabs" id="dap-subtabs" role="tablist">' +
      '      <button type="button" class="dap-tab" role="tab" data-dtab="overview">' + t('dap.tab.overview') + '</button>' +
      '      <button type="button" class="dap-tab" role="tab" data-dtab="analytics">' + t('dap.tab.analytics') + '</button>' +
      '      <button type="button" class="dap-tab" role="tab" data-dtab="actions">' + t('dap.tab.actions') + '</button>' +
      '      <button type="button" class="dap-tab" role="tab" data-dtab="server">' + t('dap.tab.server') + '</button>' +
      '      <button type="button" class="dap-tab" role="tab" data-dtab="banwords">' + t('dap.tab.banwords') + '</button>' +
      '      <button type="button" class="dap-tab" role="tab" data-dtab="settings">' + t('dap.tab.settings') + '</button>' +
      '      <button type="button" class="dap-tab" role="tab" data-dtab="logs">' + t('dap.tab.logs') + '</button>' +
      '    </div>' +
      '  </nav>' +
      '  <div class="dap-context-bar">' +
      '    <label for="dap-guild-sel">' + t('guild.label') + '</label><select id="dap-guild-sel" class="sel"></select>' +
      '    <div class="dap-period-control" id="dap-period-control"><label for="dap-period">' + t('work.period') + '</label><select id="dap-period" class="sel">' +
      '      <option value="7">' + t('work.period.7') + '</option><option value="30">' + t('work.period.30') + '</option><option value="90">' + t('work.period.90') + '</option></select></div>' +
      '    <button type="button" class="btn-secondary" id="dap-export-btn">' + t('export.csv') + '</button>' +
      '  </div>' +
      '  <div class="dap-page-status" id="dap-page-status" role="status" aria-live="polite"></div>' +
      '  <div id="dap-pane" role="tabpanel"></div>' +
      '</div>'
    );

    var root = $('#dap-root', box);
    var pane = $('#dap-pane', box);
    if (!root || !pane) return;
    var alreadyMounted = root.dataset.dapMounted === 'true';
    root.dataset.dapMounted = 'true';

    function isCurrent(guild, tab, expectedDays) {
      return box.isConnected && dapState.viewSeq === P.getViewSeq() &&
        (guild === undefined || dapState.guild === guild) &&
        (tab === undefined || dapState.tab === tab) &&
        (expectedDays === undefined || dapState.days === expectedDays);
    }
    var getNavigationSeq = P.getNavigationSeq || P.getViewSeq;
    var navigationSeqAtRun = getNavigationSeq();

    function syncTabsUi() {
      $$('#dap-subtabs .dap-tab', box).forEach(function (b) {
        b.classList.toggle('active', b.dataset.dtab === dapState.tab);
        b.setAttribute('aria-selected', b.dataset.dtab === dapState.tab ? 'true' : 'false');
        b.setAttribute('tabindex', b.dataset.dtab === dapState.tab ? '0' : '-1');
      });
      var periodControl = $('#dap-period-control', box);
      if (periodControl) periodControl.hidden = dapState.tab !== 'overview' && dapState.tab !== 'analytics';
      var exportBtn = $('#dap-export-btn', box);
      if (exportBtn) exportBtn.hidden = dapState.tab !== 'overview' && dapState.tab !== 'analytics';
      var period = $('#dap-period', box);
      if (period) period.value = String(dapState.days || 30);
    }
    syncTabsUi();

    function renderProcBar(ov) {
      var p = (ov && ov.process) || {};
      var dot = $('#dap-proc-dot', box);
      var txt = $('#dap-proc-text', box);
      if (!dot || !txt) return;
      dot.classList.remove('dot-online', 'dot-offline');
      if (p.running) {
        dot.classList.add('dot-online');
        txt.innerHTML = t('proc.active', '<b>MacronuxDAM активен</b> (PID {0} · {1}) · LLM: <b>{2}</b> ({3})',
          esc(p.pid), fmtDurShort(p.uptimeSeconds || 0), esc(p.llmProvider || '—'), esc(p.llmModel || ''));
      } else {
        dot.classList.add('dot-offline');
        var dbSz = (ov && ov.dbExists) ? (fmt(ov.dbSizeKb) + ' KB') : 'not found';
        txt.innerHTML = t('proc.stopped', '<b>Процесс остановлен</b> · БД: <b>{0}</b> · LLM: <b>{1}</b>',
          dbSz, esc(p.llmProvider || '—'));
      }
    }

    function populateGuildSelect(ov) {
      var sel = $('#dap-guild-sel', box);
      if (!sel) return;
      var guilds = (ov && ov.guilds) || [];
      var cur = dapState.guild;
      sel.innerHTML = '';
      var optAll = document.createElement('option');
      optAll.value = '_all';
      optAll.textContent = t('guild.all', '🌐 Все серверы Discord ({0})', guilds.length);
      sel.appendChild(optAll);
      guilds.forEach(function (g) {
        var o = document.createElement('option');
        o.value = g.guildId;
        var name = g.guildName ? g.guildName : ('Guild ' + g.guildId);
        var extra = [];
        if (g.memberCount > 0) extra.push(fmt(g.memberCount) + ' members');
        if (g.violationsCount > 0) extra.push(fmt(g.violationsCount) + ' violations');
        o.textContent = name + (extra.length ? ' (' + extra.join(' · ') + ')' : '');
        sel.appendChild(o);
      });
      if (cur !== '_all' && !guilds.some(function (g) { return String(g.guildId) === String(cur); })) {
        dapState.guild = guilds.length === 1 ? String(guilds[0].guildId) : '_all';
        dapState.page = 0;
      }
      sel.value = dapState.guild;
    }

    function loadDapData(options) {
      options = options || {};
      var requestId = ++dapState.overviewRequestId;
      var requestedGuild = dapState.guild;
      var requestedTab = dapState.tab;
      var requestedDays = dapState.days || 30;
      var wasRendered = pane.dataset.dapRenderKey === (requestedTab + '|' + requestedGuild + '|' + requestedDays);
      j('/api/dap/overview?guild=' + encodeURIComponent(requestedGuild) + '&days=' + requestedDays).then(function (ov) {
        if (!isCurrent(requestedGuild, requestedTab, requestedDays) || requestId !== dapState.overviewRequestId) return;
        if (!ov) {
          var emptyStatus = $('#dap-page-status', box);
          if (emptyStatus) { emptyStatus.textContent = t('work.stale'); emptyStatus.classList.add('is-error'); }
          if (!wasRendered && pane.isConnected) pane.innerHTML = '<div class="dap-list-state" role="alert">' + esc(t('work.stale')) + '</div>';
          return;
        }
        if (ov.__networkError || ov.error) {
          var status = $('#dap-page-status', box);
          status.textContent = wasRendered ? t('work.stale') : (ov.error || t('work.loading'));
          status.classList.toggle('is-error', true);
          if (!wasRendered) pane.innerHTML = '<div class="dap-list-state">' + esc(ov.error || t('work.loading')) + '</div>';
          return;
        }
        $('#dap-page-status', box).textContent = '';
        $('#dap-page-status', box).classList.remove('is-error');
        dapState.lastLoadedAt = Date.now();
        renderProcBar(ov);
        populateGuildSelect(ov);
        if (requestedGuild !== dapState.guild) { loadDapData(); return; }
        if (!pane) return;

        if (!ov.dbExists && dapState.tab !== 'settings') {
          var notInstalledKey = 'not-installed|' + dapState.guild;
          if (pane.dataset.dapRenderKey !== notInstalledKey) renderNotInstalledBanner(pane, ov, loadDapData, function () { return isCurrent(requestedGuild, requestedTab, requestedDays); });
          pane.dataset.dapRenderKey = notInstalledKey;
          return;
        }

        var renderKey = dapState.tab + '|' + dapState.guild + '|' + requestedDays;
        var reload = function () { if (dapState.load) dapState.load(); };
        if (dapState.tab === 'overview') {
          if (pane.dataset.dapRenderKey === renderKey && dapState.overviewController) {
            dapState.overviewController.update(ov);
            dapState.overviewController.refreshCases({ background: !!options.background });
          } else {
            clearCharts();
            dapState.overviewController = renderDapOverview(pane, ov, requestedDays, reload, function (g, tab, d) { return isCurrent(g, tab, d); });
            pane.dataset.dapRenderKey = renderKey;
          }
        } else {
          if (options.background && pane.dataset.dapRenderKey === renderKey) {
            if (dapState.tab === 'logs' && dapState.logsController) dapState.logsController.refresh();
            return;
          }
          clearCharts();
          pane.dataset.dapRenderKey = renderKey;
          dapState.overviewController = null;
          dapState.logsController = null;
          if (dapState.tab === 'actions') renderDapActionsQueue(pane, ov, reload, function (g, tab) { return isCurrent(g, tab); });
          else if (dapState.tab === 'analytics') renderDapAnalytics(pane, ov, requestedDays, reload, function (g, tab, d) { return isCurrent(g, tab, d); });
          else if (dapState.tab === 'server') renderDapServerStructure(pane, ov, reload);
          else if (dapState.tab === 'banwords') renderDapBanwords(pane, ov, reload, function (g, tab) { return isCurrent(g, tab); });
          else if (dapState.tab === 'settings') renderDapSettings(pane, ov, reload, function (g, tab) { return isCurrent(g, tab); });
          else if (dapState.tab === 'logs') dapState.logsController = renderDapLogs(pane, ov, reload, function (g, tab) { return isCurrent(g, tab); });
        }
      }).catch(function () {
        if (!isCurrent(requestedGuild, requestedTab, requestedDays) || requestId !== dapState.overviewRequestId) return;
        var status = $('#dap-page-status', box);
        if (status) {
          status.textContent = t('work.stale');
          status.classList.add('is-error');
        }
        if (!wasRendered && pane.isConnected) pane.innerHTML = '<div class="dap-list-state" role="alert">' + esc(t('work.stale')) + '</div>';
      });
    }

    function renderNotInstalledBanner(pane, ov, reloadAll, isLive) {
      pane.innerHTML =
        '<div class="panel" style="max-width:780px;margin:20px auto">' +
        '  <div class="view-title" style="font-size:18px;margin-bottom:8px">Бот MacronuxDAM ещё не развернут или база данных modbot.db не найдена</div>' +
        '  <p style="color:var(--muted);font-size:13px;margin-bottom:14px;line-height:1.5">Текущая папка: <code>' + esc(ov.botDir || '/opt/pmx-bot') + '</code>. Вы можете <b>скачать MacronuxDAM из GitHub в один клик</b>, либо запустить автопоиск по стандартным путям VPS.</p>' +
        '  <div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '    <button type="button" class="btn-primary" id="dap-quick-download" style="background:linear-gradient(135deg,#7f5af0,#2cb67d)">📥 Скачать и установить MacronuxDAM (GitHub)</button>' +
        '    <button type="button" class="btn-secondary" id="dap-auto-discover">🔍 Найти бота на сервере</button>' +
        '    <button type="button" class="btn-secondary" id="dap-go-settings">⚙️ Настройки и выбор папки</button>' +
        '  </div>' +
        '  <div id="dap-quick-disc-res" style="margin-top:14px"></div>' +
        '</div>';

      $('#dap-go-settings', pane).addEventListener('click', function () {
        navigateDapTab('settings');
      });

      $('#dap-quick-download', pane).addEventListener('click', function () {
        var btn = $('#dap-quick-download', pane);
        var resBox = $('#dap-quick-disc-res', pane);
        btn.disabled = true;
        resBox.innerHTML = '<div style="font-size:12.5px;color:var(--muted)">⏳ Скачивание MacronuxDAM из GitHub и создание структуры базы данных…</div>';
        postJson('/api/dap/action', { type: 'download_bot' }).then(function (res) {
          if (!isLive()) return;
          btn.disabled = false;
          if (res && res.ok) {
            resBox.innerHTML = '<div style="color:#5ce6a8;font-size:13px;font-weight:600">✅ ' + esc(res.message || 'MacronuxDAM установлен!') + '</div>';
            setTimeout(loadDapData, 600);
          } else {
            resBox.innerHTML = '<div style="color:#fc8181;font-size:12.5px">❌ ' + esc((res && res.error) || 'Ошибка скачивания') + '</div>';
          }
        }).catch(function () {
          if (!isLive()) return;
          btn.disabled = false;
          resBox.textContent = t('work.stale');
        });
      });

      $('#dap-auto-discover', pane).addEventListener('click', function () {
        var btn = $('#dap-auto-discover', pane);
        var resBox = $('#dap-quick-disc-res', pane);
        btn.disabled = true;
        resBox.innerHTML = '<div style="font-size:12.5px;color:var(--muted)">⏳ Сканирование путей VPS и systemd…</div>';
        postJson('/api/dap/action', { type: 'discover', autoApply: true }).then(function (res) {
          if (!isLive()) return;
          btn.disabled = false;
          if (res && res.autoApplied) {
            resBox.innerHTML = '<div style="color:#5ce6a8;font-size:13px;font-weight:600">✅ Бот найден: <code>' + esc(res.appliedDir) + '</code></div>';
            setTimeout(loadDapData, 500);
          } else {
            navigateDapTab('settings');
          }
        }).catch(function () {
          if (!isLive()) return;
          btn.disabled = false;
          resBox.textContent = t('work.stale');
        });
      });
    }

    dapState.load = loadDapData;
    if (!root.dataset.dapBound) {
      on($('#dap-subtabs', box), 'click', function (e) {
        var b = e.target.closest('.dap-tab');
        if (!b) return;
        navigateDapTab(b.dataset.dtab);
      });
      on($('#dap-subtabs', box), 'keydown', function (e) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        var tabs = $$('.dap-tab', box);
        var current = tabs.indexOf(document.activeElement);
        if (current < 0) return;
        e.preventDefault();
        var target = e.key === 'Home' ? 0 : (e.key === 'End' ? tabs.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length);
        tabs[target].focus();
        tabs[target].click();
      });
      on($('#dap-guild-sel', box), 'change', function (e) {
        dapState.guild = e.target.value || '_all';
        dapState.page = 0;
        dapState.selectedViolationId = null;
        root.classList.remove('dap-detail-open');
        if (dapState.load) dapState.load();
      });
      on($('#dap-period', box), 'change', function (e) {
        dapState.days = [7, 30, 90].includes(parseInt(e.target.value, 10)) ? parseInt(e.target.value, 10) : 30;
        dapState.page = 0;
        dapState.selectedViolationId = null;
        root.classList.remove('dap-detail-open');
        if (dapState.load) dapState.load();
      });
      on($('#dap-export-btn', box), 'click', function () {
        window.open('/api/dap/export?guild=' + encodeURIComponent(dapState.guild) + '&days=' + (dapState.days || 30), '_blank', 'noopener');
      });
      on($('#dap-btn-modmgr', box), 'click', function () { if (P.openModulesModal) P.openModulesModal(); });
      on($('#dap-proc-bar', box), 'click', function (e) {
        var btn = e.target.closest('[data-bot-cmd]');
        if (!btn || btn.disabled) return;
        var cmd = btn.dataset.botCmd;
        var actionGuild = dapState.guild;
        var actionTab = dapState.tab;
        var actionNavigationSeq = getNavigationSeq();
        function actionStillCurrent() {
          return root.isConnected && document.getElementById('dap-root') === root &&
            actionNavigationSeq === getNavigationSeq() && actionGuild === dapState.guild && actionTab === dapState.tab;
        }
        function sendControl() {
          if (!actionStillCurrent()) return;
          btn.disabled = true;
          function settleControl() {
            if (root.isConnected && btn.isConnected) btn.disabled = false;
          }
          postJson('/api/dap/action', { type: 'bot_control', cmd: cmd }).then(function (res) {
            settleControl();
            if (!actionStillCurrent()) return;
            if (res && res.ok) { if (dapState.load) dapState.load(); }
            else showToast((res && res.error) || 'Не удалось управлять ботом');
          }).catch(function () {
            settleControl();
            if (!actionStillCurrent()) return;
            showToast(t('work.stale'));
          });
        }
        if (cmd === 'stop') confirmDapAction({ icon: '⏹', title: t('confirm.stop'), subtitle: t('dap.title'), submit: t('proc.stop') }, sendControl);
        else sendControl();
      });
      root.dataset.dapBound = 'true';
    }
    syncTabsUi();
    if (dapState.refreshTimer) clearInterval(dapState.refreshTimer);
    dapState.refreshTimer = setInterval(function () {
      if (!root.isConnected || document.getElementById('dap-root') !== root || navigationSeqAtRun !== getNavigationSeq()) {
        clearInterval(dapState.refreshTimer);
        dapState.refreshTimer = 0;
        return;
      }
      if (dapState.tab === 'overview' && dapState.load) dapState.load({ background: true });
    }, 30000);
    loadDapData({ background: alreadyMounted });
  }

  function disposeDap() {
    if (dapState.refreshTimer) clearInterval(dapState.refreshTimer);
    dapState.refreshTimer = 0;
    dapState.load = null;
    dapState.overviewController = null;
    dapState.overviewRequestId++;
    dapState.violationsRequestId++;
    dapState.queueRequestId++;
    dapState.banwordsRequestId++;
    dapState.logsRequestId++;
  }

  // ════════════════════════════════════════════════════════════
  // 5. ВКЛАДКА 1: ОБЗОР И МОДЕРАЦИЯ (Overview & Live Feed)
  // ════════════════════════════════════════════════════════════
  function renderDapOverview(pane, ov, days, reloadAll, isLive) {
    var guild = dapState.guild;
    var rulesCatalog = ov.rulesCatalog || [];
    var ruleOptions = '<option value="all">' + t('filter.rule.all') + '</option>' + rulesCatalog.map(function (r) {
      return '<option value="' + esc(r.id) + '"' + (dapState.rule === r.id ? ' selected' : '') + '>' + esc(r.id + ' · ' + r.title) + '</option>';
    }).join('');

    pane.innerHTML =
      '<section class="dap-work-head"><div><div class="dap-eyebrow">' + esc(t('guild.label')) + '</div><h2>' + t('work.title') + '</h2><p>' + t('work.sub') + '</p></div>' +
      '<div class="dap-work-head-tools"><span id="dap-updated-at" class="dap-updated-at"></span><button type="button" class="btn-secondary" id="dap-refresh">↻ ' + t('work.refresh') + '</button></div></section>' +
      '<div class="dap-summary">' +
      '  <div class="dap-summary-item dap-summary-attention"><span>' + t('kpi.pending') + '</span><strong id="dap-kpi-pending">—</strong><small>' + t('kpi.pending.sub') + '</small></div>' +
      '  <div class="dap-summary-item"><span>' + t('kpi.total') + '</span><strong id="dap-kpi-total">—</strong><small id="dap-kpi-real">—</small></div>' +
      '  <div class="dap-summary-item"><span>' + t('kpi.punished') + '</span><strong id="dap-kpi-punished">—</strong><small>' + t('kpi.punished.sub') + '</small></div>' +
      '  <div class="dap-summary-item"><span>' + t('kpi.accuracy') + '</span><strong id="dap-kpi-accuracy">—</strong><small id="dap-kpi-dismissed">—</small></div>' +
      '</div>' +
      '<section class="dap-workbench">' +
      '  <div class="dap-workbench-head"><div><h3>' + t('work.queue') + '</h3><p id="dap-case-count">' + t('tbl.loading') + '</p></div>' +
      '    <div class="dap-work-switch" role="group" aria-label="' + t('filter.status.all') + '">' +
      '      <button type="button" id="dap-show-pending" class="dap-switch-btn' + (dapState.status === 'pending' ? ' active' : '') + '" aria-pressed="' + (dapState.status === 'pending') + '">' + t('work.pending') + ' <span id="dap-pending-count">—</span></button>' +
      '      <button type="button" id="dap-show-all" class="dap-switch-btn' + (dapState.status !== 'pending' ? ' active' : '') + '" aria-pressed="' + (dapState.status !== 'pending') + '">' + t('work.all') + '</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="dap-filters">' +
      '    <input type="search" id="dap-f-q" class="inp" aria-label="' + t('work.search') + '" placeholder="' + t('work.search') + '" value="' + esc(dapState.q) + '">' +
      '    <select id="dap-f-status" class="sel" aria-label="' + t('filter.status.all') + '">' +
      '      <option value="all"' + (dapState.status === 'all' ? ' selected' : '') + '>' + t('filter.status.all') + '</option>' +
      '      <option value="pending"' + (dapState.status === 'pending' ? ' selected' : '') + '>' + t('filter.status.pending') + '</option>' +
      '      <option value="punished"' + (dapState.status === 'punished' ? ' selected' : '') + '>' + t('filter.status.punished') + '</option>' +
      '      <option value="dismissed"' + (dapState.status === 'dismissed' ? ' selected' : '') + '>' + t('filter.status.dismissed') + '</option>' +
      '      <option value="skipped"' + (dapState.status === 'skipped' ? ' selected' : '') + '>' + t('filter.status.skipped') + '</option>' +
      '    </select>' +
      '    <select id="dap-f-method" class="sel" aria-label="' + t('filter.method.all') + '">' +
      '      <option value="all"' + (dapState.method === 'all' ? ' selected' : '') + '>' + t('filter.method.all') + '</option>' +
      '      <option value="regex"' + (dapState.method === 'regex' ? ' selected' : '') + '>Regex</option>' +
      '      <option value="llm"' + (dapState.method === 'llm' ? ' selected' : '') + '>LLM</option>' +
      '      <option value="user_report"' + (dapState.method === 'user_report' ? ' selected' : '') + '>' + t('filter.method.reports', 'Жалобы') + '</option>' +
      '    </select>' +
      '    <select id="dap-f-rule" class="sel" aria-label="' + t('filter.rule.all') + '">' + ruleOptions + '</select>' +
      '    <button type="button" class="dap-filter-reset" id="dap-filter-reset">' + t('work.filterReset') + '</button>' +
      '  </div>' +
      '  <div class="dap-case-status" id="dap-cases-status" role="status" aria-live="polite"></div>' +
      '  <div class="dap-review-layout">' +
      '    <div class="dap-review-list" id="dap-review-list"><div id="dap-case-list" class="dap-case-list" role="list" aria-label="' + t('work.queue') + '"></div><div class="dap-case-pager" id="dap-viol-pager"></div></div>' +
      '    <section class="dap-review-detail" id="dap-case-detail" aria-live="polite"><div class="dap-detail-empty">' + t('work.emptyDetail') + '</div></section>' +
      '  </div>' +
      '</section>';

    function updateSummary(data) {
      var k = data.kpis || {};
      $('#dap-kpi-pending', pane).textContent = fmt(k.pendingCount);
      $('#dap-kpi-total', pane).textContent = fmt(k.totalViolations);
      $('#dap-kpi-real', pane).textContent = t('kpi.real', null, fmt(k.realViolations));
      $('#dap-kpi-punished', pane).textContent = fmt(k.punishedCount);
      $('#dap-kpi-accuracy', pane).textContent = fmt(k.accuracyPct) + '%';
      $('#dap-kpi-dismissed', pane).textContent = t('kpi.accuracy.sub', null, fmt(k.dismissedCount));
      $('#dap-pending-count', pane).textContent = fmt(k.pendingCount);
      $('#dap-updated-at', pane).textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    var list = $('#dap-case-list', pane);
    var detail = $('#dap-case-detail', pane);
    var latestRows = [];
    var latestTotal = 0;

    function renderDetail(v) {
      if (!v) {
        detail.innerHTML = '<div class="dap-detail-empty">' + t('work.emptyDetail') + '</div>';
        return;
      }
      var index = latestRows.findIndex(function (row) { return String(row.id) === String(v.id); });
      var userName = v.userDisplayName || v.userName || v.userId;
      var action = v.action || 'pending';
      var isPending = action === 'pending';
      var jumpUrl = discordJumpUrl(v.jumpUrl);
      var translated = v.translatedText || '';
      var original = v.originalText || v.messageSnapshot || '';
      var showTranslation = translated.trim() && translated.trim() !== original.trim();
      var rolePill = v.topRoleName
        ? '<span class="dap-role-pill" style="background:' + roleColor(v.topRoleColor) + '22;color:' + roleColor(v.topRoleColor) + ';border:1px solid ' + roleColor(v.topRoleColor) + '44"><span class="dap-role-dot" style="background:' + roleColor(v.topRoleColor) + '"></span>' + esc(v.topRoleName) + '</span>'
        : '';
      var previousId = index > 0 ? latestRows[index - 1].id : '';
      var nextId = index >= 0 && index + 1 < latestRows.length ? latestRows[index + 1].id : '';
      detail.innerHTML =
        '<div class="dap-detail-top"><button type="button" class="dap-case-back" id="dap-case-back">← ' + t('work.caseBack') + '</button><span class="dap-eyebrow">' + t('work.selected') + ' · #' + esc(v.id) + '</span>' +
        '<div class="dap-detail-nav"><button type="button" id="dap-case-prev" aria-label="' + t('work.casePrev') + '"' + (!previousId ? ' disabled' : '') + '>←</button><button type="button" id="dap-case-next" aria-label="' + t('work.caseNext') + '"' + (!nextId ? ' disabled' : '') + '>→</button></div></div>' +
        '<div class="dap-detail-member">' + renderUserAvatar(v.userAvatarUrl, userName, 46) +
        '  <div><button type="button" class="dap-member-link" id="dap-detail-profile">' + esc(userName) + '</button><div class="dap-detail-member-sub">' + esc(v.userName && v.userName !== userName ? '@' + v.userName : v.userId) + '</div></div>' + rolePill + '</div>' +
        '<div class="dap-detail-meta">' +
        '  <div><span>' + t('work.rule') + '</span><strong>' + esc(v.ruleId || '—') + ' · ' + esc(v.ruleTitle || '—') + '</strong></div>' +
        '  <div><span>' + t('tbl.method') + '</span><strong>' + dapMethodBadge(v.method) + '</strong></div>' +
        '  <div><span>' + t('work.channel') + '</span><strong>#' + esc(v.channelName || v.channelId || '—') + '</strong></div>' +
        '  <div><span>' + t('work.detected') + '</span><strong>' + esc((v.createdAt || '').slice(0, 16)) + '</strong></div>' +
        '  <div><span>' + t('work.status') + '</span><strong><span class="dap-status ' + esc(action) + '">' + esc(violationStatusLabel(action)) + '</span></strong></div>' +
        '  <div><span>' + t('work.severity') + '</span><strong class="dap-sev-' + esc(v.severity || 'low') + '">' + esc(v.severity || '—') + '</strong></div>' +
        '</div>' +
        (v.reason ? '<div class="dap-detail-reason"><b>' + t('work.ruleContext') + '</b><p>' + esc(v.reason) + '</p></div>' : '') +
        '<div class="dap-detail-section"><h4>' + t('work.message') + '</h4><div class="dap-detail-message">' + esc(original || '—') + '</div>' +
        (showTranslation ? '<div class="dap-detail-translation"><span>' + t('work.translation') + (v.detectedLanguage ? ' · ' + esc(v.detectedLanguage) : '') + '</span><p>' + esc(translated) + '</p></div>' : '') + '</div>' +
        (v.moderatorName ? '<div class="dap-detail-note">' + t('work.moderator') + ': <b>' + esc(v.moderatorName) + '</b>' + (v.durationSeconds > 0 ? ' · ' + fmtDurShort(v.durationSeconds) : '') + '</div>' : '') +
        '<div class="dap-detail-links">' + (jumpUrl ? '<a href="' + esc(jumpUrl) + '" target="_blank" rel="noopener noreferrer" class="dap-jump-btn">' + t('work.discord') + ' ↗</a>' : '') + '</div>' +
        '<div class="dap-detail-actions"><div class="dap-action-heading">' + t('work.moderator') + '</div>' +
        (isPending ? '<div class="dap-decision-buttons"><button type="button" class="dap-decision-btn dap-decision-dismiss" data-decision="dismiss">' + t('act.dismiss') + '</button>' +
        '<button type="button" class="dap-decision-btn" data-decision="skip">' + t('act.skip') + '</button>' +
        '<button type="button" class="dap-decision-btn dap-decision-primary" id="dap-detail-punish">' + t('work.punish') + ' →</button></div>' : '<p class="dap-detail-note">' + esc(violationStatusLabel(action)) + '</p>') +
        '<div id="dap-detail-feedback" class="dap-action-feedback" role="status"></div></div>';

      $('#dap-case-back', detail).addEventListener('click', function () { pane.closest('.dap-root').classList.remove('dap-detail-open'); });
      $('#dap-case-prev', detail).addEventListener('click', function () { if (previousId) selectCase(previousId, true); });
      $('#dap-case-next', detail).addEventListener('click', function () { if (nextId) selectCase(nextId, true); });
      $('#dap-detail-profile', detail).addEventListener('click', function () {
        if (isLive(guild, 'overview', days)) openDapUserModal(v.guildId, v.userId, reloadAll);
      });
      var punishButton = $('#dap-detail-punish', detail);
      if (punishButton) punishButton.addEventListener('click', function () {
        if (!isLive(guild, 'overview', days)) return;
        openDapActionModal({
          guildId: v.guildId,
          userId: v.userId,
          violationId: v.id,
          userName: userName,
          userAvatarUrl: v.userAvatarUrl,
          reason: 'Нарушение п. ' + v.ruleId + (v.ruleTitle ? ' (' + v.ruleTitle + ')' : '')
        }, reloadAll);
      });
      $$('.dap-decision-btn[data-decision]', detail).forEach(function (button) {
        button.addEventListener('click', function () {
          if (!isLive(guild, 'overview', days)) return;
          var decision = button.dataset.decision;
          confirmDapAction({ icon: decision === 'dismiss' ? '✓' : '↷', title: violationStatusLabel(decision), subtitle: userName + ' · ' + v.userId, reason: v.reason || original }, function () {
            if (!isLive(guild, 'overview', days) || String(dapState.selectedViolationId) !== String(v.id)) return;
            $$('.dap-decision-btn', detail).forEach(function (b) { b.disabled = true; });
            var feedback = $('#dap-detail-feedback', detail);
            if (feedback) feedback.textContent = t('form.sending');
            postJson('/api/dap/action', { type: 'decide', violationId: v.id, action: decision, durationSeconds: 0 }).then(function (result) {
              if (!isLive(guild, 'overview', days) || !detail.isConnected || String(dapState.selectedViolationId) !== String(v.id)) return;
              if (result && result.ok) {
                if (feedback) feedback.textContent = t('toast.queued');
                showToast(t('toast.queued'));
                reloadAll();
              } else {
                if (feedback) feedback.textContent = (result && result.error) || t('work.stale');
                $$('.dap-decision-btn', detail).forEach(function (b) { b.disabled = false; });
              }
            }).catch(function () {
              if (!isLive(guild, 'overview', days) || !detail.isConnected || String(dapState.selectedViolationId) !== String(v.id)) return;
              if (feedback) feedback.textContent = t('work.stale');
              $$('.dap-decision-btn', detail).forEach(function (b) { b.disabled = false; });
            });
          });
        });
      });
    }

    function selectCase(id, scrollDetail) {
      var selected = latestRows.find(function (v) { return String(v.id) === String(id); });
      if (!selected) return;
      dapState.selectedViolationId = selected.id;
      $$('.dap-case-card', list).forEach(function (card) {
        var active = String(card.dataset.caseId) === String(selected.id);
        card.classList.toggle('active', active);
        card.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      renderDetail(selected);
      pane.closest('.dap-root').classList.add('dap-detail-open');
      if (scrollDetail && window.matchMedia('(max-width: 820px)').matches) detail.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function refreshCases(options) {
      options = options || {};
      var requestId = ++dapState.violationsRequestId;
      var requestQuery = dapState.q;
      var requestStatus = dapState.status;
      var requestMethod = dapState.method;
      var requestRule = dapState.rule;
      var requestPage = dapState.page;
      var requestGuild = guild;
      var requestDays = days;
      var oldListTop = list.scrollTop;
      var oldDetailTop = detail.scrollTop;
      var focusedCase = document.activeElement && document.activeElement.classList.contains('dap-case-card')
        ? document.activeElement.dataset.caseId : '';
      if (!options.background || !latestRows.length) list.innerHTML = '<div class="dap-list-state">' + t('tbl.loading') + '</div>';
      j('/api/dap/violations?guild=' + encodeURIComponent(requestGuild) + '&days=' + requestDays +
        '&status=' + encodeURIComponent(requestStatus) + '&method=' + encodeURIComponent(requestMethod) +
        '&rule=' + encodeURIComponent(requestRule) + '&q=' + encodeURIComponent(requestQuery) +
        '&limit=' + dapState.limit + '&offset=' + (requestPage * dapState.limit)).then(function (res) {
        if (requestId !== dapState.violationsRequestId || !isLive(requestGuild, 'overview', requestDays) || !list.isConnected) return;
        var caseStatus = $('#dap-cases-status', pane);
        if (!res) {
          if (caseStatus) caseStatus.textContent = t('work.stale');
          if (!latestRows.length) list.innerHTML = '<div class="dap-list-state" role="alert">' + esc(t('work.stale')) + '</div>';
          return;
        }
        if (res.__networkError || res.error) {
          if (caseStatus) caseStatus.textContent = latestRows.length ? t('work.stale') : (res.error || t('work.stale'));
          if (!latestRows.length) list.innerHTML = '<div class="dap-list-state">' + esc(res.error || t('work.stale')) + '</div>';
          return;
        }
        if (caseStatus) caseStatus.textContent = '';
        latestRows = res.rows || [];
        latestTotal = res.total || 0;
        var count = $('#dap-case-count', pane);
        if (count) count.textContent = t('work.count', null, fmt(latestTotal));
        list.innerHTML = '';
        if (!latestRows.length) {
          list.innerHTML = '<div class="dap-list-state">' + t('work.empty') + '</div>';
          detail.innerHTML = '<div class="dap-detail-empty">' + t('work.emptyDetail') + '</div>';
          dapState.selectedViolationId = null;
          pane.closest('.dap-root').classList.remove('dap-detail-open');
        } else {
          var selected = latestRows.find(function (v) { return String(v.id) === String(dapState.selectedViolationId); }) || latestRows[0];
          dapState.selectedViolationId = selected.id;
          latestRows.forEach(function (v, index) {
            var userName = v.userDisplayName || v.userName || v.userId;
            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'dap-case-card' + (String(v.id) === String(selected.id) ? ' active' : '');
            card.dataset.caseId = String(v.id);
            card.setAttribute('role', 'listitem');
            card.setAttribute('aria-pressed', String(v.id) === String(selected.id) ? 'true' : 'false');
            card.setAttribute('aria-label', userName + ', ' + (v.ruleTitle || v.ruleId || '') + ', ' + violationStatusLabel(v.action));
            card.innerHTML =
              '<span class="dap-case-card-top"><span class="dap-case-identity">' + renderUserAvatar(v.userAvatarUrl, userName, 34) +
              '<span><strong>' + esc(userName) + '</strong><small>#' + esc(v.id) + ' · ' + esc((v.createdAt || '').slice(0, 16)) + '</small></span></span>' +
              '<span class="dap-status ' + esc(v.action || 'pending') + '">' + esc(violationStatusLabel(v.action)) + '</span></span>' +
              '<span class="dap-case-rule"><b>' + esc(v.ruleId || '—') + '</b> ' + esc(v.ruleTitle || '—') + '</span>' +
              '<span class="dap-case-preview">' + esc(v.originalText || '—') + '</span>' +
              '<span class="dap-case-foot"><span>#' + esc(v.channelName || v.channelId || '—') + '</span><span>' + esc(v.method || '—') + '</span></span>';
            card.addEventListener('click', function () { selectCase(v.id, true); });
            card.addEventListener('keydown', function (event) {
              if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              var targetIndex = event.key === 'Home' ? 0 : (event.key === 'End' ? latestRows.length - 1 : Math.max(0, Math.min(latestRows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
              var nextCard = $$('.dap-case-card', list)[targetIndex];
              if (nextCard) { nextCard.focus(); nextCard.click(); }
            });
            list.appendChild(card);
          });
          renderDetail(selected);
        }

        var pager = $('#dap-viol-pager', pane);
        var pages = Math.max(1, Math.ceil(latestTotal / dapState.limit));
        pager.innerHTML = '<span>' + t('work.showing', null, latestRows.length, fmt(latestTotal)) + '</span><div>' +
          '<button type="button" id="dap-pg-prev" aria-label="' + t('work.page', null, Math.max(1, dapState.page), pages) + '"' + (dapState.page <= 0 ? ' disabled' : '') + '>←</button>' +
          '<span>' + t('work.page', null, dapState.page + 1, pages) + '</span>' +
          '<button type="button" id="dap-pg-next" aria-label="' + t('work.page', null, Math.min(pages, dapState.page + 2), pages) + '"' + (dapState.page + 1 >= pages ? ' disabled' : '') + '>→</button></div>';
        $('#dap-pg-prev', pager).addEventListener('click', function () { if (dapState.page > 0) { dapState.page--; dapState.selectedViolationId = null; refreshCases(); } });
        $('#dap-pg-next', pager).addEventListener('click', function () { if (dapState.page + 1 < pages) { dapState.page++; dapState.selectedViolationId = null; refreshCases(); } });
        if (options.background) {
          list.scrollTop = oldListTop;
          detail.scrollTop = oldDetailTop;
          if (focusedCase) {
            var focusAgain = list.querySelector('[data-case-id="' + CSS.escape(focusedCase) + '"]');
            if (focusAgain) focusAgain.focus({ preventScroll: true });
          }
        }
      }).catch(function () {
        if (requestId !== dapState.violationsRequestId || !isLive(requestGuild, 'overview', requestDays)) return;
        var caseStatus = $('#dap-cases-status', pane);
        if (caseStatus) caseStatus.textContent = t('work.stale');
      });
    }

    function setStatusFilter(status) {
      dapState.status = status;
      dapState.page = 0;
      dapState.selectedViolationId = null;
      $('#dap-f-status', pane).value = status;
      var pending = $('#dap-show-pending', pane);
      var all = $('#dap-show-all', pane);
      pending.classList.toggle('active', status === 'pending');
      pending.setAttribute('aria-pressed', status === 'pending' ? 'true' : 'false');
      all.classList.toggle('active', status !== 'pending');
      all.setAttribute('aria-pressed', status !== 'pending' ? 'true' : 'false');
      refreshCases();
    }

    on($('#dap-show-pending', pane), 'click', function () { setStatusFilter('pending'); });
    on($('#dap-show-all', pane), 'click', function () { setStatusFilter('all'); });
    on($('#dap-refresh', pane), 'click', reloadAll);
    on($('#dap-f-q', pane), 'input', debounce(function (e) { dapState.q = e.target.value || ''; dapState.page = 0; dapState.selectedViolationId = null; refreshCases(); }, 220));
    on($('#dap-f-status', pane), 'change', function (e) { setStatusFilter(e.target.value); });
    on($('#dap-f-method', pane), 'change', function (e) { dapState.method = e.target.value; dapState.page = 0; dapState.selectedViolationId = null; refreshCases(); });
    on($('#dap-f-rule', pane), 'change', function (e) { dapState.rule = e.target.value; dapState.page = 0; dapState.selectedViolationId = null; refreshCases(); });
    on($('#dap-filter-reset', pane), 'click', function () {
      dapState.q = ''; dapState.status = 'pending'; dapState.method = 'all'; dapState.rule = 'all'; dapState.page = 0; dapState.selectedViolationId = null;
      $('#dap-f-q', pane).value = ''; $('#dap-f-method', pane).value = 'all'; $('#dap-f-rule', pane).value = 'all';
      setStatusFilter('pending');
    });

    updateSummary(ov);
    refreshCases();
    return { update: updateSummary, refreshCases: refreshCases };
  }

  function renderDapAnalytics(pane, ov, days, reloadAll, isLive) {
    var k = ov.kpis || {};
    pane.innerHTML =
      '<section class="dap-work-head"><div><div class="dap-eyebrow">MACRONUXDAM / DISCORD</div><h2>' + t('work.analytics') + '</h2><p>' + t('work.period') + ': ' + days + ' ' + t(days === 1 ? 'work.period.7' : 'work.period.' + days) + '</p></div>' +
      '<button type="button" class="btn-secondary" id="dap-analytics-refresh">↻ ' + t('work.refresh') + '</button></section>' +
      '<div class="dap-summary dap-analytics-summary">' +
      '<div class="dap-summary-item"><span>' + t('kpi.total') + '</span><strong>' + fmt(k.totalViolations) + '</strong><small>' + t('kpi.real', null, fmt(k.realViolations)) + '</small></div>' +
      '<div class="dap-summary-item dap-summary-attention"><span>' + t('kpi.pending') + '</span><strong>' + fmt(k.pendingCount) + '</strong><small>' + t('kpi.pending.sub') + '</small></div>' +
      '<div class="dap-summary-item"><span>' + t('kpi.skipped') + '</span><strong>' + fmt(k.skippedCount) + '</strong><small>' + t('kpi.protection') + ': ' + fmt(k.serverBanwordsCount) + '</small></div>' +
      '<div class="dap-summary-item"><span>' + t('kpi.accuracy') + '</span><strong>' + fmt(k.accuracyPct) + '%</strong><small>' + t('kpi.accuracy.sub', null, fmt(k.dismissedCount)) + '</small></div></div>' +
      '<div class="grid-2 dap-charts">' +
      '<div class="panel"><div class="panel-head"><span class="panel-title">' + t('ch.daily') + '</span></div><div class="chart-box" style="height:240px"><canvas id="dap-ch-daily"></canvas></div></div>' +
      '<div class="panel"><div class="panel-head"><span class="panel-title">' + t('ch.methods') + '</span></div><div class="dap-chart-pair"><div class="chart-box" style="height:220px"><canvas id="dap-ch-methods"></canvas></div><div class="chart-box" style="height:220px"><canvas id="dap-ch-actions"></canvas></div></div></div></div>' +
      '<div class="grid-3 dap-top-grid">' +
      '<div class="panel"><div class="panel-head"><span class="panel-title">' + t('top.offenders') + '</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + t('tbl.member') + '</th><th>' + t('tbl.status') + '</th><th>' + t('form.action') + '</th><th></th></tr></thead><tbody id="dap-top-off"></tbody></table></div></div>' +
      '<div class="panel"><div class="panel-head"><span class="panel-title">' + t('top.rules') + '</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + t('work.rule') + '</th><th>' + t('kpi.total') + '</th><th>' + t('work.ruleContext') + '</th></tr></thead><tbody id="dap-top-rules"></tbody></table></div></div>' +
      '<div class="panel"><div class="panel-head"><span class="panel-title">' + t('top.mods') + '</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + t('work.moderator') + '</th><th>' + t('kpi.total') + '</th><th>' + t('kpi.punished') + ' / ' + t('filter.status.dismissed') + '</th></tr></thead><tbody id="dap-top-mods"></tbody></table></div></div></div>';
    on($('#dap-analytics-refresh', pane), 'click', reloadAll);

    var ch = ov.charts || {};
    if (ch.daily && ch.daily.labels && ch.daily.labels.length) {
      makeChart('dap-ch-daily', lineCfg(ch.daily.labels, [
        { label: t('ch.lbl.viol'), data: ch.daily.violations || [], borderColor: '#8b6cff', backgroundColor: 'rgba(139,108,255,.12)', fill: true, tension: .3 },
        { label: t('ch.lbl.pun'), data: ch.daily.punishments || [], borderColor: '#e9a84d', backgroundColor: 'transparent', fill: false, tension: .3 },
        { label: t('ch.lbl.dis'), data: ch.daily.dismissed || [], borderColor: '#2cb67d', backgroundColor: 'transparent', fill: false, tension: .3 }
      ]));
    }
    var mObj = ch.methods || {}, mKeys = Object.keys(mObj);
    if (mKeys.length) makeChart('dap-ch-methods', doughnutCfg(mKeys.map(function (x) { return ({ regex: 'Regex', llm: 'LLM', user_report: t('filter.method.reports'), automod: 'Automod', pulse_web: t('dap.title') })[x] || x; }), mKeys.map(function (x) { return mObj[x]; }), ['#7f5af0', '#2cb67d', '#ed8936', '#4299e1', '#f56565']));
    var aObj = ch.actions || {}, aKeys = Object.keys(aObj);
    if (aKeys.length) makeChart('dap-ch-actions', doughnutCfg(aKeys.map(dapActionLabel), aKeys.map(function (x) { return aObj[x]; }), ['#4299e1', '#2cb67d', '#a0aec0', '#ed8936', '#f56565', '#b63cff']));

    var offTb = $('#dap-top-off', pane), offs = ov.topOffenders || [];
    if (!offs.length) offTb.innerHTML = '<tr><td colspan="4" class="empty">' + t('top.noData') + '</td></tr>';
    else offs.forEach(function (o) {
      var tr = document.createElement('tr'), name = o.userName || o.userId;
      tr.innerHTML = '<td><div class="dap-user-cell">' + renderUserAvatar(o.avatarUrl, name, 28) + '<div><button type="button" class="dap-member-link dap-u-link">' + esc(name) + '</button><div class="dap-table-id"><code>' + esc(o.userId) + '</code></div></div></div></td>' +
        '<td><b>' + fmt(o.real) + '</b> / ' + fmt(o.total) + '</td><td>' + esc(o.suggested || '—') + '</td><td><button type="button" class="dap-act-btn danger dap-u-act" aria-label="' + t('work.punish') + '">⚡</button></td>';
      $('.dap-u-link', tr).addEventListener('click', function () { if (isLive(dapState.guild, 'analytics', days)) openDapUserModal(o.guildId, o.userId, reloadAll); });
      $('.dap-u-act', tr).addEventListener('click', function () { if (isLive(dapState.guild, 'analytics', days)) openDapActionModal({ guildId: o.guildId, userId: o.userId, userName: name, userAvatarUrl: o.avatarUrl }, reloadAll); });
      offTb.appendChild(tr);
    });
    var rulesTb = $('#dap-top-rules', pane), tRules = ov.topRules || [];
    if (!tRules.length) rulesTb.innerHTML = '<tr><td colspan="3" class="empty">' + t('top.noData') + '</td></tr>';
    else tRules.forEach(function (r) { var tr = document.createElement('tr'); tr.innerHTML = '<td><b>' + esc(r.ruleId) + '</b> · ' + esc(r.title) + '</td><td><b>' + fmt(r.count) + '</b></td><td>' + esc(r.estimate || '—') + '</td>'; rulesTb.appendChild(tr); });
    var modsTb = $('#dap-top-mods', pane), tMods = ov.topModerators || [];
    if (!tMods.length) modsTb.innerHTML = '<tr><td colspan="3" class="empty">' + t('top.noMods') + '</td></tr>';
    else tMods.forEach(function (m) { var tr = document.createElement('tr'), name = m.moderatorName || m.moderatorId; tr.innerHTML = '<td><div class="dap-user-cell">' + renderUserAvatar(m.avatarUrl, name, 24) + '<div><b>' + esc(name) + '</b><div class="dap-table-id"><code>' + esc(m.moderatorId) + '</code></div></div></div></td><td><b>' + fmt(m.total) + '</b></td><td>' + fmt(m.punished) + ' / ' + fmt(m.dismissed) + '</td>'; modsTb.appendChild(tr); });
  }

  // ════════════════════════════════════════════════════════════
  // 6. ВКЛАДКА 2: ОЧЕРЕДЬ ДЕЙСТВИЙ DISCORD (Web Actions Queue)
  // ════════════════════════════════════════════════════════════
  function queueStatusKey(status) {
    var value = String(status || 'pending').toLowerCase();
    if (['success', 'applied', 'complete', 'completed', 'done'].includes(value)) return 'applied';
    if (['failed', 'failure', 'error'].includes(value)) return 'failed';
    if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
    return 'pending';
  }

  function renderDapActionsQueue(pane, ov, reloadAll, isLive) {
    var requestId = ++dapState.queueRequestId;
    var guild = dapState.guild;
    pane.innerHTML = '<div class="dap-list-state">' + t('tbl.loading') + '</div>';
    j('/api/dap/web_actions?guild=' + encodeURIComponent(guild) + '&limit=50').then(function (res) {
      if (!pane.isConnected || requestId !== dapState.queueRequestId || (isLive && !isLive(guild, 'actions'))) return;
      if (!res || res.__networkError || res.error) {
        pane.innerHTML = '<div class="dap-list-state" role="alert">' + esc((res && res.error) || t('work.stale')) + '</div>';
        return;
      }
      var actions = res.actions || [];
      var total = res.total || 0;
      pane.innerHTML =
        '<section class="dap-work-head"><div><div class="dap-eyebrow">MACRONUXDAM / DISCORD</div><h2>' + t('queue.title') + '</h2><p>' + t('queue.sub') + '</p></div>' +
        '<button type="button" class="btn-secondary" id="dap-wa-refresh">↻ ' + t('work.refresh') + '</button></section>' +
        '<div class="dap-queue-toolbar"><label for="dap-queue-status">' + t('queue.status') + '</label><select id="dap-queue-status" class="sel">' +
        '<option value="all">' + t('queue.filter.all') + '</option><option value="pending">' + t('queue.filter.pending') + '</option>' +
        '<option value="applied">' + t('queue.filter.applied') + '</option><option value="failed">' + t('queue.filter.failed') + '</option>' +
        '<option value="cancelled">' + t('queue.filter.cancelled') + '</option></select><span id="dap-queue-count" class="dap-queue-count"></span></div>' +
        '<div id="dap-queue-feedback" class="dap-action-feedback" role="status">' + esc(dapState.queueFeedback || '') + '</div>' +
        '<div id="dap-queue-list" class="dap-queue-list"></div>';

      var filter = $('#dap-queue-status', pane);
      var list = $('#dap-queue-list', pane);
      var count = $('#dap-queue-count', pane);
      var feedback = $('#dap-queue-feedback', pane);
      var actionRequestIds = Object.create(null);
      filter.value = dapState.queueStatus || 'all';
      $('#dap-wa-refresh', pane).addEventListener('click', function () { if (dapState.load) dapState.load(); });

      function renderCards() {
        var visible = actions.filter(function (a) { return dapState.queueStatus === 'all' || queueStatusKey(a.status) === dapState.queueStatus; });
        count.textContent = t('work.showing', null, visible.length, fmt(total));
        list.innerHTML = '';
        if (!visible.length) {
          list.innerHTML = '<div class="dap-queue-empty">' + (actions.length ? t('queue.emptyFilter') : t('queue.empty')) + '</div>';
          return;
        }
        visible.forEach(function (a) {
          var userName = a.displayName || a.username || a.userId;
          var status = queueStatusKey(a.status);
          var statusText = status === 'applied' ? t('status.applied') : status === 'failed' ? t('status.failed') : status === 'cancelled' ? t('status.cancelled') : t('status.pending');
          var jumpUrl = discordJumpUrl(a.jumpUrl);
          var card = document.createElement('article');
          card.className = 'dap-queue-card dap-queue-' + status;
          card.innerHTML =
            '<div class="dap-queue-top"><div class="dap-queue-person">' + renderUserAvatar(a.avatarUrl, userName, 34) +
            '<div><button type="button" class="dap-member-link dap-queue-user">' + esc(userName) + '</button><small>' + esc(a.guildId || '') + ' · #' + esc(a.id) + ' · ' + t('queue.created') + ' ' + esc((a.createdAt || '').slice(0, 16)) + '</small></div></div>' +
            '<span class="dap-status ' + status + '">' + esc(statusText) + '</span></div>' +
            '<div class="dap-queue-main"><div><span class="dap-queue-label">' + t('form.action') + '</span><strong>' + esc(dapActionLabel(a.action)) + '</strong>' +
            (a.durationSeconds > 0 ? '<small>' + fmtDurShort(a.durationSeconds) + '</small>' : '') + (a.newNick ? '<small>' + t('form.nickname') + ': ' + esc(a.newNick) + '</small>' : '') + '</div>' +
            '<div><span class="dap-queue-label">' + t('form.reason') + '</span><p>' + esc(a.reason || '—') + '</p></div>' +
            '<div><span class="dap-queue-label">' + t('queue.result') + '</span><p>' + esc(a.resultMessage || (status === 'pending' ? t('queue.waiting') : '—')) + '</p></div></div>' +
            '<div class="dap-queue-foot"><div>' + (a.executedAt ? esc(a.executedAt.slice(0, 19)) : '') +
            (jumpUrl ? '<a href="' + esc(jumpUrl) + '" target="_blank" rel="noopener noreferrer" class="dap-jump-btn">' + t('work.discord') + ' ↗</a>' : '') + '</div>' +
            '<div class="dap-queue-actions">' + (status === 'failed' ? '<button type="button" class="dap-decision-btn dap-wa-retry">' + t('queue.retry') + '</button>' : '') +
            (status === 'pending' ? '<button type="button" class="dap-decision-btn dap-wa-cancel">' + t('queue.cancel') + '</button>' : '') + '</div></div>';
          $('.dap-queue-user', card).addEventListener('click', function () {
            if (!isLive || isLive(guild, 'actions')) openDapUserModal(a.guildId, a.userId, reloadAll);
          });
          function runQueueAction(type, button) {
            if (isLive && !isLive(guild, 'actions')) return;
            var requestKey = String(a.id);
            var actionRequestId = (actionRequestIds[requestKey] || 0) + 1;
            actionRequestIds[requestKey] = actionRequestId;
            button.disabled = true;
            postJson('/api/dap/action', { type: type, actionId: a.id }).then(function (result) {
              if (!pane.isConnected || (isLive && !isLive(guild, 'actions')) || actionRequestIds[requestKey] !== actionRequestId) return;
              if (result && result.ok) {
                dapState.queueFeedback = type === 'retry_web_action' ? t('queue.retryFeedback') : t('queue.cancelFeedback');
                showToast(dapState.queueFeedback);
                if (dapState.load) dapState.load();
              } else {
                button.disabled = false;
                feedback.textContent = (result && result.error) || t('work.stale');
              }
            }).catch(function () {
              if (!pane.isConnected || (isLive && !isLive(guild, 'actions')) || actionRequestIds[requestKey] !== actionRequestId) return;
              button.disabled = false;
              feedback.textContent = t('work.stale');
            });
          }
          var retry = $('.dap-wa-retry', card), cancel = $('.dap-wa-cancel', card);
          if (retry) retry.addEventListener('click', function () { runQueueAction('retry_web_action', retry); });
          if (cancel) cancel.addEventListener('click', function () {
            confirmDapAction({ icon: '↷', title: t('queue.cancel'), subtitle: userName + ' · #' + String(a.id), reason: a.reason || '' }, function () {
              runQueueAction('cancel_web_action', cancel);
            });
          });
          list.appendChild(card);
        });
      }
      filter.addEventListener('change', function () { dapState.queueStatus = filter.value || 'all'; renderCards(); });
      renderCards();
    }).catch(function () {
      if (requestId !== dapState.queueRequestId || (isLive && !isLive(guild, 'actions'))) return;
      pane.innerHTML = '<div class="dap-list-state" role="alert">' + t('work.stale') + '</div>';
    });
  }

  // ════════════════════════════════════════════════════════════
  // 7. ВКЛАДКА 3: СТРУКТУРА СЕРВЕРА (Channels & Roles)
  // ════════════════════════════════════════════════════════════
  function renderDapServerStructure(pane, ov, reloadAll) {
    var sc = ov.serverConfig || {};
    var channels = ov.channels || [];
    var roles = ov.roles || [];

    pane.innerHTML =
      '<div class="panel" style="margin-bottom:14px">' +
      '  <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">' +
      '    <div style="display:flex;align-items:center;gap:12px">' +
      (sc.guildIconUrl ? '<img src="' + esc(sc.guildIconUrl) + '" style="width:48px;height:48px;border-radius:12px;border:1.5px solid var(--line-strong)" alt="">' : '<div class="dap-avatar-fallback" style="width:48px;height:48px;border-radius:12px;font-size:20px">🛡️</div>') +
      '      <div>' +
      '        <div style="font-weight:700;font-size:16px;color:var(--text)">' + esc(sc.guildName || ('Discord Guild ' + (sc.guildId || ''))) + '</div>' +
      '        <div style="font-size:12px;color:var(--muted)">Guild ID: <code>' + esc(sc.guildId || '—') + '</code> · Участников: <b>' + fmt(sc.memberCount || 0) + '</b></div>' +
      '      </div>' +
      '    </div>' +
      '    <div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '      <div class="dap-guild-badge">📢 Мод-канал: <b>#' + esc(sc.modChannelName || sc.modChannelId || 'не задан') + '</b></div>' +
      '      <div class="dap-guild-badge">🛡️ Мод-роль: <b>@' + esc(sc.modRoleName || sc.modRoleId || 'не задана') + '</b></div>' +
      '      <div class="dap-guild-badge">🌐 Язык: <b>' + esc((sc.targetLanguage || 'ru').toUpperCase()) + '</b></div>' +
      '      <div class="dap-guild-badge">🤖 ИИ (LLM): <b>' + (sc.llmEnabled ? '✅ Вкл' : '❌ Выкл') + '</b></div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="grid-2">' +
      '  <div class="panel">' +
      '    <div class="panel-head"><span class="panel-title">💬 Каналы сервера (' + channels.length + ')</span></div>' +
      '    <div class="tbl-wrap" style="max-height:480px;overflow-y:auto">' +
      '      <table class="tbl"><thead><tr><th>Канал</th><th>Категория / Тип</th><th>ID канала</th><th>Исключение</th></tr></thead><tbody id="dap-srv-ch-tb"></tbody></table>' +
      '    </div>' +
      '  </div>' +
      '  <div class="panel">' +
      '    <div class="panel-head"><span class="panel-title">🏷️ Роли сервера и права (' + roles.length + ')</span></div>' +
      '    <div class="tbl-wrap" style="max-height:480px;overflow-y:auto">' +
      '      <table class="tbl"><thead><tr><th>Роль</th><th>ID роли</th><th>Статус</th></tr></thead><tbody id="dap-srv-ro-tb"></tbody></table>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var chTb = $('#dap-srv-ch-tb', pane);
    if (!channels.length) {
      chTb.innerHTML = '<tr><td colspan="4" class="empty">Список каналов ещё не синхронизирован ботом. Убедитесь, что бот запущен.</td></tr>';
    } else {
      channels.forEach(function (c) {
        var tr = document.createElement('tr');
        var icon = c.type === 'voice' ? '🔊 ' : (c.type === 'announcement' ? '📢 ' : '# ');
        tr.innerHTML =
          '<td><b>' + icon + esc(c.name) + '</b></td>' +
          '<td style="font-size:11.5px;color:var(--muted)">' + esc(c.categoryName ? (c.categoryName + ' / ' + c.type) : c.type) + '</td>' +
          '<td><code>' + esc(c.channelId) + '</code></td>' +
          '<td><button type="button" class="dap-act-btn dap-add-ex-ch">+ Исключить</button></td>';

        $('.dap-add-ex-ch', tr).addEventListener('click', function () {
          navigateDapTab('banwords');
        });
        chTb.appendChild(tr);
      });
    }

    var roTb = $('#dap-srv-ro-tb', pane);
    if (!roles.length) {
      roTb.innerHTML = '<tr><td colspan="3" class="empty">Список ролей ещё не синхронизирован ботом.</td></tr>';
    } else {
      roles.forEach(function (r) {
        var tr = document.createElement('tr');
        var color = r.color || '#a0aec0';
        tr.innerHTML =
          '<td>' +
          '  <span class="dap-role-pill" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44">' +
          '    <span class="dap-role-dot" style="background:' + color + '"></span>' +
          '    <b>' + esc(r.name) + '</b>' +
          '  </span>' +
          '</td>' +
          '<td><code>' + esc(r.roleId) + '</code></td>' +
          '<td>' + (r.isStaff ? '<span class="dap-badge ok">🛡️ Staff / Модерация</span>' : '<span style="font-size:11.5px;color:var(--muted)">Участник</span>') + '</td>';
        roTb.appendChild(tr);
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // 8. ВКЛАДКА 4: БАНВОРДЫ И ПРАВИЛА (Banwords & Catalog)
  // ════════════════════════════════════════════════════════════
  function renderDapBanwords(pane, ov, reloadAll, isLive) {
    var guild = dapState.guild;
    var requestId = ++dapState.banwordsRequestId;
    pane.innerHTML = '<div class="empty">Загрузка банвордов и правил…</div>';
    j('/api/dap/banwords?guild=' + encodeURIComponent(guild)).then(function (bw) {
      if (!pane.isConnected || requestId !== dapState.banwordsRequestId || (isLive && !isLive(guild, 'banwords'))) return;
      if (!bw || bw.__networkError || bw.error) { pane.innerHTML = '<div class="dap-list-state" role="alert">' + esc((bw && bw.error) || t('work.stale')) + '</div>'; return; }
      var words = bw.serverWords || [];
      var exs = bw.exceptions || [];
      var rules = bw.rulesCatalog || ov.rulesCatalog || [];
      var ruleOpts = '<option value="all">all · Все правила</option>' + rules.map(function (r) {
        return '<option value="' + esc(r.id) + '">' + esc(r.id + ' · ' + r.title) + '</option>';
      }).join('');

      pane.innerHTML =
        '<div class="grid-2" style="margin-bottom:14px">' +
        '  <div class="panel">' +
        '    <div class="panel-head"><span class="panel-title">📛 Серверные банворды (' + fmt(words.length) + ')</span></div>' +
        '    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Дополнительные запрещённые слова сверх встроенного словаря (п. 4.1–4.5). Можно вводить несколько слов через запятую.</p>' +
        '    <div style="display:flex;gap:8px;margin-bottom:12px">' +
        '      <input type="text" id="dap-bw-input" class="inp" placeholder="Введите слово или фразы через запятую…" style="flex:1">' +
        '      <button type="button" class="btn-primary" id="dap-bw-add">+ Добавить</button>' +
        '    </div>' +
        '    <div id="dap-bw-msg" style="font-size:12px;color:#fc8181;margin-bottom:6px"></div>' +
        '    <div class="dap-word-cloud" id="dap-bw-cloud"></div>' +
        '  </div>' +
        '  <div class="panel">' +
        '    <div class="panel-head"><span class="panel-title">🚫 Исключения правил по каналам (' + fmt(exs.length) + ')</span></div>' +
        '    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Каналы, в которых бот игнорирует выбранное правило (или <code>all</code> — все правила).</p>' +
        '    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
        '      <input type="text" id="dap-ex-channel" class="inp" placeholder="ID канала Discord…" style="width:180px">' +
        '      <select id="dap-ex-rule" class="sel" style="flex:1;min-width:160px">' + ruleOpts + '</select>' +
        '      <button type="button" class="btn-primary" id="dap-ex-add">+ Исключить</button>' +
        '    </div>' +
        '    <div id="dap-ex-msg" style="font-size:12px;color:#fc8181;margin-bottom:6px"></div>' +
        '    <div class="tbl-wrap" style="max-height:260px;overflow-y:auto">' +
        '      <table class="tbl"><thead><tr><th>Канал (ID)</th><th>Правило</th><th></th></tr></thead><tbody id="dap-ex-tbody"></tbody></table>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="panel">' +
        '  <div class="panel-head"><span class="panel-title">📜 Свод правил сервера MacronuxDAM и встроенная база автомода</span></div>' +
        '  <div class="tbl-wrap">' +
        '    <table class="tbl"><thead><tr><th>Пункт</th><th>Название</th><th>Описание</th><th>Ориентир наказания</th><th>Встроенных корней</th></tr></thead><tbody id="dap-rules-cat"></tbody></table>' +
        '  </div>' +
        '</div>';

      var cloud = $('#dap-bw-cloud', pane);
      if (!words.length) {
        cloud.innerHTML = '<div class="empty">Пользовательских банвордов пока нет</div>';
      } else {
        words.forEach(function (w) {
          var chip = document.createElement('span');
          chip.className = 'dap-word-chip';
          chip.innerHTML = '<span>' + esc(w.word) + '</span><button type="button" title="Удалить">✕</button>';
          $('button', chip).addEventListener('click', function () {
            if (isLive && !isLive(guild, 'banwords')) return;
            postJson('/api/dap/action', { type: 'remove_banword', guildId: w.guildId, word: w.word }).then(function (res) {
              if (!pane.isConnected || (isLive && !isLive(guild, 'banwords'))) return;
              if (res && !res.ok) { $('#dap-bw-msg', pane).textContent = res.error || t('work.stale'); return; }
              renderDapBanwords(pane, ov, reloadAll, isLive);
            }).catch(function () { if (pane.isConnected && (!isLive || isLive(guild, 'banwords'))) $('#dap-bw-msg', pane).textContent = t('work.stale'); });
          });
          cloud.appendChild(chip);
        });
      }

      $('#dap-bw-add', pane).addEventListener('click', function () {
        var val = ($('#dap-bw-input', pane).value || '').trim();
        if (!val) return;
        if (isLive && !isLive(guild, 'banwords')) return;
        postJson('/api/dap/action', { type: 'add_banword', guildId: guild, word: val }).then(function (res) {
          if (!pane.isConnected || (isLive && !isLive(guild, 'banwords'))) return;
          if (res && !res.ok) {
            $('#dap-bw-msg', pane).textContent = res.error || 'Ошибка';
          } else {
            renderDapBanwords(pane, ov, reloadAll, isLive);
          }
        }).catch(function () { if (pane.isConnected && (!isLive || isLive(guild, 'banwords'))) $('#dap-bw-msg', pane).textContent = t('work.stale'); });
      });

      var exTb = $('#dap-ex-tbody', pane);
      if (!exs.length) {
        exTb.innerHTML = '<tr><td colspan="3" class="empty">Исключений нет</td></tr>';
      } else {
        exs.forEach(function (ex) {
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td><code>#' + esc(ex.channelId) + '</code></td>' +
            '<td><b>' + esc(ex.rule) + '</b> <span style="color:var(--muted);font-size:11.5px">' + esc(ex.ruleTitle || '') + '</span></td>' +
            '<td style="text-align:right"><button type="button" class="dap-act-btn danger">✕ Убрать</button></td>';
          $('button', tr).addEventListener('click', function () {
            if (isLive && !isLive(guild, 'banwords')) return;
            postJson('/api/dap/action', { type: 'remove_exception', guildId: ex.guildId, channelId: ex.channelId, rule: ex.rule }).then(function (res) {
              if (!pane.isConnected || (isLive && !isLive(guild, 'banwords'))) return;
              if (res && !res.ok) { $('#dap-ex-msg', pane).textContent = res.error || t('work.stale'); return; }
              renderDapBanwords(pane, ov, reloadAll, isLive);
            }).catch(function () { if (pane.isConnected && (!isLive || isLive(guild, 'banwords'))) $('#dap-ex-msg', pane).textContent = t('work.stale'); });
          });
          exTb.appendChild(tr);
        });
      }

      $('#dap-ex-add', pane).addEventListener('click', function () {
        var ch = ($('#dap-ex-channel', pane).value || '').trim();
        var rl = $('#dap-ex-rule', pane).value;
        if (isLive && !isLive(guild, 'banwords')) return;
        postJson('/api/dap/action', { type: 'add_exception', guildId: guild, channelId: ch, rule: rl }).then(function (res) {
          if (!pane.isConnected || (isLive && !isLive(guild, 'banwords'))) return;
          if (res && !res.ok) {
            $('#dap-ex-msg', pane).textContent = res.error || 'Ошибка';
          } else {
            renderDapBanwords(pane, ov, reloadAll, isLive);
          }
        }).catch(function () { if (pane.isConnected && (!isLive || isLive(guild, 'banwords'))) $('#dap-ex-msg', pane).textContent = t('work.stale'); });
      });

      var catTb = $('#dap-rules-cat', pane);
      rules.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><b>п. ' + esc(r.id) + '</b></td>' +
          '<td style="font-weight:600">' + esc(r.title) + '</td>' +
          '<td style="font-size:12px;color:var(--muted);max-width:440px">' + esc(r.text) + '</td>' +
          '<td style="font-size:12px">' + esc(r.estimate || '—') + '</td>' +
          '<td>' + (r.builtinWords > 0 ? '<span class="dap-badge regex">' + fmt(r.builtinWords) + '+ слов</span>' : '—') + '</td>';
        catTb.appendChild(tr);
      });
    });
  }

  // ════════════════════════════════════════════════════════════
  // 9. ВКЛАДКА 5: НАСТРОЙКИ И VPS (Settings, Paths & Download)
  // ════════════════════════════════════════════════════════════
  function renderDapSettings(pane, ov, reloadAll, isLive) {
    var guild = dapState.guild;
    function isCurrent() { return pane.isConnected && (!isLive || isLive(guild, 'settings')); }
    function isRouteCurrent() { return pane.isConnected && dapState.tab === 'settings' && dapState.viewSeq === P.getViewSeq(); }
    var sc = ov.serverConfig || {};
    var p = ov.process || {};
    var langs = ['ru', 'en', 'uk', 'de', 'fr', 'es', 'pl'];
    var langOpts = langs.map(function (l) {
      return '<option value="' + l + '"' + (sc.targetLanguage === l ? ' selected' : '') + '>' + l.toUpperCase() + '</option>';
    }).join('');

    pane.innerHTML =
      '<div class="panel" style="margin-bottom:14px">' +
      '  <div class="panel-head" style="flex-wrap:wrap;gap:10px">' +
      '    <span class="panel-title">📥 Докачка MacronuxDAM и автопоиск на VPS / сервере</span>' +
      '    <span style="font-size:12px;color:var(--muted)">GitHub (<code>Meneleet-official/MacronuxDAM</code>) или поиск (<code>pmx-bot.service</code>, <code>/opt/pmx-bot</code>)</span>' +
      '  </div>' +
      '  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      '    <input type="text" id="dap-disc-root" class="inp" placeholder="Папка для сканирования или установки (например: /opt, /home или пусто для стандартной)…" style="flex:1;min-width:240px">' +
      '    <button type="button" class="btn-primary" id="dap-disc-btn">🔍 Найти бота на сервере</button>' +
      '    <button type="button" class="btn-secondary" id="dap-disc-auto">⚡ Найти и подключить</button>' +
      '    <button type="button" class="btn-primary" id="dap-dl-github" style="background:linear-gradient(135deg,#2cb67d,#1f9d68)">📥 Докачать из GitHub</button>' +
      '  </div>' +
      '  <div id="dap-disc-list"><div style="font-size:12px;color:var(--muted)">Выполняется проверка доступных установок MacronuxDAM…</div></div>' +
      '</div>' +
      '<div class="grid-2">' +
      '  <div class="panel">' +
      '    <div class="panel-head"><span class="panel-title">⚙️ Настройки сервера Discord (/setup)</span></div>' +
      '    <div class="link-field">' +
      '      <label>ID сервера Discord (Guild ID)</label>' +
      '      <input type="text" id="dap-s-guild" value="' + esc(sc.guildId || (dapState.guild !== '_all' ? dapState.guild : '')) + '" placeholder="Например: 1389698092563173447">' +
      '    </div>' +
      '    <div class="link-grid-2">' +
      '      <div class="link-field">' +
      '        <label>ID канала модерации (mod_channel_id)</label>' +
      '        <input type="text" id="dap-s-channel" value="' + esc(sc.modChannelId || '') + '" placeholder="ID канала">' +
      '      </div>' +
      '      <div class="link-field">' +
      '        <label>ID роли модерации (mod_role_id)</label>' +
      '        <input type="text" id="dap-s-role" value="' + esc(sc.modRoleId || '') + '" placeholder="ID роли">' +
      '      </div>' +
      '    </div>' +
      '    <div class="link-field">' +
      '      <label>Язык перевода нарушений (target_language)</label>' +
      '      <select id="dap-s-lang" class="sel" style="width:100%;padding:8px">' + langOpts + '</select>' +
      '    </div>' +
      '    <div style="display:flex;flex-direction:column;gap:10px;margin:14px 0">' +
      '      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="checkbox" id="dap-s-llm"' + (sc.llmEnabled !== false ? ' checked' : '') + '> Включить ИИ-анализ контекста (LLM)</label>' +
      '      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="checkbox" id="dap-s-del"' + (sc.deleteMessage ? ' checked' : '') + '> Автоматически удалять исходное сообщение при нарушении</label>' +
      '      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="checkbox" id="dap-s-man"' + (sc.manualStrikes ? ' checked' : '') + '> Ручной режим подтверждения страйков</label>' +
      '    </div>' +
      '    <div id="dap-s-status" style="margin-bottom:10px;font-size:12.5px"></div>' +
      '    <button type="button" class="btn-primary" id="dap-s-save">💾 Сохранить настройки сервера</button>' +
      '  </div>' +
      '  <div class="panel">' +
      '    <div class="panel-head"><span class="panel-title">📁 Подключение к боту MacronuxDAM и окружение</span></div>' +
      '    <div class="link-field">' +
      '      <label>Корневая папка бота (dap.bot-dir)</label>' +
      '      <input type="text" id="dap-p-dir" value="' + esc(ov.botDir || '/opt/pmx-bot') + '" placeholder="/opt/pmx-bot или F:/Code/DAP">' +
      '    </div>' +
      '    <div class="link-field">' +
      '      <label>Путь к SQLite БД (оставьте пустым для &lt;bot-dir&gt;/data/modbot.db)</label>' +
      '      <input type="text" id="dap-p-db" value="' + esc(ov.dbPath || '') + '">' +
      '    </div>' +
      '    <div class="link-field">' +
      '      <label>Команда Python для запуска бота (или путь к .venv)</label>' +
      '      <input type="text" id="dap-p-py" value="python" placeholder=".venv/bin/python / python3 / python">' +
      '    </div>' +
      '    <div class="panel" style="background:var(--inset);margin:12px 0;padding:10px 12px;font-size:12px">' +
      '      <div>Статус файла БД: <b>' + (ov.dbExists ? '✅ Подключена (' + fmt(ov.dbSizeKb) + ' КБ)' : '❌ Файл не найден') + '</b></div>' +
      '      <div>Конфигурация .env: <b>' + (p.hasEnv ? '✅ Найдена' : '⚠️ Нет .env') + '</b> · Провайдер ИИ: <b>' + esc(p.llmProvider || '—') + '</b> (' + esc(p.llmModel || '—') + ')</div>' +
      '      <div>Срок давности страйков: <b>' + fmt(p.strikeDecayDays || 60) + ' дн.</b></div>' +
      '    </div>' +
      '    <div id="dap-p-status" style="margin-bottom:10px;font-size:12.5px"></div>' +
      '    <div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '      <button type="button" class="btn-primary" id="dap-p-save">🔗 Применить путь вручную</button>' +
      '      <button type="button" class="btn-secondary" id="dap-p-disable" style="color:#fc8181;border-color:rgba(245,101,101,.4)">🔌 Отключить модуль MacronuxDAM</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var discoveryRequestId = 0;
    var settingsRequests = { download: 0, server: 0, path: 0, disable: 0 };
    function runDiscovery(autoApply) {
      var listBox = $('#dap-disc-list', pane);
      var customRoot = ($('#dap-disc-root', pane).value || '').trim();
      if (!listBox) return;
      var requestId = ++discoveryRequestId;
      listBox.innerHTML = '<div style="font-size:12.5px;color:var(--muted)">⏳ Поиск установок MacronuxDAM на сервере…</div>';
      postJson('/api/dap/action', {
        type: 'discover',
        searchRoot: customRoot,
        autoApply: !!autoApply
      }).then(function (res) {
        if (!isCurrent() || requestId !== discoveryRequestId) return;
        if (!res || !res.ok) {
          listBox.innerHTML = '<div style="color:#fc8181;font-size:12.5px">Не удалось выполнить поиск.</div>';
          return;
        }
        if (res.autoApplied) {
          listBox.innerHTML = '<div style="color:#5ce6a8;font-size:13px;font-weight:600">✅ Бот MacronuxDAM найден и автоматически подключён: <code>' + esc(res.appliedDir) + '</code></div>';
          setTimeout(function () { if (isCurrent() && requestId === discoveryRequestId) reloadAll(); }, 500);
          return;
        }
        var cands = res.candidates || [];
        if (!cands.length) {
          listBox.innerHTML = '<div style="font-size:12.5px;color:var(--muted)">Установок бота в стандартных папках не обнаружено. Вы можете указать путь к боту выше и нажать «🔍 Найти бота на сервере» или «📥 Докачать из GitHub».</div>';
          return;
        }
        var tblHtml =
          '<div class="tbl-wrap">' +
          '  <table class="tbl">' +
          '    <thead><tr><th>Папка бота (botDir)</th><th>Источник обнаружения</th><th>База данных (modbot.db)</th><th>Окружение VPS</th><th></th></tr></thead>' +
          '    <tbody id="dap-disc-tbody"></tbody>' +
          '  </table>' +
          '</div>';
        listBox.innerHTML = tblHtml;
        var tb = $('#dap-disc-tbody', listBox);
        cands.forEach(function (c) {
          var tr = document.createElement('tr');
          var envBadges = [];
          if (c.hasVenv) envBadges.push('<span class="dap-badge llm">🐍 .venv</span>');
          if (c.hasSystemd) envBadges.push('<span class="dap-badge regex">⚙️ systemd</span>');
          if (c.hasBotctl) envBadges.push('<span class="dap-badge automod">📜 botctl.sh</span>');
          if (c.hasEnv) envBadges.push('<span class="dap-badge ok">.env</span>');
          var dbColHtml = c.dbExists
            ? ('<span style="color:#5ce6a8;font-weight:600">✅ Найдена (' + fmt(c.dbSizeKb) + ' КБ)</span>')
            : (c.readOnly
                ? '<span style="color:#f6ad55;font-weight:600">🔒 Ожидает запуск на VPS</span>'
                : '<span style="color:#5ce6a8;font-weight:600">⚡ Будет создана</span>');

          tr.innerHTML =
            '<td>' +
            '  <div style="font-weight:600"><code>' + esc(c.botDir) + '</code> ' + (c.active ? '<span class="dap-status dismiss" style="margin-left:6px">Активен</span>' : '') + '</div>' +
            '  <div style="font-size:11px;color:var(--muted)">Python: <code>' + esc(c.pythonCmd || 'python') + '</code></div>' +
            '</td>' +
            '<td style="font-size:12px">' + esc(c.source || 'Автопоиск') + '</td>' +
            '<td style="font-size:12px">' + dbColHtml + '</td>' +
            '<td><div style="display:flex;gap:4px;flex-wrap:wrap">' + (envBadges.join('') || '—') + '</div></td>' +
            '<td style="text-align:right">' +
            '  <button type="button" class="btn-primary dap-use-cand" style="padding:5px 12px;font-size:12px">' + (c.active ? '🔄 Переподключить' : '🔗 Подключить') + '</button>' +
            '</td>';

          $('.dap-use-cand', tr).addEventListener('click', function () {
            var candBtn = $('.dap-use-cand', tr);
            var pathRequestId = ++settingsRequests.path;
            candBtn.disabled = true;
            candBtn.textContent = '⏳…';
            $('#dap-p-dir', pane).value = c.botDir || '';
            $('#dap-p-db', pane).value = c.dbPath || '';
            $('#dap-p-py', pane).value = c.pythonCmd || 'python';
            postJson('/api/dap/action', {
              type: 'set_path',
              botDir: c.botDir,
              dbPath: c.dbPath || '',
              pythonCommand: c.pythonCmd || 'python'
            }).then(function (r) {
              if (!isCurrent() || requestId !== discoveryRequestId || pathRequestId !== settingsRequests.path) return;
              var st = $('#dap-p-status', pane);
              if (r && r.ok) {
                st.style.color = '#5ce6a8';
                st.textContent = '✅ Подключён бот: ' + c.botDir;
                setTimeout(function () { if (isCurrent() && requestId === discoveryRequestId && pathRequestId === settingsRequests.path) reloadAll(); }, 500);
              } else {
                st.style.color = '#fc8181';
                st.textContent = (r && r.error) || t('work.stale');
              }
            }).catch(function () {
              if (!isCurrent() || requestId !== discoveryRequestId || pathRequestId !== settingsRequests.path) return;
              candBtn.disabled = false;
              var st = $('#dap-p-status', pane);
              st.style.color = '#fc8181';
              st.textContent = t('work.stale');
            });
          });
          tb.appendChild(tr);
        });
      }).catch(function () {
          if (!isCurrent() || requestId !== discoveryRequestId) return;
          listBox.textContent = t('work.stale');
        });
    }

    $('#dap-disc-btn', pane).addEventListener('click', function () { runDiscovery(false); });
    $('#dap-disc-auto', pane).addEventListener('click', function () { runDiscovery(true); });
    $('#dap-dl-github', pane).addEventListener('click', function () {
      var btn = $('#dap-dl-github', pane);
      var listBox = $('#dap-disc-list', pane);
      var targetDir = ($('#dap-disc-root', pane).value || '').trim();
      var requestId = ++settingsRequests.download;
      btn.disabled = true;
      listBox.innerHTML = '<div style="font-size:12.5px;color:var(--muted)">⏳ Скачивание MacronuxDAM из GitHub и подготовка базы данных…</div>';
      postJson('/api/dap/action', { type: 'download_bot', targetDir: targetDir }).then(function (res) {
        if (!isCurrent() || requestId !== settingsRequests.download) return;
        btn.disabled = false;
        if (res && res.ok) {
          listBox.innerHTML = '<div style="color:#5ce6a8;font-size:13px;font-weight:600">✅ ' + esc(res.message || 'MacronuxDAM установлен') + ': <code>' + esc(res.botDir || '') + '</code></div>';
          setTimeout(function () { if (isCurrent() && requestId === settingsRequests.download) reloadAll(); }, 500);
        } else {
          listBox.innerHTML = '<div style="color:#fc8181;font-size:12.5px">❌ ' + esc((res && res.error) || 'Ошибка скачивания') + '</div>';
        }
      }).catch(function () {
        if (!isCurrent() || requestId !== settingsRequests.download) return;
        btn.disabled = false;
        listBox.textContent = t('work.stale');
      });
    });

    runDiscovery(false);

    $('#dap-s-save', pane).addEventListener('click', function () {
      var gid = ($('#dap-s-guild', pane).value || '').trim();
      if (!isCurrent()) return;
      var requestId = ++settingsRequests.server;
      postJson('/api/dap/action', {
        type: 'update_server',
        guildId: gid,
        modChannelId: ($('#dap-s-channel', pane).value || '').trim(),
        modRoleId: ($('#dap-s-role', pane).value || '').trim(),
        targetLanguage: $('#dap-s-lang', pane).value,
        llmEnabled: $('#dap-s-llm', pane).checked,
        deleteMessage: $('#dap-s-del', pane).checked,
        manualStrikes: $('#dap-s-man', pane).checked
      }).then(function (res) {
        if (!isCurrent() || requestId !== settingsRequests.server) return;
        var st = $('#dap-s-status', pane);
        if (res && res.ok) {
          st.style.color = '#5ce6a8';
          st.textContent = '✅ Настройки сервера сохранены';
          dapState.guild = gid || dapState.guild;
          setTimeout(function () { if (isRouteCurrent() && requestId === settingsRequests.server) reloadAll(); }, 600);
        } else {
          st.style.color = '#fc8181';
          st.textContent = (res && res.error) || 'Ошибка сохранения';
        }
      }).catch(function () {
        if (!isCurrent() || requestId !== settingsRequests.server) return;
        var st = $('#dap-s-status', pane);
        st.style.color = '#fc8181';
        st.textContent = t('work.stale');
      });
    });

    $('#dap-p-save', pane).addEventListener('click', function () {
      if (!isCurrent()) return;
      var requestId = ++settingsRequests.path;
      postJson('/api/dap/action', {
        type: 'set_path',
        botDir: ($('#dap-p-dir', pane).value || '').trim(),
        dbPath: ($('#dap-p-db', pane).value || '').trim(),
        pythonCommand: ($('#dap-p-py', pane).value || 'python').trim()
      }).then(function (res) {
        if (!isCurrent() || requestId !== settingsRequests.path) return;
        var st = $('#dap-p-status', pane);
        if (res && res.ok) {
          st.style.color = '#5ce6a8';
          st.textContent = '✅ Путь обновлён. БД: ' + (res.dbExists ? 'найдена' : 'не найдена');
          setTimeout(function () { if (isCurrent() && requestId === settingsRequests.path) reloadAll(); }, 500);
        } else {
          st.style.color = '#fc8181';
          st.textContent = (res && res.error) || 'Ошибка';
        }
      }).catch(function () {
        if (!isCurrent() || requestId !== settingsRequests.path) return;
        var st = $('#dap-p-status', pane);
        st.style.color = '#fc8181';
        st.textContent = t('work.stale');
      });
    });

    if ($('#dap-p-disable', pane)) {
      $('#dap-p-disable', pane).addEventListener('click', function () {
        confirmDapAction({ icon: '⏻', title: t('settings.disableTitle'), subtitle: t('dap.title') }, function () {
          if (!isCurrent()) return;
          var requestId = ++settingsRequests.disable;
          postJson('/api/dap/action', { type: 'set_enabled', enabled: false }).then(function (res) {
            if (!isCurrent() || requestId !== settingsRequests.disable) return;
            if (res && res.ok) {
              if (P.setDapEnabled) P.setDapEnabled(false);
              if (P.navigate) P.navigate('/overview');
            } else {
              var st = $('#dap-p-status', pane);
              st.style.color = '#fc8181';
              st.textContent = (res && res.error) || t('work.stale');
            }
          }).catch(function () {
            if (!isCurrent() || requestId !== settingsRequests.disable) return;
            $('#dap-p-status', pane).textContent = t('work.stale');
          });
        });
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // 10. ВКЛАДКА 6: ТЕЛЕМЕТРИЯ И ЛОГИ (Telemetry & Console)
  // ════════════════════════════════════════════════════════════
  function renderDapLogs(pane, ov, reloadAll, isLive) {
    var guild = dapState.guild;
    var telemetry = [], logLines = [], logFile = '';
    var requestId = 0;
    pane.innerHTML =
      '<section class="dap-work-head"><div><div class="dap-eyebrow">MACRONUXDAM / DISCORD</div><h2>' + t('dap.tab.logs') + '</h2><p>' + t('queue.sub') + '</p></div>' +
      '<button type="button" class="btn-secondary" id="dap-lg-refresh">↻ ' + t('work.refresh') + '</button></section>' +
      '<div class="dap-log-toolbar"><label class="dap-log-search"><span class="sr-only">' + t('logs.search') + '</span><input type="search" id="dap-lg-q" class="inp" placeholder="' + t('logs.search') + '" value="' + esc(dapState.logQuery || '') + '"></label>' +
      '<label class="dap-log-kind"><span>' + t('logs.kind') + '</span><select id="dap-lg-kind" class="sel"><option value="all">' + t('logs.kind.all') + '</option><option value="telemetry">' + t('logs.kind.telemetry') + '</option><option value="console">' + t('logs.kind.console') + '</option></select></label>' +
      '<button type="button" class="btn-secondary" id="dap-log-copy">' + t('logs.copy') + '</button><button type="button" class="btn-secondary" id="dap-log-download">' + t('logs.download') + '</button></div>' +
      '<div class="dap-log-state" id="dap-lg-state" role="status" aria-live="polite">' + t('tbl.loading') + '</div>' +
      '<div class="dap-logs-grid">' +
      '<section class="panel dap-log-panel dap-log-telemetry"><div class="panel-head"><span class="panel-title">📡 ' + t('logs.kind.telemetry') + '</span><span class="dap-log-total" id="dap-tel-count"></span></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>UTC</th><th>' + t('work.status') + '</th><th>' + t('tbl.member') + ' / ' + t('work.rule') + '</th><th>' + t('work.context') + '</th></tr></thead><tbody id="dap-tel-tb"></tbody></table></div></section>' +
      '<section class="panel dap-log-panel dap-log-console"><div class="panel-head"><span class="panel-title">🖥️ ' + t('logs.kind.console') + '</span><span class="dap-log-file" id="dap-log-file"></span></div>' +
      '<pre class="dap-console" id="dap-log-box"></pre></section></div>';

    var qInput = $('#dap-lg-q', pane), kindSel = $('#dap-lg-kind', pane);
    kindSel.value = dapState.logKind || 'all';
    function queryMatches(value) { return !dapState.logQuery || String(value || '').toLowerCase().includes(dapState.logQuery.toLowerCase()); }

    function renderVisible() {
      var telemetryVisible = dapState.logKind !== 'console';
      var consoleVisible = dapState.logKind !== 'telemetry';
      $('.dap-log-telemetry', pane).hidden = !telemetryVisible;
      $('.dap-log-console', pane).hidden = !consoleVisible;
      var filteredTelemetry = telemetry.filter(function (ev) {
        return queryMatches([ev.t, ev.event, ev.user_id, ev.rule_id, ev.action, ev.reason, ev.text].join(' '));
      });
      var filteredLines = logLines.filter(function (line) { return queryMatches(line); });
      var tbody = $('#dap-tel-tb', pane);
      tbody.innerHTML = '';
      if (!filteredTelemetry.length) tbody.innerHTML = '<tr><td colspan="4" class="empty">' + t('logs.empty') + '</td></tr>';
      else filteredTelemetry.forEach(function (ev) {
        var tr = document.createElement('tr');
        var detected = ev.event === 'violation_detected';
        var badge = detected ? '<span class="dap-badge user_report">' + esc(ev.event || 'Detection') + '</span>' : '<span class="dap-badge llm">' + esc(ev.event || ev.action || 'Decision') + '</span>';
        tr.innerHTML = '<td class="dap-log-time">' + esc((ev.t || '').replace('T', ' ').slice(0, 19)) + '</td><td>' + badge + '</td>' +
          '<td class="dap-log-person"><code>' + esc(ev.user_id || '—') + '</code><span>' + t('work.rule') + ' ' + esc(ev.rule_id || '—') + '</span></td>' +
          '<td><div class="dap-msg-box">' + esc(ev.reason ? (ev.reason + ' — ' + (ev.text || '')) : (ev.text || '—')) + '</div></td>';
        tbody.appendChild(tr);
      });
      $('#dap-tel-count', pane).textContent = t('work.showing', null, filteredTelemetry.length, telemetry.length);
      $('#dap-log-file', pane).textContent = logFile;
      $('#dap-log-box', pane).textContent = filteredLines.length ? filteredLines.join('\n') : (logLines.length ? t('logs.empty') : t('queue.empty'));
      $('#dap-log-box', pane).scrollTop = $('#dap-log-box', pane).scrollHeight;
    }

    function loadLogs() {
      var currentRequest = ++requestId;
      dapState.logsRequestId++;
      var moduleRequest = dapState.logsRequestId;
      dapState.logQuery = qInput.value || '';
      $('#dap-lg-state', pane).textContent = t('tbl.loading');
      j('/api/dap/logs?limit=120').then(function (lg) {
        if (!pane.isConnected || currentRequest !== requestId || moduleRequest !== dapState.logsRequestId || (isLive && !isLive(guild, 'logs'))) return;
        if (!lg || lg.__networkError || lg.error) {
          $('#dap-lg-state', pane).textContent = t('work.stale');
          return;
        }
        telemetry = Array.isArray(lg.telemetry) ? lg.telemetry : [];
        logLines = Array.isArray(lg.logLines) ? lg.logLines.map(String) : [];
        logFile = lg.logFile || '';
        $('#dap-lg-state', pane).textContent = '';
        renderVisible();
      }).catch(function () {
        if (currentRequest !== requestId || (isLive && !isLive(guild, 'logs'))) return;
        $('#dap-lg-state', pane).textContent = t('work.stale');
      });
    }
    $('#dap-lg-refresh', pane).addEventListener('click', loadLogs);
    qInput.addEventListener('input', debounce(function () { dapState.logQuery = qInput.value || ''; renderVisible(); }, 180));
    kindSel.addEventListener('change', function () { dapState.logKind = kindSel.value || 'all'; renderVisible(); });
    $('#dap-log-copy', pane).addEventListener('click', function () {
      var parts = [];
      if (dapState.logKind !== 'console') {
        telemetry.filter(function (ev) { return queryMatches([ev.t, ev.event, ev.user_id, ev.rule_id, ev.action, ev.reason, ev.text].join(' ')); })
          .forEach(function (ev) { parts.push([ev.t, ev.event, ev.user_id, ev.rule_id, ev.reason, ev.text].filter(Boolean).join(' · ')); });
      }
      if (dapState.logKind !== 'telemetry') logLines.filter(queryMatches).forEach(function (line) { parts.push(line); });
      var value = parts.join('\n');
      function copied(ok) { showToast(ok ? t('logs.copied') : t('logs.copyError')); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(function () { copied(true); }).catch(function () { copied(false); });
      else {
        var temp = document.createElement('textarea'); temp.value = value; temp.style.position = 'fixed'; temp.style.opacity = '0'; document.body.appendChild(temp); temp.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        temp.remove(); copied(ok);
      }
    });
    $('#dap-log-download', pane).addEventListener('click', function () {
      var parts = [];
      if (dapState.logKind !== 'console') {
        parts.push(t('logs.kind.telemetry'));
        telemetry.filter(function (ev) { return queryMatches([ev.t, ev.event, ev.user_id, ev.rule_id, ev.action, ev.reason, ev.text].join(' ')); })
          .forEach(function (ev) { parts.push([ev.t, ev.event, ev.user_id, ev.rule_id, ev.reason, ev.text].filter(Boolean).join(' · ')); });
      }
      if (dapState.logKind !== 'telemetry') { parts.push('', t('logs.kind.console')); logLines.filter(queryMatches).forEach(function (line) { parts.push(line); }); }
      var blob = new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'macronuxdam-log-' + new Date().toISOString().slice(0, 10) + '.txt'; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    loadLogs();
    return { refresh: loadLogs };
  }

  window.PulseModules = window.PulseModules || {};
  window.PulseModules.macronuxdam = {
    run: runDap,
    dispose: disposeDap
  };
})();
