// The three brief personas' exact form inputs - kept in their own
// data-only module (no top-level side effects) so other files, like the
// Playwright run-throughs spec, can import them directly without
// re-running scenarios.test.ts's own assertions/process.exit as a side
// effect of the import.
//
// scenarios.test.ts is the canonical place these are exercised against
// engine() with assertions; this file is just the shared data.

import {
  EmiBounceRecency,
  IncomeType,
  LoanType,
  type LoanFormValues,
} from "@/types/loan-eligibility-form";

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
export const priya: LoanFormValues = {
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
export const ravi: LoanFormValues = {
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
export const anita: LoanFormValues = {
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
