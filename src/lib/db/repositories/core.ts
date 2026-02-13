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
  }
};

export const quizQueries = {
  insert(workspaceId: string, title: string): SqlQuery {
    return {
      text: `
        insert into quizzes (workspace_id, title)
        values ($1, $2)
        returning id, workspace_id, title, created_at
      `,
      values: [workspaceId, title]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, title, created_at
        from quizzes
        where workspace_id = $1
        order by created_at desc
      `,
      values: [workspaceId]
    };
  }
};

export const flashcardQueries = {
  insert(workspaceId: string, front: string, back: string): SqlQuery {
    return {
      text: `
        insert into flashcards (workspace_id, front, back)
        values ($1, $2, $3)
        returning id, workspace_id, front, back, created_at
      `,
      values: [workspaceId, front, back]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, front, back, created_at
        from flashcards
        where workspace_id = $1
        order by created_at desc
      `,
      values: [workspaceId]
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

export const resourceQueries = {
  insert(workspaceId: string, title: string, url: string | null): SqlQuery {
    return {
      text: `
        insert into resources (workspace_id, title, url)
        values ($1, $2, $3)
        returning id, workspace_id, title, url, created_at
      `,
      values: [workspaceId, title, url]
    };
  },
  listByWorkspace(workspaceId: string): SqlQuery {
    return {
      text: `
        select id, workspace_id, title, url, created_at
        from resources
        where workspace_id = $1
        order by created_at desc
      `,
      values: [workspaceId]
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
