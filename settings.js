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

  function populateUI(settings) {
    document.getElementById('setting-clock-format').value = settings.clockFormat;
    document.getElementById('setting-show-seconds').checked = settings.showSeconds;
    document.getElementById('setting-clock-font').value = settings.clockFont;
    document.getElementById('setting-clock-size').value = settings.clockSize;
    document.getElementById('clock-size-val').textContent = settings.clockSize + 'px';
    document.getElementById('setting-clock-color').value = settings.clockColor;
    document.getElementById('setting-date-format').value = settings.dateFormat;
    document.getElementById('setting-city').value = settings.city || '';
    document.getElementById('setting-lat').value = settings.lat ?? '';
    document.getElementById('setting-lon').value = settings.lon ?? '';
    document.getElementById('setting-temp-unit').value = settings.tempUnit;
    document.getElementById('setting-bg-mode').value = settings.bgMode;
    document.getElementById('setting-bg-color').value = settings.bgColor;

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
      city: document.getElementById('setting-city').value.trim(),
      lat: parseFloat(document.getElementById('setting-lat').value) || null,
      lon: parseFloat(document.getElementById('setting-lon').value) || null,
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

    // Geolocate
    document.getElementById('btn-geolocate').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('setting-lat').value = pos.coords.latitude.toFixed(4);
          document.getElementById('setting-lon').value = pos.coords.longitude.toFixed(4);
        },
        (err) => console.warn('Geolocation failed:', err)
      );
    });

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
