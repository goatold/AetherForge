# Database Foundation (Phase 1)

This folder contains the PostgreSQL baseline for AetherForge Phase 1.

## Migration workflow

- Add SQL files to `src/lib/db/migrations/` with increasing numeric prefixes.
- Apply them with:
  - `npm run db:migrate`

## Seed workflow

- Add deterministic dev/test data to `src/lib/db/seed/`.
- Apply with:
  - `npm run db:seed`

## Environment

Set `DATABASE_URL` before running migration/seed scripts.

## Query helpers

Typed query builders live in `src/lib/db/repositories/core.ts` and cover:

- users
- workspaces
- concepts
- quizzes
- flashcards
- learning plans
- resources
- progress events
