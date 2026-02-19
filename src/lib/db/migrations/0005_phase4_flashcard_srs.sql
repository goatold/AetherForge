alter table flashcards
add column if not exists concept_id uuid references concepts(id) on delete set null;

alter table flashcards
add column if not exists source text not null default 'quiz_miss';

alter table flashcards
add column if not exists ease_factor numeric(4,2) not null default 2.5;

alter table flashcards
add column if not exists interval_days int not null default 0;

alter table flashcards
add column if not exists repetition_count int not null default 0;

alter table flashcards
add column if not exists next_review_at timestamptz not null default now();

alter table flashcards
add column if not exists last_reviewed_at timestamptz;

alter table flashcard_reviews
add column if not exists scheduled_interval_days int;

alter table flashcard_reviews
add column if not exists next_review_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flashcards_interval_days_check'
  ) then
    alter table flashcards
    add constraint flashcards_interval_days_check check (interval_days >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flashcards_repetition_count_check'
  ) then
    alter table flashcards
    add constraint flashcards_repetition_count_check check (repetition_count >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flashcards_ease_factor_check'
  ) then
    alter table flashcards
    add constraint flashcards_ease_factor_check check (ease_factor >= 1.3 and ease_factor <= 3.5);
  end if;
end
$$;

create index if not exists idx_flashcards_workspace_next_review on flashcards(workspace_id, next_review_at);
create index if not exists idx_flashcards_concept_id on flashcards(concept_id);
create index if not exists idx_flashcard_reviews_user_id on flashcard_reviews(user_id);
