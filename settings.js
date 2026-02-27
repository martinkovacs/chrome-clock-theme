/**
 * Settings module – loads/saves settings from chrome.storage.local and
 * manages the settings panel UI.
 */
const Settings = (() => {
  const DEFAULTS = {
    clockFormat: '24h',
    showSeconds: true,
    clockFont: "'Segoe UI', system-ui, sans-serif",
    clockSize: 96,
    clockColor: '#ffffff',
    dateFormat: 'long',
    city: '',
    lat: null,
    lon: null,
    tempUnit: 'celsius',
    bgMode: 'auto',
    bgImage: '',
    bgColor: '#1a1a2e',
  };

  async function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(DEFAULTS, (data) => resolve({ ...DEFAULTS, ...data }));
    });
  }

  async function save(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, resolve);
    });
  }

  /* ── UI bindings ───────────────────────────────── */

  // Pending location from city search (lat/lon stored here until Save)
  let pendingLat = null;
  let pendingLon = null;
  let pendingCity = '';

  function populateUI(settings) {
    document.getElementById('setting-clock-format').value = settings.clockFormat;
    document.getElementById('setting-show-seconds').checked = settings.showSeconds;
    document.getElementById('setting-clock-font').value = settings.clockFont;
    document.getElementById('setting-clock-size').value = settings.clockSize;
    document.getElementById('clock-size-val').textContent = settings.clockSize + 'px';
    document.getElementById('setting-clock-color').value = settings.clockColor;
    document.getElementById('setting-date-format').value = settings.dateFormat;
    document.getElementById('setting-temp-unit').value = settings.tempUnit;
    document.getElementById('setting-bg-mode').value = settings.bgMode;
    document.getElementById('setting-bg-color').value = settings.bgColor;

    // City search
    document.getElementById('setting-city-search').value = '';
    document.getElementById('city-results').classList.add('hidden');
    pendingLat = settings.lat;
    pendingLon = settings.lon;
    pendingCity = settings.city || '';

    const selectedEl = document.getElementById('city-selected');
    const nameEl = document.getElementById('city-selected-name');
    if (pendingCity) {
      nameEl.textContent = pendingCity;
      selectedEl.classList.remove('hidden');
    } else {
      selectedEl.classList.add('hidden');
    }

    toggleBgSubPanels(settings.bgMode);
  }

  function readUI() {
    return {
      clockFormat: document.getElementById('setting-clock-format').value,
      showSeconds: document.getElementById('setting-show-seconds').checked,
      clockFont: document.getElementById('setting-clock-font').value,
      clockSize: parseInt(document.getElementById('setting-clock-size').value, 10),
      clockColor: document.getElementById('setting-clock-color').value,
      dateFormat: document.getElementById('setting-date-format').value,
      city: pendingCity,
      lat: pendingLat,
      lon: pendingLon,
      tempUnit: document.getElementById('setting-temp-unit').value,
      bgMode: document.getElementById('setting-bg-mode').value,
      bgImage: selectedBgImage,
      bgColor: document.getElementById('setting-bg-color').value,
    };
  }

  let selectedBgImage = '';

  function toggleBgSubPanels(mode) {
    const pickerArea = document.getElementById('bg-picker-area');
    const colorLabel = document.getElementById('bg-color-label');
    pickerArea.classList.toggle('hidden', mode !== 'pick');
    colorLabel.classList.toggle('hidden', mode !== 'solid');
  }

  function renderThumbs(images, current) {
    const container = document.getElementById('bg-thumbs');
    const noImages = document.getElementById('bg-no-images');
    container.innerHTML = '';

    if (images.length === 0) {
      noImages.classList.remove('hidden');
      return;
    }

    noImages.classList.add('hidden');
    selectedBgImage = current && images.includes(current) ? current : images[0];

    images.forEach((filename) => {
      const img = document.createElement('img');
      img.className = 'thumb' + (filename === selectedBgImage ? ' selected' : '');
      img.src = chrome.runtime.getURL('backgrounds/' + filename);
      img.alt = filename;
      img.title = filename;
      img.addEventListener('click', () => {
        container.querySelectorAll('.thumb').forEach((t) => t.classList.remove('selected'));
        img.classList.add('selected');
        selectedBgImage = filename;
      });
      container.appendChild(img);
    });
  }

  /* ── City search ──────────────────────────────── */

  let searchTimer = null;

  function setupCitySearch() {
    const input = document.getElementById('setting-city-search');
    const resultsEl = document.getElementById('city-results');

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const query = input.value.trim();
      if (query.length < 2) {
        resultsEl.classList.add('hidden');
        return;
      }
      // Debounce 400ms
      searchTimer = setTimeout(async () => {
        const results = await Weather.searchCity(query);
        resultsEl.innerHTML = '';
        if (results.length === 0) {
          resultsEl.classList.add('hidden');
          return;
        }
        results.forEach((r) => {
          const div = document.createElement('div');
          div.className = 'city-result-item';
          div.textContent = r.display_name;
          div.addEventListener('click', () => {
            pendingLat = r.lat;
            pendingLon = r.lon;
            pendingCity = r.name || r.display_name.split(',')[0];
            input.value = '';
            resultsEl.classList.add('hidden');
            document.getElementById('city-selected-name').textContent = pendingCity;
            document.getElementById('city-selected').classList.remove('hidden');
          });
          resultsEl.appendChild(div);
        });
        resultsEl.classList.remove('hidden');
      }, 400);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#city-search-wrap')) {
        resultsEl.classList.add('hidden');
      }
    });
  }

  function bindEvents(onSave) {
    // Open / close
    document.getElementById('settings-btn').addEventListener('click', async () => {
      const settings = await load();
      populateUI(settings);
      const images = Background.getImageList();
      renderThumbs(images, settings.bgImage);
      document.getElementById('settings-panel').classList.remove('hidden');
    });

    document.getElementById('settings-close').addEventListener('click', () => {
      document.getElementById('settings-panel').classList.add('hidden');
    });

    // Close on backdrop click
    document.getElementById('settings-panel').addEventListener('click', (e) => {
      if (e.target === document.getElementById('settings-panel')) {
        document.getElementById('settings-panel').classList.add('hidden');
      }
    });

    // Range label
    document.getElementById('setting-clock-size').addEventListener('input', (e) => {
      document.getElementById('clock-size-val').textContent = e.target.value + 'px';
    });

    // Background mode toggle
    document.getElementById('setting-bg-mode').addEventListener('change', (e) => {
      toggleBgSubPanels(e.target.value);
    });

    // City search
    setupCitySearch();

    // Save
    document.getElementById('btn-save-settings').addEventListener('click', async () => {
      const settings = readUI();
      await save(settings);
      document.getElementById('settings-panel').classList.add('hidden');
      if (typeof onSave === 'function') onSave(settings);
    });
  }

  return { load, save, bindEvents, DEFAULTS };
})();
