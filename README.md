# CopyPaste Unlocker

Chrome extension (Manifest V3) that restores **Ctrl+C**, **Ctrl+V** and **Ctrl+X** on
[azubiheft.de](https://azubiheft.de), where page scripts cancel the clipboard events.

It is the permanent, automatic equivalent of the console one-liner

```js
['copy','paste','cut'].forEach(t => window.addEventListener(t, e => e.stopImmediatePropagation(), true))
```

— no DevTools, no "allow pasting" prompt, no manual step: the code is injected by the browser
on every page load, including in iframes and for fields created later at runtime.

## File structure

```
CopyPaste-Unlocker/
├── manifest.json         # MV3 manifest: two content scripts, "storage" permission only
├── src/
│   ├── unlock.js         # MAIN world, document_start — neutralises the site's blockers
│   ├── bridge.js         # ISOLATED world — reads chrome.storage, forwards ON/OFF to unlock.js
│   ├── background.js     # service worker — opens the welcome page once, on install
│   ├── welcome.html      # first-run page with the intro video
│   ├── welcome.css
│   ├── popup.html        # toolbar popup
│   ├── popup.css
│   └── popup.js          # ON/OFF toggle (default ON)
├── assets/
│   └── intro.mp4         # intro video shown on the welcome page (H.264/AAC, 854x480, 12 s)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── KURULUM.md            # Turkish quick-start guide
└── README.md
```

## Install (Load unpacked)

1. Download / clone this folder to a permanent location on your disk.
   Chrome loads an unpacked extension from its folder every start — if you move or delete the
   folder, the extension breaks.
2. Open `chrome://extensions` in Chrome (Chrome 111 or newer — required for `"world": "MAIN"`).
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left).
5. Select the folder that contains `manifest.json` (the folder itself, not the file).
6. "CopyPaste Unlocker" appears in the list. Pin it via the puzzle-piece icon in the toolbar if
   you want the popup one click away.
7. Open or reload a tab on `https://azubiheft.de` — Ctrl+C / Ctrl+V / Ctrl+X work.

To switch it off temporarily, click the toolbar icon and flip the toggle. The change takes
effect immediately in open tabs; no reload required.

## First run

On install, the service worker opens `src/welcome.html` once. It plays the bundled intro video
(muted autoplay, with controls) and explains the three things a user needs to know. It can be
reopened any time from the "Tanıtım videosunu izle" link in the popup. The service worker does
nothing else and stays unloaded after that.

The UI (popup and welcome page) is in Turkish.

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

## What it neutralises

| Event | Why |
| --- | --- |
| `copy`, `paste`, `cut` | the actual clipboard blockers |
| `selectstart` | cancelling it makes text unselectable, so Ctrl+C has nothing to copy |
| `keydown`, `keypress`, `keyup` | only for Ctrl/Cmd + C/V/X — some blockers swallow the shortcut itself, before any clipboard event exists |

All other events, keys and site behaviour are left untouched.

## Permissions

`"storage"` — the single ON/OFF flag, nothing else. No `host_permissions`, no `tabs`, no
`activeTab`: declarative content scripts limited to `https://azubiheft.de/*` and
`https://www.azubiheft.de/*` need nothing more, and `chrome.tabs.create()` with an extension URL
needs no permission either.

## Privacy

The extension collects, stores and transmits **no** user data. It makes no network requests, reads
no page content and never touches clipboard contents — it only stops the site's event handlers
from running. The only thing written anywhere is the boolean toggle in local extension storage.
