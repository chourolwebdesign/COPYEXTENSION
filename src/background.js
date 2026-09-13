/**
 * Service worker. Its only job is keeping the licence lease fresh - a periodic
 * alarm, never a request per copy/paste.
 */
import { REVALIDATE_EVERY_MINUTES } from './config.js';
import { revalidate } from './license.js';

const ALARM = 'license-revalidate';

const schedule = () => {
  chrome.alarms.create(ALARM, { periodInMinutes: REVALIDATE_EVERY_MINUTES });
  revalidate();
};

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) revalidate();
});
