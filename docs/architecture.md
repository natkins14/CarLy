# CarLy — Architecture Document
**Version:** 1.0  
**Status:** Authoritative Technical North Star — MVP Implementation  
**Baseline:** `planning.md` v1.1 · `requirements2.0.md` v2.0  
**Core Invariant:** Deterministic logic calculates. AI explains. PII is never persisted.

---

## Table of Contents

1. [System Overview & Architectural Style](#1-system-overview--architectural-style)
2. [Component Decomposition](#2-component-decomposition)
3. [Data Flow & Orchestration](#3-data-flow--orchestration)
4. [Security & Privacy Architecture](#4-security--privacy-architecture)
5. [Resilience & Error Boundaries](#5-resilience--error-boundaries)
6. [Infrastructure & Deployment](#6-infrastructure--deployment)
7. [Constraint Checklist](#7-constraint-checklist)

---

## 1. System Overview & Architectural Style

### 1.1 Architectural Pattern: Stateless Micro-Monolith

CarLy is structured as a **Stateless Micro-Monolith**: a single deployable backend process with internally well-separated modules, fronted by a server-rendered Next.js application. It does not adopt a microservices topology.

**Rationale for a solo developer MVP:**

| Factor | Micro-Monolith | Microservices |
|---|---|---|
| Operational complexity | Single process, single deploy target | Network mesh, multi-service orchestration |
| Debugging | In-process call stacks, single log stream | Distributed tracing required |
| DCS isolation | Enforced by module boundaries + type contracts | Enforced by network boundary (over-engineered for this scale) |
| Scaling path | Vertical first; horizontal at ceiling trigger | Horizontal from day one (premature) |
| Solo maintainability | ✅ Matches team size | ❌ Exceeds team capacity |

The micro-monolith pattern is adopted explicitly for MVP. At NFR5 scaling ceilings (>50 concurrent users, file cache miss rate >20%), the CarQuery adapter and optionally the DCS may be extracted to independent processes with Redis-backed caching — without altering public interfaces.

**Trade-off accepted:** A single-process backend introduces a shared failure domain. Any unhandled exception can theoretically affect all modules. This is mitigated by FastAPI's exception handler middleware (returning structured error envelopes) and module-level isolation within the Python process.

### 1.2 Frontend / Backend Boundary

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel Edge Network                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js 14 (App Router — SSR)                       │  │
│  │  - Input Form (progressive disclosure, 4 steps)      │  │
│  │  - Results Display (DCS output, labeled "Calculated") │  │
│  │  - AI Narrative UI (labeled "✦ AI Insights")         │  │
│  │  - SSR-rendered disclaimers (never JS-injected)      │  │
│  └──────────────────────┬────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTPS + HttpOnly JWT Cookie
                          │ POST /api/estimate
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Railway / Fly.io                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  FastAPI (Python 3.11)                               │  │
│  │  ┌─────────────────┐  ┌──────────────────────────┐  │  │
│  │  │  DCS            │  │  CarQuery Adapter        │  │  │
│  │  │  (Pure Python)  │  │  (Cached / Fallback)     │  │  │
│  │  └────────┬────────┘  └───────────┬──────────────┘  │  │
│  │           └──────────┬────────────┘                  │  │
│  │                      ▼                               │  │
│  │          ┌───────────────────────┐                   │  │
│  │          │  Context Packet Builder│                   │  │
│  │          └───────────┬───────────┘                   │  │
│  │                      ▼                               │  │
│  │          ┌───────────────────────┐                   │  │
│  │          │  Anthropic Claude API │                   │  │
│  │          │  (Explanation Only)   │                   │  │
│  │          └───────────────────────┘                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Why this boundary exists:**

- **Security:** `ANTHROPIC_API_KEY` and `JWT_SECRET` must never be exposed to browser-side JavaScript. The backend is the sole caller of the Anthropic API and the sole issuer/validator of JWTs.
- **Control:** All financial calculations originate server-side in the DCS. The frontend renders outputs; it performs no calculation.
- **AI orchestration:** The LLM call, context packet assembly, and hallucination validation are backend responsibilities. The frontend receives only a pre-validated `aiNarrative` string or `null`.
- **Input sanitization:** Raw `credit_score` is mapped to `credit_tier` and discarded at the backend boundary before any downstream service sees it.

---

## 2. Component Decomposition

### 2.1 Frontend — Next.js 14 (App Router)

#### State Management Strategy

Next.js App Router with a **hybrid state model**:

- **URL-encoded state** for vehicle selector cascade (year, make, model, trim). URL params allow shareable links and survive browser back-navigation without re-entering data.
- **React `useState`** for transient form state within each step (current step index, field values, validation errors).
- **`sessionStorage`** for click-wrap acceptance flag (`terms_accepted: "true"`). Cleared on tab close, forcing re-acceptance per session.
- **No `localStorage`**, no client-side database. All persistent state is in the signed JWT cookie (session-scoped, server-controlled).

Server Actions are not used for the estimation endpoint. A standard `fetch` POST to the FastAPI backend is used to keep API interaction explicit and testable.

#### Progressive Disclosure Form Architecture

The form is rendered as a four-step sequence. Each step is a distinct React component rendered conditionally by a `currentStep` state variable. A step advances only when its Zod schema subset validates successfully.

```
Step 1 — Terms Gate (blocking modal)
  Component: <TermsGate />
  Trigger: sessionStorage["terms_accepted"] absent or "false"
  Exit: checkbox checked + Continue button clicked
  Effect: sessionStorage.setItem("terms_accepted", "true")

Step 2 — Purchase Type + Budget
  Component: <PurchaseAndBudgetStep />
  Fields: purchase_type (radio), budget_mode (toggle), budget_value, down_payment
  Max 5 active inputs simultaneously (NFR3)

Step 3 — Vehicle Selection
  Component: <VehicleSelectorStep />
  Fields: year (dropdown), make (dropdown), model (dropdown), trim (dropdown)
  Each dropdown is disabled until its predecessor resolves
  Populated by GET /api/vehicles/{cmd} endpoints (not the estimation POST)

Step 4 — Financial Inputs + Submit
  Component: <FinancialInputsStep />
  Fields: loan_term_months, credit_score, zip_code
  On submit: fires POST /api/estimate

Results Page
  Component: <ResultsPage />
  Sections: <PaymentCard /> (DCS output) + <AIInsightsSection /> (async)
  AI section renders only when aiNarrative is non-null
```

**"Back" navigation:** Each completed step preserves its inputs in a `formState` object held in parent React state. On back-navigation, the prior step's component is re-mounted with the preserved values as initial state. No data is lost.

#### Zod Validation Boundary

**Client-side (Zod):** Validates shape, type, range, and format. Blocks `POST /api/estimate` from firing if any field fails.

**Server-side (Pydantic):** Re-validates the same fields independently. A client that bypasses Zod (e.g., curl, modified request) is rejected at the backend with HTTP 400.

**Fields validated client-side only:** None. All Zod fields have a Pydantic equivalent.

**Fields validated server-side only:** `session_id` (injected from JWT by middleware, not from request body). JWT signature validity.

```typescript
// Authoritative Zod schema — from requirements2.0.md §FR1.2
import { z } from "zod";

const MAX_BUDGET_USD = 500_000;
const MAX_DOWN_PAYMENT_USD = 500_000;

export const UserInputSchema = z.object({
  budget_mode: z.enum(["monthly", "total"]),
  budget_value: z
    .number({ invalid_type_error: "Budget must be a number." })
    .positive({ message: "Budget must be greater than $0." })
    .max(MAX_BUDGET_USD, {
      message: `Budget cannot exceed $${MAX_BUDGET_USD.toLocaleString()} for this tool.`,
    }),
  credit_score: z.number().int().min(300).max(850),
  purchase_type: z.enum(["finance", "lease", "both"]),
  down_payment: z.number().min(0).max(MAX_DOWN_PAYMENT_USD).default(0),
  loan_term_months: z.enum([24, 36, 48, 60, 72, 84] as const).default(60),
  zip_code: z.string().regex(/^\d{5}$/),
});
```

The Zod schema is the single source of truth for the TypeScript type `UserInput`. Pydantic mirrors it exactly in Python.

#### Click-Wrap Compliance Gate

The `<TermsGate />` component is a full-viewport-blocking modal (`position: fixed; inset: 0`). Implementation rules:

1. The underlying form receives `inert` attribute and `aria-modal="true"` is set on the gate. Keyboard focus is trapped within the modal.
2. The "Continue" button `disabled` state is controlled by React `useState` (a boolean `agreed`), not by CSS alone. The button's `onClick` handler only fires when `agreed === true`.
3. On acceptance, `sessionStorage.setItem("terms_accepted", "true")` is set and an HTTP POST is made to `POST /api/session/accept-terms` to log the anonymous acceptance event (timestamp + session_id — no PII).
4. Disclaimer text within the gate is server-rendered via Next.js SSR to ensure it is present even if client-side hydration fails.
5. A link to `/terms` (a static SSR page) is present inside the gate. Opening the link does not dismiss the gate.

#### Handling Async States

| State | Trigger | UI Behavior |
|---|---|---|
| Loading (DCS) | POST submitted | Skeleton cards in Results area; submit button disabled |
| Fallback — ≥ 3s latency | `setTimeout(3000)` on submit | Skeleton replaced with: *"This is taking longer than expected…"* + spinner; request still in flight |
| DCS Success | `200 OK` with `paymentResult` | Payment cards rendered immediately |
| AI Loading | DCS resolved; AI still pending | AI section shows inline spinner labeled "Generating explanation…" |
| AI Success | `aiNarrative` non-null | AI section renders narrative |
| AI Silent Failure | `aiNarrative` is `null` | AI section not rendered; no error shown |
| CarQuery Stale | Cache in stale zone | Non-dismissable banner: *"Vehicle data as of [Timestamp]. Live data temporarily unavailable."* |
| CarQuery Cold Failure | No cache + API down | Full-panel error + manual MSRP input field |
| JWT Expired | `401` response | *"Your session has expired. Please start over."* + redirect to Step 1 |

The 3-second fallback is implemented as:
```typescript
useEffect(() => {
  if (!isLoading) return;
  const t = setTimeout(() => setShowFallback(true), 3000);
  return () => clearTimeout(t);
}, [isLoading]);
```
`showFallback` does not cancel the request — it only changes the UI copy. When the response arrives (late), `setShowFallback(false)` and the result renders normally.

---

### 2.2 Backend — FastAPI (Python 3.11)

#### 2.2.1 Deterministic Calculation Service (DCS)

The DCS is a **pure function Python module** (`app/services/dcs.py`). It has no imports from `httpx`, `redis`, `anthropic`, or any I/O library. It performs no network calls, reads no files, and generates no randomness. It is the sole producer of all financial figures in the application.

**Invariant enforcement — technical prevention of violations:**

1. The DCS module has no access to any client or adapter object at import time or call time.
2. Pydantic output models are typed as `Final` / frozen dataclasses to prevent mutation after return.
3. The Context Packet Builder accepts DCS output as a typed `PaymentResult` model. The LLM call receives only a serialized JSON string of this model — the LLM cannot call DCS functions.
4. FastAPI route handlers call DCS before constructing the context packet. The orchestration order is enforced by Python's synchronous execution within the route (DCS completes, then packet is built, then async LLM call is awaited).

**Input/Output Contract:**

| Input Field | Type | Source | Example |
|---|---|---|---|
| `principal` | `float` | FR4 all-in price (net of down payment) | `32740.00` |
| `annual_apr` | `float` | Credit tier table (FR5.1 midpoint) | `0.0725` |
| `term_months` | `int` | User input, validated | `60` |
| `down_payment` | `float` | User input, validated | `3000.00` |
| `msrp` | `float` | Vehicle entity | `35000.00` |
| `money_factor` | `float` | Credit tier table (FR5.1 midpoint) | `0.00175` |
| `residual_pct` | `float` | Credit tier table (FR5.1) | `0.53` |
| `sales_tax_rate` | `float` | ZIP → state lookup table | `0.0625` |

| Output Field | Type | Description |
|---|---|---|
| `finance_monthly_payment` | `float` | Standard amortizing payment, 2dp |
| `finance_total_cost` | `float` | `(monthly × n) + down_payment` |
| `finance_total_interest` | `float` | Total interest paid |
| `apr_applied` | `float` | APR used (for UI display) |
| `lease_monthly_payment` | `float \| None` | `None` if `purchase_type = "finance"` |
| `lease_total_cost` | `float \| None` | `None` if `purchase_type = "finance"` |
| `money_factor_applied` | `float \| None` | Money factor used |
| `residual_pct_applied` | `float \| None` | Residual percentage used |
| `residual_value` | `float \| None` | `msrp × residual_pct` |
| `term_months` | `int` | Echo of input |
| `calculation_timestamp` | `datetime` | UTC ISO-8601 |

**Finance formula (authoritative):**
```
r  = annual_apr / 12
P  = principal  (all-in price net of down payment)
n  = term_months

monthly_payment = P × [r(1+r)^n] / [(1+r)^n − 1]
  (If r = 0: monthly_payment = P / n)
total_cost      = (monthly_payment × n) + down_payment
total_interest  = total_cost − P − down_payment
```

All monetary values computed with Python `Decimal(ROUND_HALF_UP)` to 2 decimal places. Float conversion occurs only at serialization time.

**Lease formula (authoritative):**
```
cap_cost          = msrp − down_payment
residual_value    = msrp × residual_pct
depreciation_fee  = (cap_cost − residual_value) / term_months
finance_charge    = (cap_cost + residual_value) × money_factor
base_payment      = depreciation_fee + finance_charge
monthly_payment   = base_payment × (1 + sales_tax_rate)
total_cost        = (monthly_payment × term_months) + down_payment
```

**Credit tier → rate constants (static, immutable):**

| `credit_tier` | Score Range | Finance APR (mid) | Money Factor (mid) | Residual % (36 mo) |
|---|---|---|---|---|
| `excellent` | 750 – 850 | 5.25% | 0.00125 | 55% |
| `good` | 700 – 749 | 7.25% | 0.00175 | 53% |
| `fair` | 650 – 699 | 10.25% | 0.00240 | 51% |
| `poor` | 300 – 649 | 15.00% | 0.00340 | 49% |

This table is defined as a Python `dict[str, CreditTierConstants]` frozen dataclass at module level. It is not configurable at runtime and is not read from any external source.

**Credit tier mapping (at input boundary — backend only):**

```python
def map_credit_score_to_tier(score: int) -> CreditTier:
    if score >= 750: return CreditTier.excellent
    if score >= 700: return CreditTier.good
    if score >= 650: return CreditTier.fair
    return CreditTier.poor
    # Raw score is discarded after this call. Never stored.
```

---

#### 2.2.2 CarQuery Adapter

The adapter is responsible for fetching, caching, and normalizing vehicle data from `https://www.carqueryapi.com/api/0.3/`.

**Hierarchical query sequence (strict order):**

```
Step 1: GET ?cmd=getMakes&year={year}&sold_in_us=1
Step 2: GET ?cmd=getModels&make={make}&year={year}&sold_in_us=1
Step 3: GET ?cmd=getTrims&make={make}&model={model}&year={year}
Step 4: Internal normalization → Vehicle entity
```

Each step is only invoked after its predecessor returns a non-empty result. The frontend triggers steps 1–3 via three separate GET endpoints on the FastAPI backend (used to populate cascading dropdowns). Step 4 is triggered at estimation time when the full trim is selected.

**Client-side throttling:** Max 5 requests/sec to CarQuery (courtesy limit, no authentication required).

**Caching strategy — Stale-While-Revalidate (file-based, MVP):**

| Zone | Age | Behavior |
|---|---|---|
| **Fresh** | 0 – 24 h | Serve from cache immediately; no API call. |
| **Stale** | 24 – 48 h | Serve stale data immediately; trigger background `asyncio.create_task` to revalidate. Update cache on success. Banner shown in UI. |
| **Expired** | > 48 h | Discard entry; make fresh API call. If call fails → Fallback UI (§5.2). |

**Cache key format:**
```
carquery:{cmd}:{md5(sorted_json(params))}
# Example: carquery:getTrims:a3f1bc9d
```

**Cache implementation (MVP — file-based):**
```python
CACHE_DIR = Path(".cache/carquery")
FRESH_TTL  = 86_400    # 24 hours (seconds)
STALE_TTL  = 172_800   # 48 hours (seconds)

def get_with_zone(key: str) -> tuple[dict | None, Literal["fresh","stale","expired"]]:
    path = CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None, "expired"
    age = time.time() - path.stat().st_mtime
    data = json.loads(path.read_text())
    if age <= FRESH_TTL:  return data, "fresh"
    if age <= STALE_TTL:  return data, "stale"
    return None, "expired"
```

**Failure fallback behavior:**

| Condition | Response |
|---|---|
| 5xx or timeout (>3s) + fresh/stale cache exists | Serve cache; set `cache_zone` flag; UI shows timestamp banner |
| 5xx or timeout + no cache | HTTP 503 with `{"error":"vehicle_data_unavailable",...}` + manual MSRP field in UI |
| `model_msrp` absent or `"0"` | `msrp = null`; UI prompt: *"MSRP unavailable — enter manually."* |

**Data normalization contract — CarQuery → internal `Vehicle` entity:**

| CarQuery Field | Internal Field | Transform |
|---|---|---|
| `make_display` | `make` | Direct |
| `model_name` | `model` | Direct |
| `model_year` | `year` | `int(v)` |
| `model_trim` | `trim` | `null` if absent |
| `model_msrp` | `msrp` | `float(v)` if present and `v != "0"`, else `null` |
| Derived | `estimated_residual_value` | `msrp × residual_pct` from credit tier table; `null` if `msrp` is null |

Raw CarQuery response fields are never passed to the LLM or the frontend. All downstream consumers receive the normalized `Vehicle` entity only.

---

#### 2.2.3 Context Packet Builder

The Context Packet Builder transforms DCS output and the normalized Vehicle entity into a read-only, LLM-safe JSON payload. It is a pure transformation function — no I/O, no external calls.

**Responsibilities:**

1. **PII stripping:** `zip_code`, `credit_score`, `budget_value`, `session_id`, and `monthly_budget` are explicitly excluded from the packet. Only `credit_tier` (enum string) is retained.
2. **Prompt injection prevention:** All string fields sourced from vehicle data or user input are sanitized before inclusion. Specifically: strip any text matching `\n---\n`, `Human:`, `Assistant:`, or markdown heading patterns (`#`+) that could alter the LLM prompt structure. Vehicle `make`, `model`, and `trim` strings are limited to 64 characters.
3. **Immutability:** The packet is serialized to a JSON string before the LLM call. The LLM cannot receive a reference to live Python objects.

**Context packet schema:**

```json
{
  "vehicle": {
    "year":  "<int>",
    "make":  "<string, max 64 chars, sanitized>",
    "model": "<string, max 64 chars, sanitized>",
    "trim":  "<string | null, max 64 chars, sanitized>",
    "msrp":  "<float | null>"
  },
  "payment_result": {
    "finance_monthly_payment": "<float>",
    "finance_total_cost":      "<float>",
    "finance_total_interest":  "<float>",
    "lease_monthly_payment":   "<float | null>",
    "lease_total_cost":        "<float | null>",
    "interest_rate_applied":   "<float>",
    "money_factor_applied":    "<float | null>",
    "residual_pct_applied":    "<float | null>",
    "residual_value":          "<float | null>",
    "loan_term_months":        "<int>",
    "down_payment_applied":    "<float>"
  },
  "user_context": {
    "credit_tier":   "<enum: excellent|good|fair|poor>",
    "purchase_type": "<enum: finance|lease|both>"
  }
}
```

**Fields explicitly excluded:**

```
zip_code        → NOT included
credit_score    → NOT included (only credit_tier)
budget_value    → NOT included
monthly_budget  → NOT included
session_id      → NOT included
calculation_timestamp → NOT included (implementation detail)
```

**LLM system prompt (authoritative):**

```
You are a helpful car-buying advisor. You will receive structured data about
a vehicle and estimated monthly payments. Your job is to explain this data
in plain, friendly language for a consumer.

Rules:
- Do NOT recalculate or alter any numbers.
- Do NOT provide investment or financial planning advice.
- Do NOT recommend specific lenders or dealers.
- Do NOT use the phrases "you should" or "we recommend".
- Explain trade-offs between finance and lease options when both are present.
- Keep your response under 150 words.
- Always acknowledge that estimates may differ from dealer or lender quotes.
```

**Post-generation hallucination validation:**

After the LLM response is received, every number in the response string is extracted via regex (`\d+\.?\d*`). Each extracted number must appear verbatim in the context packet JSON. If any number is not found, `aiNarrative` is set to `null` and event `LLM_HALLUCINATION_DETECTED` is logged.

---

## 3. Data Flow & Orchestration

### 3.1 End-to-End Request Lifecycle

**Step-by-step lifecycle for `POST /api/estimate`:**

| Step | Actor | Action | Latency Budget |
|---|---|---|---|
| 1 | Frontend (Zod) | Validate all form inputs client-side | < 10ms |
| 2 | Next.js | `POST /api/estimate` with JWT cookie + JSON body | Network RTT |
| 3 | FastAPI middleware | Validate JWT; extract `session_id`, `credit_tier` | < 5ms |
| 4 | FastAPI (Pydantic) | Re-validate request body; map `credit_score` → `credit_tier`; discard raw score | < 5ms |
| 5 | CarQuery Adapter | Check cache zone; serve fresh or stale; trigger background refresh if stale | < 50ms (cached) / ≤ 3s (live) |
| 6 | FR4 Price Estimation | Compute all-in price: `msrp + sales_tax + doc_reg_fee − down_payment` | < 5ms |
| 7 | DCS | `calculate_finance()` and/or `calculate_lease()` | < 50ms |
| 8 | FastAPI | Return `PaymentResult` immediately in response (AI not yet complete) | ← p95 ≤ 1.5s (cached) / ≤ 3.0s (fresh) |
| 9 | Context Packet Builder | Assemble and sanitize context packet from DCS output + Vehicle | < 10ms |
| 10 | Anthropic API (async) | Send context packet; await narrative (10s timeout) | ≤ 10s |
| 11 | Hallucination validator | Verify all numbers in narrative appear in context packet | < 10ms |
| 12 | Frontend | Render `PaymentResult` immediately; stream `aiNarrative` when resolved | — |

**Note on async AI delivery:** The FastAPI route handler awaits the DCS result synchronously, returns `PaymentResult` as a streaming response, and then yields the `aiNarrative` field when the LLM call resolves (or `null` on timeout/failure). The frontend renders payment cards immediately from the first JSON chunk, then populates the AI section from the second chunk.

Alternatively (and simpler for MVP): the route awaits both DCS and LLM sequentially, returning a single JSON response. DCS result is shown immediately only if the frontend calls two separate endpoints: `POST /api/estimate/sync` (DCS only, p95 ≤ 1.5s) followed by `GET /api/estimate/{session_id}/narrative` (LLM, polled). The two-endpoint pattern is recommended for MVP because it avoids streaming complexity while still non-blocking the payment display.

### 3.2 Failure Paths

| Failure | HTTP Status | Frontend Behavior |
|---|---|---|
| Zod validation failure | — (client) | Field-level inline error; form not submitted |
| Pydantic validation failure | `400` | Error envelope displayed; form remains editable |
| JWT expired/invalid | `401` | Redirect to Step 1; *"Session expired. Please start over."* |
| CarQuery fresh/stale hit | `200` | Proceed normally; optional stale banner |
| CarQuery cold failure | `503` | Manual MSRP input field shown |
| DCS division-by-zero or domain error | `422` | *"We couldn't calculate payments. Please check your inputs."* |
| LLM timeout | `200` (partial) | AI section hidden; payment cards shown |
| LLM hallucination detected | `200` (partial) | AI section hidden; event logged |
| Unhandled server exception | `500` | *"Something went wrong. Please try again."* No stack trace |

### 3.3 Mermaid Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant FE as Next.js Frontend
    participant BE as FastAPI Backend
    participant DCS as DCS Module
    participant CQ as CarQuery Adapter
    participant Cache as File Cache
    participant LLM as Anthropic Claude API

    User->>FE: Submit estimation form
    FE->>FE: Zod validation (client-side)
    alt Validation fails
        FE-->>User: Inline field errors
    end

    FE->>BE: POST /api/estimate (JWT cookie + JSON body)
    BE->>BE: Validate JWT → extract session_id, credit_tier
    BE->>BE: Pydantic validation; map credit_score→credit_tier (discard raw)

    BE->>CQ: Fetch vehicle data (year/make/model/trim)
    CQ->>Cache: get_with_zone(cache_key)
    alt Fresh zone (< 24h)
        Cache-->>CQ: Return cached data
    else Stale zone (24–48h)
        Cache-->>CQ: Return stale data
        CQ-->>BE: (background) revalidate async
    else Expired / no cache
        CQ->>CQ: GET carqueryapi.com (3s timeout)
        alt API success
            CQ->>Cache: Write new cache entry
            CQ-->>BE: Return normalized Vehicle
        else API failure
            BE-->>FE: HTTP 503 + error envelope
            FE-->>User: Manual MSRP input fallback
        end
    end

    CQ-->>BE: Normalized Vehicle entity

    BE->>BE: FR4: Compute all-in price (msrp + tax + fees − down)
    BE->>DCS: calculate_finance(principal, apr, term, down)
    DCS-->>BE: Finance PaymentResult (pure, no I/O)
    opt purchase_type includes lease
        BE->>DCS: calculate_lease(msrp, down, mf, residual, term, tax)
        DCS-->>BE: Lease PaymentResult (pure, no I/O)
    end

    BE-->>FE: HTTP 200 — PaymentResult (DCS output)
    FE-->>User: Render Payment Cards immediately

    Note over BE,LLM: Async AI path (non-blocking)
    BE->>BE: Context Packet Builder (strip PII, sanitize strings)
    BE->>LLM: POST /v1/messages (context packet, 10s timeout)
    alt LLM responds within 10s
        LLM-->>BE: aiNarrative string
        BE->>BE: Hallucination check (verify all numbers in packet)
        alt All numbers valid
            BE-->>FE: aiNarrative delivered
            FE-->>User: Render ✦ AI Insights section
        else Hallucination detected
            BE-->>FE: aiNarrative = null (log LLM_HALLUCINATION_DETECTED)
            FE-->>User: AI section hidden silently
        end
    else LLM timeout or error
        BE-->>FE: aiNarrative = null (log LLM_TIMEOUT or LLM_ERROR)
        FE-->>User: AI section hidden silently
    end
```

---

## 4. Security & Privacy Architecture

### 4.1 Stateless PII Handling

**JWT session strategy (HS256):**

| Field | In JWT Payload | Notes |
|---|---|---|
| `session_id` | ✅ Yes | UUID v4; no linkage to identity |
| `credit_tier` | ✅ Yes | Enum string: `excellent \| good \| fair \| poor` |
| `zip_code` | ✅ Yes | 5-digit string; used for tax lookup; not stored elsewhere |
| `iat` / `exp` | ✅ Yes | Standard; `exp = iat + 1800` (30 minutes) |
| `credit_score` | ❌ Never | Mapped to tier at boundary; discarded |
| `budget_value` | ❌ Never | Not persisted beyond request |
| `monthly_budget` | ❌ Never | Not persisted |
| `down_payment` | ❌ Never | Sent per-request in body |
| User identity | ❌ Never | No user accounts in MVP |

**JWT transport:** `HttpOnly; Secure; SameSite=Strict` cookie. Never returned in a JSON body. Never readable by browser-side JavaScript.

**JWT issuance:** Issued by FastAPI on first call to `POST /api/session/init` (or on first estimation request if no valid JWT exists). HS256 signed with `JWT_SECRET` environment variable.

**JWT secret rotation:** On each deploy, a new `JWT_SECRET` is set. This invalidates all existing sessions (acceptable for MVP stateless design — users simply start a new session).

### 4.2 Zero PII Persistence — Enforcement Points

| Enforcement Point | Mechanism |
|---|---|
| Raw `credit_score` | Mapped to `credit_tier` in Pydantic validator; local variable never passed to any function after mapping |
| `zip_code` | Used inline in FR4 tax lookup function; never assigned to any instance variable or cache entry |
| `budget_value` | Used only in vehicle filtering; never written to log, cache, or LLM packet |
| `session_id` | UUID only; no join key to any identity or PII field |
| LLM context packet | Explicitly excludes `zip_code`, `credit_score`, `budget_value`, `session_id` (asserted in unit tests) |
| Application logs | Structured log middleware strips fields matching `zip_code`, `credit_score`, `budget` from all log entries |

**Log redaction middleware (FastAPI):**
```python
REDACTED_LOG_FIELDS = {"zip_code", "credit_score", "budget_value", "monthly_budget"}

class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, dict):
            for field in REDACTED_LOG_FIELDS:
                record.msg.pop(field, None)
        return True
```

This filter is attached to the root logger at application startup. All structured log emissions pass through it.

### 4.3 Boundary Protection — Vercel Middleware

The following logic is implemented in `middleware.ts` at the Vercel edge layer (before requests reach Next.js or are proxied to FastAPI):

**Rate limiting:**
```typescript
// 20 estimation requests per IP per hour
// Implemented via Vercel KV (edge-compatible) or in-memory per-region map (MVP)
const RATE_LIMIT = { windowMs: 3_600_000, max: 20, keyPrefix: "rl:estimate:" };
```

If the limit is exceeded, the middleware returns `HTTP 429` with `Retry-After: 3600`.

**Request sanitization:** All string fields in the JSON body are length-checked. Any field exceeding 1,024 characters is rejected with `HTTP 400` before reaching the FastAPI backend. This prevents large-payload attacks.

**HTTPS enforcement:** Vercel enforces HTTPS by default. Any HTTP request is redirected to HTTPS with `308 Permanent Redirect`. No additional configuration required.

**Logging strategy — redaction rules:**

| Field | Log Behavior |
|---|---|
| `zip_code` | Redacted from all logs |
| `credit_score` | Redacted from all logs |
| `budget_value` | Redacted from all logs |
| `session_id` | Logged (non-PII UUID) |
| `credit_tier` | Logged (enum, non-PII) |
| `purchase_type` | Logged |
| `vehicle.make/model/year` | Logged |
| HTTP status codes | Logged |
| Response time (ms) | Logged |
| Error codes | Logged (snake_case, no PII) |

No log aggregation service is mandated for MVP. `stdout` structured JSON logs are sufficient for Railway/Fly.io log tailing. Post-MVP: forward to Datadog or Sentry.

---

## 5. Resilience & Error Boundaries

### 5.1 Car API — Stale-While-Revalidate

The three-zone cache (fresh / stale / expired) is documented in §2.2.2. The following additional rules apply to resilience:

**Stale serving with background revalidation:**
```python
data, zone = get_with_zone(cache_key)
if zone == "stale":
    asyncio.create_task(revalidate_cache(cmd, params, cache_key))
    return data, {"cache_zone": "stale", "cached_at": get_cached_at(cache_key)}
```
The `asyncio.create_task` schedules the revalidation without blocking the request response. If revalidation fails (CarQuery down), the stale data remains in cache and zone re-evaluation occurs on the next request.

**Cached fallback behavior:**

- If zone is `stale`, the response includes a header `X-Cache-Status: stale` and the frontend renders the timestamp banner.
- If zone is `expired` and the API call succeeds, the cache is updated and `X-Cache-Status: fresh` is returned.
- If zone is `expired` and the API call fails within 3 seconds, the backend returns `HTTP 503` and the frontend shows the manual MSRP input fallback.

**Cold start (no cache, API down):** The backend returns:
```json
{
  "error": "vehicle_data_unavailable",
  "message": "CarQuery API is unreachable and no cache is available.",
  "action": "retry",
  "retry_after_seconds": 30
}
```
The frontend renders the full-panel error state with a manual MSRP input field (`number`, `gt=0`, `le=500_000`). The user can proceed to estimation using a manually entered MSRP.

### 5.2 AI Layer — Silent Failure Pattern

The LLM call is designed so that its failure **never** degrades the core estimation experience.

**Failure conditions that set `aiNarrative = null`:**

| Condition | Log Event |
|---|---|
| `asyncio.TimeoutError` after 10s | `LLM_TIMEOUT` |
| Anthropic API `5xx` | `LLM_ERROR` (1 retry with 2s backoff; no retry on 4xx) |
| Response exceeds 400 tokens | Truncate at last complete sentence; proceed |
| Hallucination detected (number not in context packet) | `LLM_HALLUCINATION_DETECTED` |
| Anthropic API `4xx` (bad input) | `LLM_ERROR` (no retry) |

**UX fallback:** When `aiNarrative` is `null`, the `<AIInsightsSection />` component renders `null` (React). No empty section header, no error message, no spinner. The payment cards are unaffected. The user sees a complete, usable result without knowing an AI call failed.

**System still functions without AI:** The DCS → PaymentResult → PaymentCard path has zero dependency on the LLM. If the Anthropic API is entirely unavailable, all estimation features continue to work.

### 5.3 Frontend — Latency Fallback (≥ 3 Seconds)

As documented in §2.1, the 3-second fallback is a UI state change only — it does not cancel or retry the in-flight request.

**Fallback UI state (triggered at t+3s):**

```tsx
{showFallback && isLoading && (
  <div role="status" aria-live="polite" className="fallback-loading">
    <Spinner />
    <p>This is taking longer than expected. Hang tight…</p>
  </div>
)}
```

The `aria-live="polite"` attribute announces the state change to screen readers without interrupting ongoing audio.

**If the request eventually succeeds:** `showFallback` is set to `false` and results render normally. If it fails (non-2xx): the error envelope is displayed. No special handling is needed for the fallback → error transition.

**SLA context:** NFR1 specifies:
- p95 ≤ 1.5s for cached vehicle data
- p95 ≤ 3.0s for fresh API fetch + DCS

The 3-second frontend fallback trigger aligns with the p95 SLA for fresh fetches. Cached requests should never reach the fallback state under normal conditions.

---

## 6. Infrastructure & Deployment

### 6.1 Deployment Targets

| Layer | Platform | Rationale |
|---|---|---|
| Frontend | Vercel | Native Next.js integration; edge CDN for static assets; middleware support |
| Backend | Railway (primary) or Fly.io (alternative) | Single-command deploys; managed TLS; logs via `stdout`; no Kubernetes overhead |
| Cache | Filesystem (`.cache/carquery/`) on backend instance | Zero infrastructure dependency for MVP |
| Session state | Stateless JWT | No session store required |

**Vercel → FastAPI proxy:** Next.js rewrites route `/api/*` to the Railway/Fly.io backend URL. This keeps the browser's `same-origin` cookie policy intact for the `HttpOnly` JWT cookie.

```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL}/api/:path*`,
      },
    ];
  },
};
```

### 6.2 CI/CD Pipeline

**Stages:**

```
1. Build
   ├─ Frontend: next build (TypeScript typecheck + static analysis)
   └─ Backend:  mypy + ruff lint check

2. Test
   ├─ Backend unit tests: pytest (DCS formulas vs reference calculators, ±2% tolerance)
   ├─ Backend integration tests: pytest (CarQuery mock, LLM mock, context packet shape)
   ├─ Frontend unit tests: vitest (Zod schema, click-wrap gate, disclaimer render)
   └─ DCS tolerance gate: CI fails if any formula deviates > 2% from reference fixture

3. Security Check
   ├─ Pre-commit hook: gitleaks scan for secrets (blocks commit if JWT_SECRET or API keys found)
   └─ Dependency audit: pip-audit + npm audit

4. Deploy
   ├─ Frontend: vercel deploy --prod
   └─ Backend: railway up (or fly deploy)
```

**Branch strategy:** `main` is the production branch. Feature branches are merged via PR. CI must pass all stages before merge. No direct commits to `main`.

### 6.3 Environment Variables

| Variable | Used By | Notes |
|---|---|---|
| `JWT_SECRET` | FastAPI | 256-bit random hex. Required. Rotate on each deploy. |
| `ANTHROPIC_API_KEY` | FastAPI | Anthropic API key. Required. Never committed. |
| `BACKEND_URL` | Next.js (build time) | Full URL of Railway/Fly.io backend, e.g. `https://carly-api.railway.app` |
| `CARQUERY_BASE_URL` | FastAPI | Default: `https://www.carqueryapi.com/api/0.3/`. Overridable for testing. |
| `CACHE_DIR` | FastAPI | Default: `.cache/carquery`. Overridable for test isolation. |

**Secure handling rules:**

1. All variables are stored in Vercel Environment Variables (frontend) and Railway/Fly.io Secrets (backend) via their respective dashboards.
2. `.env` files are listed in `.gitignore`. A `pre-commit` hook using `gitleaks` scans for patterns matching known secret formats before any commit is allowed.
3. `JWT_SECRET` is generated at deploy time with: `openssl rand -hex 32`. A different value per environment (development, staging, production) is required.
4. `ANTHROPIC_API_KEY` must never appear in any application log, error response, or client-side bundle.
5. `BACKEND_URL` is a build-time variable only — it does not expose secrets. It must use `HTTPS` in production.

---

## 7. Constraint Checklist

The following constraints are non-negotiable per `planning.md` and `requirements2.0.md`. Each is explicitly addressed below.

### ✅ Zero PII Persistence

| Constraint | Implementation | Location |
|---|---|---|
| Raw `credit_score` never stored | Mapped to `credit_tier` enum in Pydantic validator; original variable not retained | §2.2.1, §4.1 |
| `zip_code` not logged or stored | Used inline in FR4 tax lookup; excluded from JWT payload (stored in JWT only for session carry); excluded from logs via `RedactingFilter` | §4.2 |
| `budget_value` not logged | Excluded from logs via `RedactingFilter`; not included in LLM context packet | §4.2 |
| No database for user inputs | No database provisioned in MVP; no ORM, no write path | §1.1 |
| LLM context packet excludes PII | `zip_code`, `credit_score`, `budget_value`, `session_id` explicitly excluded; asserted in integration tests | §2.2.3 |
| Click-wrap acceptance logged without PII | Timestamp + `session_id` (UUID) only | §2.1 |

### ✅ Deterministic vs AI Boundary Enforcement

| Constraint | Implementation | Location |
|---|---|---|
| DCS has no I/O | Module imports no network or file libraries; enforced by import-time static analysis (ruff) | §2.2.1 |
| DCS called before LLM | FastAPI route handler: DCS call is synchronous and must complete before `asyncio.create_task` schedules LLM | §3.1 |
| LLM receives read-only data | Context packet is a serialized JSON string; LLM cannot call DCS functions | §2.2.3 |
| LLM instructed not to recalculate | System prompt: *"Do NOT recalculate or alter any numbers."* | §2.2.3 |
| Hallucination validation | Post-generation: every number in LLM response verified against context packet; discard on mismatch | §2.2.3 |
| AI narrative visually separated | `<AIInsightsSection />` rendered in distinct `<section>` with `bg-blue-50`, `border`, minimum 16px gap from PaymentCard | §2.1 |
| AI label mandatory | `✦ AI Insights` header + *"AI-generated explanation — not financial advice."* appended to every rendered narrative | §2.1 |

### ✅ Fallback UI (≥ 3s Latency) Handling

| Constraint | Implementation | Location |
|---|---|---|
| 3s timeout triggers fallback UI | `setTimeout(3000)` sets `showFallback: true` in React state on POST submit | §2.1, §5.3 |
| Fallback does not cancel request | Timer only changes UI copy; `fetch` promise continues in flight | §5.3 |
| Fallback is accessible | `role="status"` + `aria-live="polite"` on fallback container | §5.3 |
| Payment cards render on response | `showFallback` cleared on response receipt; results render regardless of fallback state | §5.3 |

### ✅ API Staleness Handling Strategy

| Constraint | Implementation | Location |
|---|---|---|
| Two-zone TTL (fresh / stale / expired) | File cache with `st_mtime` comparison; zone returned alongside data | §2.2.2 |
| Stale data served immediately | `zone == "stale"` returns data before async revalidation starts | §5.1 |
| Stale data labeled in UI | Backend sets `X-Cache-Status: stale`; frontend renders timestamp banner | §5.1 |
| Background revalidation | `asyncio.create_task(revalidate_cache(...))` fires without blocking response | §5.1 |
| Expired cache + API failure → 503 | Distinct HTTP 503 response with `error: "vehicle_data_unavailable"` | §5.1 |
| Manual MSRP fallback on cold failure | `<ManualMSRPInput />` component rendered on `503` response | §5.1 |

---

*End of architecture.md — CarLy MVP Technical North Star*  
*Produced from: `planning.md` v1.1 · `requirements2.0.md` v2.0 · System Overview Diagram*
