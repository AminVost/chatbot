# NAVA AI / نوا
A lightweight bilingual AI workspace, built with Vite and native JavaScript, served on Vercel. Includes streaming chat, image understanding, speech-to-text, text-to-speech and safety models. Persian uses self-hosted Vazirmatn Variable and logical CSS layout. English LTR is available.

## Setup
`npm install`, `npm test`, `npm run build`. For full local API development use `npx vercel dev` with environment variables. The Vite development server alone does not run Vercel functions.

Set GROQ_API_KEY and WORKSPACE_ACCESS_CODE as server-only secrets on Vercel. Alternatively users can enter their own key, held in memory only. The owner's key is never returned to the client. Do not commit secrets. A shared access code is for personal/small trusted use; for multi-tenant deployment add proper authentication and durable per-user quotas. Provider limits and plan availability apply. Model catalog is fetched live from Groq's models endpoint; enterprise/preview models may be unavailable. Voice generation supports English and Saudi Arabic, not Persian. Uploads capped to fit Vercel request size. Chat histories and settings are stored locally in the browser; attachments are not persisted. Clearing site data removes histories. Data sent to Groq is subject to their policy.

## NAVA 2
Adaptive mobile navigation, safe-area layout, touch controls, searchable model catalog, conversation renaming, accessible focus and reduced motion. TTS input follows the documented 200-character limit; account terms must be accepted by the account owner.

## NAVA 2.1
Text-to-speech voice selection, per-model voice preference, sample texts, character progress, cancellation, validated WAV, responsive keyboard handling, frame-scheduled streaming with final Markdown rendering, and scroll preservation. Live Orpheus requests require the account's accepted terms and available quota.

## Accounts (3.0)
Managed Neon Auth with Google and verified email, user-specific local conversation history, server-side JWT validation, UTC daily per-user request quotas (default 20; owner exempt from app quotas), account blocking, admin audit logs, and a responsive admin panel. Provider limits still apply to all users. Google shared credentials and shared SMTP are development-grade; configure production OAuth client and SMTP before public launch. Set DATABASE_URL, NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL, VITE_NEON_AUTH_URL and GROQ_API_KEY. No workspace code or client API key is used.

### First-party authentication
Auth requests now use the official framework-neutral Neon Auth server proxy with first-party secure HttpOnly cookies. The Google callback completes the verifier exchange on the same origin. API handlers verify the current server session. Set NEON_AUTH_COOKIE_SECRET (32+ random characters). Existing Google-only accounts can set a password using the email OTP password reset flow.

## Chat UX 3.2
Incremental turn rendering keeps existing conversation DOM in place. A controlled smooth scroll reveals each submitted turn, follows streaming only while the reader is at the bottom, and stops when the reader scrolls up. ResizeObserver handles dynamic layout changes, including mobile keyboard and Markdown. A bilingual waiting/processing/writing indicator reflects stream events without exposing reasoning content. Copy-code controls and reduced-motion support included.

## Searchable dropdowns
Tom Select powers model, transcription language and speech voice selectors. Search supports labels and model IDs, with keyboard navigation, theme and RTL styling, and instance cleanup when switching tools.
