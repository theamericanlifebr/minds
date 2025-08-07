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
  let slideshowInterval = null;
  let currentPhoto = null;

  function stopSlideshow() {
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
    }
    currentPhoto = null;
    photoEl.style.display = 'none';
    photoEl.style.opacity = 0;
  }

  function hideOverlay() {
    overlay.style.display = 'none';
    countdownEl.style.display = 'none';
    stopSlideshow();
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    overlay.onclick = null;
  }

  function nextPhoto(first = false) {
    let next;
    do {
      next = photos[Math.floor(Math.random() * photos.length)];
    } while (next === currentPhoto && photos.length > 1);
    currentPhoto = next;

    if (!first) {
      photoEl.style.opacity = 0;
    }
    setTimeout(() => {
      photoEl.src = 'photos/' + encodeURIComponent(next);
      photoEl.onload = () => {
        photoEl.style.opacity = 1;
      };
    }, first ? 0 : 500);
  }

  function startSlideshow() {
    photoEl.style.display = 'block';
    nextPhoto(true);
    slideshowInterval = setInterval(() => nextPhoto(), 3000);
  }

  function showOverlay(color, isMode7) {
    overlay.style.backgroundColor = color;
    overlay.style.display = 'block';

    if (isMode7) {
      let timeLeft = 60;
      countdownEl.textContent = timeLeft;
      countdownEl.style.display = 'block';

      startSlideshow();

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
      stopSlideshow();
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
