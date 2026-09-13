/** CopyPaste Unlocker - popup UI. Reads and writes the single stored flag. */
(() => {
  'use strict';

  const DEFAULTS = { enabled: true };
  const toggle = document.getElementById('toggle');
  const status = document.getElementById('status');
  const hint = document.getElementById('hint');

  const render = (enabled) => {
    toggle.checked = enabled;
    toggle.disabled = false;
    status.textContent = enabled ? '[ AKTİF ]' : '[ BEKLEMEDE ]';
    hint.textContent = enabled
      ? 'kopyala · yapıştır · kes → serbest'
      : 'site kuralları geçerli — anahtarı aç';
    document.body.classList.toggle('on', enabled);
    document.body.classList.toggle('off', !enabled);
  };

  chrome.storage.local.get(DEFAULTS, (items) => {
    render(chrome.runtime.lastError ? DEFAULTS.enabled : items.enabled !== false);
  });

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    render(enabled);
    chrome.storage.local.set({ enabled });
  });

  // Keep in sync if the state is changed from another window.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) render(changes.enabled.newValue !== false);
  });
})();
