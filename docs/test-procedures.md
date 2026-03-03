# AetherForge Comprehensive Test Procedures

**Purpose:** Thoroughly test all functionalities of the current AetherForge project state, covering Phases 0-7 (MVP Complete) and Phase 8 (OAuth/API Provider Backend).

**Prerequisites:**
- Local environment running (`npm run dev`)
- Database migrated and seeded (`npm run db:migrate`, `npm run db:seed` if applicable)
- Two different browser sessions (e.g., Chrome + Firefox, or Incognito) for collaboration testing.

---

## 1. Authentication & Workspace (Phase 0-1)

**Goal:** Verify user session management and workspace data isolation.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Navigate to `/sign-in` | Sign-in page loads with email/password form. | |
| 1.2 | Sign up / Sign in with User A | Redirects to `/dashboard` (or app home). Session cookie set. | |
| 1.3 | Verify Workspace | User A sees their specific workspace data (or empty state if new). | |
| 1.4 | Navigation Guard | Try to access `/dashboard` in Incognito without logging in. | Redirects to `/sign-in`. | |
| 1.5 | Sign Out | Click Sign Out. | Session cleared, redirects to landing/sign-in. | |

---

## 2. Concept Generation & Explorer (Phase 2)

**Goal:** Verify AI generation of concept graphs and artifact persistence.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | Navigate to `/onboarding` (or similar input) | Topic selection form appears. | |
| 2.2 | Input Topic: "Photosynthesis" (Difficulty: Beginner) | Form accepts input. | |
| 2.3 | Click "Generate Concepts" | Loading state appears. After delay, concept graph renders. | |
| 2.4 | Verify Graph Nodes | Nodes like "Light Dependent Reactions", "Calvin Cycle" appear. | |
| 2.5 | Click a Node | Concept Detail pane/page opens. | |
| 2.6 | Verify Content | Explanation, examples, and relationships are shown. | |
| 2.7 | Refresh Page | Concept graph persists (no re-generation needed). | |

---

## 3. Quiz & Feedback Loop (Phase 3)

**Goal:** Verify quiz generation, attempt lifecycle, and scoring.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | Navigate to `/quiz` | Quiz dashboard or "New Quiz" button appears. | |
| 3.2 | Generate Quiz for "Photosynthesis" | Quiz generated with multiple-choice questions. | |
| 3.3 | Answer Questions (Mix of Correct/Incorrect) | UI updates to show selected answers. | |
| 3.4 | Submit Quiz | Score summary page appears immediately. | |
| 3.5 | Verify Feedback | Detailed feedback explains why answers were wrong. | |
| 3.6 | Check History | Navigate back to Quiz dashboard; new attempt is listed. | |

---

## 4. Flashcards & Spaced Repetition (Phase 4)

**Goal:** Verify flashcard generation and review queue scheduling.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | Navigate to `/flashcards` | Flashcard dashboard appears. | |
| 4.2 | Generate Flashcards (from Quiz/Concepts) | New deck created based on weak areas/concepts. | |
| 4.3 | Start Review Session | Flashcard front appears. | |
| 4.4 | Flip Card & Rate Recall (Hard/Good/Easy) | Card flips, buttons appear. Next card shows. | |
| 4.5 | Complete Session | Summary shows items reviewed. | |
| 4.6 | Verify Scheduling | Cards rated "Easy" are pushed further into future than "Hard". | |

---

## 5. Planning & Resources (Phase 5)

**Goal:** Verify learning plan creation and resource management.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 5.1 | Navigate to `/plan` | Plan dashboard appears. | |
| 5.2 | Create Learning Goal | Goal appears in timeline/list. | |
| 5.3 | Add Milestone with Deadline | Milestone persists and is sorted by date. | |
| 5.4 | Navigate to `/resources` | Resources library appears. | |
| 5.5 | Add Note/Link | Note is saved and searchable/filterable. | |

---

## 6. Collaboration & Export (Phase 6)

**Goal:** Verify sharing, roles, and export functionality.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 6.1 | Log in as User A (Owner) | Dashboard loads. | |
| 6.2 | Invite User B (email) as "Viewer" | Invite sent/link generated. | |
| 6.3 | Log in as User B | Accept invite/access workspace. | |
| 6.4 | User B Action: Try to Edit/Delete | UI prevents action or API returns 403 Forbidden. | |
| 6.5 | User A Action: Promote User B to "Editor" | Role updates. | |
| 6.6 | User B Action: Edit Content | Edit succeeds. | |
| 6.7 | User A Action: Export (PDF/Print) | Print preview opens with correct layout (A4/Letter). | |
| 6.8 | User A Action: Revoke Access | User B can no longer access workspace. | |

---

## 7. Reliability & Hardening (Phase 7)

**Goal:** Verify system stability and error handling.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 7.1 | Invalid API Request (modify ID in URL) | 404 Not Found or graceful error message (not crash). | |
| 7.2 | Network Interruption (Simulate Offline) | UI shows "Offline" or "Retry" indicator on action. | |
| 7.3 | Concurrent Edits (if supported) | Last-write-wins or conflict warning (depending on logic). | |
| 7.4 | AI Generation Timeout/Failure | Error message "Generation failed, please try again". | |

---

## 8. OAuth/API Provider (Phase 8 - Backend Check)

**Goal:** Verify backend readiness for OAuth providers (UI pending).

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 8.1 | Check Database Schema | Table `ai_provider_sessions` exists with `access_token_enc`. | |
| 8.2 | Trigger Authorize Endpoint (manual/curl) | `GET /api/auth/oauth/authorize?provider=openai` -> 401 (if unauth) or Redirect. | |

---

## Automated Smoke Tests

Run the following scripts to verify core flows automatically:

```bash
# Core MVP Smoke
python3 scripts/tests/mvp_smoke.py

# Feature Specific
python3 scripts/tests/quiz_attempt_lifecycle_smoke.py
python3 scripts/tests/flashcards_generation_review_smoke.py
python3 scripts/tests/collab_invite_revoke_smoke.py
```
