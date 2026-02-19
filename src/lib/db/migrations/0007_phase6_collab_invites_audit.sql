create table if not exists workspace_member_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('editor', 'viewer')),
  token text not null unique,
  invited_by_user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists collab_member_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  action text not null check (
    action in (
      'invite_created',
      'invite_revoked',
      'invite_accepted',
      'member_role_updated',
      'member_revoked'
    )
  ),
  actor_user_id uuid not null references users(id) on delete cascade,
  target_user_id uuid references users(id) on delete set null,
  target_email text,
  previous_role text check (previous_role in ('owner', 'editor', 'viewer')),
  new_role text check (new_role in ('owner', 'editor', 'viewer')),
  invite_id uuid references workspace_member_invites(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_member_invites_workspace_id
  on workspace_member_invites(workspace_id);

create index if not exists idx_workspace_member_invites_token
  on workspace_member_invites(token);

create index if not exists idx_workspace_member_invites_workspace_email
  on workspace_member_invites(workspace_id, invited_email);

create index if not exists idx_collab_member_audit_workspace_id
  on collab_member_audit_events(workspace_id, created_at desc);
