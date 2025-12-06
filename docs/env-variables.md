# Environment Variables

This app runs on Vercel (frontend) with Supabase + Edge Functions (backend). Set vars in the right place and avoid exposing secrets via `VITE_*`.

## Frontend (Vercel / Vite)
These are safe to expose to the client and must be set in Vercel Project Settings (or `.env.local` for local dev).

| Name | Purpose | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL used by the browser client. | Required. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key for client-side reads/writes. | Required. |

## Backend-only (Supabase Edge Functions / Service Role)
These are **sensitive** and must **not** be prefixed with `VITE_` or used in frontend code. Set them in Supabase project env/Edge Function secrets.

| Name | Purpose | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase URL for Edge Functions. | Required for server-side Supabase client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for Edge Functions. | Required; keep secret. |
| `PLAID_CLIENT_ID` | Plaid client ID for Plaid API calls. | Sensitive; backend only. |
| `PLAID_SECRET` | Plaid secret for Plaid API calls. | Sensitive; backend only. |
| `PLAID_ENV` | Plaid environment (`sandbox`, etc.). | Backend only, but not secret. |
| `GEMINI_API_KEY` | Google Gemini API key for AI Edge Functions. | Sensitive; backend only. |

These backend vars are consumed by Edge Functions (Plaid & AI) and must never be exposed as `VITE_*`.
