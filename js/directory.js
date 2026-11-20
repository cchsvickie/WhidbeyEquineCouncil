// =============================================
// WHIDBEY EQUINE DIRECTORY
// Cards come from data/directory.json (approved listings that consented to
// be public). Categories come from data/categories.json.
// See MAINTAINING.md. The page does not embed an Airtable shared view.
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('directory-grid');
  const filters = document.getElementById('directory-filters');
  const search = document.getElementById('directory-search');
  const status = document.getElementById('directory-status');
  if (!grid || !filters || !search || !status) return;

  let records = [];
  let categories = [];
  let activeCategory = 'All';
  let ready = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function telHref(phone) {
    const raw = clean(phone);
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (raw.startsWith('+')) return 'tel:+' + digits;
    if (digits.length === 10) return 'tel:+1' + digits;
    if (digits.length === 11 && digits.startsWith('1')) return 'tel:+' + digits;
    return 'tel:+' + digits;
  }

  function mailtoHref(email) {
    const value = clean(email);
    if (!value || value.indexOf('@') === -1 || /[\r\n<>"]/.test(value)) return '';
    return 'mailto:' + encodeURIComponent(value).replace(/%40/g, '@');
  }

  function servicesOf(record) {
    const list = Array.isArray(record.services) ? record.services : [];
    return list.map(clean).filter(Boolean);
  }

  function inCategory(record, category) {
    if (!category || category.name === 'All') return true;
    const wanted = new Set((category.services || []).map((name) => clean(name)));
    return servicesOf(record).some((name) => wanted.has(name));
  }

  function matchesSearch(record, query) {
    if (!query) return true;
    const hay = [record.name, record.contactName].concat(servicesOf(record))
      .map(clean)
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function categoryCount(category) {
    return records.filter((record) => inCategory(record, category)).length;
  }

  function renderFilters() {
    const buttons = [{ name: 'All', services: [] }].concat(categories);
    filters.innerHTML = buttons.map((category) => {
      const count = category.name === 'All' ? records.length : categoryCount(category);
      const empty = category.name !== 'All' && count === 0;
      const pressed = category.name === activeCategory;
      return `
        <button type="button" class="category-btn${pressed ? ' active' : ''}${empty ? ' is-empty' : ''}"
                data-category="${esc(category.name)}"
                aria-pressed="${pressed ? 'true' : 'false'}"
                ${empty ? 'disabled aria-disabled="true" title="No listings in this category yet"' : ''}>
          ${esc(category.name)}
        </button>`;
    }).join('');
    filters.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        activeCategory = button.getAttribute('data-category') || 'All';
        renderFilters();
        renderCards();
      });
    });
  }

  function renderCards() {
    const query = clean(search.value).toLowerCase();
    const category = activeCategory === 'All'
      ? { name: 'All', services: [] }
      : (categories.find((item) => item.name === activeCategory) || { name: activeCategory, services: [] });
    const shown = records.filter((record) => inCategory(record, category) && matchesSearch(record, query));

    let message = shown.length === 1 ? 'Showing 1 listing' : `Showing ${shown.length} listings`;
    if (activeCategory !== 'All') message += ` in ${activeCategory}`;
    if (query) message += ` matching “${clean(search.value)}”`;
    status.textContent = shown.length
      ? message + '.'
      : 'No listings match that search or category.';

    if (!shown.length) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = shown.map((record) => {
      const name = clean(record.name);
      const contact = clean(record.contactName);
      const services = servicesOf(record);
      const phone = clean(record.phone);
      const email = clean(record.email);
      const phoneHref = telHref(phone);
      const emailHref = mailtoHref(email);
      const pills = services.length
        ? `<ul class="service-pills">${services.map((service) => `<li class="service-pill">${esc(service)}</li>`).join('')}</ul>`
        : '';
      const contactHtml = contact ? `<p class="contact-name">${esc(contact)}</p>` : '';
      const phoneHtml = phone
        ? (phoneHref
          ? `<a href="${esc(phoneHref)}">${esc(phone)}</a>`
          : `<span>${esc(phone)}</span>`)
        : '';
      const emailHtml = email
        ? (emailHref
          ? `<a href="${esc(emailHref)}">${esc(email)}</a>`
          : `<span>${esc(email)}</span>`)
        : '';
      const meta = (phoneHtml || emailHtml)
        ? `<div class="meta">${phoneHtml}${emailHtml}</div>`
        : '';
      return `
        <article class="directory-card">
          <h3>${esc(name)}</h3>
          ${contactHtml}
          ${pills}
          ${meta}
        </article>`;
    }).join('');
  }

  Promise.all([
    fetch('data/directory.json?v=' + Date.now()).then((res) => {
      if (!res.ok) throw new Error('Failed to fetch directory');
      return res.json();
    }),
    fetch('data/categories.json?v=' + Date.now()).then((res) => {
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    })
  ]).then(([directory, categoryFile]) => {
    const rows = directory && Array.isArray(directory.records) ? directory.records : [];
    records = rows.slice().sort((a, b) => clean(a.name).localeCompare(clean(b.name), undefined, { sensitivity: 'base' }));
    const list = categoryFile && Array.isArray(categoryFile.categories) ? categoryFile.categories : [];
    categories = list.filter((category) => category && clean(category.name));
    ready = true;
    renderFilters();
    renderCards();
  }).catch((error) => {
    console.error('Could not load the directory', error);
    status.textContent = 'The directory could not be loaded. Please try again later.';
    grid.innerHTML = '';
  });

  search.addEventListener('input', () => {
    if (ready) renderCards();
  });
});
