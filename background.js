/**
 * Background manager – handles background image loading and selection.
 *
 * Uses chrome.runtime.getPackageDirectoryEntry to auto-discover all
 * image files in the backgrounds/ folder. No manifest file needed —
 * just drop images in and they'll appear automatically.
 */
const Background = (() => {
  const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
  let imageList = [];
  let currentImage = null;

  function isImage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }

  function loadImageList() {
    return new Promise((resolve) => {
      if (!chrome.runtime.getPackageDirectoryEntry) {
        resolve([]);
        return;
      }

      chrome.runtime.getPackageDirectoryEntry((root) => {
        root.getDirectory('backgrounds', {}, (dir) => {
          const reader = dir.createReader();
          const files = [];

          // readEntries may return results in batches, so read until empty
          function readBatch() {
            reader.readEntries((entries) => {
              if (entries.length === 0) {
                resolve(files.sort());
                return;
              }
              entries.forEach((entry) => {
                if (entry.isFile && isImage(entry.name)) {
                  files.push(entry.name);
                }
              });
              readBatch();
            }, () => resolve(files.sort()));
          }

          readBatch();
        }, () => resolve([]));
      });
    });
  }

  /* ── Cache helpers ──────────────────────────────── */
  // Cache the background so the next new-tab can display it instantly
  // from localStorage (short URLs) or IndexedDB (data URLs).
  // Deterministic modes cache the current state; random modes (auto,
  // custom-dir) cache the NEXT pre-picked image so there is no
  // double-swap — the cached image IS the intended image.

  function cacheBg(url) {
    try {
      if (url && url.startsWith('data:')) {
        localStorage.setItem('cachedBg', 'idb');
        localStorage.removeItem('cachedBgSolid');
        ImageStore.save('cachedBg', url);
      } else if (url) {
        localStorage.setItem('cachedBg', url);
        localStorage.removeItem('cachedBgSolid');
      }
    } catch (e) {}
  }

  function cacheSolid(color) {
    try {
      localStorage.removeItem('cachedBg');
      localStorage.setItem('cachedBgSolid', color);
    } catch (e) {}
  }

  /* ── Apply helpers ───────────────────────────────── */

  function preloadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = url;
    });
  }

  async function applyImage(filename) {
    const url = chrome.runtime.getURL('backgrounds/' + filename);
    await preloadImage(url);
    document.body.style.backgroundImage = `url("${url}")`;
    cacheBg(url);
  }

  function applySolid(color) {
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = color || '#252629';
    cacheSolid(color || '#252629');
  }

  async function applyUrl(url) {
    await preloadImage(url);
    document.body.style.backgroundImage = `url("${url}")`;
    cacheBg(url);
  }

  /* ── Pre-pick helper ─────────────────────────────── */
  // After displaying the current random image, pre-pick and cache
  // the NEXT one so the following new-tab shows it instantly (0ms).
  // For bundled images the URL is also preloaded into browser cache.

  function prepickNext(items, current, toUrl) {
    if (items.length === 0) return;
    let next;
    if (items.length === 1) {
      next = items[0];
    } else {
      do {
        next = items[Math.floor(Math.random() * items.length)];
      } while (next === current);
    }
    if (toUrl) {
      // Bundled image: preload into browser cache, then save URL
      const url = toUrl(next);
      preloadImage(url).then(() => cacheBg(url));
    } else {
      // Data URL: save to IDB for next load
      cacheBg(next);
    }
  }

  async function apply(settings) {
    imageList = await loadImageList();

    if (settings.bgMode === 'solid') {
      currentImage = null;
      applySolid(settings.bgColor);
      return;
    }

    if (settings.bgMode === 'custom-image') {
      currentImage = null;
      if (settings.bgCustomImage) {
        await applyUrl(settings.bgCustomImage);
      } else {
        applySolid(settings.bgColor);
      }
      return;
    }

    if (settings.bgMode === 'custom-dir') {
      const images = (await ImageStore.load('customDirImages')) || [];
      if (images.length === 0) {
        currentImage = null;
        applySolid(settings.bgColor);
        return;
      }

      // Within-session re-apply (settings save): keep current image
      if (currentImage && images.includes(currentImage)) {
        return;
      }

      // New tab: use pre-picked cached image if valid, else pick random
      try {
        const marker = localStorage.getItem('cachedBg');
        if (marker === 'idb') {
          const cachedUrl = await ImageStore.load('cachedBg');
          if (cachedUrl && images.includes(cachedUrl)) {
            currentImage = cachedUrl;
          }
        }
      } catch (e) {}

      if (!currentImage || !images.includes(currentImage)) {
        const idx = Math.floor(Math.random() * images.length);
        currentImage = images[idx];
      }

      // Always apply (resolves instantly if app.js early load already set it)
      await applyUrl(currentImage);
      prepickNext(images, currentImage);
      return;
    }

    if (imageList.length === 0) {
      currentImage = null;
      applySolid(settings.bgColor);
      return;
    }

    if (settings.bgMode === 'auto') {
      // Within-session re-apply (settings save): keep current image
      if (currentImage && imageList.includes(currentImage)) {
        return;
      }

      // New tab: use pre-picked cached image if valid, else pick random
      try {
        const cached = localStorage.getItem('cachedBg');
        if (cached && cached !== 'idb') {
          const prefix = chrome.runtime.getURL('backgrounds/');
          if (cached.startsWith(prefix)) {
            const filename = cached.slice(prefix.length);
            if (imageList.includes(filename)) {
              currentImage = filename;
            }
          }
        }
      } catch (e) {}

      if (!currentImage) {
        const idx = Math.floor(Math.random() * imageList.length);
        currentImage = imageList[idx];
      }

      // Always apply (resolves instantly if inline script already loaded it)
      await applyImage(currentImage);
      // Pre-pick next for future loads (fire-and-forget)
      prepickNext(imageList, currentImage, (f) => chrome.runtime.getURL('backgrounds/' + f));
      return;
    }

    // 'pick' mode
    if (settings.bgImage && imageList.includes(settings.bgImage)) {
      currentImage = settings.bgImage;
      await applyImage(currentImage);
    } else {
      currentImage = imageList[0];
      await applyImage(currentImage);
    }
  }

  function getImageList() {
    return imageList;
  }

  return { apply, getImageList, loadImageList };
})();
