create table if not exists ai_provider_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider_key text not null,
  mode text not null check (mode in ('browser_ui', 'oauth_api')),
  status text not null check (status in ('connected', 'disconnected')),
  model_hint text,
  login_url text,
  metadata_json jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_provider_sessions_user_updated
  on ai_provider_sessions(user_id, updated_at desc);

create unique index if not exists idx_ai_provider_sessions_user_connected_unique
  on ai_provider_sessions(user_id)
  where status = 'connected';
