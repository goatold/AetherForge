alter table learning_plan_milestones
add column if not exists updated_at timestamptz not null default now();
