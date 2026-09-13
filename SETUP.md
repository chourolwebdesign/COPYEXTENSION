# Licence backend — setup

Everything below is done once. The extension ships with no secret in it: the
service-role key and the admin token live only in the Edge Function environment.

## 0. What you need

- A Supabase project (the free tier is enough for this).
- The Supabase CLI: `npm i -g supabase` (or `brew install supabase/tap/supabase`).
- `curl` for the admin calls.

## 1. Create the project

Create a project at supabase.com and note its **project ref** (the part before
`.supabase.co` in the project URL, e.g. `abcdefghijklmnopqrst`).

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```

## 2. Create the database schema

Either with the CLI from this repo:

```bash
supabase db push          # applies supabase/migrations/0001_license_schema.sql
```

…or without the CLI: open **SQL Editor** in the Supabase dashboard, paste the
whole contents of `supabase/migrations/0001_license_schema.sql` and run it.

Check afterwards in **Table Editor**: `licenses`, `activations`, `rate_limits`
exist and all three show "RLS enabled".

## 3. Secrets

```bash
# a long random admin token — this is what protects key generation
openssl rand -base64 32
# -> e.g. 8Qm2v0m6bqk8N0gk4y0Nq2rN2yq8lK9xZ2m1xQ0p8sA=

supabase secrets set ADMIN_TOKEN='PASTE-THE-TOKEN-HERE'

# optional: how long the extension may run between successful checks
# (this is also the offline grace period). Default 604800 = 7 days.
supabase secrets set LEASE_SECONDS=604800
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase
automatically — do not set them, and never copy the service-role key anywhere
near the extension.

## 4. Deploy the two functions

```bash
supabase functions deploy license --no-verify-jwt
supabase functions deploy admin   --no-verify-jwt
```

`license` is public on purpose (the extension calls it with no credentials).
`admin` is public only in the sense that it answers — every request without the
correct `x-admin-token` header gets `401`.

Your licence endpoint is now:

```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/license
```

## 5. Generate your first 10 keys

```bash
export REF=YOUR-PROJECT-REF
export ADMIN_TOKEN='the token from step 3'

curl -s -X POST "https://$REF.supabase.co/functions/v1/admin" \
  -H "content-type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"action":"create","count":10,"max_devices":2,"note":"first batch"}'
```

You get back 10 keys in the form `CP-XXXX-XXXX-XXXX-XXXX` (80 bits of
randomness each — not guessable). Store them; you hand one to each buyer.

Optional fields: `"expires_at":"2027-01-01T00:00:00Z"` for a time-limited
licence, `"max_devices":1` for single-device licences.

## 6. Connect the extension

Two places, same project ref:

1. `src/config.js`
   ```js
   export const API_BASE = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/license';
   ```
2. `manifest.json`
   ```json
   "host_permissions": ["https://YOUR-PROJECT-REF.supabase.co/*"]
   ```

Then `chrome://extensions` → reload the extension (circular arrow on its card).
Open the popup, paste a key, press **Aktivieren**.

## 7. Admin cheat sheet

All calls: `POST https://$REF.supabase.co/functions/v1/admin`, header
`x-admin-token: $ADMIN_TOKEN`, JSON body.

| Purpose | Body |
| --- | --- |
| Generate keys | `{"action":"create","count":10,"max_devices":2}` |
| Revoke a licence | `{"action":"revoke","key":"CP-…"}` |
| Reactivate it | `{"action":"reactivate","key":"CP-…"}` |
| Status + devices | `{"action":"status","key":"CP-…"}` |
| List licences | `{"action":"list","limit":50}` |
| Release one device | `{"action":"release","key":"CP-…","device_id":"…"}` |

`status` returns the licence row plus every activation with its `device_id`,
`activated_at`, `last_seen_at` and `deactivated_at` — that is how you see who is
using what, and how you free a device for a customer who changed laptops.

## 8. How to test

Use `{"action":"create","count":2,"max_devices":1}` to get two throwaway keys.

| Case | Steps | Expected |
| --- | --- | --- |
| **Valid key** | Popup → paste key → Aktivieren | "✓ Lizenz aktiv"; Ctrl+C/V/X work on azubiheft.de, in tabs that are already open, without reloading |
| **Invalid key** | Type `CP-ZZZZ-ZZZZ-ZZZZ-ZZZZ` → Aktivieren | "Ungültiger oder deaktivierter Lizenzschlüssel."; nothing is unlocked |
| **Revoked key** | Activate, then `{"action":"revoke","key":"…"}`, then force a check (below) | Back to the activation screen with the same error; shortcuts stop |
| **Second device** | Activate the same `max_devices:1` key on another computer/Chrome profile | "Diese Lizenz ist bereits auf der maximalen Anzahl an Geräten aktiv." |
| **Offline grace** | Activate, then disconnect the network, open the popup, use the site | Still "✓ Lizenz aktiv", shortcuts keep working for the rest of the lease (7 days by default) |
| **Lease expiry** | See the console snippet below | Shortcuts stop, popup asks for a key again |
| **Release a device** | Click **Lizenz deaktivieren** | Device disappears from `status`, key can be activated elsewhere |

To force an immediate re-check instead of waiting 12 hours: right-click the
extension icon → **Inspect popup** → Console:

```js
// mark the licence as "checked long ago" — reopening the popup re-checks it
chrome.storage.local.get('license', ({license}) =>
  chrome.storage.local.set({license: {...license, checkedAt: 0}}));
```

To simulate an expired lease in the same console:

```js
chrome.storage.local.get('license', ({license}) =>
  chrome.storage.local.set({license: {...license, leaseUntil: Date.now() - 1}}));
```

## 9. Where secrets live

| Secret | Where | Never |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | injected into the Edge Functions by Supabase | in the extension, in the repo, in any client |
| `ADMIN_TOKEN` | `supabase secrets set`, plus your own password manager | in the extension |
| Licence keys | your customers, the `licenses` table | hard-coded anywhere |

The extension holds only: the public function URL, the customer's own key, a
random device UUID, and a lease timestamp.

## 10. What this does and does not protect

It stops **casual sharing**, which is the realistic goal:

- A copied extension folder does nothing without a key.
- A shared key stops working on device number `max_devices + 1`.
- A leaked key can be revoked, and the install dies at the next check
  (immediately if you also ask the customer to reopen the popup).
- Activation attempts are rate-limited per IP, so keys cannot be hunted for.

It does **not** make the extension impossible to crack. A Chrome extension is
client-side software: someone who knows JavaScript can edit the copy on their
own machine and remove the check. That is true of every client-side licence
system, this one included. The defence against that is not technical — it is
keeping the valuable part (updates, support, anything server-side you add later)
attached to a real licence.

## 11. Data

Stored on your server: the licence key, a random device UUID, timestamps, and
the caller's IP inside a rate-limit counter that rolls over hourly. No names, no
emails, no page content. The extension never reads or transmits Berichtsheft
content — the content scripts make no network requests at all.
