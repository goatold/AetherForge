---
name: AetherForge Project Plan
overview: Delivery roadmap for building the current AetherForge Next.js scaffold into a single-topic MVP with AI learning flows, export, collaboration, and release-readiness gates.
isProject: true
---

# AetherForge Project Plan (Current App)

## Goal

Build the current AetherForge app from its existing baseline into an MVP that supports:

- Topic onboarding and guided learning objectives.
- AI-generated concept exploration and examples.
- Quiz practice and actionable feedback.
- Spaced-repetition flashcards.
- Learning plans, progress tracking, and notes workspace.
- Printable exports and role-based collaboration.

## Current Baseline

Current repository state:

- `src/app/layout.tsx` defines app metadata and a minimal root layout.
- `src/app/page.tsx` renders a static landing page only.
- `src/app/globals.css` contains global styles and Tailwind layers.
- `package.json` includes Next.js, React, TypeScript, ESLint, and Tailwind, but no backend/data/auth integrations yet.
- `README.md` describes the intended MVP feature set.

This means AetherForge is currently in a scaffold stage with branding and no implemented product workflows.

## Product Scope

### In Scope (MVP)

- Single-topic learning experience per workspace.
- Difficulty-aware content generation.
- Concept tree plus concept detail pages with examples/case studies.
- Quiz generation, attempts, scoring, and feedback.
- Flashcard generation and spaced repetition review queue.
- Learning plans, progress timeline, and lightweight notes/resources.
- Printable export for concept summaries, quizzes, flashcards, and plans.
- Sharing and collaboration with owner/editor/viewer roles.

### Out of Scope (MVP)

- Multi-topic cross-workspace analytics and recommendations.
- Native mobile apps.
- Real-time co-editing with operational transforms/CRDT.
- Enterprise SSO and advanced compliance controls.
- Marketplace/plugin ecosystem.

## Delivery Strategy

- Build vertically by user journey while keeping shared contracts stable.
- Lock schemas early for generated content artifacts to reduce churn.
- Prefer server-side writes via route handlers/server actions to keep security boundaries simple.
- Add observability and testing in each phase, not as a last-step add-on.

## Target Architecture

```mermaid
flowchart LR
    user[User] --> nextApp[NextJsAppRouter]
    nextApp --> uiRoutes[UiRouteGroups]
    uiRoutes --> apiLayer[RouteHandlersAndServerActions]
    apiLayer --> dbLayer[PostgreSQLAndMigrations]
    apiLayer --> aiLayer[AIOrchestrationLayer]
    apiLayer --> jobLayer[BackgroundJobRunner]
    apiLayer --> exportLayer[PrintAndPdfExport]
    apiLayer --> collabLayer[SharingAndPermissions]
    jobLayer --> dbLayer
    aiLayer --> dbLayer
    collabLayer --> dbLayer
```

### Incremental Build Order

1. UI route skeletons and shared domain types.
2. Auth and persistence layer.
3. AI orchestration and generation contracts.
4. Practice loops (quiz + flashcards + scheduling).
5. Planning/resources workflows.
6. Export/collaboration.
7. Reliability and release hardening.

## Planned Project Structure (Repository-Aligned)

- `src/app/` - App Router entrypoints and route groups.
- `src/app/(marketing)/` - Landing and public pages.
- `src/app/(app)/onboarding/` - Topic, difficulty, goals setup.
- `src/app/(app)/learn/` - Concept explorer and concept details.
- `src/app/(app)/quiz/` - Quiz generation, attempts, and results.
- `src/app/(app)/flashcards/` - Decks and review sessions.
- `src/app/(app)/plan/` - Learning plan and progress dashboards.
- `src/app/(app)/resources/` - Notes, highlights, and references.
- `src/app/api/` - API route handlers (generation, progress, sharing, export).
- `src/components/` - Reusable UI components.
- `src/lib/ai/` - Prompt templates, schema validators, provider adapters.
- `src/lib/db/` - DB client, query modules, migration helpers.
- `src/lib/srs/` - Spaced-repetition scheduling logic.
- `src/lib/export/` - Print templates and render pipeline.
- `src/lib/collab/` - Permissions, invites, comments, and version checks.
- `src/lib/observability/` - Logging, metrics, tracing integration points.

## Phase Plan (Execution Roadmap)

### Status Snapshot (Updated)

- Phase 0: complete.
- Phase 1: complete (auth/session guardrails, DB schema+migrations+seed pipeline, and DB-backed workspace access by signed-in user).
- Phase 2: complete (provider-backed concept generation path with strict validation, artifact lineage persistence, and explorer/detail + artifact graph/reload flows).
- Phase 3: in progress (quiz generation from concepts, attempt start/submit scoring flow, concept-linked weak-area feedback, attempt trend visibility with timeframe query support, deep-linkable question-by-question review pages, attempt comparison analytics across workspace and per-attempt views, and targeted retry quiz generation from weak concepts).
- Phase 4: in progress (flashcard generation from quiz misses, SM-2-style scheduler utility, due-queue API, review scoring endpoint, and flashcards workspace UI replacing placeholder page).

### Phase 0 (Week 1) - Foundation Hardening

**Deliverables**

- Standard route group skeleton under `src/app/(marketing)` and `src/app/(app)`.
- Shared TypeScript domain types and DTO contracts.
- Environment variable strategy and runtime validation scaffold.
- Basic app shell navigation placeholders for future features.

**Dependencies**

- Existing Next.js scaffold only.

**Exit Criteria**

- App builds with route groups in place.
- Shared types are consumed by at least one route and one API handler scaffold.
- Local env bootstraps consistently across machines.

**Demo Checklist**

- Navigate from landing to authenticated app shell placeholder.
- Show typed contract reuse between UI and backend layer.

### Phase 1 (Week 2) - Auth and Data Foundation

**Deliverables**

- Authentication flow (sign in/out and protected app routes).
- Initial PostgreSQL schema: users, workspace, concepts, quizzes, flashcards, plans, resources, progress.
- Migration pipeline and seed strategy.
- Repository query helpers for core entities.

**Dependencies**

- Phase 0 route and contract baseline.

**Exit Criteria**

- User can sign in and access only their own workspace data.
- Core entities can be created/read in dev and test environments.

**Demo Checklist**

- Complete login and create initial workspace profile.
- Verify data isolation between two test accounts.

### Phase 2 (Weeks 3-4) - Concept Generation and Explorer

**Deliverables**

- AI concept graph generation endpoint with strict schema validation.
- Concept explorer UI with drill-down to concept detail pages.
- Generated examples/case studies linked to concept nodes.
- Artifact versioning and provenance metadata persistence.

**Dependencies**

- Auth and database entities from Phase 1.

**Exit Criteria**

- User can generate a concept graph for selected topic and difficulty.
- Saved generation artifacts can be reloaded without regeneration.

**Demo Checklist**

- Generate and browse concept graph in one session.
- Reload app and view persisted concept graph and examples.

### Phase 3 (Weeks 5-6) - Quiz and Feedback Loop

**Deliverables**

- Quiz generation from concept graph with mixed question types.
- Quiz attempt lifecycle (start, answer, submit, score).
- Feedback page with weak-area suggestions and next actions.
- History of attempts and trend indicators.

**Dependencies**

- Concept artifacts and user progress model.

**Exit Criteria**

- User completes a full quiz attempt and receives actionable feedback.
- Quiz history is queryable by workspace and timeframe.

**Demo Checklist**

- Run a quiz and inspect question-by-question evaluation.
- Display trend from multiple attempts.

### Phase 4 (Weeks 7-8) - Flashcards and Spaced Repetition

**Deliverables**

- Flashcard generation from concepts and quiz misses.
- Scheduling engine for daily review queue.
- Review session UI with recall scoring and interval updates.
- Background job for queue refresh and overdue handling.

**Dependencies**

- Quiz performance signals from Phase 3.

**Exit Criteria**

- User has a daily review queue that changes based on recall scores.
- Scheduler updates are idempotent and traceable.

**Demo Checklist**

- Generate flashcards from weak concepts.
- Complete review session and show updated next-review dates.

### Phase 5 (Weeks 9-10) - Plans, Progress, and Resources

**Deliverables**

- Learning plan editor with milestones and deadlines.
- Progress dashboard combining concept, quiz, and flashcard activity.
- Notes/highlights/summaries workspace with tagging.
- Resource link metadata storage and retrieval.

**Dependencies**

- Stable concept/quiz/flashcard data flow from Phases 2-4.

**Exit Criteria**

- User can maintain a plan and see progress updates from completed activities.
- Notes/resources remain persisted and searchable per workspace.

**Demo Checklist**

- Create a plan and complete one milestone-linked learning activity.
- Add notes and retrieve them by tag.

### Phase 6 (Weeks 11-12) - Export and Collaboration

**Deliverables**

- Printable templates for concept summaries, quizzes, flashcards, and plan pages.
- Export flow (print view first, PDF optional).
- Sharing model with `owner`, `editor`, `viewer` roles.
- Invite and revoke flows plus comments on shared assets.
- Version-check strategy to avoid silent overwrite.

**Dependencies**

- Data completeness from previous phases.

**Exit Criteria**

- User exports selected materials with readable A4/Letter layouts.
- Shared asset permissions are enforced correctly across roles.

**Demo Checklist**

- Export a study packet with optional answer key.
- Share with another account, test editor/viewer boundaries.

### Phase 7 (Weeks 13-14) - Reliability and Pilot Readiness

**Deliverables**

- Metrics, tracing, and error monitoring hooks.
- Retries/fallbacks for AI provider failures.
- AI output quality checks and schema failure alerts.
- Pilot release checklist and operational runbook.

**Dependencies**

- All feature paths integrated end-to-end.

**Exit Criteria**

- MVP meets release gates (below) in staging.
- End-to-end user journey passes regression suite.

**Demo Checklist**

- Show dashboard for request latency, generation failures, and queue health.
- Run full onboarding-to-review flow in candidate build.

## Permission Model (MVP)

- `owner`: full control including sharing, revocation, and deletion.
- `editor`: can modify content, comment, and export.
- `viewer`: read-only; comments optional per share policy.
- Default share role is least privilege (`viewer`).
- Role changes and revocations are audited.
- Access revocation invalidates active invite tokens immediately.

## Export Specification (MVP)

- Output modes: browser print (required), PDF export (optional).
- Page sizes: A4 and Letter.
- Templates: concept summary, quiz booklet, flashcard sheet, plan tracker.
- Controls: include/exclude sections, compact/detailed mode, answer key toggle.
- Print quality constraints: grayscale-safe contrast, no clipping at standard margins.
- Mandatory provenance line on exported content.

## Risk Register

- AI output variability may break downstream rendering or grading assumptions.
- Generation latency may degrade UX during multi-step content creation.
- Data schema churn can slow delivery if contracts are not stabilized early.
- Collaboration conflicts may create accidental data loss without version checks.
- Export rendering differences across browsers may impact print fidelity.

## Testing Strategy

### Unit

- SRS interval calculations and queue scoring.
- Permission evaluation helpers.
- Prompt response normalization and schema parsing.

### Integration

- Generation pipeline from request to persisted artifacts.
- Quiz submission and feedback persistence.
- Sharing and revocation behavior across roles.
- Export assembly for selected modules.

### End-to-End

- Full user loop: onboarding -> concepts -> quiz -> feedback -> flashcards -> progress.
- Share-and-collaborate path with two users.
- Export-and-print path with multiple template combinations.

## Release Gates (MVP)

- Performance: typical page transitions under 2s in staging baseline.
- Reliability: no critical-severity blocker in core user loop.
- Security/privacy: user data isolation verified in access tests.
- AI quality: schema-valid generation success rate meets internal threshold.
- Usability: phase demos complete without manual DB intervention.

## Team and Timeline Assumptions

- Small team (2-4 engineers) with parallel frontend/backend execution.
- AI provider credentials and infrastructure are available before Phase 2.
- Timeline targets MVP readiness, not enterprise scale optimization.
- If staffing is part-time, timeline should be adjusted by roughly 1.5-2x.

## Definition of Done

- Current scaffold evolves into a functional MVP across all scoped flows.
- Phases are implemented in dependency order with exit criteria met.
- Architecture and structure remain aligned to `src/app` repository layout.
- Release gates are met and pilot launch checklist is complete.
