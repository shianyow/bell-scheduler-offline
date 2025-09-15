# 🔔 Bell Scheduler - 離線敲鐘系統

基於混合托管架構的離線優先敲鐘系統，結合 Google Apps Script 後端與靜態網站前端。

## 🏗️ 架構概述

```
┌─────────────────────────────────────────────────────────┐
│                靜態網站 (前端)                          │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │   HTML/CSS/JS   │  │   Service Worker        │   │
│  │   (完整UI邏輯)    │  │   (離線快取)            │   │
│  └─────────────────┘  └─────────────────────────────┘   │
│                    ↓ CORS API 呼叫                   │
└─────────────────────────────────────────────────────────┘
                     │
┌─────────────────────────────────────────────────────────┐
│              Google Apps Script (後端)              │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │  Google Sheets  │  │      API 端點            │   │
│  │  (數據管理)      │  │  /api/course            │   │
│  │                 │  │  /api/keepalive         │   │
│  └─────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 🚀 部署步驟

### 1. 準備 Google Apps Script 後端

1. 使用現有的 GAS 專案或創建新的
2. 在 `Route.gs` 中添加 CORS 支援：

```javascript
function doGet(e) {
  const response = /* 現有邏輯 */;

  // 添加 CORS headers
  if (response && typeof response.setHeader === 'function') {
    response.setHeader('Access-Control-Allow-Origin', 'https://your-domain.github.io');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  return response;
}
```

### 2. 部署靜態網站

#### 選項 A: GitHub Pages (推薦)

1. 創建新的 GitHub Repository
2. 將 `bell-scheduler-static/` 的所有內容上傳到 Repository
3. 在 Repository Settings 中啟用 GitHub Pages
4. 選擇 main branch 作為來源

#### 選項 B: Netlify

1. 註冊 [Netlify](https://netlify.com) 帳號
2. 拖拽 `bell-scheduler-static/` 資料夾到 Netlify
3. 或連接 GitHub Repository 自動部署

#### 選項 C: Vercel

1. 註冊 [Vercel](https://vercel.com) 帳號
2. 匯入 GitHub Repository
3. 自動部署和 CDN 分發

### 3. 設定配置

1. 在 `js/api.js` 中設定您的 GAS Web App URL：

```javascript
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```

2. 在 PWA manifest 中設定正確的域名和圖示

### 4. 添加音檔和圖示

1. 在 `audio/` 目錄中放置 `bell.mp3` 鐘聲檔案
2. 在 `icons/` 目錄中添加 PWA 圖示（參見目錄中的 README）

## 📁 檔案結構

```
bell-scheduler-static/
├── index.html              # 主頁面
├── manifest.json           # PWA 配置
├── sw.js                   # Service Worker
├── css/
│   └── styles.css         # 樣式文件
├── js/
│   ├── app.js             # 主應用邏輯
│   ├── audio.js           # 音頻播放模組
│   ├── api.js             # GAS API 通信
│   └── offline.js         # 離線存儲管理
├── audio/
│   ├── bell.mp3           # 鐘聲音檔 (需要添加)
│   └── README.md          # 音檔說明
├── icons/                 # PWA 圖示 (需要添加)
│   ├── icon-192.png
│   ├── icon-512.png
│   └── README.md          # 圖示說明
└── README.md              # 本文件
```

## ✨ 主要功能

### 🔄 離線優先
- 本地數據存儲 (localStorage)
- Service Worker 快取
- 網路斷線時依然可用

### 📱 PWA 支援
- 可安裝到桌面/主畫面
- 離線運行
- 原生應用體驗

### 🎵 音頻播放
- Web Audio API (主要)
- HTML Audio (降級)
- 支援 MP3 格式音檔

### 🌐 多語言
- 中文/英文切換
- i18n 翻譯系統

### 🔧 開發工具
- Debug 模式
- 網路狀態指示
- 手動同步按鈕

## 🎯 使用方式

### 離線模式運行
1. 首次開啟頁面時連接網路
2. 點擊「同步數據」載入課程排程
3. 之後可完全離線使用

### 數據同步
- **自動**: 偵測到網路後背景檢查更新
- **手動**: 點擊「🔄 同步數據」按鈕

### 手動敲鐘
- 點擊大圓按鈕立即播放鐘聲
- 播放中可點擊停止

### 自動敲鐘
- 根據課程排程自動在指定時間敲鐘
- 顯示今日和未來 7 天的排程

## 🛠️ 開發和自定義

### 修改 GAS API URL
在 `js/api.js` 的開頭修改：
```javascript
const GAS_WEB_APP_URL = 'YOUR_GAS_URL_HERE';
```

### 自定義樣式
編輯 `css/styles.css` 來修改外觀

### 添加新功能
- 在 `js/app.js` 中添加應用邏輯
- 在相應的模組中添加功能

### Debug 模式
- URL 參數：`?debug=2` 啟用詳細 debug
- 或在界面中調整 Debug 級別

## 🔧 疑難排解

### 網路問題
- 檢查 CORS 設定
- 確認 GAS URL 正確
- 檢查防火牆設定

### 音檔問題
- 確保 `audio/bell.mp3` 存在
- 檢查檔案格式和大小
- 測試瀏覽器音頻支援

### 快取問題
- 清除瀏覽器快取
- 重新註冊 Service Worker
- 檢查開發者工具的 Application 頁籤

## 📄 授權

MIT License - 歡迎修改和分發

## 🤝 貢獻

歡迎提交 Issues 和 Pull Requests！