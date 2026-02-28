/**
 * App entry point – wires everything together on page load.
 */
(async () => {
  // Early background for custom modes: data URLs are cached in IndexedDB
  // (too large for localStorage). Load before the full settings/directory
  // scan chain so the user sees a background sooner.
  try {
    if (localStorage.getItem('cachedBg') === 'idb') {
      const cached = await ImageStore.load('cachedBg');
      if (cached) {
        document.body.style.backgroundImage = `url("${cached}")`;
      }
    }
  } catch (e) {}

  const settings = await Settings.load();

  // Apply background (picks a new random image for auto/custom-dir modes)
  await Background.apply(settings);

  // Start clock (this sets the correct time and font before showing)
  Clock.start(settings);

  // Reveal UI now that clock and background are ready
  document.body.classList.remove('loading');

  // Fetch weather
  Weather.update(settings);

  // Refresh weather every 5 minutes (cache prevents redundant API calls)
  setInterval(() => {
    Settings.load().then((s) => Weather.update(s));
  }, 5 * 60 * 1000);

  // Bind settings panel
  Settings.bindEvents((newSettings) => {
    // Re-apply everything with updated settings
    Clock.start(newSettings);
    Weather.update(newSettings);
    Background.apply(newSettings);
  });
})();
