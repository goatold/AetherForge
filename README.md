# AetherForge

AetherForge is an AI-powered learning app focused on helping users learn a chosen topic through concept maps, interactive examples, quizzes, spaced-repetition flashcards, and guided learning plans.

## Getting Started

1. Install dependencies:
   - `npm install`
2. Start development server:
   - `npm run dev`
3. Open:
   - `http://localhost:3000`

## Smoke Regression

- Pre-Phase-3 baseline smoke test:
  - `npm run test:smoke:pre-phase3`
- Optional target URL:
  - `python3 scripts/tests/pre_phase3_smoke.py --base-url http://localhost:3002`

## Initial Scope

- Single-topic MVP with selectable difficulty
- AI-generated concept graph and examples
- Quiz generation, evaluation, and feedback
- Spaced repetition flashcards
- Learning plans and progress tracking
- Printable export for offline study
- Sharing and collaboration with role-based permissions
