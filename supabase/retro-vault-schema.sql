-- Retro Vault Elite permanent backend storage.
-- Run this once in Supabase SQL Editor, then add SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY to the Render backend environment.

create table if not exists public.retro_vault_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.retro_vault_state enable row level security;

drop policy if exists "service role can manage retro vault state" on public.retro_vault_state;
create policy "service role can manage retro vault state"
  on public.retro_vault_state
  for all
  to service_role
  using (true)
  with check (true);

insert into public.retro_vault_state (id, data)
values (
  'main',
  jsonb_build_object(
    'users', jsonb_build_array(),
    'sessions', jsonb_build_array(),
    'passwordResets', jsonb_build_array(),
    'newsletterSubscribers', jsonb_build_array(),
    'analytics', jsonb_build_object(
      'totalPageViews', 0,
      'lifetimePageViews', 0,
      'firstTrackedAt', null,
      'lastTrackedAt', null,
      'pages', jsonb_build_object(),
      'days', jsonb_build_object(),
      'referrers', jsonb_build_object(),
      'userAgents', jsonb_build_object(),
      'signedInPageViews', 0
    )
  )
)
on conflict (id) do nothing;
