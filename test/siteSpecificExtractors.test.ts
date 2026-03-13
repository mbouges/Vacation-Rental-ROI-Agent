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
  } finally {
    globalThis.fetch = originalFetch;
  }
});
