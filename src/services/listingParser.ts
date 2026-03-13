import { ExtractListingResult } from "../models/property.js";
import { buildListingResult, extractSiteDomain } from "./listingExtraction/core.js";
import { createListingExtractorRouter } from "./listingExtraction/domainRouter.js";

export function parseListingFromText(rawText: string): ExtractListingResult {
  return buildListingResult(rawText, {}, { fetchStatus: "not_applicable" });
}

export async function parseListingFromUrl(url: string): Promise<ExtractListingResult> {
  const router = createListingExtractorRouter();
  return router.extract({ url, siteDomain: extractSiteDomain(url) });
}
