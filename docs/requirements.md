# CarLy -- Requirements Document

## 1. Functional Requirements

### FR1: User Input Capture

**Description:**
The system must allow users to input key financial and preference data
required for vehicle recommendations.

**Acceptance Criteria:** 
- Accept budget, credit score, purchase type, and optional down payment 
- Validate ranges (credit score: 300--850, budget \> 0) 
- Display clear validation errors 
- Store inputs for session use

------------------------------------------------------------------------

### FR2: Vehicle Data Fetching

**Description:**
Fetch vehicle data from third-party API.

**Acceptance Criteria:** 
- API called on search 
- Data normalized into internal format 
- Graceful failure handling 
- Cached fallback available

------------------------------------------------------------------------

### FR3: Vehicle Filtering

**Description:**\
Filter vehicles based on user inputs.

**Acceptance Criteria:** 
- Filters applied for budget and purchase
type 
- Returns relevant subset of vehicles 
- Handles empty results
gracefully

------------------------------------------------------------------------

### FR4: Price Estimation

**Description:**\
Estimate vehicle affordability.

**Acceptance Criteria:** 
- Adjust price using assumptions 
- Show approximate ranges

------------------------------------------------------------------------

### FR5: Monthly Payment Calculation

**Description:**\
Calculate finance and lease payments.

**Acceptance Criteria:** 
- Finance uses amortization formula 
- Lease uses estimated residual + factors 
- Results shown clearly

------------------------------------------------------------------------

### FR6: AI Explanation Generation

**Description:**\
Generate explanations for results.

**Acceptance Criteria:** 
- AI explains trade-offs and affordability 
- Uses computed values only 
- Includes disclaimer about estimates

------------------------------------------------------------------------

## 2. Non-Functional Requirements

### Performance

-   Response time under 1.5 seconds (cached)
-   Max 3 seconds with API call

### Reliability

-   API fallback to cache
-   No crashes on failure

### Usability

-   Simple UI
-   Clear instructions

### Scalability

-   Designed for small initial load
-   Future-ready for scaling

------------------------------------------------------------------------

## 3. Personas

### First-Time Buyer

-   Needs guidance and explanations

### Budget-Conscious Commuter

-   Wants cheapest reliable option

### Experienced Buyer

-   Wants fast filtering

### Middle-Class Worker

-   Balances affordability and quality

------------------------------------------------------------------------

## 4. User Stories

1.  As a user, I want to input my budget so I can see affordable cars\
2.  As a user, I want to filter by credit score so I can see realistic
    options
3.  As a user, I want to compare lease vs finance so I can choose
    wisely
4.  As a user, I want to see monthly payments so I understand
    affordability
5.  As a user, I want AI explanations so I understand trade-offs
6.  As a user, I want reliable results even if API fails
7.  As a user, I want fast responses so I don't waste time
8.  As a user, I want simple UI so I can use it 
