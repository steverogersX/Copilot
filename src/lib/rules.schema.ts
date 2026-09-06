import { z } from "zod";

const rateBandTierSchema = z
  .object({
    minScore: z.number(),
    maxScore: z.number().nullable(),
    lowPercent: z.number().positive(),
    highPercent: z.number().positive(),
    confidence: z.enum(["low", "medium", "high"]),
  })
  .refine((tier) => tier.highPercent >= tier.lowPercent, {
    message: "highPercent must be >= lowPercent",
  });

export const rulesSchema = z.object({
  foir: z.object({
    capPercent: z.number().min(0).max(100),
    why: z.string(),
    source: z.string(),
  }),
  retirementAge: z.object({
    salaried: z.number().int().positive(),
    selfEmployed: z.number().int().positive(),
    why: z.string(),
    source: z.string(),
  }),
  rateBands: z.object({
    tiers: z.array(rateBandTierSchema).min(1),
    unknown: z.object({
      lowPercent: z.number().positive(),
      highPercent: z.number().positive(),
      confidence: z.enum(["low", "medium", "high"]),
    }),
    why: z.string(),
    source: z.string(),
  }),
  processingFee: z.object({
    lowPercent: z.number().min(0),
    highPercent: z.number().min(0),
    gstRate: z.number().min(0).max(1),
    why: z.string(),
    source: z.string(),
  }),
  bounceOverride: z.object({
    recentWindowMonths: z.number().int().positive(),
    why: z.string(),
    source: z.string(),
  }),
  stressCase: z.object({
    incomeDropPercent: z.number().min(0).max(100),
    why: z.string(),
    source: z.string(),
  }),
  neededEmiRateStrategy: z.object({
    strategy: z.enum(["midpoint", "low", "high"]),
    why: z.string(),
    source: z.string(),
  }),
  selfEmployedConfidence: z.object({
    newBusinessThresholdYears: z.number().int().positive(),
    why: z.string(),
    source: z.string(),
  }),
  collateral: z.object({
    ltvPercent: z.number().min(0).max(100),
    why: z.string(),
    source: z.string(),
  }),
  securedRate: z.object({
    lowPercent: z.number().positive(),
    highPercent: z.number().positive(),
    confidence: z.enum(["low", "medium", "high"]),
    why: z.string(),
    source: z.string(),
  }),
});

export type Rules = z.infer<typeof rulesSchema>;
