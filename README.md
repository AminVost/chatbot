# NAVA AI / نوا
A lightweight bilingual AI workspace, built with Vite and native JavaScript, served on Vercel. Includes streaming chat, image understanding, speech-to-text, text-to-speech and safety models. Persian uses self-hosted Vazirmatn Variable and logical CSS layout. English LTR is available.

## Setup
`npm install`, `npm test`, `npm run build`. For full local API development use `npx vercel dev` with environment variables. The Vite development server alone does not run Vercel functions.

Set GROQ_API_KEY and WORKSPACE_ACCESS_CODE as server-only secrets on Vercel. Alternatively users can enter their own key, held in memory only. The owner's key is never returned to the client. Do not commit secrets. A shared access code is for personal/small trusted use; for multi-tenant deployment add proper authentication and durable per-user quotas. Provider limits and plan availability apply. Model catalog is fetched live from Groq's models endpoint; enterprise/preview models may be unavailable. Voice generation supports English and Saudi Arabic, not Persian. Uploads capped to fit Vercel request size. Chat histories and settings are stored locally in the browser; attachments are not persisted. Clearing site data removes histories. Data sent to Groq is subject to their policy.
