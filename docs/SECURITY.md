# Security Policy

> **CarLy** — AI-Powered Car Payment Estimator  
> Fintech × Automotive Data · Version Policy & Vulnerability Disclosure

---

## Table of Contents

1. [Supported Versions](#supported-versions)
2. [Security Architecture Overview](#security-architecture-overview)
3. [Known Risk Surface Areas](#known-risk-surface-areas)
4. [Reporting a Vulnerability](#reporting-a-vulnerability)
5. [Response SLA](#response-sla)
6. [Responsible Disclosure Policy](#responsible-disclosure-policy)
7. [Safe Harbor Statement](#safe-harbor-statement)
8. [Regulatory & Compliance Context](#regulatory--compliance-context)
9. [Security Controls Reference](#security-controls-reference)

---

## Supported Versions

Only the versions listed below receive active security patches and CVE responses. Older versions are unsupported and should be upgraded immediately.

| Version | Status              | Security Patches | Notes                              |
|---------|---------------------|------------------|------------------------------------|
| `1.x`   | ✅ **Active**       | Yes              | Current production branch          |
| `0.9.x` | ⚠️ **LTS Sunset**  | Critical only    | EOL 90 days from next major release|
| `< 0.9` | ❌ **Unsupported**  | No               | Upgrade immediately                |

> If you are running an unsupported version in a production or internet-facing environment, treat this as a **P0 risk** and upgrade before filing a bug report.

---

## Security Architecture Overview

CarLy is a **Stateless Micro-Monolith** composed of a Next.js 14 frontend (Vercel) and a FastAPI Python 3.11 backend (Railway/Fly.io). The following architectural invariants are security-critical:

### Core Invariants

| Invariant | Enforcement Mechanism |
|-----------|----------------------|
| **Zero PII Persistence** | No user database. Raw credit scores are mapped to a tier enum and discarded within the same request boundary. |
| **Deterministic Logic Calculates; AI Explains** | The Anthropic LLM receives a sanitized, read-only context packet. It cannot invoke calculation functions or modify financial outputs. |
| **Session-Scoped Data Only** | All sensitive inputs (`credit_score`, `zip_code`, `budget_value`) expire with the JWT (30-minute window). `HttpOnly; Secure; SameSite=Strict` cookies prevent XSS exfiltration. |
| **Server-Side Secret Isolation** | `ANTHROPIC_API_KEY` and `JWT_SECRET` never reach the client bundle or application logs. |
| **No Raw PII in LLM Context** | The Context Packet Builder explicitly excludes `zip_code`, `credit_score`, `budget_value`, and `session_id` before any Anthropic API call. |

---

## Known Risk Surface Areas

The following areas have elevated inherent risk due to the fintech and automotive data integration nature of CarLy. Security researchers should pay particular attention here.

### 1. JWT Session Management
- **Location:** `src/auth/session.py`
- **Risk:** Token forgery, replay attacks, or weak secret derivation.
- **Mitigations in place:** HS256 with environment-injected `JWT_SECRET`; 30-minute expiry; `HttpOnly`/`SameSite=Strict` cookie transport.
- **Researcher focus:** Secret rotation gaps on deploy; token replay within the expiry window; cookie exfiltration via CSRF.

### 2. Financial Calculation Integrity (DCS)
- **Location:** `src/services/dcs.py`
- **Risk:** Manipulation of deterministic payment outputs (APR injection, decimal rounding exploits, integer overflow via extreme inputs).
- **Mitigations in place:** Python `Decimal(ROUND_HALF_UP)` throughout; Pydantic field-level range constraints (`budget_value: gt=0, le=500_000`); Zod mirroring on the frontend.
- **Researcher focus:** Edge cases in amortization formula with `r=0`; lease formula with zero-MSRP or negative residual; bypass of Pydantic validators via crafted JSON.

### 3. AI Narrative Injection / Hallucination
- **Location:** `src/services/context_builder.py`, `src/services/ai_service.py`
- **Risk:** Prompt injection via vehicle `make`/`model`/`trim` strings; LLM hallucinating financial figures not present in the context packet.
- **Mitigations in place:** String sanitization (strip `\n---\n`, `Human:`, `Assistant:`, markdown headings); max 64-character field truncation; post-generation number grounding validation (`response_numbers_are_grounded`).
- **Researcher focus:** Unicode control characters bypassing the sanitization regex; adversarial vehicle names that escape the prompt boundary; crafted inputs that cause the grounding check to produce false positives.

### 4. Vehicle Data Integrity (CarQuery / NHTSA Adapter)
- **Location:** `src/services/car_service.py`
- **Risk:** Cache poisoning; SSRF via malformed API URLs; stale MSRP data silently propagating to financial calculations.
- **Mitigations in place:** File-based cache with SHA-based key derivation; Stale-While-Revalidate with explicit zone labeling; `sold_in_us=1` filter to reduce data surface area.
- **Researcher focus:** Path traversal in cache key generation; cache-zone boundary conditions allowing expired data to be served as fresh; SSRF if `CARQUERY_API_URL` is user-influenced.

### 5. Rate Limiting & Abuse
- **Location:** Vercel middleware (edge layer)
- **Risk:** Estimation endpoint abuse (cost amplification via Anthropic API calls; enumeration of vehicle pricing data).
- **Mitigations in place:** 20 requests/IP/hour on `/api/estimate`; 1,024-character payload size cap.
- **Researcher focus:** IP spoofing via `X-Forwarded-For` bypass; distributed low-rate abuse below the per-IP threshold; large-body DoS before the middleware intercepts.

### 6. Log & Telemetry PII Leakage
- **Location:** `src/app.py` (`RedactingFilter` middleware)
- **Risk:** Sensitive fields written to stdout logs, forwarded to log aggregators, or surfaced in error responses.
- **Mitigations in place:** `REDACTED_LOG_FIELDS = {"zip_code", "credit_score", "budget_value", "monthly_budget"}` applied to the root logger at startup; no stack traces in 500 responses to clients.
- **Researcher focus:** FastAPI background tasks that log before the filter attaches; Pydantic validation error objects echoing raw field values in the 400 response body.

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.** This exposes the flaw before a patch is available.

### Preferred Channel

| Method | Contact |
|--------|---------|
| 📧 Email (encrypted preferred) | `security@carly-app.io` |
| 🔑 PGP Key | Available at `https://carly-app.io/.well-known/security.txt` |
| 🐛 GitHub Private Advisory | [Security Advisories](../../security/advisories/new) (repo maintainers only) |

### What to Include

Please provide as much of the following as possible to accelerate triage:

1. **Vulnerability class** (e.g., OWASP Top 10 category, CWE ID)
2. **Affected component** (file path, endpoint, service name)
3. **Reproduction steps** — minimal, numbered, deterministic
4. **Proof of Concept** — code snippet, curl command, or screenshot (redact any real PII)
5. **Observed vs. expected behavior**
6. **Potential impact assessment** — your read on severity (CVSS v3.1 score if possible)
7. **Environment** — version, OS, browser/runtime if relevant

### What Happens Next

1. You receive an **automated acknowledgment** within 2 hours of submission.
2. A human triage response arrives within **24–48 hours** (see SLA below).
3. We open a private channel (encrypted email thread or GitHub Security Advisory) to coordinate.
4. You are credited in the release notes unless you prefer anonymity.

---

## Response SLA

| Severity | CVSS v3.1 Range | Initial Triage | Target Patch | Public Disclosure |
|----------|-----------------|----------------|--------------|-------------------|
| **Critical** | 9.0–10.0 | ≤ 4 hours | ≤ 72 hours | Coordinated with reporter |
| **High** | 7.0–8.9 | ≤ 24 hours | ≤ 7 days | 30 days post-patch |
| **Medium** | 4.0–6.9 | ≤ 48 hours | ≤ 30 days | 60 days post-patch |
| **Low** | 0.1–3.9 | ≤ 5 business days | Next release cycle | 90 days post-patch |
| **Informational** | N/A | ≤ 5 business days | Best effort | Researcher discretion |

> **Fintech/Automotive exception:** Any vulnerability affecting the financial calculation integrity of the DCS module (`src/services/dcs.py`) or enabling silent data falsification is automatically escalated to **Critical**, regardless of the raw CVSS score. Incorrect payment estimates carry direct consumer harm risk.

---

## Responsible Disclosure Policy

CarLy adheres to a **Coordinated Vulnerability Disclosure (CVD)** model aligned with [ISO/IEC 29147](https://www.iso.org/standard/72311.html) and the [CERT/CC Disclosure Policy](https://www.kb.cert.org/vuls/govpolicy/).

### Researcher Commitments (from CarLy)

- We will **not pursue legal action** against researchers acting in good faith under this policy.
- We will **acknowledge your contribution** publicly (with your consent) in the changelog and Hall of Fame.
- We will **keep you informed** of patch progress at agreed intervals.
- We will **not share your identity** with third parties without explicit consent.
- We commit to a **maximum 90-day embargo** from your report date. If we cannot patch within 90 days, we will negotiate an extension with you or proceed to limited disclosure.

### Researcher Responsibilities

- **Limit scope** to your own test accounts and synthetic data. Do not access, exfiltrate, or modify production user data.
- **Do not perform** denial-of-service testing, physical attacks, social engineering, or attacks on third-party services (CarQuery API, NHTSA, Anthropic).
- **Do not publicly disclose** the vulnerability before the coordinated disclosure date.
- **Do not exploit** a vulnerability beyond what is necessary to demonstrate its existence.
- **Operate in good faith** — the intent should be to improve security, not to extract value.

### Out of Scope

The following are explicitly **out of scope** and will not be treated as security vulnerabilities:

- Missing `Strict-Transport-Security` headers on development/staging environments
- Self-XSS or issues requiring physical access to an authenticated user's device
- Clickjacking on pages with no sensitive actions
- Vulnerabilities in third-party dependencies with no demonstrated exploitable path in CarLy
- Theoretical attacks without a working proof of concept
- Rate-limit bypass via single-digit-per-hour request differences
- Social engineering of CarLy staff or contractors
- Findings from automated scanners without manual validation

---

## Safe Harbor Statement

CarLy considers security research conducted under this policy to be **authorized activity**. We will not initiate or recommend legal action against researchers who:

- Discover and report vulnerabilities in accordance with this policy.
- Avoid intentional harm to CarLy users, infrastructure, or third-party services.
- Do not exfiltrate, alter, or destroy data beyond what is minimally necessary to demonstrate the vulnerability.
- Do not violate any applicable law beyond what is strictly incidental to good-faith security research.

If a third party initiates legal action against a researcher acting within this policy's scope, CarLy will make its position clear that the research was authorized.

> This Safe Harbor is not a blanket legal indemnification. It reflects our organizational commitment to supporting the security research community. We recommend researchers consult their own legal counsel when in doubt.

---

## Regulatory & Compliance Context

CarLy operates at the intersection of fintech and automotive data. The following regulatory frameworks are relevant to any reported vulnerability:

| Framework | Applicability | Key Risk Area |
|-----------|--------------|---------------|
| **GLBA (US)** | Financial data handling | Credit score tier data, payment estimate outputs |
| **CCPA (California)** | Consumer data rights | ZIP code, session data, browsing behavior |
| **GDPR (EU)** | If EU users are served | Right to erasure, data minimization |
| **NHTSA Data Standards** | Vehicle data integrity | MSRP accuracy, VIN-adjacent data |
| **SOC 2 Type II** | Post-MVP target | Availability, confidentiality, processing integrity |

> Vulnerabilities that could result in regulatory reporting obligations (e.g., a breach of credit score data, even in-session) will be treated as **Critical** and may require expedited disclosure timelines in accordance with applicable law.

---

## Security Controls Reference

A quick-reference index of security controls embedded in the codebase, for researcher orientation:

| Control | Location | Notes |
|---------|----------|-------|
| JWT issuance & validation | `src/auth/session.py` | HS256, 30-min TTL, `HttpOnly` cookie |
| PII redaction in logs | `src/app.py` (`RedactingFilter`) | Root logger; covers `zip_code`, `credit_score`, `budget_value` |
| Input validation (server) | `src/models/schemas.py` | Pydantic v2 with `field_validator` and `model_validator` |
| Input validation (client) | `frontend/lib/schemas.ts` | Zod with matching constraints |
| Context packet PII stripping | `src/services/context_builder.py` | Explicit exclusion before Anthropic call |
| LLM hallucination validation | `src/services/ai_service.py` | Number grounding check post-generation |
| Prompt injection sanitization | `src/services/context_builder.py` | Regex strip + 64-char field truncation |
| Rate limiting | Vercel edge middleware | 20 req/IP/hr on `/api/estimate` |
| CORS policy | `src/app.py` | Allowlist: `localhost:3000`, `localhost:8000` |
| Cache key integrity | `src/services/car_service.py` | MD5 hash suffix prevents path collision |
| DCS purity enforcement | `src/services/dcs.py` | No I/O imports; `Decimal(ROUND_HALF_UP)` throughout |
| Terms click-wrap gate | `frontend/components/TermsGate.tsx` | Session-scoped; `inert` on background content |
| SSR disclaimer rendering | `frontend/components/DisclaimerFooter.tsx` | Server-rendered; not JS-injectable |

---

*Last reviewed: May 2026 · Maintained by the CarLy Security Team · `security@carly-app.io`*
