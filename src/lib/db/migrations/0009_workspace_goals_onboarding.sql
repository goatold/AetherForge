create table if not exists workspace_learning_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  label text not null,
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, position)
);

create index if not exists idx_workspace_learning_goals_workspace_id
  on workspace_learning_goals(workspace_id);
