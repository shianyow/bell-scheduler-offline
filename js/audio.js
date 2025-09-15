// 音頻播放模組 - 使用 MP3 檔案

// 音頻相關變數
let audioCtx = null;
let bellBuffer = null;
let gainNode = null;
let audioUnlocked = false;
let isAlarmPlaying = false;

// Web Audio 相關
const activeSources = new Set();
const activeAudios = new Set();

// 音量設定
const FIRST_STRIKE_VOLUME = 0.35;
const FIRST_STRIKE_ATTACK_MUTE_MS = 30;

// 音檔路徑
const BELL_AUDIO_URL = 'audio/bell.mp3';

// 音頻解鎖相關
function showAudioUnlockMsg() {
  const banner = document.getElementById('audio-unlock-banner');
  if (banner) {
    banner.style.display = 'block';
  }
}

function hideAudioUnlockMsg() {
  const banner = document.getElementById('audio-unlock-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

// 音頻解鎖函數
async function unlockAudio() {
  if (audioUnlocked) return;

  try {
    // 1) 建立 AudioContext
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      if (!audioCtx) {
        audioCtx = new AC();
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0;
        gainNode.connect(audioCtx.destination);
      }

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // 2) 預先載入並解碼鐘聲音檔
      if (!bellBuffer) {
        try {
          console.log('[Audio] Loading bell audio file...');
          const response = await fetch(BELL_AUDIO_URL);
          const arrayBuffer = await response.arrayBuffer();

          bellBuffer = await new Promise((resolve, reject) => {
            audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
          });

          console.log(`[Audio] Bell buffer decoded: duration=${bellBuffer.duration.toFixed(2)}s`);
        } catch (e) {
          console.error('[Audio] Failed to load/decode bell audio:', e);
          // 降級到 HTML Audio
        }
      }

      // 3) 播放靜音以解鎖（iOS 需要）
      if (audioCtx && gainNode) {
        const silentSource = audioCtx.createBufferSource();
        const silentBuffer = audioCtx.createBuffer(1, 1, 22050);
        silentSource.buffer = silentBuffer;
        silentSource.connect(gainNode);
        silentSource.start();
        silentSource.stop(audioCtx.currentTime + 0.1);
      }

      audioUnlocked = true;
      hideAudioUnlockMsg();
      console.log('[Audio] Audio unlocked successfully');
    }
  } catch (e) {
    console.error('[Audio] Failed to unlock audio:', e);
  }
}

// 等待音頻解鎖
async function ensureAudioUnlocked(timeoutMs = 1200) {
  if (audioUnlocked) return true;

  try {
    await unlockAudio();
  } catch (e) {
    console.error('[Audio] Error during unlock:', e);
  }

  const start = Date.now();
  while (!audioUnlocked && (Date.now() - start) < timeoutMs) {
    await new Promise(r => setTimeout(r, 50));
  }

  if (!audioUnlocked) {
    showAudioUnlockMsg();
  }

  return audioUnlocked;
}

// 播放單次鐘聲
function playSingleAlarm(current, total) {
  if (!audioUnlocked) {
    showAudioUnlockMsg();
    return;
  }

  // 優先使用 Web Audio（更好的性能和控制）
  if (audioCtx && bellBuffer) {
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const src = audioCtx.createBufferSource();
      src.buffer = bellBuffer;

      // 針對第一聲設定較小音量
      const perStrikeGain = audioCtx.createGain();
      const t0 = audioCtx.currentTime;
      const vol = (current === 1 ? FIRST_STRIKE_VOLUME : 1.0);

      if (current === 1) {
        // iOS 友善：先靜音再切到目標音量
        perStrikeGain.gain.setValueAtTime(0.0, t0);
        perStrikeGain.gain.setValueAtTime(vol, t0 + FIRST_STRIKE_ATTACK_MUTE_MS / 1000);
      } else {
        perStrikeGain.gain.setValueAtTime(1.0, t0);
      }

      src.connect(perStrikeGain);
      perStrikeGain.connect(gainNode || audioCtx.destination);
      activeSources.add(src);

      src.onended = function() {
        try { src.disconnect(); } catch (e) {}
        activeSources.delete(src);
      };

      src.start(t0 + 0.01);
      console.log(`[Audio] Bell played (WebAudio): ${current}/${total} vol=${vol}`);
      try { if (window.appDebugLog) window.appDebugLog(`[Audio] Bell played (WebAudio): ${current}/${total} vol=${vol}`, 2); } catch (e) {}
      return;
    } catch (e) {
      console.error('[Audio] WebAudio play error:', e);
    }
  }

  // 降級到 HTML Audio
  try {
    const audio = new Audio(BELL_AUDIO_URL);

    if (current === 1) {
      audio.volume = 0.0;
      setTimeout(() => {
        try { audio.volume = FIRST_STRIKE_VOLUME; } catch (e) {}
      }, FIRST_STRIKE_ATTACK_MUTE_MS);
    } else {
      audio.volume = 1.0;
    }

    activeAudios.add(audio);
    audio.onended = function() {
      activeAudios.delete(audio);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.error('[Audio] HTML Audio play error:', e));
    }

    console.log(`[Audio] Bell played (HTMLAudio): ${current}/${total}`);
    try { if (window.appDebugLog) window.appDebugLog(`[Audio] Bell played (HTMLAudio): ${current}/${total}`, 2); } catch (e) {}
  } catch (e) {
    console.error('[Audio] HTML Audio error:', e);
  }
}

// 停止所有鐘聲播放
function stopAllAlarms() {
  isAlarmPlaying = false;

  // 停止所有 HTMLAudio 實例
  activeAudios.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  });
  activeAudios.clear();

  // 停止所有 Web Audio BufferSource
  activeSources.forEach((source) => {
    try { source.stop(0); } catch (e) {}
    try { source.disconnect(); } catch (e) {}
  });
  activeSources.clear();

  console.log('[Audio] All alarms stopped');
  try { if (window.appDebugLog) window.appDebugLog('[Audio] All alarms stopped'); } catch (e) {}
}

// 播放鐘聲（指定次數）
async function playBell(times, trigger = 'manual') {
  if (times < 1) return;

  // 先確保已解鎖
  const ok = await ensureAudioUnlocked();
  if (!ok) return;

  // 嘗試恢復被暫停的 AudioContext
  if (audioCtx && audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch (e) {}
  }

  isAlarmPlaying = true;

  // 更新播放按鈕狀態
  updatePlayButton(true);

  let count = 0;
  const strikeIntervalMs = 11000; // 每聲間隔 11 秒

  // 記錄播放（UI 與 Debug）
  logBellPlay(trigger, times);
  try { if (window.appDebugLog) window.appDebugLog(`[Bell] ${trigger} play x${times}`); } catch (e) {}

  function playNext() {
    if (!isAlarmPlaying) return;

    if (count >= times) {
      updatePlayButton(false);
      isAlarmPlaying = false;
      return;
    }

    playSingleAlarm(count + 1, times);
    count++;

    if (count < times) {
      setTimeout(playNext, strikeIntervalMs);
    } else {
      setTimeout(() => {
        updatePlayButton(false);
        isAlarmPlaying = false;
        try { if (window.appDebugLog) window.appDebugLog('[Bell] sequence finished', 2); } catch (e) {}
      }, 1000); // 最後一聲後等待 1 秒
    }
  }

  playNext();
}

// 更新播放按鈕狀態
function updatePlayButton(playing) {
  const button = document.getElementById('play-button');
  const text = button ? button.querySelector('.play-text') : null;

  if (button && text) {
    if (playing) {
      button.classList.add('flash');
      text.innerHTML = window.t ? window.t('play_button.stop') : '點此停止鐘聲<br/>⏹️';
    } else {
      button.classList.remove('flash');
      text.innerHTML = window.t ? window.t('play_button.play') : '點此手動敲鐘<br />▶️';
    }
  }
}

// 記錄鐘聲播放
function logBellPlay(type, times) {
  const logDiv = document.getElementById('bell-log');
  if (!logDiv) return;

  const now = new Date();
  const nowStr = `[${now.toLocaleTimeString()}]`;
  const typeKey = (type === 'manual' || type === '手動') ? 'manual' : 'auto';
  const typeText = window.t ? window.t(`log.type.${typeKey}`) : typeKey;

  const entry = document.createElement('div');
  const playedText = window.t ? window.t('log.played') : 'Gong played';
  entry.textContent = `${nowStr} ${typeText} ${playedText} x${times}`;

  const entries = document.getElementById('bell-entries');
  if (entries) {
    // 新的放最上面
    entries.insertBefore(entry, entries.firstChild);
    // 保持滾動在頂端以顯示最新
    entries.scrollTop = 0;

    // 限制日誌條目數量（刪除最舊的在底部）
    while (entries.children.length > 50) {
      entries.removeChild(entries.lastChild);
    }
  }
}

// 初始化音頻模組
function initAudioModule() {
  // 綁定播放按鈕事件
  const playButton = document.getElementById('play-button');
  if (playButton) {
    playButton.addEventListener('click', async () => {
      if (isAlarmPlaying) {
        stopAllAlarms();
        updatePlayButton(false);
      } else {
        // 手動播放，默認敲鐘次數為 4（與舊版一致）
        await playBell(4, 'manual');
      }
    });
  }

  // 綁定用戶互動事件以解鎖音頻
  const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'click'];
  const unlockAudioOnce = () => {
    unlockAudio();
    unlockEvents.forEach(event => {
      document.removeEventListener(event, unlockAudioOnce);
    });
  };

  unlockEvents.forEach(event => {
    document.addEventListener(event, unlockAudioOnce, { once: true });
  });

  console.log('[Audio] Audio module initialized');
}

// 導出函數供全域使用
window.AudioModule = {
  initAudioModule,
  unlockAudio,
  ensureAudioUnlocked,
  playBell,
  stopAllAlarms,
  updatePlayButton,
  logBellPlay,

  // 狀態查詢
  get isPlaying() { return isAlarmPlaying; },
  get isUnlocked() { return audioUnlocked; }
};

// DOM 載入完成後自動初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAudioModule);
} else {
  initAudioModule();
}