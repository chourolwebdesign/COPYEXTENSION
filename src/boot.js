/** Shared intro sequence controller for the popup and the welcome page. */
(() => {
  'use strict';

  const boot = document.getElementById('boot');
  if (!boot) return;

  const kill = () => boot.remove();

  chrome.storage.local.get({ intro: true }, (s) => {
    if (chrome.runtime.lastError || s.intro === false) return kill();
    boot.addEventListener('click', kill);      // click anywhere to skip
    setTimeout(kill, 3600);                    // matches the CSS timeline
  });
})();
