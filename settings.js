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
    clockWeight: 300,
    clockColor: '#ffffff',
    dateFormat: 'long',
    locations: [],     // [{ city, lat, lon }, ...] up to 3
    tempUnit: 'celsius',
    bgMode: 'auto',
    bgImage: '',
    bgColor: '#1a1a2e',
  };

  async function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(DEFAULTS, (data) => {
        const settings = { ...DEFAULTS, ...data };

        // Migrate old single-location format → locations array
        if ((!settings.locations || settings.locations.length === 0) && settings.lat && settings.lon) {
          settings.locations = [{ city: settings.city || 'Unknown', lat: settings.lat, lon: settings.lon }];
        }
        // Clean up legacy keys
        delete settings.city;
        delete settings.lat;
        delete settings.lon;

        resolve(settings);
      });
    });
  }

  async function save(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, resolve);
    });
  }

  /* ── UI bindings ───────────────────────────────── */

  let pendingLocations = [];

  function populateUI(settings) {
    document.getElementById('setting-clock-format').value = settings.clockFormat;
    document.getElementById('setting-show-seconds').checked = settings.showSeconds;
    document.getElementById('setting-clock-font').value = settings.clockFont;
    document.getElementById('setting-clock-weight').value = settings.clockWeight;

    // Clock size – sync slider and number input
    document.getElementById('setting-clock-size').value = settings.clockSize;
    document.getElementById('setting-clock-size-num').value = settings.clockSize;

    document.getElementById('setting-clock-color').value = settings.clockColor;
    document.getElementById('setting-date-format').value = settings.dateFormat;
    document.getElementById('setting-temp-unit').value = settings.tempUnit;
    document.getElementById('setting-bg-mode').value = settings.bgMode;
    document.getElementById('setting-bg-color').value = settings.bgColor;

    // Locations
    pendingLocations = (settings.locations || []).map((l) => ({ ...l }));
    renderLocationChips();

    // City search
    document.getElementById('setting-city-search').value = '';
    document.getElementById('city-results').classList.add('hidden');

    toggleBgSubPanels(settings.bgMode);
  }

  function readUI() {
    return {
      clockFormat: document.getElementById('setting-clock-format').value,
      showSeconds: document.getElementById('setting-show-seconds').checked,
      clockFont: document.getElementById('setting-clock-font').value,
      clockWeight: parseInt(document.getElementById('setting-clock-weight').value, 10) || 300,
      clockSize: parseInt(document.getElementById('setting-clock-size-num').value, 10) || 96,
      clockColor: document.getElementById('setting-clock-color').value,
      dateFormat: document.getElementById('setting-date-format').value,
      locations: pendingLocations,
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

  /* ── Location management ──────────────────────── */

  function renderLocationChips() {
    const list = document.getElementById('locations-list');
    list.innerHTML = '';

    pendingLocations.forEach((loc, idx) => {
      const chip = document.createElement('div');
      chip.className = 'location-chip';

      const name = document.createElement('span');
      name.className = 'location-chip-name';
      name.textContent = loc.city;

      const btn = document.createElement('button');
      btn.className = 'location-chip-remove';
      btn.type = 'button';
      btn.innerHTML = '&times;';
      btn.title = 'Remove';
      btn.addEventListener('click', () => {
        pendingLocations.splice(idx, 1);
        renderLocationChips();
      });

      chip.appendChild(name);
      chip.appendChild(btn);
      list.appendChild(chip);
    });

    // Hide search if already at 3 locations
    const addArea = document.getElementById('add-location-area');
    addArea.classList.toggle('hidden', pendingLocations.length >= 3);
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
            if (pendingLocations.length >= 3) return;
            pendingLocations.push({
              city: r.name || r.display_name.split(',')[0],
              lat: r.lat,
              lon: r.lon,
            });
            input.value = '';
            resultsEl.classList.add('hidden');
            renderLocationChips();
          });
          resultsEl.appendChild(div);
        });
        resultsEl.classList.remove('hidden');
      }, 400);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#city-search-wrap')) {
        resultsEl.classList.add('hidden');
      }
    });
  }

  /* ── Clock size sync ──────────────────────────── */

  function setupClockSizeSync() {
    const slider = document.getElementById('setting-clock-size');
    const numInput = document.getElementById('setting-clock-size-num');

    slider.addEventListener('input', () => {
      numInput.value = slider.value;
    });

    numInput.addEventListener('input', () => {
      const val = parseInt(numInput.value, 10);
      if (!isNaN(val)) {
        // Clamp slider to its own range, but let number input go beyond
        slider.value = Math.max(
          parseInt(slider.min),
          Math.min(parseInt(slider.max), val)
        );
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

    document.getElementById('settings-panel').addEventListener('click', (e) => {
      if (e.target === document.getElementById('settings-panel')) {
        document.getElementById('settings-panel').classList.add('hidden');
      }
    });

    // Clock size sync
    setupClockSizeSync();

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
