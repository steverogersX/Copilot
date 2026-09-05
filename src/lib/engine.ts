import {
  EmiBounceRecency,
  IncomeType,
  LoanType,
  type LoanFormValues,
} from "@/types/loan-eligibility-form";
import { rules } from "@/lib/rules";

// A bounce counts as "recent" if it happened within
// rules.bounceOverride.recentWindowMonths (currently 3). The enum only has
// coarse buckets, so the window is mapped to buckets here rather than
// computed from the raw number - keep this in sync with rules.json.
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
    aprBandLow: number;
    aprBandHigh: number;
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

// Rate bands by credit tier - values come from rules.json (rules.rateBands),
// not hardcoded here, so they can be reviewed/tuned without a code change.
function getRateBand(
  creditScore: number | null
): { low: number; high: number; confidence: Confidence } {
  if (creditScore === null) {
    // Unknown is never zero - widest band, flagged low confidence. §3
    return {
      low: rules.rateBands.unknown.lowPercent,
      high: rules.rateBands.unknown.highPercent,
      confidence: rules.rateBands.unknown.confidence as Confidence,
    };
  }
  const tier = rules.rateBands.tiers.find(
    (t) =>
      creditScore >= t.minScore &&
      (t.maxScore === null || creditScore <= t.maxScore)
  );
  const matched = tier ?? rules.rateBands.tiers[rules.rateBands.tiers.length - 1];
  return {
    low: matched.lowPercent,
    high: matched.highPercent,
    confidence: matched.confidence as Confidence,
  };
}

function calculateApr(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number,
  feePercent: number
): number {
  // Fold the one-time processing fee (+ GST) into an annualized rate by
  // treating it as extra effective interest, spread across the tenure.
  // Approximate, not actuarially exact - document this as a simplification
  // in RULES.md rather than presenting it as a precise APR calculation.
  const feeAmount =
    principal * (feePercent / 100) * (1 + rules.processingFee.gstRate);
  const tenureYears = tenureMonths / 12;
  const feeAnnualizedPercent = ((feeAmount / principal) * 100) / tenureYears;
  return annualRatePercent + feeAnnualizedPercent;
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
  if (formData.hasHighCostDebt === "yes") {
    const highCostDebtAmount = Number(formData.highCostDebtAmount);
    existingObligations +=
      (highCostDebtAmount * rules.highCostDebt.assumedAnnualRate) / 12;
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
      o3: { rateBandLow: 0, rateBandHigh: 0, aprBandLow: 0, aprBandHigh: 0, confidence: Confidence.Low },
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

  if (ageAtLoanEnd > rules.retirementAge.salaried) {
    const maxTenureMonths = Math.max(
      0,
      Math.floor((rules.retirementAge.salaried - age) * 12)
    );

    if (maxTenureMonths <= 0) {
      return {
        tenureAdjustmentNote: null,
        o1: {
          verdict: Verdict.DontBorrow,
          reason: `At age ${age}, you're already at or past the assumed retirement age of ${rules.retirementAge.salaried} lenders use for salaried borrowers - there's no valid tenure left to offer a loan against.`,
        },
        o2: { lenderLikely: 0, safeToCarry: 0 },
        o3: { rateBandLow: 0, rateBandHigh: 0, aprBandLow: 0, aprBandHigh: 0, confidence: Confidence.Low },
        o4: {
          emiCeiling: 0,
          stressCaseEmiCeiling: 0,
          stressCaseNote: "No valid tenure remains before retirement age.",
        },
      };
    }

    tenureAdjustmentNote = `Your requested tenure (${tenureMonths} months) would end at age ${Math.round(
      ageAtLoanEnd
    )}, past the assumed retirement age of ${rules.retirementAge.salaried}. Tenure capped to ${maxTenureMonths} months for this calculation.`;
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
      o3: { rateBandLow: 0, rateBandHigh: 0, aprBandLow: 0, aprBandHigh: 0, confidence: Confidence.Low },
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
  const foirMaxTotalEmi =
    Number(formData.netMonthlyIncome) * (rules.foir.capPercent / 100);
  const foirMaxNewEmi = Math.max(0, foirMaxTotalEmi - existingObligations);

  const lenderLikelyEmiCeiling = foirMaxNewEmi;
  const borrowerSafeEmiCeiling = Math.min(freeMoney, foirMaxNewEmi);
  const recommendedEmiCeiling = borrowerSafeEmiCeiling;

  // 6. Calculate the EMI needed for the requested amount, using whichever
  // point on the rate band rules.neededEmiRateStrategy.strategy selects.
  const creditScore = formData.creditScore ? Number(formData.creditScore) : null;
  const rateBand = getRateBand(creditScore);
  const assumedRate =
    rules.neededEmiRateStrategy.strategy === "midpoint"
      ? (rateBand.low + rateBand.high) / 2
      : rules.neededEmiRateStrategy.strategy === "high"
        ? rateBand.high
        : rateBand.low;

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

  // 8. O2 - convert both EMI ceilings into loan amounts, at the same
  // assumed rate used for neededEmi. Kept as two separate numbers per the
  // brief - never collapse lenderLikely and safeToCarry into one figure.
  const lenderLikelyAmount = calculateMaxPrincipal(
    lenderLikelyEmiCeiling,
    assumedRate,
    tenureMonths
  );
  const safeToCarryAmount = calculateMaxPrincipal(
    recommendedEmiCeiling,
    assumedRate,
    tenureMonths
  );

  // 9. O3 all-in APR band - fold the processing fee (+ GST) into the rate
  // band's low and high ends, using the low/high fee assumption respectively.
  const aprBandLow = calculateApr(
    amountWanted,
    rateBand.low,
    tenureMonths,
    rules.processingFee.lowPercent
  );
  const aprBandHigh = calculateApr(
    amountWanted,
    rateBand.high,
    tenureMonths,
    rules.processingFee.highPercent
  );

  // 10. O4 stress case - income drops by a fixed percentage; rate rise is
  // the other named brief dimension but income drop is the primary case
  // here since it applies across income types, not just floating-rate loans.
  const stressIncomeDropPercent = rules.stressCase.incomeDropPercent / 100;
  const stressedIncome =
    Number(formData.netMonthlyIncome) * (1 - stressIncomeDropPercent);
  const stressedFreeMoney =
    stressedIncome - Number(formData.monthlyExpenses) - existingObligations;
  const stressCaseEmiCeiling = Math.max(
    0,
    Math.min(stressedFreeMoney, foirMaxNewEmi)
  );
  const stressCaseNote = `If your income dropped by ${rules.stressCase.incomeDropPercent
    }%, your safe EMI ceiling would fall to ~₹${Math.round(
      stressCaseEmiCeiling
    )} - plan for this before committing to the top of your range.`;

  return {
    tenureAdjustmentNote,
    o1: { verdict, reason },
    o2: {
      lenderLikely: Math.round(lenderLikelyAmount),
      safeToCarry: Math.round(safeToCarryAmount),
    },
    o3: {
      rateBandLow: rateBand.low,
      rateBandHigh: rateBand.high,
      aprBandLow: Math.round(aprBandLow * 100) / 100,
      aprBandHigh: Math.round(aprBandHigh * 100) / 100,
      confidence: rateBand.confidence,
    },
    o4: {
      emiCeiling: Math.round(recommendedEmiCeiling),
      stressCaseEmiCeiling: Math.round(stressCaseEmiCeiling),
      stressCaseNote,
    },
  };
}

