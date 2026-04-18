# CarLy — Production Requirements Specification
**Version:** 2.0 — Hardened for MVP Implementation  
**Status:** Primary source of truth for solo developer build  
**Baseline:** Derived from `requirements.md` v1.0; aligned with `planning.md` v1.1  
**Core Invariant:** Deterministic logic calculates. AI explains. PII is never persisted.

---

## Table of Contents

1. [Functional Requirements](#1-functional-requirements)
2. [Non-Functional Requirements](#2-non-functional-requirements)
3. [Personas](#3-personas)
4. [User Stories](#4-user-stories)
5. [Legal & Risk Mitigation](#5-legal--risk-mitigation)

---

## 1. Functional Requirements

---

### FR1 — User Input Capture & Validation

**Description:**  
The system must capture all financial and preference data required for vehicle filtering and payment estimation. Budget input must be captured as a **dual-mode variable**: the user selects either a *Monthly Payment* ceiling or a *Total Purchase Price* ceiling — not both simultaneously. All inputs must be validated at both the frontend (Zod) and the backend (Pydantic) before any downstream service is called.

**Currency:** USD only for MVP. All monetary fields are `number` types representing whole US dollars. Multi-currency support is explicitly deferred to post-MVP; the currency symbol `$` must be hardcoded in the UI.

---

#### FR1.1 — Input Field Definitions

| Field | Type | Required | MVP Default |
|---|---|---|---|
| `budget_mode` | `enum["monthly", "total"]` | Yes | `"monthly"` |
| `budget_value` | `number` | Yes | — |
| `credit_score` | `integer` | Yes | — |
| `purchase_type` | `enum["finance", "lease", "both"]` | Yes | `"both"` |
| `down_payment` | `number` | No | `0` |
| `loan_term_months` | `enum[24,36,48,60,72,84]` | Yes | `60` |
| `zip_code` | `string` (5-digit) | Yes | — |

---

#### FR1.2 — Validation Schema

**Frontend — Zod Schema (TypeScript)**

```typescript
import { z } from "zod";

const MAX_BUDGET_USD = 500_000;  // Prevents runaway API calls and nonsensical results
const MAX_DOWN_PAYMENT_USD = 500_000;

export const UserInputSchema = z.object({
  budget_mode: z.enum(["monthly", "total"]),

  budget_value: z
    .number({ invalid_type_error: "Budget must be a number." })
    .positive({ message: "Budget must be greater than $0." })
    .max(MAX_BUDGET_USD, {
      message: `Budget cannot exceed $${MAX_BUDGET_USD.toLocaleString()} for this tool.`,
    }),

  credit_score: z
    .number()
    .int({ message: "Credit score must be a whole number." })
    .min(300, { message: "Credit score must be at least 300." })
    .max(850, { message: "Credit score cannot exceed 850." }),

  purchase_type: z.enum(["finance", "lease", "both"]),

  down_payment: z
    .number()
    .min(0, { message: "Down payment cannot be negative." })
    .max(MAX_DOWN_PAYMENT_USD, {
      message: `Down payment cannot exceed $${MAX_DOWN_PAYMENT_USD.toLocaleString()}.`,
    })
    .default(0),

  loan_term_months: z.enum([24, 36, 48, 60, 72, 84] as const).default(60),

  zip_code: z
    .string()
    .regex(/^\d{5}$/, { message: "ZIP code must be exactly 5 digits." }),
});

export type UserInput = z.infer<typeof UserInputSchema>;
```

**Backend — Pydantic Model (Python)**

```python
from pydantic import BaseModel, Field, field_validator
from enum import Enum

class BudgetMode(str, Enum):
    monthly = "monthly"
    total = "total"

class PurchaseType(str, Enum):
    finance = "finance"
    lease = "lease"
    both = "both"

class UserInputModel(BaseModel):
    budget_mode: BudgetMode
    budget_value: float = Field(gt=0, le=500_000,
        description="USD. Must be positive and ≤ $500,000.")
    credit_score: int = Field(ge=300, le=850)
    purchase_type: PurchaseType
    down_payment: float = Field(default=0.0, ge=0, le=500_000)
    loan_term_months: int = Field(default=60)
    zip_code: str

    @field_validator("loan_term_months")
    @classmethod
    def validate_term(cls, v):
        allowed = {24, 36, 48, 60, 72, 84}
        if v not in allowed:
            raise ValueError(f"loan_term_months must be one of {sorted(allowed)}")
        return v

    @field_validator("zip_code")
    @classmethod
    def validate_zip(cls, v):
        if not v.isdigit() or len(v) != 5:
            raise ValueError("zip_code must be exactly 5 digits")
        return v
```

---

#### FR1.3 — Edge Case Handling

| Input Scenario | Required Behavior |
|---|---|
| `budget_value = 0` | Reject. Error: *"Budget must be greater than $0."* |
| `budget_value < 0` | Reject. Error: *"Budget must be greater than $0."* |
| `budget_value > 500,000` | Reject. Error: *"Budget cannot exceed $500,000 for this tool."* |
| `budget_value = 1,000,000,000` | Reject at Zod layer before backend call. Same error message. |
| `credit_score < 300` | Reject. Error: *"Credit score must be at least 300."* |
| `credit_score > 850` | Reject. Error: *"Credit score cannot exceed 850."* |
| `down_payment > budget_value` (total mode) | Surface a **non-blocking warning**: *"Your down payment exceeds your total budget. Results may be limited."* Do not block submission. |
| `down_payment > budget_value × term` (monthly mode) | Surface the same non-blocking warning. |
| Non-USD currency attempted | Not applicable (MVP). USD symbol `$` is hardcoded. No currency selector rendered. |

---

#### FR1.4 — Session Handling of Inputs

- Validated inputs are signed into a short-lived JWT (`HttpOnly`, `Secure`, `SameSite=Strict`; 30-minute expiry).
- Raw `credit_score` is mapped to `credit_tier` (`enum["excellent","good","fair","poor"]`) at the backend input boundary and **discarded**. Only `credit_tier` is carried forward.
- `zip_code` is used for tax lookup within the request and is **not logged or stored**.
- No input field is persisted to a database in the MVP.

---

### FR2 — Vehicle Data Orchestration & Fallbacks

**Description:**  
The system fetches vehicle specifications from the **CarQuery API** using a cascading hierarchical query pattern. All responses must be cached. The system must degrade gracefully under API failure without blocking the payment calculation flow.

---

#### FR2.1 — CarQuery Hierarchical Query Sequence

All vehicle selector calls must follow this strict order. A step may only be called after its predecessor returns a non-empty result.

```
Step 1: GET ?cmd=getMakes&year={year}&sold_in_us=1
         → Populates Make dropdown

Step 2: GET ?cmd=getModels&make={make}&year={year}&sold_in_us=1
         → Populates Model dropdown

Step 3: GET ?cmd=getTrims&make={make}&model={model}&year={year}
         → Populates Trim dropdown
         → Extracts: model_msrp, model_trim, make_display

Step 4: Internal normalization
         → Maps CarQuery response → internal Vehicle entity (see planning.md §5.1)
```

- Always append `sold_in_us=1` to Steps 1 and 2 to restrict results to the US market.
- `model_msrp` is treated as `null` if absent or `"0"` in the response.

---

#### FR2.2 — Stale-While-Revalidate Cache Strategy

The system must implement a two-zone TTL cache for all CarQuery responses.

| Zone | TTL | Behavior |
|---|---|---|
| **Fresh** | 0 – 24 hours | Serve from cache immediately. No API call. |
| **Stale** | 24 – 48 hours | Serve stale data immediately. Trigger a background revalidation API call. Update cache on success. |
| **Expired** | > 48 hours | Discard cache entry. Make a fresh API call. If the call fails, invoke the Fallback UI (FR2.3). |

**Cache Key Format:**
```
carquery:{cmd}:{sorted_param_hash}
# Example: carquery:getTrims:a3f1bc9d
```

**Implementation (Python — file-based for MVP):**

```python
import json, time, hashlib
from pathlib import Path

CACHE_DIR = Path(".cache/carquery")
FRESH_TTL = 86_400       # 24 hours
STALE_TTL = 172_800      # 48 hours

def cache_key(cmd: str, params: dict) -> str:
    h = hashlib.md5(json.dumps(params, sort_keys=True).encode()).hexdigest()
    return f"{cmd}:{h}"

def get_with_zone(key: str) -> tuple[dict | None, str]:
    """Returns (data, zone) where zone is 'fresh', 'stale', or 'expired'."""
    path = CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None, "expired"
    age = time.time() - path.stat().st_mtime
    data = json.loads(path.read_text())
    if age <= FRESH_TTL:
        return data, "fresh"
    elif age <= STALE_TTL:
        return data, "stale"
    return None, "expired"
```

---

#### FR2.3 — Fallback UI Specification

The following conditions must each independently trigger the Fallback UI. The payment calculation flow must **not** be blocked by vehicle data failures.

**Trigger Conditions:**

| Condition | Definition |
|---|---|
| API latency exceeded | CarQuery response not received within **3 seconds** |
| API server error | CarQuery returns a `5xx` status code |
| Cache expired + API unreachable | No fresh or stale data available |

**Required UI Behavior (Fallback Active):**

1. Serve the most recent cached data available (stale zone preferred over nothing).
2. Render a non-dismissable inline warning banner above the vehicle selector:
   > ⚠️ **Vehicle data as of [Timestamp].** Live data is temporarily unavailable. Results may not reflect the latest models or pricing.
3. `[Timestamp]` must be the `Last-Modified` timestamp of the cache file in human-readable format (e.g., *"Apr 15, 2026 at 2:14 PM"*).
4. If **no cache exists at all** (cold start failure), render a full-panel error state:
   > 🚫 **Vehicle data unavailable.** Our data provider is temporarily unreachable. You may still enter vehicle details manually below.
   
   Followed by a manual MSRP input field (`number`, `gt=0`, `le=500_000`) so the user can proceed to payment estimation without vehicle data.

5. The backend must return HTTP `503 Service Unavailable` with body:
```json
{
  "error": "vehicle_data_unavailable",
  "message": "CarQuery API is unreachable and no cache is available.",
  "action": "retry",
  "retry_after_seconds": 30
}
```

---

#### FR2.4 — Data Normalization Contract

All CarQuery responses must be normalized to the internal `Vehicle` entity before use. Raw CarQuery fields must never be passed directly to the LLM or the frontend.

| CarQuery Field | Internal Field | Notes |
|---|---|---|
| `make_display` | `make` | |
| `model_name` | `model` | |
| `model_year` | `year` | Cast to `int` |
| `model_trim` | `trim` | `null` if absent |
| `model_msrp` | `msrp` | Cast to `float`. `null` if `"0"` or absent. |
| Derived | `estimated_residual_value` | `msrp × residual_pct` (see FR5). `null` if `msrp` is `null`. |

---

### FR3 — Vehicle Filtering

**Description:**  
Filter the normalized vehicle dataset based on user inputs. Filtering must be performed server-side. No unfiltered vehicle data is returned to the frontend.

**Acceptance Criteria:**

- Filter by `purchase_type`: if `"lease"`, exclude vehicles with `estimated_residual_value = null`; surface a UI note: *"Some vehicles cannot be leased due to missing residual data."*
- Filter by budget:
  - `budget_mode = "monthly"`: exclude vehicles whose estimated monthly payment (at mid-range APR) exceeds `budget_value × 1.15` (15% tolerance buffer to account for tax variance)
  - `budget_mode = "total"`: exclude vehicles whose `msrp + estimated_taxes_fees` exceeds `budget_value × 1.10`
- **Empty result handling:** If filtering yields zero vehicles, do not return an error. Return an empty array with a `filter_relaxation_suggestion` field indicating which filter is most restrictive. The frontend must render: *"No vehicles match your criteria. Try increasing your budget or adjusting your credit tier."*

---

### FR4 — Price Estimation

**Description:**  
Estimate the all-in vehicle price including taxes and fees. This is used as the principal (`P`) in FR5 calculations.

**Acceptance Criteria:**

- **Sales Tax:** Looked up by ZIP code → state mapping (static table, MVP). Applied as `msrp × state_tax_rate`.
- **Documentation / Registration Fee:** Flat estimate of `msrp × 0.02` (2%). Labeled in UI as *"Est. Doc & Reg Fees."*
- **All-In Price:** `msrp + sales_tax + doc_reg_fee − down_payment`
- All tax and fee figures must be labeled: *"Estimated — verify with your dealer."*
- If `msrp` is `null` (unavailable from CarQuery), the manually entered MSRP from FR2.3 fallback is used. If no MSRP is available at all, price estimation returns `null` and a UI message is shown: *"Enter MSRP to see payment estimates."*

---

### FR5 — Financial Logic Integrity (Deterministic Calculation Service)

**Description:**  
All payment calculations must be performed by a **Deterministic Calculation Service** (DCS) — a self-contained Python module with no external dependencies, no LLM calls, and no randomness. The DCS is the sole source of all financial figures in the application. The LLM may never modify, recalculate, or contradict DCS output.

---

#### FR5.1 — Credit Tier → Rate Constants (Industry-Average)

The DCS uses the following static constants keyed by `credit_tier`. All values are **market estimates** and must be labeled as such in the UI.

| `credit_tier` | Score Range | Finance APR (mid) | Money Factor (mid) | Residual % (36mo) |
|---|---|---|---|---|
| `excellent` | 750 – 850 | 5.25% | 0.00125 | 55% |
| `good` | 700 – 749 | 7.25% | 0.00175 | 53% |
| `fair` | 650 – 699 | 10.25% | 0.00240 | 51% |
| `poor` | 300 – 649 | 15.00% | 0.00340 | 49% |

> **UI Labeling Requirement:** Wherever a rate constant from this table is displayed, it must be followed by the badge: `Market Estimate ℹ️` with a tooltip: *"Based on industry-average rates for your credit tier. Actual rates are set by lenders."*

---

#### FR5.2 — Finance Payment Formula

```
Inputs:
  P  = all_in_price  (from FR4; net of down payment)
  r  = annual_apr_mid / 12  (monthly interest rate)
  n  = loan_term_months

Outputs:
  monthly_payment = P × [r(1+r)^n] / [(1+r)^n − 1]
  total_cost      = (monthly_payment × n) + down_payment
  total_interest  = total_cost − (P + down_payment)
```

**DCS Implementation (Python):**

```python
from decimal import Decimal, ROUND_HALF_UP

def calculate_finance(
    principal: float,
    annual_apr: float,
    term_months: int,
    down_payment: float,
) -> dict:
    """
    Standard amortizing loan payment.
    All monetary outputs rounded to 2 decimal places (banker's rounding).
    """
    r = Decimal(str(annual_apr)) / Decimal("12")
    n = Decimal(str(term_months))
    P = Decimal(str(principal))

    if r == 0:
        monthly = P / n
    else:
        factor = (1 + r) ** n
        monthly = P * (r * factor) / (factor - 1)

    monthly = monthly.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_cost = (monthly * n + Decimal(str(down_payment))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_interest = (total_cost - P - Decimal(str(down_payment))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return {
        "monthly_payment": float(monthly),
        "total_cost": float(total_cost),
        "total_interest": float(total_interest),
        "apr_applied": annual_apr,
        "term_months": term_months,
    }
```

---

#### FR5.3 — Lease Payment Formula

```
Inputs:
  msrp           = Vehicle MSRP
  residual_pct   = from credit_tier table (§FR5.1)
  money_factor   = from credit_tier table (§FR5.1)
  cap_cost       = msrp − down_payment
  residual_value = msrp × residual_pct
  term_months    = loan_term_months

Outputs:
  depreciation_fee  = (cap_cost − residual_value) / term_months
  finance_charge    = (cap_cost + residual_value) × money_factor
  base_payment      = depreciation_fee + finance_charge
  monthly_payment   = base_payment × (1 + sales_tax_rate)
  total_cost        = (monthly_payment × term_months) + down_payment
```

**DCS Implementation (Python):**

```python
def calculate_lease(
    msrp: float,
    down_payment: float,
    money_factor: float,
    residual_pct: float,
    term_months: int,
    sales_tax_rate: float,
) -> dict:
    from decimal import Decimal, ROUND_HALF_UP

    M = Decimal(str(msrp))
    D = Decimal(str(down_payment))
    MF = Decimal(str(money_factor))
    RP = Decimal(str(residual_pct))
    T = Decimal(str(term_months))
    TAX = Decimal(str(sales_tax_rate))

    cap_cost = M - D
    residual = M * RP
    depreciation = (cap_cost - residual) / T
    finance_charge = (cap_cost + residual) * MF
    base = depreciation + finance_charge
    monthly = (base * (1 + TAX)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = (monthly * T + D).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "monthly_payment": float(monthly),
        "total_cost": float(total),
        "money_factor_applied": money_factor,
        "residual_pct_applied": residual_pct,
        "residual_value": float(residual),
        "term_months": term_months,
    }
```

---

#### FR5.4 — DCS Integrity Rules

1. The DCS must be a **pure function module** — same inputs always produce same outputs.
2. No DCS function may make network calls, read from cache, or call the LLM.
3. All monetary values use Python `Decimal` with `ROUND_HALF_UP` to avoid floating-point drift.
4. DCS outputs are **immutable** once returned. The LLM context packet must pass DCS output as read-only data; the LLM prompt must explicitly prohibit recalculation.
5. Unit tests for the DCS must validate against at least 3 reference outputs from Bankrate Auto Loan Calculator and Edmunds Lease Calculator. Acceptable variance: ≤ ±2%.

---

### FR6 — AI Explanation Generation

**Description:**  
After the DCS produces `PaymentResult`, the backend assembles a read-only **Context Packet** and sends it to the LLM. The LLM returns a narrative explanation only. See `planning.md §8` for context packet schema and system prompt.

**Acceptance Criteria:**

- LLM call is made **after** DCS calculation completes — never in parallel or before.
- Context packet contains DCS output and sanitized vehicle data. It must never contain `zip_code`, `credit_score`, or `session_id`.
- LLM response is validated: if the response contains any number that does not appear verbatim in the context packet, the response is **discarded** and `aiNarrative` is set to `null`.
- Maximum LLM response length: 400 tokens. If exceeded, truncate at the last complete sentence.
- All AI-generated text displayed in the UI must be visually distinct from DCS output (see §5 — Legal & Risk Mitigation).
- LLM timeout: 10 seconds. On timeout, `aiNarrative = null`. The UI silently hides the AI section; no error is surfaced to the user.

---

## 2. Non-Functional Requirements

### NFR1 — Performance

| Metric | Threshold | Measurement Method |
|---|---|---|
| Response time — cached vehicle data | p95 ≤ **1.5 seconds** | Server-side timing header `X-Response-Time` |
| Response time — fresh API fetch + DCS | p95 ≤ **3.0 seconds** | End-to-end from POST to first byte of response |
| LLM narrative generation | p95 ≤ **10 seconds** (non-blocking) | Separate async timing; does not contribute to DCS response SLA |
| CarQuery API timeout threshold | **3 seconds** | Triggers FR2.3 Fallback UI |
| Frontend Time-to-Interactive | ≤ **2 seconds** on a simulated 4G connection | Lighthouse CI score ≥ 90 |

**Implementation Notes:**
- DCS calculations must complete in < 50ms (no I/O; pure CPU).
- LLM call must be made asynchronously and must never block the DCS result from being returned to the frontend.
- Vercel Edge Network CDN caching for static assets; no server-side caching of user-specific results.

---

### NFR2 — Reliability & Error Boundaries

Every failure mode must have a defined HTTP status, a user-facing message, and a developer-facing log event. No unhandled exceptions may reach the client.

| Failure Scenario | HTTP Status | User-Facing Message | Log Event |
|---|---|---|---|
| CarQuery API unreachable | `503 Service Unavailable` | *"Vehicle data is temporarily unavailable. Cached results are being shown."* | `CARQUERY_UNAVAILABLE` |
| CarQuery cache cold + API down | `503 Service Unavailable` | *"Vehicle data unavailable. Enter MSRP manually to continue."* | `CARQUERY_COLD_FAILURE` |
| LLM API timeout / error | `200 OK` (partial) | AI section hidden silently | `LLM_TIMEOUT` or `LLM_ERROR` |
| LLM response contains hallucinated numbers | `200 OK` (partial) | AI section hidden silently | `LLM_HALLUCINATION_DETECTED` |
| DCS calculation error (e.g., division by zero) | `422 Unprocessable Entity` | *"We couldn't calculate payments for this vehicle. Please check your inputs."* | `DCS_CALCULATION_ERROR` |
| JWT expired or invalid | `401 Unauthorized` | *"Your session has expired. Please start over."* | `JWT_INVALID` |
| Zod/Pydantic validation failure | `400 Bad Request` | Field-level inline error messages (see FR1.3) | `VALIDATION_ERROR` |
| Unexpected server error | `500 Internal Server Error` | *"Something went wrong. Please try again."* (No stack trace) | `UNHANDLED_EXCEPTION` + full trace to log sink |

**Error Response Envelope (all non-2xx responses):**
```json
{
  "error": "snake_case_error_code",
  "message": "Human-readable message (safe for display)",
  "action": "retry | manual_input | reload | none",
  "retry_after_seconds": 30
}
```

---

### NFR3 — Usability & Time-to-Value

**Primary Metric:** A user must reach a personalized vehicle payment estimate within **4 distinct interactions** from landing on the application.

| Interaction | Step | Maximum UI Elements Active |
|---|---|---|
| 1 | Accept click-wrap terms of use | 1 checkbox + 1 button |
| 2 | Select purchase type + enter budget | ≤ 5 input fields |
| 3 | Select vehicle (Year → Make → Model → Trim cascading) | 4 cascading dropdowns |
| 4 | Submit + view results | Payment card + AI narrative |

**Supporting Usability Metrics:**

| Metric | Target |
|---|---|
| Form completion rate (no validation errors on first submit) | ≥ 70% (usability test baseline) |
| Time from landing to results page | ≤ 90 seconds for a median user |
| Validation error comprehension | User corrects error on first retry ≥ 80% of the time |
| Mobile usability | All interactions completable without horizontal scroll on 375px viewport |

**Accessibility:**
- All form inputs must have associated `<label>` elements.
- All error messages must be announced via `aria-live="polite"`.
- Color contrast ratio ≥ 4.5:1 for all text (WCAG 2.1 AA).
- Disclaimer text must not be smaller than 12px / 0.75rem.

---

### NFR4 — Security

| Requirement | Specification |
|---|---|
| JWT cookie flags | `HttpOnly`, `Secure`, `SameSite=Strict` |
| JWT expiry | 30 minutes from issuance |
| Secret management | All secrets via environment variables; never committed to version control |
| Input sanitization | All string inputs HTML-escaped before rendering |
| Rate limiting | Max 20 estimation requests per IP per hour (MVP: enforce via Vercel middleware) |
| Log hygiene | `zip_code`, `credit_score`, and `budget_value` must never appear in application logs |
| HTTPS | Enforced at all layers; no HTTP fallback |

---

### NFR5 — Scalability

For MVP, the system is designed for a single-instance deployment. The following constraints define the scaling ceiling before architectural changes are required.

| Dimension | MVP Ceiling | Trigger for Migration |
|---|---|---|
| Concurrent users | ~50 | Sustained p95 latency > 3s |
| CarQuery API calls | ~500/day (file cache) | Cache miss rate > 20% |
| LLM API calls | ~1,000/day | Cost > $10/day |
| Storage (file cache) | < 500MB | Disk usage > 80% |

**Migration Path:** At any ceiling trigger, migrate file cache → Redis; single instance → containerized deployment on Railway/Fly.io with horizontal scaling.

---

## 3. Personas

### Persona 1 — First-Time Buyer (Alex, 24)
- Limited financial literacy; unsure whether to lease or finance
- **Priority Features:** Guided flow, plain-language AI explanations, lease vs. finance trade-off narrative
- **Failure Mode:** Drops off if validation errors are confusing or results lack explanation

### Persona 2 — Budget-Conscious Commuter (Maria, 35)
- Hard monthly budget ceiling; wants maximum reliability within it
- **Priority Features:** Monthly budget mode, lowest payment sorted first, total cost of ownership callout
- **Failure Mode:** Loses trust if estimates feel inaccurate or disclosures are unclear

### Persona 3 — Experienced Buyer (David, 42)
- High automotive knowledge; optimizes for speed and data density
- **Priority Features:** Skip guided flow, direct MSRP entry, side-by-side finance vs. lease numbers
- **Failure Mode:** Frustrated by unnecessary steps or lack of raw calculation data

### Persona 4 — Middle-Class Value Shopper (Sandra, 38)
- Balances quality and affordability; not purely price-driven
- **Priority Features:** Value score or "best fit" ranking, AI explanation of trade-offs, segment comparison
- **Failure Mode:** Overwhelmed by too many options with no clear recommendation signal

---

## 4. User Stories

Stories are written in **Gherkin-style** for testability.

---

**US-01 — Budget Input**  
*As a user, I want to specify my budget as either a monthly payment or total purchase price so that I can see vehicles I can realistically afford.*

```
Given I am on the input form
When I select "Monthly Payment" and enter $600
Then the system filters vehicles whose estimated monthly payment is ≤ $690 (15% buffer)
And the results page displays a "Monthly Budget: $600" filter badge
```

---

**US-02 — Credit Tier Mapping**  
*As a user, I want to enter my credit score so that I see payment estimates based on realistic interest rates.*

```
Given I enter a credit score of 720
When the form is submitted
Then the backend maps 720 to credit_tier = "good"
And the DCS applies APR = 7.25% (midpoint)
And the result card displays "Rate applied: 7.25% (Market Estimate)"
```

---

**US-03 — Lease vs. Finance Comparison**  
*As a user, I want to compare lease and finance options side by side so that I can choose the better option for my situation.*

```
Given I select purchase_type = "both"
When results are returned
Then two payment cards are displayed: one for Finance, one for Lease
And each card displays monthly payment, total cost, and term
And an AI narrative explains the key trade-off between the two
```

---

**US-04 — Monthly Payment Visibility**  
*As a user, I want to see my estimated monthly payment prominently so that I can quickly assess affordability.*

```
Given results are displayed
Then the monthly payment figure is the largest text element in the payment card
And it is labeled "Est. Monthly Payment"
And it is followed by the disclaimer badge "Non-Binding Estimate"
```

---

**US-05 — AI Trade-Off Explanation**  
*As a user, I want an AI explanation of my results so that I understand the financial trade-offs.*

```
Given the DCS has returned a PaymentResult
When the LLM call succeeds within 10 seconds
Then the AI narrative is displayed in a visually distinct section labeled "✦ AI Insights"
And the narrative does not contain any number not present in the PaymentResult
And a disclaimer reads "AI-generated explanation — not financial advice"
```

---

**US-06 — API Failure Resilience**  
*As a user, I want to see results even if live vehicle data is unavailable so that I don't have to start over.*

```
Given the CarQuery API returns a 503 error
And a cache entry exists that is 30 hours old (stale zone)
When I submit my vehicle selection
Then the stale cache data is served
And a banner displays "Vehicle data as of [Timestamp]. Live data temporarily unavailable."
And the payment calculation proceeds normally using the stale MSRP
```

---

**US-07 — Fast Response**  
*As a user, I want results to appear quickly so that I don't abandon the tool.*

```
Given vehicle data is cached (fresh zone)
When I submit the estimation form
Then the DCS result is returned within 1.5 seconds (p95)
And the AI narrative loads asynchronously without blocking the payment card
```

---

**US-08 — Simple, Guided UI**  
*As a user, I want a clear step-by-step flow so that I can reach a result without confusion.*

```
Given I land on the application for the first time
When I complete the click-wrap agreement
Then I am presented with Step 1 of the input flow (purchase type + budget)
And I reach a personalized payment result within 4 total interactions
And no step presents more than 5 active input fields simultaneously
```

---

## 5. Legal & Risk Mitigation

---

### L1 — "Non-Binding Estimate" Disclaimer — Presence Rules

**Rule:** Every view that displays a dollar amount derived from the DCS must include a persistent Non-Binding Estimate disclaimer. No exception.

**Required Locations:**

| Location | Disclaimer Type | Exact Copy |
|---|---|---|
| Global UI footer (all pages) | Block text, always visible | *"CarLy provides payment estimates for informational purposes only. All figures are approximations based on publicly available data. Actual payments, rates, and terms are determined by lenders and dealers and may differ significantly. CarLy is not a licensed financial advisor, broker, or lender."* |
| Each payment result card | Inline badge | `Non-Binding Estimate ℹ️` — tooltip: *"This figure is an approximation. Verify with your dealer or lender."* |
| Rate / money factor display | Inline badge | `Market Estimate ℹ️` — tooltip: *"Based on industry-average rates for your credit tier. Actual rates are set by lenders."* |
| Tax & fee estimates | Inline label | *"Est. — verify with dealer"* |

**Implementation Requirement:**  
All disclaimer text must be rendered **server-side** (Next.js SSR), not injected by client-side JavaScript. This ensures disclaimers are present even if JavaScript fails to load.

---

### L2 — AI Transparency — Labeling Requirements

All AI-generated narrative text must be visually and semantically distinct from DCS-calculated financial data. The following rules are non-negotiable.

| Requirement | Specification |
|---|---|
| Section label | `✦ AI Insights` displayed as a header above all AI-generated text |
| Visual distinction | AI section must have a distinct background color from payment result cards (e.g., `bg-blue-50` vs. white) |
| AI disclaimer | Appended to every AI narrative: *"This explanation is AI-generated and is for informational purposes only. It is not financial advice."* |
| No co-mingling | AI narrative text must never appear inside a payment result card. The two sections must be separated by at least 16px of vertical space and a visible border or background boundary. |
| Anti-pattern | ❌ Do not present AI text as a "recommendation" or "verdict." ❌ Do not use phrases like "you should" or "we recommend" in AI output. The system prompt must explicitly prohibit these phrases. |
| Failure state | If `aiNarrative = null`, hide the AI section entirely. Do not render an empty `✦ AI Insights` section or an error message in its place. |

---

### L3 — Click-Wrap Terms of Use

**Requirement:** A click-wrap agreement must be accepted before a user can access the input form. It is a hard gate.

**Trigger:** On first page load of the session (`sessionStorage` key `terms_accepted` is absent or `false`).

**Persistence:** `sessionStorage` only. Cleared when the browser tab is closed. User must re-accept on each new session.

**UI Specification:**

```
┌─────────────────────────────────────────────────────────┐
│  Before you continue                                    │
│                                                         │
│  CarLy helps you estimate vehicle payments. By using    │
│  this tool, you acknowledge:                            │
│                                                         │
│  • All results are estimates only, not guarantees       │
│  • CarLy is not a licensed financial advisor or lender  │
│  • You assume all risk for decisions based on this tool │
│  • No personal financial data is stored beyond          │
│    your current session                                 │
│                                                         │
│  [Full Terms of Use ↗]                                  │
│                                                         │
│  ☐ I understand and agree to the Terms of Use          │
│                                                         │
│  [Continue →]  ← disabled until checkbox is checked    │
└─────────────────────────────────────────────────────────┘
```

**Implementation Rules:**

1. The "Continue" button must be `disabled` until the checkbox is checked (enforced via React state, not CSS alone).
2. The modal/gate must be full-viewport-blocking. The underlying form must not be focusable via keyboard while the gate is active (`aria-modal="true"`, `inert` on background).
3. `[Full Terms of Use ↗]` links to a static `/terms` page. The `/terms` page must exist at launch.
4. On acceptance: set `sessionStorage.setItem("terms_accepted", "true")` and remove the gate.
5. The click-wrap acceptance event must be logged server-side (timestamp + anonymous session ID) for legal audit purposes. No PII is logged.

> **Legal Note:** The click-wrap language must be reviewed by a licensed attorney before production launch to confirm enforceability in target jurisdictions (at minimum: California, New York, Texas).

---

### L4 — Additional Risk Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DCS formula error (incorrect amortization) | Low | High | Unit tests vs. 3+ reference calculators; ±2% tolerance gate in CI |
| LLM hallucinates a financial figure | Medium | High | Post-generation validation: discard response if any number is not in context packet |
| User makes a financial decision based on estimates | Medium | High | Click-wrap (L3) + per-card disclaimer (L1) + AI label (L2) |
| CarQuery MSRP data is stale / incorrect | Medium | Medium | "Estimated — verify with dealer" label on all MSRP-derived values |
| JWT secret leaked via accidental commit | Low | High | `.env` in `.gitignore`; pre-commit hook to block secrets; rotate on each deploy |
| Rate abuse (scraping estimation endpoint) | Low | Medium | 20 req/IP/hour rate limit; Vercel middleware |
| GDPR / CCPA exposure | Low | High | No PII stored beyond session; click-wrap discloses data handling; legal review before launch |
