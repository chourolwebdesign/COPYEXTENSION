/**
 * CopyPaste Unlocker - isolated-world bridge.
 *
 * unlock.js has to run in the page's own JavaScript context, where the chrome.*
 * APIs are not available. This script runs in the extension's isolated world,
 * decides whether the unlocker may run - an activated, unexpired licence AND the
 * popup switch turned on - and forwards that decision through DOM events.
 *
 * It makes no network requests: the licence lease is refreshed by the service
 * worker, never per clipboard event.
 */
(() => {
  'use strict';

  const NS = 'copypaste-unlocker';
  const DEFAULTS = { enabled: true, license: null };

  let enabled = DEFAULTS.enabled;
  let license = null;

  const licensed = () =>
    !!license && license.status === 'active' && Date.now() < (license.leaseUntil || 0);

  const publish = () => {
    const on = enabled && licensed();
    window.dispatchEvent(new CustomEvent(`${NS}:${on ? 'enable' : 'disable'}`));
  };

  // unlock.js announces itself if it was injected after this script; the storage
  // read below covers the other order.
  window.addEventListener(`${NS}:ready`, publish, true);

  chrome.storage.local.get(DEFAULTS, (items) => {
    if (!chrome.runtime.lastError) {
      enabled = items.enabled !== false;
      license = items.license || null;
    }
    publish();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    // Applies live, so activating or switching off works without a page reload.
    if (area !== 'local') return;
    if (!changes.enabled && !changes.license) return;
    if (changes.enabled) enabled = changes.enabled.newValue !== false;
    if (changes.license) license = changes.license.newValue || null;
    publish();
  });
})();
