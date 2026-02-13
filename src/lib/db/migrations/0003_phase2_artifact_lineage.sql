alter table concepts
add column if not exists artifact_id uuid references concept_generation_artifacts(id) on delete set null;

create index if not exists idx_concepts_artifact_id on concepts(artifact_id);
