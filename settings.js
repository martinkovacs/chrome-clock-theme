/**
 * Settings module – loads/saves settings from chrome.storage.local and
 * manages the settings side-panel UI with auto-save.
 */
const Settings = (() => {
  const DEFAULTS = {
    clockFormat: '24h',
    showSeconds: true,
    clockFont: "'Segoe UI', system-ui, sans-serif",
    clockCustomFont: '',
    clockSize: 96,
    clockWeight: 300,
    clockColor: '#ffffff',
    dateFormat: 'long',
    clockCities: [],   // [{ city, lat, lon, timezone }, ...] up to 3
    locations: [],     // [{ city, lat, lon }, ...] up to 3
    tempUnit: 'celsius',
    bgMode: 'auto',
    bgImage: '',
    bgCustomImage: '',
    bgCustomDirImages: [],
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
  let pendingClockCities = [];
  let selectedBgImage = '';
  let pendingCustomImage = '';
  let pendingCustomDirImages = [];
  let onSaveCallback = null;
  let autoSaveTimer = null;

  function autoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      const settings = readUI();
      await save(settings);
      if (typeof onSaveCallback === 'function') onSaveCallback(settings);
    }, 200);
  }

  function populateUI(settings) {
    document.getElementById('setting-clock-format').value = settings.clockFormat;
    document.getElementById('setting-show-seconds').checked = settings.showSeconds;
    document.getElementById('setting-clock-font').value = settings.clockFont;
    document.getElementById('setting-clock-custom-font').value = settings.clockCustomFont || '';
    toggleCustomFontInput(settings.clockFont);
    document.getElementById('setting-clock-weight').value = settings.clockWeight;

    document.getElementById('setting-clock-size').value = settings.clockSize;
    document.getElementById('setting-clock-size-num').value = settings.clockSize;

    document.getElementById('setting-clock-color').value = settings.clockColor;
    document.getElementById('setting-date-format').value = settings.dateFormat;
    document.getElementById('setting-temp-unit').value = settings.tempUnit;
    document.getElementById('setting-bg-mode').value = settings.bgMode;
    pendingCustomImage = settings.bgCustomImage || '';
    pendingCustomDirImages = settings.bgCustomDirImages || [];
    updateCustomImagePreview(pendingCustomImage);
    updateCustomDirInfo(pendingCustomDirImages);
    document.getElementById('setting-bg-color').value = settings.bgColor;

    // Weather locations
    pendingLocations = (settings.locations || []).map((l) => ({ ...l }));
    renderLocationChips();
    document.getElementById('setting-city-search').value = '';
    document.getElementById('city-results').classList.add('hidden');

    // Clock cities
    pendingClockCities = (settings.clockCities || []).map((c) => ({ ...c }));
    renderClockCityChips();
    document.getElementById('setting-clock-city-search').value = '';
    document.getElementById('clock-city-results').classList.add('hidden');

    toggleBgSubPanels(settings.bgMode);
  }

  function readUI() {
    return {
      clockFormat: document.getElementById('setting-clock-format').value,
      showSeconds: document.getElementById('setting-show-seconds').checked,
      clockFont: document.getElementById('setting-clock-font').value,
      clockCustomFont: document.getElementById('setting-clock-custom-font').value.trim(),
      clockWeight: parseInt(document.getElementById('setting-clock-weight').value, 10) || 300,
      clockSize: parseInt(document.getElementById('setting-clock-size-num').value, 10) || 96,
      clockColor: document.getElementById('setting-clock-color').value,
      dateFormat: document.getElementById('setting-date-format').value,
      clockCities: pendingClockCities,
      locations: pendingLocations,
      tempUnit: document.getElementById('setting-temp-unit').value,
      bgMode: document.getElementById('setting-bg-mode').value,
      bgImage: selectedBgImage,
      bgCustomImage: pendingCustomImage,
      bgCustomDirImages: pendingCustomDirImages,
      bgColor: document.getElementById('setting-bg-color').value,
    };
  }

  function toggleCustomFontInput(fontValue) {
    document.getElementById('custom-font-label').classList.toggle('hidden', fontValue !== 'custom');
  }

  function toggleBgSubPanels(mode) {
    document.getElementById('bg-picker-area').classList.toggle('hidden', mode !== 'pick');
    document.getElementById('bg-custom-image-area').classList.toggle('hidden', mode !== 'custom-image');
    document.getElementById('bg-custom-dir-area').classList.toggle('hidden', mode !== 'custom-dir');
    document.getElementById('bg-color-label').classList.toggle('hidden', mode !== 'solid');
  }

  function updateCustomImagePreview(dataUrl) {
    const preview = document.getElementById('bg-custom-image-preview');
    if (dataUrl) {
      preview.src = dataUrl;
      preview.classList.add('visible');
      preview.onerror = () => { preview.classList.remove('visible'); };
    } else {
      preview.src = '';
      preview.classList.remove('visible');
    }
  }

  function updateCustomDirInfo(images) {
    const info = document.getElementById('bg-custom-dir-info');
    if (images && images.length > 0) {
      info.textContent = `${images.length} image${images.length === 1 ? '' : 's'} loaded from selected folder.`;
      info.classList.remove('hidden');
    } else {
      info.classList.add('hidden');
    }
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
  function isImageFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
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
      img.src = chrome.runtime.getURL('backgrounds/thumbnails/' + filename);
      img.onerror = () => { img.src = chrome.runtime.getURL('backgrounds/' + filename); };
      img.alt = filename;
      img.title = filename;
      img.addEventListener('click', () => {
        container.querySelectorAll('.thumb').forEach((t) => t.classList.remove('selected'));
        img.classList.add('selected');
        selectedBgImage = filename;
        autoSave();
      });
      container.appendChild(img);
    });
  }

  /* ── Generic chip rendering ────────────────────── */

  function renderChips(listId, addAreaId, items, onRemove) {
    const list = document.getElementById(listId);
    list.innerHTML = '';

    items.forEach((loc, idx) => {
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
      btn.addEventListener('click', () => onRemove(idx));

      chip.appendChild(name);
      chip.appendChild(btn);
      list.appendChild(chip);
    });

    const addArea = document.getElementById(addAreaId);
    addArea.classList.toggle('hidden', items.length >= 3);
  }

  function renderLocationChips() {
    renderChips('locations-list', 'add-location-area', pendingLocations, (idx) => {
      pendingLocations.splice(idx, 1);
      renderLocationChips();
      autoSave();
    });
  }

  function renderClockCityChips() {
    renderChips('clock-cities-list', 'add-clock-city-area', pendingClockCities, (idx) => {
      pendingClockCities.splice(idx, 1);
      renderClockCityChips();
      autoSave();
    });
  }

  /* ── Generic city search ───────────────────────── */

  function setupGenericCitySearch(inputId, resultsId, wrapId, onSelect) {
    const input = document.getElementById(inputId);
    const resultsEl = document.getElementById(resultsId);
    let timer = null;

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const query = input.value.trim();
      if (query.length < 2) {
        resultsEl.classList.add('hidden');
        return;
      }
      timer = setTimeout(async () => {
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
            onSelect(r);
            input.value = '';
            resultsEl.classList.add('hidden');
          });
          resultsEl.appendChild(div);
        });
        resultsEl.classList.remove('hidden');
      }, 400);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#' + wrapId)) {
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
        slider.value = Math.max(
          parseInt(slider.min),
          Math.min(parseInt(slider.max), val)
        );
      }
    });
  }

  /* ── Panel open/close ─────────────────────────── */

  function openPanel() {
    document.getElementById('settings-panel').classList.add('open');
    document.body.classList.add('settings-open');
  }

  function closePanel() {
    document.getElementById('settings-panel').classList.remove('open');
    document.body.classList.remove('settings-open');
  }

  function bindEvents(onSave) {
    onSaveCallback = onSave;

    // Open
    document.getElementById('settings-btn').addEventListener('click', async () => {
      const settings = await load();
      populateUI(settings);
      const images = Background.getImageList();
      renderThumbs(images, settings.bgImage);
      openPanel();
    });

    // Close
    document.getElementById('settings-close').addEventListener('click', closePanel);

    // Close when clicking outside the panel
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('settings-panel');
      if (!panel.classList.contains('open')) return;
      if (!e.target.closest('#settings-panel') && !e.target.closest('#settings-btn')) {
        closePanel();
      }
    });

    // Clock size sync
    setupClockSizeSync();

    // Font family toggle for custom font input
    document.getElementById('setting-clock-font').addEventListener('change', (e) => {
      toggleCustomFontInput(e.target.value);
    });

    // Background mode toggle
    document.getElementById('setting-bg-mode').addEventListener('change', (e) => {
      toggleBgSubPanels(e.target.value);
    });

    // Custom image file picker
    document.getElementById('setting-bg-custom-image-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await readFileAsDataURL(file);
      if (dataUrl) {
        pendingCustomImage = dataUrl;
        updateCustomImagePreview(dataUrl);
        autoSave();
      }
    });

    // Custom directory file picker
    document.getElementById('setting-bg-custom-dir-files').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files).filter(isImageFile);
      if (files.length === 0) return;
      const dataUrls = [];
      for (const file of files) {
        const dataUrl = await readFileAsDataURL(file);
        if (dataUrl) dataUrls.push(dataUrl);
      }
      pendingCustomDirImages = dataUrls;
      updateCustomDirInfo(dataUrls);
      autoSave();
    });

    // Weather city search
    setupGenericCitySearch('setting-city-search', 'city-results', 'city-search-wrap', (r) => {
      if (pendingLocations.length >= 3) return;
      pendingLocations.push({
        city: r.name || r.display_name.split(',')[0],
        lat: r.lat,
        lon: r.lon,
      });
      renderLocationChips();
      autoSave();
    });

    // Clock city search (resolves timezone after selection)
    setupGenericCitySearch('setting-clock-city-search', 'clock-city-results', 'clock-city-search-wrap', async (r) => {
      if (pendingClockCities.length >= 3) return;
      const cityName = r.name || r.display_name.split(',')[0];
      // Add immediately with placeholder, then resolve timezone
      const entry = { city: cityName, lat: r.lat, lon: r.lon, timezone: null };
      pendingClockCities.push(entry);
      renderClockCityChips();

      const tz = await Weather.resolveTimezone(r.lat, r.lon);
      entry.timezone = tz || 'UTC';
      autoSave();
    });

    // Auto-save on any input/change within the settings panel
    const inner = document.getElementById('settings-inner');
    inner.addEventListener('change', autoSave);
    inner.addEventListener('input', autoSave);
  }

  return { load, save, bindEvents, DEFAULTS };
})();
