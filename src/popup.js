/**
 * Popup. Two screens: activate a licence, or show the active one with the
 * on/off switch. All licence checks happen on the server; this file only
 * renders what the server answered and what is stored locally.
 */
import { activate, deactivate, getLicense, isValid, revalidate } from './license.js';

const $ = (id) => document.getElementById(id);
const screens = { activate: $('screen-activate'), active: $('screen-active') };

const MESSAGES = {
  invalid: 'Ungültiger oder deaktivierter Lizenzschlüssel.',
  revoked: 'Ungültiger oder deaktivierter Lizenzschlüssel.',
  not_activated: 'Ungültiger oder deaktivierter Lizenzschlüssel.',
  expired: 'Diese Lizenz ist abgelaufen.',
  device_limit: 'Diese Lizenz ist bereits auf der maximalen Anzahl an Geräten aktiv.',
  rate_limited: 'Zu viele Versuche. Bitte später erneut versuchen.',
  offline: 'Keine Verbindung zum Lizenzserver. Bitte Internetverbindung prüfen.',
  server: 'Lizenzserver nicht erreichbar. Bitte später erneut versuchen.',
};

const showError = (code) => {
  const box = $('error');
  box.textContent = MESSAGES[code] || MESSAGES.server;
  box.hidden = false;
};

const clearError = () => { $('error').hidden = true; };

function show(name) {
  screens.activate.hidden = name !== 'activate';
  screens.active.hidden = name !== 'active';
}

function renderToggle(enabled) {
  $('toggle').checked = enabled;
  $('status').textContent = enabled ? 'An' : 'Aus';
  $('status').dataset.state = enabled ? 'on' : 'off';
}

async function render() {
  const license = await getLicense();
  if (!isValid(license)) {
    show('activate');
    if (license?.error) showError(license.error);
    $('key').focus();
    return;
  }
  const { enabled } = await chrome.storage.local.get({ enabled: true });
  renderToggle(enabled !== false);
  show('active');
}

// Type the key in any shape - it is normalised to CP-XXXX-XXXX-XXXX-XXXX.
$('key').addEventListener('input', (e) => {
  const raw = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^CP/, '');
  const groups = raw.slice(0, 16).match(/.{1,4}/g) || [];
  e.target.value = groups.length ? `CP-${groups.join('-')}` : '';
  clearError();
});

$('key').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('activate').click();
});

$('activate').addEventListener('click', async () => {
  const button = $('activate');
  button.disabled = true;
  button.textContent = 'Wird geprüft…';
  clearError();

  const result = await activate($('key').value);

  button.disabled = false;
  button.textContent = 'Aktivieren';
  if (result.ok) {
    $('key').value = '';
    await render();
  } else {
    showError(result.error);
  }
});

$('deactivate').addEventListener('click', async () => {
  const button = $('deactivate');
  button.disabled = true;
  button.textContent = 'Wird freigegeben…';

  const result = await deactivate();

  button.disabled = false;
  button.textContent = 'Lizenz deaktivieren';
  await render();
  if (!result.ok && result.error === 'offline') showError('offline');
});

$('toggle').addEventListener('change', async () => {
  const enabled = $('toggle').checked;
  renderToggle(enabled);
  await chrome.storage.local.set({ enabled });
});

// Opening the popup is a good moment to re-check a licence that is due.
render().then(async () => {
  const license = await getLicense();
  if (isValid(license) && Date.now() - (license.checkedAt || 0) > 6 * 3600 * 1000) {
    await revalidate();
    await render();
  }
});
