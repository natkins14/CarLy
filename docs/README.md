# CarLy — AI-Powered Car Payment Estimator

> **Radical transparency** about what was built, how it was built, and where AI helped — and hurt.

[![CI](https://img.shields.io/github/actions/workflow/status/carly-app/carly/ci.yml?branch=main&label=CI)](../../actions)
[![Coverage](https://img.shields.io/badge/DCS_coverage-100%25-brightgreen)](docs/TESTING.md)
[![Security](https://img.shields.io/badge/security-policy-blue)](docs/SECURITY.md)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Architectural Blueprint](#2-architectural-blueprint)
3. [The AI Stack & Workflow Transparency](#3-the-ai-stack--workflow-transparency)
4. [Engineering Retrospective](#4-engineering-retrospective)
5. [Documentation Map](#5-documentation-map)
6. [Quick Start](#6-quick-start)
7. [Contributing](#7-contributing)

---

## 1. Project Identity

### Executive Summary

CarLy is a **stateless, session-scoped car payment estimator** operating at the intersection of consumer fintech and automotive data. It answers a single, high-stakes question: *"Can I actually afford this car, and should I finance or lease it?"* — in under 90 seconds, without storing a single byte of PII.

**Target industries:** Consumer Fintech · Automotive Retail · AI-Augmented Financial Tools

**Core value proposition:**

| Problem | CarLy's Answer |
|---------|----------------|
| Dealership payment estimates are opaque and adversarial | Deterministic math, open formulas, labeled estimates |
| Users don't understand finance vs. lease trade-offs | AI narrative explains the delta in plain language |
| Credit score inputs feel invasive | Score is mapped to a tier enum and discarded mid-request |
| Financial tools require account creation | Session-only; zero persistence; JWT expires in 30 minutes |

**What CarLy is not:** a lender, a broker, a recommendation engine, or a data aggregator. Every output carries a mandatory "Non-Binding Estimate" label enforced at the server-render layer.

---

### Technical Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Frontend | Next.js (App Router) | 14.2.x | SSR, progressive form, results display |
| UI Validation | Zod | 3.x | Client-side schema enforcement |
| Form State | React Hook Form | 7.x | Step-scoped form orchestration |
| Backend | FastAPI | 0.115.x | REST API, orchestration, JWT issuance |
| Runtime | Python | 3.11 | DCS, CarQuery adapter, AI service |
| Data Validation | Pydantic | v2 | Server-side schema mirror of Zod |
| Auth | PyJWT (HS256) | 2.8.x | Stateless session tokens |
| AI | Anthropic Claude API | claude-3-5-sonnet-latest | Narrative explanation only |
| Vehicle Data | NHTSA vPIC / CarQuery API | — | Cascading make/model/trim data |
| Hosting (FE) | Vercel | — | Edge CDN, SSR, middleware rate limiting |
| Hosting (BE) | Railway / Fly.io | — | Single-process FastAPI deployment |
| Cache | Filesystem (`.cache/carquery/`) | — | Stale-While-Revalidate, MVP-grade |
| Testing (BE) | pytest + pytest-cov | 8.3.x | Unit, integration, coverage gates |
| Testing (FE) | Vitest + Playwright | — | Unit (Zod/React), E2E (5 critical flows) |

---

## 2. Architectural Blueprint

### System Design Summary

CarLy is a **Stateless Micro-Monolith** — a deliberate choice for a solo-developer MVP. A single FastAPI process with internally well-separated modules sits behind a Next.js frontend. No microservices, no service mesh, no distributed tracing overhead. See [`docs/architecture.md`](docs/architecture.md) for the full technical north star.

```
┌─────────────────────────────────────────────────────────────────┐
│  Vercel Edge Network                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Next.js 14 (App Router — SSR)                         │   │
│  │  Progressive 4-Step Form → Results → AI Insights       │   │
│  │  SSR-rendered disclaimers (never JS-injected)          │   │
│  └──────────────────────┬──────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTPS + HttpOnly JWT Cookie
                          │ POST /api/estimate
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Railway / Fly.io                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  FastAPI (Python 3.11)                                  │   │
│  │                                                         │   │
│  │  ┌─────────────────┐   ┌──────────────────────────┐   │   │
│  │  │  DCS (Pure Fn.) │   │  CarQuery/NHTSA Adapter  │   │   │
│  │  │  No I/O. Ever.  │   │  File Cache + SWR        │   │   │
│  │  └────────┬────────┘   └──────────┬───────────────┘   │   │
│  │           └──────────┬────────────┘                    │   │
│  │                      ▼                                 │   │
│  │          ┌───────────────────────┐                     │   │
│  │          │  Context Packet Builder│  ← PII stripped     │   │
│  │          └───────────┬───────────┘                     │   │
│  │                      ▼                                 │   │
│  │          ┌───────────────────────┐                     │   │
│  │          │  Anthropic Claude API │  ← Explains only     │   │
│  │          └───────────────────────┘                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Architectural Invariant

> **Deterministic logic calculates. AI explains. PII is never persisted.**

This is not a design philosophy — it is an enforced technical constraint. The DCS module (`src/services/dcs.py`) has zero I/O imports. The LLM receives a serialized JSON string; it cannot call DCS functions. The Context Packet Builder has an explicit exclusion list for PII fields, asserted in integration tests.

---

### Data Flow: Vehicle Data → Financial Output

```
User Input (Step 2)          User Input (Steps 1, 3)
  year / make / model          budget, credit_score,
  vehicle_price (manual)       zip_code, loan_term
        │                              │
        ▼                              ▼
  GET /api/cars/              POST /api/session/init
  NHTSA vPIC API    ──────►   JWT issued (credit_tier,
  File Cache (SWR)            zip_code embedded)
        │                              │
        └──────────────┬───────────────┘
                       ▼
              POST /api/estimate
                       │
          ┌────────────▼────────────┐
          │  Pydantic validation    │  ← credit_score → credit_tier, discarded
          │  JWT middleware         │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  CarService.resolve()   │  ← MSRP required (manual entry MVP)
          │  VehicleRecord returned │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  DCS: build_tax_estimate│  ← ZIP → state tax rate (static table)
          │  DCS: calculate_finance │  ← Decimal(ROUND_HALF_UP) throughout
          │  DCS: calculate_lease   │  ← money_factor, residual_pct from tier
          │  PaymentResult (frozen) │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Context Packet Builder │  ← Strips PII; sanitizes strings
          │  Anthropic API call     │  ← 10s timeout; silent fail
          │  Hallucination guard    │  ← Number grounding check
          └────────────┬────────────┘
                       │
                       ▼
              EstimateResponse → Frontend
              PaymentCards (immediate)
              AI Insights (async / null-safe)
```

**Key isolation boundaries:**

- The DCS receives no network clients, no cache objects, no LLM references.
- The LLM receives no raw financial inputs — only the computed `PaymentResult`.
- The frontend performs zero calculations; it is a pure render layer.

---

### Resilience Design

| Failure Mode | Behavior | Source |
|---|---|---|
| CarQuery/NHTSA cold failure | HTTP 503 + manual MSRP input field | [`src/services/car_service.py`](src/services/car_service.py) |
| Stale cache (24–48h) | Serve stale + UI banner with timestamp | SWR zone logic in `CarService` |
| Anthropic timeout (>10s) | `aiNarrative = null`; AI section hidden | [`src/services/ai_service.py`](src/services/ai_service.py) |
| LLM hallucination detected | Narrative discarded; `LLM_HALLUCINATION_DETECTED` logged | `response_numbers_are_grounded()` |
| JWT expired | HTTP 401 → frontend resets to Step 1 | [`src/auth/session.py`](src/auth/session.py) |
| Frontend latency >3s | Fallback spinner; request continues | `useEffect` timer in `EstimateForm` |

---

## 3. The AI Stack & Workflow Transparency

### Model Taxonomy

| Model | Provider | Domain | Usage Pattern |
|-------|----------|--------|---------------|
| **claude-3-5-sonnet-latest** | Anthropic | Payment narrative generation | Single-turn; max 400 tokens; temp 0.3 |
| **Claude Sonnet 4.6** | Anthropic (Claude.ai) | SDLC assistance — architecture docs, code generation, test scaffolding, this README | Interactive multi-turn sessions |

**What the production model does not do:**

- It does not calculate. The system prompt explicitly states: *"Do NOT recalculate or alter any numbers."*
- It does not access vehicle data. It receives a pre-computed, sanitized context packet.
- It does not persist context between requests. Every call is stateless.

**Why Sonnet and not Opus or a cheaper model:**

- Haiku: Insufficient instruction-following for the numeric constraint (hallucination rate too high in testing).
- Opus: Cost-prohibitive for per-estimate API calls at scale.
- Sonnet: Reliable instruction adherence at acceptable cost; the ±400-token output ceiling further constrains risk.

---

### Prompt Evolution: From Naive to Structured

The production system prompt went through four distinct generations:

**Generation 1 — Naive (rejected):**
```
Explain this car payment data: {data}
```
*Problem:* Model frequently recalculated totals, introduced different APR assumptions, and used hedging language that undermined user confidence.

**Generation 2 — Constraint-added (partially rejected):**
```
Explain this car payment data. Don't change the numbers. Keep it short.
```
*Problem:* "Don't change the numbers" was ignored in ~15% of test runs. The model reframed totals using different arithmetic paths. No explicit role anchor.

**Generation 3 — Role-anchored with negative constraints:**
```
You are a helpful car-buying advisor. Explain the payment data in plain language.
Rules: Do NOT recalculate. Do NOT recommend lenders. Do NOT use "you should."
Keep under 150 words. Acknowledge dealer quotes may differ.
```
*Problem:* Better, but the model occasionally introduced segment-level residual assumptions not present in the data. No post-generation validation existed yet.

**Generation 4 — Production (current):**
```
You are a helpful car-buying advisor. Explain the provided payment estimate
in plain language. Do not recalculate any numbers. Do not recommend a lender,
dealer, or a financial product. Keep the response under 150 words and
acknowledge that dealer quotes may differ.
```
Paired with `response_numbers_are_grounded()` — a post-generation validator that extracts all numeric tokens from the LLM response and verifies each against the context packet JSON. Any ungrounded number triggers `aiNarrative = null` and a `LLM_HALLUCINATION_DETECTED` log event.

**The breakthrough:** Separating prompt constraints (what the model must not do) from post-generation validation (what we assert after the fact) proved more robust than trying to make the prompt exhaustive. The prompt handles intent; the validator handles correctness.

---

### Human-in-the-Loop: Three AI Rejection Events

The following are documented instances where AI-generated output was rejected or substantially refactored due to security or logic failures. These are not edge cases — they are representative of the review discipline required throughout the build.

---

**Rejection #1 — JWT Cookie Security Downgrade**

*Context:* AI-generated session initialization code returned the JWT in the JSON response body alongside setting the cookie, "for developer convenience during testing."

*Problem:* This violated the core security invariant documented in [`docs/SECURITY.md`](docs/SECURITY.md) — the JWT must never be accessible to client-side JavaScript. A JSON-body token is readable by any script on the page, defeating the `HttpOnly` cookie's XSS protection entirely.

*Resolution:* The JSON body response was stripped to return only `SessionClaims` (non-secret metadata). The token is set exclusively via `response.set_cookie()` with `httponly=True`. A regression test was added: `assert "token" not in r.json()`.

*Root cause of AI error:* The model optimized for developer ergonomics (easy token inspection in Postman) without modeling the browser security threat surface.

---

**Rejection #2 — DCS Float Arithmetic (Hallucinated Precision)**

*Context:* Initial AI-generated `calculate_finance()` used Python native `float` throughout, producing outputs like `monthly_payment = 597.5800000000001`.

*Problem:* IEEE 754 floating-point drift in financial calculations is a P0 defect per the project's [defect classification policy](docs/TESTING.md#defect-classification). The ACID-equivalent consistency check (`total_cost == monthly × n + down_payment`) failed by $0.03–$0.18 depending on inputs.

*Resolution:* Full rewrite using Python `Decimal` with `ROUND_HALF_UP` throughout. Float conversion deferred to serialization time only. The DCS module now has a 100% branch coverage gate in CI — any regression in the calculation path fails the pipeline immediately.

*Root cause of AI error:* The model generated syntactically correct Python financial code that matches tutorial-grade examples. It did not account for the precision requirements of a production fintech context.

---

**Rejection #3 — LLM Context Packet PII Leakage**

*Context:* First-pass Context Packet Builder included `zip_code` in the `user_context` field "to allow the AI to mention regional tax implications."

*Problem:* The architecture document, the security policy, and the core invariant all explicitly prohibit PII in the LLM context packet. ZIP code is quasi-PII; combined with credit tier and vehicle data, it narrows user identity. The Anthropic API logs requests — sending ZIP to a third-party API constitutes a data handling violation.

*Resolution:* `zip_code` added to the explicit exclusion list in `build_context_packet()`. Tax rate is included in `payment_result` as a computed float (e.g., `0.04`) with no geographic identifier. Integration test `test_context_packet_excludes_raw_credit_score()` extended to cover all five forbidden fields.

*Root cause of AI error:* The model made a locally reasonable optimization (richer context → better narrative) without modeling cross-system data flow or third-party data handling obligations.

---

## 4. Engineering Retrospective

### The "AI-Free" Counterfactual

If CarLy had been built without AI assistance, the realistic delta across the SDLC:

| Phase | AI-Assisted Actual | Estimated AI-Free | Delta |
|-------|-------------------|-------------------|-------|
| Architecture documentation | 2 days | 5–7 days | −4 days |
| Pydantic/Zod schema mirroring | 3 hours | 1.5 days | −1 day |
| Test scaffolding (pytest/Vitest) | 4 hours | 3–4 days | −3 days |
| SECURITY.md + TESTING.md | 2 hours | 3 days | −2.5 days |
| DCS formula implementation | 6 hours | 6 hours | ~0 |
| Debugging AI-generated bugs | 8 hours | 0 hours | +8 hours |
| **Total estimated delta** | | | **~−12 days** |

**Honest caveat:** The 8-hour debugging overhead (JWT security flaw, float arithmetic, PII leakage) represents a real cost that is easy to undercount. Each bug required understanding what the AI had generated, why it was wrong, and how to validate the fix — a process that demands domain expertise that cannot itself be AI-generated.

---

### Net Impact Assessment

**Where AI accelerated meaningfully:**

- **Boilerplate elimination.** FastAPI route handlers, Pydantic models, Zod schemas — structurally predictable code where AI output required light review and minor adjustment. Estimated 60–70% time reduction on these tasks.
- **Documentation synthesis.** Converting architecture decisions already made into coherent Markdown (this README, `SECURITY.md`, `TESTING.md`) took hours instead of days. AI is a strong technical writer when given precise constraints.
- **Test scaffolding.** Generating parametrized pytest fixtures and Playwright skeleton tests from a spec. The logic is correct; the domain knowledge required to write the spec is not.
- **Cross-stack consistency.** Ensuring Pydantic and Zod schemas mirror each other exactly — a mechanical task the model handles well with explicit field-by-field instructions.

**Where AI degraded quality or added overhead:**

- **Security threat modeling.** The model consistently optimized for functionality over security posture. Every security boundary required explicit human specification and post-generation review. AI-generated security code should be treated as untrusted until audited.
- **Financial precision.** Tutorial-grade financial code looks correct and passes naive tests. Production-grade financial code requires domain knowledge (Decimal, ROUND_HALF_UP, consistency invariants) that the model does not spontaneously apply.
- **Comprehension debt.** AI-generated code that passes tests but contains subtle logic errors creates a category of debt that is harder to identify than traditional bugs. The developer must understand the code deeply enough to know what to distrust — which partially undermines the productivity gain.
- **Hallucinated dependencies.** Early sessions produced references to non-existent FastAPI middleware parameters and a `pydantic.v1` import path that had been removed in Pydantic v2. These required manual resolution and added friction disproportionate to the code volume involved.

**The honest conclusion:** AI is a strong force multiplier for a senior developer who can quickly distinguish correct output from plausible-looking incorrect output. It is a risk amplifier for a developer who cannot. The productivity gains in this project were real; so were the security and correctness regressions that required human domain expertise to catch.

---

## 5. Documentation Map

| Document | Location | Purpose |
|----------|----------|---------|
| **Architecture** | [`docs/architecture.md`](docs/architecture.md) | Authoritative technical north star. Component decomposition, data flow, security architecture, resilience design, constraint checklist. Reference this before modifying any service boundary. |
| **Planning** | [`docs/planning.md`](docs/planning.md) | Product goals, personas, payment estimation logic formulas, UX flow specification, risk mitigation strategy. MVP definition of done. |
| **Requirements** | [`docs/requirements2.0.md`](docs/requirements2.0.md) | Hardened functional and non-functional requirements. Authoritative source for FR and NFR constraints. Gherkin-style user stories. Legal compliance requirements (L1–L4). |
| **Security Policy** | [`docs/SECURITY.md`](docs/SECURITY.md) | Vulnerability reporting process, response SLA, responsible disclosure policy, safe harbor statement, regulatory compliance context (GLBA, CCPA, GDPR), security controls reference. |
| **Testing Strategy** | [`docs/TESTING.md`](docs/TESTING.md) | Multi-layer test strategy (unit/integration/E2E), DCS reference calculator tolerance gates, AI behavior testing patterns, CI/CD pipeline specification, defect classification. |
| **Environment Config** | [`.env.example`](.env.example) | All required environment variables with descriptions. Copy to `.env` and populate before running locally. |

---

## 6. Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- An Anthropic API key (AI narrative is optional — degrades gracefully to `null`)

### Backend

```bash
# Clone and configure
git clone https://github.com/your-org/carly.git
cd carly
cp .env.example .env
# Edit .env: set JWT_SECRET and optionally ANTHROPIC_API_KEY

# Install and run
pip install -r requirements.txt
cd src
uvicorn app:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: BACKEND_URL=http://localhost:8000

npm install
npm run dev
# → http://localhost:3000
```

### Tests

```bash
# Backend (from /src)
pytest tests/ -v --cov=services --cov=models --cov=auth --cov-fail-under=85

# DCS 100% gate
pytest tests/test_dcs.py --cov=services.dcs --cov-fail-under=100 --cov-branch

# Frontend
cd frontend && npx vitest run --coverage

# E2E (requires both servers running)
cd frontend && npx playwright test
```

---

## 7. Contributing

1. Read [`docs/architecture.md`](docs/architecture.md) before touching any service boundary.
2. The DCS (`src/services/dcs.py`) is a **pure function module**. No I/O. No exceptions.
3. All PII handling changes require a corresponding test in `TestContextPacketPIIStripping`.
4. Security vulnerabilities: see [`docs/SECURITY.md`](docs/SECURITY.md) — do not open public issues.
5. CI must pass all gates before merge. The DCS ±2% tolerance gate is non-negotiable.

---

*Built with precision, tested with rigor, and transparent about the AI that helped — and the humans who fixed it.*

*Last updated: May 2026*
