# AetherForge Pilot Release Checklist

Use this checklist before cutting a pilot/MVP release. Aligns with Release Gates in [plan.md](./plan.md).

## Release Gates (MVP)

### 1. Performance

- [ ] **Typical page transitions under 2s in staging**
  - Navigate: Landing → Sign-in → Learn → Artifact detail → Concept detail.
  - Navigate: Learn → Quiz → Start attempt → Submit.
  - Navigate: Learn → Flashcards → Review session.
  - If any transition exceeds ~2s, capture route and environment for follow-up.

### 2. Reliability

- [ ] **No critical-severity blocker in core user loop**
  - Run [manual regression checklist](./manual-regression-checklist.md) and resolve any FAIL in sections 1–6.
  - Run `npm run test:smoke:pre-phase3` (and extended MVP smoke if available); all checks must pass.
  - Run `npm run health:check`; status must be `ok` or documented degraded.

### 3. Security / Privacy

- [ ] **User data isolation verified**
  - Two-account test: User A and User B each create content; confirm no cross-workspace visibility via UI and API.
  - Collaboration: invite flow and role boundaries (owner/editor/viewer) behave as documented.

### 4. AI Quality

- [ ] **Schema-valid generation success rate meets internal threshold**
  - If using real AI provider: run several concept and quiz generations; note schema validation failures.
  - Define acceptable failure rate (e.g. &lt;5%) and document or fix causes.

### 5. Usability

- [ ] **Phase demos complete without manual DB intervention**
  - Full flow: Onboarding → Learn (generate + browse) → Quiz (attempt + feedback) → Flashcards (generate + review) → Plan → Resources → Export → Collaboration.
  - No steps require direct DB edits or secret env tweaks for normal operation.

---

## Pre-Release Commands

| Action | Command |
|--------|--------|
| Lint | `npm run lint` |
| Build | `npm run build` |
| Health check | `npm run health:check` |
| Smoke test | `npm run test:smoke:pre-phase3` (optional: extended MVP smoke) |
| Phase 6 hardening smoke | `npm run test:smoke:phase6-hardening` |
| Migrations | `npm run db:migrate` (staging DB) |

---

## Sign-Off

- [ ] All release gates above checked.
- [ ] [Reliability runbook](./reliability-runbook.md) reviewed and accessible to operators.
- [ ] Known issues and workarounds documented (e.g. in runbook or CHANGELOG).

**Pilot release recommendation:** Go / No-Go  
**Date:** _____________  
**Responsible:** _____________
