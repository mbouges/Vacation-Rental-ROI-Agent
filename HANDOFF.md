# Handoff

## Project

Vacation Rental ROI MCP server and ROI calculator.

Current branch when this handoff was written:
- `codex/field-provenance`

Current commit when this handoff was written:
- `bc1e1ba`

## Goal

This project is an MVP backend for analyzing vacation-rental listings, collecting missing assumptions, computing ROI metrics, and answering follow-up scenario questions through MCP tools.

Primary long-term target from [PROJECT_SPEC.md](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/PROJECT_SPEC.md):
- ChatGPT App / MCP-based vacation rental investment assistant

## Implemented

- MCP tools:
  - `extract_listing`
  - `analyze_property`
  - `answer_followup`
- Deterministic ROI calculations in code
- Conversational plain-English analysis explanations
- Follow-up scenario analysis
- Persistent saved analyses across sessions
- Assumption guidance and suggested defaults
- Extraction diagnostics:
  - `extracted_fields`
  - `missing_fields`
  - `invalid_fields`
  - `fetch_status`
  - `parse_status`
  - `extraction_confidence`
  - `site_domain`
  - `field_provenance`
- First-class fallback workflow for blocked/low-confidence extraction
- Strategy-based extraction architecture
- Site-specific extractors for:
  - `beach-homes.com`
  - `condoinvestment.com`
- Fixture-based extraction regression tests
- Railway deployment configuration

## Important files

- [README.md](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/README.md)
- [PROJECT_SPEC.md](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/PROJECT_SPEC.md)
- [src/server.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/server.ts)
- [src/createMcpServer.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/createMcpServer.ts)
- [src/services/listingParser.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/listingParser.ts)
- [src/services/listingExtraction/core.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/listingExtraction/core.ts)
- [src/services/scenarioEngine.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/scenarioEngine.ts)
- [src/services/roiCalculator.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/roiCalculator.ts)
- [src/services/analysisStore.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/analysisStore.ts)
- [railway.json](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/railway.json)

## Current architecture

- [src/createMcpServer.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/createMcpServer.ts)
  - registers all MCP tools
  - shared entrypoint for stdio and HTTP modes

- [src/server.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/server.ts)
  - starts stdio mode by default for local MCP use
  - starts HTTP mode automatically when `PORT` is set
  - exposes:
    - `/mcp`
    - `/health`

- [src/services/listingExtraction](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/listingExtraction)
  - domain router
  - generic extractor
  - site-specific extractors
  - validation / fallback / provenance logic

## Output behavior to know

`extract_listing` may return:
- reliable extracted property facts
- assumption guidance
- a manual fallback prompt if extraction is blocked, failed, corrupt, or low-confidence

Field-level provenance now indicates whether each field came from:
- `site_selector`
- `structured_data`
- `heuristic_text`
- `missing`

This is useful for future UI or LLM logic.

## Deployment

Railway config is already added:
- Node runtime: `24.x` via [package.json](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/package.json)
- build: `npm run build`
- start: `node dist/server.js`
- health check: `/health`
- MCP endpoint: `/mcp`

HTTP mode is selected automatically when `PORT` is present.

## Commands

Install:

```bash
npm install
```

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

Local stdio dev:

```bash
npm run dev
```

## Local scripts

- [scripts/mcpClient.mjs](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/scripts/mcpClient.mjs)
- [scripts/mcpWorkflow.mjs](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/scripts/mcpWorkflow.mjs)
- [scripts/runDemoEvaluation.mjs](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/scripts/runDemoEvaluation.mjs)

## Evaluation artifacts

See:
- [docs](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/docs)

Notable files:
- [docs/demo-readiness-summary-2026-03-15.md](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/docs/demo-readiness-summary-2026-03-15.md)
- [docs/demo-readiness-evaluation-2026-03-15.csv](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/docs/demo-readiness-evaluation-2026-03-15.csv)

## Good next steps

- deploy the Railway service publicly and verify `/mcp` with a real MCP client
- add field-level UI / LLM messaging using `field_provenance`
- add more supported domains only if live evaluation volume justifies them
- consider a ChatGPT App integration layer
- consider market-based assumption defaults later

## Recommended restart prompt

Use this on another computer in a new Codex chat:

```text
Please read HANDOFF.md, README.md, and PROJECT_SPEC.md, then continue work on this repo from the current state. This is a vacation-rental ROI MCP server with extraction, fallback prompts, persistence, field-level provenance, and Railway deployment support already implemented.
```
