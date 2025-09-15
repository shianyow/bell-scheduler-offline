# PWA 圖示和截圖

本目錄包含 PWA (Progressive Web App) 所需的圖示和截圖。

## 需要的圖示文件

### 必要圖示
- `icon-72.png` (72×72) - Android 小圖示
- `icon-96.png` (96×96) - Android 中圖示
- `icon-128.png` (128×128) - Chrome Web Store
- `icon-144.png` (144×144) - Android 大圖示
- `icon-152.png` (152×152) - iOS 圖示
- `icon-192.png` (192×192) - Android 主要圖示
- `icon-384.png` (384×384) - Android 超大圖示
- `icon-512.png` (512×512) - PWA 標準圖示

### 可選截圖
- `screenshot-1.png` (360×640) - 手機版截圖
- `screenshot-2.png` (1024×768) - 桌面版截圖

## 設計建議

### 圖示設計元素
- 主色調：#707070 (灰色，與應用主題一致)
- 背景色：#f5f5f5 (淺灰色)
- 圖示內容：鐘或梵文符號
- 風格：簡約、現代

### 圖示要求
- **格式**: PNG (支援透明背景)
- **色彩模式**: RGB
- **解析度**: 如上表所列
- **安全區域**: 為 maskable 圖示預留 20% 邊距

## 快速創建圖示

### 方法 1: 線上工具
1. 使用 [PWA Builder](https://www.pwabuilder.com/) 圖示生成器
2. 上傳 512×512 的基礎圖示
3. 自動生成所有尺寸

### 方法 2: 圖像編輯軟體
1. 創建 512×512 的基礎圖示
2. 使用 Photoshop/GIMP 批量縮放
3. 確保每個尺寸都清晰可見

### 方法 3: 代碼生成 (臨時方案)
```html
<!-- 可以使用 canvas 生成簡單的圖示 -->
<canvas width="512" height="512" id="iconCanvas"></canvas>
<script>
const canvas = document.getElementById('iconCanvas');
const ctx = canvas.getContext('2d');

// 背景
ctx.fillStyle = '#707070';
ctx.fillRect(0, 0, 512, 512);

// 鐘形圖案
ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.arc(256, 200, 80, 0, Math.PI * 2);
ctx.fill();

// 文字
ctx.font = '48px Arial';
ctx.fillStyle = '#ffffff';
ctx.textAlign = 'center';
ctx.fillText('鐘', 256, 350);
</script>
```

## 注意事項

1. **Maskable 圖示**: 192×192 和 512×512 的圖示會被用作 maskable，需要在安全區域內放置重要元素
2. **測試**: 在不同設備和瀏覽器中測試圖示顯示效果
3. **一致性**: 確保所有圖示保持視覺一致性
4. **可讀性**: 小尺寸圖示也要保持清晰可辨識

## 臨時替代方案

如果暫時沒有圖示文件，可以：
1. 複製一個簡單的純色 PNG 圖片並重命名
2. 使用線上圖示生成器快速創建
3. 從 favicon 放大製作

應用程式在沒有圖示的情況下仍可正常運行，但安裝和視覺體驗會受到影響。