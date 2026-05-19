// =============================================
// EVENTS PAGE – Whidbey Island Horse Council
// Coming Soon + fixed dates + Add to Calendar
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const categoryRow = document.getElementById('category-row');
  const eventsContainer = document.getElementById('events-container');
  const noEventsMsg = document.getElementById('no-events');

  let allEvents = [];
  let activeCategory = 'All';

  async function loadEvents() {
    try {
      const response = await fetch('data/events.json?v=' + Date.now());
      if (!response.ok) throw new Error('Failed to fetch JSON');
      
      allEvents = await response.json();
      console.log('✅ Events loaded successfully:', allEvents.length, 'events');
      renderCategoryButtons();
      filterAndRenderEvents();
    } catch (error) {
      console.error('❌ Failed to load events.json →', error);
      eventsContainer.innerHTML = `
        <div class="text-center py-12 text-red-600">
          <p>Could not load events. Make sure data/events.json exists in your repo.</p>
        </div>`;
    }
  }

  function renderCategoryButtons() {
    const categories = ['All', ...new Set(allEvents.map(e => e.category))];
    categoryRow.innerHTML = categories.map(cat => `
      <button onclick="window.filterCategory('${cat}')"
              class="category-btn ${activeCategory === cat ? 'active' : ''}">
        ${cat}
      </button>
    `).join('');
  }

  function formatLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }

  // Helper: Create Google Calendar "Add to Calendar" link
  function getGoogleCalendarUrl(event) {
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.desc + '\n\n' + event.location);
    const location = encodeURIComponent(event.location);
    
    // Convert date + time to Google Calendar format (YYYYMMDDTHHMMSS)
    const dateStr = event.date.replace(/-/g, '');
    let timeStr = event.time.replace(/[^0-9:]/g, '').replace(':', '');
    if (timeStr.length === 4) timeStr += '00'; // e.g. 630 → 183000
    const startTime = timeStr.padStart(6, '0');
    
    // Simple 2-hour duration (you can adjust if needed)
    const endTime = (parseInt(startTime, 10) + 20000).toString().padStart(6, '0');
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
           `&text=${title}` +
           `&dates=${dateStr}T${startTime}/${dateStr}T${endTime}` +
           `&details=${details}` +
           `&location=${location}`;
  }

  function filterAndRenderEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = allEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= today;
    });

    if (activeCategory !== 'All') {
      filtered = filtered.filter(event => event.category === activeCategory);
    }

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    eventsContainer.innerHTML = '';

    if (filtered.length === 0) {
      noEventsMsg.classList.remove('hidden');
      noEventsMsg.style.display = 'block';
    } else {
      noEventsMsg.classList.add('hidden');
      noEventsMsg.style.display = 'none';

      filtered.forEach(event => {
        const rawDate = String(event.date || '').trim();

        let displayDate = '';
        if (rawDate.startsWith('2100')) {
          displayDate = '<span style="color:#f8d48c; font-weight:700;">Coming Soon</span>';
        } else {
          displayDate = formatLocalDate(rawDate);
        }

        const cardHTML = `
          <div class="event-card">
            <div class="event-header">
              <span class="event-category">${event.category}</span>
              <span class="event-price">${event.price}</span>
            </div>
            <h3 class="event-title">${event.title}</h3>
            <p class="event-desc">${event.desc}</p>
            
            <div class="event-meta">
              <div class="meta-item">
                <i class="fa-solid fa-calendar"></i>
                <span class="meta-date">${displayDate}</span>
              </div>
              <div class="meta-item">
                <i class="fa-solid fa-clock"></i>
                <span class="meta-time">${event.time}</span>
              </div>
              <div class="meta-item">
                <i class="fa-solid fa-location-dot"></i>
                <span class="meta-location">${event.location}</span>
              </div>
            </div>

            <div class="event-footer">
              <a href="${event.registerUrl}" class="btn-register" target="_blank" rel="noopener noreferrer">
                Register Now <i class="fa-solid fa-arrow-right"></i>
              </a>
              <a href="${getGoogleCalendarUrl(event)}" class="btn-calendar" target="_blank" rel="noopener noreferrer">
                <i class="fa-solid fa-calendar-plus"></i> Add to Calendar
              </a>
              <a href="#" class="btn-details">More Details</a>
            </div>
          </div>
        `;
        eventsContainer.innerHTML += cardHTML;
      });
    }
  }

  window.filterCategory = function(category) {
    activeCategory = category;
    renderCategoryButtons();
    filterAndRenderEvents();
  };

  loadEvents();
});
