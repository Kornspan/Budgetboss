# CLAUDE.md — Budgetboss

## Project Overview

Budgetboss is a personal finance application with AI-powered budgeting, FIRE (Financial Independence, Retire Early) projections, and bank account integrations via Plaid.

**Tech stack:** React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS (frontend), Supabase PostgreSQL + Deno Edge Functions (backend), Google Gemini API (AI), Plaid API (banking).

**Stage:** Active prototype — migrating from localStorage to Supabase backend.

## Quick Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server on port 3000
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

There is no linting, formatting, or test infrastructure configured yet. No CI/CD pipelines exist.

## Directory Structure

```
/
├── components/            # React UI components (views, widgets)
├── auth/                  # Auth components + AuthContext (Supabase Auth)
├── hooks/                 # Custom React hooks
│   ├── useFinanceState.ts # Central state management (localStorage + Supabase)
│   └── useAiChat.ts       # AI chat message state
├── lib/                   # Pure functions and service modules
│   ├── finance.ts         # Financial calculations (pure functions)
│   ├── ai.ts              # AI/Gemini service functions
│   ├── financeSync.ts     # Supabase data fetching + mappers
│   ├── plaidSyncClient.ts # Plaid sync orchestration
│   ├── supabaseClient.ts  # Supabase client singleton
│   └── userBootstrap.ts   # User profile initialization
├── src/config/env.ts      # Environment variable validation
├── supabase/
│   ├── schema.sql         # Full PostgreSQL schema (source of truth)
│   └── functions/         # Deno Edge Functions (8 functions)
│       ├── ai-chat/
│       ├── ai-suggest-category/
│       ├── plaid-create-link-token/
│       ├── plaid-exchange-public-token/
│       ├── plaid-sync-accounts/
│       ├── plaid-sync-transactions/
│       ├── plaid-disconnect-item/
│       └── _shared/       # Shared backend utilities (plaidClient.ts)
├── docs/env-variables.md  # Environment variable reference
├── types.ts               # All domain type definitions
├── App.tsx                # Main app component (tabs + theme)
├── index.tsx              # React entry point
├── AI_rules.md            # Detailed AI development guidelines (READ THIS)
└── CLAUDE.md              # This file
```

## Key Conventions

**Read `AI_rules.md` for the full set of MUST/SHOULD rules.** The most critical ones:

### Money

- All monetary values are **integer cents** (`amountCents: number`). Never use floats for money.
- Negative = expense/spending, positive = income/inflow.
- Database columns use `bigint` with `_cents` suffix.
- Use `formatMoney(cents)` and `parseMoney(str)` from `lib/finance.ts`.

### State Management

- All state mutations go through `useFinanceState` hook — components never mutate state arrays directly.
- Actions: `addManualTransaction()`, `updateTransaction()`, `addCategory()`, `updateBudgetEntry()`, `updateFireConfig()`, `addGoal()`, etc.
- localStorage key: `finance_prototype_v2_plaid_ready` (will migrate to Supabase).

### TypeScript

- Strict mode enabled. No `any` types. Use `import type { ... }` for type-only imports.
- Path alias: `@/*` maps to project root.
- Domain vocabulary: `Account`, `Transaction`, `Category`, `BudgetEntry`, `Goal`, `FireConfig` — don't invent synonyms.
- Branded types: `Cents = number`, `UserId = string`.

### Code Style

- PascalCase for components and types, camelCase for functions/variables, UPPER_SNAKE_CASE for constants.
- No linter or formatter configured — follow existing patterns.
- Console logging uses `[module-name]` prefix (e.g., `[auth]`, `[plaid]`).
- Dev-only logs: `if (import.meta.env.DEV) { console.debug(...) }`.
- Don't add comments for obvious code. Only comment non-obvious financial logic, edge cases, or library workarounds.

### UI

- Minimal, Apple-like aesthetic. Dark theme. Clean typography.
- Tailwind CSS for styling. Mobile-responsive (use `overflow-x-auto` on tables).
- AI suggestions must ask for user confirmation before changing saved data.

## Domain Types

All defined in `types.ts` (158 lines). Key entities:

| Type | Purpose |
|------|---------|
| `Account` | Bank/investment accounts with provider info |
| `Transaction` | Money movements (manual or imported via Plaid) |
| `Category` | Spending categories with group field |
| `CategoryRule` | Pattern-based auto-categorization rules |
| `BudgetMonth` / `BudgetEntry` | Monthly budget tracking per category |
| `Goal` | Savings goals with target/current amounts |
| `FireConfig` | FIRE projection parameters |
| `AppSettings` | User preferences (theme, AI personality, etc.) |
| `FinanceState` | Central app state container |

## Key Files

| File | Role |
|------|------|
| `hooks/useFinanceState.ts` | Central state hook — all data mutations go here |
| `lib/finance.ts` | Pure financial calculations (net worth, budgets, FIRE sim, categorization) |
| `lib/ai.ts` | AI service layer (`getCategorySuggestion`, `requestChatReply`, `askFireCoach`) |
| `lib/financeSync.ts` | Supabase data fetching + snake_case-to-camelCase mappers |
| `auth/AuthContext.tsx` | Supabase Auth provider (session, sign in/up/out) |
| `supabase/schema.sql` | Full database schema with RLS policies |
| `types.ts` | All TypeScript domain type definitions |

## Environment Variables

**Frontend (exposed via `VITE_` prefix, set in `.env.local`):**
- `VITE_SUPABASE_URL` — Supabase project URL (required)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (required)

**Backend (Edge Functions only, never expose to frontend):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase server-side access
- `GEMINI_API_KEY` — Google Gemini API key
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` — Plaid API credentials

Never hardcode secrets. See `docs/env-variables.md` for full reference.

## Backend Architecture

- **Database:** Supabase PostgreSQL with Row-Level Security (all rows scoped by `user_id`).
- **Edge Functions:** Deno runtime, located in `supabase/functions/`. Each handles CORS preflight.
- **AI:** Gemini 2.0 Flash for chat, Gemini 1.5 Pro for FIRE coaching. Supports personality modes (friendly, direct, playful).
- **Plaid:** Full Link flow (create token, exchange, sync accounts/transactions, disconnect).
- **Auth:** Supabase native email/password authentication.

## Auto-Categorization

All transactions (manual and imported) flow through `autoCategorizeTransaction(tx, rules)` in `lib/finance.ts`. AI-based suggestions use the `ai-suggest-category` Edge Function via `getCategorySuggestion()` in `lib/ai.ts`.

## Testing Guidance

No test framework is configured yet. When adding tests:
- Use Vitest (Vite-native) for unit tests.
- Put pure finance logic tests near implementation (e.g., `lib/finance.spec.ts`).
- Keep pure-logic tests separate from DB/API integration tests.
- Test edge cases: negative balances, month/year boundaries, zero budgets, large FIRE projections.
- See `AI_rules.md` sections 3 and 8 for detailed testing checklists.

## AI Rules Reference

The `AI_rules.md` file contains comprehensive development guidelines organized as:
1. Before Coding (planning, tradeoffs)
2. While Coding (simplicity, domain vocabulary, money constraints)
3. Testing (checklists, edge cases)
4. Data & Backend (persistence layer, type consistency)
5. UI/UX (aesthetic, mobile, AI confirmation)
6. Tooling & Safety (secrets, TypeScript, dependencies)
7. Function Writing Checklist
8. Test Writing Checklist
9. Project Layout
10. Prompt Shortcuts (QNEW, QPLAN, QCODE, QCHECK, QUX)

**Always read `AI_rules.md` before making major changes.**
