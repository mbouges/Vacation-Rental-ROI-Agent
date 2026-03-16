# Vacation-Rental-ROI-Agent

TypeScript MCP server for analyzing vacation-rental property ROI through MCP tools.

## MVP status

### Supported today

- raw-text extraction
- generic URL extraction
- site-specific extraction for `beach-homes.com` and `condoinvestment.com`
- persisted follow-up analysis

### Known limitations

- major portals may block automated fetches
- extraction quality varies by site markup
- manual confirmation may still be required for key property facts

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
- URL extraction routed through a strategy-based extractor architecture with site-specific extractors for `beach-homes.com` and `condoinvestment.com` plus a generic HTML/JSON-LD fallback
- Extraction diagnostics including extracted fields, missing fields, confidence, fetch status, parse status, invalid fields, and site domain
- First-class fallback prompts for blocked, error, failed, corrupt, and low-confidence extraction results
- Assumption-completion guidance with suggested defaults for the LLM
- Local MCP client scripts for one-off calls and same-session workflows
- Regression tests for ROI math, persistence, follow-up parsing, and listing extraction
- Demo-readiness evaluation artifacts for recent live-listing runs

## Project structure

- `src/server.ts`: MCP server entrypoint
- `src/tools/*`: MCP tool handlers
- `src/services/roiCalculator.ts`: financial calculations
- `src/services/analysisExplainer.ts`: plain-English analysis summaries
- `src/services/analysisStore.ts`: persistent local JSON analysis storage
- `src/services/assumptionPrompter.ts`: assumption guidance and suggested defaults
- `src/services/listingParser.ts`: public extraction entrypoints for raw text and URL parsing
- `src/services/listingExtraction/*`: domain router, site-specific extractors, generic extractor, and shared extraction utilities
- `src/services/scenarioEngine.ts`: follow-up scenario handling
- `src/models/*`: shared types
- `scripts/mcpClient.mjs`: local MCP tool caller
- `scripts/mcpWorkflow.mjs`: local same-session analyze + follow-up workflow
- `scripts/demoEvaluationUrls.json`: live URL batch used for demo-readiness evaluation
- `scripts/runDemoEvaluation.mjs`: evaluation runner that exports CSV and JSON results
- `test/*.test.ts`: regression tests
- `test/fixtures/*`: sanitized HTML fixtures for extractor regression coverage
- `docs/demo-readiness-*.{csv,json,md}`: live evaluation sheet and summary notes

## Setup

1. Install Node.js 24+
2. Run `npm install`
3. Run `npm run build`
4. Run `npm test`
5. Run `npm run dev`

## Recommended user workflow

1. Call `extract_listing` with a URL or pasted listing text.
2. If extraction succeeds with good confidence, use the returned property details plus `assumption_guidance` to gather final assumptions.
3. If extraction is blocked, failed, corrupt, or low-confidence, use `manual_entry_prompt`.
   Preferred fallback: ask the user to paste the listing text.
   Minimum property facts needed to run analysis: `address` and `price`.
   Helpful but optional property facts: `beds`, `baths`, `sqft`, `property_type`, `hoa_monthly`, `tax_annual`.
   Optional assumptions to confirm later: `nightly_rate`, `occupancy_rate`, `insurance_annual`, `utilities_annual`, `loan_rate`, `down_payment_percent`.
4. Call `analyze_property` with confirmed property details and assumptions.
5. Use the returned `analysis_id` with `answer_followup` for what-if questions.

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
- `extracted_fields` for property fields successfully found
- `missing_fields` for property fields not found
- `invalid_fields` for fields rejected by sanity checks
- `extraction_confidence` as `low`, `medium`, or `high`
- `fetch_status` as `not_applicable`, `success`, `blocked`, or `error`
- `parse_status` as `success`, `partial`, `failed`, or `corrupt`
- `site_domain` when URL extraction is used
- `manual_entry_prompt` with:
  - `next_step`
  - `preferred_input`
  - `required_property_facts`
  - `helpful_property_facts`
  - `optional_assumptions`
  - `suggested_user_prompt`
- `assumption_guidance` with:
  - `property_fields.known` and `property_fields.missing`
  - `assumption_fields.required`, `missing`, and `suggested_defaults`
  - `llm_prompt.summary`, `follow_up_questions`, and `fields_to_confirm`

This lets the LLM separate listing facts from investment assumptions, understand whether extraction was blocked or low-trust, and fall back to manual entry when needed.

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

Run the current demo-readiness evaluation batch:

```bash
node --import tsx scripts/runDemoEvaluation.mjs
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
- site-specific extraction for `beach-homes.com` and `condoinvestment.com` using saved HTML fixtures
- fixture-based polluted-address rejection on supported domains
- fixture-based invalid `tax_annual` handling on supported domains
- fixture-based invalid `sqft` handling on supported domains
- low-confidence extraction fallback prompting
- absurd numeric value rejection for extraction sanity checks
- blocked-site fallback behavior
- low-confidence fallback prompt generation
- required-property-facts vs optional-assumptions fallback guidance
- corrupted address downgrade
- `sqft` zero treated as missing
- tax equal to price treated as invalid
- structured assumption guidance generation

## Demo-readiness notes

The latest live-listing evaluation batch is documented in:

- `docs/demo-readiness-evaluation-2026-03-15.csv`
- `docs/demo-readiness-evaluation-2026-03-15.json`
- `docs/demo-readiness-summary-2026-03-15.md`

Latest batch summary:

- Listings tested: 19
- Outcome mix: 8 blocked, 5 network errors, 4 failed, 2 corrupt
- Recommendation: do not add another supported domain yet; focus on stronger manual fallback flows for blocked and low-confidence results

## Notes

- Financial calculations run in TypeScript, not prompt text.
- `extract_listing` attempts live URL fetches, but real-world listing-site coverage will still vary by site markup, anti-bot behavior, and network conditions.
- Site-specific extractors use targeted HTML selectors first and only fall back to the generic extractor when those selectors do not produce enough usable fields.
- Low-confidence partial results now return a manual confirmation prompt instead of quietly surfacing thin data as analysis-ready.
- When extraction is blocked or low-confidence, the preferred fallback is pasted listing text.
- If pasted listing text is not available, the smallest property fact set needed to continue is `address` plus `price`.
- Follow-up parsing currently handles common occupancy, nightly-rate, and down-payment questions.
- Analyses are stored in local JSON so `answer_followup` can load previous analyses across sessions.
