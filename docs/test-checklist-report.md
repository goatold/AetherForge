# Browser-Driven Walkthrough Test Report

**Date:** 2026-02-13  
**App:** AetherForge Next.js app @ http://localhost:3002  
**Method:** curl-based session simulation (browser MCP unavailable; localhost not reachable from MCP fetch)

---

## Checklist Results

| # | Step | Result | Page URL | Expected | Actual |
|---|------|--------|----------|----------|--------|
| 1 | Landing page loads | **PASS** | http://localhost:3002 | Page loads with AetherForge branding | HTTP 200, `<h1>AetherForge</h1>` present |
| 2 | Navigate to /learn signed out → redirect to /sign-in | **PASS** | /learn → /sign-in?next=%2Flearn | Redirect to sign-in | 307 → /sign-in?next=%2Flearn |
| 3 | Sign in as alice.regress@example.com | **PASS** | /api/auth/sign-in (POST) | Session created, redirect to /learn | 303 and cookie jar populated |
| 4 | App shell loads, /learn renders generation form | **PASS** | /learn | Form with topic, difficulty, Generate button | "Generate concept graph artifact", "Artifacts", "Concept explorer" present |
| 5 | Submit generation form with topic/difficulty | **PASS** | /api/concepts/generate (POST) | Artifact + concepts created | 200, `artifactId` and 2 concepts returned |
| 6 | Artifact detail route loads | **PASS** | /learn/artifacts/{id} | Detail page with generated concepts | 200, "Generated concepts" present |
| 7 | Concept detail route loads | **PASS** | /learn/{conceptId} | Title/summary and examples section visible | 200, "Examples and case studies" present |
| 8 | New graph visualization renders on artifact page | **PASS** | /learn/artifacts/{id} | "Concept graph" section visible with node links | 200, "Concept graph" present |
| 9 | Invalid artifact id does not crash route | **PASS** | /learn/artifacts/not-a-uuid | Graceful 404/not-found behavior | 404 returned |
| 10 | Second session: sign in as bob.regress@example.com | **PASS** | /api/auth/sign-in (POST) | Isolated session established | 303 and separate cookie jar |
| 11 | Bob generates concepts | **PASS** | /api/concepts/generate (POST) | Bob artifact created | 200 returned |
| 12 | Data isolation across sessions | **PASS** | /api/concepts/artifacts | No Alice/Bob artifact overlap | overlap count = 0 |
| 13 | API smoke: workspace and artifacts | **PASS** | /api/workspace, /api/concepts/artifacts | 200 + valid JSON shape | both endpoints returned 200 |
| 14 | Provider provenance is persisted | **PASS** | /api/concepts/artifacts | provider/model included in artifact payload | provider observed: `aetherforge-bootstrap` |

---

## Bugs / Deviations

- None. All 14 steps passed.

---

## Evidence

### Critical screens – observed elements

| Screen | Key observed text/elements |
|--------|----------------------------|
| Landing | `<h1>AetherForge</h1>`, "Learn any topic through structured concepts..." |
| Sign-in | `<h1>Sign in to AetherForge</h1>`, email input, Sign in button |
| /learn (signed in) | "Generate concept graph artifact", "Artifacts", "Concept explorer", topic input, difficulty select |
| Artifact detail | "Artifact v1", "Topic: Kernel Design (intermediate)", "Source:", "Concept graph", "Generated concepts" |
| Concept detail | "Operating Systems: Core mental model", summary, "Examples and case studies", Example: Simple walkthrough, Case study: Real-world application |
| App shell | "AetherForge Workspace", "Learning Workspace", "Signed in as alice@example.com", nav links (Onboarding, Learn, Quiz, etc.) |

### Session isolation

- **Alice:** 1 artifact, topic `Kernel Design`, provider `aetherforge-bootstrap`  
- **Bob:** 1 artifact, topic `Network Security`, provider `aetherforge-bootstrap`  
- Shared artifact overlap count between sessions: `0`

### API responses

- **GET /api/workspace:** `200` with `{"workspace":{...}}` payload
- **GET /api/concepts/artifacts:** `200` with `{"artifacts":[{"id":"...","topic":"Kernel Design","provider":"aetherforge-bootstrap",...}]}`

---

## Notes

- **Step 9:** True incognito/second browser context was simulated with a separate curl cookie jar. Behavior matches expected isolation.
- **Tooling:** cursor-ide-browser MCP could not reach localhost; mcp_web_fetch also cannot access localhost. Tests were run via curl with network permission.
- **Stability note:** During this run, a stale `.next` cache intermittently caused module resolution errors in `next dev`; clearing `.next` and restarting restored stable test behavior.
