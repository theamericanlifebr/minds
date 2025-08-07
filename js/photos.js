document.addEventListener('DOMContentLoaded', async () => {
  const img = document.getElementById('slideshow-image');
  const caption = document.getElementById('image-name');
  let images = [];
  let currentIndex = -1;

  try {
    const response = await fetch('/photos/list');
    images = await response.json();
  } catch (err) {
    console.error('Erro ao carregar imagens', err);
    return;
  }

  function getRandomIndex() {
    if (images.length < 2) {
      currentIndex = 0;
      return 0;
    }
    let idx;
    do {
      idx = Math.floor(Math.random() * images.length);
    } while (idx === currentIndex);
    currentIndex = idx;
    return idx;
  }

  function updateImage() {
    const index = getRandomIndex();
    const fileName = images[index];
    img.src = `photos/${fileName}`;
    const name = fileName.replace(/\.[^/.]+$/, '').replace('#', ' - ');
    caption.textContent = name;
  }

  function changeImage() {
    img.style.opacity = 0;
    setTimeout(() => {
      updateImage();
      img.style.opacity = 1;
    }, 500);
  }

  changeImage();
  setInterval(changeImage, 6200);
});
