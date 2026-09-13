/**
 * CopyPaste Unlocker - isolated-world bridge.
 *
 * unlock.js has to run in the page's own JavaScript context, where the
 * chrome.* APIs are not available. This script runs in the extension's
 * isolated world, reads the ON/OFF state from chrome.storage and forwards it
 * to unlock.js through DOM events (both worlds share the same DOM).
 */
(() => {
  'use strict';

  const NS = 'copypaste-unlocker';
  const DEFAULTS = { enabled: true };

  let enabled = DEFAULTS.enabled;

  const publish = () => {
    window.dispatchEvent(new CustomEvent(`${NS}:${enabled ? 'enable' : 'disable'}`));
  };

  const apply = (value) => {
    enabled = value !== false;
    publish();
  };

  // If unlock.js is injected after this script, it announces itself and gets
  // the current state; if it was injected first, the storage read below
  // reaches it. Either order ends up consistent.
  window.addEventListener(`${NS}:ready`, publish, true);

  chrome.storage.local.get(DEFAULTS, (items) => {
    // On an unexpected storage error keep the default (ON) rather than failing shut.
    if (chrome.runtime.lastError) return publish();
    apply(items.enabled);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    // Applies live, so the popup toggle works without reloading the page.
    if (area === 'local' && changes.enabled) apply(changes.enabled.newValue);
  });
})();
