// Manual scenario tests for engine() - no test framework, just plain
// assertions run via `npx tsx src/lib/scenarios.test.ts`.
//
// Each scenario builds a full LoanFormValues object from a persona
// description, runs it through engine(), and checks a few sanity
// expectations. Print the full result too, so it can be eyeballed against
// the persona's own numbers.

import { engine } from "./engine";
import {
  EmiBounceRecency,
  IncomeType,
  LoanType,
  type LoanFormValues,
} from "@/types/loan-eligibility-form";

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failures++;
    console.error(`  FAIL: ${message}`);
  } else {
    console.log(`  PASS: ${message}`);
  }
}

function runScenario(name: string, formData: LoanFormValues) {
  console.log(`\n=== ${name} ===`);
  const result = engine(formData);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ---------------------------------------------------------------------
// Priya, 29 - Bengaluru, salaried
//
// Software engineer at a large MNC for 5 years. Net ₹1,10,000/month.
// One car loan, EMI ₹14,000, 2 years (24 months) left. Credit score 780.
// Rents at ₹28,000.
//
// Wants ₹8,00,000 personal loan for a wedding.
//
// Assumptions not given in the persona description (flagged inline):
// - `loanType`: the existing car loan has no matching option in the
//   engine's three-loan-type scope (Personal/Business/TwoWheeler) -
//   used Personal as the closest stand-in. It has no effect on the math
//   either way, since existingEmis only contributes its `amount`.
// - `existingEmis[0].interestRate`: not stated by the persona; the
//   engine never reads this field for its math (only `amount` is
//   summed), so an arbitrary plausible car-loan rate (9.5%) is used.
// - `tenurePreferred`: not stated for the new personal loan; 60 months
//   is used as a typical personal-loan tenure for a large one-off
//   expense like a wedding.
// - Rent (₹28,000) is treated as her "monthly expenses" figure.
const priya: LoanFormValues = {
  loanType: LoanType.Personal,
  amountWanted: "800000",
  incomeType: IncomeType.Salaried,
  tenurePreferred: "60",
  incomeStabilityLow: "",
  incomeStabilityHigh: "",
  yearsInBusiness: "",
  age: "29",
  netMonthlyIncome: "110000",
  existingEmis: [
    { type: LoanType.Personal, amount: "14000", interestRate: "9.5" },
  ],
  monthlyExpenses: "28000",
  hadEmiBounces: "no",
  emiBounces: [],
  hasHighCostDebt: "no",
  highCostDebtAmount: "",
  highCostDebtInterestRate: "",
  creditScore: "780",
  creditScoreUnknown: false,
  hasCollateral: "no",
  collateralValue: "",
  collateralAlreadyPledged: "",
  collateralOutstandingAmount: "",
  collateralInterestRate: "",
  collateralRemainingTenureMonths: "",
};

{
  const result = runScenario("Priya (29, salaried, personal loan for wedding)", priya);

  assert(result !== null, "engine() returns a result, not null");

  if (result) {
    // Free cash: 110000 - 28000 (expenses) - 14000 (existing EMI) = 68000/month.
    // FOIR ceiling: 50% of 110000 = 55000, minus 14000 existing = 41000/month
    // available for a new EMI - this is the binding constraint (lender ceiling
    // < borrower free cash), so the safe ceiling should equal the FOIR-derived
    // number, not the larger free-cash number.
    assert(
      result.o4.emiCeiling <= 41000 + 1,
      `EMI ceiling (${result.o4.emiCeiling}) respects the 50% FOIR cap (~41,000/month)`
    );

    // High credit score (780) -> best personal-loan tier -> high confidence.
    assert(
      result.o3.confidence === "high",
      `Confidence is high for a 780 credit score (got: ${result.o3.confidence})`
    );

    assert(
      result.o3.rateBandLow === 9.99 && result.o3.rateBandHigh === 11,
      `Rate band matches the 750+ personal-loan tier (9.99%-11%), got ${result.o3.rateBandLow}%-${result.o3.rateBandHigh}%`
    );

    // No collateral was offered, so this should never route to a secured product.
    assert(
      result.o2.routedToSecuredProduct === false,
      "Not routed to a secured product (no collateral offered)"
    );

    // Comfortable income relative to the requested amount - expect a clear
    // "borrow" or "borrow less" verdict, not a rejection.
    assert(
      result.o1.verdict !== "dont_borrow",
      `Verdict is not a rejection given her comfortable income (got: ${result.o1.verdict})`
    );
  }
}

// ---------------------------------------------------------------------
// Ravi, 42 - Mysuru, self-employed
//
// Kirana store for 14 years. Cash income ₹40,000-80,000/month; ITR shows
// ₹4,20,000/year. Owns the shop premises, about ₹45,00,000, unencumbered.
// Never taken a formal loan; no credit score. Wife earns ₹18,000 teaching.
//
// Wants ₹15,00,000 for a second stock line and a delivery vehicle.
//
// Assumptions/gaps not given in the persona description (flagged inline):
// - `monthlyExpenses`: not stated anywhere in the persona - the schema
//   requires a positive figure, so ₹25,000/month is used as a placeholder
//   household-expense estimate. This is the single most consequential
//   assumption in this scenario: freeMoney (and therefore the whole
//   `borrow_less` verdict below) moves directly with whatever this number
//   is, so treat the exact verdict as illustrative, not as ground truth.
// - `tenurePreferred`: not stated; 60 months is used as a plausible
//   business-loan tenure covering both a stock purchase and a vehicle.
// - ITR-reported annual income (₹4,20,000 -> ~₹35,000/month) is LOWER
//   than the midpoint of his self-reported cash range (₹60,000/month).
//   The engine has no ITR field and never reconciles the two - it uses
//   only the self-reported low/high range, so this scenario silently
//   trusts the higher, unverified cash figure over the lower, verifiable
//   ITR figure. This is exactly the "no verification, no ITR usage"
//   limitation already disclosed in RULES.md §3, not a new bug.
// - Wife's ₹18,000 teaching income is NOT added anywhere - co-applicant/
//   household income is out of scope per RULES.md §3 ("co-applicant
//   income is not modeled at all"). Ravi is assessed on his income alone.
// - "Never taken a formal loan" -> no existingEmis, no EMI bounces
//   (nothing to have bounced), no high-cost debt.
const ravi: LoanFormValues = {
  loanType: LoanType.Business,
  amountWanted: "1500000",
  incomeType: IncomeType.SelfEmployed,
  tenurePreferred: "60",
  incomeStabilityLow: "40000",
  incomeStabilityHigh: "80000",
  yearsInBusiness: "14",
  age: "42",
  netMonthlyIncome: "",
  existingEmis: [],
  monthlyExpenses: "25000",
  hadEmiBounces: "no",
  emiBounces: [],
  hasHighCostDebt: "no",
  highCostDebtAmount: "",
  highCostDebtInterestRate: "",
  creditScore: "",
  creditScoreUnknown: true,
  hasCollateral: "yes",
  collateralValue: "4500000",
  collateralAlreadyPledged: "no",
  collateralOutstandingAmount: "",
  collateralInterestRate: "",
  collateralRemainingTenureMonths: "",
};

{
  const result = runScenario(
    "Ravi (42, self-employed kirana owner, business loan for stock + vehicle)",
    ravi
  );

  assert(result !== null, "engine() returns a result, not null");

  if (result) {
    // Unencumbered collateral (₹45,00,000) at the 60% LTV cap gives a
    // collateral-based lender ceiling of ₹27,00,000 - comfortably above
    // the ₹15,00,000 he wants, so this should route to a secured product
    // (LAP) rather than pricing as an unsecured business loan.
    assert(
      result.o2.routedToSecuredProduct === true,
      "Routed to a secured product (unencumbered collateral covers the amount wanted)"
    );

    // Once routed, pricing should come from the LAP table's unknown-score
    // tier (9%-17%), not the business-loan table he originally applied under.
    assert(
      result.o3.rateBandLow === 9 && result.o3.rateBandHigh === 17,
      `Rate band matches the LAP unknown-score tier (9%-17%), got ${result.o3.rateBandLow}%-${result.o3.rateBandHigh}%`
    );

    // No credit score was provided -> low confidence, and the reason should
    // say so explicitly (traceability requirement).
    assert(
      result.o3.confidence === "low",
      `Confidence is low with no credit score on file (got: ${result.o3.confidence})`
    );
    assert(
      result.o3.confidenceReason.toLowerCase().includes("credit score"),
      `Confidence reason explains the missing credit score (got: "${result.o3.confidenceReason}")`
    );

    // 14 years in business is well past the 2-year new-business threshold,
    // so the confidence reason should NOT cite a new-business downgrade.
    assert(
      !result.o3.confidenceReason.toLowerCase().includes("less than 2 years"),
      "Confidence reason does not cite new-business uncertainty (14 years in business)"
    );

    // Collateral only ever raises the lender-facing ceiling - safeToCarry
    // stays purely income-driven, so it should NOT match the collateral-
    // inflated lenderLikely figure here.
    assert(
      result.o2.safeToCarry < result.o2.lenderLikely,
      `safeToCarry (${result.o2.safeToCarry}) stays below the collateral-boosted lenderLikely (${result.o2.lenderLikely})`
    );

    // Routed-to-secured case: the "why do these two numbers match"
    // explainer should not fire here, since they don't match.
    assert(
      result.o2.ceilingsMatchNote === null,
      "ceilingsMatchNote is null when lenderLikely and safeToCarry genuinely differ"
    );

    assert(
      result.o2.securedProductNote !== null,
      "securedProductNote is populated when routed to a secured product"
    );

    // The collateral path (~₹27,00,000) clearly beats the income/FOIR path
    // (~₹12,89,000) here, so lenderLikelyReason must lead with the
    // collateral path that actually won - it's fine for the sentence to
    // still mention the FOIR figure it's beating, just not lead with it.
    assert(
      result.o2.lenderLikelyReason.toLowerCase().startsWith("based on your unencumbered collateral"),
      `lenderLikelyReason leads with the winning collateral path (got: "${result.o2.lenderLikelyReason}")`
    );
  }
}

// ---------------------------------------------------------------------
// Anita, 35 - Hubballi, informal
//
// Delivery-platform rider plus home tailoring. ₹26,000-30,000/month, two
// children, husband unemployed 8 months. Three app loans, ₹35,000
// outstanding at 30%+, one EMI bounced last month.
//
// Wants ₹1,50,000 for an electric scooter to double delivery runs.
//
// Assumptions/gaps not given in the persona description (flagged inline):
// - `monthlyExpenses`: not stated - the schema requires a positive
//   figure. ₹18,000/month is used as a placeholder for a family of four
//   in Hubballi with one earner. As with Ravi, this is a real guess and
//   moves freeMoney directly - but it does NOT change the final verdict
//   in this scenario either way, since the bounce+high-cost-debt override
//   (see below) forces "Don't borrow" before freeMoney is even checked
//   against the requested amount.
// - `yearsInBusiness` (duration of work): not stated; 3 is used as a
//   placeholder. It's never actually read for this result either - the
//   engine short-circuits at the bounce+debt override (step 4) before
//   reaching the years-in-business confidence modifier (step 6b).
// - The three "app loans" have no matching option in the engine's
//   existingEmis loan-type scope, but they don't need one: the form's
//   high-cost/informal-debt question ("loan apps, high-interest loans")
//   is designed exactly for this case, so all ₹35,000 is captured there
//   instead of in existingEmis.
// - `highCostDebtInterestRate`: persona says "30%+" (a lower bound, not
//   an exact figure) - 30 is used as the representative rate.
// - The bounced EMI's `type`/`amount`/`frequency` are not given a formal
//   loan type or exact amount by the persona (it's one of the informal
//   app loans) - Personal is used as a stand-in type and ₹3,000 as a
//   plausible installment amount. Neither affects the bounce-override
//   logic, which only reads `recency` (set to WithinOneMonth, matching
//   "bounced last month") and frequency "1" (matching "one EMI bounced").
// - `tenurePreferred`: not stated for the scooter loan; 24 months is used
//   as a typical two-wheeler loan tenure.
// - Husband's 8-month unemployment and the two children are not
//   translatable to any discrete field beyond informing the monthly-
//   expenses guess above - co-applicant/household composition isn't
//   modeled (RULES.md §3).
const anita: LoanFormValues = {
  loanType: LoanType.TwoWheeler,
  amountWanted: "150000",
  incomeType: IncomeType.Informal,
  tenurePreferred: "24",
  incomeStabilityLow: "26000",
  incomeStabilityHigh: "30000",
  yearsInBusiness: "3",
  age: "35",
  netMonthlyIncome: "",
  existingEmis: [],
  monthlyExpenses: "18000",
  hadEmiBounces: "yes",
  emiBounces: [
    {
      type: LoanType.Personal,
      amount: "3000",
      frequency: "1",
      recency: EmiBounceRecency.WithinOneMonth,
    },
  ],
  hasHighCostDebt: "yes",
  highCostDebtAmount: "35000",
  highCostDebtInterestRate: "30",
  creditScore: "",
  creditScoreUnknown: true,
  hasCollateral: "no",
  collateralValue: "",
  collateralAlreadyPledged: "",
  collateralOutstandingAmount: "",
  collateralInterestRate: "",
  collateralRemainingTenureMonths: "",
};

{
  const result = runScenario(
    "Anita (35, informal gig worker, two-wheeler loan for an EV scooter)",
    anita
  );

  assert(result !== null, "engine() returns a result, not null");

  if (result) {
    // This is exactly the case the bounce+high-cost-debt override rule
    // (RULES.md §2) was designed for: a RECENT bounce (last month) together
    // with EXISTING high-cost debt (three app loans at 30%+) should force
    // "Don't borrow" regardless of how the underlying budget math looks -
    // neither signal alone would trigger this.
    assert(
      result.o1.verdict === "dont_borrow",
      `Verdict is "dont_borrow" from the bounce+high-cost-debt override (got: ${result.o1.verdict})`
    );

    assert(
      result.o1.reason.toLowerCase().includes("bounce") &&
        result.o1.reason.toLowerCase().includes("high-cost"),
      `Reason names both the recent bounce and the high-cost debt (got: "${result.o1.reason}")`
    );

    // The override short-circuits before any amount/rate math runs - every
    // O2/O3/O4 number should come back zeroed rather than a partial or
    // stale calculation.
    assert(
      result.o2.lenderLikely === 0 && result.o2.safeToCarry === 0,
      "O2 amounts are zeroed out when the override fires"
    );
    assert(
      result.o3.rateBandLow === 0 && result.o3.rateBandHigh === 0,
      "O3 rate band is zeroed out when the override fires"
    );
    assert(
      result.o4.emiCeiling === 0 && result.o4.tenureOptions.length === 0,
      "O4 EMI ceiling and tenure options are zeroed/empty when the override fires"
    );
  }
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
if (failures > 0) process.exit(1);
