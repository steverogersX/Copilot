# Lokta Borrower Copilot

A self-assessment tool for Indian borrowers: answer questions about the loan
you want and your finances, and get four straight answers — should you
borrow, how much, at what fair rate, and what EMI to hold the line at —
plus a Negotiation Card you can hold up to a lender. Everything runs
client-side from what you type in; there's no backend, login, or bureau
pull involved.

## Run it locally

Prerequisites: Node.js 20+ (Next.js 16 requires Node 18.18+; this repo was
built and tested on 20).

1. Clone and install:
   ```bash
   git clone <repository-url>
   cd copilot
   npm install
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3000 in your browser.

No environment variables, no database, no backend, no API keys required.

## What's in this repo

- `src/types/loan-eligibility-form.ts` — form schema (Zod) and enums
- `src/lib/engine.ts` — the eligibility calculation engine (O1-O4 logic)
- `src/lib/rules.ts` / `src/lib/rules.json` — every threshold, band, and
  assumption, separated from the engine logic (see RULES.md for the full
  reasoning)
- `src/components/LoanEligibilityForm.tsx` — the intake form
- `src/components/negotiation-card.tsx` — the Negotiation Card
- `RULES.md` — every rule, threshold, and assumption with its reasoning and
  source, plus the branching logic and known limitations
- `src/lib/scenarios.test.ts` — the three persona run-throughs below,
  runnable directly against the engine

## Scope

This app currently supports:
- Loan types: Personal, Business (routes to a secured Loan-Against-Property
  product when qualifying collateral is offered), Two-Wheeler/EV
- Income types: Salaried, Self-employed, Informal

See RULES.md's "What this app does not know" section for known gaps and
simplifications.

## Try it with the three brief personas

`src/lib/scenarios.test.ts` builds the exact form inputs for Priya (29,
salaried, personal loan for a wedding), Ravi (42, self-employed kirana
owner, business loan routed to a secured product via his shop premises),
and Anita (35, informal gig worker, two-wheeler loan blocked by a recent
EMI bounce combined with high-cost debt), runs each through `engine()`,
and asserts the expected outcome. Run all three and print the full result
for each with:

```bash
npx tsx src/lib/scenarios.test.ts
```
