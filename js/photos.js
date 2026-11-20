// =============================================
// ABOUT PAGE – "See Us in Action" carousel
// The four hard-coded slides stay. Approved community photos from
// data/photos.json are added after them (see MAINTAINING.md).
// Contact emails are not in that file and are never shown.
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('carousel-track');
  const container = document.querySelector('.carousel-container');
  const dotsContainer = document.getElementById('carousel-dots');
  if (!track || !container || !dotsContainer) return;

  let currentSlide = 0;

  function slides() {
    return [...track.querySelectorAll('.carousel-slide')];
  }

  function goToSlide(n) {
    const list = slides();
    if (!list.length) return;
    currentSlide = (n + list.length) % list.length;
    track.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
    dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      const on = i === currentSlide;
      dot.classList.toggle('active', on);
      dot.setAttribute('aria-current', on ? 'true' : 'false');
    });
  }

  function createDots() {
    dotsContainer.innerHTML = '';
    slides().forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot' + (i === currentSlide ? ' active' : '');
      dot.setAttribute('aria-label', 'Show photo ' + (i + 1));
      dot.addEventListener('click', () => goToSlide(i));
      dotsContainer.appendChild(dot);
    });
  }

  function initCarousel() {
    if (currentSlide >= slides().length) currentSlide = 0;
    createDots();
    goToSlide(currentSlide);
  }

  window.nextSlide = () => goToSlide(currentSlide + 1);
  window.prevSlide = () => goToSlide(currentSlide - 1);

  if (!container.dataset.swipe) {
    container.dataset.swipe = '1';
    let startX = 0;
    let startY = 0;
    container.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });
    container.addEventListener('touchend', (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) window.nextSlide();
      else window.prevSlide();
    }, { passive: true });
  }

  // Only files this repository downloaded. Never an Airtable link (those expire).
  function safeImage(value) {
    const path = String(value || '').trim();
    if (/^images\/community\/rec[A-Za-z0-9]+\.(jpe?g|png|webp|gif)$/i.test(path)) return path;
    return '';
  }

  function photoList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.photos)) return data.photos;
    return [];
  }

  function sortPhotos(photos) {
    return photos.slice().sort((a, b) => {
      const ao = a.sortOrder == null || a.sortOrder === '' ? null : Number(a.sortOrder);
      const bo = b.sortOrder == null || b.sortOrder === '' ? null : Number(b.sortOrder);
      const aMissing = ao == null || Number.isNaN(ao);
      const bMissing = bo == null || Number.isNaN(bo);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (!aMissing && ao !== bo) return ao - bo;
      return String(a.submittedAt || '').localeCompare(String(b.submittedAt || ''));
    });
  }

  function addCommunitySlides(photos) {
    track.querySelectorAll('.carousel-slide[data-community]').forEach((slide) => slide.remove());
    photos.forEach((photo) => {
      const src = safeImage(photo.image);
      if (!src) return;
      const caption = String(photo.caption || '').trim();
      const by = String(photo.submittedBy || '').trim();
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      slide.dataset.community = '1';
      const img = document.createElement('img');
      img.src = src;
      img.alt = caption || (by ? 'Photo by ' + by : 'Community photo');
      img.loading = 'lazy';
      img.decoding = 'async';
      slide.appendChild(img);
      if (caption || by) {
        const block = document.createElement('p');
        block.className = 'carousel-caption';
        if (caption) {
          const text = document.createElement('span');
          text.className = 'carousel-caption-text';
          text.textContent = caption;
          block.appendChild(text);
        }
        if (by) {
          const credit = document.createElement('span');
          credit.className = 'carousel-credit';
          credit.textContent = 'Photo: ' + by;
          block.appendChild(credit);
        }
        slide.appendChild(block);
      }
      track.appendChild(slide);
    });
  }

  initCarousel();

  fetch('data/photos.json?v=' + Date.now())
    .then((res) => {
      if (!res.ok) throw new Error('Failed to fetch photos');
      return res.json();
    })
    .then((data) => {
      addCommunitySlides(sortPhotos(photoList(data)));
      initCarousel();
      track.dataset.photos = 'ready';
    })
    .catch((error) => {
      console.error('Could not load photos.json', error);
      track.dataset.photos = 'ready';
    });
});
