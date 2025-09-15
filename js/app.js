// 主應用程式邏輯 - 核心功能整合

// 全域變數
let alarms = []; // 課程鐘聲排程
let bellConfig = {}; // 鐘聲配置
let currentData = null; // 當前課程數據
let debugLevel = 1; // Debug 級別

// 定時器
let minuteTickerInterval = null;
let autoPlayTimeouts = new Set();

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

    entries.scrollTop = entries.scrollHeight;
  }
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

  // 展開課程排程
  courseSchedule.forEach(schedule => {
    const courseType = schedule.courseType;
    const startDate = new Date(schedule.startDate);
    const patternKeys = courseTypeDays[courseType] || [];

    if (patternKeys.length === 0) return;

    // 生成 30 天的排程
    for (let day = 0; day < 30; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + day);

      const dateStr = formatDate(currentDate);
      const patternIndex = day % patternKeys.length;
      const patternKey = patternKeys[patternIndex];

      const bellPattern = dailyPatternBells[courseType]?.[patternKey] || [];

      bellPattern.forEach(bell => {
        if (bell.time) {
          const bellCount = bell.count || bellConfig[bell.bellType] || 1;

          alarms.push({
            date: dateStr,
            time: bell.time,
            bellType: bell.bellType || '1',
            count: bellCount,
            courseType: courseType,
            patternKey: patternKey
          });
        }
      });
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

  // 僅顯示今天與未來 7 天
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7);
  const maxDateStr = formatDate(maxDate);

  // 依日期排序後渲染
  const allDates = Array.from(dateToTimes.keys()).sort();
  let renderedDays = 0;
  allDates.forEach(date => {
    if (date < today || date > maxDateStr) return;

    const times = Array.from(dateToTimes.get(date)).sort((a, b) => a.localeCompare(b));

    const block = document.createElement('div');
    block.className = `date-block ${date === today ? 'today' : ''}`;

    // 標題
    const h = document.createElement('h3');
    h.textContent = `${date}${date === today ? ' (今日)' : ''}`;
    block.appendChild(h);

    // 單行時間列表（像原本簡潔版）："🔔 HH:MM, HH:MM, ..."
    const p = document.createElement('p');
    p.textContent = `🔔 ${times.join(', ')}`;
    block.appendChild(p);

    container.appendChild(block);
    renderedDays++;
  });

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

  minuteTickerInterval = setInterval(() => {
    checkAutoPlay();

    // 每天 00:00 清理過期鬧鐘
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      deletePastAlarms();
      renderSchedule();
    }
  }, 60000); // 每分鐘檢查一次

  appDebugLog('Minute ticker started');
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
      });
    }
  }

  // 應用翻譯
  applyTranslations();

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