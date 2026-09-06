import {
  EmiBounceRecency,
  IncomeType,
  LOAN_TYPE_LABELS,
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

// Most-to-least severe, for finding the single worst bounce across every
// row a borrower listed.
const RECENCY_SEVERITY_ORDER: EmiBounceRecency[] = [
  EmiBounceRecency.WithinOneMonth,
  EmiBounceRecency.OneToThreeMonths,
  EmiBounceRecency.ThreeToSixMonths,
  EmiBounceRecency.SixToTwelveMonths,
  EmiBounceRecency.MoreThanYear,
];

function worstBounceRecency(
  bounces: LoanFormValues["emiBounces"]
): EmiBounceRecency | null {
  if (bounces.length === 0) return null;
  return bounces.reduce<EmiBounceRecency>((worst, bounce) => {
    const recency = bounce.recency as EmiBounceRecency;
    return RECENCY_SEVERITY_ORDER.indexOf(recency) <
      RECENCY_SEVERITY_ORDER.indexOf(worst)
      ? recency
      : worst;
  }, bounces[0].recency as EmiBounceRecency);
}

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

// Graded bounce-severity read - not part of EligibilityResult (it's an
// internal input to the rate-band/confidence/safe-amount math, not a
// number the UI displays directly), but an enum for the same reason
// Verdict/Confidence are: a fixed, named set of tiers beats a raw string.
enum BounceTier {
  None = "none",
  Single = "single",
  Severe = "severe",
}

export type EligibilityResult = {
  tenureAdjustmentNote: string | null;
  // Populated only when o1.verdict is "don't borrow" - names the specific
  // blocker and what would clear it, so a rejection is never a dead end.
  // Generated here (not hardcoded in the component) per the reason-string-
  // in-the-engine pattern used for every other O2/O3 number.
  actionableNextStep: string | null;
  o1: {
    verdict: Verdict;
    reason: string;
  };
  o2: {
    lenderLikely: number;
    lenderLikelyReason: string;
    safeToCarry: number;
    safeToCarryReason: string;
    routedToSecuredProduct: boolean;
    securedProductNote: string | null;
    ceilingsMatchNote: string | null;
  };
  o3: {
    rateBandLow: number;
    rateBandHigh: number;
    aprBandLow: number;
    aprBandHigh: number;
    confidence: Confidence;
    rateReason: string;
    confidenceReason: string;
  };
  o4: {
    emiCeiling: number;
    stressCaseEmiCeiling: number;
    stressCaseNote: string;
    tenureOptions: { months: number; emi: number }[];
  };
};

// Indian digit grouping (₹19,30,127, not ₹1930127) for every rupee figure
// that appears inside a reason string. The Negotiation Card already formats
// its headline numbers this way, so without this the card reads as two
// different systems: a grouped ₹19,30,127 headline sitting directly above an
// ungrouped "₹110000" in the sentence explaining it.
function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

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

type RateBandTable = typeof rules.personalLoanRateBands;

// Shared lookup against any of the loan-type-specific rate tables below.
function lookupRateBand(
  table: RateBandTable,
  creditScore: number | null
): { low: number; high: number; confidence: Confidence } {
  if (creditScore === null) {
    // Unknown is never zero - widest band, flagged low confidence. §3
    return {
      low: table.unknown.lowPercent,
      high: table.unknown.highPercent,
      confidence: table.unknown.confidence as Confidence,
    };
  }
  const tier = table.tiers.find(
    (t) =>
      creditScore >= t.minScore &&
      (t.maxScore === null || creditScore <= t.maxScore)
  );
  const matched = tier ?? table.tiers[table.tiers.length - 1];
  return {
    low: matched.lowPercent,
    high: matched.highPercent,
    confidence: matched.confidence as Confidence,
  };
}

// Rate bands are loan-type-specific - unsecured personal, unsecured business,
// LAP (secured), and two-wheeler each carry a materially different market
// rate, so each gets its own tiers-by-credit-score table from rules.json
// rather than sharing one table.
function getRateBand(
  creditScore: number | null,
  loanType: LoanType
): { low: number; high: number; confidence: Confidence } {
  const table =
    loanType === LoanType.Business
      ? rules.businessLoanRateBands
      : loanType === LoanType.TwoWheeler
        ? rules.twoWheelerRateBands
        : rules.personalLoanRateBands;
  return lookupRateBand(table, creditScore);
}

// One-level confidence downgrade (High->Medium, Medium->Low, Low stays Low).
// Used for the self-employed new-business modifier - confidence-label only,
// never touches any EMI/amount figure.
function downgradeConfidence(confidence: Confidence): Confidence {
  if (confidence === Confidence.High) return Confidence.Medium;
  if (confidence === Confidence.Medium) return Confidence.Low;
  return Confidence.Low;
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

// Real rate band + APR for O3 on a "don't borrow" path - shown for
// reference only, clearly labelled as not-a-recommendation, but NEVER a
// 0%-0% placeholder. Ignores collateral routing (no loan is being sized),
// so it's the borrower's plain unsecured rate for their loan type.
function indicativeRateAndApr(
  formData: LoanFormValues,
  creditScore: number | null,
  amountWanted: number,
  tenureMonths: number
) {
  const band = getRateBand(creditScore, formData.loanType as LoanType);
  const aprLow = calculateApr(
    amountWanted,
    band.low,
    tenureMonths,
    rules.processingFee.lowPercent
  );
  const aprHigh = calculateApr(
    amountWanted,
    band.high,
    tenureMonths,
    rules.processingFee.highPercent
  );
  return {
    rateBandLow: band.low,
    rateBandHigh: band.high,
    aprBandLow: Math.round(aprLow * 100) / 100,
    aprBandHigh: Math.round(aprHigh * 100) / 100,
    confidence: band.confidence,
    rateReason: `Shown for reference only, not a recommendation - no new loan is advised right now. This is the typical rate band for a ${LOAN_TYPE_LABELS[formData.loanType as LoanType].toLowerCase()} at your credit profile.`,
    confidenceReason: "Not applicable — no new loan is recommended.",
  };
}

export function engine(formData: LoanFormValues): EligibilityResult | null {

  const isSelfEmployed = formData.incomeType === IncomeType.SelfEmployed;
  const isInformal = formData.incomeType === IncomeType.Informal;
  const usesIncomeStabilityRange = isSelfEmployed || isInformal;

  const age = Number(formData.age);
  const amountWanted = Number(formData.amountWanted);
  let tenureMonths = Number(formData.tenurePreferred);
  let tenureAdjustmentNote: string | null = null;

  // Hoisted early - needed both for the indicative (not-a-recommendation)
  // rate band shown on every "don't borrow" path below, and for the real
  // rate-band lookup further down.
  const creditScore = formData.creditScore ? Number(formData.creditScore) : null;
  const loanTypeLabel = LOAN_TYPE_LABELS[formData.loanType as LoanType];

  const retirementAge = usesIncomeStabilityRange
    ? rules.retirementAge.selfEmployed
    : rules.retirementAge.salaried;

  const incomeStabilityLow = Number(formData.incomeStabilityLow);
  const incomeStabilityHigh = Number(formData.incomeStabilityHigh);
  const incomeStabilityAvg = (incomeStabilityLow + incomeStabilityHigh) / 2;

  const monthlyIncomeForMath = usesIncomeStabilityRange
    ? incomeStabilityLow
    : Number(formData.netMonthlyIncome);

  const lenderFacingIncome = usesIncomeStabilityRange
    ? incomeStabilityAvg
    : Number(formData.netMonthlyIncome);

  // 1. Deduct household expenses from take-home income.
  let freeMoney = monthlyIncomeForMath - Number(formData.monthlyExpenses);

  // 2. Deduct existing EMIs, if any. Track the total separately too, it's
  // needed again below for the FOIR check, which cares about total debt
  // obligations vs. income, not leftover cash after expenses.
  //
  // existingEmisTotal is the UNWEIGHTED sum of every existing EMI's monthly
  // amount - used for existingObligations/freeMoney below, because the
  // borrower really does pay the full EMI today regardless of the new
  // loan's tenure. A separate WEIGHTED total (foirExistingObligations,
  // computed further down once the final tenure is known - see §4b) is
  // used only for the FOIR headroom check, since an EMI ending partway
  // through the new loan doesn't tie up the same average headroom as one
  // running its full length.
  let existingEmisTotal = 0;
  for (const emi of formData.existingEmis) {
    existingEmisTotal += Number(emi.amount);
  }
  let existingObligations = existingEmisTotal;

  // High-cost debt is treated as an existing obligation. Estimated as a
  // real repaying EMI (not an interest-only figure) over an assumed short
  // tenure, since these loans typically amortize fast rather than running
  // indefinitely - an interest-only estimate meaningfully understates the
  // true monthly burden.
  let highCostDebtAmount = 0;
  let highCostDebtRate = 0;
  let highCostDebtMonthlyCost = 0;
  if (formData.hasHighCostDebt === "yes") {
    highCostDebtAmount = Number(formData.highCostDebtAmount);
    highCostDebtRate = Number(formData.highCostDebtInterestRate);
    highCostDebtMonthlyCost = calculateEmi(
      highCostDebtAmount,
      highCostDebtRate,
      rules.highCostDebtRepayment.assumedTenureMonths
    );
    existingObligations += highCostDebtMonthlyCost;
  }

  const hasCollateral = formData.hasCollateral === "yes";
  const collateralValue = hasCollateral ? Number(formData.collateralValue) : 0;
  const collateralAlreadyPledged =
    formData.collateralAlreadyPledged === "yes";
  const collateralOutstanding = collateralAlreadyPledged
    ? Number(formData.collateralOutstandingAmount)
    : 0;
  const usableCollateralValue = Math.max(
    0,
    collateralValue - collateralOutstanding
  );

  // KNOWN LIMITATION: if the borrower already listed this same loan under
  // "existing EMIs" above, it gets counted twice here - there's no reliable
  // way to de-duplicate a free-text EMI entry against this collateral answer
  // in the engine. The UI now warns against this (see the "Existing EMIs"
  // section in LoanEligibilityForm.tsx), but a determined user can still
  // double-enter it, so the engine-side risk remains.
  if (collateralAlreadyPledged && collateralOutstanding > 0) {
    const collateralLoanRate = Number(formData.collateralInterestRate);
    const collateralRemainingTenureMonths = Number(
      formData.collateralRemainingTenureMonths
    );
    const estimatedCollateralLoanEmi = calculateEmi(
      collateralOutstanding,
      collateralLoanRate,
      collateralRemainingTenureMonths
    );
    existingObligations += estimatedCollateralLoanEmi;
  }

  freeMoney -= existingObligations;

  if (freeMoney <= 0) {
    return {
      tenureAdjustmentNote: null,
      actionableNextStep:
        "Reduce your existing EMIs or expenses (or both) until they leave some free cash before applying again - right now they fully absorb your income, so no lender math can help.",
      o1: {
        verdict: Verdict.DontBorrow,
        reason:
          "Existing expenses and EMIs already use up all your take-home income - there's no free cash to safely add a new EMI.",
      },
      o2: {
        lenderLikely: 0,
        lenderLikelyReason: "No obligations were computed since expenses and existing EMIs already exceed your income.",
        safeToCarry: 0,
        safeToCarryReason: "Your existing expenses and EMIs already use up all your take-home income, leaving no safe room for a new one.",
        routedToSecuredProduct: false,
        securedProductNote: null,
        ceilingsMatchNote: null,
      },
      o3: indicativeRateAndApr(formData, creditScore, amountWanted, tenureMonths),
      o4: {
        emiCeiling: 0,
        stressCaseEmiCeiling: 0,
        stressCaseNote: "No free cash even before a rate rise or income drop.",
        tenureOptions: [],
      },
    };
  }

  // 3. Age + tenure sanity check - the loan must finish before the borrower's
  // assumed retirement age, regardless of how affordable the math says it is.
  const requestedTenureYears = tenureMonths / 12;
  const ageAtLoanEnd = age + requestedTenureYears;

  if (ageAtLoanEnd > retirementAge) {
    const maxTenureMonths = Math.max(0, Math.floor((retirementAge - age) * 12));

    if (maxTenureMonths <= 0) {
      return {
        tenureAdjustmentNote: null,
        actionableNextStep: `A lender with a higher retirement-age cutoff than the assumed ${retirementAge}, or a younger co-applicant to carry the loan instead, are the only things that would change this - your own tenure math has no room left.`,
        o1: {
          verdict: Verdict.DontBorrow,
          reason: `At age ${age}, you're already at or past the assumed retirement age of ${retirementAge} lenders use for ${
            usesIncomeStabilityRange ? "self-employed/informal" : "salaried"
          } borrowers - there's no valid tenure left to offer a loan against.`,
        },
        o2: {
          lenderLikely: 0,
          lenderLikelyReason: "No amount is offered since no valid tenure remains before retirement age.",
          safeToCarry: 0,
          safeToCarryReason: "No amount is safe to carry since no valid tenure remains before retirement age.",
          routedToSecuredProduct: false,
          securedProductNote: null,
          ceilingsMatchNote: null,
        },
        o3: indicativeRateAndApr(formData, creditScore, amountWanted, tenureMonths),
        o4: {
          emiCeiling: 0,
          stressCaseEmiCeiling: 0,
          stressCaseNote: "No valid tenure remains before retirement age.",
          tenureOptions: [],
        },
      };
    }

    tenureAdjustmentNote = `Your requested tenure (${tenureMonths} months) would end at age ${Math.round(
      ageAtLoanEnd
    )}, past the assumed retirement age of ${retirementAge}. Tenure capped to ${maxTenureMonths} months for this calculation.`;
    tenureMonths = maxTenureMonths;
  }

  // 4. Bounce + high-cost-debt pattern check - a single weak signal (just a
  // bounce, or just high-cost debt) should NOT override the math on its own.
  // Only the combination - a recent bounce alongside existing high-cost debt -
  // is real-world evidence that the math's "should be fine" doesn't hold (§3).
  const worstRecency = worstBounceRecency(formData.emiBounces);
  const hasRecentBounce =
    formData.hadEmiBounces === "yes" &&
    worstRecency !== null &&
    RECENT_BOUNCE_RECENCIES.includes(worstRecency);
  const hasHighCostDebt = formData.hasHighCostDebt === "yes";

  // 4a. Graded bounce ladder - aggregates the three signals collected but
  // never previously read (per-row frequency, and how many different loans
  // were affected) into a severity tier. Only reached when the override
  // above does NOT already fire; the override stays the hard stop for the
  // worst combination (recent bounce + high-cost debt).
  const totalBounces = formData.emiBounces.reduce(
    (sum, bounce) => sum + (Number(bounce.frequency) || 0),
    0
  );
  const loansAffected = formData.emiBounces.length;
  const isSevereBouncePattern =
    totalBounces >= rules.bounceLadder.multipleRecentOrSpread.minTotalBounces ||
    loansAffected >= rules.bounceLadder.multipleRecentOrSpread.minLoansAffected;
  const bounceTier: BounceTier = !hasRecentBounce
    ? BounceTier.None
    : isSevereBouncePattern
      ? BounceTier.Severe
      : BounceTier.Single;

  // Within the severe tier, bounces spread across several loans are worse
  // than the same count repeated on one loan - each loan affected beyond
  // the first adds an extra widen/haircut on top of the tier's base values,
  // so "spread" and "repeated" both cross into severe but aren't priced the
  // same once there.
  const extraLoansAffected =
    bounceTier === BounceTier.Severe ? Math.max(0, loansAffected - 1) : 0;

  if (hasRecentBounce && hasHighCostDebt) {
    return {
      tenureAdjustmentNote,
      actionableNextStep: `Your ${formatRupees(
        highCostDebtAmount
      )} high-cost debt at ${highCostDebtRate}% p.a. is costing you roughly ${formatRupees(
        highCostDebtMonthlyCost
      )}/month. Clearing or refinancing it, and going ${rules.bounceOverride.recentWindowMonths}+ months without a new bounce, would lift this override on its own.`,
      o1: {
        verdict: Verdict.DontBorrow,
        reason:
          "You have a recently bounced EMI together with existing high-cost debt - this combination is real-world evidence of financial strain that overrides the affordability math, regardless of how comfortable the numbers look on paper.",
      },
      o2: {
        lenderLikely: 0,
        lenderLikelyReason: "No amount is offered since a recent EMI bounce combined with existing high-cost debt overrides the affordability math.",
        safeToCarry: 0,
        safeToCarryReason: "No amount is safe to carry since a recent EMI bounce combined with existing high-cost debt overrides the affordability math.",
        routedToSecuredProduct: false,
        securedProductNote: null,
        ceilingsMatchNote: null,
      },
      o3: indicativeRateAndApr(formData, creditScore, amountWanted, tenureMonths),
      o4: {
        emiCeiling: 0,
        stressCaseEmiCeiling: 0,
        stressCaseNote:
          "Recent bounce + high-cost debt pattern detected - resolve these before taking on new debt.",
        tenureOptions: [],
      },
    };
  }

  // 4b. Weight each existing EMI by how much of the NEW loan's tenure it
  // overlaps (weight = min(monthsRemaining, tenureMonths) / tenureMonths),
  // for the FOIR headroom check ONLY. An existing EMI that ends partway
  // through the new loan doesn't tie up the same average FOIR headroom as
  // one running the new loan's full length. Deliberately computed here,
  // AFTER tenureMonths may have been capped for retirement age above, so
  // the weight reflects the loan actually being sized. High-cost debt and
  // an already-pledged collateral loan have no monthsRemaining collected,
  // so they're carried into the weighted total unweighted (at full value).
  const highCostAndCollateralObligations = existingObligations - existingEmisTotal;
  let weightedExistingEmis = existingEmisTotal;
  if (rules.monthsRemainingWeighting.enabled) {
    weightedExistingEmis = 0;
    for (const emi of formData.existingEmis) {
      const amount = Number(emi.amount);
      const monthsRemaining = Number(emi.monthsRemaining);
      const weight = Math.min(monthsRemaining, tenureMonths) / tenureMonths;
      weightedExistingEmis += amount * weight;
    }
  }
  const foirExistingObligations =
    weightedExistingEmis + highCostAndCollateralObligations;

  // 5. FOIR check - a standard lender rule: total EMI obligations (existing +
  // new) must not exceed a fixed share of monthly income, regardless of what's
  // left over after expenses. This is independent of the freeMoney check above
  // and can be the stricter of the two.
  //
  // The monthsRemaining weighting from §4b applies to the LENDER-facing
  // ceiling only, never the borrower-safe one. Averaging an obligation down
  // because it ends partway through the new loan is lender logic - a bank
  // assesses the obligation's average burden across the loan's life. A
  // borrower pays the EMI in FULL every month until it actually ends;
  // discounting it would make the "safe" number less safe, which is
  // backwards for a tool whose whole point is the borrower's real safety
  // margin. So lenderFoirMaxNewEmi uses the weighted total, while
  // safeFoirMaxNewEmi (which borrowerSafeEmiCeiling is capped by, same as
  // freeMoney) uses the plain unweighted existingObligations.
  const foirMaxTotalEmi = lenderFacingIncome * (rules.foir.capPercent / 100);
  const lenderFoirMaxNewEmi = Math.max(
    0,
    foirMaxTotalEmi - foirExistingObligations
  );
  const safeFoirMaxNewEmi = Math.max(
    0,
    foirMaxTotalEmi - existingObligations
  );

  const lenderLikelyEmiCeiling = lenderFoirMaxNewEmi;
  const bounceHaircutPercent =
    bounceTier === BounceTier.Severe
      ? rules.bounceLadder.multipleRecentOrSpread.safeAmountHaircutPercent +
        extraLoansAffected *
          rules.bounceLadder.multipleRecentOrSpread
            .extraPerLoanAffectedHaircutPercent
      : 0;
  const borrowerSafeEmiCeiling =
    Math.min(freeMoney, safeFoirMaxNewEmi) * (1 - bounceHaircutPercent / 100);
  const recommendedEmiCeiling = borrowerSafeEmiCeiling;

  // 6. Collateral-based lender path - routes to a secured product (LAP)
  // only when usable (unencumbered) collateral alone can cover the
  // requested amount; partially-used collateral that falls short doesn't
  // trigger a secured recommendation just because *some* collateral exists.
  // Resolved BEFORE any rate-dependent math below, so that every figure
  // that follows - neededEmi, both O2 amounts, and O4's tenure table - is
  // priced consistently with whichever rate band the borrower actually
  // gets routed to, matching what O3 displays as their "fair rate".
  const collateralBasedLenderAmount =
    usableCollateralValue * (rules.collateral.ltvPercent / 100);
  const routedToSecuredProduct =
    hasCollateral && collateralBasedLenderAmount >= amountWanted;

  // 7. Calculate the EMI needed for the requested amount, using whichever
  // point on the rate band rules.neededEmiRateStrategy.strategy selects.
  // A borrower routed to a secured product gets LAP pricing regardless of
  // which loan type they originally applied under - the loan-type table
  // only prices the unsecured line of the application.
  const rateBand = getRateBand(creditScore, formData.loanType as LoanType);
  const baseEffectiveRateBand = routedToSecuredProduct
    ? lookupRateBand(rules.lapRateBands, creditScore)
    : rateBand;

  // 7a. Bounce ladder widens the top of the quoted rate band - a lender
  // pulling the bureau report will price a recent bounce in, so the fair
  // band shown should already reflect that rather than pretend it's not
  // there. Severity-graded: a severe (repeated/spread) pattern widens
  // further than a single isolated recent bounce. Applied AFTER the
  // secured-vs-unsecured routing decision above, so it widens whichever
  // band the borrower actually gets priced against.
  const bounceRateWidenPoints =
    bounceTier === BounceTier.Single
      ? rules.bounceLadder.singleRecentBounce.rateBandWidenHighPercentagePoints
      : bounceTier === BounceTier.Severe
        ? rules.bounceLadder.multipleRecentOrSpread
            .rateBandWidenHighPercentagePoints +
          extraLoansAffected *
            rules.bounceLadder.multipleRecentOrSpread
              .extraPerLoanAffectedRateBandWidenPoints
        : 0;
  const effectiveRateBand = {
    ...baseEffectiveRateBand,
    high: baseEffectiveRateBand.high + bounceRateWidenPoints,
  };
  const assumedRate =
    rules.neededEmiRateStrategy.strategy === "midpoint"
      ? (effectiveRateBand.low + effectiveRateBand.high) / 2
      : rules.neededEmiRateStrategy.strategy === "high"
        ? effectiveRateBand.high
        : effectiveRateBand.low;

  const neededEmi = calculateEmi(amountWanted, assumedRate, tenureMonths);

  // 7b. New-business/new-to-this-work confidence modifier (self-employed and
  // informal alike) - yearsInBusiness never touches
  // freeMoney/foirMaxNewEmi/borrowerSafeEmiCeiling or any EMI/amount figure,
  // only the reported confidence label. Stacks with the bounce-ladder
  // downgrade below if both apply.
  const isNewBusiness =
    usesIncomeStabilityRange &&
    Number(formData.yearsInBusiness) <
      rules.selfEmployedConfidence.newBusinessThresholdYears;
  let reportedConfidence = isNewBusiness
    ? downgradeConfidence(baseEffectiveRateBand.confidence)
    : baseEffectiveRateBand.confidence;
  if (bounceTier !== BounceTier.None) {
    reportedConfidence = downgradeConfidence(reportedConfidence);
  }

  // 8. Verdict
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
    reason = `Your requested EMI of ~${formatRupees(neededEmi)} fits within your safe ceiling of ~${formatRupees(borrowerSafeEmiCeiling)}.`;
  } else {
    verdict = Verdict.BorrowLess;
    reason = `Your requested amount needs an EMI of ~${formatRupees(neededEmi)}, above your safe ceiling of ~${formatRupees(borrowerSafeEmiCeiling)}. Consider a smaller amount or a longer tenure.`;
  }

  // 8b. Actionable next step - only populated on a "don't borrow" verdict,
  // so a rejection here is never a dead end (the bounce+high-cost-debt
  // override above sets its own, more specific version and returns early).
  let actionableNextStep: string | null = null;
  if (verdict === Verdict.DontBorrow) {
    actionableNextStep =
      borrowerSafeEmiCeiling <= 0 && lenderLikelyEmiCeiling <= 0
        ? "Reduce your existing EMIs and expenses, or increase your income, until there's both free cash and FOIR headroom left - then re-check."
        : lenderLikelyEmiCeiling <= 0
          ? "Pay down existing EMI obligations to free up FOIR headroom - a lender won't consider a new loan until some room opens up there."
          : "A lender may approve this on paper, but trim your expenses or existing EMIs first so you have real safety margin before actually taking it.";
  }

  // 9. O2 - convert both EMI ceilings into loan amounts, at the same
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

  // 9b. This only ever raises the LENDER-facing ceiling - safeToCarryAmount
  // above is already finalized and stays purely income-driven (§1). (The
  // routing decision itself, and the rate band it implies, were resolved
  // back at step 6, before assumedRate/neededEmi/these two amounts were
  // computed, so everything here is already priced consistently.)
  const finalLenderLikelyAmount = routedToSecuredProduct
    ? Math.max(lenderLikelyAmount, collateralBasedLenderAmount)
    : lenderLikelyAmount;

  const securedProductNote = routedToSecuredProduct
    ? `Because you have unencumbered collateral worth ~${formatRupees(
        usableCollateralValue
      )} available, you likely qualify for a secured loan (Loan Against Property) instead of an unsecured loan - this typically means a lower rate and a higher approval amount than going unsecured. Your safe-to-carry figure is unaffected by this - it stays based on your real income, since a lower rate doesn't change what you can actually afford to repay. Borrowing up to the higher lender-likely figure risks the pledged asset if you can't keep up - treat any gap between the two numbers as a warning, not a bonus.`
    : null;

  // lenderLikely and safeToCarry can legitimately land on the same number.
  // Since §5 split the FOIR headroom in two (lender side weighted by
  // monthsRemaining, safe side using the full unweighted obligation), a
  // match no longer always means "the same FOIR ceiling drove both" - it
  // can also be a genuine coincidence where the two different totals
  // happen to produce the same figure. Say whichever is actually true
  // rather than always claiming "not a coincidence."
  const noWeightingEffectOnMatch =
    Math.round(foirExistingObligations) === Math.round(existingObligations);
  const ceilingsMatchNote =
    !routedToSecuredProduct &&
    Math.round(finalLenderLikelyAmount) === Math.round(safeToCarryAmount)
      ? noWeightingEffectOnMatch
        ? "These two figures match here because the lender's own FOIR limit is tighter than your personal budget - the FOIR cap is doing the limiting in both cases, not a coincidence."
        : "These two figures match here even though they're built from different obligation totals - the lender ceiling uses your obligations weighted by how much of this loan's tenure they'll still run, while your safe ceiling uses the full amount. For your numbers, both paths land on the same figure anyway."
      : null;

  // 10. O3 all-in APR band - fold the processing fee (+ GST) into the rate
  // band's low and high ends, using the low/high fee assumption respectively.
  const aprBandLow = calculateApr(
    amountWanted,
    effectiveRateBand.low,
    tenureMonths,
    rules.processingFee.lowPercent
  );
  const aprBandHigh = calculateApr(
    amountWanted,
    effectiveRateBand.high,
    tenureMonths,
    rules.processingFee.highPercent
  );

  // 11. O4 stress case - income drops by a fixed percentage; rate rise is
  // the other named brief dimension but income drop is the primary case
  // here since it applies across income types, not just floating-rate loans.
  const stressIncomeDropPercent = rules.stressCase.incomeDropPercent / 100;
  const stressedIncome = monthlyIncomeForMath * (1 - stressIncomeDropPercent);
  const stressedFreeMoney =
    stressedIncome - Number(formData.monthlyExpenses) - existingObligations;
  const stressCaseEmiCeiling = Math.max(
    0,
    Math.min(stressedFreeMoney, safeFoirMaxNewEmi)
  );
  // The stress case can only ever match or fall below the normal ceiling
  // (income is multiplied down, nothing else changes) - but when the FOIR
  // cap was already the binding constraint on the normal ceiling, an income
  // drop doesn't move the number at all, since the FOIR cap doesn't move
  // with income the way freeMoney does. Say so plainly instead of claiming
  // a "fall" that didn't happen.
  const stressCaseNote =
    Math.round(stressCaseEmiCeiling) === Math.round(recommendedEmiCeiling)
      ? `Even if your income dropped by ${rules.stressCase.incomeDropPercent}%, your safe EMI ceiling would stay at ~${formatRupees(
          stressCaseEmiCeiling
        )} - you're protected here by the lender's own FOIR limit, not just your budget.`
      : `If your income dropped by ${rules.stressCase.incomeDropPercent
        }%, your safe EMI ceiling would fall to ~${formatRupees(
          stressCaseEmiCeiling
        )} - plan for this before committing to the top of your range.`;

  // 12. Explainability - every O2/O3 number gets its own one-sentence
  // traceability string, generated here (not in the UI) so reasoning stays
  // alongside the math it explains rather than scattered into components.
  const bounceHaircutNote =
    bounceTier === BounceTier.Severe
      ? ` This also applies a ${bounceHaircutPercent}% haircut for your ${totalBounces} recent bounces ${loansAffected > 1 ? `spread across ${loansAffected} loans` : "on one loan"} - a lender pulling your bureau report is likely to price that in as elevated risk.`
      : "";
  const safeToCarryReason =
    (usesIncomeStabilityRange
      ? `Based on your lowest-earning month (~${formatRupees(
          monthlyIncomeForMath
        )}), minus your monthly expenses (${formatRupees(
          Number(formData.monthlyExpenses)
        )}) and existing obligations (~${formatRupees(
          existingObligations
        )}) — using your worst month, not your average, keeps this figure safe.`
      : `Based on your net monthly income (${formatRupees(
          Number(formData.netMonthlyIncome)
        )}), minus your monthly expenses (${formatRupees(
          Number(formData.monthlyExpenses)
        )}) and existing obligations (~${formatRupees(
          existingObligations
        )}).`) + bounceHaircutNote;

  // finalLenderLikelyAmount takes the max of the income-based (FOIR) and
  // collateral-based paths whenever routed to a secured product - the
  // reason string has to say which one actually won, not always describe
  // the income path regardless of which number is being shown.
  const collateralPathWon =
    routedToSecuredProduct && collateralBasedLenderAmount >= lenderLikelyAmount;
  const lenderLikelyReason = collateralPathWon
    ? `Based on your unencumbered collateral (~${formatRupees(
        usableCollateralValue
      )}) at a typical ${rules.collateral.ltvPercent}% loan-to-value, rather than your income alone - this is higher than what your income-based FOIR limit (~${formatRupees(
        lenderLikelyAmount
      )}) would support on its own.`
    : `Based on a lender's ${rules.foir.capPercent}% FOIR cap applied to your ${
        usesIncomeStabilityRange ? "average" : "net"
      } monthly income (~${formatRupees(
        lenderFacingIncome
      )}), minus your existing obligations (~${formatRupees(foirExistingObligations)}${
        rules.monthsRemainingWeighting.enabled &&
        Math.round(foirExistingObligations) !== Math.round(existingObligations)
          ? ", weighted down for EMIs that will finish before this loan's tenure ends"
          : ""
      }).`;

  const bounceRateReasonNote =
    bounceTier === BounceTier.Single
      ? ` A recent EMI bounce widens this band by ${bounceRateWidenPoints} points at the top - a lender's bureau check would price it in.`
      : bounceTier === BounceTier.Severe
        ? ` ${totalBounces} recent bounces ${loansAffected > 1 ? `spread across ${loansAffected} loans` : "on one loan"} widen this band by ${bounceRateWidenPoints} points at the top - a lender's bureau check would price this pattern in heavily.`
        : "";
  const rateReason =
    (routedToSecuredProduct
      ? `Because your unencumbered collateral covers the amount you want, this is priced as a secured Loan Against Property${
          creditScore !== null ? ` for a credit score of ${creditScore}` : ""
        } instead of an unsecured ${loanTypeLabel.toLowerCase()}.`
      : creditScore !== null
        ? `Based on your credit score of ${creditScore} and applying for a ${loanTypeLabel.toLowerCase()}.`
        : `Your credit score wasn't provided, so the widest rate band for a ${loanTypeLabel.toLowerCase()} is used.`) +
    bounceRateReasonNote;

  const confidenceReasonParts: string[] = [];
  if (creditScore === null) {
    confidenceReasonParts.push("your credit score wasn't provided");
  }
  if (isNewBusiness) {
    confidenceReasonParts.push(
      "you've been earning this way for less than 2 years, which adds income-continuity uncertainty"
    );
  }
  if (bounceTier !== BounceTier.None) {
    confidenceReasonParts.push(
      "you have a recent EMI bounce, which a lender's bureau check would find"
    );
  }
  const confidenceReason =
    confidenceReasonParts.length > 0
      ? `Lower confidence because ${confidenceReasonParts.join(" and ")}.`
      : "Based on your credit score and reported financial profile.";

  return {
    tenureAdjustmentNote,
    actionableNextStep,
    o1: { verdict, reason },
    o2: {
      lenderLikely: Math.round(finalLenderLikelyAmount),
      lenderLikelyReason,
      safeToCarry: Math.round(safeToCarryAmount),
      safeToCarryReason,
      ceilingsMatchNote,
      routedToSecuredProduct,
      securedProductNote,
    },
    o3: {
      rateBandLow: effectiveRateBand.low,
      rateBandHigh: effectiveRateBand.high,
      aprBandLow: Math.round(aprBandLow * 100) / 100,
      aprBandHigh: Math.round(aprBandHigh * 100) / 100,
      confidence: reportedConfidence,
      rateReason,
      confidenceReason,
    },
    o4: {
      emiCeiling: Math.round(recommendedEmiCeiling),
      stressCaseEmiCeiling: Math.round(stressCaseEmiCeiling),
      stressCaseNote,
      tenureOptions: [
        { months: tenureMonths, emi: Math.round(neededEmi) },
        { months: tenureMonths + 12, emi: Math.round(calculateEmi(amountWanted, assumedRate, tenureMonths + 12)) },
        { months: Math.max(12, tenureMonths - 12), emi: Math.round(calculateEmi(amountWanted, assumedRate, Math.max(12, tenureMonths - 12))) },
      ],
    },
  };
}

