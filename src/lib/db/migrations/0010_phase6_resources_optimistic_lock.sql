alter table resources
add column if not exists updated_at timestamptz not null default now();

update resources
set updated_at = created_at
where updated_at is null;
