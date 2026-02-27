/**
 * Clock module – renders the main clock/date and mini world clocks.
 */
const Clock = (() => {
  let intervalId = null;

  function pad(n) {
    return n.toString().padStart(2, '0');
  }

  function formatTime(date, settings) {
    const h24 = date.getHours();
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());

    let timeStr;
    if (settings.clockFormat === '12h') {
      const h12 = h24 % 12 || 12;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      timeStr = settings.showSeconds
        ? `${h12}:${m}:${s} ${ampm}`
        : `${h12}:${m} ${ampm}`;
    } else {
      const h = pad(h24);
      timeStr = settings.showSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
    }
    return timeStr;
  }

  function formatTimeForTimezone(date, settings, timezone) {
    const opts = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: settings.clockFormat === '12h',
      timeZone: timezone,
    };
    if (settings.showSeconds) opts.second = '2-digit';
    return date.toLocaleTimeString([], opts);
  }

  function formatDate(date, settings) {
    const fmt = settings.dateFormat || 'long';
    if (fmt === 'long') {
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    if (fmt === 'short') {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    return `${y}-${m}-${d}`;
  }

  let googleFontLink = null;

  function resolveFont(settings) {
    if (settings.clockFont === 'custom' && settings.clockCustomFont) {
      const fontName = settings.clockCustomFont;
      const encoded = encodeURIComponent(fontName);
      const href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@100;200;300;400;500;600;700;800;900&display=swap`;

      if (!googleFontLink) {
        googleFontLink = document.createElement('link');
        googleFontLink.rel = 'stylesheet';
        document.head.appendChild(googleFontLink);
      }
      if (googleFontLink.href !== href) {
        googleFontLink.href = href;
      }
      return `'${fontName}', 'Segoe UI', system-ui, sans-serif`;
    }
    // Remove the link if switching away from custom
    if (googleFontLink) {
      googleFontLink.remove();
      googleFontLink = null;
    }
    return settings.clockFont;
  }

  function applyStyle(settings) {
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    const fontFamily = resolveFont(settings);
    clockEl.style.fontFamily = fontFamily;
    clockEl.style.fontWeight = settings.clockWeight || 300;
    clockEl.style.fontSize = settings.clockSize + 'px';
    clockEl.style.color = settings.clockColor;
    dateEl.style.color = settings.clockColor;
  }

  function tick(settings) {
    const now = new Date();
    document.getElementById('clock').textContent = formatTime(now, settings);
    document.getElementById('date').textContent = formatDate(now, settings);
  }

  /* ── Mini world clocks ─────────────────────────── */

  function renderMiniClocks(settings) {
    const container = document.getElementById('mini-clocks-container');
    container.innerHTML = '';

    const cities = settings.clockCities || [];
    if (cities.length === 0) return;

    cities.forEach((city) => {
      if (!city.timezone) return;

      const block = document.createElement('div');
      block.className = 'mini-clock';

      const cityEl = document.createElement('div');
      cityEl.className = 'mini-clock-city';
      cityEl.textContent = city.city;

      const timeEl = document.createElement('div');
      timeEl.className = 'mini-clock-time';
      timeEl.dataset.timezone = city.timezone;
      timeEl.style.fontFamily = resolveFont(settings);
      timeEl.style.fontWeight = settings.clockWeight || 300;
      timeEl.style.color = settings.clockColor;

      block.appendChild(cityEl);
      block.appendChild(timeEl);
      container.appendChild(block);
    });
  }

  function tickMiniClocks(settings) {
    const now = new Date();
    document.querySelectorAll('.mini-clock-time[data-timezone]').forEach((el) => {
      el.textContent = formatTimeForTimezone(now, settings, el.dataset.timezone);
    });
  }

  function start(settings) {
    if (intervalId) clearInterval(intervalId);
    applyStyle(settings);
    renderMiniClocks(settings);
    tick(settings);
    tickMiniClocks(settings);
    intervalId = setInterval(() => {
      tick(settings);
      tickMiniClocks(settings);
    }, 1000);
  }

  return { start };
})();
