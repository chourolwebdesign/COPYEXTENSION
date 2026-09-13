# CopyPaste Unlocker

Chrome extension (Manifest V3) that restores **Ctrl+C**, **Ctrl+V** and **Ctrl+X** on
[azubiheft.de](https://azubiheft.de), where page scripts cancel the clipboard events.

It is the permanent, automatic equivalent of the console one-liner

```js
['copy','paste','cut'].forEach(t => window.addEventListener(t, e => e.stopImmediatePropagation(), true))
```

— no DevTools, no "allow pasting" prompt, no manual step. The browser injects it on every page
load, in iframes too, and it covers text fields created later at runtime.

## Files

```
CopyPaste-Unlocker/
├── manifest.json               # MV3: two content scripts, storage + alarms
├── src/
│   ├── unlock.js               # MAIN world, document_start — silences the site's blockers
│   ├── bridge.js               # ISOLATED world — licence + switch decide, forwards to unlock.js
│   ├── license.js              # licence client (activate / revalidate / deactivate)
│   ├── config.js               # API_BASE — the one file you edit after deploying
│   ├── background.js           # service worker: periodic re-check via chrome.alarms
│   ├── popup.html              # activation screen / active screen
│   ├── popup.css
│   └── popup.js
├── supabase/
│   ├── migrations/0001_license_schema.sql
│   ├── functions/license/index.ts   # public: activate, validate, deactivate
│   ├── functions/admin/index.ts     # seller only: create, revoke, reactivate, status, list, release
│   └── config.toml
├── icons/
├── SETUP.md                    # backend setup, key generation, test matrix
└── README.md
```

## Licence system

The extension does nothing until a licence key is activated against the backend
(`SETUP.md` has the full setup, key generation and test matrix).

- The popup asks for a key (`CP-XXXX-XXXX-XXXX-XXXX`) and calls the `license`
  Edge Function, which checks the key server-side, enforces `max_devices` and
  records the activation against a random device UUID.
- On success the server grants a **lease** (7 days by default). `bridge.js` only
  enables `unlock.js` while that lease is live and the switch is on, so a copied
  extension folder without a key does nothing.
- The service worker re-checks every 12 h through `chrome.alarms` — never per
  clipboard event. A failed check caused by a missing connection keeps the
  current lease, which is the offline grace period; a refusal from the server
  (revoked, unknown, released) ends the licence immediately.
- **Lizenz deaktivieren** releases the device server-side so the key can move to
  another machine.
- No secret ships inside the extension: it knows only the public function URL,
  the customer's own key, a device UUID and a timestamp.

This prevents casual sharing. It does not make the extension uncrackable — see
the last section of `SETUP.md`.

## Install

1. Put this folder somewhere permanent — Chrome loads it from that path on every start, so
   moving or deleting it breaks the extension.
2. Open `chrome://extensions` (Chrome 111+, required for `"world": "MAIN"`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** (top left).
5. Select the folder that contains `manifest.json` — the folder itself, not the file.
6. Reload any open azubiheft.de tab once. Done.

To switch it off, click the toolbar icon and flip the switch. It applies immediately in open
tabs, no reload needed.

## Why the MAIN world is necessary

A content script normally runs in an **isolated world**: its own JavaScript context with its own
copy of the globals. It shares the DOM with the page, but the `window` object it registers
listeners on is *not* the page's `window`. A capture-phase listener added there cannot call
`stopImmediatePropagation()` on the event object the page's own handlers receive, so the site's
blockers still run and still cancel the copy/paste/cut.

`"world": "MAIN"` (Chrome 111+) injects `unlock.js` into the page's own context — exactly where
the console snippet runs, and exactly where the site's blocking handlers live. Combined with
`"run_at": "document_start"`, it registers **before any of the site's scripts execute**, so its
capture-phase listener on `window` is the first handler in the dispatch path of every clipboard
event. `stopImmediatePropagation()` there means the event never reaches the site's listeners —
`addEventListener` handlers, inline `oncopy="…"` attributes and `document.oncut = …` alike, on
any element, whether it existed at page load or was created afterwards. Because one listener sits
at the top of the tree instead of on individual fields, dynamically added text fields are covered
for free.

The browser's own default action is never touched (`preventDefault()` is not called anywhere), so
the real copy/paste/cut goes through as usual.

`chrome.*` APIs are not available in the MAIN world, so the ON/OFF state is read by the small
isolated-world script `bridge.js` and handed over via DOM events. `unlock.js` starts enabled and
only ever switches off if told to, so a page load is never left unprotected while storage is read.

## What it silences

| Event | Why |
| --- | --- |
| `copy`, `paste`, `cut` | the actual clipboard blockers |
| `selectstart` | cancelling it makes text unselectable, so Ctrl+C has nothing to copy |
| `keydown`, `keypress`, `keyup` | only for Ctrl/Cmd + C/V/X — some blockers swallow the shortcut itself, before any clipboard event exists |

All other events, keys and site behaviour are left untouched.

## Permissions and privacy

`"storage"` (the on/off flag, the licence lease and a random device UUID) and `"alarms"` (the
periodic licence re-check). `host_permissions` covers exactly one host: your own licence API.
No `tabs`, no `activeTab`, no web-accessible resources; the content scripts are limited to
`https://azubiheft.de/*` and `https://www.azubiheft.de/*`.

The content scripts make no network requests at all. Page content, form fields and Berichtsheft
text are never read, stored or transmitted, and the clipboard itself is never touched — the
extension only stops the site's event handlers from running. The only thing that leaves the
browser is a licence check: the key, a random device UUID, and nothing else.
