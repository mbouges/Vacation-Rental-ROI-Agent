import { ExtractListingResult } from "../../models/property.js";

export interface ListingExtractionContext {
  url: string;
  siteDomain: string | null;
}

export interface ListingExtractor {
  readonly name: string;
  extract(context: ListingExtractionContext): Promise<ExtractListingResult>;
}

export interface SiteSpecificListingExtractor extends ListingExtractor {
  readonly domains: string[];
  supports(context: ListingExtractionContext): boolean;
}
