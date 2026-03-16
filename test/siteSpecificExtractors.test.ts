import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseListingFromUrl } from "../src/services/listingParser.js";

const fixturesDir = path.join(process.cwd(), "test", "fixtures");

function loadFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

test("beach-homes extractor uses site selectors when available", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(loadFixture("beach-homes.html"), { status: 200 });

  try {
    const result = await parseListingFromUrl("https://www.beach-homes.com/florida/miramar-beach/981-scenic-gulf-dr/listing/123");

    assert.equal(result.address, "981 Scenic Gulf Dr, Miramar Beach, FL 32550");
    assert.equal(result.price, 749000);
    assert.equal(result.beds, 3);
    assert.equal(result.baths, 2);
    assert.equal(result.sqft, 1480);
    assert.equal(result.hoa_monthly, 1025);
    assert.equal(result.tax_annual, 6420);
    assert.equal(result.property_type, "condo");
    assert.equal(result.fetch_status, "success");
    assert.equal(result.parse_status, "success");
    assert.equal(result.site_domain, "www.beach-homes.com");
    assert.equal(result.field_provenance.address.source, "site_selector");
    assert.equal(result.field_provenance.address.confidence, "high");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("condoinvestment extractor uses site selectors when available", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(loadFixture("condoinvestment.html"), { status: 200 });

  try {
    const result = await parseListingFromUrl("https://www.condoinvestment.com/listings/102-harbor-blvd-unit-405");

    assert.equal(result.address, "102 Harbor Blvd Unit 405, Destin, FL 32541");
    assert.equal(result.price, 685000);
    assert.equal(result.beds, 2);
    assert.equal(result.baths, 2);
    assert.equal(result.sqft, 1260);
    assert.equal(result.hoa_monthly, 890);
    assert.equal(result.tax_annual, 4950);
    assert.equal(result.property_type, "condo");
    assert.equal(result.fetch_status, "success");
    assert.equal(result.parse_status, "success");
    assert.equal(result.site_domain, "www.condoinvestment.com");
    assert.equal(result.field_provenance.price.source, "site_selector");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("site extractors fall back to generic parsing when selectors fail", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(loadFixture("beach-homes-fallback.html"), { status: 200 });

  try {
    const result = await parseListingFromUrl("https://www.beach-homes.com/alabama/gulf-shores/55-boardwalk-ave/listing/456");

    assert.equal(result.address, "55 Boardwalk Ave, Gulf Shores, AL, 36542");
    assert.equal(result.price, 532000);
    assert.equal(result.beds, 2);
    assert.equal(result.baths, 2);
    assert.equal(result.sqft, 1120);
    assert.equal(result.hoa_monthly, 780);
    assert.equal(result.tax_annual, 3900);
    assert.equal(result.property_type, "condo");
    assert.equal(result.fetch_status, "success");
    assert.equal(result.parse_status, "success");
    assert.equal(result.field_provenance.address.source, "structured_data");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fixture extraction rejects polluted addresses on supported domains", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(loadFixture("beach-homes-polluted-address.html"), { status: 200 });

  try {
    const result = await parseListingFromUrl("https://www.beach-homes.com/florida/destin/example/listing/789");

    assert.equal(result.address, null);
    assert.ok(result.invalid_fields.includes("address"));
    assert.ok(result.missing_fields.includes("address"));
    assert.equal(result.parse_status, "corrupt");
    assert.equal(result.extraction_confidence, "low");
    assert.equal(result.price, 615000);
    assert.equal(result.field_provenance.address.status, "invalid");
    assert.equal(result.field_provenance.price.source, "site_selector");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fixture extraction rejects invalid tax and sqft values on supported domains", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(loadFixture("condoinvestment-invalid-values.html"), { status: 200 });

  try {
    const result = await parseListingFromUrl("https://www.condoinvestment.com/listings/88-harbor-view");

    assert.equal(result.price, 540000);
    assert.equal(result.sqft, null);
    assert.equal(result.tax_annual, null);
    assert.ok(result.invalid_fields.includes("sqft"));
    assert.ok(result.invalid_fields.includes("tax_annual"));
    assert.ok(result.missing_fields.includes("sqft"));
    assert.ok(result.missing_fields.includes("tax_annual"));
    assert.equal(result.parse_status, "corrupt");
    assert.equal(result.extraction_confidence, "low");
    assert.equal(result.field_provenance.sqft.status, "invalid");
    assert.equal(result.field_provenance.tax_annual.status, "invalid");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
