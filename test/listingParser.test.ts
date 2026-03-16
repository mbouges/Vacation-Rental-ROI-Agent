import assert from "node:assert/strict";
import test from "node:test";
import { parseListingFromText, parseListingFromUrl } from "../src/services/listingParser.js";

test("parseListingFromText extracts listing details from natural text", () => {
  const result = parseListingFromText(
    "Turnkey beach condo at 456 Ocean Dr, Destin, FL 32541 listed for $615,000. 3 beds, 2 baths, 1,450 sqft. HOA $975/month. Property taxes $5,800/year. Renovated condo with strong short-term rental history.",
  );

  assert.equal(result.address, "456 Ocean Dr, Destin, FL 32541");
  assert.equal(result.price, 615000);
  assert.equal(result.beds, 3);
  assert.equal(result.baths, 2);
  assert.equal(result.sqft, 1450);
  assert.equal(result.hoa_monthly, 975);
  assert.equal(result.tax_annual, 5800);
  assert.equal(result.property_type, "condo");
  assert.deepEqual(result.missing_fields, []);
  assert.equal(result.fetch_status, "not_applicable");
  assert.equal(result.parse_status, "success");
  assert.equal(result.extraction_confidence, "high");
  assert.equal(result.field_provenance.address.source, "heuristic_text");
  assert.equal(result.field_provenance.address.status, "extracted");
  assert.equal(result.field_provenance.price.source, "heuristic_text");
  assert.equal(result.field_provenance.price.confidence, "medium");
  assert.equal(result.manual_entry_prompt, null);
});

test("blocked site response returns structured manual-entry fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("blocked", { status: 403, statusText: "Forbidden" });

  try {
    const result = await parseListingFromUrl("https://example.com/listing");

    assert.equal(result.fetch_status, "blocked");
    assert.equal(result.parse_status, "failed");
    assert.equal(result.extraction_confidence, "low");
    assert.deepEqual(result.extracted_fields, []);
    assert.equal(result.site_domain, "example.com");
    assert.ok(result.manual_entry_prompt);
    assert.equal(result.field_provenance.address.status, "missing");
    assert.equal(result.field_provenance.address.source, "missing");
    assert.equal(result.manual_entry_prompt?.preferred_input, "paste_listing_text");
    assert.deepEqual(result.manual_entry_prompt?.required_property_facts, ["address", "price"]);
    assert.ok(result.manual_entry_prompt?.optional_assumptions.includes("nightly_rate"));
    assert.match(result.manual_entry_prompt?.next_step ?? "", /Paste the listing text/i);
    assert.equal(result.assumption_guidance.assumption_fields.suggested_defaults.nightly_rate, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("corrupted address is treated as invalid and downgrades parse status", () => {
  const result = parseListingFromText(
    "Address: Contact us for details. Terms of use. Privacy policy. Copyright notice. Price: $485,000. 2 beds. 2 baths. 930 sqft. Condo.",
  );

  assert.equal(result.address, null);
  assert.ok(result.invalid_fields.includes("address"));
  assert.ok(result.missing_fields.includes("address"));
  assert.equal(result.parse_status, "corrupt");
  assert.equal(result.extraction_confidence, "low");
  assert.equal(result.field_provenance.address.status, "invalid");
  assert.equal(result.field_provenance.address.source, "heuristic_text");
});

test("sqft zero is treated as missing", () => {
  const result = parseListingFromText(
    "123 Beach Ave, Destin, FL 32541 listed for $485,000. 2 beds, 2 baths, 0 sqft. Condo.",
  );

  assert.equal(result.sqft, null);
  assert.ok(result.invalid_fields.includes("sqft"));
  assert.ok(result.missing_fields.includes("sqft"));
  assert.equal(result.field_provenance.sqft.status, "invalid");
});

test("tax parsed equal to price is treated as invalid", () => {
  const result = parseListingFromText(
    "123 Beach Ave, Destin, FL 32541 listed for $485,000. 2 beds, 2 baths, 930 sqft. Property taxes $485,000/year. Condo.",
  );

  assert.equal(result.tax_annual, null);
  assert.ok(result.invalid_fields.includes("tax_annual"));
  assert.ok(result.missing_fields.includes("tax_annual"));
  assert.equal(result.field_provenance.tax_annual.status, "invalid");
});

test("parseListingFromUrl uses JSON-LD as a second extraction pass", async () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "House",
            "address": {
              "streetAddress": "789 Sunset Blvd",
              "addressLocality": "Miami Beach",
              "addressRegion": "FL",
              "postalCode": "33139"
            },
            "offers": {
              "price": "925000"
            },
            "numberOfRooms": 4,
            "numberOfBathroomsTotal": 3,
            "floorSize": {
              "value": 1800
            }
          }
        </script>
      </head>
      <body>
        Beautiful condo getaway.
      </body>
    </html>`;

  const url = `data:text/html,${encodeURIComponent(html)}`;
  const result = await parseListingFromUrl(url);

  assert.equal(result.address, "789 Sunset Blvd, Miami Beach, FL, 33139");
  assert.equal(result.price, 925000);
  assert.equal(result.beds, 4);
  assert.equal(result.baths, 3);
  assert.equal(result.sqft, 1800);
  assert.equal(result.property_type, "house");
  assert.deepEqual(result.missing_fields, ["hoa_monthly", "tax_annual"]);
  assert.equal(result.fetch_status, "success");
  assert.equal(result.parse_status, "partial");
  assert.equal(result.extraction_confidence, "high");
  assert.equal(result.site_domain, null);
  assert.equal(result.field_provenance.address.source, "structured_data");
  assert.equal(result.field_provenance.hoa_monthly.status, "missing");
  assert.equal(result.field_provenance.hoa_monthly.confidence, "none");
  assert.equal(result.manual_entry_prompt, null);
});

test("low-confidence partial extraction returns a manual review prompt", () => {
  const result = parseListingFromText("Price: $6. 2 beds. Condo.");

  assert.equal(result.price, null);
  assert.ok(result.invalid_fields.includes("price"));
  assert.equal(result.extraction_confidence, "low");
  assert.ok(result.manual_entry_prompt);
  assert.equal(result.manual_entry_prompt?.preferred_input, "paste_listing_text");
  assert.deepEqual(result.manual_entry_prompt?.required_property_facts, ["address", "price"]);
  assert.ok(result.manual_entry_prompt?.helpful_property_facts.includes("beds"));
  assert.equal(result.assumption_guidance.assumption_fields.suggested_defaults.nightly_rate, undefined);
});

test("absurd bath counts are treated as invalid", () => {
  const result = parseListingFromText(
    "123 Beach Ave, Destin, FL 32541 listed for $485,000. 2 beds, 847 baths, 930 sqft. Condo.",
  );

  assert.equal(result.baths, null);
  assert.ok(result.invalid_fields.includes("baths"));
  assert.ok(result.manual_entry_prompt);
});
