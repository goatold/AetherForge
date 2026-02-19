alter table quizzes
add column if not exists artifact_id uuid references concept_generation_artifacts(id) on delete set null;

alter table quizzes
add column if not exists provider text not null default 'aetherforge-bootstrap';

alter table quizzes
add column if not exists model text not null default 'phase3-template-v1';

alter table quiz_attempts
add column if not exists status text not null default 'in_progress';

alter table quiz_attempts
add column if not exists started_at timestamptz not null default now();

alter table quiz_attempts
add column if not exists correct_count int;

alter table quiz_attempts
add column if not exists total_questions int;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quiz_attempts_status_check'
  ) then
    alter table quiz_attempts
    add constraint quiz_attempts_status_check
    check (status in ('in_progress', 'submitted'));
  end if;
end
$$;

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  concept_id uuid references concepts(id) on delete set null,
  question_type text not null check (question_type in ('mcq', 'true_false', 'short_answer')),
  prompt text not null,
  explanation text not null,
  correct_answer_text text not null,
  position int not null check (position > 0),
  created_at timestamptz not null default now()
);

create table if not exists quiz_question_options (
  id uuid primary key default gen_random_uuid(),
  quiz_question_id uuid not null references quiz_questions(id) on delete cascade,
  option_key text not null,
  option_text text not null,
  is_correct boolean not null default false,
  position int not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (quiz_question_id, option_key)
);

create table if not exists quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  quiz_attempt_id uuid not null references quiz_attempts(id) on delete cascade,
  quiz_question_id uuid not null references quiz_questions(id) on delete cascade,
  selected_option_id uuid references quiz_question_options(id) on delete set null,
  answer_text text,
  is_correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_attempt_id, quiz_question_id)
);

create index if not exists idx_quizzes_artifact_id on quizzes(artifact_id);
create index if not exists idx_quiz_questions_quiz_id on quiz_questions(quiz_id);
create index if not exists idx_quiz_questions_concept_id on quiz_questions(concept_id);
create index if not exists idx_quiz_options_question_id on quiz_question_options(quiz_question_id);
create index if not exists idx_quiz_attempts_quiz_id on quiz_attempts(quiz_id);
create index if not exists idx_quiz_attempts_user_id on quiz_attempts(user_id);
create index if not exists idx_quiz_attempt_answers_attempt_id on quiz_attempt_answers(quiz_attempt_id);
