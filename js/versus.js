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
  let botTimePerc = 0;
  let botAccPerc = 0;
  let silencioTimer = null;
  let reconhecimento = null;
  let modoAtual = 0;
  let startGameTime = 0;
  let versusLogs = [];
  let currentFrase = { pt: '', en: '' };
  let botPlayers = [];

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
  let botImg = null;
  let userNameEl = null;

  function applyTheme() {
    fraseEl.style.color = document.body.classList.contains('versus-white') ? '#555' : '#fff';
  }

  function toggleTheme() {
    document.body.classList.toggle('versus-white');
    document.body.classList.toggle('versus-blue');
    applyTheme();
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
      showConnecting(() => initGame());
    } else {
      botAtual = bot;
      initGame();
    }
  }

  function showConnecting(callback) {
    const connect = document.getElementById('versus-connect');
    const img = document.getElementById('versus-connect-img');
    const txt = document.getElementById('versus-connect-text');
    connect.style.display = 'block';
    img.src = 'https://giffiles.alphacoders.com/209/209663.gif';
    txt.textContent = 'estamos conectando um jogador';
    const wait = 4000 + Math.random() * 6000;
    setTimeout(() => {
      img.src = 'https://i.pinimg.com/originals/89/86/fe/8986fef7a58272135c7c5d006a312554.gif';
      txt.textContent = 'jogador encontrado, clique para iniciar jogo';
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => {
        connect.style.display = 'none';
        callback();
      }, { once: true });
    }, wait);
  }

  async function initGame() {
    const game = document.getElementById('versus-game');
    game.style.display = 'block';
    startGameTime = Date.now();
    versusLogs = JSON.parse(localStorage.getItem('versusLogs') || '[]');
    frases = embaralhar(await carregarPastas());
    botPlayers = [];
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    const imgSize = modoAtual === 2 ? 120 : 150;
    const barWidth = modoAtual === 2 ? 120 : 200;
    const userDiv = document.createElement('div');
    userDiv.className = 'player';
    userDiv.id = 'player-user';
    userDiv.innerHTML = `
      <img src="users/theuser.png" alt="the user" class="player-img" style="width:${imgSize}px;height:${imgSize}px;">
      <div class="player-name" id="user-name">Você</div>
      <div class="stat-bar time" style="width:${barWidth}px"><div class="fill"></div></div>
      <div class="stat-bar acc" style="width:${barWidth}px"><div class="fill"></div></div>
    `;
    if (modoAtual === 2) {
      const escolha = [...botsData].sort(() => Math.random() - 0.5).slice(0, 3);
      const ordered = escolha.map(b => {
        const stats = b.modes[String(modoAtual)] || { precisao: 0, tempo: 0 };
        const score = (stats.precisao + stats.tempo) / 2;
        return { b, stats, score };
      }).sort((a, b) => b.score - a.score);
      ordered.forEach((entry, idx) => {
        const div = document.createElement('div');
        div.className = 'player';
        div.id = `bot-${idx}`;
        div.innerHTML = `
          <img src="users/${entry.b.file}" alt="${entry.b.name}" class="player-img" style="width:120px;height:120px;">
          <div class="player-name">${entry.b.name}</div>
          <div class="stat-bar time" style="width:120px"><div class="fill"></div></div>
          <div class="stat-bar acc" style="width:120px"><div class="fill"></div></div>
        `;
        playersDiv.appendChild(div);
        botPlayers.push({ element: div, img: div.querySelector('.player-img'), nameEl: div.querySelector('.player-name'), name: entry.b.name, stats: entry.stats, acc: 0, tempo: 0 });
      });
      playersDiv.appendChild(userDiv);
    } else {
      playersDiv.appendChild(userDiv);
      const div = document.createElement('div');
      div.className = 'player';
      div.id = 'player-bot';
      div.innerHTML = `
        <img id="bot-avatar" class="player-img" src="users/${botAtual.file}" alt="adversario" style="width:150px;height:150px;">
        <div class="player-name">${botAtual.name}</div>
        <div class="stat-bar time"><div class="fill"></div></div>
        <div class="stat-bar acc"><div class="fill"></div></div>
      `;
      playersDiv.appendChild(div);
      botImg = div.querySelector('.player-img');
      botStats = botAtual.modes[String(modoAtual)] || { precisao: 0, tempo: 0 };
      botPlayers = [{ element: div, img: botImg, nameEl: div.querySelector('.player-name'), name: botAtual.name, stats: botStats, acc: 0, tempo: 0 }];
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
    fraseEl.textContent = pt;
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
      fraseEl.textContent = currentFrase.en;
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
    const vary = v => v * (1 + (Math.random() * 0.25 - 0.15));
    setBar(document.querySelector('#player-user .time .fill'), userTimePerc);
    setBar(document.querySelector('#player-user .acc .fill'), userAccPerc);
    const userScore = (userAccPerc + userTimePerc) / 2;
    if (userNameEl) userNameEl.style.backgroundColor = colorFromPercent(userScore);
    if (modoAtual === 2) {
      botPlayers.forEach(bp => {
        const acc = vary(bp.stats.precisao);
        const tempo = vary(bp.stats.tempo);
        bp.acc = acc;
        bp.tempo = tempo;
        setBar(bp.element.querySelector('.time .fill'), tempo);
        setBar(bp.element.querySelector('.acc .fill'), acc);
        if (bp.nameEl) bp.nameEl.style.backgroundColor = colorFromPercent((acc + tempo) / 2);
      });
      const playersDiv = document.getElementById('players');
      const entries = [
        { element: document.getElementById('player-user'), name: 'Você', score: userScore },
        ...botPlayers.map(bp => ({ element: bp.element, name: bp.name, score: (bp.acc + bp.tempo) / 2 }))
      ];
      const ordered = entries.slice().sort((a, b) => b.score - a.score);
      const current = Array.from(playersDiv.children);
      const newOrder = ordered.map(e => e.element);
      const changed = newOrder.some((el, idx) => el !== current[idx]);
      if (changed) {
        current.forEach(el => { el.style.transition = 'opacity 0.5s'; el.style.opacity = '0'; });
        setTimeout(() => {
          ordered.forEach(o => playersDiv.appendChild(o.element));
          ordered.forEach(o => { o.element.style.opacity = '1'; });
        }, 500);
      }
      const rank = ordered.map((o, i) => `${i + 1}. ${o.name}`).join(' | ');
      document.getElementById('ranking-bottom').textContent = rank;
    } else {
      botAccPerc = vary(botStats.precisao);
      botTimePerc = vary(botStats.tempo);
      setBar(document.querySelector('#player-bot .time .fill'), botTimePerc);
      setBar(document.querySelector('#player-bot .acc .fill'), botAccPerc);
      const botScore = (botAccPerc + botTimePerc) / 2;
      if (botPlayers[0] && botPlayers[0].nameEl) botPlayers[0].nameEl.style.backgroundColor = colorFromPercent(botScore);
      const ordered = [
        { name: 'Você', score: userScore },
        { name: botPlayers[0].name, score: botScore }
      ].sort((a, b) => b.score - a.score);
      document.getElementById('ranking-bottom').textContent = ordered.map((o, i) => `${i + 1}. ${o.name}`).join(' | ');
    }
  }

  function encerrar() {
    fraseEl.style.transition = 'opacity 0.5s';
    fraseEl.classList.add('dissolve');
    const mode = modoAtual;
    modoAtual = 0;
    if (silencioTimer) clearTimeout(silencioTimer);
    if (reconhecimento) try { reconhecimento.stop(); } catch (err) {}
    const userScore = (userAccPerc + userTimePerc) / 2;
    localStorage.setItem('versusStats', JSON.stringify({ accuracy: userAccPerc.toFixed(2), speed: userTimePerc.toFixed(2) }));
    if (mode === 2) {
      const scores = botPlayers.map(bp => (bp.acc + bp.tempo) / 2);
      const maxScore = Math.max(userScore, ...scores);
      if (userScore < maxScore) userImg.style.opacity = '0.5';
      botPlayers.forEach((bp, idx) => {
        if (scores[idx] < maxScore) bp.img.style.opacity = '0.5';
      });
    } else {
      const botScore = (botAccPerc + botTimePerc) / 2;
      if (userScore > botScore) {
        botImg.style.opacity = '0.5';
      } else if (botScore > userScore) {
        userImg.style.opacity = '0.5';
      } else {
        botImg.style.opacity = userImg.style.opacity = '0.5';
      }
    }
  }
});

