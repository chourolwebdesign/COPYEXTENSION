/**
 * CopyPaste Unlocker - service worker.
 *
 * Only job: open the welcome page (with the intro video) once, the first time
 * the extension is installed. Nothing runs after that.
 */
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== chrome.runtime.OnInstalledReason.INSTALL) return;
  chrome.tabs.create({ url: chrome.runtime.getURL('src/welcome.html') });
});
