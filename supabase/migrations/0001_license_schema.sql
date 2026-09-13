-- CopyPaste Unlocker — licence schema.
-- Everything here is reachable only through the Edge Functions, which use the
-- service-role key. RLS is on with no policies, so the anon key sees nothing,
-- and EXECUTE on the RPCs is revoked from anon/authenticated at the bottom.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables ----

create table if not exists public.licenses (
  id               uuid primary key default gen_random_uuid(),
  license_key      text not null unique,
  status           text not null default 'active' check (status in ('active', 'revoked')),
  created_at       timestamptz not null default now(),
  activated_at     timestamptz,
  expires_at       timestamptz,
  max_devices      int not null default 2 check (max_devices > 0),
  activation_count int not null default 0,          -- devices currently active
  note             text
);

create table if not exists public.activations (
  id             uuid primary key default gen_random_uuid(),
  license_id     uuid not null references public.licenses (id) on delete cascade,
  device_id      text not null,
  activated_at   timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  deactivated_at timestamptz
);

-- one live activation per device per licence
create unique index if not exists activations_one_live_per_device
  on public.activations (license_id, device_id)
  where deactivated_at is null;

create index if not exists activations_license_idx on public.activations (license_id);

create table if not exists public.rate_limits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

alter table public.licenses    enable row level security;
alter table public.activations enable row level security;
alter table public.rate_limits enable row level security;
-- deliberately no policies: only the service role reaches these tables

-- ------------------------------------------------------------- functions ----

-- Fixed-window counter. Returns true while the caller is inside the limit.
create or replace function public.hit_rate_limit(
  p_bucket text, p_max int, p_window_seconds int
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  insert into rate_limits as r (bucket, window_start, count)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                     then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                     then now() else r.window_start end
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

-- Activate a key on a device. Row lock keeps the device limit race-free.
create or replace function public.activate_license(
  p_key text, p_device text, p_lease_seconds int default 604800
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_lic      licenses%rowtype;
  v_existing activations%rowtype;
  v_live     int;
begin
  select * into v_lic from licenses where license_key = upper(btrim(p_key)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if v_lic.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;
  if v_lic.expires_at is not null and v_lic.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_existing
    from activations
   where license_id = v_lic.id and device_id = p_device and deactivated_at is null;

  if found then
    update activations set last_seen_at = now() where id = v_existing.id;
  else
    select count(*) into v_live
      from activations where license_id = v_lic.id and deactivated_at is null;

    if v_live >= v_lic.max_devices then
      return jsonb_build_object('ok', false, 'error', 'device_limit',
                                'max_devices', v_lic.max_devices);
    end if;

    insert into activations (license_id, device_id) values (v_lic.id, p_device);

    update licenses
       set activation_count = activation_count + 1,
           activated_at = coalesce(activated_at, now())
     where id = v_lic.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'active',
    'expires_at', v_lic.expires_at,
    'max_devices', v_lic.max_devices,
    'lease_seconds', p_lease_seconds
  );
end;
$$;

-- Periodic re-check of an already activated device.
create or replace function public.validate_license(
  p_key text, p_device text, p_lease_seconds int default 604800
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_lic  licenses%rowtype;
  v_act  activations%rowtype;
begin
  select * into v_lic from licenses where license_key = upper(btrim(p_key));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if v_lic.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;
  if v_lic.expires_at is not null and v_lic.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_act
    from activations
   where license_id = v_lic.id and device_id = p_device and deactivated_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_activated');
  end if;

  update activations set last_seen_at = now() where id = v_act.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'active',
    'expires_at', v_lic.expires_at,
    'max_devices', v_lic.max_devices,
    'lease_seconds', p_lease_seconds
  );
end;
$$;

-- Release a device so the key can be used somewhere else.
create or replace function public.deactivate_license(p_key text, p_device text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_lic licenses%rowtype;
  v_act activations%rowtype;
begin
  select * into v_lic from licenses where license_key = upper(btrim(p_key)) for update;
  if not found then
    return jsonb_build_object('ok', true);   -- nothing to release
  end if;

  select * into v_act
    from activations
   where license_id = v_lic.id and device_id = p_device and deactivated_at is null;
  if not found then
    return jsonb_build_object('ok', true);
  end if;

  update activations set deactivated_at = now() where id = v_act.id;
  update licenses set activation_count = greatest(activation_count - 1, 0) where id = v_lic.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- The RPCs must not be callable with the public anon key.
revoke execute on function public.hit_rate_limit(text, int, int)        from anon, authenticated;
revoke execute on function public.activate_license(text, text, int)     from anon, authenticated;
revoke execute on function public.validate_license(text, text, int)     from anon, authenticated;
revoke execute on function public.deactivate_license(text, text)        from anon, authenticated;
