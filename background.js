/**
 * Background manager – handles background image loading and selection.
 *
 * Uses chrome.runtime.getPackageDirectoryEntry to auto-discover all
 * image files in the backgrounds/ folder. No manifest file needed —
 * just drop images in and they'll appear automatically.
 *
 * On parse, init() fires immediately — speculatively loading the image
 * list and pre-fetching a random bundled image as a blob, plus starting
 * the custom-dir IDB read. All of this runs in parallel with the
 * remaining JS parsing and Settings.load(), so by the time apply() is
 * called the image is likely already fetched.
 */
const Background = (() => {
  const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
  let imageList = [];
  let currentImage = null;
  let currentBlobUrl = null;

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

  /* ── Speculative preload state ────────────────────── */

  let imageListPromise = null;
  let speculativeResult = null;   // Promise<{ filename, blobUrl } | null>
  let customDirPromise = null;    // Promise<string[]>

  function init() {
    // Start loading bundled image list immediately
    imageListPromise = loadImageList();

    // Once the list is ready, speculatively fetch a random image as a blob
    speculativeResult = imageListPromise.then((list) => {
      if (list.length === 0) return null;
      const idx = Math.floor(Math.random() * list.length);
      const filename = list[idx];
      const url = chrome.runtime.getURL('backgrounds/' + filename);
      return fetch(url)
        .then((res) => res.blob())
        .then((blob) => ({ filename, blobUrl: URL.createObjectURL(blob) }));
    }).catch(() => null);

    // Start loading custom-dir images from IDB
    customDirPromise = ImageStore.load('customDirImages')
      .then((images) => images || [])
      .catch(() => []);
  }

  /* ── Apply helpers ───────────────────────────────── */

  function setBg(blobOrDataUrl) {
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = blobOrDataUrl;
    document.body.style.backgroundImage = `url("${blobOrDataUrl}")`;
  }

  async function fetchAndApplyImage(filename) {
    const url = chrome.runtime.getURL('backgrounds/' + filename);
    const res = await fetch(url);
    const blob = await res.blob();
    setBg(URL.createObjectURL(blob));
  }

  function applySolid(color) {
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = color || '#252629';
  }

  async function applyDataUrl(url) {
    // Data URLs are already in memory — just set CSS directly
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
    document.body.style.backgroundImage = `url("${url}")`;
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
      if (settings.bgCustomImage) {
        await applyDataUrl(settings.bgCustomImage);
      } else {
        applySolid(settings.bgColor);
      }
      return;
    }

    if (settings.bgMode === 'custom-dir') {
      const images = customDirPromise ? await customDirPromise : ((await ImageStore.load('customDirImages')) || []);
      if (images.length === 0) {
        currentImage = null;
        applySolid(settings.bgColor);
        return;
      }

      // Within-session re-apply (settings save): keep current image
      if (currentImage && images.includes(currentImage)) {
        return;
      }

      const idx = Math.floor(Math.random() * images.length);
      currentImage = images[idx];
      await applyDataUrl(currentImage);
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

      // Use speculative preload if available
      if (speculativeResult) {
        const preloaded = await speculativeResult;
        speculativeResult = null; // consume once
        if (preloaded && imageList.includes(preloaded.filename)) {
          currentImage = preloaded.filename;
          setBg(preloaded.blobUrl);
          return;
        }
      }

      // Fallback: fetch on demand
      const idx = Math.floor(Math.random() * imageList.length);
      currentImage = imageList[idx];
      await fetchAndApplyImage(currentImage);
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
        setBg(preloaded.blobUrl);
        return;
      }
    }

    currentImage = target;
    await fetchAndApplyImage(currentImage);
  }

  function getImageList() {
    return imageList;
  }

  // Auto-initialize: start loading immediately (runs while clock.js,
  // settings.js, and app.js are still parsing)
  init();

  return { apply, getImageList, loadImageList };
})();
