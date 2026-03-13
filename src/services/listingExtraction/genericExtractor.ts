import { ExtractListingResult } from "../../models/property.js";
import { buildListingResult, deriveFetchStatus, extractSiteDomain, extractStructuredListingFields, htmlToText } from "./core.js";
import { fetchListingHtml } from "./fetchHtml.js";
import { ListingExtractionContext, ListingExtractor } from "./types.js";

export function extractGenericListingFromHtml(context: ListingExtractionContext, html: string): ExtractListingResult {
  const text = htmlToText(html);
  const structuredFields = extractStructuredListingFields(html);
  const parsed = buildListingResult(text, structuredFields, {
    siteDomain: context.siteDomain,
    fetchStatus: "success",
  });

  return {
    ...parsed,
    raw_listing_text: parsed.raw_listing_text || `Fetched ${context.url} but could not extract readable listing text.`,
  };
}

export function buildGenericFailureResult(context: ListingExtractionContext, error: unknown): ExtractListingResult {
  const message = error instanceof Error ? error.message : "Unknown fetch error";

  return buildListingResult(`Unable to fetch or parse ${context.url}. ${message}`, {}, {
    siteDomain: context.siteDomain ?? extractSiteDomain(context.url),
    fetchStatus: deriveFetchStatus(message),
  });
}

export class GenericListingExtractor implements ListingExtractor {
  readonly name = "generic";

  async extract(context: ListingExtractionContext) {
    try {
      const html = await fetchListingHtml(context.url);
      return extractGenericListingFromHtml(context, html);
    } catch (error) {
      return buildGenericFailureResult(context, error);
    }
  }
}
