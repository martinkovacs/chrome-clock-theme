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

  function applyImage(filename) {
    const url = chrome.runtime.getURL('backgrounds/' + filename);
    document.body.style.backgroundImage = `url("${url}")`;
  }

  function applySolid(color) {
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = color || '#1a1a2e';
  }

  function applyUrl(url) {
    document.body.style.backgroundImage = `url("${url}")`;
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
        applyUrl(settings.bgCustomImage);
      } else {
        applySolid(settings.bgColor);
      }
      return;
    }

    if (settings.bgMode === 'custom-dir') {
      currentImage = null;
      // Custom directory mode uses a file:// URL base path.
      // The user provides a directory; we pick a random image on each page load.
      // Since we can't list directory contents from a file:// path in a Chrome extension,
      // the user must enter the full path. We store it and rely on the user providing
      // a valid directory. We attempt to load via file:// protocol.
      if (settings.bgCustomDir) {
        // Persist the same image across settings saves
        if (!currentImage) {
          // We can't enumerate the directory, so we apply the directory path
          // and let the user set it. For now we just set as-is.
          const dir = settings.bgCustomDir.replace(/\/$/, '');
          applyUrl(`file://${dir}`);
        }
      } else {
        applySolid(settings.bgColor);
      }
      return;
    }

    if (imageList.length === 0) {
      currentImage = null;
      applySolid(settings.bgColor);
      return;
    }

    if (settings.bgMode === 'auto') {
      // Keep the same random image across settings saves;
      // a fresh random pick only happens on page load (currentImage is null).
      if (currentImage && imageList.includes(currentImage)) {
        return;
      }
      const idx = Math.floor(Math.random() * imageList.length);
      currentImage = imageList[idx];
      applyImage(currentImage);
      return;
    }

    // 'pick' mode
    if (settings.bgImage && imageList.includes(settings.bgImage)) {
      currentImage = settings.bgImage;
      applyImage(currentImage);
    } else {
      currentImage = imageList[0];
      applyImage(currentImage);
    }
  }

  function getImageList() {
    return imageList;
  }

  return { apply, getImageList, loadImageList };
})();
