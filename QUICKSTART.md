# CopyPaste Unlocker — 60 second setup

Brings **Ctrl+C**, **Ctrl+V** and **Ctrl+X** back on azubiheft.de. No console, no DevTools,
no "allow pasting" prompt. Install it and forget it.

## Install

1. Put this folder somewhere permanent (e.g. `Documents/CopyPaste-Unlocker`).
   **Don't delete or move it afterwards** — Chrome loads it from that path on every start.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** (top left).
5. Pick the folder that contains `manifest.json` — the folder itself, not the file.
6. The welcome page opens by itself. Reload any open azubiheft.de tab once (F5 / Cmd+R). Done.

## Using it

Nothing to do. It arms itself on every azubiheft.de page, dynamically created text fields included.

- **The mask:** when a page loads you get a short "I'M WATCHING YOU → ...just kidding" intro.
  Turn it off any time: toolbar icon → `> intro: ON/OFF`.
- **Turn the unlocker off:** toolbar icon → flip the switch. Instant, no reload.
- **The video:** plays in the popup every time you open it, and full size via `> full screen`.

## FAQ

**Nothing happens?** Reload the azubiheft.de tab once, and check the switch is green.

**Chrome nags about developer mode extensions.** Normal for anything not installed from the
Web Store. Dismiss it.

**Is anything collected?** No. No network calls, no page content read, no clipboard access —
it only silences the site's blocking handlers. The only thing stored is two on/off flags,
locally.
