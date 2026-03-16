import { buildFieldCandidates, buildListingResult, htmlToText, PartialListingFields } from "../core.js";
import { fetchListingHtml } from "../fetchHtml.js";
import { extractFirstNumber, extractFirstText } from "../htmlSelectors.js";
import { buildGenericFailureResult, extractGenericListingFromHtml } from "../genericExtractor.js";
import { ListingExtractionContext, SiteSpecificListingExtractor } from "../types.js";

function extractPropertyType(html: string): PartialListingFields["property_type"] {
  const typeText = extractFirstText(html, [
    /<div[^>]*class=["'][^"']*property-type[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ])?.toLowerCase();

  if (!typeText) {
    return null;
  }

  if (typeText.includes("town")) {
    return "townhouse";
  }

  if (typeText.includes("house")) {
    return "house";
  }

  if (typeText.includes("condo") || typeText.includes("condominium")) {
    return "condo";
  }

  return null;
}

function extractBeachHomesFields(html: string): PartialListingFields {
  return {
    address: extractFirstText(html, [
      /<h1[^>]*class=["'][^"']*property-address[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
      /<div[^>]*data-testid=["']property-address["'][^>]*>([\s\S]*?)<\/div>/i,
    ]),
    price: extractFirstNumber(html, [
      /<div[^>]*data-testid=["']listing-price["'][^>]*>([\s\S]*?)<\/div>/i,
      /<span[^>]*class=["'][^"']*listing-price[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    ]),
    beds: extractFirstNumber(html, [
      /<li[^>]*data-stat=["']beds["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    ]),
    baths: extractFirstNumber(html, [
      /<li[^>]*data-stat=["']baths["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    ]),
    sqft: extractFirstNumber(html, [
      /<li[^>]*data-stat=["']sqft["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    ]),
    hoa_monthly: extractFirstNumber(html, [
      /<div[^>]*data-cost=["']hoa["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    ]),
    tax_annual: extractFirstNumber(html, [
      /<div[^>]*data-cost=["']taxes["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    ]),
    property_type: extractPropertyType(html),
  };
}

function hasUsableSelectorFields(fields: PartialListingFields): boolean {
  const count = Object.values(fields).filter((value) => value != null).length;
  return count >= 4 && fields.address != null && fields.price != null;
}

export class BeachHomesExtractor implements SiteSpecificListingExtractor {
  readonly name = "beach-homes";
  readonly domains = ["beach-homes.com", "www.beach-homes.com"];

  supports(context: ListingExtractionContext): boolean {
    return this.domains.includes(context.siteDomain ?? "");
  }

  async extract(context: ListingExtractionContext) {
    try {
      const html = await fetchListingHtml(context.url);
      const siteFields = extractBeachHomesFields(html);

      if (!hasUsableSelectorFields(siteFields)) {
        return extractGenericListingFromHtml(context, html);
      }

      const siteResult = buildListingResult(htmlToText(html), siteFields, {
        siteDomain: context.siteDomain,
        fetchStatus: "success",
        primaryCandidates: buildFieldCandidates(siteFields, "site_selector", "high"),
      });

      return siteResult;
    } catch (error) {
      return buildGenericFailureResult(context, error);
    }
  }
}

