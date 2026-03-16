# Demo Readiness Evaluation - 2026-03-15

## Batch

- Listings tested: 19
- Markets covered: beach condos, Gulf Coast condos, Smoky Mountain cabins, Scottsdale / Fountain Hills properties
- Sources: `beach-homes.com`, `condoinvestment.com`, `redfin.com`, `realtor.com`
- Raw sheet: [demo-readiness-evaluation-2026-03-15.csv](C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/docs/demo-readiness-evaluation-2026-03-15.csv)
- JSON detail: [demo-readiness-evaluation-2026-03-15.json](C:/Users/mboug/Projects/Personal/Vacation-Rental-ROI-Agent/docs/demo-readiness-evaluation-2026-03-15.json)

## Outcome Summary

| Outcome | Count |
| --- | ---: |
| blocked | 8 |
| network_error | 5 |
| corrupt | 2 |
| failed | 4 |
| partial | 0 |
| success | 0 |

## Domain Notes

| Domain | Count | Main pattern |
| --- | ---: | --- |
| `redfin.com` | 7 | Consistent fetch blocking |
| `realtor.com` | 1 | Blocked fetch |
| `beach-homes.com` | 5 | Network instability during this run |
| `condoinvestment.com` | 6 | Page fetch succeeds, but many brochure pages still produce too few reliable fields |

## Key Findings

- Major portals remain the clearest demo risk. `redfin.com` and `realtor.com` blocked extraction outright in this batch.
- `condoinvestment.com` remains worth supporting because the site is reachable and sometimes yields useful facts, but many pages still degrade into low-confidence or failed extraction.
- The new sanity checks helped. Previously misleading values like tiny prices or implausible bath counts are now downgraded into `invalid_fields` instead of being surfaced as usable facts.
- The fallback prompt wording is stronger now. Blocked sites explicitly ask the user to paste the listing description or core property facts, and low-confidence parses now ask for confirmation instead of quietly returning thin data.

## UX Changes Applied From This Run

- Low-confidence partial results now return a manual review prompt.
- Blocked-site prompts now explicitly say the site blocked automated extraction and ask for pasted listing text or key facts.
- Suspicious numeric values are treated as invalid:
  - prices below a basic sanity threshold
  - absurd bed / bath counts
  - zero square footage
  - taxes that match price
- ROI explanation wording was tightened to be shorter and more presentation-friendly for demos.

## Recommendation On New Domains

Do not add another domain yet.

Why:
- The highest-volume unsupported domains in this batch were blocked at fetch time, so adding selector logic alone would not help the MVP demo.
- The stronger near-term win is to keep improving fallback behavior and demo flows around pasted listing text.
- If another domain is added later, it should be chosen only after a fresh batch shows repeated successful fetches for that domain.

## Demo Guidance

For live demos:
- Prefer pasted listing text when using major portals.
- Use supported / reachable domains only when you want to show automated URL extraction.
- When URL extraction returns low-confidence or blocked results, pivot quickly to the manual-entry flow rather than trying to force another fetch.
