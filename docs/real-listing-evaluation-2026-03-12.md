# Real Listing Evaluation - March 12, 2026

## Goal

Run 10 real listings through the current `extract_listing` flow and document:

- extraction failures
- assumption gaps
- confusing outputs

## Listing set

### Destin condos

1. `https://www.zillow.com/homedetails/1002-Highway-98-E-UNIT-809-Destin-FL-32541/2091646414_zpid/`
2. `https://www.zillow.com/homedetails/775-Gulf-Shore-Dr-UNIT-1124-Destin-FL-32541/46291446_zpid/`
3. `https://www.zillow.com/homedetails/3795-Scenic-Highway-98-UNIT-2D-Destin-FL-32541/46299771_zpid/`

### Gulf Shores condos

4. `https://www.zillow.com/homedetails/1117-W-Lagoon-Ave-APT-12-Gulf-Shores-AL-36542/220649566_zpid/`
5. `https://www.zillow.com/homedetails/527-Beach-Club-Trl-C104-Gulf-Shores-AL-36542/2056227892_zpid/`
6. `https://www.zillow.com/homedetails/527-Beach-Club-Trl-UNIT-C-C1107-Gulf-Shores-AL-36542/2074665702_zpid/`

### Smoky Mountain cabins

7. `https://www.zillow.com/homedetails/3118-Campfire-Way-Gatlinburg-TN-37738/2056445937_zpid/`
8. `https://www.zillow.com/homedetails/523-Greenbriar-Ln-Gatlinburg-TN-37738/92161339_zpid/`

### Scottsdale rentals / condos

9. `https://www.zillow.com/homedetails/7625-E-Camelback-Rd-UNIT-227B-Scottsdale-AZ-85251/123647704_zpid/`
10. `https://www.zillow.com/homedetails/8245-E-Bell-Rd-UNIT-150-Scottsdale-AZ-85260/63772154_zpid/`

## Result summary

All 10 listings failed at the fetch stage.

- Successes: 0/10
- Failures: 10/10
- Primary domain tested: `www.zillow.com`
- Dominant failure mode: `HTTP 403`
- Extraction confidence returned: `low` for all 10
- Extracted property fields returned: none for all 10
- Missing property fields returned: all core fields for all 10

## Example output pattern

Typical extractor result shape for these blocked pages:

```json
{
  "address": null,
  "price": null,
  "beds": null,
  "baths": null,
  "sqft": null,
  "hoa_monthly": null,
  "tax_annual": null,
  "property_type": null,
  "extracted_fields": [],
  "missing_fields": [
    "address",
    "price",
    "beds",
    "baths",
    "sqft",
    "hoa_monthly",
    "tax_annual",
    "property_type"
  ],
  "extraction_confidence": "low",
  "site_domain": "www.zillow.com"
}
```

## Extraction failures

1. Zillow blocked every request with `HTTP 403`, so the parser never reached HTML extraction or JSON-LD parsing.
2. The current extractor does not distinguish between:
   - site blocked us
   - transient network failure
   - parser found the page but extracted nothing
3. Because the failure collapses into the same general shape, downstream logic only sees an empty property record with low confidence.

## Assumption gaps

1. When extraction fully fails, the system still generates a full assumption guidance payload with default values for nightly rate, occupancy, insurance, utilities, and financing.
2. Those defaults are not grounded in any extracted property facts when all property fields are null.
3. This means the LLM can be prompted to continue an ROI workflow even though there is no usable property record yet.
4. In a full-failure case, the system should likely prioritize asking for basic property facts first:
   - address
   - purchase price
   - beds / baths
   - sqft
   - property type
5. Only after those property facts are confirmed should assumption defaults be presented as the next step.

## Confusing outputs

1. `raw_listing_text` contains an error sentence such as `Unable to fetch or parse ... HTTP 403`, which is useful diagnostically but not ideal as a user-facing listing text field.
2. The tool now returns `site_domain`, which helps, but there is still no explicit status field like `blocked`, `network_error`, or `parsed_partial`.
3. `extraction_confidence: low` is directionally correct, but it does not explain why confidence is low.
4. `assumption_guidance` can make the response look more complete than it really is, even when `extracted_fields` is empty.
5. For LLM orchestration, a better fallback would be a stronger instruction such as: `Extraction failed at source site; ask the user to paste the listing text or key property facts manually.`

## Takeaways

1. The new diagnostics were useful: `extracted_fields`, `missing_fields`, `extraction_confidence`, and `site_domain` made the failure mode much easier to interpret.
2. The biggest current limitation is not the parser logic itself but source-site blocking on live listing pages.
3. The current best fallback path remains pasted listing text, which the extractor handles much more reliably than live URL fetches.

## Recommended next improvements

1. Add an explicit extraction status field such as `success`, `partial`, `blocked`, or `network_error`.
2. Suppress or downgrade assumption defaults when zero property fields were extracted.
3. Add a user-facing fallback message for blocked sites: ask for pasted listing text or manual property details.
4. Extend URL extraction to look for embedded app-state payloads where accessible, but expect anti-bot issues to remain the dominant challenge on major listing sites.
