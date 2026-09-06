// Manual scenario tests for engine() - no test framework, just plain
// assertions run via `npx tsx src/lib/scenarios.test.ts`.
//
// Each scenario builds a full LoanFormValues object from a persona
// description, runs it through engine(), and checks a few sanity
// expectations. Print the full result too, so it can be eyeballed against
// the persona's own numbers.

import { engine } from "./engine";
import { priya, ravi, anita } from "./personas";
import {
  EmiBounceRecency,
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
// Priya, 29 - Bengaluru, salaried - see src/lib/personas.ts for the full
// persona description and the assumptions behind her input values.
{
  const result = runScenario("Priya (29, salaried, personal loan for wedding)", priya);

  assert(result !== null, "engine() returns a result, not null");

  if (result) {
    // Free cash: 110000 - 28000 (expenses) - 14000 (existing EMI) = 68000/month.
    // The SAFE ceiling (o4.emiCeiling) uses the FULL unweighted existing
    // obligation, since the borrower pays it in full every month regardless
    // of the new loan's tenure: FOIR ceiling 50% of 110000 = 55000, minus
    // the full 14000 = 41000/month - still the binding constraint (lender
    // FOIR cap < borrower free cash), so the safe ceiling should equal
    // this unweighted FOIR-derived number.
    //
    // NOTE: an intermediate version of this weighting incorrectly applied
    // the monthsRemaining discount to the SAFE ceiling too (briefly raising
    // it to ~49,400) - that was itself a bug (averaging an obligation down
    // is lender logic, not something that makes a borrower's real monthly
    // payment any smaller) and has been corrected. The weighting now only
    // ever touches lenderLikely (see the assertion below and the
    // monthsRemaining probe further down).
    assert(
      result.o4.emiCeiling <= 41000 + 1,
      `EMI ceiling (${result.o4.emiCeiling}) respects the unweighted 50% FOIR cap (~41,000/month)`
    );

    // Her car EMI (14000) has 24 months left against this 60-month new
    // loan, so it's weighted by 24/60 = 0.4 for the LENDER-facing FOIR
    // check only: 14000 * 0.4 = 5600, giving a lender ceiling of
    // 55000 - 5600 = 49400/month -> a materially larger loan amount than
    // the safe ceiling converts to. The two O2 figures must now genuinely
    // differ for her, rather than coincidentally matching.
    assert(
      result.o2.lenderLikely > result.o2.safeToCarry,
      `lenderLikely (${result.o2.lenderLikely}), built on the monthsRemaining-weighted obligation, is strictly higher than safeToCarry (${result.o2.safeToCarry}), built on the full unweighted obligation`
    );
    assert(
      result.o2.ceilingsMatchNote === null,
      "ceilingsMatchNote is null now that lenderLikely and safeToCarry genuinely differ for her"
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
// Ravi, 42 - Mysuru, self-employed - see src/lib/personas.ts for the full
// persona description and the assumptions behind his input values.
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
// Anita, 35 - Hubballi, informal - see src/lib/personas.ts for the full
// persona description and the assumptions behind her input values.
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

    // The override short-circuits before any amount/rate math runs - O2/O4
    // (loan amounts and EMI ceiling) come back zeroed, since no loan is
    // actually being sized. O3, however, must NOT be zeroed - a 0%-0% rate
    // band is a null-handling artifact, not a real answer, and it broke the
    // negotiation card's quote checker (any real quote looked "above" a
    // fake 0% ceiling). O3 now shows the real indicative two-wheeler rate
    // band for her credit profile, clearly labelled as not-a-recommendation.
    //
    // NOTE: this replaces an earlier assertion that expected rateBandLow/
    // High to be 0. That was the bug being fixed, not a spec to preserve.
    assert(
      result.o2.lenderLikely === 0 && result.o2.safeToCarry === 0,
      "O2 amounts are zeroed out when the override fires"
    );
    assert(
      result.o3.rateBandLow > 0 && result.o3.rateBandHigh > 0,
      `O3 shows a real indicative rate band, never 0%-0%, even when no loan is recommended (got ${result.o3.rateBandLow}%-${result.o3.rateBandHigh}%)`
    );
    assert(
      result.o3.rateReason.toLowerCase().includes("not a recommendation"),
      `O3's rate reason clearly labels the band as not-a-recommendation (got: "${result.o3.rateReason}")`
    );
    assert(
      result.actionableNextStep !== null &&
        result.actionableNextStep.includes("35000") &&
        result.actionableNextStep.toLowerCase().includes("month"),
      `actionableNextStep names the specific high-cost-debt blocker and its monthly cost, so the "don't borrow" isn't a dead end (got: "${result.actionableNextStep}")`
    );
    assert(
      result.o4.emiCeiling === 0 && result.o4.tenureOptions.length === 0,
      "O4 EMI ceiling and tenure options are zeroed/empty when the override fires"
    );
  }
}

// ---------------------------------------------------------------------
// monthsRemaining wiring - an existing EMI ending soon shouldn't tie up
// the same average FOIR headroom as one running the new loan's full
// length. Two variants of Priya's scenario, identical except for her car
// EMI's monthsRemaining: 6 months left vs. the full 60-month tenure of
// the new loan.
{
  const shortRemaining: LoanFormValues = {
    ...priya,
    existingEmis: [{ amount: "14000", monthsRemaining: "6" }],
  };
  const fullRemaining: LoanFormValues = {
    ...priya,
    existingEmis: [{ amount: "14000", monthsRemaining: "60" }],
  };

  const shortResult = runScenario(
    "monthsRemaining probe - car EMI with 6 months left (vs. 60)",
    shortRemaining
  );
  const fullResult = runScenario(
    "monthsRemaining probe - car EMI with the full 60 months left",
    fullRemaining
  );

  if (shortResult && fullResult) {
    // Weight = min(monthsRemaining, 60) / 60. 6 months -> weight 0.1 ->
    // weighted obligation 1400; 60 months -> weight 1.0 -> weighted
    // obligation 14000 (i.e. no discount at all - the unweighted case).
    // A smaller weighted obligation leaves more FOIR headroom - but ONLY
    // on the LENDER side (averaging an obligation down because it ends
    // early is lender logic; the borrower still pays the full EMI every
    // month until it actually ends). So lenderLikely must be strictly
    // higher for the short-remaining EMI...
    //
    // NOTE: this replaces an earlier assertion that expected o4.emiCeiling
    // (the borrower-SAFE ceiling) to move with monthsRemaining. That was
    // itself the bug this scenario now guards against: the weighting had
    // leaked into the safe side too. It's fixed now, so this scenario
    // checks the opposite - the safe ceiling must NOT move.
    assert(
      shortResult.o2.lenderLikely > fullResult.o2.lenderLikely,
      `An EMI ending soon (6mo left) gives a higher LENDER ceiling (${shortResult.o2.lenderLikely}) than one running the full tenure (${fullResult.o2.lenderLikely}) - monthsRemaining moves the lender-facing FOIR headroom`
    );

    // ...but the borrower-SAFE ceiling (o4.emiCeiling, and therefore
    // safeToCarry/safeToCarryReason) must stay identical either way - it's
    // built from the full unweighted obligation, since the borrower really
    // does pay the whole EMI every month regardless of how soon it ends.
    assert(
      shortResult.o4.emiCeiling === fullResult.o4.emiCeiling,
      `The borrower-safe EMI ceiling ignores monthsRemaining entirely (6mo-left: ${shortResult.o4.emiCeiling}, full-tenure: ${fullResult.o4.emiCeiling})`
    );
    assert(
      shortResult.o2.safeToCarryReason === fullResult.o2.safeToCarryReason,
      "safeToCarryReason (built on the UNWEIGHTED total) is identical regardless of monthsRemaining"
    );
  }
}

// ---------------------------------------------------------------------
// Standalone recent bounce (no high-cost debt) - must move the output on
// its own, not just as part of the override. Priya's comfortable-income
// scenario, otherwise untouched, with one recent EMI bounce added.
{
  const withBounce: LoanFormValues = {
    ...priya,
    hadEmiBounces: "yes",
    emiBounces: [{ frequency: "1", recency: EmiBounceRecency.WithinOneMonth }],
  };

  const baseline = runScenario("Bounce probe - baseline (Priya, no bounce)", priya);
  const bounced = runScenario(
    "Bounce probe - single standalone recent bounce, no high-cost debt",
    withBounce
  );

  if (baseline && bounced) {
    assert(
      bounced.o1.verdict !== "dont_borrow",
      `A single standalone bounce (no high-cost debt) does NOT trigger the don't-borrow override (got: ${bounced.o1.verdict})`
    );
    assert(
      bounced.o3.confidence !== baseline.o3.confidence,
      `A standalone recent bounce downgrades confidence on its own (baseline: ${baseline.o3.confidence}, with bounce: ${bounced.o3.confidence})`
    );
    assert(
      bounced.o3.rateBandHigh > baseline.o3.rateBandHigh,
      `A standalone recent bounce widens the top of the rate band on its own (baseline: ${baseline.o3.rateBandHigh}%, with bounce: ${bounced.o3.rateBandHigh}%)`
    );
    assert(
      bounced.o3.confidenceReason.toLowerCase().includes("bounce"),
      `confidenceReason surfaces the bounce effect (got: "${bounced.o3.confidenceReason}")`
    );
  }
}

// ---------------------------------------------------------------------
// Bounces spread across multiple loans vs. the same bounce count repeated
// on one loan - spread-across-loans must be treated as strictly worse,
// since it signals money ran out across the board rather than one
// dispute with one lender. Both scenarios have identical totalBounces
// (2), differing only in loansAffected (1 vs. 2).
{
  const repeatedOnOneLoan: LoanFormValues = {
    ...priya,
    hadEmiBounces: "yes",
    emiBounces: [
      { frequency: "2", recency: EmiBounceRecency.WithinOneMonth },
    ],
  };
  const spreadAcrossTwoLoans: LoanFormValues = {
    ...priya,
    hadEmiBounces: "yes",
    emiBounces: [
      { frequency: "1", recency: EmiBounceRecency.WithinOneMonth },
      { frequency: "1", recency: EmiBounceRecency.WithinOneMonth },
    ],
  };

  const repeated = runScenario(
    "Bounce-spread probe - 2 bounces repeated on 1 loan",
    repeatedOnOneLoan
  );
  const spread = runScenario(
    "Bounce-spread probe - 2 bounces spread across 2 loans",
    spreadAcrossTwoLoans
  );

  if (repeated && spread) {
    assert(
      spread.o3.rateBandHigh > repeated.o3.rateBandHigh,
      `Bounces spread across 2 loans widen the rate band further than the same count repeated on 1 loan (repeated: ${repeated.o3.rateBandHigh}%, spread: ${spread.o3.rateBandHigh}%)`
    );
    assert(
      spread.o4.emiCeiling < repeated.o4.emiCeiling,
      `Bounces spread across 2 loans cut the safe EMI ceiling further than the same count repeated on 1 loan (repeated: ${repeated.o4.emiCeiling}, spread: ${spread.o4.emiCeiling})`
    );
  }
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
if (failures > 0) process.exit(1);
