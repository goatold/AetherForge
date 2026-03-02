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
  - Connection mode contract for MVP: `browser_ui` is supported; `oauth_api` must be rejected until the future OAuth/API milestone lands.
  - Threshold: **>=95%** success for both concept and quiz generation runs.
  - Gate command (real provider required): `npm run test:quality:ai-schema`
  - If gate fails, inspect provider logs/retries and address schema-validation or provider reliability causes before release.

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
| Phase 7 reliability smoke | `npm run test:smoke:phase7-reliability` |
| AI manual connection smoke | `npm run test:smoke:ai-connection-required` |
| AI schema quality gate (95%) | `npm run test:quality:ai-schema` |
| Internal jobs overlap smoke | `npm run test:smoke:internal-jobs-overlap` |
| Migrations | `npm run db:migrate` (staging DB) |

---

## Sign-Off

- [ ] All release gates above checked.
- [ ] [Reliability runbook](./reliability-runbook.md) reviewed and accessible to operators.
- [ ] Known issues and workarounds documented (e.g. in runbook or CHANGELOG).

**Pilot release recommendation:** Go / No-Go  
**Date:** _____________  
**Responsible:** _____________
