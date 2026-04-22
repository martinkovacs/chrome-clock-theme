/**
 * Background manager – handles background image loading and selection.
 *
 * Uses chrome.runtime.getPackageDirectoryEntry to auto-discover all
 * image files in the backgrounds/ folder. No manifest file needed —
 * just drop images in and they'll appear automatically.
 *
 * On parse, init() fires immediately — speculatively loading the image
 * list and pre-fetching a random bundled image via <link rel="preload">,
 * plus starting the custom-dir and custom-image IDB reads. All of this
 * runs in parallel with the remaining JS parsing and Settings.load(),
 * so by the time apply() is called the image is likely already fetched.
 *
 * Custom images are stored as Blobs in IndexedDB and displayed via
 * URL.createObjectURL(), matching how the browser handles native file
 * URLs — no base64 decoding overhead.
 */
const Background = (() => {
  const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
  let imageList = [];
  let currentImage = null;      // filename for bundled images
  let currentCustomBlob = null; // Blob reference for custom-dir within-session tracking
  let currentObjectUrl = null;  // active blob:// URL — revoked when replaced

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

  /* ── Image preloading via <link rel="preload"> ───── */
  // Uses the browser's native preload cache. When CSS background-image
  // later references the same URL, it's served from the preload cache
  // — single network request, no duplicate loads.

  function preloadImage(url) {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.onload = () => { link.remove(); resolve(); };
      link.onerror = () => { link.remove(); resolve(); };
      document.head.appendChild(link);
    });
  }

  /* ── Speculative preload state ────────────────────── */

  let imageListPromise = null;
  let speculativeResult = null;  // Promise<{ filename, url } | null>
  let customDirPromise = null;   // Promise<Blob[]>
  let customImagePromise = null; // Promise<Blob | null>

  function init() {
    // Start loading bundled image list immediately
    imageListPromise = loadImageList();

    // Once the list is ready, speculatively preload a random image
    speculativeResult = imageListPromise.then((list) => {
      if (list.length === 0) return null;
      const idx = Math.floor(Math.random() * list.length);
      const filename = list[idx];
      const url = chrome.runtime.getURL('backgrounds/' + filename);
      return preloadImage(url).then(() => ({ filename, url }));
    }).catch(() => null);

    // Start loading custom images from IDB in parallel
    customImagePromise = ImageStore.load('customImage').catch(() => null);

    customDirPromise = ImageStore.load('customDirImages')
      .then((data) => {
        if (!data || data.length === 0) return [];
        // Migrate old format: array of data URL strings → Blobs
        if (typeof data[0] === 'string') {
          const blobs = data.map(dataUrlToBlob);
          ImageStore.save('customDirImages', blobs);
          return blobs;
        }
        return data;
      })
      .catch(() => []);
  }

  /* ── Apply helpers ───────────────────────────────── */

  async function applyImage(filename) {
    const url = chrome.runtime.getURL('backgrounds/' + filename);
    await preloadImage(url);
    document.body.style.backgroundImage = `url("${url}")`;
  }

  function applySolid(color) {
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = color || '#252629';
  }

  function applyBlob(blob) {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(blob);
    document.body.style.backgroundImage = `url("${currentObjectUrl}")`;
  }

  function dataUrlToBlob(dataUrl) {
    const [header, b64] = dataUrl.split(',');
    const mime = header.split(':')[1].split(';')[0];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function apply(settings) {
    // Use pre-started image list from init() if available
    imageList = imageListPromise ? await imageListPromise : await loadImageList();

    if (settings.bgMode === 'solid') {
      currentImage = null;
      applySolid(settings.bgColor);
      return;
    }

    if (settings.bgMode === 'custom-image') {
      currentImage = null;
      const blob = await (customImagePromise || ImageStore.load('customImage').catch(() => null));
      if (blob instanceof Blob) {
        applyBlob(blob);
      } else if (settings.bgCustomImage) {
        // Migration: old data URL in chrome.storage → convert to Blob, save to IDB
        const migrated = dataUrlToBlob(settings.bgCustomImage);
        ImageStore.save('customImage', migrated);
        applyBlob(migrated);
      } else {
        applySolid(settings.bgColor);
      }
      return;
    }

    if (settings.bgMode === 'custom-dir') {
      const blobs = customDirPromise ? await customDirPromise : ((await ImageStore.load('customDirImages')) || []);
      if (blobs.length === 0) {
        currentImage = null;
        currentCustomBlob = null;
        applySolid(settings.bgColor);
        return;
      }

      // Within-session re-apply (settings save): keep current image
      if (currentCustomBlob && blobs.includes(currentCustomBlob)) {
        return;
      }

      const idx = Math.floor(Math.random() * blobs.length);
      currentCustomBlob = blobs[idx];
      applyBlob(currentCustomBlob);
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

      // Use speculative preload if available (already in browser cache)
      if (speculativeResult) {
        const preloaded = await speculativeResult;
        speculativeResult = null; // consume once
        if (preloaded && imageList.includes(preloaded.filename)) {
          currentImage = preloaded.filename;
          document.body.style.backgroundImage = `url("${preloaded.url}")`;
          return;
        }
      }

      // Fallback: preload + apply on demand
      const idx = Math.floor(Math.random() * imageList.length);
      currentImage = imageList[idx];
      await applyImage(currentImage);
      return;
    }

    // 'pick' mode — check if speculative preload happens to match
    const target = (settings.bgImage && imageList.includes(settings.bgImage))
      ? settings.bgImage
      : imageList[0];

    if (speculativeResult) {
      const preloaded = await speculativeResult;
      speculativeResult = null;
      if (preloaded && preloaded.filename === target) {
        currentImage = target;
        document.body.style.backgroundImage = `url("${preloaded.url}")`;
        return;
      }
    }

    currentImage = target;
    await applyImage(currentImage);
  }

  function getImageList() {
    return imageList;
  }

  // Auto-initialize: start loading immediately (runs while clock.js,
  // settings.js, and app.js are still parsing)
  init();

  return { apply, getImageList, loadImageList };
})();
