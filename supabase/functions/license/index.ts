/**
 * Public licence API used by the extension.
 *
 * POST { action: "activate" | "validate" | "deactivate", key, device_id }
 *   -> { ok: true,  status, lease_seconds, expires_at, max_devices }
 *   -> { ok: false, error: "invalid" | "revoked" | "expired" | "device_limit"
 *                        | "not_activated" | "rate_limited" | "server" }
 *
 * No secret of any kind is needed from the caller, and none is exposed: the
 * service-role key stays in the function's environment.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/** How long the extension may run between successful checks (offline grace). */
const LEASE_SECONDS = Number(Deno.env.get("LEASE_SECONDS") ?? 7 * 24 * 60 * 60);

/** Per IP, per action, per hour. */
const LIMITS: Record<string, number> = { activate: 20, validate: 120, deactivate: 20 };

const RPC: Record<string, string> = {
  activate: "activate_license",
  validate: "validate_license",
  deactivate: "deactivate_license",
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const KEY_RE = /^CP(-[0-9A-Z]{4}){4}$/;
const DEVICE_RE = /^[0-9a-fA-F-]{10,64}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "server" }, 405);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const key = String(body?.key ?? "").trim().toUpperCase();
  const device = String(body?.device_id ?? "").trim();

  if (!RPC[action]) return json({ ok: false, error: "server" }, 400);
  if (!KEY_RE.test(key) || !DEVICE_RE.test(device)) {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const { data: allowed, error: limitError } = await supabase.rpc("hit_rate_limit", {
    p_bucket: `${ip}:${action}`,
    p_max: LIMITS[action],
    p_window_seconds: 3600,
  });
  if (limitError) return json({ ok: false, error: "server" }, 500);
  if (!allowed) return json({ ok: false, error: "rate_limited" }, 429);

  const args: Record<string, unknown> = { p_key: key, p_device: device };
  if (action !== "deactivate") args.p_lease_seconds = LEASE_SECONDS;

  const { data, error } = await supabase.rpc(RPC[action], args);
  if (error) return json({ ok: false, error: "server" }, 500);

  return json(data, data?.ok ? 200 : 403);
});
