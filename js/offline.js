// 離線存儲模組 - 管理本地數據存儲

// 存儲鍵名
const STORAGE_KEYS = {
  COURSE_DATA: 'bellScheduleData',
  LAST_UPDATE: 'lastDataChange',
  USER_SETTINGS: 'userSettings',
  DEBUG_LEVEL: 'debugLevel',
  LANGUAGE: 'lang'
};

// 默認設定
const DEFAULT_SETTINGS = {
  keepAliveInterval: 5,
  debugLevel: 1,
  language: 'zh'
};

// 檢查 localStorage 可用性
function isStorageAvailable() {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('[Storage] localStorage not available:', e);
    return false;
  }
}

// 安全的 localStorage 操作
function safeSetItem(key, value) {
  if (!isStorageAvailable()) return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[Storage] Failed to save ${key}:`, e);
    return false;
  }
}

function safeGetItem(key, defaultValue = null) {
  if (!isStorageAvailable()) return defaultValue;

  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`[Storage] Failed to load ${key}:`, e);
    return defaultValue;
  }
}

function safeRemoveItem(key) {
  if (!isStorageAvailable()) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`[Storage] Failed to remove ${key}:`, e);
    return false;
  }
}

// 課程數據存儲
function saveCourseData(data) {
  if (!data) {
    console.warn('[Storage] No data provided to save');
    return false;
  }

  try {
    const offlineData = {
      ...data,
      __offline_meta: {
        savedAt: new Date().toISOString(),
        version: '1.0',
        source: 'gas_api'
      }
    };

    const success = safeSetItem(STORAGE_KEYS.COURSE_DATA, offlineData);

    if (success && data.generatedAt) {
      safeSetItem(STORAGE_KEYS.LAST_UPDATE, data.generatedAt);
    }

    console.log('[Storage] Course data saved successfully');
    return success;
  } catch (e) {
    console.error('[Storage] Failed to save course data:', e);
    return false;
  }
}

// 載入課程數據
function loadCourseData() {
  const data = safeGetItem(STORAGE_KEYS.COURSE_DATA);

  if (data) {
    console.log('[Storage] Course data loaded from local storage');
    return data;
  }

  console.log('[Storage] No local course data found');
  return null;
}

// 檢查是否有本地數據
function hasLocalData() {
  const data = safeGetItem(STORAGE_KEYS.COURSE_DATA);
  return !!(data && data.CourseSchedule);
}

// 取得最後更新時間
function getLastUpdateTime() {
  return safeGetItem(STORAGE_KEYS.LAST_UPDATE);
}

// 用戶設定管理
function saveUserSettings(settings) {
  const currentSettings = safeGetItem(STORAGE_KEYS.USER_SETTINGS, DEFAULT_SETTINGS);
  const newSettings = { ...currentSettings, ...settings };
  return safeSetItem(STORAGE_KEYS.USER_SETTINGS, newSettings);
}

function loadUserSettings() {
  return safeGetItem(STORAGE_KEYS.USER_SETTINGS, DEFAULT_SETTINGS);
}

// 語言設定
function setLanguage(lang) {
  const validLang = (lang === 'en') ? 'en' : 'zh';
  safeSetItem(STORAGE_KEYS.LANGUAGE, validLang);

  // 更新 HTML lang 屬性
  try {
    document.documentElement.lang = validLang === 'en' ? 'en' : 'zh-Hant';
  } catch (e) {
    console.warn('[Storage] Failed to update document language');
  }

  return validLang;
}

function getLanguage() {
  return safeGetItem(STORAGE_KEYS.LANGUAGE, 'zh');
}

// Debug 級別設定
function setDebugLevel(level) {
  const validLevel = Math.max(0, Math.min(2, parseInt(level) || 1));
  safeSetItem(STORAGE_KEYS.DEBUG_LEVEL, validLevel);
  return validLevel;
}

function getDebugLevel() {
  return safeGetItem(STORAGE_KEYS.DEBUG_LEVEL, 1);
}

// 清除所有數據
function clearAllData() {
  const keys = Object.values(STORAGE_KEYS);
  let success = true;

  keys.forEach(key => {
    if (!safeRemoveItem(key)) {
      success = false;
    }
  });

  console.log(success ? '[Storage] All data cleared' : '[Storage] Some data failed to clear');
  return success;
}

// 取得存儲使用情況
function getStorageInfo() {
  if (!isStorageAvailable()) {
    return { available: false };
  }

  try {
    // 估算使用的存儲空間
    let totalSize = 0;
    const items = {};

    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const value = localStorage.getItem(key);
      if (value) {
        const size = new Blob([value]).size;
        items[name] = {
          key,
          size,
          sizeFormatted: formatBytes(size)
        };
        totalSize += size;
      }
    });

    return {
      available: true,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      items,
      lastUpdate: getLastUpdateTime()
    };
  } catch (e) {
    console.error('[Storage] Failed to get storage info:', e);
    return { available: false, error: e.message };
  }
}

// 格式化字節大小
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 導出默認數據（用於初次使用）
function createDefaultData() {
  return {
    CourseSchedule: [],
    CourseTypeDays: {},
    DailyPatternBells: {},
    BellConfig: { "1": 4 }, // 默認鐘聲類型 1，重複 4 次
    generatedAt: new Date().toISOString(),
    __offline_meta: {
      savedAt: new Date().toISOString(),
      version: '1.0',
      source: 'default'
    }
  };
}

// 初始化離線存儲
function initOfflineStorage() {
  // 檢查是否為首次使用
  if (!hasLocalData()) {
    console.log('[Storage] First time use, creating default data');
    const defaultData = createDefaultData();
    saveCourseData(defaultData);
  }

  // 載入用戶設定
  const settings = loadUserSettings();
  const language = getLanguage();

  // 應用設定
  setLanguage(language);

  // 顯示存儲資訊（僅在 debug 模式）
  if (getDebugLevel() >= 2) {
    const info = getStorageInfo();
    console.log('[Storage] Storage info:', info);
  }

  console.log('[Storage] Offline storage initialized');
}

// 導出函數供全域使用
window.OfflineStorage = {
  // 數據操作
  saveCourseData,
  loadCourseData,
  hasLocalData,
  getLastUpdateTime,
  clearAllData,

  // 設定管理
  saveUserSettings,
  loadUserSettings,
  setLanguage,
  getLanguage,
  setDebugLevel,
  getDebugLevel,

  // 工具函數
  isStorageAvailable,
  getStorageInfo,
  createDefaultData,

  // 初始化
  initOfflineStorage
};

// DOM 載入完成後自動初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOfflineStorage);
} else {
  initOfflineStorage();
}