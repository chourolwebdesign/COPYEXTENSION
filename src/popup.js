/** CopyPaste Unlocker - popup UI. Owns the two stored flags: enabled, intro. */
(() => {
  'use strict';

  const DEFAULTS = { enabled: true, intro: true };
  const toggle = document.getElementById('toggle');
  const status = document.getElementById('status');
  const hint = document.getElementById('hint');
  const introToggle = document.getElementById('introToggle');

  let intro = DEFAULTS.intro;

  const render = (enabled) => {
    toggle.checked = enabled;
    toggle.disabled = false;
    status.textContent = enabled ? '[ ACTIVE ]' : '[ STANDBY ]';
    hint.textContent = enabled
      ? 'copy · paste · cut → yours again'
      : 'site rules apply. flip the switch.';
    document.body.classList.toggle('on', enabled);
    document.body.classList.toggle('off', !enabled);
  };

  const renderIntro = () => {
    introToggle.textContent = `> intro: ${intro ? 'ON' : 'OFF'}`;
    introToggle.title = intro
      ? 'the mask shows up on azubiheft.de — click to stop it'
      : 'the mask stays home — click to bring it back';
  };

  chrome.storage.local.get(DEFAULTS, (items) => {
    const ok = !chrome.runtime.lastError;
    intro = ok ? items.intro !== false : DEFAULTS.intro;
    render(ok ? items.enabled !== false : DEFAULTS.enabled);
    renderIntro();
  });

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    render(enabled);
    chrome.storage.local.set({ enabled });
  });

  introToggle.addEventListener('click', () => {
    intro = !intro;
    renderIntro();
    chrome.storage.local.set({ intro });
  });

  // Keep in sync if the state is changed from another window.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) render(changes.enabled.newValue !== false);
    if (changes.intro) { intro = changes.intro.newValue !== false; renderIntro(); }
  });
})();
