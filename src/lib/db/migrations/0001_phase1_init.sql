create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  topic text not null,
  difficulty text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  score_percent numeric(5,2),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);

create table if not exists flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  recall_score int not null check (recall_score between 0 and 5),
  reviewed_at timestamptz not null default now()
);

create table if not exists learning_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspaces(id) on delete cascade,
  title text not null,
  updated_at timestamptz not null default now()
);

create table if not exists learning_plan_milestones (
  id uuid primary key default gen_random_uuid(),
  learning_plan_id uuid not null references learning_plans(id) on delete cascade,
  title text not null,
  due_date date,
  completed_at timestamptz
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists progress_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_user_id on workspace_members(user_id);
create index if not exists idx_concepts_workspace_id on concepts(workspace_id);
create index if not exists idx_quizzes_workspace_id on quizzes(workspace_id);
create index if not exists idx_flashcards_workspace_id on flashcards(workspace_id);
create index if not exists idx_resources_workspace_id on resources(workspace_id);
create index if not exists idx_progress_workspace_id on progress_events(workspace_id);
