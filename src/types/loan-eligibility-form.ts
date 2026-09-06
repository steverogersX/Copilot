import { z } from "zod";

// What the borrower is applying for RIGHT NOW - scoped to exactly the three
// loan products the personas need (Priya: personal, Ravi: business/LAP,
// Anita: two-wheeler/EV). "Breadth of loan products" beyond this is
// explicitly Not Scored per the brief, so this stays deliberately narrow.
export enum LoanType {
  Personal = "Personal",
  Business = "Business", // Business loan / Loan Against Property - engine
  // should reason toward the secured (LAP) route
  // when collateral is present, per brief: "Is Ravi
  // routed to a secured product?"
  TwoWheeler = "TwoWheeler",
}

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  [LoanType.Personal]: "Personal Loan",
  [LoanType.Business]: "Business Loan / Loan Against Property",
  [LoanType.TwoWheeler]: "Two-Wheeler / EV Loan",
};

export enum IncomeType {
  Salaried = "Salaried",
  SelfEmployed = "SelfEmployed",
  Informal = "Informal",
}

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  [IncomeType.Salaried]: "Salaried",
  [IncomeType.SelfEmployed]: "Self-employed / Business owner",
  [IncomeType.Informal]: "Daily wage / Gig / Informal work",
};

export const INCOME_TYPE_DESCRIPTIONS: Record<IncomeType, string> = {
  [IncomeType.Salaried]: "I get a fixed monthly salary from an employer",
  [IncomeType.SelfEmployed]: "I run my own shop, trade, or business",
  [IncomeType.Informal]:
    "I earn through gig work, daily tasks, or informal jobs — income can vary month to month",
};

export const EMI_BOUNCE_FREQUENCY_OPTIONS: string[] = Array.from(
  { length: 5 },
  (_, i) => String(i + 1)
);

export const EMI_BOUNCE_FREQUENCY_LABELS: Record<string, string> =
  Object.fromEntries(
    EMI_BOUNCE_FREQUENCY_OPTIONS.map((value) => [value, value] as const)
  );

export enum EmiBounceRecency {
  WithinOneMonth = "WithinOneMonth",
  OneToThreeMonths = "OneToThreeMonths",
  ThreeToSixMonths = "ThreeToSixMonths",
  SixToTwelveMonths = "SixToTwelveMonths",
  MoreThanYear = "MoreThanYear",
}

export const EMI_BOUNCE_RECENCY_LABELS: Record<EmiBounceRecency, string> = {
  [EmiBounceRecency.WithinOneMonth]: "Within the last month",
  [EmiBounceRecency.OneToThreeMonths]: "1-3 months ago",
  [EmiBounceRecency.ThreeToSixMonths]: "3-6 months ago",
  [EmiBounceRecency.SixToTwelveMonths]: "6-12 months ago",
  [EmiBounceRecency.MoreThanYear]: "More than a year ago",
};

// ---- Zod schemas -----------------------------------------------------
// Fields stay strings end-to-end (raw input text) so they bind directly to
// controlled <Input> elements; validity is enforced by refinements instead
// of by coercing to number/enum, since "" is a valid "not answered yet" value.

const requiredEnum = <T extends Record<string, string>>(
  values: T,
  message: string
) =>
  z
    .union([z.enum(values), z.literal("")])
    .refine((value) => value !== "", { message });

const optionalEnum = <T extends Record<string, string>>(values: T) =>
  z.union([z.enum(values), z.literal("")]);

const positiveNumberString = (message: string) =>
  z.string().refine((value) => value !== "" && Number(value) > 0, {
    message,
  });

const percentageString = (message: string) =>
  z
    .string()
    .refine(
      (value) => value !== "" && Number(value) > 0 && Number(value) <= 100,
      { message }
    );

const yesNoOptional = z.union([
  z.literal("yes"),
  z.literal("no"),
  z.literal(""),
]);

export const existingEmiSchema = z.object({
  type: requiredEnum(LoanType, "Select EMI type"),
  amount: positiveNumberString("Enter a valid EMI amount"),
  interestRate: percentageString("Enter a valid interest rate"),
});

export const emiBounceSchema = z.object({
  type: requiredEnum(LoanType, "Select EMI type"),
  amount: positiveNumberString("Enter a valid EMI amount"),
  frequency: z.string(),
  recency: optionalEnum(EmiBounceRecency),
});

const baseLoanFormSchema = z.object({
  loanType: requiredEnum(LoanType, "Select a loan type"),
  amountWanted: positiveNumberString("Enter the amount you want to borrow"),
  incomeType: requiredEnum(IncomeType, "Select your income type"),
  tenurePreferred: positiveNumberString("Enter your preferred tenure"),
  incomeStabilityLow: z.string(),
  incomeStabilityHigh: z.string(),
  yearsInBusiness: z.string(),
  age: z
    .string()
    .refine(
      (value) =>
        value !== "" && Number(value) >= 18 && Number(value) <= 100,
      { message: "Enter a valid age" }
    ),
  netMonthlyIncome: z.string(),
  existingEmis: z.array(existingEmiSchema),
  monthlyExpenses: positiveNumberString("Enter your monthly expenses"),
  hadEmiBounces: yesNoOptional,
  emiBounces: z.array(emiBounceSchema),
  hasHighCostDebt: yesNoOptional,
  highCostDebtAmount: z.string(),
  highCostDebtInterestRate: z.string(),
  creditScore: z.string(),
  creditScoreUnknown: z.boolean(),
  hasCollateral: yesNoOptional,
  collateralValue: z.string(),
  collateralAlreadyPledged: yesNoOptional,
  collateralOutstandingAmount: z.string(),
  collateralInterestRate: z.string(),
  collateralRemainingTenureMonths: z.string(),
});

export const loanFormSchema = baseLoanFormSchema.superRefine((data, ctx) => {
  // TODO: Informal income type needs its own superRefine block +
  // numberOfIncomeSources field before engine() can support it.
  if (data.incomeType === IncomeType.SelfEmployed) {
    if (!data.incomeStabilityLow || Number(data.incomeStabilityLow) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter your low income month",
        path: ["incomeStabilityLow"],
      });
    }
    if (!data.incomeStabilityHigh || Number(data.incomeStabilityHigh) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter your high income month",
        path: ["incomeStabilityHigh"],
      });
    }
    if (!data.yearsInBusiness || Number(data.yearsInBusiness) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter years in business",
        path: ["yearsInBusiness"],
      });
    }
  } else if (
    !data.netMonthlyIncome ||
    Number(data.netMonthlyIncome) <= 0
  ) {
    // Self-employed borrowers give income via the low/high fields above
    // instead - this field doesn't apply to them.
    ctx.addIssue({
      code: "custom",
      message: "Enter your net monthly income",
      path: ["netMonthlyIncome"],
    });
  }

  if (data.hasHighCostDebt === "yes") {
    if (!data.highCostDebtAmount || Number(data.highCostDebtAmount) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the outstanding amount",
        path: ["highCostDebtAmount"],
      });
    }
    // 0 is a valid answer here (e.g. an interest-free advance from family/
    // employer) - only reject empty, negative, or unrealistically-high values.
    if (
      data.highCostDebtInterestRate === "" ||
      Number(data.highCostDebtInterestRate) < 0 ||
      Number(data.highCostDebtInterestRate) > 100
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Enter an interest rate (0 if interest-free)",
        path: ["highCostDebtInterestRate"],
      });
    }
  }

  // Adaptive collateral branch - only ask what applies:
  // no collateral -> stop; collateral -> value; already pledged -> outstanding.
  if (data.hasCollateral === "yes") {
    if (!data.collateralValue || Number(data.collateralValue) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the estimated value of the asset",
        path: ["collateralValue"],
      });
    }
    if (data.collateralAlreadyPledged === "yes") {
      if (
        !data.collateralOutstandingAmount ||
        Number(data.collateralOutstandingAmount) <= 0
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Enter the outstanding amount on the existing loan",
          path: ["collateralOutstandingAmount"],
        });
      }
      if (
        !data.collateralInterestRate ||
        Number(data.collateralInterestRate) <= 0 ||
        Number(data.collateralInterestRate) > 100
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid interest rate",
          path: ["collateralInterestRate"],
        });
      }
      if (
        !data.collateralRemainingTenureMonths ||
        Number(data.collateralRemainingTenureMonths) <= 0
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Enter the remaining tenure on that loan",
          path: ["collateralRemainingTenureMonths"],
        });
      }
    }
  }
});

export type ExistingEmi = z.infer<typeof existingEmiSchema>;
export type EmiBounce = z.infer<typeof emiBounceSchema>;
export type LoanFormValues = z.infer<typeof baseLoanFormSchema>;
