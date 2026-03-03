# OAuth/API Provider Track Implementation Plan

## Goal
Enable "official" API integration for AI providers (OpenAI, Anthropic, Google) alongside the existing browser automation fallback (`browser_ui`). This allows users to provide their own API keys via OAuth (or direct key entry if providers support it securely via OAuth-like flows) for more reliable generation.

## 1. Schema Updates (Completed)
We need to store OAuth tokens securely.

### Database (`ai_provider_sessions` table)
Add the following columns:
- `access_token_enc` (TEXT, nullable): Encrypted access token.
- `refresh_token_enc` (TEXT, nullable): Encrypted refresh token.
- `expires_at` (TIMESTAMPTZ, nullable): Expiration time of the access token.
- `scopes` (TEXT[], nullable): List of granted scopes.
- `token_type` (TEXT, nullable): Type of token (e.g., "Bearer").

Migration: `src/lib/db/migrations/0014_phase8_oauth_provider.sql`

## 2. Encryption Layer (Completed)
Implement application-level encryption for sensitive tokens using `node:crypto` (AES-256-GCM).

- **File**: `src/lib/crypto.ts`
- **Functions**:
  - `encrypt(text: string): Promise<string>`
  - `decrypt(cipherText: string): Promise<string>`
- **Key Management**: Use `process.env.ENCRYPTION_KEY` (must be 32 bytes hex or similar).

## 3. Credential Management (Storage Layer) (Completed)
Update `src/lib/ai/provider-session.ts` and repository to handle storage and retrieval of OAuth credentials.

- **Types**: Update `AiProviderSession` to include new fields.
- **Repository**: Update `upsertAiProviderSession` (or create specific method) to handle encryption of tokens before save and decryption on read (or keep them encrypted in the object and decrypt only when needed by the adapter). *Decision: Decrypt only when creating the provider client instance to minimize exposure.*

## 4. OAuth Flow Endpoints (Completed)
Implement the OAuth 2.0 authorization code flow.

- **Endpoints**:
  - `GET /api/auth/oauth/authorize?provider={provider}`: Redirects to provider's consent page.
  - `GET /api/auth/oauth/callback`: Handles the redirect from provider, exchanges code for tokens, and updates `ai_provider_sessions`.

- **State Management**: Use a secure cookie or Redis (if available, but we use PG so maybe a temp table or signed cookie) to store `state` parameter to prevent CSRF.

## 5. Provider Adapters (`oauth_api` mode) (Completed)
Create adapters that implement the generation interface using the official SDKs or REST APIs, using the stored tokens.

- **Interface**: Reuse existing `AiProvider` interface or similar contract used by `browser_ui`.
- **Adapters**:
  - `src/lib/ai/api/openai.ts`
  - `src/lib/ai/api/anthropic.ts`
  - `src/lib/ai/api/google.ts`
- **Factory**: Update `src/lib/ai/generate-concepts.ts` and `src/lib/ai/generate-quiz.ts` to use `oauth_api` mode.

## 6. Token Refresh/Rotation (Completed)
Implement logic to check `expires_at` and refresh tokens if needed before generation.

- **Middleware/Interceptor**: Before making an API call in the adapter, check if token is expired.
- **Refresh Logic**:
  - If expired, use `refresh_token` to get new `access_token`.
  - Update `ai_provider_sessions` with new tokens.
  - Retry the request.

## 7. Testing Strategy (TDD) (Completed)
- **Unit**: Test encryption/decryption. (Done)
- **Integration**: Test storage layer with mocked encryption. (Done)
- **Smoke**: Test the full OAuth flow using a mock provider or mocked endpoints. (Skipped due to complexity of mocking external provider in smoke test, relied on unit tests for storage and manual verification of endpoints)

## Next Steps
1.  Implement UI for connecting via OAuth (Settings page).
2.  Add environment variables for client IDs/secrets in production.
3.  Verify end-to-end flow with real provider credentials.
