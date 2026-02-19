alter table resources
add column if not exists note_text text;

alter table resources
add column if not exists tags text[] not null default '{}'::text[];

create index if not exists idx_resources_workspace_tags on resources using gin(tags);
