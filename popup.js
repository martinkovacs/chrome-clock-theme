const toggle = document.getElementById('toggle-enabled');

chrome.storage.local.get({ extensionEnabled: true }, (data) => {
  toggle.checked = data.extensionEnabled;
});

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ extensionEnabled: toggle.checked });
});
