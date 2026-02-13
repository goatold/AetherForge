# Browser-Driven Walkthrough Test Report

**Date:** 2026-02-13  
**App:** AetherForge Next.js app @ http://localhost:3000  
**Method:** curl-based session simulation (browser MCP unavailable; localhost not reachable from MCP fetch)

---

## Checklist Results

| # | Step | Result | Page URL | Expected | Actual |
|---|------|--------|----------|----------|--------|
| 1 | Landing page loads | **PASS** | http://localhost:3000 | Page loads with AetherForge branding | HTTP 200, `<h1>AetherForge</h1>` present |
| 2 | Navigate to /learn signed out → redirect to /sign-in | **PASS** | /learn → /sign-in?next=%2Flearn | Redirect to sign-in | 302 → /sign-in?next=%2Flearn, final page shows "Sign in to AetherForge" |
| 3 | Sign in as alice@example.com | **PASS** | /api/auth/sign-in (POST) | Session created, redirect to /learn | Session cookie set, redirected to /learn with generation form |
| 4 | App shell loads, /learn renders generation form | **PASS** | /learn | Form with topic, difficulty, Generate button | "Generate concept graph artifact", topic input, difficulty select present |
| 5 | Submit generation form with default values | **PASS** | /api/concepts/generate (POST) | Artifact + concepts created | HTTP 200, artifactId + 2 concepts returned |
| 6 | Artifacts list has ≥1 entry, concept explorer has ≥1 concept | **PASS** | /learn | Artifacts + concepts visible | 1 artifact link, 2 concept links (Operating Systems) |
| 7 | Click artifact version link → artifact detail page | **PASS** | /learn/artifacts/{id} | Detail page with generated concepts | HTTP 200, "Generated concepts", 2 concept links |
| 8 | Click concept → concept detail shows title/summary and examples/case studies | **PASS** | /learn/{conceptId} | Title, summary, examples section | "Operating Systems: Core mental model", summary, "Examples and case studies" with Example + Case study |
| 9 | Second session: sign in as bob@example.com | **PASS** | /api/auth/sign-in (POST) | Bob session in isolated context | Separate cookie jar, bob@example.com session, /learn loads |
| 10 | Bob generates concepts | **PASS** | /api/concepts/generate (POST) | Bob's artifact created | HTTP 200, artifactId for Networking topic |
| 11 | Bob sees his own artifacts/concepts | **PASS** | /learn | Bob's content only | Bob's artifact (31a89af8), Networking concepts |
| 12 | Alice session: bob content not visible (data isolation) | **PASS** | /learn | Alice sees only her content | Alice's artifact (29b82d9a) only; no Bob artifact, no "Networking" |
| 13 | Smoke-check API endpoints | **PASS** | /api/workspace, /api/concepts/artifacts | JSON, successful status | Both return 200, valid JSON (workspace, artifacts) |

---

## Bugs / Deviations

- None. All 13 steps passed.

---

## Evidence

### Critical screens – observed elements

| Screen | Key observed text/elements |
|--------|----------------------------|
| Landing | `<h1>AetherForge</h1>`, "Learn any topic through structured concepts..." |
| Sign-in | `<h1>Sign in to AetherForge</h1>`, email input, Sign in button |
| /learn (signed in) | "Generate concept graph artifact", "Artifacts", "Concept explorer", topic input, difficulty select |
| Artifact detail | "Artifact v1", "Topic: Operating Systems (beginner)", "Generated concepts", concept links |
| Concept detail | "Operating Systems: Core mental model", summary, "Examples and case studies", Example: Simple walkthrough, Case study: Real-world application |
| App shell | "AetherForge Workspace", "Learning Workspace", "Signed in as alice@example.com", nav links (Onboarding, Learn, Quiz, etc.) |

### Session isolation

- **Alice:** artifact `29b82d9a-5f4f-4f30-b18b-d45d79774573`, Operating Systems concepts  
- **Bob:** artifact `31a89af8-acf7-463f-b12f-ccea8488ee9c`, Networking concepts  
- Alice page: 0 occurrences of Bob's artifact ID or "Networking"

### API responses

- **GET /api/workspace:** `{"workspace":{"id":"...","topic":"Operating Systems","difficulty":"beginner",...}}`
- **GET /api/concepts/artifacts:** `{"artifacts":[{"id":"29b82d9a-...","topic":"Operating Systems",...}]}`

---

## Notes

- **Step 9:** True incognito/second browser context was simulated with a separate curl cookie jar. Behavior matches expected isolation.
- **Tooling:** cursor-ide-browser MCP could not reach localhost; mcp_web_fetch also cannot access localhost. Tests were run via curl with network permission.
