/** Breach sequence controller for the popup and the welcome page. */
(() => {
  'use strict';

  const boot = document.getElementById('boot');
  if (!boot) return;

  const kill = () => boot.remove();

  chrome.storage.local.get({ intro: true, alias: '' }, (s) => {
    if (chrome.runtime.lastError || s.intro === false) return kill();
    const who = boot.querySelector('.who');
    if (who) who.textContent = `welcome back, ${String(s.alias || 'operator').slice(0, 18)}`;
    boot.addEventListener('click', kill);   // click anywhere to skip
    setTimeout(kill, 3050);                 // matches the CSS timeline
  });
})();
