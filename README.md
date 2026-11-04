# PROD LAYZA AI — Version 22

A ChatGPT-inspired React + Supabase starter with email/password auth, per-user conversation history, DeepSeek chat, optional Linkup search, and a server-enforced daily message allowance.

## 1. Run in Bolt / locally
1. Create a new Bolt project (React + TypeScript) and add these files.
2. Add dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set only the public Supabase URL and anon key.
4. Run `npm run dev`.

## 2. Supabase setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/001_initial.sql`.
3. In Authentication > Providers, enable Email.
4. Deploy Edge Functions `chat` and `claim-ad-reward`.

## 3. Server secrets
Set these in Supabase Edge Function secrets (not in frontend `.env`, not in code):
- `DEEPSEEK_API_KEY`
- `LINKUP_API_KEY`
- `LINKUP_API_URL` (optional; default is `https://api.linkup.so/v1/search`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Set `ADMIN_EMAILS` as a comma-separated allowlist if you later add server-verified admin actions. The visible admin panel in this starter is informational only; it does not expose or edit secrets.

## 4. Important implementation notes
- The 10-message daily allowance is enforced by the `consume_chat_message()` database function, not by the browser.
- Bonus credits are NOT granted by a frontend click. The ad-reward endpoint intentionally returns 501 until a real ad provider's signed server callback is implemented and verified. This prevents fake reward claims.
- Premium is a “coming soon” placeholder; there is no payment collection.
- “Create an image” currently helps prepare an image prompt; actual image generation needs a separate image-generation provider.
- File selection is currently a UI placeholder. It does not upload or parse files yet.
- Microphone button is a placeholder; voice transcription is not wired.
- Do not expose DeepSeek, Linkup, or Supabase service-role keys in any `VITE_` variable.

## 5. Deploy
Deploy the frontend to Bolt hosting or another static host. Deploy Supabase Edge Functions separately. Ensure the frontend uses the matching Supabase project URL and anon key.
