Project Name

AI Vacation Rental ROI Agent

Goal

Build an AI-powered assistant that analyzes vacation rental property listings and estimates investment performance (ROI, cash flow, break-even occupancy).

The system should allow users to paste a property listing URL and receive a conversational investment analysis.

The product will initially run as a ChatGPT App using the Apps SDK and MCP server architecture.

Core Product Concept

Users interact through natural language.

Example interaction:

User:

Analyze this condo for vacation rental ROI
https://example.com/property

System:

Extract property details from listing

Ask for missing assumptions

Calculate investment metrics

Explain results in plain English

Allow follow-up questions

Example follow-ups:

What occupancy do I need to break even?
What if nightly rate drops 10%?
Compare this with 25% down instead of 20%.
MVP Features

Version 1 should support:

1. Listing URL ingestion

User pastes property listing link.

System extracts:

address

price

beds

baths

sqft

HOA (if available)

taxes (if available)

property type

listing description

If some fields cannot be extracted, the system asks the user.

2. Investment assumptions

User confirms or edits assumptions:

nightly rate

occupancy rate

HOA

taxes

insurance

utilities

property management %

maintenance %

platform fees

loan interest rate

down payment %

3. ROI analysis

System calculates:

gross annual revenue

annual operating expenses

net operating income (NOI)

annual cash flow

cap rate

cash-on-cash return

break-even occupancy

4. AI explanation

The system explains results conversationally.

Example:

This property likely breaks even at about 48% occupancy.
The high HOA of $1,200/month reduces cash flow, but the nightly rate potential appears strong.
With 58% occupancy, estimated annual profit is about $8,200.

5. Follow-up scenario analysis

Users can ask:

What if occupancy drops to 50%?
What nightly rate do I need to break even?

System re-runs calculations.

Architecture

System architecture:

ChatGPT
   ↓
ChatGPT App (Apps SDK)
   ↓
MCP Server (Node / TypeScript)
   ├── extract_listing tool
   ├── analyze_property tool
   ├── answer_followup tool
   └── search_properties tool (future)
   ↓
Business Logic Layer
   ├── listing parser
   ├── ROI calculator
   ├── scenario engine
   ↓
Database (optional for MVP)
Technology Stack

Language

TypeScript

Runtime

Node.js

Framework

MCP Server

Deployment

Cloud hosted Node service

Database (Phase 2)

Supabase or Postgres

Frontend

ChatGPT interface (no standalone UI initially)

Tool Definitions (MCP Server)

The MCP server should expose the following tools.

Tool: extract_listing

Purpose:
Extract property details from a listing URL.

Input:

{
  "url": "string"
}

Output:

{
  "address": "string",
  "price": number,
  "beds": number,
  "baths": number,
  "sqft": number,
  "hoa_monthly": number | null,
  "tax_annual": number | null,
  "property_type": "condo | house | townhouse",
  "raw_listing_text": "string",
  "missing_fields": []
}

If extraction fails, return partial fields and missing fields.

Tool: analyze_property

Purpose:
Run ROI calculations.

Input:

{
  "property": {...},
  "assumptions": {
    "nightly_rate": number,
    "occupancy_rate": number,
    "management_rate": number,
    "maintenance_rate": number,
    "insurance_annual": number,
    "utilities_annual": number,
    "loan_rate": number,
    "down_payment_percent": number
  }
}

Output:

{
  "gross_revenue": number,
  "annual_expenses": number,
  "noi": number,
  "annual_cash_flow": number,
  "cap_rate": number,
  "cash_on_cash_return": number,
  "break_even_occupancy": number
}
Tool: answer_followup

Purpose:
Handle follow-up questions.

Input:

{
  "analysis_id": "string",
  "question": "string"
}

Output:
Updated analysis results or explanation.

ROI Calculation Formulas
Gross Revenue
nightly_rate * 365 * occupancy_rate
Mortgage Payment

Standard mortgage formula using:

loan amount

interest rate

term

Annual Expenses

Include:

HOA

taxes

insurance

utilities

management fee

maintenance reserve

platform fees

mortgage payment

Net Operating Income
gross_revenue - operating_expenses

Operating expenses exclude mortgage.

Annual Cash Flow
gross_revenue - total_expenses
Cap Rate
NOI / purchase_price
Cash on Cash Return
annual_cash_flow / total_cash_invested
Break-even Occupancy
annual_expenses / (nightly_rate * 365)
Project Folder Structure

Codex should generate the following structure:

vacation-rental-agent
│
├── src
│   ├── server.ts
│   ├── tools
│   │   ├── extractListing.ts
│   │   ├── analyzeProperty.ts
│   │   └── answerFollowup.ts
│   │
│   ├── services
│   │   ├── listingParser.ts
│   │   ├── roiCalculator.ts
│   │   └── scenarioEngine.ts
│   │
│   ├── models
│   │   ├── property.ts
│   │   └── assumptions.ts
│
├── package.json
├── tsconfig.json
└── PROJECT_SPEC.md
Development Phases
Phase 1

Build ROI calculator module.

Manual inputs only.

Phase 2

Add analyze_property MCP tool.

Phase 3

Add extract_listing.

Phase 4

Enable conversational explanations.

Phase 5

Add scenario analysis.

Future Features

Not part of MVP.

Potential features:

property search

property ranking

deal score

saved analyses

market analytics

user accounts

subscription billing

portfolio tracking

Key Product Principles

All financial calculations must run in code, not AI prompts.

AI should only explain results.

Extraction should be tolerant of partial data.

User must be able to edit assumptions.

MVP should prioritize reliability over automation.

Success Criteria for MVP

The system should successfully:

Accept a property listing URL

Extract or request missing fields

Calculate ROI metrics

Explain the investment conversationally

Answer follow-up scenario questions

End of Specification
