// =============================================
// EVENTS PAGE – Whidbey Island Horse Council
// "Coming Soon" support + improved debugging
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const categoryRow = document.getElementById('category-row');
  const eventsContainer = document.getElementById('events-container');
  const noEventsMsg = document.getElementById('no-events');

  let allEvents = [];
  let activeCategory = 'All';

  async function loadEvents() {
    try {
      const response = await fetch('data/events.json?v=' + Date.now()); // force fresh load
      if (!response.ok) throw new Error('Failed to fetch JSON');
      
      allEvents = await response.json();
      console.log('✅ Events loaded successfully:', allEvents.length, 'events');
      console.table(allEvents); // shows full data in console
      renderCategoryButtons();
      filterAndRenderEvents();
    } catch (error) {
      console.error('❌ Failed to load events.json →', error);
      eventsContainer.innerHTML = `<div class="text-center py-12 text-red-600"><p>Could not load events. Make sure data/events.json exists.</p></div>`;
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

    console.log(`📊 Filtered events for "${activeCategory}":`, filtered.length);

    if (filtered.length === 0) {
      noEventsMsg.classList.remove('hidden');
      noEventsMsg.style.display = 'block';
    } else {
      noEventsMsg.classList.add('hidden');
      noEventsMsg.style.display = 'none';

      filtered.forEach(event => {
        const rawDate = event.date;                    // e.g. "2100-01-01"
        const eventDate = new Date(rawDate);
        
        console.log(`🔍 Processing event: "${event.title}" → date: ${rawDate} → year: ${eventDate.getFullYear()}`);

        // === COMING SOON LOGIC (more reliable) ===
        let displayDate = '';
        if (rawDate.startsWith('2100') || eventDate.getFullYear() >= 2100) {
          displayDate = '<span style="color:#f8d48c; font-weight:700;">Coming Soon</span>';
          console.log('   → Showing "Coming Soon"');
        } else {
          displayDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          });
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
              <a href="${event.registerUrl}" class="btn-register">Register Now <i class="fa-solid fa-arrow-right"></i></a>
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

  // Initial load
  loadEvents();
});
