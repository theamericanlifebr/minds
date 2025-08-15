let pastas = {};
let acertosModo7 = 0;
let currentPastaName = 'pastas';
let photoMap = {};
let presentMap = {};
let frasesCorretas = {};
let songAudio = null;
const homophonesMap = new Map();
const normalizeKey = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function carregarFrasesCorretas() {
  try {
    const resp = await fetch('data/frases_corretas.json');
    frasesCorretas = await resp.json();
  } catch (e) {
    frasesCorretas = {};
  }

  try {
    const resp = await fetch('data/homophones.json');
    const text = await resp.text();
    homophonesMap.clear();
    const norm = w => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '');
    text.split(/\n+/).forEach(l => {
      const parts = l.trim().toLowerCase().split('@').filter(Boolean);
      if (parts.length > 1) {
        const canonical = norm(parts[0]);
        parts.forEach(p => {
          const n = norm(p);
          if (n) homophonesMap.set(n, canonical);
        });
      }
    });
  } catch (e) {
    // ignore missing file
  }
}

function aplicarFrasesCorretas(texto) {
  let t = texto.toLowerCase();
  for (const [correta, variantes] of Object.entries(frasesCorretas)) {
    variantes.forEach(v => {
      const re = new RegExp(`\\b${v}\\b`, 'g');
      t = t.replace(re, correta);
    });
  }
  const norm = w => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '');
  const tokens = t.split(/\b/);
  for (let i = 0; i < tokens.length; i++) {
    const n = norm(tokens[i]);
    if (n && homophonesMap.has(n)) {
      tokens[i] = homophonesMap.get(n);
    }
  }
  return tokens.join('');
}

function parsePastas(raw) {
  const result = {};
  for (const [key, texto] of Object.entries(raw)) {
    result[key] = texto
      .trim()
      .split(/\n+/)
      .filter(Boolean)
      .map(l => {
        const parts = l.split('#').map(s => s.trim());
        return [parts[0], parts.slice(1).filter(Boolean)];
      });
  }
  return result;
}

async function carregarPastas(file = 'data/pastas.json') {
  const resp = await fetch(file);
  const text = await resp.text();
  const obj = {};
  const regex = /(\d+):\s*`([\s\S]*?)`/g;
  let m;
  while ((m = regex.exec(text))) {
    obj[m[1]] = m[2];
  }
  pastas = parsePastas(obj);
}

async function carregarFotos() {
  try {
    const resp = await fetch('/photos/list');
    const files = await resp.json();
    photoMap = {};
    files.forEach(f => {
      let name = f.split('#')[1] || f;
      name = name.replace(/\.[^.]+$/, '');
      photoMap[normalizeKey(name)] = f;
    });
  } catch (e) {
    photoMap = {};
  }
}

async function carregarPresentes() {
  try {
    const resp = await fetch('/presents/list');
    const files = await resp.json();
    presentMap = {};
    files.forEach(f => {
      const name = f.replace(/\.[^.]+$/, '');
      presentMap[normalizeKey(name)] = f;
    });
  } catch (e) {
    presentMap = {};
  }
}

function setupMode8() {
  const controls = document.getElementById('mode8-controls');
  const selector = document.getElementById('song-select');
  const presents = document.getElementById('mode8-presents');
  songAudio = document.getElementById('song-audio');
  if (controls) controls.style.display = 'flex';
  if (presents) presents.style.display = 'flex';
  if (!selector || !songAudio) return;
  fetch('/songs/list')
    .then(r => r.json())
    .then(files => {
      selector.innerHTML = '';
      files.forEach(f => {
        const opt = document.createElement('option');
        opt.value = `songs/${encodeURIComponent(f)}`;
        opt.textContent = f;
        selector.appendChild(opt);
      });
    });
  if (presents) {
    fetch('/presents/list')
      .then(r => r.json())
      .then(files => {
        presents.innerHTML = '';
        files.forEach(f => {
          const img = document.createElement('img');
          img.src = `presents/${encodeURIComponent(f)}`;
          img.alt = f.replace(/\.[^.]+$/, '');
          presents.appendChild(img);
        });
      });
  }
  selector.onchange = () => {
    if (!selector.value) return;
    songAudio.src = selector.value;
    songAudio.play();
  };
  songAudio.ontimeupdate = atualizarBarraProgresso;
  songAudio.onended = atualizarBarraProgresso;
  atualizarBarraProgresso();
}

function setupMode9() {
  songAudio = document.getElementById('song-audio');
  if (!songAudio) return;
  fetch('/songs/list')
    .then(r => r.json())
    .then(files => {
      if (!files.length) return;
      const playRandom = () => {
        const idx = Math.floor(Math.random() * files.length);
        songAudio.src = `songs/${encodeURIComponent(files[idx])}`;
        songAudio.play();
      };
      songAudio.onended = playRandom;
      playRandom();
    });
}

function seekSong(delta) {
  if (!songAudio) return;
  let t = songAudio.currentTime + delta;
  if (t < 0) t = 0;
  if (songAudio.duration && t > songAudio.duration) t = songAudio.duration;
  songAudio.currentTime = t;
  atualizarBarraProgresso();
}

function atualizarImagemModo(pt, en) {
  const icon = document.getElementById('mode-icon');
  if (!icon) return;
  if (selectedMode === 7) {
    const presentKey = normalizeKey(`${pt}#${en}`);
    if (presentMap[presentKey]) {
      icon.src = `presents/${presentMap[presentKey]}`;
      icon.style.opacity = '1';
      return;
    }
    const photoKey = normalizeKey(en);
    if (photoMap[photoKey]) {
      icon.src = `photos/${photoMap[photoKey]}`;
      icon.style.opacity = '1';
      return;
    }
  }
  icon.src = modeImages[selectedMode];
  icon.style.opacity = '0.5';
}

function ehQuaseCorreto(res, esp) {
  let i = 0, j = 0, dif = 0;
  while (i < res.length && j < esp.length) {
    if (res[i] === esp[j]) {
      i++; j++; continue;
    }
    if (i + 1 < res.length && res[i+1] === esp[j] && j + 1 < esp.length && res[i] === esp[j+1]) {
      return false; // ordem incorreta
    }
    if (i + 1 < res.length && res[i+1] === esp[j]) {
      i++; dif++; // letra extra
    } else if (j + 1 < esp.length && res[i] === esp[j+1]) {
      j++; dif++; // letra faltando
    } else {
      return false;
    }
    if (dif > 2) return false;
  }
  dif += (res.length - i) + (esp.length - j);
  return dif <= 2;
}

function ehQuaseCorretoPalavras(resp, esp) {
  resp = aplicarFrasesCorretas(resp);
  esp = aplicarFrasesCorretas(esp);
  const normWord = w => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const rWords = resp.split(/\s+/).map(normWord).filter(Boolean);
  const eWords = esp.split(/\s+/).map(normWord).filter(Boolean);
  if (rWords.length < eWords.length || rWords.length - eWords.length > 3) return false;
  const rCounts = {};
  rWords.forEach(w => { rCounts[w] = (rCounts[w] || 0) + 1; });
  for (const w of eWords) {
    if (!rCounts[w]) return false;
    rCounts[w]--;
  }
  return true;
}

function modo1Correto(resp, esp) {
  const norm = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
  const r = norm(resp);
  const e = norm(esp);
  if (r === e) return true;
  if (r.length === e.length) {
    let diff = 0;
    for (let i = 0; i < e.length; i++) {
      if (r[i] !== e[i]) {
        if (r[i] === 's' || r[i] === 'd' || e[i] === 's' || e[i] === 'd') return false;
        if (++diff > 1) return false;
      }
    }
    return diff === 1;
  }
  if (r.length === e.length + 1) {
    let i = 0, j = 0;
    while (i < r.length && j < e.length && r[i] === e[j]) { i++; j++; }
    if (r[i] === 's' || r[i] === 'd') return false;
    i++;
    while (i < r.length && j < e.length) {
      if (r[i++] !== e[j++]) return false;
    }
    return true;
  }
  return false;
}


const isMobile = /Mobi|Android/i.test(navigator.userAgent);
let allowInput = true;
let pausedBySilence = false;
const secretSequence = [4, 5, 4, 4, 4];
let inputSequence = [];
let dropdownUnlocked = false;


let frasesArr = [], fraseIndex = 0;
let levelFrases = [];
let levelLoaded = 0;
let acertosTotais = parseInt(localStorage.getItem('acertosTotais') || '0', 10);
let errosTotais = parseInt(localStorage.getItem('errosTotais') || '0', 10);
let tentativasTotais = parseInt(localStorage.getItem('tentativasTotais') || '0', 10);
let pastaAtual = 1;
let bloqueado = false;
let mostrarTexto = 'pt';
let voz = 'en';
let esperadoLang = 'pt';
let timerInterval = null;
let inputTimeout = null;
const TOTAL_FRASES = 12;
let selectedMode = 1;
// Removed difficulty selection; game always starts on easy mode
const INITIAL_POINTS = 0;
const COMPLETION_THRESHOLD = 25115;
const MODE6_THRESHOLD = 25115;
const timeScoreBases = {
  2: {6: [2.55, 5.78], 33: [4.63, 8.03]},
  3: {6: [2.55, 5.78], 33: [4.63, 8.03]},
  4: {6: [2.03, 5.50], 33: [3.78, 7.06]},
  5: {6: [3.09, 5.80], 33: [4.79, 8.03]},
  6: {6: [2.36, 5.78], 33: [3.84, 8.03]}
};

const TIME_POINT_REFS = {
  1: 125,
  2: 95,
  3: 95,
  4: 100,
  5: 100,
  6: 95
};

const SPEED_SCALE = 70 / 81.72;

function getTimeMetrics(len, mode) {
  const base = timeScoreBases[mode];
  if (!base) return { perfect: 0, worst: 0 };
  const [p6, w6] = base[6];
  const [p33, w33] = base[33];
  const clampedLen = Math.max(1, len);
  const ratio = (clampedLen - 6) / (33 - 6);
  const perfect = p6 + (p33 - p6) * ratio;
  const worst = w6 + (w33 - w6) * ratio;
  return { perfect, worst };
}
let completedModes = JSON.parse(localStorage.getItem('completedModes') || '{}');
let unlockedModes = JSON.parse(localStorage.getItem('unlockedModes') || '{}');
for (let m = 7; m <= 12; m++) {
  if (unlockedModes[m] === undefined) unlockedModes[m] = true;
}
let modeIntroShown = JSON.parse(localStorage.getItem('modeIntroShown') || '{}');
let points = parseInt(localStorage.getItem('points') || INITIAL_POINTS, 10);
let premioBase = parseInt(localStorage.getItem("premioBase"), 10) || 1000;
let premioDec = 0;
let penaltyFactor = 0;
let prizeStart = 0;
let prizeTimer = null;
let awaitingNextLevel = false;
let nextLevelCallback = null;
let awaitingRetry = false;
let retryCallback = null;
let tryAgainColorInterval = null;
let levelUpReady = false;
let tutorialInProgress = false;
let tutorialDone = localStorage.getItem('tutorialDone') === 'true';
let ilifeDone = localStorage.getItem('ilifeDone') === 'true';
let ilifeActive = false;
let sessionStart = null;
const legacyStats = JSON.parse(localStorage.getItem('mode1Stats') || 'null');
let modeStats = JSON.parse(localStorage.getItem('modeStats') || '{}');
if (legacyStats && !modeStats[1]) {
  modeStats[1] = legacyStats;
  localStorage.removeItem('mode1Stats');
  localStorage.setItem('modeStats', JSON.stringify(modeStats));
}
let modeStartTimes = {};
let paused = false;
let consecutiveErrors = 0;
let pauseInterval = null;
let downPlaying = false;
let downTimeout = null;

const colorModes = ['light', 'dark', 'gradient'];
let colorModeIndex = parseInt(localStorage.getItem('colorMode') || '1', 10);

function updateGradientColor(color) {
  if (document.body.classList.contains('gradient-mode')) {
    document.body.style.setProperty('--grad-color', color);
  }
}

function applyColorMode() {
  document.body.classList.remove('dark-mode', 'gradient-mode');
  const mode = colorModes[colorModeIndex];
  if (mode === 'dark') {
    document.body.classList.add('dark-mode');
    document.body.style.removeProperty('--grad-color');
  } else if (mode === 'gradient') {
    document.body.classList.add('dark-mode', 'gradient-mode');
    updateGradientColor(calcularCor(points));
  } else {
    document.body.style.removeProperty('--grad-color');
  }
  localStorage.setItem('colorMode', colorModeIndex);
}

function toggleDarkMode() {
  colorModeIndex = (colorModeIndex + 1) % colorModes.length;
  applyColorMode();
}

applyColorMode();

const themes = ['versus-blue', 'versus-white', 'versus-black'];
let themeIndex = parseInt(localStorage.getItem('themeIndex'), 10);
if (isNaN(themeIndex) || themeIndex < 0 || themeIndex >= themes.length) {
  themeIndex = themes.findIndex(t => document.body.classList.contains(t));
  if (themeIndex < 0) themeIndex = 0;
}
document.body.classList.remove(...themes);
document.body.classList.add(themes[themeIndex]);

function toggleTheme() {
  const body = document.body;
  body.classList.remove(...themes);
  themeIndex = (themeIndex + 1) % themes.length;
  body.classList.add(themes[themeIndex]);
  localStorage.setItem('themeIndex', themeIndex);
}

const phraseDisplay = document.getElementById('texto-exibicao');
if (phraseDisplay) {
  phraseDisplay.addEventListener('click', togglePt);
}
const modeIconRepeat = document.getElementById('mode-icon');
if (modeIconRepeat) {
  modeIconRepeat.addEventListener('click', () => {
    if (!frasesArr[fraseIndex]) return;
    const [, ensRaw] = frasesArr[fraseIndex];
    const ens = Array.isArray(ensRaw) ? ensRaw[0] : String(ensRaw).split('#')[0].trim();
    falar(ens, 'en');
  });
}

const modeImages = {
  1: 'selos%20modos%20de%20jogo/modo1.png',
  2: 'selos%20modos%20de%20jogo/modo2.png',
  3: 'selos%20modos%20de%20jogo/modo3.png',
  4: 'selos%20modos%20de%20jogo/modo4.png',
  5: 'selos%20modos%20de%20jogo/modo5.png',
  6: 'selos%20modos%20de%20jogo/modo6.png',
  7: 'selos%20modos%20de%20jogo/modo7.png',
  8: 'selos%20modos%20de%20jogo/modo8.png',
  9: 'selos%20modos%20de%20jogo/modo9.png',
  10: 'selos%20modos%20de%20jogo/modo10.png',
  11: 'selos%20modos%20de%20jogo/modo11.png',
  12: 'selos%20modos%20de%20jogo/modo12.png'
};

const modeTransitions = {
  1: { duration: 7500, img: modeImages[2], audio: 'somModo2Intro' },
  2: { duration: 7500, img: modeImages[3], audio: 'somModo3Intro' },
  3: { duration: 8250, img: modeImages[4], audio: 'somModo4Intro' },
  4: { duration: 6500, img: modeImages[5], audio: 'somModo5Intro' },
  5: { duration: 6000, img: modeImages[6], audio: 'somModo6Intro' }
};

const modeIntros = {
  2: { duration: 7500, img: modeImages[2], audio: 'somModo2Intro' },
  3: { duration: 7500, img: modeImages[3], audio: 'somModo3Intro' },
  4: { duration: 8250, img: modeImages[4], audio: 'somModo4Intro' },
  5: { duration: 6500, img: modeImages[5], audio: 'somModo5Intro' },
  6: { duration: 6000, img: modeImages[6], audio: 'somModo6Intro' }
};

function ensureModeStats(mode) {
  if (!modeStats[mode]) {
    modeStats[mode] = {
      totalPhrases: 0,
      totalTime: 0,
      timePoints: 0,
      correct: 0,
      wrong: 0,
      wrongRanking: []
    };
  } else {
    if (!Array.isArray(modeStats[mode].wrongRanking)) modeStats[mode].wrongRanking = [];
    if (typeof modeStats[mode].timePoints !== 'number') modeStats[mode].timePoints = 0;
  }
  return modeStats[mode];
}

function saveModeStats() {
  localStorage.setItem('modeStats', JSON.stringify(modeStats));
  if (typeof currentUser === 'object' && currentUser) {
    currentUser.stats = modeStats;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }
  if (typeof saveUserPerformance === 'function') {
    saveUserPerformance(modeStats);
  }
}

function saveTotals() {
  localStorage.setItem('acertosTotais', acertosTotais);
  localStorage.setItem('errosTotais', errosTotais);
  localStorage.setItem('tentativasTotais', tentativasTotais);
  localStorage.setItem('points', points);
  if (!paused && points >= 25115) {
    pauseGame();
  }
}

saveTotals();

function recordModeTime(mode) {
  if (modeStartTimes[mode]) {
    const stats = ensureModeStats(mode);
    stats.totalTime += Date.now() - modeStartTimes[mode];
    modeStartTimes[mode] = null;
    saveModeStats();
  }
}

function stopCurrentGame() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (prizeTimer) {
    clearInterval(prizeTimer);
    prizeTimer = null;
  }
  if (songAudio) {
    songAudio.pause();
  }
}

function pauseGame(noPenalty = true) {
  if (pauseInterval) {
    clearInterval(pauseInterval);
    pauseInterval = null;
  }
  if (paused && noPenalty) return;
  paused = true;
  stopCurrentGame();
  bloqueado = true;
  const texto = document.getElementById('texto-exibicao');
  if (texto) {
    texto.style.transition = 'opacity 500ms linear';
    texto.style.opacity = '0';
  }
  const input = document.getElementById('pt');
  if (input) input.disabled = true;
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  if (pauseInterval) {
    clearInterval(pauseInterval);
    pauseInterval = null;
  }
  if (points >= 25115) {
    pauseGame();
    return;
  }
  const texto = document.getElementById('texto-exibicao');
  if (texto) {
    texto.style.transition = 'opacity 500ms linear';
    texto.style.opacity = '1';
  }
  const input = document.getElementById('pt');
  if (input) {
    input.disabled = false;
    input.value = '';
  }
  bloqueado = false;
  if (pausedBySilence) {
    mostrarFrase();
    pausedBySilence = false;
  } else {
    mostrarFrase();
  }
}

function triggerDownPlay() {
  if (downPlaying) return;
  downPlaying = true;
  if (pauseInterval) {
    clearInterval(pauseInterval);
    pauseInterval = null;
  }
  stopCurrentGame();
  paused = true;
  bloqueado = true;
  const input = document.getElementById('pt');
  if (input) input.disabled = true;
  const texto = document.getElementById('texto-exibicao');
  if (texto) {
    texto.style.transition = 'opacity 2000ms linear';
    texto.style.opacity = '0';
  }
  const audio = new Audio('gamesounds/down.wav');
  audio.play();
  downTimeout = setTimeout(() => {
    document.getElementById('menu').style.display = 'flex';
    const visor = document.getElementById('visor');
    if (visor) visor.style.display = 'none';
    downPlaying = false;
  }, 4000);
}


function updateLevelIcon() {
  const icon = document.getElementById('nivel-indicador');
  if (icon) {
    icon.style.transition = 'opacity 500ms linear';
    icon.style.opacity = '0';
    setTimeout(() => {
      icon.src = `selos_niveis/level%20${pastaAtual}.png`;
      icon.style.opacity = '1';
    }, 500);
  }
  const levelText = document.getElementById('menu-level');
  if (levelText) levelText.textContent = `Nivel ${pastaAtual}`;
  localStorage.setItem('pastaAtual', pastaAtual);
}

function unlockMode(mode, duration = 1000) {
  unlockedModes[mode] = true;
  localStorage.setItem('unlockedModes', JSON.stringify(unlockedModes));
  document.querySelectorAll(`#menu-modes img[data-mode="${mode}"], #mode-buttons img[data-mode="${mode}"]`).forEach(img => {
    img.style.transition = `opacity ${duration}ms linear`;
    img.style.opacity = '1';
  });
}

function updateModeIcons() {
  document.querySelectorAll('#mode-buttons img, #menu-modes img').forEach(img => {
    const mode = parseInt(img.dataset.mode, 10);
    if (unlockedModes[mode]) {
      img.style.opacity = '1';
    } else {
      img.style.opacity = '0.3';
    }
  });
  checkForMenuLevelUp();
}

function getHighestUnlockedMode() {
  const modes = Object.keys(unlockedModes).filter(m => unlockedModes[m]).map(Number);
  return modes.length ? Math.max(...modes) : 1;
}

function checkForMenuLevelUp() {
  // Level advancement is triggered only after finishing mode 6
}

let modePage = 1;
function setModePage(page) {
  modePage = page;
  const g1 = document.getElementById('mode-group-1');
  const g2 = document.getElementById('mode-group-2');
  const b1 = document.getElementById('mode-buttons-1');
  const b2 = document.getElementById('mode-buttons-2');
  if (g1 && g2) {
    g1.style.display = page === 1 ? 'grid' : 'none';
    g2.style.display = page === 2 ? 'grid' : 'none';
  }
  if (b1 && b2) {
    b1.style.display = page === 1 ? 'flex' : 'none';
    b2.style.display = page === 2 ? 'flex' : 'none';
  }
}

function performMenuLevelUp() {
  const icons = document.querySelectorAll('#menu-modes img, #mode-buttons img');
  icons.forEach(img => {
    const modo = parseInt(img.dataset.mode, 10);
    img.style.transition = 'opacity 500ms linear';
    img.style.opacity = modo === 1 ? '1' : '0.3';
  });
  setTimeout(() => {
    pastaAtual++;
    completedModes = {};
    unlockedModes = { 1: true };
    localStorage.setItem('completedModes', JSON.stringify(completedModes));
    localStorage.setItem('unlockedModes', JSON.stringify(unlockedModes));
    document.querySelectorAll('#menu-modes img[data-mode="6"], #mode-buttons img[data-mode="6"]').forEach(img => {
      img.src = modeImages[6];
    });
    updateLevelIcon();
    updateModeIcons();
    atualizarBarraProgresso();
    levelUpReady = false;
  }, 500);
}

function enforceStarClick() {
  const all = document.querySelectorAll('#menu-modes img, #mode-buttons img, #top-nav a');
  all.forEach(el => { el.style.pointerEvents = 'none'; });
  const stars = document.querySelectorAll('#menu-modes img[data-mode="6"], #mode-buttons img[data-mode="6"]');
  stars.forEach(st => { st.style.pointerEvents = 'auto'; });
  let timeout = setTimeout(() => {
    if (stars[0]) stars[0].click();
  }, 5000);
  stars.forEach(st => {
    st.addEventListener('click', () => {
      clearTimeout(timeout);
      all.forEach(el => { el.style.pointerEvents = ''; });
      startStatsSequence();
    }, { once: true });
  });
}

function startStatsSequence() {
  const audio = new Audio('gamesounds/nivel2.mp3');
  audio.addEventListener('ended', () => {
    localStorage.setItem('statsSequence', 'true');
    window.location.href = 'stats.html';
  });
  audio.play();
}

function menuLevelUpSequence() {
  goHome();
  const menu = document.getElementById('menu');
  const icons = menu.querySelectorAll('#menu-modes img');
  icons.forEach(img => {
    img.style.transition = 'opacity 1ms linear';
    img.style.opacity = '0.3';
  });
  const audio = document.getElementById('somNivelDesbloqueado');
  if (audio) { audio.currentTime = 0; audio.play(); }

  const msg = document.createElement('div');
  msg.id = 'next-level-msg';
  msg.textContent = 'diga next level para avançar';
  msg.style.display = 'none';
  menu.appendChild(msg);

  let idx = 0;
  const interval = setInterval(() => {
    if (idx < icons.length) {
      icons[idx].style.opacity = '1';
      idx++;
    } else {
      clearInterval(interval);
      msg.style.display = 'block';
      setTimeout(() => { msg.style.opacity = '1'; }, 10);
      awaitingNextLevel = true;
      nextLevelCallback = () => {
        msg.remove();
        performMenuLevelUp();
      };
    }
  }, 500);
}

let transitioning = false;

const levelUpTransition = {
  duration: 4000,
  img: 'https://cdn.dribbble.com/userupload/41814123/file/original-fb8a772ba8676fd28c528fd1259cabcb.gif'
};

const colorStops = [
  [0, '#ff0000'],
  [2000, '#ff3b00'],
  [4000, '#ff7f00'],
  [6000, '#ffb300'],
  [8000, '#ffe000'],
  [10000, '#ffff66'],
  [12000, '#ccff66'],
  [14000, '#99ff99'],
  [16000, '#00cc66'],
  [18000, '#00994d'],
  [20000, '#00ffff'],
  [22000, '#66ccff'],
  [24000, '#0099ff'],
  [25115, '#0099ff']
];

function hexToRgb(hex) {
  const int = parseInt(hex.slice(1), 16);
  return [int >> 16 & 255, int >> 8 & 255, int & 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function calcularCor(pontos) {
  const max = colorStops[colorStops.length - 1][0];
  const p = Math.max(0, Math.min(pontos, max));
  for (let i = 0; i < colorStops.length - 1; i++) {
    const [p1, c1] = colorStops[i];
    const [p2, c2] = colorStops[i + 1];
    if (p >= p1 && p <= p2) {
      const ratio = (p - p1) / (p2 - p1);
      const [r1, g1, b1] = hexToRgb(c1);
      const [r2, g2, b2] = hexToRgb(c2);
      const r = Math.round(r1 + ratio * (r2 - r1));
      const g = Math.round(g1 + ratio * (g2 - g1));
      const b = Math.round(b1 + ratio * (b2 - b1));
      return rgbToHex(r, g, b);
    }
  }
  return colorStops[colorStops.length - 1][1];
}


function calcModeStats(mode) {
  const stats = modeStats[mode] || {};
  const total = stats.totalPhrases || 0;
  const correct = stats.correct || 0;
  const totalTime = stats.totalTime || 0;
  const timePts = stats.timePoints || 0;
  const accPerc = total ? (correct / total * 100) : 0;
  const avg = total ? (totalTime / total / 1000) : 0;
  const ref = TIME_POINT_REFS[mode] || 100;
  let timePerc = total ? ((timePts / total) / ref) * 100 : 0;
  timePerc *= SPEED_SCALE;
  return { accPerc, timePerc, avg };
}


let introProgressInterval = null;

function startIntroProgress(duration) {
  const filled = document.getElementById('intro-progress-filled');
  if (!filled) return;
  if (introProgressInterval) clearInterval(introProgressInterval);
  filled.style.transition = 'none';
  filled.style.width = '0%';
  filled.style.backgroundColor = calcularCor(0);
  const start = Date.now();
  introProgressInterval = setInterval(() => {
    const ratio = Math.min((Date.now() - start) / duration, 1);
    const limite = selectedMode === 6 ? MODE6_THRESHOLD : COMPLETION_THRESHOLD;
    const pontos = ratio * limite;
    filled.style.width = (ratio * 100) + '%';
    filled.style.backgroundColor = calcularCor(pontos);
    if (ratio >= 1) clearInterval(introProgressInterval);
  }, 50);
}

function resetIntroProgress() {
  const filled = document.getElementById('intro-progress-filled');
  if (!filled) return;
  if (introProgressInterval) clearInterval(introProgressInterval);
  filled.style.transition = 'none';
  filled.style.width = '0%';
  filled.style.backgroundColor = calcularCor(0);
}

function startTryAgainAnimation() {
  const msg = document.getElementById('nivel-mensagem');
  if (!msg) return;
  if (tryAgainColorInterval) clearInterval(tryAgainColorInterval);
  const duration = 30000;
  const maxPoints = selectedMode === 6 ? MODE6_THRESHOLD : COMPLETION_THRESHOLD;
  const begin = Date.now();
  tryAgainColorInterval = setInterval(() => {
    const elapsed = (Date.now() - begin) % duration;
    const pts = (elapsed / duration) * maxPoints;
    msg.style.color = calcularCor(pts);
  }, 50);
}

function stopTryAgainAnimation() {
  if (tryAgainColorInterval) clearInterval(tryAgainColorInterval);
  tryAgainColorInterval = null;
}

async function startGame(modo) {
  const prevMode = selectedMode;
  if (prevMode !== modo) {
    recordModeTime(prevMode);
  }
  selectedMode = modo;
  let pastasFile = 'data/pastas.json';
  currentPastaName = 'pastas';
  if (modo === 7) {
    pastasFile = 'data/planting.json';
    currentPastaName = 'planting';
    acertosModo7 = 0;
  } else if (modo === 9) {
    pastasFile = 'data/mindset.json';
    currentPastaName = 'mindset';
  }
  await carregarPastas(pastasFile);
  points = INITIAL_POINTS;
  saveTotals();
  atualizarBarraProgresso();
  updateModeIcons();
  document.getElementById('menu').style.display = 'none';
  document.getElementById('visor').style.display = 'none';
  const icon = document.getElementById('mode-icon');
  if (icon) icon.style.display = 'none';
  beginGame();
}

function showMode1Intro(callback) {
  const overlay = document.getElementById('intro-overlay');
  const audio = document.getElementById('somModo1Intro');
  const img = document.getElementById('intro-image');
  atualizarBarraProgresso();
  img.style.animation = 'none';
  img.style.transition = 'none';
  img.style.opacity = '1';
  img.style.transform = 'scale(0.8)';
  void img.offsetWidth;
  img.style.transition = 'transform 10000ms linear';
  overlay.style.display = 'flex';
  startIntroProgress(10000);
  audio.currentTime = 0;
  audio.play();
  img.style.transform = 'scale(1)';
  setTimeout(() => {
    img.style.transition = 'opacity 2000ms linear';
    img.style.opacity = '0';
  }, 8000);
  setTimeout(() => {
    overlay.style.display = 'none';
    img.style.transition = 'none';
    img.style.opacity = '1';
    img.style.transform = 'scale(1)';
    resetIntroProgress();
    callback();
  }, 10000);
}

function showModeIntro(info, callback) {
  const overlay = document.getElementById('intro-overlay');
  const img = document.getElementById('intro-image');
  const audio = document.getElementById(info.audio);
  atualizarBarraProgresso();
  img.src = info.img;
  img.style.animation = 'none';
  img.style.transition = 'none';
  img.style.opacity = '1';
  img.style.transform = 'scale(0.8)';
  void img.offsetWidth;
  img.style.transition = `transform ${info.duration}ms linear`;
  overlay.style.display = 'flex';
  startIntroProgress(info.duration);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
  img.style.transform = 'scale(1)';
  setTimeout(() => {
    img.style.transition = 'opacity 2000ms linear';
    img.style.opacity = '0';
  }, info.duration - 2000);
  setTimeout(() => {
    overlay.style.display = 'none';
    img.style.transition = 'none';
    img.style.opacity = '1';
    img.style.transform = 'scale(1)';
    resetIntroProgress();
    callback();
  }, info.duration);
}

function showModeTransition(info, callback) {
  const overlay = document.getElementById('intro-overlay');
  const img = document.getElementById('intro-image');
  const audio = document.getElementById(info.audio);
  atualizarBarraProgresso();
  img.src = info.img;
  img.style.animation = 'none';
  img.style.transition = 'none';
  img.style.opacity = '1';
  img.style.transform = 'scale(0.8)';
  void img.offsetWidth;
  img.style.transition = `transform ${info.duration}ms linear`;
  overlay.style.display = 'flex';
  startIntroProgress(info.duration);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
  img.style.transform = 'scale(1)';
  setTimeout(() => {
    img.style.transition = 'opacity 2000ms linear';
    img.style.opacity = '0';
  }, info.duration - 2000);
  setTimeout(() => {
    overlay.style.display = 'none';
    img.style.transition = 'none';
    img.style.opacity = '1';
    img.style.transform = 'scale(1)';
    resetIntroProgress();
    callback();
  }, info.duration);
}

function showLevelUp(callback) {
  const overlay = document.getElementById('intro-overlay');
  const img = document.getElementById('intro-image');
  const audio = document.getElementById(levelUpTransition.audio);
  atualizarBarraProgresso();
  img.src = levelUpTransition.img;
  img.style.animation = 'none';
  img.style.width = '397px';
  img.style.height = '304px';
  overlay.style.display = 'flex';
  startIntroProgress(levelUpTransition.duration);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
  awaitingNextLevel = true;
  nextLevelCallback = () => {
    overlay.style.display = 'none';
    resetIntroProgress();
    img.style.width = '250px';
    img.style.height = '250px';
    callback();
  };
}

function beginGame() {
  sessionStart = Date.now();
  modeStartTimes[selectedMode] = Date.now();
  consecutiveErrors = 0;
  paused = false;
  const start = () => {
    document.getElementById('visor').style.display = 'flex';
    const icon = document.getElementById('mode-icon');
    if (icon) {
      icon.src = modeImages[selectedMode];
      icon.style.opacity = '0.5';
      icon.style.display = 'block';
      icon.onclick = () => { if (paused) resumeGame(); };
    }
    const texto = document.getElementById('texto-exibicao');
    if (texto) texto.style.opacity = '1';
    updateLevelIcon();
    updateModeIcons();
    const m8 = document.getElementById('mode8-controls');
    if (m8) m8.style.display = selectedMode === 8 ? 'flex' : 'none';
    const m8p = document.getElementById('mode8-presents');
    if (m8p) m8p.style.display = selectedMode === 8 ? 'flex' : 'none';
    switch (selectedMode) {
      case 1:
        mostrarTexto = 'en';
        voz = 'en';
        esperadoLang = 'en';
        break;
    case 2:
      mostrarTexto = 'pt';
      voz = 'en';
      esperadoLang = 'en';
      break;
    case 3:
      mostrarTexto = 'none';
      voz = 'en';
      esperadoLang = 'en';
      break;
    case 4:
      mostrarTexto = 'en';
      voz = null;
      esperadoLang = 'en';
      break;
    case 5:
      mostrarTexto = 'pt';
      voz = null;
      esperadoLang = 'en';
      break;
    case 6:
      mostrarTexto = 'pt';
      voz = null;
      esperadoLang = 'en';
      break;
    case 7:
      mostrarTexto = 'pt';
      voz = null;
      esperadoLang = 'en';
      break;
      case 8:
        mostrarTexto = 'none';
        voz = null;
        esperadoLang = 'en';
        break;
      case 9:
        mostrarTexto = 'pt';
        voz = null;
        esperadoLang = 'en';
        break;
    }
    if (selectedMode === 8) {
      setupMode8();
      return;
    }
    if (selectedMode === 9) {
      setupMode9();
    }
    
    carregarFrases();
  };

  start();
}

function falar(texto, lang) {
  const utter = new SpeechSynthesisUtterance(texto);
  utter.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
  speechSynthesis.cancel();
  allowInput = false;
  utter.onend = () => { allowInput = true; };
  speechSynthesis.speak(utter);
}

function togglePt() {
  mostrarTexto = mostrarTexto === 'pt' ? 'en' : 'pt';
  mostrarFrase();
}

function toggleEn() {
  voz = voz ? null : 'en';
  mostrarFrase();
}

function showShortModeIntro(modo, callback) {
  const overlay = document.getElementById('intro-overlay');
  const img = document.getElementById('intro-image');
  const audio = document.getElementById('somWoosh');
  img.src = modeImages[modo];
  img.style.animation = 'none';
  img.style.transition = 'none';
  img.style.opacity = '1';
  img.style.width = '200px';
  img.style.height = '200px';
  void img.offsetWidth;
  img.style.transition = 'width 3000ms linear, height 3000ms linear';
  overlay.style.display = 'flex';
  if (audio) { audio.currentTime = 0; audio.play(); }
  img.style.width = '350px';
  img.style.height = '350px';
  setTimeout(() => {
    overlay.style.display = 'none';
    img.style.transition = 'none';
    img.style.width = '';
    img.style.height = '';
    callback();
  }, 3000);
}

function falarFrase() {
  if (frasesArr[fraseIndex]) {
    const [, ens] = frasesArr[fraseIndex];
    const en = ens[Math.floor(Math.random() * ens.length)];
    falar(en, 'en');
  }
}

function falarPt() {
  if (frasesArr[fraseIndex]) {
    const [pt] = frasesArr[fraseIndex];
    falar(pt, 'pt');
  }
}

function embaralhar(array) {
  return array.sort(() => Math.random() - 0.5);
}

function carregarFrases() {
  if (selectedMode === 7) {
    const principais = pastas[pastaAtual] || [];
    frasesArr = embaralhar(principais).slice(0, TOTAL_FRASES);
    fraseIndex = 0;
    setTimeout(() => mostrarFrase(), 300);
    atualizarBarraProgresso();
    return;
  }
  if (levelLoaded !== pastaAtual || levelFrases.length === 0) {
    const principais = pastas[pastaAtual] || [];
    levelFrases = embaralhar(principais).slice(0, TOTAL_FRASES);
    levelLoaded = pastaAtual;
  }
  frasesArr = [...levelFrases];
  fraseIndex = 0;
  setTimeout(() => mostrarFrase(), 300);
  atualizarBarraProgresso();
}

function mostrarFrase() {
  if (inputTimeout) clearTimeout(inputTimeout);
  if (fraseIndex >= frasesArr.length) fraseIndex = 0;
  const [pt, ens] = frasesArr[fraseIndex];
  const en = ens[0];
  atualizarImagemModo(pt, en);
  const texto = document.getElementById("texto-exibicao");
  if (mostrarTexto === 'pt') texto.textContent = pt;
  else if (mostrarTexto === 'en') texto.textContent = en;
  else texto.textContent = '';
  document.getElementById("pt").value = '';
  document.getElementById("pt").disabled = false;
  if (voz === 'en') falar(en, 'en');
  else if (voz === 'pt') falar(pt, 'pt');
  bloqueado = false;
  if (timerInterval) clearInterval(timerInterval);
  const timerEl = document.getElementById('timer');
  const start = Date.now();
  timerEl.textContent = 'Tempo: 0s';
  timerInterval = setInterval(() => {
    const secs = Math.floor((Date.now() - start) / 1000);
    timerEl.textContent = `Tempo: ${secs}s`;
  }, 1000);
  if (prizeTimer) clearInterval(prizeTimer);
  prizeStart = Date.now();
  prizeTimer = setInterval(atualizarBarraProgresso, 50);
  atualizarBarraProgresso();
  if (selectedMode >= 2) {
    inputTimeout = setTimeout(handleNoInput, 6000);
  }
}

function flashSuccess(callback) {
  const texto = document.getElementById('texto-exibicao');
  const color = calcularCor(points);
  texto.style.transition = 'color 500ms linear';
  texto.style.color = color;
  setTimeout(() => {
    texto.style.transition = 'color 500ms linear';
    texto.style.color = '';
    setTimeout(() => {
      document.getElementById('resultado').textContent = '';
      callback();
    }, 500);
  }, 500);
}

function flashError(expected, callback) {
  const texto = document.getElementById('texto-exibicao');
  const previous = texto.textContent;
  texto.textContent = expected;
  texto.style.transition = 'color 500ms linear';
  texto.style.color = 'red';
  setTimeout(() => {
    texto.style.transition = 'color 500ms linear';
    texto.style.color = '';
    setTimeout(() => {
      texto.textContent = previous;
      document.getElementById('resultado').textContent = '';
      callback();
    }, 500);
  }, 1500);
}

function handleNoInput() {
  if (bloqueado || selectedMode === 1) return;
  const input = document.getElementById('pt');
  input.value = '[no input]';
  verificarResposta();
}

function verificarResposta() {
  if (bloqueado) return;
  if (inputTimeout) clearTimeout(inputTimeout);
  if (timerInterval) clearInterval(timerInterval);
  const input = document.getElementById("pt");
  const resposta = input.value.trim();
  const resultado = document.getElementById("resultado");
  tentativasTotais++;
  saveTotals();
  const elapsed = Date.now() - prizeStart;
  const premioAtual = premioBase;
  const penalty = 0;

  const stats = ensureModeStats(selectedMode);

  const [pt, ensRaw] = frasesArr[fraseIndex];
  const ens = Array.isArray(ensRaw)
    ? ensRaw
    : String(ensRaw).split('#').map(s => s.trim()).filter(Boolean);

  const norm = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const esperados = esperadoLang === 'pt' ? [pt] : ens;
  let esperado = esperados[0];
  let esperadoCorrigido = aplicarFrasesCorretas(esperado);
  let normalizadoEsp = norm(esperadoCorrigido);
  const respostaCorrigida = aplicarFrasesCorretas(resposta);
  let normalizadoResp = norm(respostaCorrigida);
  if (normalizadoResp === 'justicanaterra') {
    normalizadoResp = normalizadoEsp;
  }
  let correto = false;
  for (const esp of esperados) {
    const espCorr = aplicarFrasesCorretas(esp);
    const normEsp = norm(espCorr);
    let match;
    if (selectedMode === 1) {
      match = modo1Correto(respostaCorrigida, espCorr);
    } else {
      match =
        normalizadoResp === normEsp ||
        ehQuaseCorreto(normalizadoResp, normEsp) ||
        ehQuaseCorretoPalavras(respostaCorrigida, espCorr);
    }
    if (match) {
      correto = true;
      esperado = esp;
      esperadoCorrigido = espCorr;
      normalizadoEsp = normEsp;
      break;
    }
  }
  const expectedPhrase = esperado;

  const phraseLen = expectedPhrase.replace(/\s+/g, '').length;
  let timePoints = 0;
  if (selectedMode >= 2) {
    const { perfect, worst } = getTimeMetrics(phraseLen, selectedMode);
    const elapsedSec = elapsed / 1000;
    const ref = TIME_POINT_REFS[selectedMode] || 100;
    timePoints = ((worst - elapsedSec) / (worst - perfect)) * ref;
    if (timePoints < 0) timePoints = 0;
  }

  if (correto) {
    stats.totalPhrases++;
    stats.correct++;
    stats.timePoints += timePoints;
    saveModeStats();
    document.getElementById("somAcerto").play();
    acertosTotais++;
    points += 1000;
    saveTotals();
    consecutiveErrors = 0;
    resultado.textContent = '';
    if (selectedMode !== 7) {
      frasesArr.splice(fraseIndex, 1);
    }
    flashSuccess(() => {
      if (selectedMode === 7) {
        acertosModo7++;
        if (acertosModo7 >= 10) {
          acertosModo7 = 0;
          if (pastas[pastaAtual + 1]) {
            pastaAtual++;
            updateLevelIcon();
          }
          carregarFrases();
        } else {
          fraseIndex++;
          mostrarFrase();
        }
        atualizarBarraProgresso();
      } else {
        if (frasesArr.length === 0) {
          finishMode();
        } else {
          if (fraseIndex >= frasesArr.length) fraseIndex = 0;
          mostrarFrase();
        }
      }
    });
  } else {
    stats.totalPhrases++;
    stats.wrong++;
    stats.timePoints += timePoints;
    const wr = stats.wrongRanking;
    const existing = wr.find(e => e.expected === expectedPhrase && e.input === resposta && e.folder === pastaAtual);
    if (existing) existing.count++;
    else wr.push({ expected: expectedPhrase, input: resposta, folder: pastaAtual, count: 1 });
    saveModeStats();
    document.getElementById("somErro").play();
    errosTotais++;
    saveTotals();
    resultado.textContent = "";
    resultado.style.color = "red";
    input.value = '';
    input.disabled = true;
    bloqueado = true;
    falar(esperado, esperadoLang);
    stopCurrentGame();
    consecutiveErrors++;
    if (selectedMode !== 7) {
      const cur = frasesArr[fraseIndex];
      frasesArr.push(cur);
      frasesArr.splice(fraseIndex, 1);
    }
    flashError(esperado, () => {
      input.disabled = false;
      bloqueado = false;
      if (selectedMode === 7) {
        atualizarBarraProgresso();
        fraseIndex++;
      }
      mostrarFrase();
    });
    if (selectedMode === 7) {
      acertosModo7 = 0;
    }
  }
  if (selectedMode !== 7) atualizarBarraProgresso();
}

function atualizarBarraProgresso() {
  const filled = document.getElementById('barra-preenchida');
  if (selectedMode === 8) {
    const score = document.getElementById('score');
    if (score) score.textContent = '';
    if (songAudio && songAudio.duration) {
      const perc = (songAudio.currentTime / songAudio.duration) * 100;
      filled.style.width = perc + '%';
    } else {
      filled.style.width = '0%';
    }
    return;
  }
  if (selectedMode === 7) {
    const score = document.getElementById('score');
    if (score) score.textContent = `${currentPastaName} - Nivel ${pastaAtual}`;
    const perc = (acertosModo7 / 10) * 100;
    filled.style.width = perc + '%';
    const barColor = calcularCor(acertosModo7 * (COMPLETION_THRESHOLD / 10));
    filled.style.backgroundColor = barColor;
    updateGradientColor(barColor);
    const icon = document.getElementById('mode-icon');
    if (icon) {
      icon.style.opacity = '1';
    }
    return;
  }
  const premioAtual = premioBase;
  document.getElementById('score').textContent = `PREMIO (${Math.round(premioAtual)}) pontos: (${Math.round(points)})`;
  const limite = selectedMode === 6 ? MODE6_THRESHOLD : COMPLETION_THRESHOLD;
  const perc = Math.max(0, Math.min(points, limite)) / limite * 100;
  filled.style.width = perc + '%';
  const barColor = calcularCor(points);
  filled.style.backgroundColor = barColor;
  updateGradientColor(barColor);
  const icon = document.getElementById('mode-icon');
  if (icon) {
    icon.style.opacity = '1';
  }
}

function finishMode() {
  if (completedModes[selectedMode]) return;
  stopCurrentGame();
  completedModes[selectedMode] = true;
  localStorage.setItem('completedModes', JSON.stringify(completedModes));
  const next = selectedMode + 1;
  if (next <= 6) {
    unlockMode(next, 500);
    const audio = document.getElementById('somModoDesbloqueado');
    if (audio) { audio.currentTime = 0; audio.play(); }
  }

  updateModeIcons();

  if (selectedMode === 6) {
    nextMode();
  }
}

function nextMode() {
  if (transitioning) return;
  stopCurrentGame();
  transitioning = true;
  if (selectedMode < 6) {
    recordModeTime(selectedMode);
    const next = selectedMode + 1;
    selectedMode = next;
    startGame(next);
    transitioning = false;
  } else {
    recordModeTime(selectedMode);
    pastaAtual++;
    selectedMode = 1;
    levelFrases = [];
    levelLoaded = 0;
    updateLevelIcon();
    startGame(1);
    transitioning = false;
  }
}


function goHome() {
  pauseGame(true);
  paused = false;
  consecutiveErrors = 0;
  bloqueado = false;
  if (sessionStart) {
    const total = parseInt(localStorage.getItem('totalTime') || '0', 10);
    localStorage.setItem('totalTime', total + (Date.now() - sessionStart));
    sessionStart = null;
  }
  recordModeTime(selectedMode);
  points = INITIAL_POINTS;
  saveTotals();
  atualizarBarraProgresso();
  document.getElementById('visor').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
  const icon = document.getElementById('mode-icon');
  if (icon) icon.style.display = 'none';
  updateModeIcons();
}

function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
  el.textContent = now;
}

function startTutorial() {
  tutorialInProgress = true;
  localStorage.setItem('tutorialDone', 'true');
  const welcome = document.getElementById('somWelcome');
  if (welcome) setTimeout(() => { welcome.currentTime = 0; welcome.play(); }, 1);

  const tutorialLogo = document.getElementById('tutorial-logo');
  const logoTop = document.getElementById('logo-top');
  const levelIcon = document.getElementById('nivel-indicador');
  const menuIcons = document.querySelectorAll('#menu-modes img');
  const menuLogo = document.getElementById('menu-logo');

  if (levelIcon) levelIcon.style.display = 'none';
  if (menuLogo) menuLogo.style.display = 'none';
  if (tutorialLogo) {
    tutorialLogo.style.display = 'block';
    tutorialLogo.style.width = '20%';
    setTimeout(() => { tutorialLogo.style.display = 'none'; }, 750);
  }

  menuIcons.forEach(img => { img.style.opacity = '0'; });

  setTimeout(() => {
    menuIcons.forEach(img => {
      img.style.transition = 'opacity 2000ms linear';
      img.style.opacity = '0.3';
    });
  }, 4000);

  setTimeout(() => {
    const seq = [1, 2, 3, 4, 5, 6].map(n => document.querySelector(`#menu-modes img[data-mode="${n}"]`));
    seq.forEach((img, idx) => {
      setTimeout(() => {
        if (!img) return;
        img.style.transition = 'opacity 200ms linear';
        img.style.opacity = '0.99';
        setTimeout(() => {
          img.style.transition = 'opacity 200ms linear';
          img.style.opacity = '0.3';
        }, 200);
      }, idx * 450);
    });
  }, 7000);

  const mode1 = document.querySelector('#menu-modes img[data-mode="1"]');

  setTimeout(() => { if (levelIcon) levelIcon.style.display = 'block'; }, 11420);
  setTimeout(() => {
    if (logoTop) logoTop.style.display = 'block';
    if (menuLogo) menuLogo.style.display = 'block';
    if (mode1) unlockMode(1, 1000);
    tutorialInProgress = false;
  }, 11421);
}


async function initGame() {
  const saved = parseInt(localStorage.getItem('pastaAtual'), 10);
  if (saved) pastaAtual = saved;
  if (isMobile) {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('versus-blue');
  }
  await carregarPastas();
  await carregarFrasesCorretas();
  await carregarFotos();
  await carregarPresentes();
  updateLevelIcon();
  updateModeIcons();
  if (!ilifeDone) {
    const menu = document.getElementById('menu');
    const screen = document.getElementById('ilife-screen');
    if (menu) menu.style.display = 'none';
    if (screen) {
      screen.style.display = 'flex';
      const text = document.getElementById('ilife-text');
      const lock = document.getElementById('somLock');
      screen.addEventListener('click', () => {
        if (lock) { lock.currentTime = 0; lock.play(); }
        if (text) text.textContent = 'diga play para começar';
      }, { once: true });
    }
    ilifeActive = true;
  } else {
    const screen = document.getElementById('ilife-screen');
    if (screen) screen.style.display = 'none';
    const menu = document.getElementById('menu');
    if (menu) menu.style.display = 'flex';
    points = INITIAL_POINTS;
    saveTotals();
    atualizarBarraProgresso();
    if (!tutorialDone && !isMobile) {
      startTutorial();
    }
    const logoTop = document.getElementById('logo-top');
    const levelIcon = document.getElementById('nivel-indicador');
    const menuLogo = document.getElementById('menu-logo');
    if (logoTop) logoTop.style.display = 'block';
    if (levelIcon) levelIcon.style.display = 'block';
    if (menuLogo) menuLogo.style.display = 'block';
  }

  document.querySelectorAll('#mode-buttons img, #menu-modes img').forEach(img => {
    img.addEventListener('click', () => {
      const modo = parseInt(img.dataset.mode, 10);
      if (img.closest('#menu-modes')) {
        inputSequence.push(modo);
        if (inputSequence.length > secretSequence.length) inputSequence.shift();
        if (secretSequence.every((v, i) => inputSequence[i] === v)) {
          dropdownUnlocked = true;
        }
      }
      stopCurrentGame();
      if (modo === 6 && completedModes[6] && levelUpReady) {
        performMenuLevelUp();
        return;
      }
      if (!unlockedModes[modo]) {
        const lock = document.getElementById('somLock');
        if (lock) { lock.currentTime = 0; lock.play(); }
        return;
      }
      startGame(modo);
    });
  });

  const levelText = document.getElementById('menu-level');
  if (levelText) {
    levelText.addEventListener('click', () => {
      if (!dropdownUnlocked) return;
      let dropdown = document.getElementById('mode-dropdown');
      if (dropdown) {
        dropdown.remove();
        return;
      }
      dropdown = document.createElement('select');
      dropdown.id = 'mode-dropdown';
      for (let i = 1; i <= 128; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Modo ${i}`;
        dropdown.appendChild(opt);
      }
      dropdown.addEventListener('change', () => {
        const modo = parseInt(dropdown.value, 10);
        stopCurrentGame();
        startGame(modo);
      });
      levelText.parentNode.insertBefore(dropdown, levelText.nextSibling);
    });
  }



  document.addEventListener('keydown', e => {
    if (ilifeActive && e.code === 'Space') {
      const lock = document.getElementById('somLock');
      if (lock) { lock.currentTime = 0; lock.play(); }
      return;
    }
    if (selectedMode === 8) {
      if (e.key === 'ArrowLeft') { seekSong(-5); return; }
      if (e.key === 'ArrowRight') { seekSong(5); return; }
    }
    if (e.key.toLowerCase() === 'p') {
      if (!paused) pauseGame();
      return;
    }
    if (e.key === 'r') falarFrase();
    if (e.key.toLowerCase() === 'h') toggleDarkMode();
  });
}

  window.onload = async () => {
    document.querySelectorAll('#top-nav a').forEach(a => {
      a.addEventListener('click', stopCurrentGame);
    });
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
      homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        goHome();
      });
    }
    await initGame();
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') setModePage(2);
      if (e.key === 'ArrowLeft') setModePage(1);
    });
    const handleFeedback = correct => {
      const input = document.getElementById('pt');
      const [pt, ensRaw] = frasesArr[fraseIndex] || ['', []];
      const ens = Array.isArray(ensRaw) ? ensRaw : String(ensRaw).split('#').map(s => s.trim()).filter(Boolean);
      const esperado = esperadoLang === 'pt' ? pt : ens[0];
      input.value = correct ? esperado : ' ';
      verificarResposta();
    };
    if (isMobile) {
      let startX = 0, startY = 0;
      document.addEventListener('touchstart', e => {
        const t = e.changedTouches[0];
        startX = t.screenX;
        startY = t.screenY;
      }, { passive: true });
      document.addEventListener('touchend', e => {
        const t = e.changedTouches[0];
        const dx = t.screenX - startX;
        const dy = t.screenY - startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 30) {
          handleFeedback(dy < 0);
        }
      });
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') handleFeedback(true);
      if (e.key === 'ArrowDown') handleFeedback(false);
    });
    const tapArea = document.getElementById('ilife-screen');
    if (tapArea) {
      let tapCount = 0;
      let tapTimer;
      const handleTap = () => {
        tapCount++;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { tapCount = 0; }, 500);
        if (tapCount === 3) {
          const screen = document.getElementById('ilife-screen');
          const menu = document.getElementById('menu');
          if (screen) screen.style.display = 'none';
          if (menu) menu.style.display = 'flex';
          ilifeActive = false;
          localStorage.setItem('ilifeDone', 'true');
          startTutorial();
        }
      };
      tapArea.addEventListener('touchstart', handleTap);
      tapArea.addEventListener('mousedown', handleTap);
    }
    window.addEventListener('beforeunload', () => {
      recordModeTime(selectedMode);
      saveModeStats();
      stopCurrentGame();
    });
  };
