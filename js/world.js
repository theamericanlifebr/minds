document.addEventListener('DOMContentLoaded', () => {
  const menu = document.getElementById('menu');
  const game = document.getElementById('world-game');
  const imgEl = document.getElementById('world-image');
  const resultEl = document.getElementById('world-result');
  const modeButtons = document.querySelectorAll('#menu-modes img');

  const themes = ['black', 'white', 'blue'];
  let theme = localStorage.getItem('menuColor') || 'black';

  function applyTheme() {
    document.body.classList.remove('world-black', 'world-white', 'world-blue');
    document.body.classList.add(`world-${theme}`);
  }

  function cycleTheme() {
    const idx = themes.indexOf(theme);
    theme = themes[(idx + 1) % themes.length];
    localStorage.setItem('menuColor', theme);
    applyTheme();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
      cycleTheme();
    }
  });

  applyTheme();

  let images = [];
  let currentExpected = '';
  let recognition;

  async function loadImages() {
    const resp = await fetch('/photos/list');
    images = await resp.json();
  }

  function normalize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function checkAnswer(transcript) {
    const correct = normalize(transcript) === normalize(currentExpected);
    resultEl.textContent = correct ? 'correto' : 'errado';
    setTimeout(() => {
      resultEl.textContent = '';
      nextImage();
    }, 1000);
  }

  function nextImage() {
    if (!images.length) return;
    const file = images[Math.floor(Math.random() * images.length)];
    currentExpected = (file.split('#')[1] || '').replace(/\.[^.]+$/, '');
    imgEl.style.opacity = 0;
    imgEl.src = 'photos/' + encodeURIComponent(file);
    setTimeout(() => {
      imgEl.style.opacity = 1;
    }, 50);
    if (recognition) recognition.start();
  }

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      checkAnswer(transcript);
    };
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.getAttribute('data-mode');
      if (mode === '7') {
        menu.style.display = 'none';
        game.style.display = 'block';
        await loadImages();
        nextImage();
      }
    });
  });
});
