# CarLy — Production Blueprint
**Version:** 1.1 — Refined for MVP Implementation  
**Status:** Authoritative planning document for solo developer build  
**Core Philosophy:** AI explains, deterministic logic calculates. PII is never persisted.

---

## Table of Contents

1. [Product Goals](#1-product-goals)
2. [User Personas & Use Cases](#2-user-personas--use-cases)
3. [Technical Architecture & Integration](#3-technical-architecture--integration)
4. [Technology Stack](#4-technology-stack)
5. [Data Modeling Schema](#5-data-modeling-schema)
6. [API Integration Strategy](#6-api-integration-strategy)
7. [Payment Estimation Logic](#7-payment-estimation-logic)
8. [AI Features Design](#8-ai-features-design)
9. [UX / UI Considerations](#9-ux--ui-considerations)
10. [Risk Mitigation & Legal](#10-risk-mitigation--legal)
11. [Roadmap](#11-roadmap)
12. [Testing Strategy](#12-testing-strategy)
13. [Definition of Done — MVP](#13-definition-of-done--mvp)

---

## 1. Product Goals

### Primary Problems

- Users struggle to understand true affordability when buying a car
- Confusion between lease vs. finance vs. cash purchase
- Lack of transparency in monthly payment breakdowns
- Overwhelming vehicle options with no personalization layer

### Goals

- Simplify car-buying decisions through guided, progressive filtering
- Provide clear, explainable, and defensibly accurate cost estimates
- Deliver AI-assisted narrative insights that increase user confidence — not replace professional advice

### Success Criteria

#### User-Facing
| Metric | Target |
|---|---|
| Time to filter & evaluate | < 2 minutes |
| Payment estimate accuracy | "Directionally accurate" (qualitative, within ~10% of dealer quotes) |
| AI explanation comprehension | Positive qualitative feedback in usability testing |

#### Technical
| Metric | Target |
|---|---|
| API response time (cached) | < 1.5s |
| Uptime (excluding third-party failures) | ≥ 95% |
| Architecture pattern | Modular; each feature is independently deployable |

---

## 2. User Personas & Use Cases

### Persona 1 — First-Time Buyer (Alex, 24)
- Limited financial literacy; unsure whether to lease or finance
- **Primary Need:** Guided flow with plain-language explanations
- **Key Feature:** AI narrative that demystifies interest rate impact and lease vs. finance trade-offs

### Persona 2 — Budget-Conscious Buyer (Maria, 35)
- Hard monthly budget constraint; wants maximum value within it
- **Primary Need:** Budget-first filter; clear monthly payment output
- **Key Feature:** Payment result ranked by monthly cost; total-cost-of-ownership callout

### Persona 3 — Enthusiast Shopper (David, 42)
- High automotive knowledge; values speed and data density
- **Primary Need:** Fast trim-level filtering and side-by-side payment comparison
- **Key Feature:** Skip guided flow; jump directly to vehicle comparison with raw numbers

---

## 3. Technical Architecture & Integration

### 3.1 System Overview

```
┌──────────────────────────────────────────────────────┐
│                    Next.js Frontend                   │
│  - Input Form  - Results Display  - AI Narrative UI  │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS + JWT Session Token
                        ▼
┌──────────────────────────────────────────────────────┐
│                   Python Backend (FastAPI)            │
│                                                      │
│  ┌─────────────────┐    ┌──────────────────────────┐ │
│  │  Payment Engine │    │  CarQuery API Adapter    │ │
│  │  (Deterministic)│    │  (Cached via Redis/File) │ │
│  └────────┬────────┘    └──────────────┬───────────┘ │
│           │                            │             │
│           └──────────┬─────────────────┘             │
│                      ▼                               │
│          ┌───────────────────────┐                   │
│          │  Context Packet Builder│                   │
│          └───────────┬───────────┘                   │
│                      │                               │
│                      ▼                               │
│          ┌───────────────────────┐                   │
│          │  LLM API (Claude)     │                   │
│          │  Explanation Only     │                   │
│          └───────────────────────┘                   │
└──────────────────────────────────────────────────────┘
```

### 3.2 PII & Sensitive Data Strategy

**Principle: Zero PII persistence. All sensitive inputs are ephemeral.**

| Data Point | Classification | Handling |
|---|---|---|
| Credit Score / Tier | Sensitive PII | Never stored. Mapped to a `credit_tier` enum at input boundary and discarded. |
| Monthly Budget | Sensitive PII | Held in JWT session payload only; expires with session. |
| ZIP Code | Quasi-PII | Used for tax rate lookup in-request; not stored. |
| `session_id` | Non-PII | UUID v4; no linkage to identity. Expires after 30 minutes of inactivity. |

#### Session Implementation

- **Mechanism:** Signed, short-lived JWT (HS256, 30-min expiry). No server-side session store for MVP.
- **Payload:** Contains only `session_id`, `credit_tier` (enum), and `zip_code`. Never raw credit score.
- **Transport:** `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Never exposed to client-side JavaScript.
- **Key Management:** JWT signing secret stored as environment variable (`JWT_SECRET`). Rotate on deploy.

```
# .env (never committed)
JWT_SECRET=<256-bit-random-hex>
```

> **MVP Constraint:** No user accounts, no database persistence of user inputs. If persistent history is required post-MVP, implement a proper auth layer (e.g., Auth0) before storing any PII.

### 3.3 CarQuery API Integration — Hierarchical Data Flow

CarQuery exposes car data as a strict hierarchy. All calls must follow this sequence.

```
Step 1: /api/years        → Returns available model years
Step 2: /api/makes        → Filtered by year
Step 3: /api/models       → Filtered by year + make
Step 4: /api/trims        → Filtered by year + make + model
         └─ Returns: MSRP, body style, engine specs (used to seed Vehicle entity)
```

#### Adapter Implementation Notes

```python
# Pseudocode — CarQuery Adapter (Python)

class CarQueryAdapter:
    BASE_URL = "https://www.carqueryapi.com/api/0.3/"

    def get_makes(self, year: int) -> list[dict]:
        # Check cache first (see Section 6)
        # GET ?cmd=getMakes&year={year}&sold_in_us=1
        pass

    def get_trims(self, year: int, make: str, model: str) -> list[dict]:
        # GET ?cmd=getTrims&year={year}&make={make}&model={model}
        # Extract: model_msrp, make_display, model_name, model_trim
        pass
```

- Filter `sold_in_us=1` on all make/model requests to restrict to US market vehicles.
- `model_msrp` from the trims endpoint seeds the `Vehicle.msrp` field.
- Treat missing `model_msrp` as `null`; surface a UI disclaimer: *"MSRP unavailable — enter manually."*

### 3.4 Orchestration Sequence (Request Lifecycle)

This is the authoritative order of operations for every payment estimation request.

```
1.  User submits input form (Next.js)
     └─ Input: year, make, model, trim, down_payment, zip_code, credit_tier, term, purchase_type

2.  Next.js validates input client-side (Zod schema)
     └─ On success: POST /api/estimate  (sends JWT cookie + JSON body)

3.  Python Backend receives request
     ├─ Validates JWT; extracts session_id, credit_tier
     ├─ Maps credit_tier → interest_rate_range (see Section 7)
     └─ Validates input against server-side schema

4.  Payment Engine runs deterministic math
     ├─ Calculates: finance_payment, lease_payment, total_cost_finance, total_cost_lease
     └─ Returns: PaymentResult entity (see Section 5)

5.  CarQuery Adapter fetches vehicle data
     ├─ Checks Redis/file cache (TTL: 24h)
     ├─ On cache miss: calls CarQuery API → caches response
     └─ Returns: Vehicle entity enriched with MSRP and trim data

6.  Context Packet Builder assembles the LLM prompt payload
     └─ Combines: PaymentResult + Vehicle + UserInput (sanitized, no raw PII)

7.  LLM API call (Claude)
     ├─ System prompt: "You are a car-buying advisor. Explain the following payment
     │   data in plain language. Do not recalculate. Do not provide financial advice."
     ├─ User prompt: <Context Packet JSON>
     └─ Returns: narrative explanation string only

8.  Backend assembles final response
     └─ Returns: { vehicle, paymentResult, aiNarrative }

9.  Next.js renders results
     ├─ Deterministic numbers displayed in result card (labeled as "Calculated Estimate")
     └─ AI narrative displayed in separate UI section (labeled "✦ AI Explanation")
```

### 3.5 Caching Strategy

**Target:** Minimize CarQuery API calls; vehicle data changes at most daily.

#### Option A — Redis (Recommended for scalability)
```python
import redis, json, hashlib

r = redis.Redis(host="localhost", port=6379, decode_responses=True)
TTL_SECONDS = 86400  # 24 hours

def cache_key(endpoint: str, params: dict) -> str:
    param_hash = hashlib.md5(json.dumps(params, sort_keys=True).encode()).hexdigest()
    return f"carquery:{endpoint}:{param_hash}"

def get_cached(key: str) -> dict | None:
    val = r.get(key)
    return json.loads(val) if val else None

def set_cached(key: str, data: dict):
    r.setex(key, TTL_SECONDS, json.dumps(data))
```

#### Option B — File-Based Cache (Solo dev / low-traffic MVP fallback)
```python
import json, os, time
from pathlib import Path

CACHE_DIR = Path(".cache/carquery")
TTL_SECONDS = 86400

def get_file_cached(key: str) -> dict | None:
    path = CACHE_DIR / f"{key}.json"
    if path.exists() and (time.time() - path.stat().st_mtime) < TTL_SECONDS:
        return json.loads(path.read_text())
    return None
```

> **Decision:** Use **Option B** for MVP (zero infrastructure dependency). Migrate to **Option A** (Redis) at first sign of latency issues or multi-instance deployment.

---

## 4. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR, API routes, Vercel-native |
| Backend | Python 3.11 + FastAPI | Type safety, async, easy testing |
| Validation | Zod (frontend) + Pydantic (backend) | Schema-first, dual-layer validation |
| AI | Anthropic Claude API | Instruction-following, safe defaults |
| Cache | File-based (MVP) → Redis (post-MVP) | Progressive complexity |
| Session | JWT (HS256, HttpOnly cookie) | Stateless, PII-safe |
| Hosting | Vercel (frontend) + Railway/Fly.io (backend) | Solo-dev-friendly deployment |
| Testing | Pytest (backend) + Vitest (frontend) | Fast, ergonomic |

---

## 5. Data Modeling Schema

All schemas defined in JSON Schema format. Pydantic models (backend) and Zod schemas (frontend) are derived from these.

### 5.1 Vehicle Entity

```json
{
  "$schema": "Vehicle",
  "properties": {
    "make":                    { "type": "string",  "example": "Toyota" },
    "model":                   { "type": "string",  "example": "Camry" },
    "year":                    { "type": "integer", "minimum": 1990, "maximum": 2026 },
    "trim":                    { "type": "string",  "example": "XLE V6", "nullable": true },
    "msrp":                    { "type": "number",  "minimum": 0, "nullable": true,
                                  "description": "Manufacturer Suggested Retail Price in USD. Null if unavailable from CarQuery." },
    "estimated_residual_value": { "type": "number", "minimum": 0, "nullable": true,
                                  "description": "Estimated residual for lease calc. Derived as msrp * residual_pct. Null if msrp is null." }
  },
  "required": ["make", "model", "year"]
}
```

> **Residual Value Estimation:** In the absence of a live residual feed, use the industry-standard approximation: `estimated_residual_value = msrp * residual_pct`, where `residual_pct` is sourced from a static lookup table by segment (e.g., sedan=0.52, SUV=0.55, truck=0.58 for a 36-month term). Surface this assumption in the UI.

### 5.2 UserInput Entity

```json
{
  "$schema": "UserInput",
  "properties": {
    "session_id":    { "type": "string", "format": "uuid",
                       "description": "UUID v4. Generated server-side. Not linked to identity." },
    "credit_tier":   { "type": "string",
                       "enum": ["excellent", "good", "fair", "poor"],
                       "description": "Mapped from raw credit score at input boundary. Score is discarded." },
    "zip_code":      { "type": "string", "pattern": "^[0-9]{5}$",
                       "description": "Used for sales tax estimation only. Not stored." },
    "monthly_budget": { "type": "number", "minimum": 0, "nullable": true,
                        "description": "Optional budget filter in USD/month." },
    "down_payment":  { "type": "number", "minimum": 0 },
    "loan_term_months": { "type": "integer", "enum": [24, 36, 48, 60, 72, 84] },
    "purchase_type": { "type": "string", "enum": ["finance", "lease", "both"] }
  },
  "required": ["session_id", "credit_tier", "down_payment", "loan_term_months", "purchase_type"]
}
```

#### Credit Tier → Interest Rate Mapping (Static Lookup, MVP)

| `credit_tier` | Score Range (Approx.) | Finance APR Range | Lease Money Factor Range |
|---|---|---|---|
| `excellent`   | 750+                  | 4.5% – 6.0%       | 0.00100 – 0.00150        |
| `good`        | 700–749               | 6.0% – 8.5%       | 0.00150 – 0.00200        |
| `fair`        | 650–699               | 8.5% – 12.0%      | 0.00200 – 0.00280        |
| `poor`        | < 650                 | 12.0% – 18.0%     | 0.00280 – 0.00400        |

> **Implementation Note:** Use the **midpoint** of the APR range for calculations. Surface the full range in the UI with the disclaimer: *"Actual rate determined by lender."*

### 5.3 PaymentResult Entity

```json
{
  "$schema": "PaymentResult",
  "properties": {
    "finance_monthly_payment": { "type": "number", "description": "USD/month" },
    "finance_total_cost":      { "type": "number", "description": "Total paid over loan term including interest, USD" },
    "lease_monthly_payment":   { "type": "number", "nullable": true, "description": "USD/month. Null if purchase_type=finance." },
    "lease_total_cost":        { "type": "number", "nullable": true, "description": "Total paid over lease term, USD" },
    "interest_rate_applied":   { "type": "number", "description": "Midpoint APR used for calculation, as decimal (e.g., 0.065)" },
    "money_factor_applied":    { "type": "number", "nullable": true, "description": "Midpoint money factor used for lease calc" },
    "loan_term_months":        { "type": "integer" },
    "down_payment_applied":    { "type": "number" },
    "sales_tax_rate":          { "type": "number", "nullable": true, "description": "Estimated rate by ZIP. Null if lookup fails." },
    "calculation_timestamp":   { "type": "string", "format": "date-time" }
  },
  "required": ["finance_monthly_payment", "finance_total_cost", "interest_rate_applied", "loan_term_months"]
}
```

---

## 6. API Integration Strategy

### CarQuery API
- **Auth:** None required (public API)
- **Rate Limiting:** Implement client-side throttling (max 5 req/sec) as a courtesy
- **Error Handling:**
  - `404 / empty result` → Return `null` MSRP; surface manual entry fallback in UI
  - `5xx / timeout` → Return cached data if available; else surface "Vehicle data temporarily unavailable" error state (do not block payment calculation)
- **Cache TTL:** 24 hours (vehicle specs don't change intraday)
- **Stale Data:** If cache is between 24h–48h old and a fresh fetch fails, serve stale data with a UI indicator: *"Vehicle data may be outdated."*

### LLM (Claude) API
- **Auth:** `ANTHROPIC_API_KEY` environment variable. Never exposed to frontend.
- **Model:** Use latest available Sonnet model for cost/quality balance
- **Max Tokens:** 400 (narrative only — no calculations)
- **Temperature:** 0.3 (factual, low-variance explanations)
- **Timeout:** 10 seconds. On timeout: return `null` for `aiNarrative`; UI renders without AI section silently
- **Retry:** 1 retry with 2-second backoff on 5xx. No retry on 4xx (bad input)
- **System Prompt Template:**

```
You are a helpful car-buying advisor. You will receive structured data about 
a vehicle and estimated monthly payments. Your job is to explain this data 
in plain, friendly language for a consumer.

Rules:
- Do NOT recalculate or alter any numbers
- Do NOT provide investment or financial planning advice  
- Do NOT recommend specific lenders or dealers
- Explain trade-offs between finance and lease options clearly
- Keep response under 150 words
- Always acknowledge that estimates may differ from dealer quotes
```

---

## 7. Payment Estimation Logic

### Finance Payment (Standard Amortization)

```
Variables:
  P  = Vehicle MSRP − down_payment + estimated_taxes_fees
  r  = annual_interest_rate / 12  (monthly rate)
  n  = loan_term_months

Formula:
  monthly_payment = P × [r(1+r)^n] / [(1+r)^n − 1]
  total_cost      = (monthly_payment × n) + down_payment
```

### Lease Payment (Standard Money Factor Method)

```
Variables:
  MSRP          = Vehicle MSRP
  residual      = estimated_residual_value  (MSRP × residual_pct)
  cap_cost      = MSRP − down_payment
  depreciation  = (cap_cost − residual) / loan_term_months
  finance_charge = (cap_cost + residual) × money_factor

Formula:
  base_payment  = depreciation + finance_charge
  monthly_payment = base_payment × (1 + sales_tax_rate)
  total_cost    = (monthly_payment × loan_term_months) + down_payment
```

### Tax & Fee Estimation (MVP Approximation)
- Use ZIP code → state lookup table for sales tax rate
- Apply flat 2% documentation/registration fee estimate on MSRP
- Label all tax/fee figures as *"Estimated — verify with dealer"*

---

## 8. AI Features Design

### Core Constraint: AI Explains, Never Calculates

The LLM receives a read-only "Context Packet" and returns narrative text only. All financial figures in the UI originate from the deterministic Payment Engine.

### Context Packet Structure (sent to LLM)

```json
{
  "vehicle": {
    "year": 2024,
    "make": "Honda",
    "model": "CR-V",
    "trim": "EX-L",
    "msrp": 35000
  },
  "payment_result": {
    "finance_monthly_payment": 612,
    "lease_monthly_payment": 389,
    "interest_rate_applied": 0.065,
    "loan_term_months": 60,
    "down_payment_applied": 3000
  },
  "user_context": {
    "credit_tier": "good",
    "purchase_type": "both"
  }
}
```

> **PII Guard:** `zip_code`, `monthly_budget`, and `session_id` are **never** included in the LLM context packet.

### UI Rendering Rules

- AI narrative must be visually distinct from calculated data (different background, icon prefix `✦ AI Explanation`)
- Always append: *"This explanation is AI-generated and for informational purposes only."*
- If `aiNarrative` is `null` (timeout/error): silently hide the AI section — do not surface an error

---

## 9. UX / UI Considerations

### Input Flow (Progressive Disclosure)

```
Step 1: Purchase Type    → Finance / Lease / Both
Step 2: Vehicle Selection → Year → Make → Model → Trim (cascading dropdowns)
Step 3: Financial Inputs  → Down Payment, Term, Credit Tier, ZIP, Budget (optional)
Step 4: Results           → Payment cards + AI Narrative
```

- Each step validates before progressing; never show a blank dropdown
- "Back" navigation preserves prior inputs (Next.js state or URL params)
- Mobile-first layout; all inputs accessible without horizontal scroll

### Results Display

- **Payment Card:** Calculated figures prominently displayed with methodology tooltip
- **AI Narrative:** Below payment card, visually separated, clearly labeled as AI-generated
- **Disclaimer Banner:** Sticky footer on results page (see Section 10)
- **Comparison Mode:** Side-by-side finance vs. lease (when `purchase_type = "both"`)

---

## 10. Risk Mitigation & Legal

### 10.1 Liability Buffer — "Estimate Only" Disclaimer

**Requirement:** Displayed in two mandatory locations:

1. **Global UI Footer (all pages):**
> *"CarLy provides payment estimates for informational purposes only. All figures are approximations based on publicly available data and user-provided inputs. Actual payments, rates, and terms are determined by lenders and dealers and may differ significantly. CarLy is not a licensed financial advisor, broker, or lender."*

2. **Each Result Card (inline):**
> *"Estimated only — verify with your dealer or lender before making any financial decision."*

**Implementation:** Both disclaimers must be rendered server-side (not injected by JavaScript) to ensure they appear even if client-side rendering fails.

### 10.2 Terms of Use — Click-Wrap Agreement

**Requirement:** A click-wrap agreement must be accepted before the user can submit their first estimation request.

- **Trigger:** Displayed as a modal or inline gate on first load (before any form is shown)
- **Mechanism:** Checkbox: *"I understand that CarLy provides estimates only and is not a substitute for professional financial advice."* + "Continue" button
- **Persistence:** Acceptance state stored in `sessionStorage` only. Not persisted across browser sessions (user must re-accept on each new session)
- **Content must include:**
  - Nature of estimates (approximations, not guarantees)
  - No financial advice is provided or implied
  - User assumes all risk for decisions made based on this tool
  - Data handling summary (no PII stored beyond the session)

> **Legal Note:** Consult a lawyer before launch to review click-wrap language for enforceability in your target jurisdictions.

### 10.3 AI Transparency — Labeling Requirement

All AI-generated text must be:

| Requirement | Implementation |
|---|---|
| Labeled as AI-generated | Prefix label: `✦ AI Explanation` |
| Visually distinct from calculated data | Different background color / border; never same card as numbers |
| Accompanied by a disclaimer | *"This explanation is AI-generated and for informational purposes only."* |
| Non-authoritative | Never present AI text as a recommendation or guarantee |

**Anti-pattern to avoid:** Do not mix AI narrative text inside a payment result card in a way that could be interpreted as an AI-validated figure.

### 10.4 Additional Risk Mitigations

| Risk | Mitigation |
|---|---|
| CarQuery API downtime | 24h file cache; degrade gracefully (show "MSRP unavailable") |
| LLM hallucination in narrative | LLM receives pre-calculated numbers; prompt instructs "do not recalculate" |
| Misleading residual estimates | Clearly labeled as "estimated" with segment-based methodology disclosed |
| User over-reliance on estimates | Click-wrap + persistent disclaimer + per-card caveat |
| JWT secret exposure | Stored as env variable; never committed; rotate on each deploy |

---

## 11. Roadmap

### Phase 1 — MVP (Target: 6–8 weeks)
- [ ] Cascading vehicle selector (Year → Make → Model → Trim via CarQuery)
- [ ] Finance + Lease payment calculation engine
- [ ] Credit tier → interest rate mapping
- [ ] File-based CarQuery cache (24h TTL)
- [ ] LLM narrative integration (Claude API)
- [ ] Click-wrap terms gate
- [ ] Disclaimer footer + result card caveats
- [ ] Mobile-responsive UI (Next.js)

### Phase 2 — Enhancements (Post-MVP)
- [ ] Side-by-side multi-vehicle comparison
- [ ] ZIP-code-based sales tax lookup (live API)
- [ ] Redis cache migration
- [ ] User-facing "How we calculate this" explainer page
- [ ] Dealer locator integration (third-party API TBD)

### Phase 3 — Scaling
- [ ] Rate limiting (per-IP) on estimation endpoint
- [ ] Monitoring + alerting (Sentry, Uptime Robot)
- [ ] A/B test AI narrative formats
- [ ] SEO-optimized make/model landing pages

### Phase 4 — Advanced
- [ ] User accounts with saved estimates (requires full auth + PII compliance review)
- [ ] Live rate feeds (lender API integration)
- [ ] Pre-qualification flow (soft credit pull, requires licensed partner)

---

## 12. Testing Strategy

### Unit Tests (Pytest — Backend)
- Payment Engine: Assert amortization formula output against known-good values from financial calculators (e.g., Bankrate)
- Lease formula: Validate against at least 3 published dealer lease examples
- Credit tier mapping: All four tiers → correct APR midpoint
- Cache: TTL expiry, cache hit/miss, stale data fallback

### Integration Tests
- CarQuery adapter: Mock HTTP layer; test hierarchy (year → make → model → trim)
- LLM integration: Mock Anthropic API; assert context packet structure is correct
- End-to-end request lifecycle: POST `/api/estimate` → assert `PaymentResult` + `aiNarrative` shape

### Validation Tests
- Compare finance output against: Bankrate Auto Loan Calculator, NerdWallet
- Compare lease output against: Edmunds Lease Calculator
- Target: Within ±3% for identical inputs (accounting for tax/fee estimation variance)

### Frontend Tests (Vitest + React Testing Library)
- Zod schema validation on all form inputs
- Click-wrap gate blocks form submission when not accepted
- Disclaimer text renders on result page
- AI narrative section renders with correct label; hidden when `aiNarrative` is null

---

## 13. Definition of Done — MVP

The MVP is considered complete when **all** of the following criteria are met:

### Functional
- [ ] User can select a vehicle via cascading dropdowns (Year → Make → Model → Trim)
- [ ] Finance monthly payment is calculated correctly (within ±3% of reference calculators)
- [ ] Lease monthly payment is calculated correctly (within ±3% of reference calculators)
- [ ] AI narrative is returned and rendered for all successful estimations
- [ ] AI narrative is silently hidden (no error shown) when LLM call fails or times out

### Legal & Compliance
- [ ] Click-wrap agreement gate is present and blocks access until accepted
- [ ] "Estimate Only" disclaimer renders in the global footer on all pages
- [ ] Each payment result card displays its inline caveat
- [ ] All AI-generated text is labeled `✦ AI Explanation` with accompanying disclaimer
- [ ] No raw credit score or budget value is logged anywhere (verified by log audit)

### Security
- [ ] JWT is stored as `HttpOnly`, `Secure`, `SameSite=Strict` cookie
- [ ] `JWT_SECRET` and `ANTHROPIC_API_KEY` are env variables; absent from version control
- [ ] No PII fields appear in server logs (log sanitization confirmed)

### Performance
- [ ] Cached responses return in < 1.5 seconds (p95)
- [ ] Cache correctly invalidates after 24-hour TTL

### Quality
- [ ] Unit tests pass for all Payment Engine formulas
- [ ] Integration tests pass for CarQuery adapter and LLM context packet
- [ ] No critical or high-severity issues in a manual QA pass on mobile + desktop
