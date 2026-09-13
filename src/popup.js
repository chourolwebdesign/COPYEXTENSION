/** CopyPaste Unlocker - popup UI. Owns the two stored flags: enabled, intro. */
(() => {
  'use strict';

  const DEFAULTS = { enabled: true, intro: true, alias: '' };
  const toggle = document.getElementById('toggle');
  const status = document.getElementById('status');
  const hint = document.getElementById('hint');
  const introToggle = document.getElementById('introToggle');
  const alias = document.getElementById('alias');

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
      ? 'breach screen runs on azubiheft.de — click to stop it'
      : 'breach screen is off — click to bring it back';
  };

  chrome.storage.local.get(DEFAULTS, (items) => {
    const ok = !chrome.runtime.lastError;
    intro = ok ? items.intro !== false : DEFAULTS.intro;
    alias.value = ok ? items.alias || '' : '';
    render(ok ? items.enabled !== false : DEFAULTS.enabled);
    renderIntro();
  });

  // The name the breach screen greets you with. Stored locally, nothing else.
  let aliasTimer;
  alias.addEventListener('input', () => {
    clearTimeout(aliasTimer);
    aliasTimer = setTimeout(() => {
      chrome.storage.local.set({ alias: alias.value.trim().slice(0, 18) });
    }, 300);
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
    if (changes.alias && document.activeElement !== alias) alias.value = changes.alias.newValue || '';
  });
})();
