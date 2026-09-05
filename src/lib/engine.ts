import {
  EmiBounceRecency,
  IncomeType,
  LoanType,
  type LoanFormValues,
} from "@/types/loan-eligibility-form";

// A bounce counts as "recent" (§3) if it happened within the last 3 months.
const RECENT_BOUNCE_RECENCIES: EmiBounceRecency[] = [
  EmiBounceRecency.WithinOneMonth,
  EmiBounceRecency.OneToThreeMonths,
];

export enum Verdict {
  Borrow = "borrow",
  BorrowLess = "borrow_less",
  DontBorrow = "dont_borrow",
}

export enum Confidence {
  Low = "low",
  Medium = "medium",
  High = "high",
}

export type EligibilityResult = {
  tenureAdjustmentNote: string | null;
  o1: {
    verdict: Verdict;
    reason: string;
  };
  o2: {
    lenderLikely: number;
    safeToCarry: number;
  };
  o3: {
    rateBandLow: number;
    rateBandHigh: number;
    confidence: Confidence;
  };
  o4: {
    emiCeiling: number;
    stressCaseEmiCeiling: number;
    stressCaseNote: string;
  };
};

// Standard reducing-balance EMI formula.
function calculateEmi(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number
): number {
  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

// Inverse of calculateEmi: the largest principal a given monthly EMI can carry.
function calculateMaxPrincipal(
  maxEmi: number,
  annualRatePercent: number,
  tenureMonths: number
): number {
  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) return maxEmi * tenureMonths;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  return (maxEmi * (factor - 1)) / (monthlyRate * factor);
}

// Salaried borrowers are assumed to stop earning at this age (§5).
const RETIREMENT_AGE_SALARIED = 60;

// Rate bands by credit tier - RULES.md §4 (mid-2026 market data, not RBI-fixed).
function getRateBand(
  creditScore: number | null
): { low: number; high: number; confidence: Confidence } {
  if (creditScore === null) {
    // Unknown is never zero - widest band, flagged low confidence. §3
    return { low: 14, high: 24, confidence: Confidence.Low };
  }
  if (creditScore >= 750)
    return { low: 11, high: 16, confidence: Confidence.High };
  if (creditScore >= 700)
    return { low: 11, high: 16, confidence: Confidence.High };
  if (creditScore >= 650)
    return { low: 16, high: 22, confidence: Confidence.Medium };
  return { low: 22, high: 30, confidence: Confidence.Medium };
}

export function engine(formData: LoanFormValues): EligibilityResult | null {
  // Scoped for now: salaried income + personal loan only.
  if (
    formData.incomeType !== IncomeType.Salaried ||
    formData.loanType !== LoanType.Personal
  ) {
    console.log(
      "engine: unsupported combination for now (only salaried + personal loan)"
    );
    return null;
  }

  const age = Number(formData.age);
  const amountWanted = Number(formData.amountWanted);
  let tenureMonths = Number(formData.tenurePreferred);
  let tenureAdjustmentNote: string | null = null;

  // 1. Deduct household expenses from take-home income.
  let freeMoney =
    Number(formData.netMonthlyIncome) - Number(formData.monthlyExpenses);

  // 2. Deduct existing EMIs, if any. Track the total separately too - it's
  // needed again below for the FOIR check, which cares about total debt
  // obligations vs. income, not leftover cash after expenses.
  let existingObligations = 0;
  for (const emi of formData.existingEmis) {
    existingObligations += Number(emi.amount);
  }

  // High-cost debt has no stated EMI, only an outstanding amount, so estimate
  // its monthly service cost at the documented high-cost rate (~30% p.a., §3)
  // and count it too - otherwise the amount field is collected but never
  // affects the affordability math, only the boolean override check below.
  const HIGH_COST_DEBT_ANNUAL_RATE = 0.3;
  if (formData.hasHighCostDebt === "yes") {
    const highCostDebtAmount = Number(formData.highCostDebtAmount);
    existingObligations += (highCostDebtAmount * HIGH_COST_DEBT_ANNUAL_RATE) / 12;
  }

  freeMoney -= existingObligations;

  if (freeMoney <= 0) {
    return {
      tenureAdjustmentNote: null,
      o1: {
        verdict: Verdict.DontBorrow,
        reason:
          "Existing expenses and EMIs already use up all your take-home income - there's no free cash to safely add a new EMI.",
      },
      o2: { lenderLikely: 0, safeToCarry: 0 },
      o3: { rateBandLow: 0, rateBandHigh: 0, confidence: Confidence.Low },
      o4: {
        emiCeiling: 0,
        stressCaseEmiCeiling: 0,
        stressCaseNote: "No free cash even before a rate rise or income drop.",
      },
    };
  }

  // 3. Age + tenure sanity check - the loan must finish before the borrower's
  // assumed retirement age, regardless of how affordable the math says it is.
  const requestedTenureYears = tenureMonths / 12;
  const ageAtLoanEnd = age + requestedTenureYears;

  if (ageAtLoanEnd > RETIREMENT_AGE_SALARIED) {
    const maxTenureMonths = Math.max(
      0,
      Math.floor((RETIREMENT_AGE_SALARIED - age) * 12)
    );

    if (maxTenureMonths <= 0) {
      return {
        tenureAdjustmentNote: null,
        o1: {
          verdict: Verdict.DontBorrow,
          reason: `At age ${age}, you're already at or past the assumed retirement age of ${RETIREMENT_AGE_SALARIED} lenders use for salaried borrowers - there's no valid tenure left to offer a loan against.`,
        },
        o2: { lenderLikely: 0, safeToCarry: 0 },
        o3: { rateBandLow: 0, rateBandHigh: 0, confidence: Confidence.Low },
        o4: {
          emiCeiling: 0,
          stressCaseEmiCeiling: 0,
          stressCaseNote: "No valid tenure remains before retirement age.",
        },
      };
    }

    tenureAdjustmentNote = `Your requested tenure (${tenureMonths} months) would end at age ${Math.round(
      ageAtLoanEnd
    )}, past the assumed retirement age of ${RETIREMENT_AGE_SALARIED}. Tenure capped to ${maxTenureMonths} months for this calculation.`;
    tenureMonths = maxTenureMonths;
  }

  // 4. Bounce + high-cost-debt pattern check - a single weak signal (just a
  // bounce, or just high-cost debt) should NOT override the math on its own.
  // Only the combination - a recent bounce alongside existing high-cost debt -
  // is real-world evidence that the math's "should be fine" doesn't hold (§3).
  const hasRecentBounce =
    formData.hadEmiBounces === "yes" &&
    formData.emiBounces.some((bounce) =>
      RECENT_BOUNCE_RECENCIES.includes(bounce.recency as EmiBounceRecency)
    );
  const hasHighCostDebt = formData.hasHighCostDebt === "yes";

  if (hasRecentBounce && hasHighCostDebt) {
    return {
      tenureAdjustmentNote,
      o1: {
        verdict: Verdict.DontBorrow,
        reason:
          "You have a recently bounced EMI together with existing high-cost debt - this combination is real-world evidence of financial strain that overrides the affordability math, regardless of how comfortable the numbers look on paper.",
      },
      o2: { lenderLikely: 0, safeToCarry: 0 },
      o3: { rateBandLow: 0, rateBandHigh: 0, confidence: Confidence.Low },
      o4: {
        emiCeiling: 0,
        stressCaseEmiCeiling: 0,
        stressCaseNote:
          "Recent bounce + high-cost debt pattern detected - resolve these before taking on new debt.",
      },
    };
  }

  // 5. FOIR check - a standard lender rule: total EMI obligations (existing +
  // new) must not exceed a fixed share of monthly income, regardless of what's
  // left over after expenses. This is independent of the freeMoney check above
  // and can be the stricter of the two.
  const FOIR_CAP = 0.5; // 50% of net monthly income
  const foirMaxTotalEmi = Number(formData.netMonthlyIncome) * FOIR_CAP;
  const foirMaxNewEmi = Math.max(0, foirMaxTotalEmi - existingObligations);

  const lenderLikelyEmiCeiling = foirMaxNewEmi;              // pure lender formula
  const borrowerSafeEmiCeiling = Math.min(freeMoney, foirMaxNewEmi); // real-life safe number
  const recommendedEmiCeiling = borrowerSafeEmiCeiling;        // which one to actually use — per brief, always the safer one

  // 6. Calculate the EMI needed for the requested amount, using the
  // borrower-relevant end of the rate band (favorable/likely rate, not worst-case).
  const creditScore = formData.creditScore ? Number(formData.creditScore) : null;
  const rateBand = getRateBand(creditScore);
  const assumedRate = rateBand.low; // use the lower/best-case end for "needed EMI" purposes — see note below

  const neededEmi = calculateEmi(amountWanted, assumedRate, tenureMonths);

  // 7. Verdict
  let verdict: Verdict;
  let reason: string;

  if (borrowerSafeEmiCeiling <= 0 && lenderLikelyEmiCeiling <= 0) {
    verdict = Verdict.DontBorrow;
    reason = "Both your existing obligations and your real monthly budget leave no room for any new EMI.";
  } else if (lenderLikelyEmiCeiling <= 0) {
    verdict = Verdict.DontBorrow;
    reason = "A lender is unlikely to approve any new loan given your existing obligations.";
  } else if (borrowerSafeEmiCeiling <= 0) {
    verdict = Verdict.DontBorrow;
    reason = "A lender might approve this on paper, but your actual expenses leave no safe room for a new EMI.";
  } else if (neededEmi <= borrowerSafeEmiCeiling) {
    verdict = Verdict.Borrow;
    reason = `Your requested EMI of ~₹${Math.round(neededEmi)} fits within your safe ceiling of ~₹${Math.round(borrowerSafeEmiCeiling)}.`;
  } else {
    verdict = Verdict.BorrowLess;
    reason = `Your requested amount needs an EMI of ~₹${Math.round(neededEmi)}, above your safe ceiling of ~₹${Math.round(borrowerSafeEmiCeiling)}. Consider a smaller amount or a longer tenure.`;
  }

  // TODO: O4 stress case, O1 verdict, and the final return are being added
  // progressively - not wired up yet.
  return null;
}

