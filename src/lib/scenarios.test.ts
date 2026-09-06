// Manual scenario tests for engine() - no test framework, just plain
// assertions run via `npx tsx src/lib/scenarios.test.ts`.
//
// Each scenario builds a full LoanFormValues object from a persona
// description, runs it through engine(), and checks a few sanity
// expectations. Print the full result too, so it can be eyeballed against
// the persona's own numbers.

import { engine } from "./engine";
import {
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

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
if (failures > 0) process.exit(1);
