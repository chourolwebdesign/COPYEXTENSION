/**
 * Seller-only API. Every request must carry the admin token:
 *
 *   x-admin-token: <ADMIN_TOKEN secret>
 *
 * POST { action, ... }
 *   create     { count?, max_devices?, expires_at?, note? } -> { ok, keys: [...] }
 *   revoke     { key }                                      -> { ok, license }
 *   reactivate { key }                                      -> { ok, license }
 *   status     { key }               -> { ok, license, activations: [...] }
 *   list       { limit?, offset? }   -> { ok, licenses: [...] }
 *   release    { key, device_id }    -> { ok }
 *
 * The extension never calls this function and never learns the token.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const ADMIN_TOKEN = Deno.env.get("ADMIN_TOKEN") ?? "";

/** Length-independent comparison, so the token cannot be probed by timing. */
function tokenOk(given: string): boolean {
  if (!ADMIN_TOKEN || given.length !== ADMIN_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ ADMIN_TOKEN.charCodeAt(i);
  return diff === 0;
}

/** 32-symbol alphabet without 0/1/I/O; 16 symbols = 80 bits of randomness. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function newKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const s = Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
  return `CP-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!tokenOk(req.headers.get("x-admin-token") ?? "")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  const action = String(body?.action ?? "");
  const key = String(body?.key ?? "").trim().toUpperCase();

  switch (action) {
    case "create": {
      const count = Math.min(Math.max(Number(body?.count ?? 1), 1), 100);
      const rows = Array.from({ length: count }, () => ({
        license_key: newKey(),
        max_devices: Number(body?.max_devices ?? 2),
        expires_at: body?.expires_at ?? null,
        note: body?.note ?? null,
      }));
      const { data, error } = await supabase.from("licenses").insert(rows).select("license_key, max_devices, expires_at");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, count: data.length, keys: data.map((r) => r.license_key), licenses: data });
    }

    case "revoke":
    case "reactivate": {
      const status = action === "revoke" ? "revoked" : "active";
      const { data, error } = await supabase.from("licenses")
        .update({ status }).eq("license_key", key)
        .select("license_key, status, max_devices, activation_count, expires_at").maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!data) return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, license: data });
    }

    case "status": {
      const { data: license, error } = await supabase.from("licenses")
        .select("*").eq("license_key", key).maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!license) return json({ ok: false, error: "not_found" }, 404);
      const { data: activations } = await supabase.from("activations")
        .select("device_id, activated_at, last_seen_at, deactivated_at")
        .eq("license_id", license.id).order("activated_at", { ascending: true });
      return json({ ok: true, license, activations: activations ?? [] });
    }

    case "list": {
      const limit = Math.min(Math.max(Number(body?.limit ?? 50), 1), 500);
      const offset = Math.max(Number(body?.offset ?? 0), 0);
      const { data, error } = await supabase.from("licenses")
        .select("license_key, status, activation_count, max_devices, created_at, activated_at, expires_at, note")
        .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, count: data.length, licenses: data });
    }

    case "release": {
      const device = String(body?.device_id ?? "").trim();
      if (!device) return json({ ok: false, error: "device_id_required" }, 400);
      const { data, error } = await supabase.rpc("deactivate_license", { p_key: key, p_device: device });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json(data);
    }

    default:
      return json({ ok: false, error: "unknown_action" }, 400);
  }
});
