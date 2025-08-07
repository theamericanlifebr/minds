// Versus mode logic

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
  let botAtual = null;
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

  function createRankingPlayer(name, img, stats = {}) {
    const row = document.createElement('div');
    row.className = 'ranking-row';
    row.innerHTML = `<img src="${img}" alt="${name}"><span class="rank-name">${name}</span><span class="rank-score">0</span><span class="rank-hits">0</span><span class="rank-errors">0</span>`;
    return {
      element: row,
      name,
      scoreEl: row.querySelector('.rank-score'),
      hitsEl: row.querySelector('.rank-hits'),
      errorsEl: row.querySelector('.rank-errors'),
      score: 0,
      hits: 0,
      errors: 0,
      rounds: 0,
      stats
    };
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
    const rankingDiv = document.getElementById('versus-ranking');
    rankingDiv.innerHTML = '';
    const multi = modoAtual === 2 || modoAtual === 1;
    userPlayer = createRankingPlayer('Você', 'users/theuser.png');
    rankingDiv.appendChild(userPlayer.element);
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
      ordered.forEach(entry => {
        const player = createRankingPlayer(entry.b.name, `users/${entry.b.file}`, entry.stats);
        botPlayers.push(player);
        rankingDiv.appendChild(player.element);
      });
    } else {
      const stats = botAtual.modes[String(modoAtual)] || { precisao: 0, tempo: 0 };
      const player = createRankingPlayer(botAtual.name, `users/${botAtual.file}`, stats);
      botPlayers.push(player);
      rankingDiv.appendChild(player.element);
    }
    nextFrase();
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
    const tempoPts = Math.max(0, 120 - tempo / 100);
    userPlayer.score += tempoPts;
    const correto = fraseCorreta(resp, esperado);
    if (correto) {
      acertos++;
      userPlayer.score += 5;
      flashColor('#40e0d0');
      successSound.currentTime = 0;
      successSound.play();
    } else {
      userPlayer.score = Math.max(0, userPlayer.score - 2);
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
    updateRanking();
    setTimeout(nextFrase, 1000);
  }

  function updateRanking() {
    userPlayer.hits = acertos;
    userPlayer.errors = totalFrases - acertos;
    userPlayer.scoreEl.textContent = Math.round(userPlayer.score);
    userPlayer.hitsEl.textContent = userPlayer.hits;
    userPlayer.errorsEl.textContent = userPlayer.errors;
    botPlayers.forEach(bp => {
      const vary = v => v * (1 + (Math.random() * 0.14 - 0.07));
      bp.rounds++;
      const acc = vary(bp.stats.precisao);
      const tempo = vary(bp.stats.tempo);
      if (Math.random() * 100 < acc) {
        bp.hits++;
        bp.score += tempo + 5;
      } else {
        bp.errors++;
        bp.score += Math.max(0, tempo - 5);
      }
      bp.scoreEl.textContent = Math.round(bp.score);
      bp.hitsEl.textContent = bp.hits;
      bp.errorsEl.textContent = bp.errors;
    });
    const rankingDiv = document.getElementById('versus-ranking');
    const all = [userPlayer, ...botPlayers].sort((a, b) => b.score - a.score);
    rankingDiv.innerHTML = '';
    all.slice(0, 10).forEach(p => rankingDiv.appendChild(p.element));
  }

  function encerrar() {
    fraseEl.style.transition = 'opacity 0.5s';
    fraseEl.classList.add('dissolve');
    modoAtual = 0;
    if (silencioTimer) clearTimeout(silencioTimer);
    if (reconhecimento) try { reconhecimento.stop(); } catch (err) {}
    const accuracy = totalFrases ? (acertos / totalFrases * 100) : 0;
    const avg = totalFrases ? (totalTempo / totalFrases / 1000) : 0;
    const speed = Math.max(0, 100 - avg * 20);
    localStorage.setItem('versusStats', JSON.stringify({ accuracy: accuracy.toFixed(2), speed: speed.toFixed(2) }));
  }
});

