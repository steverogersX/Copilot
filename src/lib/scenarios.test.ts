// Manual scenario tests for engine() - no test framework, just plain
// assertions run via `npx tsx src/lib/scenarios.test.ts`.
//
// Each scenario builds a full LoanFormValues object from a persona
// description, runs it through engine(), and checks a few sanity
// expectations. Print the full result too, so it can be eyeballed against
// the persona's own numbers.

import { engine } from "./engine";
import { priya, ravi, anita } from "./personas";
import { type LoanFormValues } from "@/types/loan-eligibility-form";

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
