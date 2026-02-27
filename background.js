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

  async function apply(settings) {
    imageList = await loadImageList();

    if (settings.bgMode === 'solid') {
      applySolid(settings.bgColor);
      return;
    }

    if (imageList.length === 0) {
      applySolid(settings.bgColor);
      return;
    }

    if (settings.bgMode === 'auto') {
      const idx = Math.floor(Math.random() * imageList.length);
      applyImage(imageList[idx]);
      return;
    }

    // 'pick' mode
    if (settings.bgImage && imageList.includes(settings.bgImage)) {
      applyImage(settings.bgImage);
    } else {
      applyImage(imageList[0]);
    }
  }

  function getImageList() {
    return imageList;
  }

  return { apply, getImageList, loadImageList };
})();
