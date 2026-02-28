/**
 * App entry point – lean critical path, then deferred loading.
 *
 * Background.init() fires at background.js parse time — speculatively
 * loads the image list + pre-fetches a random image in parallel with
 * the remaining JS parsing and Settings.load().
 *
 * Critical path (before first paint):
 *   Background.init() ─┐
 *   Settings.load() ───┴→ Background.apply → Clock.start → reveal
 *
 * Deferred (after reveal):
 *   World clocks, weather.js (dynamic load), settings panel binding
 */
(async () => {
  // Clean up stale background cache entries from previous versions
  try { localStorage.removeItem('cachedBg'); localStorage.removeItem('cachedBgSolid'); } catch (e) {}

  const settings = await Settings.load();

  await Background.apply(settings);

  // Main clock only (world clocks deferred)
  Clock.start(settings);

  // Reveal — background and main clock are ready
  document.body.classList.remove('loading');

  // --- Deferred: world clocks, weather, settings panel ---

  Clock.startWorldClocks(settings);

  // Load weather.js dynamically, then start weather
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  loadScript('weather.js').then(() => {
    Weather.update(settings);
    setInterval(() => {
      Settings.load().then((s) => Weather.update(s));
    }, 5 * 60 * 1000);
  });

  // Bind settings panel
  Settings.bindEvents((newSettings) => {
    Clock.start(newSettings);
    Clock.startWorldClocks(newSettings);
    Background.apply(newSettings);
    if (typeof Weather !== 'undefined') Weather.update(newSettings);
  });
})();
