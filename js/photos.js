// =============================================
// ABOUT PAGE – community photos
// Photos come from data/photos.json, which a GitHub Action fills from the
// APPROVED rows of the Airtable "Photos" table (see MAINTAINING.md).
// Contact emails are not in that file and are never shown.
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const gallery = document.getElementById('community-photo-gallery');
  if (!gallery) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  fetch('data/photos.json?v=' + Date.now())
    .then((res) => {
      if (!res.ok) throw new Error('Failed to fetch photos');
      return res.json();
    })
    .then((data) => {
      const photos = sortPhotos(photoList(data)).filter((photo) => safeImage(photo.image));
      if (!photos.length) {
        gallery.hidden = true;
        gallery.innerHTML = '';
        gallery.dataset.state = 'empty';
        return;
      }
      gallery.hidden = false;
      gallery.dataset.state = 'ready';
      gallery.innerHTML = photos.map((photo) => {
        const caption = String(photo.caption || '').trim();
        const by = String(photo.submittedBy || '').trim();
        const alt = caption || (by ? 'Photo by ' + by : 'Community photo');
        const captionHtml = caption ? `<p class="photo-caption">${esc(caption)}</p>` : '';
        const creditHtml = by ? `<p class="photo-credit">Photo: ${esc(by)}</p>` : '';
        const figcaption = (captionHtml || creditHtml)
          ? `<figcaption>${captionHtml}${creditHtml}</figcaption>`
          : '';
        return `
          <figure class="photo-card">
            <div class="photo-frame">
              <img src="${esc(safeImage(photo.image))}" alt="${esc(alt)}" loading="lazy" decoding="async">
            </div>
            ${figcaption}
          </figure>`;
      }).join('');
    })
    .catch((error) => {
      console.error('Could not load photos.json', error);
      gallery.hidden = true;
      gallery.innerHTML = '';
      gallery.dataset.state = 'empty';
    });
});
