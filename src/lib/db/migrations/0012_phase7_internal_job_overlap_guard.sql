create unique index if not exists idx_internal_job_runs_unique_running_by_job
  on internal_job_runs(job_name)
  where status = 'running';
