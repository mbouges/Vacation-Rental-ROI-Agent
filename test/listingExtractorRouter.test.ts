import assert from "node:assert/strict";
import test from "node:test";
import { buildListingResult } from "../src/services/listingExtraction/core.js";
import { ListingExtractorRouter, createListingExtractorRouter } from "../src/services/listingExtraction/domainRouter.js";
import { ListingExtractionContext, ListingExtractor, SiteSpecificListingExtractor } from "../src/services/listingExtraction/types.js";

class FakeGenericExtractor implements ListingExtractor {
  readonly name = "generic";

  async extract(context: ListingExtractionContext) {
    return buildListingResult(`Generic extractor handled ${context.url}`, {}, {
      siteDomain: context.siteDomain,
      fetchStatus: "error",
    });
  }
}

class FakeSiteExtractor implements SiteSpecificListingExtractor {
  readonly name = "example";
  readonly domains = ["example.com"];

  supports(context: ListingExtractionContext): boolean {
    return context.siteDomain === "example.com";
  }

  async extract(context: ListingExtractionContext) {
    return buildListingResult("123 Beach Ave, Destin, FL 32541 listed for $500,000. 2 beds. 2 baths. 900 sqft. Condo.", {}, {
      siteDomain: context.siteDomain,
      fetchStatus: "success",
    });
  }
}

test("router falls back to the generic extractor when no site strategy matches", async () => {
  const router = createListingExtractorRouter({
    genericExtractor: new FakeGenericExtractor(),
  });

  const result = await router.extract({ url: "https://unknown-site.test/listing", siteDomain: "unknown-site.test" });

  assert.equal(result.fetch_status, "error");
  assert.equal(result.site_domain, "unknown-site.test");
  assert.equal(result.manual_entry_prompt?.reason, "The page did not produce enough reliable property details to continue automatically.");
});

test("router selects a matching site-specific extractor before the generic fallback", async () => {
  const router = new ListingExtractorRouter(new FakeGenericExtractor(), [new FakeSiteExtractor()]);

  const result = await router.extract({ url: "https://example.com/listing/1", siteDomain: "example.com" });

  assert.equal(result.address, "123 Beach Ave, Destin, FL 32541");
  assert.equal(result.fetch_status, "success");
  assert.equal(result.site_domain, "example.com");
  assert.equal(result.parse_status, "partial");
});
