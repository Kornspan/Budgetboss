
---

````md
# Budgetboss AI Guidelines (Zach) 💰

## 0 — Purpose

These rules exist to keep this **personal finance app**:
- Correct with money,
- Easy to change,
- Ready for a real backend (Supabase / Plaid / Teller).

**MUST** rules are hard constraints.  
**SHOULD** rules are strong preferences.

This file applies to **all AI agents** (Codex, Gemini, Antigravity, etc.).

---

## 1 — Before Coding

- **BP-1 (MUST)**  
  Always read **AI_RULES.md** and the top-level **README.md** before major changes.

- **BP-2 (MUST)**  
  For any non-trivial task, **write a short plan first** (1–8 bullets).  
  The plan must mention:
  - Which files you’ll touch
  - What behavior will change
  - Any risks / migrations needed

- **BP-3 (SHOULD)**  
  If there are ≥ 2 reasonable approaches, list **pros/cons** and pick the one that:
  - Minimizes code churn,
  - Keeps things easy to test,
  - Respects the current architecture.

- **BP-4 (SHOULD)**  
  Ask one clarifying question if requirements are ambiguous, but **don’t stall** on things that are clearly implied by this file.

---

## 2 — While Coding

### 2.1 General

- **C-1 (MUST)**  
  Keep logic **simple, composable, and testable**. Prefer small pure functions over clever abstractions.

- **C-2 (MUST)**  
  Use existing domain vocabulary in names:
  - `Account`, `Transaction`, `Category`, `BudgetEntry`, `Goal`, `FireConfig`, etc.
  - Don’t invent new synonyms (`Bucket`, `LedgerItem`, etc.) unless you’re explicitly adding a new concept.

- **C-3 (SHOULD NOT)**  
  Introduce classes when modules + functions are enough.

- **C-4 (SHOULD)**  
  Prefer:
  ```ts
  type TransactionId = string;
````

over raw `string`, especially for IDs or important domain types.

* **C-5 (MUST)**
  Use `import type { ... }` for type-only imports in TypeScript.

* **C-6 (SHOULD NOT)**
  Add comments for obvious code. Only comment:

  * Non-obvious financial logic,
  * Edge-case handling,
  * Workarounds for library quirks.

* **C-7 (SHOULD NOT)**
  Extract a new function **unless**:

  * It’s reused,
  * It makes tricky logic testable,
  * Or the original block is genuinely hard to read.

### 2.2 Domain-specific constraints

* **C-8 (MUST)** Money is always in **integer cents**:

  * `amountCents: number` (neg = spending, pos = inflow).
  * Never store floats for money.

* **C-9 (MUST)**
  All state mutations for accounts/transactions/budgets go through the **central state hook** (e.g. `useFinanceState`) and its helpers:

  * `addManualTransaction(...)`
  * `importTransactionsFromProvider(...)`
  * `upsertAccount(...)`
  * `recomputeBudgetsForMonth(...)`

  Components must **not** mutate state arrays directly.

* **C-10 (MUST)**
  Auto-categorization is handled via a **single function**, e.g.:

  ```ts
  autoCategorizeTransaction(tx: Transaction, rules: CategoryRule[]): Transaction;
  ```

  Both manual and imported transactions must flow through this.

* **C-11 (SHOULD)**
  Keep AI-specific code in **`lib/ai.ts`** (or similar), not scattered in React components.
  Components call clean helpers like:

  * `getCategorySuggestion(...)`
  * `askFireCoach(...)`
  * `createFinancialChatSession(...)`

---

## 3 — Testing

* **T-1 (MUST)**
  Put unit tests for pure finance logic (`net worth`, `budget rollovers`, `FIRE projections`) near the implementation (e.g. `lib/finance.spec.ts`).

* **T-2 (MUST)**
  Keep **pure-logic** tests separate from any future **DB / Supabase / Plaid** integration tests.

* **T-3 (SHOULD)**
  Prefer tests that cover a full output structure:

  ```ts
  expect(result).toEqual({ ...expectedObject });
  ```

  rather than many tiny expectations on individual fields.

* **T-4 (SHOULD)**
  Always test:

  * Negative balances,
  * Edge-of-month / year cases,
  * Zero budgets / zero transactions,
  * “Big” numbers for long-term FIRE projections.

* **T-5 (SHOULD NOT)**
  Add pointless tests (`expect(2).toBe(2)`) or tests that simply restate TypeScript’s type checking.

---

## 4 — Data & Backend

> Current: localStorage-only.
> Future: Supabase / Postgres + optional Plaid/Teller.

* **D-1 (MUST)**
  **Do not** spray `localStorage` or DB calls throughout the app. Persistence logic should live in a **thin layer** around the main state (e.g. inside the state hook or a small persistence module).

* **D-2 (MUST)**
  Ensure the core domain types remain consistent:

  ```ts
  type AccountProvider = 'manual' | 'plaid' | 'teller' | 'other';
  type TransactionSource = 'manual' | 'imported';
  type TransactionStatus = 'pending' | 'posted';
  ```

* **D-3 (SHOULD)**
  Design state-layer APIs so that **swapping localStorage → Supabase** doesn’t require rewriting all components.
  That means:

  * Components talk to **state hooks**, not Supabase or Plaid directly.
  * Future API routes / Supabase will also use the same core types.

---

## 5 — UI / UX

* **U-1 (MUST)**
  Keep the vibe: **minimal, Apple-like**, dark theme, clean typography.

* **U-2 (MUST)**
  All tables and grids must be usable on mobile:

  * Use `overflow-x-auto` on wide containers.
  * Never force horizontal zoom.

* **U-3 (SHOULD)**
  Prioritize **numbers and clarity**:

  * Net worth,
  * Category balances,
  * This month vs last month.

* **U-4 (SHOULD)**
  AI suggestions (categories, insights, FIRE coaching) must **always ask for confirmation** before changing saved data.

* **U-5 (SHOULD NOT)**
  Introduce new visual complexity (nested accordions, weird transitions) without a clear UX benefit.

---

## 6 — Tooling & Safety

* **G-1 (MUST)**
  Never hardcode secrets (Gemini API keys, future Supabase keys, etc.). Use environment variables.

* **G-2 (MUST)**
  Code must be valid TypeScript with no obvious type errors. Use strict types.

* **G-3 (SHOULD)**
  Keep dependencies minimal. Don’t add heavy libraries when simple helpers or existing packages suffice.

* **G-4 (SHOULD)**
  When you add important money or FIRE logic, add at least **one test** that covers a realistic scenario.

---

## 7 — Writing Functions: Checklist

When you create or edit a **non-trivial** function, mentally check:

1. Is it easy to read top-to-bottom without pausing?
2. Is cyclomatic complexity reasonable (not a deep tree of nested `if`s / `switch`es)?
3. Are there obvious domain data structures that would simplify it (maps, arrays, dates)?
4. Any unused parameters?
5. Any type casts (`as`) that could be pushed to the boundaries instead?
6. Can this function be tested as a pure function (especially for money/FIRE/budget math)?
7. Are there hidden dependencies (global state, magic constants) that should be arguments?
8. Is the name actually clear and consistent with the rest of the codebase?

**Do NOT** split it into smaller functions unless:

* It’s reused,
* It makes testing substantially easier,
* Or the original function is truly unreadable without comments.

---

## 8 — Writing Tests: Checklist

For any new test you add:

1. Use **meaningful inputs** (no unexplained magic `42` or `"foo"`).
2. Only write tests that can fail due to real defects.
3. The test name must clearly describe what the final `expect` is checking.
4. Compare to **independent expectations** (precomputed values or known domain invariants), not the same function’s output reused as “truth”.
5. Follow the same style & type-safety rules as production code.
6. Favor tests that capture **invariants** (e.g., “total budget remaining = sum of categories”) and **edge cases**.

---

## 9 — Project Layout (Current Intent)

* `src/` or `app/` — main React app

  * `components/` — UI components (Dashboard, Budgets, Transactions, Accounts, Goals/FIRE, Settings)
  * `hooks/useFinanceState.ts` — central state + persistence
  * `lib/finance.ts` — pure financial calculations
  * `lib/ai.ts` — Gemini interactions
  * `types.ts` — core domain types

If you add new top-level areas, keep them obvious and small.

---

## 10 — Shortcuts for Prompts

These shorthands may be used in prompts to AI agents:

### QNEW

> “QNEW” means:
> Read **AI_RULES.md** and the main **README**.
> Summarize the rules in a few bullets, then propose a plan before coding.

### QPLAN

> “QPLAN” means:
> Analyze similar code in this repo and ensure your plan:
>
> * Fits the existing architecture,
> * Minimizes changes,
> * Reuses existing types/helpers.

### QCODE

> “QCODE” means:
> Implement the approved plan.
>
> * Keep changes small and coherent.
> * Ensure TypeScript builds without errors.
> * Run any available tests/build scripts.

### QCHECK

> “QCHECK” means:
> As a skeptical senior engineer, review your changes against:
>
> * Implementation Best Practices (Sections 1–6),
> * Function checklist (Section 7),
> * Tests checklist (Section 8).
>   List any weaknesses or tradeoffs.

### QUX

> “QUX” means:
> Act as a UX tester.
> List scenarios a real user would try for this feature, sorted by priority (happy paths, then edge cases).

---

End of file.

```

---

You can drop that in as `AI_RULES.md` right now.

Next step for you with Codex / Antigravity:

- Start a new task with something like:

> QNEW. Read AI_RULES.md and README.md. Summarize the key constraints in 5 bullets so I know you actually read them. Then propose a 3–5 step plan to move this app from pure localStorage to a structure that can later swap in Supabase without breaking the UI.

That will lock the agent into your rules from the start instead of letting it improvise.
::contentReference[oaicite:0]{index=0}
```
