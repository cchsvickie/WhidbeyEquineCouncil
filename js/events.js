// =============================================
// EVENTS PAGE – Pure HTML/CSS repo friendly
// Admin updates via data/events.json only
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const categoryRow = document.getElementById('category-row');
  const eventsContainer = document.getElementById('events-container');
  const noEventsMsg = document.getElementById('no-events');

  let allEvents = [];
  let activeCategory = 'All';

  async function loadEvents() {
    try {
      const response = await fetch('data/events.json');   // ← change path only if your file structure is different
      allEvents = await response.json();
      renderCategoryButtons();
      filterAndRenderEvents();
    } catch (error) {
      console.error('Failed to load events:', error);
      eventsContainer.innerHTML = `<p class="text-center text-red-600 py-12">Could not load events. Please try again later.</p>`;
    }
  }

  function renderCategoryButtons() {
    const categories = ['All', ...new Set(allEvents.map(e => e.category))];
    
    categoryRow.innerHTML = categories.map(cat => `
      <button 
        onclick="window.filterCategory('${cat}')"
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

    if (filtered.length === 0) {
      noEventsMsg.classList.remove('hidden');
      return;
    }

    noEventsMsg.classList.add('hidden');

    filtered.forEach(event => {
      const eventDate = new Date(event.date);
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });

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
              <span class="meta-date">${formattedDate}</span>
            </div>
            <div class="meta-item">
              <span class="meta-time">${event.time}</span>
            </div>
            <div class="meta-item">
              <span class="meta-location">${event.location}</span>
            </div>
          </div>

          <div class="event-footer">
            <a href="${event.registerUrl}" class="btn-register">Register Now</a>
            <a href="#" class="btn-details">More Details</a>
          </div>
        </div>
      `;
      eventsContainer.innerHTML += cardHTML;
    });
  }

  window.filterCategory = function(category) {
    activeCategory = category;
    renderCategoryButtons();
    filterAndRenderEvents();
  };

  loadEvents();
});
