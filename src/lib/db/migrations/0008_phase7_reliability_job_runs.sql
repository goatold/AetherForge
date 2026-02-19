create table if not exists internal_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  payload_json jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists idx_internal_job_runs_name_started
  on internal_job_runs(job_name, started_at desc);

create index if not exists idx_internal_job_runs_name_status_started
  on internal_job_runs(job_name, status, started_at desc);
