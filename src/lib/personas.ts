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
// - `age` (29) and the "Bengaluru" city label in RUNTHROUGHS.md: the brief
//   states none of the three personas' ages or cities. Age is not cosmetic
//   here - the engine reads it directly for the retirement-tenure cap (§2
//   in RULES.md) - so an invented value is a real, load-bearing assumption,
//   not flavor text. At 29 with a 60-month tenure it never binds (ends at
//   34, nowhere near the 60-year salaried retirement-age cap), so it
//   doesn't change this scenario's outcome, but a different assumed age
//   could have.
// - `existingEmis[0].monthsRemaining`: the persona states "2 years left"
//   on the car loan (24 months). The engine now weights this against the
//   new loan's 60-month tenure for the FOIR headroom check only (weight
//   0.4 = 24/60, so ~₹5,600 of her ₹14,000 EMI counts there) - see
//   RULES.md's monthsRemaining-weighting section. The UNWEIGHTED ₹14,000
//   is still what's subtracted for freeMoney/safeToCarry, since she pays
//   the full EMI today regardless of the new loan's tenure.
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
  existingEmis: [{ amount: "14000", monthsRemaining: "24" }],
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
// - `age` (42) and the "Mysuru" city label in RUNTHROUGHS.md: not stated by
//   the brief for any of the three personas - see the identical note on
//   Priya's `age` above. At 42 with a 60-month tenure it never binds (ends
//   at 47, nowhere near the 65-year self-employed retirement-age cap), so
//   it doesn't change this scenario's outcome either.
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
// - `age` (35) and the "Hubballi" city label in RUNTHROUGHS.md: not stated
//   by the brief for any of the three personas - see the identical note on
//   Priya's `age` above. At 35 with a 24-month tenure it never binds
//   (ends at 37, nowhere near either retirement-age cap). Moot either way
//   for this scenario's final numbers, since even a different assumed age
//   that did trigger a tenure cap would just feed into the bounce+high-
//   cost-debt override below, which zeroes every O2-O4 figure regardless.
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
// - The bounced EMI's `frequency` ("1", matching "one EMI bounced") and
//   `recency` (WithinOneMonth, matching "bounced last month") both feed
//   the graded bounce ladder now, alongside how many different loans were
//   affected (loansAffected = 1 here, since only one bounce row exists).
//   None of that changes HER result, though: the bounce+high-cost-debt
//   override (step 4) fires first and short-circuits before the ladder
//   (step 4a) is ever reached - the ladder only matters when the override
//   doesn't fire (see field-coverage.test.ts and scenarios.test.ts's
//   standalone-bounce probes for cases where it does).
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
