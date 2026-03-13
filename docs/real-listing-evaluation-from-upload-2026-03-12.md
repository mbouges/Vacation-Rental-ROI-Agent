# Real Listing Evaluation From Uploaded URL File - March 12, 2026

Source file: `C:\Users\mboug\Downloads\condo-listings.txt`

## Goal

Run the extractor against the 10 listing URLs provided in the uploaded text file and document:

- extraction failures
- assumption gaps
- confusing outputs

## URLs tested

1. `https://www.zillow.com/homedetails/1002-Highway-98-2004-Destin-FL-32541/45970964_zpid/`
2. `https://www.zillow.com/homedetails/1030-Highway-98-APT-PHB-Destin-FL-32541/455373595_zpid/`
3. `https://www.zillow.com/homedetails/510-Gulf-Shore-Dr-UNIT-607-Destin-FL-32541/45976499_zpid/`
4. `https://www.realtor.com/realestateandhomes-detail/500-Gulf-Shore-Dr-Unit-215A_Destin_FL_32541_M65634-90330`
5. `https://www.realtor.com/realestateandhomes-detail/4207-Indian-Bayou-Trl-Unit-2212_Destin_FL_32541_M65656-78962`
6. `https://www.realtor.com/realestateandhomes-detail/502-Gulf-Shore-Dr-Unit-314_Destin_FL_32541_M66253-14529`
7. `https://www.redfin.com/FL/Destin/10-Harbor-Blvd-32541/unit-W422/home/192955006`
8. `https://www.beach-homes.com/alabama/gulf-shores/6081-sawgrass-drive-gulf-shores-al-36542-lhrmls-03860760`
9. `https://www.trulia.com/home/527-beach-club-trl-d1406-gulf-shores-al-36542-2109536292`
10. `https://www.condoinvestment.com/listing/393102-edgewater-residential-1001-w-beach-boulevard-unit-83-gulf-shores-al-36542/`

## Summary

- Total listings tested: 10
- Total blocked or failed at fetch stage: 8
- Total listings with partial extraction: 2
- Total listings with clean extraction: 0

### By domain

- `www.zillow.com`: 3/3 failed with `HTTP 403`
- `www.realtor.com`: 3/3 failed with `HTTP 429`
- `www.redfin.com`: 1/1 failed with `HTTP 403`
- `www.trulia.com`: 1/1 failed with `fetch failed`
- `www.beach-homes.com`: 1/1 partial extraction
- `www.condoinvestment.com`: 1/1 partial extraction

## Extraction failures

### Hard failures

The following sites were unreachable or blocked from this environment:

- Zillow: every test returned `HTTP 403`
- Realtor.com: every test returned `HTTP 429`
- Redfin: returned `HTTP 403`
- Trulia: returned `fetch failed`

In those cases the extractor returned the expected diagnostics shape:

- `site_domain` populated correctly
- `extracted_fields: []`
- full `missing_fields`
- `extraction_confidence: "low"`

This part of the diagnostics is working well.

### Partial extraction failures

#### `beach-homes.com`

URL:
`https://www.beach-homes.com/alabama/gulf-shores/6081-sawgrass-drive-gulf-shores-al-36542-lhrmls-03860760`

Observed output issues:

- `address` was badly polluted with footer and consent text instead of a real street address
- `baths` was parsed as `1`, which is likely wrong for the listing
- `sqft` was parsed as `0`, which should probably be treated as missing rather than extracted
- `hoa_monthly` and `tax_annual` were missing
- `extraction_confidence` still came back `high` because enough fields were non-null, even though some were clearly wrong

#### `condoinvestment.com`

URL:
`https://www.condoinvestment.com/listing/393102-edgewater-residential-1001-w-beach-boulevard-unit-83-gulf-shores-al-36542/`

Observed output issues:

- `address` captured a huge chunk of page content instead of just the listing address
- `tax_annual` was parsed as `485000`, which is actually the listing price, not taxes
- `sqft` was missing even though the page text clearly contained `930`
- `hoa_monthly` correctly parsed as `770`
- `price`, `beds`, `baths`, and `property_type` were correct enough to look trustworthy at a glance
- `extraction_confidence` came back `high`, which overstates quality because the address and taxes were clearly incorrect

## Assumption gaps

1. When a fetch completely fails, the system still returns a full set of assumption defaults.
2. Those defaults are not grounded in extracted property facts when all property fields are null.
3. This can make the output feel more actionable than it really is.
4. In total-failure cases, the system should probably shift to a stronger fallback mode:
   - ask the user to paste the listing text
   - or ask for core property facts first
5. In partial-failure cases, assumption defaults may be based on corrupted values.
   - Example: if price or sqft is wrong, nightly rate, insurance, and utilities defaults can all be misleading.

## Confusing outputs

1. `extraction_confidence` currently measures field count more than field quality.
   - This caused obviously bad results from `beach-homes.com` and `condoinvestment.com` to still appear `high` confidence.
2. `address` extraction is especially fragile on content-heavy pages.
   - It can capture footer text, legal copy, or large chunks of page content.
3. `tax_annual` is vulnerable to false matches against listing price or other dollar amounts.
4. `sqft: 0` is currently treated as extracted, which is misleading.
5. The output does not yet distinguish between:
   - site blocked us
   - parser extracted corrupt values
   - parser extracted only partial but trustworthy values

## What worked well

1. `site_domain` was useful for quickly spotting site-specific failure patterns.
2. `extracted_fields` vs `missing_fields` made it easy to summarize completeness.
3. The extractor failed safely on blocked sites instead of hallucinating values.
4. The uploaded URL file workflow worked cleanly and made evaluation repeatable.

## Recommended next improvements

1. Add an explicit extraction status field such as:
   - `success`
   - `partial`
   - `blocked`
   - `network_error`
   - `corrupt_extraction`
2. Downgrade confidence when values fail sanity checks.
   - Example: `sqft <= 0`
   - Example: bathrooms > 20 for a condo
   - Example: taxes equal or nearly equal to price
   - Example: address contains legal or footer boilerplate
3. Treat invalid numeric values as missing instead of extracted.
4. Add page-content sanitation before address extraction on content-heavy sites.
5. Suppress or soften assumption defaults when zero or low-trust property fields were extracted.
