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

- `src/app/(marketing)` and `src/app/(app)` route groups are in place with authenticated workspace navigation.
- Session auth, protected routes, and DB-backed workspace membership flows are implemented.
- Onboarding now supports persisted topic, difficulty, and learning goals via `GET/PATCH /api/workspace`.
- Concept generation/artifact lineage, quiz attempt/review/compare, and flashcard SRS queue/review APIs are implemented.
- Plan milestones, progress timeline, resources CRUD/filtering, study-packet export, collaboration invites/roles, and internal reliability endpoints are available.
- Reliability/security hardening now includes optimistic-concurrency protections (resources, milestones, collaboration role/revoke), least-privilege invite visibility, internal-job overlap guards, and dedicated smoke suites for Phase 6 and internal reliability contracts.
- `src/app/globals.css` provides shared workspace styling, and `package.json` includes the scripts needed for migrations, jobs, health checks, linting, and build.

This means AetherForge is now a functional MVP baseline with core workflows implemented and hardened; remaining work is focused on OAuth/API provider implementation and pilot release-gate execution.

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

Build has progressed substantially; this sequence is now the delivery lineage and remaining implementation order:

1. Foundation route skeletons and shared domain contracts (completed).
2. Auth and persistence layer (completed).
3. AI orchestration and generation contracts (completed).
4. Practice loops (quiz + flashcards + scheduling) (completed with hardening coverage).
5. Planning/resources workflows (completed with hardening coverage).
6. Export/collaboration (completed with hardening coverage).
7. Reliability and release hardening (completed baseline; release-gate execution ongoing).
8. OAuth/API provider track (remaining implementation milestone).

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
- `src/lib/ai/` - Schema validators, provider adapters, and manual provider-session orchestration.
- `src/lib/db/` - DB client, query modules, migration helpers.
- `src/lib/srs/` - Spaced-repetition scheduling logic.
- `src/lib/export/` - Print templates and render pipeline.
- `src/lib/collab/` - Permissions, invites, comments, and version checks.
- `src/lib/observability/` - Logging, metrics, tracing integration points.

## Phase Plan (Execution Roadmap)

### Status Snapshot (Updated)

- Overall: core MVP workflows are implemented end-to-end with deterministic hardening coverage across collaboration, AI session/generation contracts, internal reliability endpoints/jobs, and auth sign-out behavior.
- Phase 0: complete.
- Phase 1: complete.
- Phase 2: complete.
- Phase 3: complete (including lifecycle/compare/retry reliability coverage).
- Phase 4: complete (including generation/review contract and scheduler reliability coverage).
- Phase 5: complete (including plan/progress/resources hardening).
- Phase 6: complete (including export/collaboration hardening and conflict safety).
- Phase 7: complete baseline (runbooks/checklists and consolidated reliability gates in place).
- Remaining implementation milestone: OAuth/API provider track (`oauth_api` mode).
- Remaining release activity: execute pilot release gates/sign-off in staging.

### Phase 0 - Foundation Establishment (Completed)

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

### Phase 1 - Auth and Data Foundation (Completed)

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

### Phase 2 - Concept Generation and Explorer (Completed)

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

### Phase 3 - Quiz and Feedback Loop (Completed)

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

### Phase 4 - Flashcards and Spaced Repetition (Completed)

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

### Phase 5 - Plans, Progress, and Resources (Completed)

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

### Phase 6 - Export and Collaboration (Completed)

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

### Phase 7 - Reliability and Pilot Readiness (Completed Baseline)

**Deliverables**

- Metrics, tracing, and error monitoring hooks.
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
- AI quality: schema-valid generation success rate meets internal threshold (95%).
- Usability: phase demos complete without manual DB intervention.

## Definition of Done

- Current scaffold evolves into a functional MVP across all scoped flows.
- Phases are implemented in dependency order with exit criteria met.
- Architecture and structure remain aligned to `src/app` repository layout.
- Release gates are met and pilot launch checklist is complete.

## AI Browser-Auth Redesign Tracking (Merged)

### Objective

Transition AetherForge AI generation from `OPENAI_API_KEY` server API calls to an interactive, user-authenticated browser-interface model (multi-provider), while keeping concept/quiz payload contracts stable for the rest of the app.

### Current Progress

- Completed: moved generation to connected provider-session gating and removed `OPENAI_API_KEY` runtime dependency.
- Completed: stabilized app-facing generation contracts while enforcing connection-required behavior (`409` when disconnected).
- Completed: hardened provider-session contract (allowlist, canonical provider/login URL, bounded/safe `modelHint`, canonical formatting checks).
- Completed: added deterministic reliability coverage for AI connection/generation path/provider attribution, including provider-matrix smoke support.
- Current mode: `browser_ui` is implemented and production path for MVP.
- Remaining: execute OAuth/API provider track (`oauth_api`), then cut over by mode-specific reliability/quality gates.

### Scope Decisions Captured

- Proceed with browser-automation design despite brittleness/ToS risk.
- Target multiple public web interfaces (not ChatGPT-only).
- Keep existing generation endpoints (`/api/concepts/generate`, `/api/quiz/generate`) as the app-facing contract.
- Add an explicit future implementation option for official OAuth/API-based provider integrations.

### Future Option: OAuth/API Provider Track

- Design for pluggability now: keep a provider abstraction so browser drivers and OAuth/API providers share the same orchestration contract.
- Add future data model support for user-scoped OAuth credentials (encrypted tokens, refresh rotation, scopes, revocation metadata).
- Add provider-specific OAuth connect flows in settings (consent, reconnect, revoke) as a separate milestone.
- Promote OAuth/API providers to the default execution path once feature parity and reliability targets are met; keep browser automation as fallback only during transition.
- Update AI quality and reliability gates to report by provider mode (`browser_ui` vs `oauth_api`) to validate cutover readiness.
