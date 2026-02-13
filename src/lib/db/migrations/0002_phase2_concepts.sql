create table if not exists concept_examples (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references concepts(id) on delete cascade,
  example_type text not null check (example_type in ('example', 'case_study')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists concept_generation_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  topic text not null,
  difficulty text not null,
  artifact_version int not null,
  provider text not null,
  model text not null,
  created_by_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_examples_concept_id on concept_examples(concept_id);
create index if not exists idx_generation_artifacts_workspace_id on concept_generation_artifacts(workspace_id);
