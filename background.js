/**
 * Background manager – handles background image loading and selection.
 *
 * Because Chrome extensions can't dynamically list directory contents,
 * a manifest file (backgrounds/images.json) is used. Users should update
 * this file with the filenames of images they place in backgrounds/.
 *
 * images.json format: ["photo1.jpg", "photo2.png", "wallpaper.webp"]
 */
const Background = (() => {
  let imageList = [];

  async function loadImageList() {
    try {
      const url = chrome.runtime.getURL('backgrounds/images.json');
      const res = await fetch(url);
      if (!res.ok) return [];
      const list = await res.json();
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
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
