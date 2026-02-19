import type { SqlQuery } from "@/lib/db/types";

export const userQueries = {
  findByEmail(email: string): SqlQuery {
    return {
      text: "select id, email, display_name, created_at from users where email = $1 limit 1",
      values: [email]
    };
  },
  insert(email: string, displayName: string | null): SqlQuery {
    return {
      text: `
        insert into users (email, display_name)
        values ($1, $2)
        on conflict (email) do update set display_name = excluded.display_name
        returning id, email, display_name, created_at
      `,
      values: [email, displayName]
    };
  }
};

export const workspaceQueries = {
  create(ownerUserId: string, topic: string, difficulty: string): SqlQuery {
    return {
      text: `
        insert into workspaces (owner_user_id, topic, difficulty)
        values ($1, $2, $3)
        returning id, owner_user_id, topic, difficulty, created_at
      `,
      values: [ownerUserId, topic, difficulty]
    };
  },
  listForUser(userId: string): SqlQuery {
    return {
      text: `
        select w.id, w.owner_user_id, w.topic, w.difficulty, w.created_at
        from workspaces w
        join workspace_members m on m.workspace_id = w.id
        where m.user_id = $1
        order by w.created_at desc
      `,
      values: [userId]
    };
  },
  addMember(workspaceId: string, userId: string, role: "owner" | "editor" | "viewer"): SqlQuery {
    return {
      text: `
        insert into workspace_members (workspace_id, user_id, role)
        values ($1, $2, $3)
        on conflict (workspace_id, user_id) do update set role = excluded.role
      `,
      values: [workspaceId, userId, role]
    };
  }
};

export const conceptQueries = {
  insert(workspaceId: string, title: string, summary: string): SqlQuery {
    return {
      text: `
        insert into concepts (workspace_id, title, summary)
        values ($1, $2, $3)
        returning id, workspace_id, title, summary, created_at
      `,
      values: [workspaceId, title, summary]
    };
  },
  insertForArtifact(
    workspaceId: string,
    artifactId: string,
    title: string,
    summary: string
  ): SqlQuery {
    return {
      text: `
        insert into concepts (workspace_id, artifact_id, title, summary)
        values ($1, $2, $3, $4)
        returning id, workspace_id, artifact_id, title, summary, created_at
      `,
      values: [workspaceId, artifactId, title, summary]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, title, summary, created_at
        from concepts
        where workspace_id = $1
        order by created_at desc
      `,
      values: [workspaceId]
    };
  },
  listByArtifactForUser(artifactId: string, userId: string): SqlQuery {
    return {
      text: `
        select c.id, c.workspace_id, c.artifact_id, c.title, c.summary, c.created_at
        from concepts c
        join workspace_members m on m.workspace_id = c.workspace_id
        where c.artifact_id = $1 and m.user_id = $2
        order by c.created_at asc
      `,
      values: [artifactId, userId]
    };
  },
  findByIdForUser(conceptId: string, userId: string): SqlQuery {
    return {
      text: `
        select c.id, c.workspace_id, c.title, c.summary, c.created_at
        from concepts c
        join workspace_members m on m.workspace_id = c.workspace_id
        where c.id = $1 and m.user_id = $2
        limit 1
      `,
      values: [conceptId, userId]
    };
  },
  listByIdsForUser(conceptIds: string[], userId: string): SqlQuery {
    return {
      text: `
        select c.id, c.workspace_id, c.title, c.summary, c.created_at
        from concepts c
        join workspace_members m on m.workspace_id = c.workspace_id
        where c.id = any($1::uuid[]) and m.user_id = $2
      `,
      values: [conceptIds, userId]
    };
  }
};

export const quizQueries = {
  insert(
    workspaceId: string,
    title: string,
    artifactId: string | null,
    provider: string,
    model: string
  ): SqlQuery {
    return {
      text: `
        insert into quizzes (workspace_id, title, artifact_id, provider, model)
        values ($1, $2, $3, $4, $5)
        returning id, workspace_id, title, artifact_id, provider, model, created_at
      `,
      values: [workspaceId, title, artifactId, provider, model]
    };
  },
  findByIdForUser(quizId: string, userId: string): SqlQuery {
    return {
      text: `
        select q.id, q.workspace_id, q.title, q.artifact_id, q.provider, q.model, q.created_at
        from quizzes q
        join workspace_members m on m.workspace_id = q.workspace_id
        where q.id = $1 and m.user_id = $2
        limit 1
      `,
      values: [quizId, userId]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, title, artifact_id, provider, model, created_at
        from quizzes
        where workspace_id = $1
        order by created_at desc
      `,
      values: [workspaceId]
    };
  },
  listByWorkspaceForUser(userId: string, limit: number): SqlQuery {
    return {
      text: `
        select q.id, q.workspace_id, q.title, q.artifact_id, q.provider, q.model, q.created_at
        from quizzes q
        join workspace_members m on m.workspace_id = q.workspace_id
        where m.user_id = $1
        order by q.created_at desc
        limit $2
      `,
      values: [userId, limit]
    };
  }
};

export const quizQuestionQueries = {
  insert(
    quizId: string,
    conceptId: string | null,
    questionType: "mcq" | "true_false" | "short_answer",
    prompt: string,
    explanation: string,
    correctAnswerText: string,
    position: number
  ): SqlQuery {
    return {
      text: `
        insert into quiz_questions (
          quiz_id,
          concept_id,
          question_type,
          prompt,
          explanation,
          correct_answer_text,
          position
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, quiz_id, concept_id, question_type, prompt, explanation, correct_answer_text, position, created_at
      `,
      values: [quizId, conceptId, questionType, prompt, explanation, correctAnswerText, position]
    };
  },
  listByQuiz(quizId: string): SqlQuery {
    return {
      text: `
        select id, quiz_id, concept_id, question_type, prompt, explanation, correct_answer_text, position, created_at
        from quiz_questions
        where quiz_id = $1
        order by position asc
      `,
      values: [quizId]
    };
  }
};

export const quizQuestionOptionQueries = {
  insert(
    quizQuestionId: string,
    optionKey: string,
    optionText: string,
    isCorrect: boolean,
    position: number
  ): SqlQuery {
    return {
      text: `
        insert into quiz_question_options (
          quiz_question_id,
          option_key,
          option_text,
          is_correct,
          position
        )
        values ($1, $2, $3, $4, $5)
        returning id, quiz_question_id, option_key, option_text, is_correct, position, created_at
      `,
      values: [quizQuestionId, optionKey, optionText, isCorrect, position]
    };
  },
  listByQuiz(quizId: string): SqlQuery {
    return {
      text: `
        select o.id, o.quiz_question_id, o.option_key, o.option_text, o.is_correct, o.position, o.created_at
        from quiz_question_options o
        join quiz_questions q on q.id = o.quiz_question_id
        where q.quiz_id = $1
        order by q.position asc, o.position asc
      `,
      values: [quizId]
    };
  }
};

export const quizAttemptQueries = {
  start(quizId: string, userId: string): SqlQuery {
    return {
      text: `
        insert into quiz_attempts (quiz_id, user_id, status, started_at)
        values ($1, $2, 'in_progress', now())
        returning id, quiz_id, user_id, status, score_percent, correct_count, total_questions, started_at, submitted_at, created_at
      `,
      values: [quizId, userId]
    };
  },
  submit(
    attemptId: string,
    scorePercent: number,
    correctCount: number,
    totalQuestions: number
  ): SqlQuery {
    return {
      text: `
        update quiz_attempts
        set
          status = 'submitted',
          score_percent = $2,
          correct_count = $3,
          total_questions = $4,
          submitted_at = now()
        where id = $1
        returning id, quiz_id, user_id, status, score_percent, correct_count, total_questions, started_at, submitted_at, created_at
      `,
      values: [attemptId, scorePercent, correctCount, totalQuestions]
    };
  },
  findByIdForUser(attemptId: string, userId: string): SqlQuery {
    return {
      text: `
        select a.id, a.quiz_id, q.title as quiz_title, a.user_id, a.status, a.score_percent, a.correct_count, a.total_questions, a.started_at, a.submitted_at, a.created_at
        from quiz_attempts a
        join quizzes q on q.id = a.quiz_id
        join workspace_members m on m.workspace_id = q.workspace_id
        where a.id = $1 and a.user_id = $2 and m.user_id = $2
        limit 1
      `,
      values: [attemptId, userId]
    };
  },
  listRecentByWorkspace(workspaceId: string, limit: number): SqlQuery {
    return {
      text: `
        select a.id, a.quiz_id, a.user_id, a.status, a.score_percent, a.correct_count, a.total_questions, a.started_at, a.submitted_at, a.created_at
        from quiz_attempts a
        join quizzes q on q.id = a.quiz_id
        where q.workspace_id = $1 and a.status = 'submitted'
        order by a.submitted_at desc nulls last
        limit $2
      `,
      values: [workspaceId, limit]
    };
  },
  listRecentByWorkspaceSince(workspaceId: string, limit: number, sinceDays: number): SqlQuery {
    return {
      text: `
        select a.id, a.quiz_id, a.user_id, a.status, a.score_percent, a.correct_count, a.total_questions, a.started_at, a.submitted_at, a.created_at
        from quiz_attempts a
        join quizzes q on q.id = a.quiz_id
        where
          q.workspace_id = $1
          and a.status = 'submitted'
          and a.submitted_at is not null
          and a.submitted_at >= now() - ($3 * interval '1 day')
        order by a.submitted_at desc
        limit $2
      `,
      values: [workspaceId, limit, sinceDays]
    };
  },
  listRecentByWorkspaceForUserSince(
    workspaceId: string,
    userId: string,
    limit: number,
    sinceDays: number
  ): SqlQuery {
    return {
      text: `
        select a.id, a.quiz_id, q.title as quiz_title, a.user_id, a.status, a.score_percent, a.correct_count, a.total_questions, a.started_at, a.submitted_at, a.created_at
        from quiz_attempts a
        join quizzes q on q.id = a.quiz_id
        where
          q.workspace_id = $1
          and a.user_id = $2
          and a.status = 'submitted'
          and a.submitted_at is not null
          and a.submitted_at >= now() - ($4 * interval '1 day')
        order by a.submitted_at desc
        limit $3
      `,
      values: [workspaceId, userId, limit, sinceDays]
    };
  },
  findPreviousSubmittedForQuizForUser(
    quizId: string,
    userId: string,
    submittedAtIso: string
  ): SqlQuery {
    return {
      text: `
        select a.id, a.quiz_id, q.title as quiz_title, a.user_id, a.status, a.score_percent, a.correct_count, a.total_questions, a.started_at, a.submitted_at, a.created_at
        from quiz_attempts a
        join quizzes q on q.id = a.quiz_id
        join workspace_members m on m.workspace_id = q.workspace_id
        where
          a.quiz_id = $1
          and a.user_id = $2
          and m.user_id = $2
          and a.status = 'submitted'
          and a.submitted_at is not null
          and a.submitted_at < $3::timestamptz
        order by a.submitted_at desc
        limit 1
      `,
      values: [quizId, userId, submittedAtIso]
    };
  }
};

export const quizAttemptAnswerQueries = {
  upsert(
    quizAttemptId: string,
    quizQuestionId: string,
    selectedOptionId: string | null,
    answerText: string | null,
    isCorrect: boolean
  ): SqlQuery {
    return {
      text: `
        insert into quiz_attempt_answers (
          quiz_attempt_id,
          quiz_question_id,
          selected_option_id,
          answer_text,
          is_correct
        )
        values ($1, $2, $3, $4, $5)
        on conflict (quiz_attempt_id, quiz_question_id)
        do update set
          selected_option_id = excluded.selected_option_id,
          answer_text = excluded.answer_text,
          is_correct = excluded.is_correct,
          updated_at = now()
        returning id, quiz_attempt_id, quiz_question_id, selected_option_id, answer_text, is_correct, created_at, updated_at
      `,
      values: [quizAttemptId, quizQuestionId, selectedOptionId, answerText, isCorrect]
    };
  },
  listByAttempt(quizAttemptId: string): SqlQuery {
    return {
      text: `
        select id, quiz_attempt_id, quiz_question_id, selected_option_id, answer_text, is_correct, created_at, updated_at
        from quiz_attempt_answers
        where quiz_attempt_id = $1
      `,
      values: [quizAttemptId]
    };
  },
  listReviewByAttemptForUser(quizAttemptId: string, userId: string): SqlQuery {
    return {
      text: `
        select
          a.id,
          a.quiz_attempt_id,
          a.quiz_question_id,
          a.selected_option_id,
          a.answer_text,
          a.is_correct,
          q.prompt,
          q.explanation,
          q.correct_answer_text,
          q.question_type,
          q.position,
          c.id as concept_id,
          c.title as concept_title,
          o.option_text as selected_option_text
        from quiz_attempt_answers a
        join quiz_attempts qa on qa.id = a.quiz_attempt_id
        join quizzes z on z.id = qa.quiz_id
        join workspace_members m on m.workspace_id = z.workspace_id
        join quiz_questions q on q.id = a.quiz_question_id
        left join concepts c on c.id = q.concept_id
        left join quiz_question_options o on o.id = a.selected_option_id
        where a.quiz_attempt_id = $1 and qa.user_id = $2 and m.user_id = $2
        order by q.position asc
      `,
      values: [quizAttemptId, userId]
    };
  },
  listScoredByAttemptForUser(quizAttemptId: string, userId: string): SqlQuery {
    return {
      text: `
        select
          a.quiz_question_id,
          a.is_correct,
          q.question_type,
          c.id as concept_id,
          c.title as concept_title
        from quiz_attempt_answers a
        join quiz_attempts qa on qa.id = a.quiz_attempt_id
        join quizzes z on z.id = qa.quiz_id
        join workspace_members m on m.workspace_id = z.workspace_id
        join quiz_questions q on q.id = a.quiz_question_id
        left join concepts c on c.id = q.concept_id
        where a.quiz_attempt_id = $1 and qa.user_id = $2 and m.user_id = $2
      `,
      values: [quizAttemptId, userId]
    };
  }
};

export const flashcardQueries = {
  insert(
    workspaceId: string,
    front: string,
    back: string,
    conceptId: string | null,
    source: "quiz_miss" | "concept" = "quiz_miss"
  ): SqlQuery {
    return {
      text: `
        insert into flashcards (workspace_id, front, back, concept_id, source)
        values ($1, $2, $3, $4, $5)
        returning id, workspace_id, front, back, concept_id, source, ease_factor, interval_days, repetition_count, next_review_at, last_reviewed_at, created_at
      `,
      values: [workspaceId, front, back, conceptId, source]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, front, back, concept_id, source, ease_factor, interval_days, repetition_count, next_review_at, last_reviewed_at, created_at
        from flashcards
        where workspace_id = $1
        order by next_review_at asc, created_at desc
      `,
      values: [workspaceId]
    };
  },
  listByWorkspaceForUser(workspaceId: string, userId: string, limit: number): SqlQuery {
    return {
      text: `
        select f.id, f.workspace_id, f.front, f.back, f.concept_id, c.title as concept_title, f.source, f.ease_factor, f.interval_days, f.repetition_count, f.next_review_at, f.last_reviewed_at, f.created_at
        from flashcards f
        join workspace_members m on m.workspace_id = f.workspace_id
        left join concepts c on c.id = f.concept_id
        where f.workspace_id = $1 and m.user_id = $2
        order by f.next_review_at asc, f.created_at desc
        limit $3
      `,
      values: [workspaceId, userId, limit]
    };
  },
  listDueByWorkspaceForUser(workspaceId: string, userId: string, limit: number): SqlQuery {
    return {
      text: `
        select f.id, f.workspace_id, f.front, f.back, f.concept_id, c.title as concept_title, f.source, f.ease_factor, f.interval_days, f.repetition_count, f.next_review_at, f.last_reviewed_at, f.created_at
        from flashcards f
        join workspace_members m on m.workspace_id = f.workspace_id
        left join concepts c on c.id = f.concept_id
        where f.workspace_id = $1 and m.user_id = $2 and f.next_review_at <= now()
        order by f.next_review_at asc, f.created_at asc
        limit $3
      `,
      values: [workspaceId, userId, limit]
    };
  },
  findByIdForUser(flashcardId: string, userId: string): SqlQuery {
    return {
      text: `
        select f.id, f.workspace_id, f.front, f.back, f.concept_id, c.title as concept_title, f.source, f.ease_factor, f.interval_days, f.repetition_count, f.next_review_at, f.last_reviewed_at, f.created_at
        from flashcards f
        join workspace_members m on m.workspace_id = f.workspace_id
        left join concepts c on c.id = f.concept_id
        where f.id = $1 and m.user_id = $2
        limit 1
      `,
      values: [flashcardId, userId]
    };
  },
  applyReviewUpdate(
    flashcardId: string,
    easeFactor: number,
    intervalDays: number,
    repetitionCount: number,
    nextReviewAtIso: string
  ): SqlQuery {
    return {
      text: `
        update flashcards
        set
          ease_factor = $2,
          interval_days = $3,
          repetition_count = $4,
          last_reviewed_at = now(),
          next_review_at = $5::timestamptz
        where id = $1
        returning id, workspace_id, front, back, concept_id, source, ease_factor, interval_days, repetition_count, next_review_at, last_reviewed_at, created_at
      `,
      values: [flashcardId, easeFactor, intervalDays, repetitionCount, nextReviewAtIso]
    };
  }
};

export const flashcardReviewQueries = {
  insert(
    flashcardId: string,
    userId: string,
    recallScore: number,
    scheduledIntervalDays: number,
    nextReviewAtIso: string
  ): SqlQuery {
    return {
      text: `
        insert into flashcard_reviews (
          flashcard_id,
          user_id,
          recall_score,
          scheduled_interval_days,
          next_review_at
        )
        values ($1, $2, $3, $4, $5::timestamptz)
        returning id, flashcard_id, user_id, recall_score, reviewed_at, scheduled_interval_days, next_review_at
      `,
      values: [flashcardId, userId, recallScore, scheduledIntervalDays, nextReviewAtIso]
    };
  }
};

export const planQueries = {
  upsert(workspaceId: string, title: string): SqlQuery {
    return {
      text: `
        insert into learning_plans (workspace_id, title)
        values ($1, $2)
        on conflict (workspace_id) do update set title = excluded.title
        returning id, workspace_id, title, updated_at
      `,
      values: [workspaceId, title]
    };
  },
  getByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, title, updated_at
        from learning_plans
        where workspace_id = $1
        limit 1
      `,
      values: [workspaceId]
    };
  }
};

export const planMilestoneQueries = {
  insert(learningPlanId: string, title: string, dueDate: string | null): SqlQuery {
    return {
      text: `
        insert into learning_plan_milestones (learning_plan_id, title, due_date)
        values ($1, $2, $3::date)
        returning id, learning_plan_id, title, due_date, completed_at
      `,
      values: [learningPlanId, title, dueDate]
    };
  },
  listByPlan(learningPlanId: string): SqlQuery {
    return {
      text: `
        select id, learning_plan_id, title, due_date, completed_at
        from learning_plan_milestones
        where learning_plan_id = $1
        order by due_date asc nulls last, title asc
      `,
      values: [learningPlanId]
    };
  },
  findByIdForUser(milestoneId: string, userId: string): SqlQuery {
    return {
      text: `
        select lm.id, lm.learning_plan_id, lm.title, lm.due_date, lm.completed_at
        from learning_plan_milestones lm
        join learning_plans lp on lp.id = lm.learning_plan_id
        join workspace_members m on m.workspace_id = lp.workspace_id
        where lm.id = $1 and m.user_id = $2
        limit 1
      `,
      values: [milestoneId, userId]
    };
  },
  setCompleted(milestoneId: string, isCompleted: boolean): SqlQuery {
    return {
      text: `
        update learning_plan_milestones
        set completed_at = case when $2 then now() else null end
        where id = $1
        returning id, learning_plan_id, title, due_date, completed_at
      `,
      values: [milestoneId, isCompleted]
    };
  }
};

export const resourceQueries = {
  insert(
    workspaceId: string,
    title: string,
    url: string | null,
    noteText: string | null,
    tags: string[]
  ): SqlQuery {
    return {
      text: `
        insert into resources (workspace_id, title, url, note_text, tags)
        values ($1, $2, $3, $4, $5::text[])
        returning id, workspace_id, title, url, note_text, tags, created_at
      `,
      values: [workspaceId, title, url, noteText, tags]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, title, url, note_text, tags, created_at
        from resources
        where workspace_id = $1
        order by created_at desc
      `,
      values: [workspaceId]
    };
  },
  listByWorkspaceFiltered(workspaceId: string, searchTerm: string | null, tag: string | null): SqlQuery {
    return {
      text: `
        select id, workspace_id, title, url, note_text, tags, created_at
        from resources
        where
          workspace_id = $1
          and (
            $2::text is null
            or title ilike '%' || $2 || '%'
            or coalesce(url, '') ilike '%' || $2 || '%'
            or coalesce(note_text, '') ilike '%' || $2 || '%'
          )
          and (
            $3::text is null
            or $3 = any(tags)
          )
        order by created_at desc
      `,
      values: [workspaceId, searchTerm, tag]
    };
  }
};

export const progressQueries = {
  insert(workspaceId: string, eventType: string, payloadJson: string): SqlQuery {
    return {
      text: `
        insert into progress_events (workspace_id, event_type, payload_json)
        values ($1, $2, $3::jsonb)
        returning id, workspace_id, event_type, payload_json, created_at
      `,
      values: [workspaceId, eventType, payloadJson]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, event_type, payload_json, created_at
        from progress_events
        where workspace_id = $1
        order by created_at desc
      `,
      values: [workspaceId]
    };
  }
};

export const conceptExampleQueries = {
  insert(
    conceptId: string,
    exampleType: "example" | "case_study",
    title: string,
    body: string
  ): SqlQuery {
    return {
      text: `
        insert into concept_examples (concept_id, example_type, title, body)
        values ($1, $2, $3, $4)
        returning id, concept_id, example_type, title, body, created_at
      `,
      values: [conceptId, exampleType, title, body]
    };
  },
  listByConcept(conceptId: string): SqlQuery {
    return {
      text: `
        select id, concept_id, example_type, title, body, created_at
        from concept_examples
        where concept_id = $1
        order by created_at asc
      `,
      values: [conceptId]
    };
  }
};

export const conceptArtifactQueries = {
  insert(
    workspaceId: string,
    topic: string,
    difficulty: string,
    artifactVersion: number,
    provider: string,
    model: string,
    createdByUserId: string
  ): SqlQuery {
    return {
      text: `
        insert into concept_generation_artifacts (
          workspace_id,
          topic,
          difficulty,
          artifact_version,
          provider,
          model,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, workspace_id, topic, difficulty, artifact_version, provider, model, created_by_user_id, created_at
      `,
      values: [
        workspaceId,
        topic,
        difficulty,
        artifactVersion,
        provider,
        model,
        createdByUserId
      ]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, topic, difficulty, artifact_version, provider, model, created_by_user_id, created_at
        from concept_generation_artifacts
        where workspace_id = $1
        order by created_at desc
      `,
      values: [workspaceId]
    };
  },
  findByIdForUser(artifactId: string, userId: string): SqlQuery {
    return {
      text: `
        select a.id, a.workspace_id, a.topic, a.difficulty, a.artifact_version, a.provider, a.model, a.created_by_user_id, a.created_at
        from concept_generation_artifacts a
        join workspace_members m on m.workspace_id = a.workspace_id
        where a.id = $1 and m.user_id = $2
        limit 1
      `,
      values: [artifactId, userId]
    };
  }
};
