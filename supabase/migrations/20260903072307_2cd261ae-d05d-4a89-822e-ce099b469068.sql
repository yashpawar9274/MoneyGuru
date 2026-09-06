-- Roles
do $$ begin
  create type public.app_role as enum ('admin','moderator','user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

drop policy if exists "own roles readable" on public.user_roles;
create policy "own roles readable" on public.user_roles
for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Webhook logs (payment provider callbacks)
create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cashfree',
  event_type text,
  order_id text,
  status text,
  signature_valid boolean not null default false,
  http_status int,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists webhook_logs_created_at_idx on public.webhook_logs (created_at desc);

grant select on public.webhook_logs to authenticated;
grant all on public.webhook_logs to service_role;
alter table public.webhook_logs enable row level security;

drop policy if exists "admins read webhook logs" on public.webhook_logs;
create policy "admins read webhook logs" on public.webhook_logs
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Admin read access on customer data
drop policy if exists "admins read all payments" on public.payments;
create policy "admins read all payments" on public.payments
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins read all subscriptions" on public.subscriptions;
create policy "admins read all subscriptions" on public.subscriptions
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Owner (Yash Pawar) becomes admin
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
where lower(email) = 'theyashpawar92@gmail.com'
on conflict (user_id, role) do nothing;

-- Grant admin automatically on bootstrap for the owner email
create or replace function public.bootstrap_account()
returns void language plpgsql security definer set search_path = public as $$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.profiles (id, email)
  VALUES (uid, mail)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  INSERT INTO public.subscriptions (user_id, plan, price_inr, trial_ends_at)
  VALUES (uid, 'free', 0, now() + interval '24 hours')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.subscriptions
    SET trial_ends_at = coalesce(trial_ends_at, created_at + interval '24 hours')
  WHERE user_id = uid AND plan = 'free';

  IF mail = 'theyashpawar92@gmail.com' THEN
    UPDATE public.subscriptions
      SET plan = 'lifetime', status = 'active', price_inr = 0,
          current_period_end = NULL, trial_ends_at = NULL, updated_at = now()
    WHERE user_id = uid;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- Realtime streams for the admin panel
alter table public.payments replica identity full;
alter table public.subscriptions replica identity full;
alter table public.webhook_logs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.subscriptions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.webhook_logs;
exception when duplicate_object then null; end $$;