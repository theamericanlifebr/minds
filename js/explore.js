document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('color-screen');
  const countdownEl = document.createElement('div');
  countdownEl.id = 'countdown';
  overlay.appendChild(countdownEl);

  const photoEl = document.createElement('img');
  photoEl.id = 'random-photo';
  overlay.appendChild(photoEl);

  const photos = [
    'banana#banana.png',
    'laranja#orange.png',
    'maçã#apple.png',
    'melancia#watermelon.png'
  ];

  let countdownInterval = null;

  function hideOverlay() {
    overlay.style.display = 'none';
    countdownEl.style.display = 'none';
    photoEl.style.display = 'none';
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    overlay.onclick = null;
  }

  function showOverlay(color, isMode7) {
    overlay.style.backgroundColor = color;
    overlay.style.display = 'block';

    if (isMode7) {
      let timeLeft = 10;
      countdownEl.textContent = timeLeft;
      countdownEl.style.display = 'block';

      const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
      photoEl.src = 'photos/' + encodeURIComponent(randomPhoto);
      photoEl.style.display = 'block';

      countdownInterval = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;
        if (timeLeft <= 0) {
          hideOverlay();
        }
      }, 1000);

      overlay.onclick = null;
    } else {
      countdownEl.style.display = 'none';
      photoEl.style.display = 'none';
      overlay.onclick = hideOverlay;
    }
  }

  document.querySelectorAll('.explore-grid img').forEach(img => {
    img.addEventListener('click', () => {
      const isMode7 = img.alt.includes('Modo 7');
      showOverlay(img.dataset.color, isMode7);
    });
  });
});
