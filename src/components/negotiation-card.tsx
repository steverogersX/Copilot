"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Confidence, Verdict, type EligibilityResult } from "@/lib/engine";
import { blockNonDecimalKeys, onlyDecimalDigits } from "@/lib/loan-form-fields";

const VERDICT_LABELS: Record<Verdict, string> = {
  [Verdict.Borrow]: "Borrow",
  [Verdict.BorrowLess]: "Borrow less",
  [Verdict.DontBorrow]: "Don't borrow",
};

const VERDICT_STYLES: Record<Verdict, string> = {
  [Verdict.Borrow]: "text-emerald-600 dark:text-emerald-400",
  [Verdict.BorrowLess]: "text-amber-600 dark:text-amber-400",
  [Verdict.DontBorrow]: "text-destructive",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  [Confidence.High]: "High — this profile matches well-documented lender data",
  [Confidence.Medium]: "Medium — reasonably reliable, some estimation involved",
  [Confidence.Low]: "Low — based on limited information",
};

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function TenureQuoteCheck({ result }: { result: EligibilityResult }) {
  const [quotedRate, setQuotedRate] = useState("");
  const parsedRate = quotedRate === "" ? null : Number(quotedRate);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <Label htmlFor="quoted-rate" className="text-xs">
        Lender quoted me (% p.a., all-in / APR):
      </Label>
      <Input
        id="quoted-rate"
        type="number"
        min={0}
        max={100}
        step={0.01}
        inputMode="decimal"
        placeholder="e.g. 14"
        value={quotedRate}
        onKeyDown={blockNonDecimalKeys}
        onChange={(e) => setQuotedRate(onlyDecimalDigits(e.target.value))}
        className="max-w-[160px]"
      />
      {parsedRate !== null && !Number.isNaN(parsedRate) && (
        <p className="text-xs font-medium">
          {parsedRate > result.o3.aprBandHigh ? (
            <span className="text-destructive">
              That&apos;s above what&apos;s fair for your profile ({result.o3.rateBandLow}%–
              {result.o3.rateBandHigh}%, or up to {result.o3.aprBandHigh}% all-in) — ask why.
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400">
              That&apos;s within the fair range for your profile ({result.o3.rateBandLow}%–
              {result.o3.rateBandHigh}%, up to {result.o3.aprBandHigh}% all-in).
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export function NegotiationCard({ result }: { result: EligibilityResult }) {
  const { o1, o2, o3, o4, tenureAdjustmentNote } = result;
  const amountsDiffer = o2.lenderLikely !== o2.safeToCarry;

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardDescription>Your result</CardDescription>
        <CardTitle className={`text-2xl ${VERDICT_STYLES[o1.verdict]}`}>
          {VERDICT_LABELS[o1.verdict]}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{o1.reason}</p>
        {tenureAdjustmentNote && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {tenureAdjustmentNote}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-5 border-t border-border pt-4">
        {/* O2: What you can borrow */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">What you can borrow</h3>

          <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">A lender may offer up to</span>
              <span className="text-base font-semibold">{formatRupees(o2.lenderLikely)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{o2.lenderLikelyReason}</p>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium">What&apos;s safe for you to take</span>
              <span className="text-lg font-bold">{formatRupees(o2.safeToCarry)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{o2.safeToCarryReason}</p>
          </div>

          {amountsDiffer && (
            <p className="text-xs text-muted-foreground">
              We recommend the safe amount, not the lender&apos;s maximum — even if a lender
              offers more.
            </p>
          )}

          {!amountsDiffer && o2.ceilingsMatchNote && (
            <p className="text-xs text-muted-foreground">{o2.ceilingsMatchNote}</p>
          )}

          {o2.routedToSecuredProduct && o2.securedProductNote && (
            <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
              {o2.securedProductNote}
            </p>
          )}
        </div>

        {/* O3: Fair rate for you */}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Fair rate for you</h3>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">Fair rate for your profile</span>
            <span className="text-base font-semibold">
              {o3.rateBandLow}% – {o3.rateBandHigh}%
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">All-in cost (APR, incl. fees)</span>
            <span className="text-base font-semibold">
              {o3.aprBandLow}% – {o3.aprBandHigh}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{o3.rateReason}</p>

          <div className="flex flex-col gap-0.5 rounded-lg bg-muted/60 p-2">
            <span className="text-xs font-medium">
              Confidence: {CONFIDENCE_LABELS[o3.confidence]}
            </span>
            <span className="text-xs text-muted-foreground">{o3.confidenceReason}</span>
          </div>

          <TenureQuoteCheck result={result} />
        </div>

        {/* O4: EMI ceiling */}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">EMI ceiling</h3>
          <p className="text-sm">
            Don&apos;t agree to an EMI above{" "}
            <span className="font-semibold">{formatRupees(o4.emiCeiling)}/month</span>
          </p>

          {o4.tenureOptions.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium">Tenure</th>
                    <th className="px-3 py-2 text-right font-medium">EMI/month</th>
                  </tr>
                </thead>
                <tbody>
                  {o4.tenureOptions.map((option) => (
                    <tr key={option.months} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{option.months} months</td>
                      <td className="px-3 py-2 text-right">{formatRupees(option.emi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{o4.stressCaseNote}</p>
        </div>
      </CardContent>

      <CardFooter>
        <p className="text-xs text-muted-foreground">
          This is a self-assessment tool, not a lender&apos;s decision — actual offers can vary.
        </p>
      </CardFooter>
    </Card>
  );
}
