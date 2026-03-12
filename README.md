# Vacation-Rental-ROI-Agent

TypeScript MCP server scaffold for analyzing vacation-rental property ROI.

## What is included

- MCP server with `extract_listing`, `analyze_property`, and `answer_followup` tools
- Deterministic ROI calculator in code
- Scenario engine for simple follow-up what-if questions
- Listing parser scaffold for manual text extraction and future URL ingestion

## Project structure

- `src/server.ts`: MCP server entrypoint
- `src/tools/*`: MCP tool handlers
- `src/services/roiCalculator.ts`: financial calculations
- `src/services/listingParser.ts`: extraction helpers
- `src/services/scenarioEngine.ts`: follow-up scenario handling
- `src/models/*`: shared types

## Setup

1. Install Node.js 22+
2. Run `npm install`
3. Run `npm run build`
4. Run `npm run dev`

## Example analyze_property input

```json
{
  "property": {
    "address": "123 Beach Ave, Gulf Shores, AL",
    "price": 420000,
    "beds": 2,
    "baths": 2,
    "sqft": 1100,
    "hoa_monthly": 850,
    "tax_annual": 4200,
    "property_type": "condo"
  },
  "assumptions": {
    "nightly_rate": 225,
    "occupancy_rate": 0.58,
    "management_rate": 0.2,
    "maintenance_rate": 0.08,
    "platform_fee_rate": 0.03,
    "insurance_annual": 1800,
    "utilities_annual": 3600,
    "loan_rate": 0.0675,
    "down_payment_percent": 0.2
  }
}
```

## Notes

- Financial calculations run in TypeScript, not prompt text.
- URL fetching is intentionally stubbed for the MVP scaffold.
- Follow-up parsing currently supports common occupancy, nightly-rate, and down-payment questions.
