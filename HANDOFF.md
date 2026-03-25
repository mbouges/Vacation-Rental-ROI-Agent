# Handoff

## Project

Vacation Rental ROI Agent

This repo is an MVP backend and GPT integration foundation for analyzing short-term rental deals.

## Current status

The project is in a strong MVP demo-ready state.

Implemented:
- MCP server
- public Railway deployment
- REST/OpenAPI fallback API
- Custom GPT action integration path
- listing extraction
- extraction diagnostics and fallback prompts
- persistent ROI analyses
- follow-up scenario analysis
- conversational ROI explanations
- regression test coverage

Live production base URL:
- `https://vacation-rental-roi-agent-production.up.railway.app`

Important live endpoints:
- `/health`
- `/mcp`
- `/openapi.json`
- `/api/extract-listing`
- `/api/analyze-property`
- `/api/answer-followup`

## Key completed capabilities

### Extraction

- Raw pasted listing text extraction
- Generic URL extraction
- Strategy-based extractor architecture
- Site-specific extractors for:
  - `beach-homes.com`
  - `condoinvestment.com`
- Extraction diagnostics:
  - `extracted_fields`
  - `missing_fields`
  - `invalid_fields`
  - `fetch_status`
  - `parse_status`
  - `extraction_confidence`
  - `site_domain`
  - `field_provenance`
- Structured fallback prompts for blocked or low-confidence extraction

### Analysis

- Deterministic ROI calculator in code
- Conversational explanation layer
- Persistent `analysis_id` storage across sessions
- Follow-up scenario engine

### Follow-up handling

Currently supports:
- occupancy changes
- nightly rate changes
- down payment changes
- management rate changes
- natural-language multi-change follow-ups
- assignment-style follow-ups like:
  - `management_rate = 0`
  - `occupancy_rate = 0.65`

### GPT / API integration

- Railway deployment works
- MCP endpoint works remotely
- OpenAPI import works for GPT Actions
- GPT-side action flow has been tested end to end

## Recent important fixes

Recent work after the original handoff:
- Added Railway HTTP deployment mode with `/mcp` and `/health`
- Added REST/OpenAPI wrapper
- Tightened OpenAPI document for easier Actions import
- Fixed HOA extraction for text like `$450/month HOA`
- Improved bedroom extraction for text like `2-bedroom`
- Fixed compound follow-up parsing
- Added assignment-style follow-up parsing for GPT-generated follow-up syntax

## Important files

- [README.md](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/README.md)
- [PROJECT_SPEC.md](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/PROJECT_SPEC.md)
- [src/server.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/server.ts)
- [src/createMcpServer.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/createMcpServer.ts)
- [src/httpApi.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/httpApi.ts)
- [src/services/listingParser.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/listingParser.ts)
- [src/services/listingExtraction/core.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/listingExtraction/core.ts)
- [src/services/scenarioEngine.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/scenarioEngine.ts)
- [src/services/roiCalculator.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/roiCalculator.ts)
- [src/services/analysisStore.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/analysisStore.ts)
- [railway.json](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/railway.json)

## Architecture

### MCP path

- [src/createMcpServer.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/createMcpServer.ts)
  - registers MCP tools

- [src/server.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/server.ts)
  - stdio mode for local use
  - HTTP mode when `PORT` is set
  - exposes `/mcp` and `/health`

### REST/OpenAPI path

- [src/httpApi.ts](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/httpApi.ts)
  - `GET /openapi.json`
  - `POST /api/extract-listing`
  - `POST /api/analyze-property`
  - `POST /api/answer-followup`

### Extraction path

- [src/services/listingExtraction](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/src/services/listingExtraction)
  - generic and site-specific extraction
  - validation
  - confidence
  - field provenance
  - fallback prompting

## GPT configuration state

A Custom GPT has already been configured and tested using:
- the production OpenAPI document at `/openapi.json`
- the REST action endpoints

The GPT instruction set was tuned to:
- use tool outputs as source of truth
- avoid inventing missing values
- avoid manually correcting tool outputs
- distinguish extracted facts from assumptions
- use measured investment language

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
- [scripts/verifyRemoteMcp.mjs](/C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/scripts/verifyRemoteMcp.mjs)

## Testing status

Current tests pass:
- `25/25`

Coverage includes:
- ROI math
- persistence
- follow-up parsing
- compound and assignment-style follow-ups
- listing extraction regressions
- fixture-based extraction
- fallback prompting

## Good next steps after the break

- tighten API auth/security if moving beyond MVP demo use
- improve publishing/privacy posture for broader GPT sharing
- add more site-specific extractors only if justified by real test volume
- improve market-based defaults later
- consider a lightweight public landing page or docs page

## Recommended restart prompt

Use this in a fresh Codex session:

```text
Please read HANDOFF.md, README.md, and PROJECT_SPEC.md, then continue from the current state. This repo now has a live Railway deployment, MCP endpoint, REST/OpenAPI fallback API, Custom GPT action integration, improved listing extraction, persistent ROI analysis, and compound follow-up support.
```
