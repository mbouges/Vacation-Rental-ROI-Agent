import { ExtractListingResult } from "../../models/property.js";
import { GenericListingExtractor } from "./genericExtractor.js";
import { BeachHomesExtractor } from "./sites/beachHomesExtractor.js";
import { CondoInvestmentExtractor } from "./sites/condoInvestmentExtractor.js";
import { ListingExtractionContext, ListingExtractor, SiteSpecificListingExtractor } from "./types.js";

export class ListingExtractorRouter {
  constructor(
    private readonly genericExtractor: ListingExtractor = new GenericListingExtractor(),
    private readonly siteSpecificExtractors: SiteSpecificListingExtractor[] = [],
  ) {}

  resolve(context: ListingExtractionContext): ListingExtractor {
    return this.siteSpecificExtractors.find((extractor) => extractor.supports(context)) ?? this.genericExtractor;
  }

  async extract(context: ListingExtractionContext): Promise<ExtractListingResult> {
    return this.resolve(context).extract(context);
  }
}

function defaultSiteSpecificExtractors(): SiteSpecificListingExtractor[] {
  return [new BeachHomesExtractor(), new CondoInvestmentExtractor()];
}

export function createListingExtractorRouter(
  options: {
    genericExtractor?: ListingExtractor;
    siteSpecificExtractors?: SiteSpecificListingExtractor[];
  } = {},
): ListingExtractorRouter {
  return new ListingExtractorRouter(
    options.genericExtractor,
    options.siteSpecificExtractors ?? defaultSiteSpecificExtractors(),
  );
}
