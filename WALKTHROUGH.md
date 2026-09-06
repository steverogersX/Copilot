# Five-minute walkthrough

Written, not recorded. Honest self-assessment, not a pitch — this is what I'd
say if you sat me down and asked "walk me through it."

## What it is

Next.js 16 + React 19, client-only, no backend. One form
([LoanEligibilityForm.tsx](src/components/LoanEligibilityForm.tsx)), one pure
function ([engine.ts](src/lib/engine.ts)) that turns answers into the four
outputs, one card component that renders them
([negotiation-card.tsx](src/components/negotiation-card.tsx)). Every
threshold the engine uses lives in [rules.json](src/lib/rules.json), Zod-
validated at load time, documented row-by-row in [RULES.md](RULES.md). If
you want to change a rule live, that's the one file to open.

## The core loop, in one pass

A borrower picks a loan type and income type first — that decision alone
prunes the form. Salaried never sees the low/high income-range fields;
self-employed and informal never see the single net-income field. Collateral
is the one question asked of everyone regardless of loan type, because it's
a property of the borrower, not of what they're calling the loan today.

On submit, `engine()` runs a fixed sequence: affordability from income minus
expenses minus existing obligations, a hard age/retirement-tenure cap, a
bounce-plus-high-cost-debt override that can force "don't borrow" outright,
then a FOIR ceiling, then collateral-based secured-product routing, then the
rate band, then the APR band, then a stress case. Every one of those
produces a plain-English reason string alongside the number — that was a
deliberate constraint from day one: no number is allowed to exist without
its sentence sitting next to it in the same return object.

Take Ravi (self-employed, no credit score, ₹45L unencumbered shop premises,
wants ₹15L for stock + a vehicle). He never gets asked for a credit score
he doesn't have — there's a checkbox for that, and it routes him to the
widest, lowest-confidence band rather than a floor score. His collateral
alone covers the ask, so he's silently repriced onto the secured (LAP) rate
band instead of the unsecured business-loan band he technically applied
under — and that repricing now runs early enough in the function that his
EMI table, his safe-to-carry figure, and his quoted rate all agree with each
other. That last part wasn't originally true; the rate switch used to happen
after the EMI math had already run against the old, more expensive rate, so
the card would show a 9–17% "fair rate" next to a table quietly priced at
14%. Caught it during review, fixed the ordering, re-ran the three
scenarios to confirm nothing else moved.

## What I'd defend without hesitation

- **The bounce+debt override is deliberately narrow.** A bounce alone or
  high-cost debt alone never forces "don't borrow" — only the combination
  does, because either signal in isolation is too weak to override math
  that otherwise says the borrower is fine. Anita triggers it; Priya and
  Ravi don't.
- **Unknown credit score gets its own band, not a default score.** It's
  wider and lower-confidence than any tiered band — never worst-case,
  never best-case.
- **safeToCarry and lenderLikely never collapse into one number**, and the
  UI always leads with the safer one, even when a lender would approve
  more.

## Where I'd push back on myself

Being honest about the soft spots, since these are the ones I'd expect to
get picked apart in a follow-up:

- **"Confidence widens with silence" is real but narrower than it sounds.**
  Only two things move the labeled confidence value: whether credit score
  is known, and whether a self-employed/informal borrower is under two
  years in the work. Every other optional answer (existing EMIs, bounces,
  high-cost debt, collateral) changes the *numbers* — which is arguably the
  more important effect — but doesn't touch the confidence label itself. If
  someone asked "does answering more questions make you more confident?"
  the honest answer is "it makes the numbers more accurate; only two
  specific answers move the confidence badge."
- **FOIR (50%), collateral LTV (60%), and the stress-case income drop
  (20%) are each a single fixed number**, not varied by income bracket or
  lender type, even though the literature I pulled these from cites wider
  ranges. That's a real simplification, not an oversight I'm unaware of.
- **The APR is an approximation.** The processing fee (+18% GST) is spread
  evenly across the tenure and added to the base rate — not the actual
  IRR-based all-in cost a bank would quote. Close enough to be useful,
  not exact enough to cite as precise.
- **Co-applicant income isn't modeled at all.** Ravi's wife earning ₹18,000
  teaching never enters the math. His numbers are his alone, which likely
  understates what a real lender would extend to the household.
- **A borrower can double-count a loan.** If Ravi's shop premises were
  already pledged against an existing loan, and he also listed that same
  loan under "existing EMIs," the engine has no way to know those are the
  same debt and would subtract it twice. Disclosed in RULES.md; not fixed,
  because the right fix is a UI-side warning at the point of the question,
  not a heuristic guessing at free-text overlap.
- **Business, LAP, and two-wheeler rate bands are less rigorously sourced
  than the personal-loan bands.** Personal loan tiers are cross-checked
  against four sources; the other three tables lean on fewer, and the
  two-wheeler table specifically anchors to EV-only data because two of
  the three personas needed it, not because I verified it against general
  two-wheeler products too.

## What I'd build next

In order of what would actually move a number for more borrowers:

1. **Co-applicant income**, with a haircut (not a straight add), still
   capped by the same FOIR logic — this is the single biggest real-world
   gap given how common joint applications are in India.
2. **A UI-side de-duplication warning** on the collateral question ("is
   this the same loan you listed above?") to close the double-counting
   gap without engine-side guessing.
3. **Income-bracket-aware FOIR and LTV** instead of one fixed number each —
   even a coarse three-tier version would be more honest than a single
   constant applied to a ₹26,000/month gig worker and a ₹1,10,000/month
   engineer alike.
4. **A real IRR-based APR** instead of the fee-spread approximation, now
   that the rate-ordering bug is fixed and everything is priced
   consistently — worth doing properly rather than layering a second
   approximation on top of a fixed one.

## What I'd cut if I were shipping this smaller

- **The three-way tenure options table** (current/+12/−12 months) in O4.
  It's a nice negotiating aid but it's not one of the four required
  outputs, and it's the first thing I'd drop under time pressure.
- **The live "what did the lender quote you?" comparator** on the
  Negotiation Card. Genuinely useful, directly inspired by the brief's own
  example line, but it's an enhancement on top of the card, not the card
  itself.

Neither of those touches the engine or the four core outputs — cutting them
loses polish, not correctness.

## What I would not cut, even under pressure

The adaptive skipping, the unknown-is-never-zero handling, the
reason-string-per-number requirement, and the RULES.md/rules.json split.
Those aren't features on top of the app — they're the actual answer to
"how do you think about the gap" that the brief opens with. Everything else
is negotiable; those four aren't.
