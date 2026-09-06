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
then a graded bounce ladder for everything below that override, then two
FOIR ceilings (one lender-facing, one borrower-facing — they differ on
purpose, see below), then collateral-based secured-product routing, then the
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

- **The lender ceiling and the safe ceiling treat the same debt
  differently, on purpose.** An existing EMI that ends partway through the
  new loan is weighted down for the lender-facing FOIR check, because that
  is how a bank averages an obligation across a loan's life. It is *not*
  weighted for the borrower-safe ceiling, because the borrower actually
  pays it in full every month until it ends. Priya's ₹14,000 car loan with
  24 months left counts as ₹5,600 to the lender and the full ₹14,000 to
  her. That asymmetry is the single thing I'd most want to be asked about.
- **The bounce override is narrow, but bounces are never ignored.** Only a
  recent bounce *combined with* high-cost debt forces "don't borrow",
  because either signal alone is too weak to override otherwise-fine math.
  Everything below that runs through a graded ladder instead: an old
  isolated bounce does nothing, one recent bounce costs a confidence level
  and widens the band, and repeated or spread-across-loans bounces widen it
  further and haircut the safe amount. Bounces spread across several loans
  are treated as worse than the same count on one loan, because that is
  money running out across the board rather than one dispute.
- **"Don't borrow" is never a dead end.** Anita still gets a real
  indicative rate band, clearly labelled as reference-only, plus a next
  step naming her actual blocker: her ₹35,000 at 30% is costing roughly
  ₹3,412 a month, and clearing it plus three clean months lifts the
  override by itself.
- **Unknown credit score gets its own band, not a default score.** It's
  wider and lower-confidence than any tiered band — never worst-case,
  never best-case.

## Where I'd push back on myself

Being honest about the soft spots, since these are the ones I'd expect to
get picked apart in a follow-up:

- **There is no borrower-side cushion, and that's the gap I'd fix first.**
  The safe ceiling is the lesser of the lender's FOIR cap and every spare
  rupee after expenses and EMIs. Neither of those is a savings buffer. For
  Priya the FOIR cap binds at ₹41,000, which still puts 75.5% of her income
  into rent plus EMIs. Nothing in the engine says "keep something back",
  and I'd add a residual-income floor or a borrower FOIR below the lender's
  before I'd add any new feature.
- **"Confidence widens with silence" is real but it's a three-level label,
  not a width.** Credit score, years in the work, and recent bounces each
  move it. What it does *not* do is respond to sheer volume of unanswered
  optional questions — someone who skips collateral and existing EMIs
  entirely gets the same badge as someone who filled everything in. The
  rate band does widen on real signals, but the label isn't a completeness
  score, and I'd describe it that way rather than overclaiming.
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
- **Double-counting a pledged loan is mitigated, not eliminated.** If the
  collateral is already pledged, the form now warns against also listing
  that same loan under "existing EMIs". But it's a warning, not a
  constraint — a determined user can still enter it twice and have it
  subtracted twice. I went with the warning rather than a heuristic trying
  to guess overlap between free-text entries.
- **Business, LAP, and two-wheeler rate bands are less rigorously sourced
  than the personal-loan bands.** Personal loan tiers are cross-checked
  against four sources; the other three tables lean on fewer, and the
  two-wheeler table specifically anchors to EV-only data because two of
  the three personas needed it, not because I verified it against general
  two-wheeler products too.

## What I'd build next

In order of what would actually move a number for more borrowers:

1. **A borrower-side cushion**, as described above — either a residual
   income floor or a borrower FOIR set below the lender's. It's the
   difference between telling someone what they can technically service
   and telling them what they should actually sign, which is the whole
   premise of the product.
2. **Co-applicant income**, with a haircut (not a straight add), still
   capped by the same FOIR logic — the biggest real-world gap given how
   common joint applications are in India. Ravi's wife earning ₹18,000
   currently counts for nothing.
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
