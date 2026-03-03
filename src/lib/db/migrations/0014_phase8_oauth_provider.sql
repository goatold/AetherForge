alter table ai_provider_sessions
add column if not exists access_token_enc text,
add column if not exists refresh_token_enc text,
add column if not exists expires_at timestamptz,
add column if not exists scopes text[],
add column if not exists token_type text;
