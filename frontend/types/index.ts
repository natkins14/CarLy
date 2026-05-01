// ─────────────────────────────────────────────────────────────────────────────
// types/index.ts
// Canonical TypeScript types for the CarLy frontend.
// These are derived from the backend Pydantic schemas (src/models/schemas.py).
// Any change to the Python models must be reflected here.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enumerations ────────────────────────────────────────────────────────────

export type BudgetMode = "monthly" | "total";
export type PurchaseType = "finance" | "lease" | "both";
export type CreditTier = "excellent" | "good" | "fair" | "poor";
export type LoanTermMonths = 24 | 36 | 48 | 60 | 72 | 84;

// ─── Request Shapes ───────────────────────────────────────────────────────────

/** Sent to POST /api/session/init */
export interface SessionInitRequest {
  credit_score?: number;
  credit_tier?: CreditTier;
  zip_code?: string;
}

/** Sent to POST /api/estimate */
export interface EstimateRequest {
  budget_mode: BudgetMode;
  budget_value: number;
  purchase_type: PurchaseType;
  down_payment: number;
  loan_term_months: LoanTermMonths;
  zip_code: string;
  credit_score?: number;
  credit_tier?: CreditTier;
  year: number;
  make: string;
  model: string;
  trim?: string;
  msrp?: number;
}

// ─── Response Shapes ──────────────────────────────────────────────────────────

/** Returned from POST /api/session/init */
export interface SessionClaims {
  session_id: string;
  credit_tier: CreditTier | null;
  zip_code: string | null;
  exp: number;
  iat: number;
}

export interface VehicleRecord {
  make: string;
  model: string;
  year: number;
  trim: string | null;
  msrp: number | null;
  estimated_residual_value: number | null;
}

export interface TaxEstimate {
  zip_code: string;
  state_code: string | null;
  sales_tax_rate: number;
  sales_tax_amount: number;
  documentation_fee: number;
  estimated_total_fees: number;
  all_in_price: number | null;
}

export interface PaymentResult {
  finance_monthly_payment: number;
  finance_total_cost: number;
  finance_total_interest: number;
  apr_applied: number;
  lease_monthly_payment: number | null;
  lease_total_cost: number | null;
  money_factor_applied: number | null;
  residual_pct_applied: number | null;
  residual_value: number | null;
  term_months: number;
  down_payment_applied: number;
  sales_tax_rate: number;
  all_in_price: number | null;
  budget_mode: BudgetMode;
  budget_value: number;
  budget_fit: boolean;
  filter_relaxation_suggestion: string | null;
  warnings: string[];
  calculation_timestamp: string; // ISO-8601
}

/** Returned from POST /api/estimate */
export interface EstimateResponse {
  vehicle: VehicleRecord;
  payment_result: PaymentResult;
  tax_estimate: TaxEstimate;
  user_context: Record<string, unknown>;
}

// ─── Error Envelope ───────────────────────────────────────────────────────────

/** Standard error shape returned by the backend for all non-2xx responses */
export interface ApiError {
  error: string;
  message: string;
  action: "retry" | "manual_input" | "reload" | "none";
  retry_after_seconds?: number;
  details?: unknown[];
}

// ─── UI State Helpers ─────────────────────────────────────────────────────────

/** Discriminated union for async data states */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError };

/** Cache zone reported by backend via X-Cache-Status header */
export type CacheZone = "fresh" | "stale" | "expired";
