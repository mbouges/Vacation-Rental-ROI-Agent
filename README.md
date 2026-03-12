# Vacation-Rental-ROI-Agent

TypeScript MCP server for analyzing vacation-rental property ROI through MCP tools.

## Tech stack

- Language: TypeScript
- Runtime: Node.js 24+
- Protocol / SDK: Model Context Protocol via `@modelcontextprotocol/sdk`
- Validation: `zod`
- Development runner: `tsx`
- Testing: Node.js built-in test runner with `tsx`
- Persistence: local JSON storage for saved analyses

## What is included

- MCP server with `extract_listing`, `analyze_property`, and `answer_followup` tools
- Deterministic ROI calculator implemented fully in TypeScript
- Persistent analysis storage across sessions
- Scenario engine for follow-up what-if analysis
- Conversational explanation layer for investor-friendly summaries
- Listing extraction from pasted listing text
- URL extraction with HTML parsing and JSON-LD structured-data fallback
- Assumption-completion guidance with suggested defaults for the LLM
- Local MCP client scripts for one-off calls and same-session workflows
- Regression tests for ROI math, persistence, follow-up parsing, and listing extraction

## Project structure

- `src/server.ts`: MCP server entrypoint
- `src/tools/*`: MCP tool handlers
- `src/services/roiCalculator.ts`: financial calculations
- `src/services/analysisExplainer.ts`: plain-English analysis summaries
- `src/services/analysisStore.ts`: persistent local JSON analysis storage
- `src/services/assumptionPrompter.ts`: assumption guidance and suggested defaults
- `src/services/listingParser.ts`: raw text and URL extraction helpers
- `src/services/scenarioEngine.ts`: follow-up scenario handling
- `src/models/*`: shared types
- `scripts/mcpClient.mjs`: local MCP tool caller
- `scripts/mcpWorkflow.mjs`: local same-session analyze + follow-up workflow
- `test/*.test.ts`: regression tests

## Setup

1. Install Node.js 24+
2. Run `npm install`
3. Run `npm run build`
4. Run `npm test`
5. Run `npm run dev`

## Available tools

### `extract_listing`

Input accepts either `rawText`, `url`, or both.

Example:

```json
{
  "rawText": "Turnkey beach condo at 456 Ocean Dr, Destin, FL 32541 listed for $615,000. 3 beds, 2 baths, 1,450 sqft. HOA $975/month. Property taxes $5,800/year. Renovated condo with strong short-term rental history."
}
```

Returns:

- extracted property details
- original listing text
- `missing_fields` for property fields not found
- `assumption_guidance` with:
  - `property_fields.known` and `property_fields.missing`
  - `assumption_fields.required`, `missing`, and `suggested_defaults`
  - `llm_prompt.summary`, `follow_up_questions`, and `fields_to_confirm`

This lets the LLM clearly separate listing facts from investment assumptions before running analysis.

### `analyze_property`

Example:

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
    "down_payment_percent": 0.2,
    "loan_term_years": 30,
    "closing_cost_percent": 0.03
  }
}
```

Returns ROI metrics plus an `explanation` field with a plain-English investment summary.

### `answer_followup`

Example:

```json
{
  "analysis_id": "YOUR_ANALYSIS_ID",
  "question": "What if occupancy drops to 50%?"
}
```

Supports common occupancy, nightly-rate, and down-payment follow-up scenarios. Analyses are persisted locally, so follow-ups can now load prior records across sessions.

## Local scripts

Run a one-off tool call:

```bash
node scripts/mcpClient.mjs
```

Run analyze + follow-up in the same MCP session:

```bash
node scripts/mcpWorkflow.mjs
```

## Testing

Run all regression tests:

```bash
npm test
```

Current test coverage includes:

- ROI calculator core metrics
- persisted analysis storage and stable analysis IDs
- follow-up loading from a fresh engine instance
- follow-up parsing for absolute and relative occupancy changes
- nightly-rate follow-up handling
- natural-text listing extraction
- JSON-LD URL extraction fallback
- structured assumption guidance generation

## Notes

- Financial calculations run in TypeScript, not prompt text.
- `extract_listing` attempts live URL fetches, but real-world listing-site coverage will still vary by site markup and anti-bot behavior.
- Follow-up parsing currently handles common occupancy, nightly-rate, and down-payment questions.
- Analyses are now stored in local JSON so `answer_followup` can load previous analyses across sessions.
