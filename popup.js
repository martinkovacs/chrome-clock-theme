const toggle = document.getElementById('toggle-enabled');
const redirectSection = document.getElementById('redirect-section');
const redirectInput = document.getElementById('redirect-url');

chrome.storage.local.get(
  { extensionEnabled: true, disabledRedirectUrl: '' },
  (data) => {
    toggle.checked = data.extensionEnabled;
    redirectInput.value = data.disabledRedirectUrl;
    redirectSection.hidden = data.extensionEnabled;
  }
);

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ extensionEnabled: toggle.checked });
  redirectSection.hidden = toggle.checked;
});

redirectInput.addEventListener('change', () => {
  chrome.storage.local.set({ disabledRedirectUrl: redirectInput.value.trim() });
});
