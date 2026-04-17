# CarLy -- Planning Document

## 1. Product Goals

### Primary Problems

-   Users struggle to understand true affordability when buying a car
-   Confusion between lease vs finance vs cash
-   Lack of transparency in monthly payment breakdowns
-   Overwhelming number of vehicle options without personalization

### Goals

-   Simplify car buying decisions through guided filtering
-   Provide clear, explainable cost estimates
-   Deliver AI-assisted insights to improve user confidence

### Success Criteria

**User-Facing** 
- Users can filter and evaluate cars in \< 2 minutes 
- Payment estimates are perceived as "directionally accurate" 
- AI explanations increase user understanding (qualitative feedback)

**Technical** 
- API response handling \< 1.5s (with caching) 
- 95%+ uptime (excluding third-party API failures) 
- Modular architecture that supports incremental feature growth

## 2. User Personas & Use Cases

### Persona 1: First-Time Buyer (Alex, 24)

-   Limited financial knowledge
-   Unsure whether to lease or finance
-   Needs guidance and simple explanations

### Persona 2: Budget-Conscious Buyer (Maria, 35)

-   Fixed monthly budget
-   Wants best value vehicle within constraints

### Persona 3: Enthusiast Shopper (David, 42)

-   Knows cars, less concerned about education
-   Wants fast filtering and comparison

## 3. System Architecture

- Frontend (Next.js) 
- Backend (Python) 
- External APIs (Car Data + AI)

## 4. Technology Stack

-   Frontend: Next.js
-   Backend: Python
-   AI: LLM API
-   Hosting: Vercel

## 5. Data Modeling

Vehicle, UserInput, PaymentEstimate entities

## 6. API Integration Strategy

-   Cache responses (24h TTL)
-   Handle stale data gracefully

## 7. Payment Estimation Logic

-   Finance: amortization formula
-   Lease: residual + money factor estimates

## 8. AI Features Design

-   AI explains, not calculates
-   Deterministic backend logic

## 9. UX / UI Considerations

-   Simple flows
-   Clear comparisons
-   Disclaimers

## 10. Risks & Mitigations

-   API downtime → caching
-   Misleading estimates → disclaimers

## 11. Roadmap

-   MVP → Enhancements → Scaling → Advanced

## 12. Testing Strategy

-   Unit tests
-   Integration tests
-   Validation vs known calculators
