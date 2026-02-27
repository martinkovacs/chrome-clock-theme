/**
 * Clock module – renders time and date into #clock and #date.
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
    // ISO
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    return `${y}-${m}-${d}`;
  }

  function applyStyle(settings) {
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    clockEl.style.fontFamily = settings.clockFont;
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

  function start(settings) {
    if (intervalId) clearInterval(intervalId);
    applyStyle(settings);
    tick(settings);
    intervalId = setInterval(() => tick(settings), 1000);
  }

  return { start };
})();
