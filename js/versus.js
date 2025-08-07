// Versus mode logic

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
  [25000, '#0099ff']
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

function colorFromPercent(perc) {
  const max = colorStops[colorStops.length - 1][0];
  return calcularCor((perc / 100) * max);
}

const TIME_POINT_REFS = {
  1: 125,
  2: 95,
  3: 95,
  4: 100,
  5: 100,
  6: 95
};

const SPEED_SCALE = 70 / 81.72;

let frasesCorretas = {};

async function carregarFrasesCorretas() {
  try {
    const resp = await fetch('data/frases_corretas.json');
    frasesCorretas = await resp.json();
  } catch (e) {
    frasesCorretas = {};
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
  return t;
}

async function carregarPastas() {
  const resp = await fetch('data/pastasversus.json');
  const data = await resp.json();
  return data.frases.map(l => l.split('#').map(s => s.trim()));
}

document.addEventListener('DOMContentLoaded', () => {
  let botsData = [];
  fetch('users/bots.json')
    .then(r => r.json())
    .then(data => {
      function botScore(bot) {
        const m = bot.modes['2'] || { precisao: 0, tempo: 0 };
        return (m.precisao + m.tempo) / 2;
      }
      botsData = data.bots.sort((a, b) => botScore(b) - botScore(a));
      const list = document.getElementById('bot-list');
      botsData.forEach(bot => {
        const div = document.createElement('div');
        div.className = 'bot-item';
        div.innerHTML = `<img src="users/${bot.file}" alt="${bot.name}"><div>${bot.name}</div>`;
        div.addEventListener('click', () => showModes(bot));
        list.appendChild(div);
      });
    });

  let frases = [];
  let fraseIndex = 0;
  let esperado = '';
  let inicioFrase = 0;
  let totalTempo = 0;
  let totalFrases = 0;
  let acertos = 0;
  let botStats = { precisao: 0, tempo: 0 };
  let botAtual = null;
  let userTimePerc = 0;
  let userAccPerc = 0;
  let silencioTimer = null;
  let reconhecimento = null;
  let modoAtual = 0;
  let startGameTime = 0;
  let versusLogs = [];
  let currentFrase = { pt: '', en: '' };
  let botPlayers = [];
  let userPlayer = null;

  const successSound = new Audio('gamesounds/success.mp3');

  function resetSilenceTimer() {
    if (silencioTimer) clearTimeout(silencioTimer);
    if (modoAtual) {
      silencioTimer = setTimeout(() => {
        if (modoAtual) nextFrase();
      }, 4000);
    }
  }

  const fraseEl = document.getElementById('versus-phrase');
  let userImg = null;
  let userNameEl = null;

  function applyTheme() {
    fraseEl.style.color = document.body.classList.contains('versus-white') ? '#555' : '#fff';
  }

  function toggleTheme() {
    document.body.classList.toggle('versus-white');
    document.body.classList.toggle('versus-blue');
    applyTheme();
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
      toggleTheme();
    }
  });

  applyTheme();

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    reconhecimento = new SpeechRecognition();
    reconhecimento.lang = 'en-US';
    reconhecimento.continuous = true;
    reconhecimento.interimResults = false;
    reconhecimento.onresult = (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
      verificar(transcript);
      resetSilenceTimer();
    };
    reconhecimento.onerror = (e) => console.error('Erro no reconhecimento de voz:', e.error);
    reconhecimento.onend = () => {
      if (modoAtual) {
        resetSilenceTimer();
        try { reconhecimento.start(); } catch (err) {}
      }
    };
  } else {
    alert('Reconhecimento de voz não suportado.');
  }

  function showModes(bot) {
    document.getElementById('bot-list').style.display = 'none';
    const modeList = document.getElementById('mode-list');
    modeList.innerHTML = '';
    for (let i = 1; i <= 6; i++) {
      const img = document.createElement('img');
      img.src = `selos%20modos%20de%20jogo/modo${i}.png`;
      img.alt = `Modo ${i}`;
      img.dataset.mode = i;
      img.addEventListener('click', () => startVersus(bot, i));
      modeList.appendChild(img);
    }
    modeList.style.display = 'grid';
  }

  async function startVersus(bot, modo) {
    modoAtual = modo;
    document.getElementById('mode-list').style.display = 'none';
    if (modo === 3) {
      botAtual = botsData[Math.floor(Math.random() * botsData.length)];
      matchmakingSequence(() => initGame());
    } else if (modo === 1) {
      botAtual = null;
      initGame();
    } else {
      botAtual = bot;
      initGame();
    }
  }

  function matchmakingSequence(callback) {
    const overlay = document.getElementById('matchmaking');
    const txt = document.getElementById('matchmaking-text');
    const avatar = document.getElementById('matchmaking-avatar');
    overlay.style.display = 'flex';
    avatar.style.display = 'none';
    txt.textContent = 'procurando um jogador online...';
    const findSound = new Audio('gamesounds/finding.mp3');
    findSound.play();
    const wait = 5000 + Math.random() * 5000;
    setTimeout(() => {
      const connectSound = new Audio('gamesounds/connected.wav');
      connectSound.play();
      avatar.src = `users/${botAtual.file}`;
      avatar.style.display = 'block';
      let count = 5;
      function step() {
        if (count > 3) {
          txt.textContent = 'adversario encontrado';
        } else if (count > 0) {
          txt.textContent = String(count);
        } else {
          overlay.style.display = 'none';
          callback();
          return;
        }
        count--;
        setTimeout(step, 1000);
      }
      step();
    }, wait);
  }

  async function initGame() {
    await carregarFrasesCorretas();
    const game = document.getElementById('versus-game');
    game.style.display = 'block';
    startGameTime = Date.now();
    versusLogs = JSON.parse(localStorage.getItem('versusLogs') || '[]');
    frases = embaralhar(await carregarPastas());
    botPlayers = [];
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    const multi = modoAtual === 2 || modoAtual === 1;
    const userDiv = document.createElement('div');
    userDiv.className = 'player';
    userDiv.id = 'player-user';
    userDiv.innerHTML = `
      <div class="player-pos">0º</div>
      <div class="player-info">
        <img src="users/theuser.png" alt="the user" class="player-img">
        <div class="player-name" id="user-name">Você</div>
        <div class="stat-bar time"><div class="fill"></div></div>
        <div class="stat-bar acc"><div class="fill"></div></div>
      </div>
      <div class="player-score">0</div>
    `;
    userPlayer = {
      element: userDiv,
      posEl: userDiv.querySelector('.player-pos'),
      scoreEl: userDiv.querySelector('.player-score')
    };
    if (multi) {
      const numBots = modoAtual === 1 ? 9 : 3;
      const escolha = modoAtual === 1
        ? botsData.slice(0, numBots)
        : [...botsData].sort(() => Math.random() - 0.5).slice(0, numBots);
      const ordered = escolha.map(b => {
        let stats;
        if (modoAtual === 1) {
          const modes = Object.values(b.modes);
          const avgAcc = modes.reduce((s, m) => s + m.precisao, 0) / modes.length;
          const avgTempo = modes.reduce((s, m) => s + m.tempo, 0) / modes.length;
          stats = { precisao: avgAcc, tempo: avgTempo };
        } else {
          stats = b.modes[String(modoAtual)] || { precisao: 0, tempo: 0 };
        }
        const score = (stats.precisao + stats.tempo) / 2;
        return { b, stats, score };
      }).sort((a, b) => b.score - a.score);
      ordered.forEach((entry, idx) => {
        const div = document.createElement('div');
        div.className = 'player';
        div.id = `bot-${idx}`;
        div.innerHTML = `
          <div class="player-pos">0º</div>
          <div class="player-info">
            <img src="users/${entry.b.file}" alt="${entry.b.name}" class="player-img">
            <div class="player-name">${entry.b.name}</div>
            <div class="stat-bar time"><div class="fill"></div></div>
            <div class="stat-bar acc"><div class="fill"></div></div>
          </div>
          <div class="player-score">0</div>
        `;
        playersDiv.appendChild(div);
        botPlayers.push({
          element: div,
          img: div.querySelector('.player-img'),
          nameEl: div.querySelector('.player-name'),
          posEl: div.querySelector('.player-pos'),
          scoreEl: div.querySelector('.player-score'),
          name: entry.b.name,
          stats: entry.stats,
          accSum: 0,
          timeSum: 0,
          rounds: 0,
          acc: 0,
          tempo: 0
        });
      });
      playersDiv.appendChild(userDiv);
    } else {
      playersDiv.appendChild(userDiv);
      const div = document.createElement('div');
      div.className = 'player';
      div.id = 'player-bot';
      div.innerHTML = `
        <div class="player-pos">0º</div>
        <div class="player-info">
          <img id="bot-avatar" class="player-img" src="users/${botAtual.file}" alt="adversario">
          <div class="player-name">${botAtual.name}</div>
          <div class="stat-bar time"><div class="fill"></div></div>
          <div class="stat-bar acc"><div class="fill"></div></div>
        </div>
        <div class="player-score">0</div>
      `;
      playersDiv.appendChild(div);
      botStats = botAtual.modes[String(modoAtual)] || { precisao: 0, tempo: 0 };
      botPlayers = [{ element: div, img: div.querySelector('.player-img'), nameEl: div.querySelector('.player-name'), posEl: div.querySelector('.player-pos'), scoreEl: div.querySelector('.player-score'), name: botAtual.name, stats: botStats, accSum: 0, timeSum: 0, rounds: 0, acc: 0, tempo: 0 }];
    }
    userImg = userDiv.querySelector('.player-img');
    userNameEl = document.getElementById('user-name');
    nextFrase();
    updateBars();
    setTimeout(encerrar, 120000);
    if (reconhecimento) try { reconhecimento.start(); } catch (err) {}
    resetSilenceTimer();
  }

  function embaralhar(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nextFrase() {
    if (fraseIndex >= frases.length) fraseIndex = 0;
    const [pt, en] = frases[fraseIndex];
    currentFrase = { pt, en };
    fraseEl.style.transition = 'none';
    fraseEl.style.opacity = 0;
    fraseEl.style.fontSize = '40px';
    applyTheme();
    const displayText = modoAtual === 3 ? en : pt;
    fraseEl.textContent = capitalize(displayText);
    esperado = en.toLowerCase();
    if (modoAtual === 5) {
      const utter = new SpeechSynthesisUtterance(en);
      utter.lang = 'en-US';
      speechSynthesis.cancel();
      speechSynthesis.speak(utter);
    } else {
      setTimeout(() => {
        fraseEl.style.transition = 'opacity 500ms, font-size 1000ms';
        fraseEl.style.opacity = 1;
        fraseEl.style.fontSize = '45px';
      }, 50);
    }
    inicioFrase = Date.now();
    fraseIndex++;
    resetSilenceTimer();
  }

  function flashColor(cor) {
    fraseEl.style.transition = 'color 500ms';
    fraseEl.style.color = cor;
    setTimeout(() => {
      applyTheme();
    }, 500);
  }

  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  function fraseCorreta(resp, esperado) {
    resp = aplicarFrasesCorretas(resp);
    esperado = aplicarFrasesCorretas(esperado);
    const respWords = resp.trim().split(/\s+/);
    const expWords = esperado.trim().split(/\s+/);
    if (respWords.length < expWords.length) return false;
    for (let start = 0; start <= respWords.length - expWords.length; start++) {
      let ok = true;
      for (let i = 0; i < expWords.length; i++) {
        if (levenshtein(respWords[start + i], expWords[i]) > 1) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }

  function verificar(resp) {
    let tempo = Date.now() - inicioFrase;
    const extra = Math.max(0, esperado.replace(/\s+/g, '').length - 6);
    tempo -= 131 * extra;
    tempo = Math.max(tempo * 0.81, 0);
    totalTempo += tempo;
    totalFrases++;
    const correto = fraseCorreta(resp, esperado);
    if (correto) {
      acertos++;
      flashColor('#40e0d0');
      successSound.currentTime = 0;
      successSound.play();
    } else {
      flashColor('red');
      const old = fraseEl.textContent;
      fraseEl.textContent = capitalize(currentFrase.en);
      setTimeout(() => { fraseEl.textContent = old; }, 1000);
    }
    // Versus mode continues regardless of errors; no game over after mistakes
    const gameElapsed = Date.now() - startGameTime;
    versusLogs.push({
      phrasePT: currentFrase.pt,
      phraseEN: currentFrase.en,
      input: resp,
      correct: correto,
      recogTime: tempo,
      gameTime: gameElapsed
    });
    localStorage.setItem('versusLogs', JSON.stringify(versusLogs));
    updateBars();
    setTimeout(nextFrase, 1000);
  }

  function setBar(fill, perc) {
    fill.style.opacity = 0;
    setTimeout(() => {
      const width = fill.parentElement.clientWidth;
      fill.style.width = (width * perc / 100) + 'px';
      fill.style.backgroundColor = colorFromPercent(perc);
      fill.style.opacity = 1;
    }, 200);
  }

  function updateBars() {
    userAccPerc = totalFrases ? (acertos / totalFrases * 100) : 0;
    const avg = totalFrases ? (totalTempo / totalFrases / 1000) : 0;
    userTimePerc = Math.max(0, 100 - avg * 20);
    userTimePerc = Math.min(userTimePerc + 22, 100);
    userTimePerc *= 0.92;
    userTimePerc *= 1.1;
    userTimePerc = Math.min(userTimePerc, 100);
    userTimePerc *= SPEED_SCALE;
    const vary = v => v * (1 + (Math.random() * 0.25 - 0.15));
    setBar(userPlayer.element.querySelector('.time .fill'), userTimePerc);
    setBar(userPlayer.element.querySelector('.acc .fill'), userAccPerc);
    const ref = TIME_POINT_REFS[modoAtual] || 100;
    const userTimePts = (userTimePerc / 100) * ref * totalFrases;
    const userErrors = totalFrases - acertos;
    const userScore = userTimePts + acertos - userErrors;
    botPlayers.forEach(bp => {
      const acc = vary(bp.stats.precisao);
      const tempo = vary(bp.stats.tempo);
      bp.accSum += acc;
      bp.timeSum += tempo;
      bp.rounds++;
      bp.acc = bp.accSum / bp.rounds;
      bp.tempo = bp.timeSum / bp.rounds;
      setBar(bp.element.querySelector('.time .fill'), bp.tempo);
      setBar(bp.element.querySelector('.acc .fill'), bp.acc);
    });
    const entries = [
      { element: userPlayer.element, name: 'Você', score: userScore, posEl: userPlayer.posEl, scoreEl: userPlayer.scoreEl },
      ...botPlayers.map(bp => {
        const botTimePts = (bp.tempo / 100) * ref * bp.rounds;
        const botCorrect = (bp.acc / 100) * bp.rounds;
        const botErrors = bp.rounds - botCorrect;
        return { element: bp.element, name: bp.name, score: botTimePts + botCorrect - botErrors, posEl: bp.posEl, scoreEl: bp.scoreEl };
      })
    ];
    const ordered = entries.slice().sort((a, b) => b.score - a.score);
    const playersDiv = document.getElementById('players');
    ordered.forEach((o, idx) => {
      o.posEl.textContent = `${idx + 1}º`;
      o.scoreEl.textContent = o.score.toFixed(1);
      playersDiv.appendChild(o.element);
    });
    const rank = ordered.map((o, i) => `${i + 1}. ${o.name}`).join(' | ');
    document.getElementById('ranking-bottom').textContent = rank;
  }

  function encerrar() {
    fraseEl.style.transition = 'opacity 0.5s';
    fraseEl.classList.add('dissolve');
    const mode = modoAtual;
    modoAtual = 0;
    if (silencioTimer) clearTimeout(silencioTimer);
    if (reconhecimento) try { reconhecimento.stop(); } catch (err) {}
    const ref = TIME_POINT_REFS[mode] || 100;
    const userTimePts = (userTimePerc / 100) * ref * totalFrases;
    const userErrors = totalFrases - acertos;
    const userScore = userTimePts + acertos - userErrors;
    localStorage.setItem('versusStats', JSON.stringify({ accuracy: userAccPerc.toFixed(2), speed: userTimePerc.toFixed(2), scaled: true }));
    const botScores = botPlayers.map(bp => {
      const timePts = (bp.tempo / 100) * ref * bp.rounds;
      const corr = (bp.acc / 100) * bp.rounds;
      return { img: bp.img, score: timePts + corr - (bp.rounds - corr) };
    });
    const maxScore = Math.max(userScore, ...botScores.map(b => b.score));
    if (userScore < maxScore) userImg.style.opacity = '0.5';
    botScores.forEach(bs => { if (bs.score < maxScore) bs.img.style.opacity = '0.5'; });
  }
});

