/**
 * CopyPaste Unlocker - page-world unlocker.
 *
 * Runs in the MAIN world at document_start, i.e. inside the page's own
 * JavaScript context and before any of the site's scripts execute. A
 * capture-phase listener on `window` is therefore the very first handler in
 * the dispatch path for every clipboard event, so calling
 * stopImmediatePropagation() there keeps the event from ever reaching the
 * site's blockers - listeners as well as inline `oncopy=""` / `document.oncut`
 * handlers, on any element, including ones created later at runtime.
 *
 * The browser's own default action (the actual copy / paste / cut) is never
 * touched: preventDefault() is deliberately not called anywhere in this file.
 */
(() => {
  'use strict';

  const NS = 'copypaste-unlocker';
  const INSTALLED = Symbol.for(NS);

  // The extension may be reloaded while a tab is open - only install once.
  if (window[INSTALLED]) return;
  window[INSTALLED] = true;

  /** Events the site uses to cancel clipboard actions. */
  const CLIPBOARD_EVENTS = ['copy', 'paste', 'cut'];
  /** Cancelling this one makes text unselectable, so Ctrl+C has nothing to copy. */
  const SELECTION_EVENTS = ['selectstart'];
  /** Some blockers swallow the shortcut itself, before any clipboard event exists. */
  const KEY_EVENTS = ['keydown', 'keypress', 'keyup'];
  const CLIPBOARD_KEYS = new Set(['c', 'v', 'x']);
  const CLIPBOARD_CODES = new Set(['KeyC', 'KeyV', 'KeyX']);

  // Default ON. bridge.js corrects this asynchronously if the user toggled the
  // extension off, so a page load is never left unprotected while storage reads.
  let enabled = true;

  /** Stop the event before the page's own handlers see it. */
  const release = (event) => {
    if (enabled) event.stopImmediatePropagation();
  };

  /** True for Ctrl/Cmd + C / V / X (Alt excluded - that is a different chord). */
  const isClipboardShortcut = (event) => {
    if (event.altKey || !(event.ctrlKey || event.metaKey)) return false;
    const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    return CLIPBOARD_KEYS.has(key) || CLIPBOARD_CODES.has(event.code);
  };

  const releaseShortcut = (event) => {
    if (enabled && isClipboardShortcut(event)) event.stopImmediatePropagation();
  };

  for (const type of [...CLIPBOARD_EVENTS, ...SELECTION_EVENTS]) {
    window.addEventListener(type, release, true);
  }
  for (const type of KEY_EVENTS) {
    window.addEventListener(type, releaseShortcut, true);
  }

  // State comes from bridge.js (the isolated-world half), which is the only
  // part that can read chrome.storage. Listeners stay registered either way and
  // just consult the flag, so toggling never changes their dispatch order.
  window.addEventListener(`${NS}:enable`, () => { enabled = true; }, true);
  window.addEventListener(`${NS}:disable`, () => { enabled = false; }, true);

  // Announce readiness in case bridge.js published the stored state before this
  // script was injected.
  window.dispatchEvent(new CustomEvent(`${NS}:ready`));
})();
