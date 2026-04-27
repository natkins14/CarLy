// ─────────────────────────────────────────────────────────────────────────────
// lib/schemas.ts
// Zod validation schemas — the single source of truth for client-side
// validation. Pydantic on the backend mirrors these exactly.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BUDGET_USD = 500_000;
const MAX_DOWN_PAYMENT_USD = 500_000;
const VALID_LOAN_TERMS = [24, 36, 48, 60, 72, 84] as const;

// ─── Session Init ─────────────────────────────────────────────────────────────

export const SessionInitSchema = z.object({
  credit_score: z
    .number()
    .int({ message: "Credit score must be a whole number." })
    .min(300, { message: "Credit score must be at least 300." })
    .max(850, { message: "Credit score cannot exceed 850." })
    .optional(),

  credit_tier: z
    .enum(["excellent", "good", "fair", "poor"] as const)
    .optional(),

  zip_code: z
    .string()
    .regex(/^\d{5}$/, { message: "ZIP code must be exactly 5 digits." })
    .optional(),
});

export type SessionInitInput = z.infer<typeof SessionInitSchema>;

// ─── Estimate Request ─────────────────────────────────────────────────────────

/**
 * EstimateRequestSchema — mirrors backend EstimateRequest exactly.
 * This is the authoritative Zod schema per requirements2.0.md §FR1.2.
 */
export const EstimateRequestSchema = z
  .object({
    // Budget
    budget_mode: z.enum(["monthly", "total"] as const, {
      required_error: "Please select a budget mode.",
    }),

    budget_value: z
      .number({ invalid_type_error: "Budget must be a number." })
      .positive({ message: "Budget must be greater than $0." })
      .max(MAX_BUDGET_USD, {
        message: `Budget cannot exceed $${MAX_BUDGET_USD.toLocaleString()} for this tool.`,
      }),

    // Purchase preferences
    purchase_type: z.enum(["finance", "lease", "both"] as const, {
      required_error: "Please select a purchase type.",
    }),

    down_payment: z
      .number()
      .min(0, { message: "Down payment cannot be negative." })
      .max(MAX_DOWN_PAYMENT_USD, {
        message: `Down payment cannot exceed $${MAX_DOWN_PAYMENT_USD.toLocaleString()}.`,
      })
      .default(0),

    loan_term_months: z
      .union(
        VALID_LOAN_TERMS.map((t) => z.literal(t)) as [
          z.ZodLiteral<24>,
          z.ZodLiteral<36>,
          z.ZodLiteral<48>,
          z.ZodLiteral<60>,
          z.ZodLiteral<72>,
          z.ZodLiteral<84>,
        ]
      )
      .default(60),

    // Location
    zip_code: z
      .string()
      .regex(/^\d{5}$/, { message: "ZIP code must be exactly 5 digits." }),

    // Credit (one of score or tier; both optional — backend applies default)
    credit_score: z
      .number()
      .int({ message: "Credit score must be a whole number." })
      .min(300, { message: "Credit score must be at least 300." })
      .max(850, { message: "Credit score cannot exceed 850." })
      .optional(),

    credit_tier: z
      .enum(["excellent", "good", "fair", "poor"] as const)
      .optional(),

    // Vehicle
    year: z
      .number()
      .int()
      .min(1900, { message: "Year must be at least 1900." })
      .max(2100, { message: "Year must be at most 2100." }),

    make: z
      .string()
      .min(1, { message: "Make is required." })
      .max(64, { message: "Make must be 64 characters or fewer." })
      .transform((v) => v.trim()),

    model: z
      .string()
      .min(1, { message: "Model is required." })
      .max(64, { message: "Model must be 64 characters or fewer." })
      .transform((v) => v.trim()),

    trim: z
      .string()
      .max(64, { message: "Trim must be 64 characters or fewer." })
      .transform((v) => v.trim())
      .optional(),

    // Manually supplied MSRP (used when CarQuery data is unavailable)
    msrp: z
      .number()
      .positive({ message: "MSRP must be greater than $0." })
      .max(MAX_BUDGET_USD, {
        message: `MSRP cannot exceed $${MAX_BUDGET_USD.toLocaleString()}.`,
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Non-blocking warning surfaced via UI, but we still validate here for
    // the superRefine pipeline. The UI reads z.ZodError issues with a
    // "warning" code annotation.
    if (data.budget_mode === "total" && data.down_payment > data.budget_value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["down_payment"],
        message:
          "Your down payment exceeds your total budget. Results may be limited.",
        // Custom severity flag — treat as warning, not hard error in UI
        // (checked via issue.params?.severity === "warning")
        params: { severity: "warning" },
      });
    }

    if (
      data.budget_mode === "monthly" &&
      data.down_payment > data.budget_value * data.loan_term_months
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["down_payment"],
        message:
          "Your down payment exceeds your monthly budget over the loan term. Results may be limited.",
        params: { severity: "warning" },
      });
    }
  });

export type EstimateRequestInput = z.infer<typeof EstimateRequestSchema>;

// ─── Helper: extract Zod warnings vs hard errors ─────────────────────────────

/**
 * Split a ZodError's issues into hard errors (block submission) and
 * soft warnings (show but allow submission).
 */
export function partitionZodIssues(issues: z.ZodIssue[]): {
  errors: z.ZodIssue[];
  warnings: z.ZodIssue[];
} {
  const errors: z.ZodIssue[] = [];
  const warnings: z.ZodIssue[] = [];

  for (const issue of issues) {
    const isWarning =
      issue.code === z.ZodIssueCode.custom &&
      (issue as z.ZodCustomIssue).params?.severity === "warning";

    if (isWarning) {
      warnings.push(issue);
    } else {
      errors.push(issue);
    }
  }

  return { errors, warnings };
}
