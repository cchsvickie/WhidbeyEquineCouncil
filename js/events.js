// =============================================
// COMMUNITY ACTIVITIES PAGE – Whidbey Island Horse Council
// Activities come from data/events.json.
// The Meetings card comes from data/meetings.json (the same file the Meetings page uses),
// so the next meeting only has to be updated in one place.
//
// events.json date tips:
//   "2026-12-05"  -> shown until that day has passed
//   "2100-01-01"  -> shown as "Dates coming soon"
//   "ongoing"     -> always shown, labeled "Ongoing"
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const categoryRow = document.getElementById('category-row');
  const eventsContainer = document.getElementById('events-container');
  const noEventsMsg = document.getElementById('no-events');

  // Filter "bubbles", always shown in this order
  const CATEGORIES = ['All', 'Community Activities', 'Meetings', 'Shows/Clinics'];
  // Older category names still used in events.json are mapped to the new ones
  const CATEGORY_ALIASES = {
    'Community Involvement': 'Community Activities',
    'Rides, Shows and Clinics': 'Shows/Clinics',
    'Shows and Clinics': 'Shows/Clinics',
    'Meeting': 'Meetings'
  };

  let allEvents = [];
  let activeCategory = 'All';

  // Items without a real date ("coming soon", "ongoing") are listed after dated ones,
  // grouped in the bubble order above, then in the order they appear in events.json.
  const UNDATED = new Date(2098, 0, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function normalizeCategory(cat) {
    const c = String(cat || '').trim();
    return CATEGORY_ALIASES[c] || c || 'Community Activities';
  }

  function catIndex(cat) {
    const i = CATEGORIES.indexOf(cat);
    return i === -1 ? CATEGORIES.length : i;
  }

  function parseLocalDate(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  // meetings.json dates are written for people ("Wednesday, November 4, 2026"),
  // which iPhone Safari will not parse with new Date(). Read them directly.
  function parseLooseDate(str) {
    const s = String(str || '').trim();
    const iso = parseLocalDate(s);
    if (iso) return iso;
    const months = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
      sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
    };
    const cleaned = s.replace(/^[A-Za-z]+,\s*/, '');
    const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(cleaned);
    if (!m || months[m[1].toLowerCase()] == null) return null;
    const day = Number(m[2]);
    const date = new Date(Number(m[3]), months[m[1].toLowerCase()], day);
    if (date.getMonth() !== months[m[1].toLowerCase()] || date.getDate() !== day) return null;
    return date;
  }

  async function loadMeetingCard() {
    try {
      const res = await fetch('data/meetings.json?v=' + Date.now());
      if (!res.ok) return null;
      const data = await res.json();
      const next = data.nextMeeting || {};
      const parsed = parseLooseDate(next.date);
      const upcoming = parsed && parsed >= today;
      return {
        category: 'Meetings',
        title: 'Whidbey Island Horse Council Monthly Meeting',
        dateLabel: upcoming ? next.date : 'See the Meetings page for the next date',
        sortDate: upcoming ? parsed : UNDATED,
        order: 9999,
        time: upcoming ? (next.time || '') : '',
        desc: 'Everyone is welcome. Join us in person or on Zoom. The Meetings page has the agenda, Zoom link and past minutes.',
        location: next.location || '',
        price: 'Free',
        url: 'monthly-meetings.html',
        sameTab: true,
        linkText: 'Meeting Details'
      };
    } catch (e) {
      console.error('Could not load meetings.json', e);
      return null;
    }
  }

  async function loadEvents() {
    try {
      const response = await fetch('data/events.json?v=' + Date.now());
      if (!response.ok) throw new Error('Failed to fetch JSON');
      const raw = await response.json();

      allEvents = raw.map((e, idx) => {
        const dateStr = String(e.date || '').trim();
        const d = parseLocalDate(dateStr);
        let dateLabel = '';
        let sortDate = d;
        let show = true;
        if (dateStr.toLowerCase() === 'ongoing' || dateStr === '') {
          dateLabel = 'Ongoing';
          sortDate = UNDATED;
        } else if (dateStr.startsWith('2100')) {
          dateLabel = '<span class="coming-soon">Dates coming soon</span>';
        } else if (d) {
          dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          show = d >= today;
        }
        const url = String(e.registerUrl || '').trim();
        return {
          category: normalizeCategory(e.category),
          title: e.title || '',
          dateLabel,
          sortDate: sortDate && !dateStr.startsWith('2100') ? sortDate : UNDATED,
          order: idx,
          time: String(e.time || '').trim(),
          desc: e.desc || '',
          location: String(e.location || '').trim(),
          price: e.price || '',
          url: url && url !== '#' ? url : '',
          sameTab: false,
          linkText: 'More Details',
          show
        };
      }).filter(e => e.show);

      const meeting = await loadMeetingCard();
      if (meeting) allEvents.push(meeting);

      renderCategoryButtons();
      filterAndRenderEvents();
    } catch (error) {
      console.error('Failed to load events.json', error);
      eventsContainer.innerHTML = `
        <div class="text-center py-12 text-red-600">
          <p>Could not load community activities. Please try again later.</p>
        </div>`;
    }
  }

  function renderCategoryButtons() {
    const extra = [...new Set(allEvents.map(e => e.category))].filter(c => !CATEGORIES.includes(c));
    const categories = [...CATEGORIES, ...extra];
    categoryRow.innerHTML = categories.map(cat => `
      <button type="button" data-category="${cat}"
              class="category-btn ${activeCategory === cat ? 'active' : ''}">
        ${cat}
      </button>
    `).join('');
    categoryRow.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => window.filterCategory(btn.dataset.category));
    });
  }

  function filterAndRenderEvents() {
    let filtered = activeCategory === 'All'
      ? allEvents.slice()
      : allEvents.filter(e => e.category === activeCategory);

    filtered.sort((a, b) =>
      (a.sortDate - b.sortDate) ||
      (catIndex(a.category) - catIndex(b.category)) ||
      (a.order - b.order));

    eventsContainer.innerHTML = '';

    if (filtered.length === 0) {
      noEventsMsg.classList.remove('hidden');
      noEventsMsg.style.display = 'block';
      return;
    }
    noEventsMsg.classList.add('hidden');
    noEventsMsg.style.display = 'none';

    eventsContainer.innerHTML = filtered.map(event => {
      const button = event.url
        ? `<a href="${encodeURI(decodeURI(event.url))}" class="btn-register"${event.sameTab ? '' : ' target="_blank" rel="noopener noreferrer"'}>
             ${event.linkText} <i class="fa-solid fa-arrow-right"></i>
           </a>`
        : '';
      const meta = [
        event.dateLabel ? `<div class="meta-item"><i class="fa-solid fa-calendar"></i><span class="meta-date">${event.dateLabel}</span></div>` : '',
        event.time ? `<div class="meta-item"><i class="fa-solid fa-clock"></i><span class="meta-time">${event.time}</span></div>` : '',
        event.location ? `<div class="meta-item"><i class="fa-solid fa-location-dot"></i><span class="meta-location">${event.location}</span></div>` : ''
      ].join('');
      return `
        <div class="event-card">
          <div class="event-header">
            <span class="event-category">${event.category}</span>
            <span class="event-price">${event.price}</span>
          </div>
          <h3 class="event-title">${event.title}</h3>
          <p class="event-desc">${event.desc}</p>
          <div class="event-meta">${meta}</div>
          <div class="event-footer">${button}</div>
        </div>`;
    }).join('');
  }

  window.filterCategory = function (category) {
    activeCategory = category;
    renderCategoryButtons();
    filterAndRenderEvents();
  };

  loadEvents();
});
