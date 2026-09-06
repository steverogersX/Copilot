"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Confidence, Verdict, type EligibilityResult } from "@/lib/engine";
import { blockNonDecimalKeys, onlyDecimalDigits } from "@/lib/loan-form-fields";
import { cn } from "cn";

const VERDICT_LABELS: Record<Verdict, string> = {
  [Verdict.Borrow]: "Borrow",
  [Verdict.BorrowLess]: "Borrow less",
  [Verdict.DontBorrow]: "Don't borrow",
};

const VERDICT_ICONS: Record<Verdict, typeof CheckCircle2> = {
  [Verdict.Borrow]: CheckCircle2,
  [Verdict.BorrowLess]: AlertTriangle,
  [Verdict.DontBorrow]: XCircle,
};

const VERDICT_HEADER_STYLES: Record<Verdict, string> = {
  [Verdict.Borrow]:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  [Verdict.BorrowLess]:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  [Verdict.DontBorrow]:
    "bg-destructive/10 text-destructive dark:bg-destructive/15",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  [Confidence.High]: "High",
  [Confidence.Medium]: "Medium",
  [Confidence.Low]: "Low",
};

const CONFIDENCE_DOT_STYLES: Record<Confidence, string> = {
  [Confidence.High]: "bg-emerald-500",
  [Confidence.Medium]: "bg-amber-500",
  [Confidence.Low]: "bg-muted-foreground",
};

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function TenureQuoteCheck({ result }: { result: EligibilityResult }) {
  const [quotedRate, setQuotedRate] = useState("");
  const parsedRate = quotedRate === "" ? null : Number(quotedRate);
  const isAbove = parsedRate !== null && !Number.isNaN(parsedRate) && parsedRate > result.o3.aprBandHigh;
  const isChecked = parsedRate !== null && !Number.isNaN(parsedRate);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <Label htmlFor="quoted-rate" className="text-xs font-medium">
        Hold this up to a lender — what did they quote you?
      </Label>
      <div className="flex items-center gap-2">
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
          className="max-w-[120px]"
        />
        <span className="text-xs text-muted-foreground">% p.a., all-in / APR</span>
      </div>
      {isChecked && (
        <p
          className={cn(
            "rounded-lg px-2.5 py-2 text-xs font-medium",
            isAbove
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          )}
        >
          {isAbove
            ? `That's above what's fair for your profile (${result.o3.rateBandLow}%–${result.o3.rateBandHigh}%, or up to ${result.o3.aprBandHigh}% all-in) — ask why.`
            : `That's within the fair range for your profile (${result.o3.rateBandLow}%–${result.o3.rateBandHigh}%, up to ${result.o3.aprBandHigh}% all-in).`}
        </p>
      )}
    </div>
  );
}

export function NegotiationCard({ result }: { result: EligibilityResult }) {
  const { o1, o2, o3, o4, tenureAdjustmentNote } = result;
  const amountsDiffer = o2.lenderLikely !== o2.safeToCarry;
  const VerdictIcon = VERDICT_ICONS[o1.verdict];

  return (
    <div className="flex max-h-[85vh] flex-col">
      {/* Header - verdict, always visible */}
      <div className={cn("flex flex-col gap-2 rounded-t-xl px-5 pt-5 pb-4", VERDICT_HEADER_STYLES[o1.verdict])}>
        <div className="flex items-center gap-2 pr-6">
          <VerdictIcon className="size-6 shrink-0" />
          <span className="text-xl font-bold">{VERDICT_LABELS[o1.verdict]}</span>
        </div>
        <p className="text-sm leading-snug opacity-90">{o1.reason}</p>
        {tenureAdjustmentNote && (
          <p className="rounded-md bg-black/5 px-2 py-1 text-xs opacity-80 dark:bg-white/10">
            {tenureAdjustmentNote}
          </p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="thin-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        {/* O2: What you can borrow */}
        <div className="flex flex-col gap-2.5">
          <SectionHeading>What you can borrow</SectionHeading>

          <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">A lender may offer up to</span>
              <span className="text-base font-semibold">{formatRupees(o2.lenderLikely)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{o2.lenderLikelyReason}</p>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border-2 border-primary/50 bg-primary/5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium">What&apos;s safe for you to take</span>
              <span className="text-xl font-bold text-primary">{formatRupees(o2.safeToCarry)}</span>
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
            <div className="flex gap-2 rounded-xl bg-muted/60 p-3">
              <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{o2.securedProductNote}</p>
            </div>
          )}
        </div>

        {/* O3: Fair rate for you */}
        <div className="flex flex-col gap-2.5 border-t border-border pt-5">
          <SectionHeading>Fair rate for you</SectionHeading>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5 rounded-xl border border-border p-3">
              <span className="text-xs text-muted-foreground">Fair rate</span>
              <span className="text-base font-semibold">
                {o3.rateBandLow}%–{o3.rateBandHigh}%
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border p-3">
              <span className="text-xs text-muted-foreground">All-in (APR)</span>
              <span className="text-base font-semibold">
                {o3.aprBandLow}%–{o3.aprBandHigh}%
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{o3.rateReason}</p>

          <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3">
            <span
              className={cn(
                "mt-1 size-2 shrink-0 rounded-full",
                CONFIDENCE_DOT_STYLES[o3.confidence]
              )}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium">
                Confidence: {CONFIDENCE_LABELS[o3.confidence]}
              </span>
              <span className="text-xs text-muted-foreground">{o3.confidenceReason}</span>
            </div>
          </div>

          <TenureQuoteCheck result={result} />
        </div>

        {/* O4: EMI ceiling */}
        <div className="flex flex-col gap-2.5 border-t border-border pt-5">
          <SectionHeading>EMI ceiling</SectionHeading>
          <p className="text-sm">
            Don&apos;t agree to an EMI above{" "}
            <span className="font-semibold">{formatRupees(o4.emiCeiling)}/month</span>
          </p>

          {o4.tenureOptions.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
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
      </div>

      {/* Footer - always visible */}
      <div className="rounded-b-xl border-t border-border bg-muted/40 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          This is a self-assessment tool, not a lender&apos;s decision — actual offers can vary.
        </p>
      </div>
    </div>
  );
}
