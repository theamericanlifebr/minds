document.addEventListener('DOMContentLoaded', () => {
  const levelSelect = document.getElementById('level-select');
  for (let i = 1; i <= 128; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Nível ${i}`;
    levelSelect.appendChild(opt);
  }
  const savedLevel = parseInt(localStorage.getItem('pastaAtual'), 10) || 1;
  levelSelect.value = savedLevel;
  levelSelect.addEventListener('change', () => {
    localStorage.setItem('pastaAtual', levelSelect.value);
  });

  const themes = ['versus-blue', 'versus-white', 'versus-black'];
  const themeSelect = document.getElementById('theme-select');
  const savedTheme = parseInt(localStorage.getItem('themeIndex'), 10);
  const themeIndex = isNaN(savedTheme) ? 0 : savedTheme;
  themeSelect.value = themeIndex;
  document.body.classList.remove(...themes);
  document.body.classList.add(themes[themeIndex]);
  themeSelect.addEventListener('change', () => {
    const idx = parseInt(themeSelect.value, 10);
    localStorage.setItem('themeIndex', idx);
    document.body.classList.remove(...themes);
    document.body.classList.add(themes[idx]);
  });

  const pointsInput = document.getElementById('points-input');
  const savedPoints = parseInt(localStorage.getItem('premioBase'), 10) || 1000;
  pointsInput.value = savedPoints;
  pointsInput.addEventListener('change', () => {
    const val = parseInt(pointsInput.value, 10);
    if (!isNaN(val)) {
      localStorage.setItem('premioBase', val);
    }
  });
});
