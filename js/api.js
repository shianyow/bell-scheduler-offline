// API 通信模組 - 與 Google Apps Script 後端通信

// 配置 - 需要設定您的 GAS Web App URL
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

// API 狀態管理
let apiStatus = 'unknown'; // 'online', 'offline', 'error', 'unknown'
let lastSyncTime = null;

// 網路狀態檢測
let isOnline = navigator.onLine;

// 偵聽網路狀態變化
window.addEventListener('online', () => {
  isOnline = true;
  updateNetworkStatus();
  console.log('[API] Network status: online');
});

window.addEventListener('offline', () => {
  isOnline = false;
  updateNetworkStatus();
  console.log('[API] Network status: offline');
});

// 更新網路狀態指示器
function updateNetworkStatus() {
  const indicator = document.getElementById('offline-indicator');
  const syncBtn = document.getElementById('sync-btn');

  if (indicator) {
    if (isOnline && apiStatus === 'online') {
      indicator.textContent = '🟢 線上模式';
      indicator.className = 'offline-indicator online';
      indicator.style.display = 'block';
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 3000); // 3秒後隱藏
    } else if (!isOnline || apiStatus === 'offline') {
      indicator.textContent = '🔴 離線模式';
      indicator.className = 'offline-indicator';
      indicator.style.display = 'block';
    }
  }

  if (syncBtn) {
    syncBtn.disabled = !isOnline;
    syncBtn.textContent = isOnline ? '🔄 同步數據' : '📡 無網路';
  }
}

// HTTP 請求函數（帶重試機制）
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      console.warn(`[API] Request attempt ${i + 1} failed:`, error);

      if (i < maxRetries) {
        // 等待時間隨重試次數增加
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// 獲取課程數據 (v2 API)
async function fetchCourseData() {
  try {
    console.log('[API] Fetching course data...');

    const response = await fetchWithRetry(`${GAS_WEB_APP_URL}?path=v2/course`);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || data.error);
    }

    console.log('[API] Course data fetched successfully');
    apiStatus = 'online';
    lastSyncTime = new Date();

    return data;
  } catch (error) {
    console.error('[API] Failed to fetch course data:', error);
    apiStatus = 'offline';
    throw error;
  }
}

// Keep-alive 檢查
async function performKeepAlive() {
  try {
    console.log('[API] Performing keep-alive check...');

    const response = await fetchWithRetry(`${GAS_WEB_APP_URL}?path=keepalive`);
    const data = await response.json();

    if (data.status === 'OK') {
      console.log('[API] Keep-alive successful');
      apiStatus = 'online';
      lastSyncTime = new Date();
      return data;
    } else {
      throw new Error('Keep-alive check failed');
    }
  } catch (error) {
    console.error('[API] Keep-alive check failed:', error);
    apiStatus = 'offline';
    throw error;
  }
}

// 檢查數據是否需要更新
async function checkDataUpdate() {
  try {
    const keepAliveData = await performKeepAlive();

    if (keepAliveData && keepAliveData.lastDataChange) {
      const localLastChange = window.OfflineStorage?.getLastUpdateTime();

      if (!localLastChange || keepAliveData.lastDataChange !== localLastChange) {
        console.log('[API] Data update available');
        return {
          needsUpdate: true,
          serverTime: keepAliveData.lastDataChange,
          localTime: localLastChange
        };
      }
    }

    return { needsUpdate: false };
  } catch (error) {
    console.error('[API] Failed to check data update:', error);
    return { needsUpdate: false, error };
  }
}

// 手動同步數據
async function syncData() {
  const syncBtn = document.getElementById('sync-btn');
  const statusDiv = document.getElementById('status');

  if (!isOnline) {
    showStatus('❌ 無網路連接，無法同步', 'error');
    return false;
  }

  try {
    // 更新同步按鈕狀態
    if (syncBtn) {
      syncBtn.classList.add('syncing');
      syncBtn.textContent = '🔄 同步中...';
      syncBtn.disabled = true;
    }

    showStatus('🔄 正在同步數據...', 'loading');

    // 獲取最新數據
    const courseData = await fetchCourseData();

    // 保存到本地
    if (window.OfflineStorage) {
      window.OfflineStorage.saveCourseData(courseData);
    }

    // 應用數據到界面
    if (window.AppModule && window.AppModule.applyCourseData) {
      window.AppModule.applyCourseData(courseData);
    }

    showStatus('✅ 數據同步完成', 'success');
    updateNetworkStatus();

    return true;
  } catch (error) {
    console.error('[API] Sync failed:', error);
    showStatus(`❌ 同步失敗: ${error.message}`, 'error');
    return false;
  } finally {
    // 恢復同步按鈕狀態
    if (syncBtn) {
      syncBtn.classList.remove('syncing');
      syncBtn.textContent = '🔄 同步數據';
      syncBtn.disabled = false;
    }
  }
}

// 背景檢查數據更新
async function backgroundDataCheck() {
  if (!isOnline) return;

  try {
    const updateInfo = await checkDataUpdate();

    if (updateInfo.needsUpdate) {
      // 靜默獲取新數據
      const courseData = await fetchCourseData();

      if (window.OfflineStorage) {
        window.OfflineStorage.saveCourseData(courseData);
      }

      // 可選：通知用戶有新數據
      showStatus('📱 已更新最新數據', 'success');

      // 重新渲染界面
      if (window.AppModule && window.AppModule.applyCourseData) {
        window.AppModule.applyCourseData(courseData);
      }
    }
  } catch (error) {
    console.warn('[API] Background data check failed:', error);
  }
}

// 顯示狀態消息
function showStatus(message, type = 'loading') {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }
}

// 初始化 API 模組
function initApiModule() {
  // 綁定同步按鈕
  const syncBtn = document.getElementById('sync-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', syncData);
  }

  // 初始化網路狀態
  updateNetworkStatus();

  // 設定背景檢查間隔（每 5 分鐘檢查一次）
  setInterval(backgroundDataCheck, 5 * 60 * 1000);

  // 頁面載入後立即檢查一次
  setTimeout(backgroundDataCheck, 2000);

  console.log('[API] API module initialized');
}

// 導出函數供全域使用
window.ApiModule = {
  initApiModule,
  fetchCourseData,
  performKeepAlive,
  checkDataUpdate,
  syncData,
  backgroundDataCheck,
  showStatus,

  // 配置
  setGasUrl: (url) => { GAS_WEB_APP_URL = url; },

  // 狀態查詢
  get isOnline() { return isOnline; },
  get apiStatus() { return apiStatus; },
  get lastSyncTime() { return lastSyncTime; }
};

// DOM 載入完成後自動初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApiModule);
} else {
  initApiModule();
}