// i18n 鍵補齊函式，於 TRANSLATIONS 宣告後呼叫
function ensureI18nKeys() {
  TRANSLATIONS.zh['label.today'] = TRANSLATIONS.zh['label.today'] || '今日';
  TRANSLATIONS.en['label.today'] = TRANSLATIONS.en['label.today'] || 'Today';
  TRANSLATIONS.zh['log.title'] = TRANSLATIONS.zh['log.title'] || '鐘聲記錄';
  TRANSLATIONS.en['log.title'] = TRANSLATIONS.en['log.title'] || 'Bell Log';
  TRANSLATIONS.zh['btn.sync'] = TRANSLATIONS.zh['btn.sync'] || '同步數據';
  TRANSLATIONS.en['btn.sync'] = TRANSLATIONS.en['btn.sync'] || 'Sync Data';
  TRANSLATIONS.zh['btn.syncing'] = TRANSLATIONS.zh['btn.syncing'] || '同步中...';
  TRANSLATIONS.en['btn.syncing'] = TRANSLATIONS.en['btn.syncing'] || 'Syncing...';
  TRANSLATIONS.zh['status.no_network'] = TRANSLATIONS.zh['status.no_network'] || '❌ 無網路連接，無法同步';
  TRANSLATIONS.en['status.no_network'] = TRANSLATIONS.en['status.no_network'] || '❌ No network connection';
  TRANSLATIONS.zh['status.syncing'] = TRANSLATIONS.zh['status.syncing'] || '🔄 正在同步數據...';
  TRANSLATIONS.en['status.syncing'] = TRANSLATIONS.en['status.syncing'] || '🔄 Syncing data...';
  TRANSLATIONS.zh['status.sync_done'] = TRANSLATIONS.zh['status.sync_done'] || '✅ 數據同步完成';
  TRANSLATIONS.en['status.sync_done'] = TRANSLATIONS.en['status.sync_done'] || '✅ Data synced';
  TRANSLATIONS.zh['status.updated'] = TRANSLATIONS.zh['status.updated'] || '📱 已更新最新數據';
  TRANSLATIONS.en['status.updated'] = TRANSLATIONS.en['status.updated'] || '📱 Updated to latest data';
  // 額外 UI 鍵
  TRANSLATIONS.zh['btn.show_more_days'] = TRANSLATIONS.zh['btn.show_more_days'] || '顯示更多日期';
  TRANSLATIONS.en['btn.show_more_days'] = TRANSLATIONS.en['btn.show_more_days'] || 'Show more days';
  TRANSLATIONS.zh['btn.show_less_days'] = TRANSLATIONS.zh['btn.show_less_days'] || '顯示較少日期';
  TRANSLATIONS.en['btn.show_less_days'] = TRANSLATIONS.en['btn.show_less_days'] || 'Show fewer days';
}

// 綁定 Debug 區塊的捲動事件：若使用者離開底部，則暫停自動捲動
function initDebugLogScroll() {
  const entries = document.getElementById('debug-entries');
  if (!entries) return;
  entries.addEventListener('scroll', () => {
    const distanceFromBottom = entries.scrollHeight - entries.scrollTop - entries.clientHeight;
    // 在底部 8px 以內視為在底部，保持自動捲動；否則暫停
    debugAutoScroll = distanceFromBottom <= 8;
  });
}
// 主應用程式邏輯 - 核心功能整合

// 全域變數
let alarms = []; // 課程鐘聲排程
let bellConfig = {}; // 鐘聲配置
let currentData = null; // 當前課程數據
let debugLevel = 1; // Debug 級別

// 定時器
let minuteTickerInterval = null;
let autoPlayTimeouts = new Set();
// Debug 面板自動捲動旗標（使用者若手動往上捲則暫停自動捲動）
let debugAutoScroll = true;
// 是否顯示全部未來日期（預設僅 30 天）
let showAllDates = false;

// i18n 翻譯
const TRANSLATIONS = {
  zh: {
    'play_button.play': '點此手動敲鐘<br />▶️',
    'play_button.stop': '點此停止鐘聲<br/>⏹️',
    'audio.unlock_prompt': '請點擊畫面以啟用鐘聲🔓',
    'audio.unlocked': '音訊已解鎖！🔊',
    'status.checking': '💓 檢查中...',
    'status.ok_prefix': '✅ 課程資料最後更新：',
    'status.system_abnormal': '⚠️ 系統狀態異常',
    'status.offline_mode': '🔴 離線模式 - 使用本地數據',
    'status.online_mode': '🟢 線上模式 - 數據已同步',
    'status.first_use': '⚠️ 首次使用 - 請連網同步數據',
    'tools.show_debug': '顯示 Debug Log',
    'tools.hide_debug': '隱藏除錯紀錄',
    'tools.lang_toggle': '切換語言',
    'debug.title': 'Debug Log',
    'debug.level.0': '0 關閉',
    'debug.level.1': '1 一般',
    'debug.level.2': '2 詳細',
    'log.type.auto': '自動',
    'log.type.manual': '手動',
    'log.played': '播放鐘聲'
  },
  en: {
    'play_button.play': 'Click To Play Gong<br />▶️',
    'play_button.stop': 'Click To Stop Gong<br/>⏹️',
    'audio.unlock_prompt': 'Tap anywhere to enable sound 🔓',
    'audio.unlocked': 'Audio unlocked! 🔊',
    'status.checking': '💓 Checking...',
    'status.ok_prefix': '✅ Last data update: ',
    'status.system_abnormal': '⚠️ System abnormal',
    'status.offline_mode': '🔴 Offline Mode - Using local data',
    'status.online_mode': '🟢 Online Mode - Data synced',
    'status.first_use': '⚠️ First use - Please connect to sync data',
    'tools.show_debug': 'Show Debug Log',
    'tools.hide_debug': 'Hide Debug Log',
    'tools.lang_toggle': 'Switch language',
    'debug.title': 'Debug Log',
    'debug.level.0': '0 Off',
    'debug.level.1': '1 Normal',
    'debug.level.2': '2 Verbose',
    'log.type.auto': 'Auto',
    'log.type.manual': 'Manual',
    'log.played': 'Gong played'
  }
};

// 在宣告 TRANSLATIONS 之後補齊缺少的鍵
try { if (typeof ensureI18nKeys === 'function') ensureI18nKeys(); } catch (_) {}

// 翻譯函數
function t(key) {
  const lang = window.OfflineStorage?.getLanguage() || 'zh';
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.zh[key] || key;
}

// 應用翻譯到界面
function applyTranslations() {
  // 靜態元素翻譯
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const asHtml = el.getAttribute('data-i18n-html') === '1';
    const text = t(key);
    if (asHtml) el.innerHTML = text;
    else el.textContent = text;
  });

  // 屬性翻譯
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });

  // Debug 標題和選項
  const debugTitle = document.getElementById('debug-title');
  if (debugTitle) debugTitle.textContent = t('debug.title');

  const debugLevelOptions = document.querySelectorAll('#debug-level-select option');
  debugLevelOptions.forEach((option, index) => {
    option.textContent = t(`debug.level.${index}`);
  });

  // 更新按鈕文字
  updateToolsButtonText();
}

// 更新工具按鈕文字
function updateToolsButtonText() {
  const toolsBtn = document.getElementById('tools-btn');
  const debugDiv = document.getElementById('debug-log');

  if (toolsBtn && debugDiv) {
    const isHidden = (debugDiv.style.display === 'none' || !debugDiv.style.display);
    toolsBtn.title = t(isHidden ? 'tools.show_debug' : 'tools.hide_debug');
  }
}

// Debug 記錄（避免與 DOM 變數同名造成遮蔽，命名為 appDebugLog）
function appDebugLog(message, level = 1) {
  if (level > debugLevel) return;

  const now = new Date().toLocaleTimeString();
  const logEntry = `[${now}] ${message}`;

  // 控制台輸出
  console.log(logEntry);

  // 界面 Debug Log
  const entries = document.getElementById('debug-entries');
  if (entries) {
    const div = document.createElement('div');
    div.textContent = logEntry;
    entries.appendChild(div);

    // 限制記錄數量
    while (entries.children.length > 100) {
      entries.removeChild(entries.firstChild);
    }
    if (debugAutoScroll) scrollDebugToBottom();
  }
}

// 將 Debug Log 區塊卷動到底部（顯示最新）
function scrollDebugToBottom() {
  const entries = document.getElementById('debug-entries');
  if (!entries) return;
  // 使用 requestAnimationFrame 確保 DOM 已插入
  requestAnimationFrame(() => {
    entries.scrollTop = entries.scrollHeight;
  });
}

// 應用課程數據到界面
function applyCourseData(data) {
  if (!data) {
    appDebugLog('No course data provided');
    return;
  }

  appDebugLog('Applying course data to UI');
  currentData = data;

  // 清空現有鬧鐘
  alarms = [];
  bellConfig = data.BellConfig || {};

  const courseSchedule = Array.isArray(data.CourseSchedule) ? data.CourseSchedule : [];
  const courseTypeDays = data.CourseTypeDays || {};
  const dailyPatternBells = data.DailyPatternBells || {};

  // 展開「今天 ~ 未來 180 天」的鬧鐘（渲染時預設僅顯示 30 天）
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const maxDate = new Date(todayDate);
  maxDate.setDate(maxDate.getDate() + 180);

  courseSchedule.forEach(schedule => {
    const courseType = schedule.courseType;
    const startDateStr = schedule.startDate;
    const courseDaysKeys = courseTypeDays[courseType] || [];
    // 若 API 未提供天數，改用 CourseTypeDays 的長度作為期數天數（舊版行為）
    let periodLength = Number(schedule.days || schedule.length || 0);
    if (!periodLength || periodLength < 0) {
      periodLength = courseDaysKeys.length || 0;
    }
    if (!courseType || !startDateStr || periodLength <= 0) return;

    const startDate = parseYMD(startDateStr);
    if (!startDate) return;

    for (let day = 0; day < periodLength; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      const dateStr = formatDate(date);

      const patternKey = courseDaysKeys[day];
      if (!patternKey) continue;

      const bellPattern = dailyPatternBells[courseType]?.[patternKey] || [];
      for (const bell of bellPattern) {
        if (!bell.time) continue;
        const bellCount = bell.count || bellConfig[bell.bellType] || 1;
        alarms.push({
          date: dateStr,
          time: bell.time,
          bellType: bell.bellType || '1',
          count: bellCount,
          courseType,
          patternKey
        });
      }
    }
  });

  // 排序並渲染
  sortAlarms();
  renderSchedule();

  appDebugLog(`Applied ${alarms.length} alarms from course data`);
}

// 排序鬧鐘
function sortAlarms() {
  alarms.sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time}`);
    const dateB = new Date(`${b.date} ${b.time}`);
    return dateA - dateB;
  });
}

// 格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 將 'YYYY-MM-DD' 解析為本地時區的 Date（避免瀏覽器將字串當作 UTC 導致誤差）
function parseYMD(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const d = new Date(year, month, day);
  d.setHours(0,0,0,0);
  return d;
}

// 渲染排程界面
function renderSchedule() {
  const container = document.getElementById('schedule-list');
  if (!container) return;

  container.innerHTML = '';

  if (alarms.length === 0) {
    container.innerHTML = '<div class="status error">📅 無課程排程資料</div>';
    return;
  }

  const today = formatDate(new Date());
  const dateToTimes = new Map(); // date -> Set(times)

  // 收集每日期間（去重、排序）
  alarms.forEach(a => {
    if (!dateToTimes.has(a.date)) dateToTimes.set(a.date, new Set());
    dateToTimes.get(a.date).add(a.time);
  });

  // 僅顯示今天與未來 30 天（除非使用者要求顯示更多）
  const limitDays = 30;
  const maxDateDefault = new Date();
  maxDateDefault.setDate(maxDateDefault.getDate() + limitDays);
  const maxDateDefaultStr = formatDate(maxDateDefault);

  // 依日期排序後渲染
  const allDatesSorted = Array.from(dateToTimes.keys()).filter(d => d >= today).sort();
  const datesToRender = showAllDates
    ? allDatesSorted
    : allDatesSorted.filter(d => d <= maxDateDefaultStr);

  let renderedDays = 0;
  datesToRender.forEach(date => {
    const times = Array.from(dateToTimes.get(date)).sort((a, b) => a.localeCompare(b));

    const block = document.createElement('div');
    block.className = `date-block ${date === today ? 'today' : ''}`;

    // 標題
    const h = document.createElement('h3');
    h.textContent = `${date}${date === today ? ' (' + t('label.today') + ')' : ''}`;
    block.appendChild(h);

    // 單行時間列表（簡潔版）："🔔 HH:MM, HH:MM, ..."
    const p = document.createElement('p');
    p.textContent = `🔔 ${times.join(', ')}`;
    block.appendChild(p);

    container.appendChild(block);
    renderedDays++;
  });

  // 如果還有更多未來日期，加入「顯示更多」按鈕
  const hasMore = !showAllDates && allDatesSorted.length > datesToRender.length;
  if (hasMore) {
    const moreDiv = document.createElement('div');
    moreDiv.style.textAlign = 'center';
    moreDiv.style.margin = '12px 0 0';

    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.textContent = t('btn.show_more_days');
    btn.addEventListener('click', () => {
      showAllDates = true;
      renderSchedule();
    });
    moreDiv.appendChild(btn);
    container.appendChild(moreDiv);
  }

  // 當已顯示全部日期時，提供「顯示較少」按鈕以折回 30 天
  if (showAllDates && allDatesSorted.length > 0) {
    const lessDiv = document.createElement('div');
    lessDiv.style.textAlign = 'center';
    lessDiv.style.margin = '12px 0 0';

    const btnLess = document.createElement('button');
    btnLess.className = 'tool-btn';
    btnLess.textContent = t('btn.show_less_days');
    btnLess.addEventListener('click', () => {
      showAllDates = false;
      renderSchedule();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0,0); }
    });
    lessDiv.appendChild(btnLess);
    container.appendChild(lessDiv);
  }

  // 已輸出 concise 版本的渲染統計
}

// 檢查並執行自動敲鐘
function checkAutoPlay() {
  if (!alarms.length) return;

  const now = new Date();
  const currentTime = formatTime(now);
  const currentDate = formatDate(now);

  alarms.forEach(alarm => {
    if (alarm.date === currentDate && alarm.time === currentTime) {
      const alarmKey = `${alarm.date}_${alarm.time}`;

      // 避免重複執行
      if (!autoPlayTimeouts.has(alarmKey)) {
        autoPlayTimeouts.add(alarmKey);

        appDebugLog(`Auto play triggered: ${alarm.time}, count: ${alarm.count}`, 0);

        if (window.AudioModule) {
          window.AudioModule.playBell(alarm.count, 'auto');
        }

        // 1小時後清除記錄
        setTimeout(() => {
          autoPlayTimeouts.delete(alarmKey);
        }, 3600000);
      }
    }
  });
}

// 格式化時間 (HH:MM)
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 啟動分鐘計時器
function startMinuteTicker() {
  if (minuteTickerInterval) {
    clearInterval(minuteTickerInterval);
  }

  // 去重 key："YYYY-MM-DD HH:MM"
  window.__lastAutoFireKey = window.__lastAutoFireKey || '';
  window.__midnightCleanupFor = window.__midnightCleanupFor || '';

  minuteTickerInterval = setInterval(() => {
    const t = new Date();
    const sec = t.getSeconds();

    // 僅在每分鐘的前 0~5 秒內檢查與觸發，避免 setInterval 漂移造成錯過整點
    if (sec > 5) return;

    const currentDate = formatDate(t);
    const currentTime = formatTime(t); // HH:MM
    const currentKey = `${currentDate} ${currentTime}`;

    // 每分鐘頭 0~1 秒輸出 tick（verbose），避免洗版
    if (sec <= 1) {
      const hasMatch = !!alarms.find(a => a.date === currentDate && a.time === currentTime);
      appDebugLog(`[tick] now=${currentKey} (sec=${sec}), hasMatch=${hasMatch}`, 2);
    }

    // 自動觸發（去重）
    if (window.__lastAutoFireKey !== currentKey) {
      const match = alarms.find(a => a.date === currentDate && a.time === currentTime);
      if (match) {
        window.__lastAutoFireKey = currentKey;
        const repeat = Number(match.count || 1) || 1;
        appDebugLog(`自動播放鐘聲: repeat=${repeat}`);
        if (window.AudioModule) {
          window.AudioModule.playBell(repeat, 'auto');
        }
      }
    }

    // 每日 00:00 視窗內做一次清理與重繪
    if (t.getHours() === 0 && t.getMinutes() === 0) {
      if (window.__midnightCleanupFor !== currentDate) {
        try {
          appDebugLog('[midnight] running: deletePastAlarms + refresh', 2);
          deletePastAlarms();
          renderSchedule();
        } finally {
          window.__midnightCleanupFor = currentDate;
        }
      }
    }
  }, 1000);

  appDebugLog('Minute ticker started (1s interval, 0-5s window)');
}

// 刪除過期的鬧鐘
function deletePastAlarms() {
  const today = formatDate(new Date());
  const beforeCount = alarms.length;

  alarms = alarms.filter(alarm => alarm.date >= today);

  const deletedCount = beforeCount - alarms.length;
  if (deletedCount > 0) {
    appDebugLog(`Deleted ${deletedCount} past alarms`);
  }
}

// 初始化應用程式
async function initApp() {
  appDebugLog('Initializing application...');

  // 載入用戶設定
  if (window.OfflineStorage) {
    const settings = window.OfflineStorage.loadUserSettings();
    debugLevel = window.OfflineStorage.getDebugLevel();

    // 設定 debug 級別選擇器
    const debugSelect = document.getElementById('debug-level-select');
    if (debugSelect) {
      debugSelect.value = String(debugLevel);
      debugSelect.addEventListener('change', (e) => {
        const level = parseInt(e.target.value) || 1;
        debugLevel = level;
        window.OfflineStorage?.setDebugLevel(level);
        appDebugLog(`Debug level set to ${level}`, 0);
        scrollDebugToBottom();
      });
    }
  }

  // 應用翻譯
  applyTranslations();

  // 綁定 Debug 捲動行為
  initDebugLogScroll();

  // 載入本地數據
  let hasData = false;
  if (window.OfflineStorage?.hasLocalData()) {
    const localData = window.OfflineStorage.loadCourseData();
    if (localData) {
      applyCourseData(localData);
      hasData = true;

      // 顯示離線模式狀態
      if (window.ApiModule) {
        window.ApiModule.showStatus(t('status.offline_mode'), 'offline');
      }
    }
  }

  // 如果沒有本地數據，顯示首次使用提示
  if (!hasData) {
    if (window.ApiModule) {
      window.ApiModule.showStatus(t('status.first_use'), 'error');
    }
  }

  // 初始化工具按鈕
  initToolButtons();

  // 啟動定時器
  startMinuteTicker();

  // 背景檢查數據更新
  if (window.ApiModule) {
    setTimeout(() => {
      window.ApiModule.backgroundDataCheck();
    }, 3000);
  }

  appDebugLog('Application initialized successfully');
}

// 初始化工具按鈕
function initToolButtons() {
  // Debug Log 切換按鈕
  const toolsBtn = document.getElementById('tools-btn');
  const debugPanelDiv = document.getElementById('debug-log');

  if (toolsBtn && debugPanelDiv) {
    toolsBtn.addEventListener('click', () => {
      const isHidden = (debugPanelDiv.style.display === 'none' || !debugPanelDiv.style.display);
      debugPanelDiv.style.display = isHidden ? 'block' : 'none';
      updateToolsButtonText();
      if (isHidden) {
        // 打開面板時自動卷到底部
        debugAutoScroll = true;
        scrollDebugToBottom();
      }
    });
  }

  // 語言切換按鈕
  const langBtn = document.getElementById('lang-btn');
  if (langBtn && window.OfflineStorage) {
    langBtn.addEventListener('click', () => {
      const currentLang = window.OfflineStorage.getLanguage();
      const newLang = currentLang === 'zh' ? 'en' : 'zh';
      window.OfflineStorage.setLanguage(newLang);
      applyTranslations();
      appDebugLog(`Language switched to ${newLang}`);
    });
  }
}

// 導出函數供全域使用
window.AppModule = {
  initApp,
  applyCourseData,
  renderSchedule,
  t,
  applyTranslations,
  debugLog: appDebugLog,

  // 狀態查詢
  get currentData() { return currentData; },
  get alarms() { return alarms; },
  get debugLevel() { return debugLevel; }
};

// 使翻譯函數全域可用
window.t = t;
// 也導出全域 appDebugLog，避免其他模組需直接呼叫
window.appDebugLog = appDebugLog;

// DOM 載入完成後初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 確保其他模組已初始化後再啟動應用
    setTimeout(initApp, 100);
  });
} else {
  setTimeout(initApp, 100);
}