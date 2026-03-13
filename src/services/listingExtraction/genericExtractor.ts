import {
  buildListingResult,
  deriveFetchStatus,
  extractSiteDomain,
  extractStructuredListingFields,
  htmlToText,
} from "./core.js";
import { ListingExtractionContext, ListingExtractor } from "./types.js";

export class GenericListingExtractor implements ListingExtractor {
  readonly name = "generic";

  async extract(context: ListingExtractionContext) {
    try {
      const response = await fetch(context.url, {
        headers: {
          "user-agent": "VacationRentalRoiAgent/0.1 (+https://github.com/mbouges/Vacation-Rental-ROI-Agent)",
          accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error";

      return buildListingResult(`Unable to fetch or parse ${context.url}. ${message}`, {}, {
        siteDomain: context.siteDomain ?? extractSiteDomain(context.url),
        fetchStatus: deriveFetchStatus(message),
      });
    }
  }
}
