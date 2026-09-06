# RULES.md

Every rule, threshold, band, and assumption the Lokta Borrower Copilot engine
(`src/lib/engine.ts`) runs on, plus the branching logic that ties them
together, and — just as important — what this app does not know.

All numeric values below live in [`src/lib/rules.json`](src/lib/rules.json),
validated at load time by [`src/lib/rules.schema.ts`](src/lib/rules.schema.ts).
Nothing in `engine.ts` hardcodes a business-rule number; every constant used
in the math traces back to a row in this table.

## 1. Every rule, threshold, band and assumption

| What | Value | Why | Source |
|---|---|---|---|
| FOIR cap | 50% | Industry-cited ideal FOIR range is 40-50%; using the upper bound as a single assumed cap. | Poonawalla Fincorp, L&T Finance, IndusInd Bank (mid-2026); my judgement within the cited range |
| Retirement age — salaried | 60 | Approximate lender-cap convention for loan-end age by income type. | my judgement, typical lender practice |
| Retirement age — self-employed | 65 | Approximate lender-cap convention for loan-end age by income type. | my judgement, typical lender practice |
| Personal loan rate band — credit score 750+ | 9.99%–11%, confidence: high | Unsecured personal-loan rate tiers by credit score bucket. | Finance Buddha, OnePaisa, FinanceFunda, Paisabazaar (mid-2026, personal loan segment) |
| Personal loan rate band — credit score 700–749 | 11%–16%, confidence: high | Unsecured personal-loan rate tiers by credit score bucket. | Finance Buddha, OnePaisa, FinanceFunda, Paisabazaar (mid-2026, personal loan segment) |
| Personal loan rate band — credit score 650–699 | 16%–22%, confidence: medium | Unsecured personal-loan rate tiers by credit score bucket. | Finance Buddha, OnePaisa, FinanceFunda, Paisabazaar (mid-2026, personal loan segment) |
| Personal loan rate band — credit score 0–649 | 22%–30%, confidence: medium | Unsecured personal-loan rate tiers by credit score bucket. | Finance Buddha, OnePaisa, FinanceFunda, Paisabazaar (mid-2026, personal loan segment) |
| Personal loan rate band — credit score unknown | 14%–24%, confidence: low | Never default an unknown credit score to worst-case or best-case; use the widest band with low confidence instead. | Finance Buddha, OnePaisa, FinanceFunda, Paisabazaar (mid-2026, personal loan segment) |
| Business loan rate band — credit score 750+ | 14%–18%, confidence: medium | Unsecured business-loan rate tiers by credit score bucket; runs higher than personal loans and varies more by lender type. | DMI Finance, FlexiLoans, Shardaassociates, IIFL (mid-2026); overall observed range ~8%–26% across lender types, narrowed to a usable band |
| Business loan rate band — credit score 700–749 | 16%–22%, confidence: medium | Unsecured business-loan rate tiers by credit score bucket. | DMI Finance, FlexiLoans, Shardaassociates, IIFL (mid-2026) |
| Business loan rate band — credit score 0–699 | 20%–26%, confidence: low | Unsecured business-loan rate tiers by credit score bucket. | DMI Finance, FlexiLoans, Shardaassociates, IIFL (mid-2026) |
| Business loan rate band — credit score unknown | 14%–26%, confidence: low | Never default an unknown credit score to worst-case or best-case; use the widest band with low confidence instead. | DMI Finance, FlexiLoans, Shardaassociates, IIFL (mid-2026) |
| LAP (secured) rate band — credit score 750+ | 9%–11%, confidence: high | Loan Against Property is secured, so rates run well below unsecured personal/business loans. | Poonawalla Fincorp, BankBazaar, HDFC Bank, Central Bank of India (mid-2026) |
| LAP (secured) rate band — credit score 700–749 | 11%–14%, confidence: medium | LAP rate tiers by credit score bucket. | Poonawalla Fincorp, BankBazaar, HDFC Bank, Central Bank of India (mid-2026) |
| LAP (secured) rate band — credit score 0–699 | 13%–17%, confidence: low | LAP rate tiers by credit score bucket. | Poonawalla Fincorp, BankBazaar, HDFC Bank, Central Bank of India (mid-2026) |
| LAP (secured) rate band — credit score unknown | 9%–17%, confidence: low | Never default an unknown credit score to worst-case or best-case; use the widest band with low confidence instead. | Poonawalla Fincorp, BankBazaar, HDFC Bank, Central Bank of India (mid-2026) |
| Two-wheeler/EV rate band — credit score 750+ | 10%–12%, confidence: medium | EV-specific two-wheeler rate tiers by credit score bucket. | meraev.com (EV-specific, mid-2026); corroborated by BankBazaar general two-wheeler listings (mid-2026) |
| Two-wheeler/EV rate band — credit score 700–749 | 11%–14%, confidence: medium | Two-wheeler/EV rate tiers by credit score bucket. | meraev.com (mid-2026); BankBazaar |
| Two-wheeler/EV rate band — credit score 0–699 | 14%–18%, confidence: low | Two-wheeler/EV rate tiers by credit score bucket. | meraev.com (mid-2026); BankBazaar |
| Two-wheeler/EV rate band — credit score unknown | 11%–16%, confidence: low | Never default an unknown credit score to worst-case or best-case; use the widest band with low confidence instead. | meraev.com (mid-2026); BankBazaar |
| Processing fee | 1%–3% of principal | Market-observed range is 0.5%–5%; using a mid-range band, not the extremes. | Paisabazaar, DMI Finance, BankBazaar (mid-2026) |
| GST on processing fee | 18% | Statutory GST rate applied on top of the processing fee. | Paisabazaar, DMI Finance, BankBazaar (mid-2026) |
| Bounce override recency window | 3 months | A single old/isolated bounce should not auto-reject; only a RECENT bounce combined with high-cost debt should override the math. | my judgement |
| Stress-case income drop | 20% | O4 requires one stress case (income drop or rate rise); income drop was chosen as the more universally relevant risk across income types. | my judgement |
| Needed-EMI rate strategy | low end of the rate band | Uses the optimistic/low end of the assumed rate band to compute the EMI needed for the requested amount, rather than the midpoint or the conservative high end. | my judgement |
| Self-employed new-business confidence threshold | 2 years in business | Confidence-only modifier — does not affect core affordability math. A newer business carries more income-continuity uncertainty over the loan's tenure. | my judgement |
| Collateral LTV (loan-to-value) | 60% | Typical LAP lending ceiling as a share of usable (unencumbered) property value. | my judgement, informed by typical LAP industry practice (50%–70% LTV range observed) |
| monthsRemaining weighting — enabled | true | An existing EMI ending partway through the new loan's tenure doesn't tie up the same average FOIR headroom as one running the full length; weighting it by overlap gives a more accurate LENDER-facing FOIR check. Applies to the lender ceiling only, never the borrower-safe ceiling or freeMoney — see §2. | my judgement |
| Bounce ladder — single recent bounce, rate band widen | +2 percentage points at the top | One recent, isolated bounce on one loan is weaker than the bounce+high-cost-debt override, but a lender's bureau check would still price it in — widen the top of the quoted band rather than leave it unpenalized. | my judgement |
| Bounce ladder — severe tier, minimum total bounces | 2 | Two or more bounces (summed across all rows) crosses from "single" into the "severe" ladder tier, alongside the loans-affected threshold below. | my judgement |
| Bounce ladder — severe tier, minimum loans affected | 2 | Bounces on two or more different loans also crosses into the "severe" tier, independent of total bounce count — spread-across-loans is a distinct red flag from repeat count alone. | my judgement |
| Bounce ladder — severe tier, rate band widen | +5 percentage points at the top | Base widen for the severe tier — repeated or spread bounces are worse than a single isolated one, so the band widens further than the single-bounce case. | my judgement |
| Bounce ladder — severe tier, safe-amount haircut | 15% | Beyond widening the quoted rate, the severe tier also haircuts the safe EMI ceiling itself — a lender pulling the bureau report would treat this pattern as materially elevated risk, not just a pricing adjustment. | my judgement |
| Bounce ladder — extra widen per loan affected beyond the first | +2 percentage points at the top | Within the severe tier, bounces spread across several loans are worse than the same count repeated on one loan (signals money ran out across the board, not one dispute with one lender) — each additional loan affected adds this on top of the tier's base widen. | my judgement |
| Bounce ladder — extra haircut per loan affected beyond the first | +5% | Same reasoning as the rate-widen row above, applied to the safe-amount haircut instead. | my judgement |
| High-cost-debt repayment — assumed tenure | 12 months | Informal/app-based high-cost loans typically amortize over a short tenure rather than running indefinitely; estimating a real repaying EMI (via the same reducing-balance formula used elsewhere) over an assumed 12-month tenure reflects the true monthly burden far better than an interest-only estimate, which meaningfully understates it. | my judgement, typical short-term/app-loan tenure |

## 2. Logic and branching rules

### O1 verdict priority order

The verdict is decided by walking this exact chain, top to bottom, and
stopping at the first branch that matches:

1. Both the lender ceiling and the borrower's safe ceiling are ≤0 → **Don't borrow**
2. The lender ceiling alone is ≤0 → **Don't borrow**
3. The borrower's safe ceiling alone is ≤0 → **Don't borrow**
4. The EMI needed for the requested amount is ≤ the safe ceiling → **Borrow**
5. Otherwise → **Borrow less**

**Why this order and not another:** a lender-side rejection and a
borrower-side "you can't actually afford this" are different failure modes
that deserve different wording, so they're checked separately rather than
collapsed into one condition. Only once both ceilings are confirmed positive
does the question become "does the requested amount fit," which is the
`Borrow` vs. `Borrow less` split. Checking affordability before amount-fit
means a borrower who genuinely cannot safely carry any new EMI is told so
directly, instead of being shown a downsized amount that's still unsafe.

### The "don't borrow" path is never a dead end

Three early-return branches can produce a "Don't borrow" verdict before the
normal calculation ever runs: no free cash before any EMI is even
considered, no valid tenure left before the assumed retirement age, and the
bounce+high-cost-debt override above. (The two ceiling-based branches in the
priority order (1) and (2) above are different — they fall through to the
normal end-to-end calculation rather than returning early, so they already
computed a real O3 rate band even before this fix.) All three early-return
branches used to zero out O3 (`rateBandLow`/`rateBandHigh` both 0%) as a
null-handling shortcut. That reads as a bug, not a design choice — 0%–0% is
never a real rate a borrower could be quoted, and it broke the negotiation
card's own quote-comparison widget (any real lender quote looked "above" a
fake 0% ceiling).

Every early-return "Don't borrow" result now instead carries:

- **A real, indicative O3 rate band and APR** for the borrower's loan type
  and credit profile — computed the same way as a normal result, just
  ignoring collateral routing (no loan is actually being sized) — clearly
  labelled in `rateReason` as "not a recommendation," since it's shown for
  reference only.
- **A populated `actionableNextStep`** naming the specific blocker in
  concrete terms and what would need to change to clear it (e.g., for the
  bounce+high-cost-debt override, the actual monthly cost of the high-cost
  debt and how many clean months would age the bounce out of the recent
  window). Generated in the engine per the reason-string-per-number pattern
  — never hardcoded in the UI component.

O2 and O4 are still correctly zero on these paths (no loan is being sized,
so there is no lender-approved amount or EMI ceiling to report) — only O3's
null-as-zero was the bug.

### The bounce + high-cost-debt override rule

A single isolated EMI bounce does **not**, by itself, trigger "Don't borrow."
Neither does existing high-cost debt on its own. Only the **combination** — a
*recent* bounce (within the last 3 months, per the bounce-recency window
above) together with *existing* high-cost debt — overrides the affordability
math and forces "Don't borrow," regardless of how comfortable the numbers
look on paper.

**Why:** a single bounce could be a one-off (a missed transfer, a bank error)
and is weak evidence on its own. High-cost debt alone is already priced into
the affordability math via an estimated real repaying EMI — amortized over an
assumed 12-month tenure (§1) at the borrower's own reported interest rate
(which can legitimately be 0, e.g. an interest-free advance from family or an
employer — this is not treated as a missing/invalid answer), not an
interest-only figure, which would meaningfully understate the true monthly
burden. But the two together — a recent bounce *and* an existing high-cost
loan — is a real behavioral pattern indicating financial strain that the
math's "should be fine" doesn't capture. This is a deliberate, load-bearing
design decision, not an incidental check.

**The override is a hard stop, not a dead end** — see "The 'don't borrow'
path is never a dead end" above for what it still surfaces (a real
indicative O3 band and an `actionableNextStep`) instead of zeroing
everything.

### Graded bounce ladder (below the override)

When the bounce+high-cost-debt override above does **not** fire, a recent
bounce still isn't ignored — three signals collected from the "Existing EMIs"
bounce rows (per-row frequency, per-row recency, and how many different loans
were affected) are aggregated into one of three tiers:

1. **None** — no bounce, or the worst bounce across all rows is older than
   the recent window (3 months, §1). No effect on anything.
2. **Single** — exactly one recent bounce on one loan (`totalBounces` = 1,
   `loansAffected` = 1). Downgrades confidence one level and widens the top
   of the quoted rate band by 2 points (§1).
3. **Severe** — `totalBounces` ≥ 2 **or** `loansAffected` ≥ 2 (either
   condition alone qualifies). Downgrades confidence one level (same as
   Single — severity does not stack additional confidence downgrades),
   widens the rate band's top by 5 points, and applies a 15% haircut
   directly to the safe EMI ceiling — not just a pricing adjustment, since a
   pattern this consistent is treated as materially elevated risk to the
   borrower's own safety math, not only to what a lender would quote.

**Bounces spread across several loans are worse than the same count repeated
on one loan.** Within the Severe tier, each loan affected beyond the first
adds an *extra* widen (+2 points) and *extra* haircut (+5%) on top of the
tier's base values (§1). Two bounces on one loan and two bounces spread
across two different loans both cross into Severe, but the spread case is
priced worse once there — repeated bounces on one loan could still be one
lender's dispute; a pattern across several loans signals money ran out
across the board.

Every bounce effect surfaces in `o3.confidenceReason` and/or `o3.rateReason`
(and `o2.safeToCarryReason` when the Severe haircut applies) — never a silent
penalty the borrower can't see.

### Two-number O2 structure

O2 always reports two separate numbers: `lenderLikely` (what a lender's FOIR
math alone would likely approve) and `safeToCarry` (the smaller of that and
what the borrower's actual free cash flow can safely support). These are
**never** collapsed into one figure — the app always recommends the safer
number (`safeToCarry`) as the actionable guidance, even when the lender's
number is larger.

**Why:** a lender's approval ceiling and a borrower's true safety margin are
different things. A lender approving a bigger loan than a borrower can
comfortably repay is exactly the scenario this app exists to flag, not paper
over by reporting only one blended number.

### monthsRemaining weighting — a lender/borrower asymmetry, on purpose

Each existing EMI now carries a `monthsRemaining` field. It is woven into the
FOIR headroom calculation with a deliberate asymmetry between the two O2
numbers:

- **`lenderLikely` uses a WEIGHTED obligation total.** Each existing EMI is
  weighted by `min(monthsRemaining, newLoanTenureMonths) / newLoanTenureMonths`
  before being summed — an EMI ending well before the new loan's tenure is
  over doesn't tie up the same *average* FOIR headroom as one running the
  full length, and a lender's FOIR assessment is exactly this kind of
  averaged, tenure-relative read.
- **`safeToCarry` (and `freeMoney`, and the O4 stress case) use the FULL,
  UNWEIGHTED obligation total.** The borrower pays the entire EMI, in full,
  every single month until it actually ends — averaging it down would make
  the number this app calls "safe" *less* safe than reality, which is
  precisely backwards for a tool whose purpose is the borrower's real
  safety margin, not a lender's approval odds.

**Why the two ceilings are allowed to diverge because of this:** before this
weighting existed, `lenderLikely` and `safeToCarry` would coincidentally
match whenever the FOIR cap was the binding constraint on both sides (see
`ceilingsMatchNote`). Now that the two sides use genuinely different
obligation totals, a match is more likely to be a real coincidence for that
borrower's numbers than the "same ceiling driving both" explanation that
used to always apply — `ceilingsMatchNote`'s wording reflects whichever is
actually true rather than always claiming "not a coincidence."

Toggleable via `monthsRemainingWeighting.enabled` in rules.json (§1) — when
disabled, both sides fall back to the same unweighted total.

### Income-type branching (self-employed / informal)

For self-employed (and, once fully wired, informal) borrowers, income is
collected as a low/high monthly range instead of a single figure, and used
for three distinct jobs:

- **LOW month** drives the borrower-side safety math (O1's `freeMoney`, O4's
  stress case). Why: an EMI is owed every month regardless of that month's
  actual earnings, so the worst realistic month is the only honest anchor for
  "can this borrower safely carry a new EMI."
- **AVERAGE month** — now *derived* as the midpoint of low and high, not
  asked as its own field — drives the lender-facing FOIR calculation. Why:
  real lenders assess bank-statement pattern/average income, not a
  borrower's single worst month; using the low month for the lender-side
  check would understate what a lender would realistically extend credit
  against. **Limitation:** the midpoint assumes a roughly even income
  spread. A borrower with mostly-low months and a rare spike would have a
  true average lower than the midpoint — see §3.
- **HIGH month** is display-only and touches no formula. Why: a borrower's
  best month overstates realistic repayment capacity in both directions
  (too optimistic for safety math, too generous for lender math) — it's
  shown back to the borrower for their own context only.

### Years-in-business / duration-of-work as confidence-only

`yearsInBusiness` (self-employed) below the 2-year threshold above downgrades
the *reported confidence label* one step (High→Medium, Medium→Low, Low stays
Low). It **never** touches `freeMoney`, `foirMaxNewEmi`,
`borrowerSafeEmiCeiling`, or any other EMI/amount figure — it is purely a
confidence-label modifier.

**Known simplification** (see §3): some real lenders treat minimum work
tenure as a hard eligibility gate rather than a soft confidence signal — this
app does not currently enforce that as a gate.

### Collateral / secured-product routing

Usable collateral is computed as the pledged asset's estimated value minus
any amount already outstanding against it (`usableCollateralValue = value −
outstanding`, floored at 0). That usable value, multiplied by the collateral
LTV (60%), produces a collateral-based lender ceiling.

The app routes a borrower to a secured product (Loan Against Property)
**only when usable collateral alone can cover the requested amount** —
partial or mostly-used-up collateral does not trigger the secured
recommendation just because *some* collateral exists.

When routed:
- The rate band used for **every downstream calculation** — not just
  display — switches to the LAP rate band (9%–17%, tiered by credit score —
  see §1), regardless of which loan type the borrower originally applied
  under. This routing decision is resolved first, before the rate-dependent
  math that follows it (the EMI needed for the requested amount, both O2
  amounts, and O4's tenure table), so every number the borrower sees is
  priced off the same rate O3 shows them as "fair for you" — never a mix of
  the original unsecured rate and the LAP rate.
  `lenderLikely` becomes the larger of the income-based FOIR ceiling
  (itself now computed at the LAP rate) and the collateral-based ceiling.
- **`safeToCarry`'s EMI ceiling is completely unaffected by collateral** —
  it is still capped purely by income/expenses/existing obligations, and
  collateral never raises it the way it can raise `lenderLikely`. What
  *does* change when routed is the rate used to convert that EMI ceiling
  into a principal amount: it uses the LAP rate the borrower will actually
  be quoted, not the original unsecured rate, so the reported rupee figure
  reflects what they can truly afford at their real cost of borrowing.

This is the mechanism by which a borrower like Ravi — who has real
unencumbered collateral — gets routed toward a secured product instead of an
unsecured business loan: a lower rate and a higher lender-approved amount,
surfaced explicitly via `securedProductNote`, while his personal safe-to-carry
*ceiling* stays governed by his actual income, priced at the rate he'll
actually pay.

If an already-pledged loan exists against the collateral, its estimated EMI
(computed from the borrower-reported outstanding amount, interest rate, and
remaining tenure) is added to existing obligations — see the double-counting
limitation in §3.

### APR / all-in cost

O3's APR band is not the base interest rate band alone. The one-time
processing fee (plus 18% GST on that fee) is annualized — spread evenly
across the loan's tenure — and added on top of the base rate band's low and
high ends to produce `aprBandLow`/`aprBandHigh`.

**This is an approximation, not an actuarially exact APR.** Spreading a
one-time fee evenly across tenure is a simplification of how APR is properly
computed (which would solve for the rate that equates fee + interest cash
flows to the loan schedule). It is disclosed here as a documented
approximation rather than presented as a precise APR.

### Loan-type-specific rate bands

`getRateBand()` selects one of four rate tables — personal, business, LAP
(secured), or two-wheeler/EV — based on the loan type being applied for, each
independently tiered by credit score with its own "unknown score" fallback.
Business and two-wheeler applicants are no longer priced off the personal-loan
table; each product's own researched market range is used instead.

**Why a separate override for the secured path:** the loan-type table only
decides pricing for the *unsecured* line of the application. Once collateral
routing (above) determines the borrower qualifies for a secured product, the
rate band is looked up again from the LAP table instead — the original loan
type (Business, Personal, or TwoWheeler) is irrelevant to pricing once the
loan becomes secured.

### No verification, no ITR usage

All income figures — for salaried, self-employed, and informal borrowers
alike — are **self-reported and trusted at face value**. The app does not
request or use ITR filings, payslips, or bank statements to verify any
number. No income type is held to a stricter evidentiary standard than
another; this is a self-assessment tool, not an underwriting engine.

### Universal collateral question

The collateral question ("do you own any property/asset you could pledge?")
is asked **regardless of loan type or income type** — a personal-loan
applicant is asked exactly as a business-loan applicant is. Collateral is a
property of the borrower's asset situation, not of what they are calling the
loan they want right now.

## 3. What this app does not know / where it is guessing

- **Business, LAP, and two-wheeler/EV rate bands are sourced from published
  market listings, not from actual lender API quotes.** Unlike the personal-
  loan tiers, these three tables have not been cross-checked against as many
  independent sources, and the two-wheeler table specifically anchors to
  EV-specific data (general non-electric two-wheeler loans span a wider,
  less-tiered 7.6%–28% range that this app does not separately model).
- **Derived average income (midpoint of low/high) assumes an even spread.**
  A borrower with mostly-low months and a rare high spike would have a true
  average meaningfully below this midpoint — the app has no way to detect or
  correct for a skewed distribution from just two numbers.
- **Years-in-business/duration-of-work is treated as a soft confidence
  signal, not a hard gate.** Real lender products (e.g., gig-worker
  two-wheeler loan products observed to require 1+ year minimum work
  tenure) sometimes disqualify below a minimum tenure outright. This app
  only downgrades confidence — it does not reject on this basis.
- **Existing-loan double-counting on pledged collateral is mitigated in the
  UI, not fixed in the engine.** If a borrower already listed the loan
  against their pledged collateral under "Existing EMIs," it will also be
  counted (as an estimated EMI) via the collateral question — the form now
  shows a warning in the Existing EMIs section when the borrower has said
  their collateral is already pledged, but there is still no reliable way
  to de-duplicate a free-text EMI entry against the collateral answer in
  the engine itself, so a borrower who ignores the warning will still be
  double-counted.
- **monthsRemaining weighting only applies to existing EMIs, not high-cost
  debt or an already-pledged collateral loan.** No remaining-tenure is
  collected for either of those two obligation sources, so they're carried
  into the lender-facing weighted total at full, unweighted value — treated
  as if they ran the new loan's entire tenure, even if they'll actually
  finish sooner. This understates the lender ceiling by a small margin in
  that case, rather than overstating it, so it errs on the conservative
  side, but it is not modeled precisely.
- **Co-applicant income is not modeled at all.** A borrower applying jointly
  (e.g., with a spouse) receives individual-only numbers, which may
  understate their real eligibility.
- **FOIR (50%), collateral LTV (60%), and stress-case income drop (20%) are
  single fixed assumptions**, not lender-specific or income-bracket-specific.
  Real limits vary meaningfully — the FOIR literature alone cites a
  documented range of roughly 40%–70% depending on income level — and this
  app does not vary its cap by lender or income bracket.
- **The "unknown credit score" band is a designed band, not an observed
  one.** It is deliberately the widest band with the lowest confidence
  rather than a worst-case or best-case default, but it is not derived from
  any specific lender's actual documented treatment of missing-score
  applicants — treatment varies by lender and, at some lenders, may include
  outright rejection rather than a wider quote.
