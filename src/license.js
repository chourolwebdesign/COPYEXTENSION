/**
 * Licence client. Shared by the popup and the service worker.
 *
 * Local state (chrome.storage.local):
 *   deviceId : random UUID, created once, sent to the server as the device handle
 *   license  : { key, status, leaseUntil, checkedAt, maxDevices, expiresAt, error }
 *
 * The lease is what makes the extension work offline: the server grants it for a
 * fixed period, the worker refreshes it in the background, and a failed refresh
 * caused by a missing connection leaves the existing lease alone. A refusal from
 * the server (revoked, unknown, released) drops the licence immediately.
 */
import { API_BASE } from './config.js';

/** True while the stored licence may be used. */
export function isValid(license) {
  return !!license && license.status === 'active' && Date.now() < (license.leaseUntil || 0);
}

export async function getLicense() {
  const { license } = await chrome.storage.local.get('license');
  return license || null;
}

export async function getDeviceId() {
  const { deviceId } = await chrome.storage.local.get('deviceId');
  if (deviceId) return deviceId;
  const fresh = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId: fresh });
  return fresh;
}

/** POST to the licence API. Throws only when the server could not be reached. */
async function call(action, key) {
  const device_id = await getDeviceId();
  let res;
  try {
    res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, key, device_id }),
    });
  } catch {
    throw new Error('offline');
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('offline');
  return data;
}

async function store(key, data) {
  const license = {
    key,
    status: 'active',
    leaseUntil: Date.now() + (data.lease_seconds || 0) * 1000,
    checkedAt: Date.now(),
    maxDevices: data.max_devices ?? null,
    expiresAt: data.expires_at ?? null,
  };
  await chrome.storage.local.set({ license });
  return license;
}

/** First activation of a key on this device. */
export async function activate(rawKey) {
  const key = String(rawKey || '').trim().toUpperCase();
  if (!/^CP(-[0-9A-Z]{4}){4}$/.test(key)) return { ok: false, error: 'invalid' };

  let data;
  try {
    data = await call('activate', key);
  } catch {
    return { ok: false, error: 'offline' };
  }
  if (!data.ok) return data;
  await store(key, data);
  return data;
}

/**
 * Background re-check. Network failures keep the current lease (grace period);
 * an answer from the server that refuses the licence ends it now.
 */
export async function revalidate() {
  const license = await getLicense();
  if (!license?.key) return { ok: false, error: 'no_license' };

  let data;
  try {
    data = await call('validate', license.key);
  } catch {
    return { ok: false, error: 'offline', offline: true };
  }
  if (data.ok) return { ...data, license: await store(license.key, data) };

  await chrome.storage.local.set({
    license: { key: license.key, status: 'inactive', leaseUntil: 0, error: data.error },
  });
  return data;
}

/** Release this device so the key can be activated somewhere else. */
export async function deactivate() {
  const license = await getLicense();
  let data = { ok: true };
  if (license?.key) {
    try {
      data = await call('deactivate', license.key);
    } catch {
      data = { ok: false, error: 'offline' };
    }
  }
  // The local licence always goes, so the extension stops here either way.
  await chrome.storage.local.remove('license');
  return data;
}
