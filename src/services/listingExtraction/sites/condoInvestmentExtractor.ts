import { buildListingResult, htmlToText, PartialListingFields } from "../core.js";
import { fetchListingHtml } from "../fetchHtml.js";
import { extractFirstNumber, extractFirstText } from "../htmlSelectors.js";
import { buildGenericFailureResult, extractGenericListingFromHtml } from "../genericExtractor.js";
import { ListingExtractionContext, SiteSpecificListingExtractor } from "../types.js";

function extractPropertyType(html: string): PartialListingFields["property_type"] {
  const typeText = extractFirstText(html, [
    /<span[^>]*class=["'][^"']*property-subtype[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    /<div[^>]*data-field=["']property-type["'][^>]*>([\s\S]*?)<\/div>/i,
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

function extractCondoInvestmentFields(html: string): PartialListingFields {
  return {
    address: extractFirstText(html, [
      /<h1[^>]*class=["'][^"']*listing-address[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    ]),
    price: extractFirstNumber(html, [
      /<div[^>]*class=["'][^"']*listing-price[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i,
    ]),
    beds: extractFirstNumber(html, [
      /<div[^>]*data-field=["']beds["'][^>]*>([\s\S]*?)<\/div>/i,
    ]),
    baths: extractFirstNumber(html, [
      /<div[^>]*data-field=["']baths["'][^>]*>([\s\S]*?)<\/div>/i,
    ]),
    sqft: extractFirstNumber(html, [
      /<div[^>]*data-field=["']sqft["'][^>]*>([\s\S]*?)<\/div>/i,
    ]),
    hoa_monthly: extractFirstNumber(html, [
      /<tr[^>]*data-row=["']hoa["'][^>]*>[\s\S]*?<td[^>]*class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
    ]),
    tax_annual: extractFirstNumber(html, [
      /<tr[^>]*data-row=["']taxes["'][^>]*>[\s\S]*?<td[^>]*class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
    ]),
    property_type: extractPropertyType(html),
  };
}

function hasUsableSelectorFields(fields: PartialListingFields): boolean {
  const count = Object.values(fields).filter((value) => value != null).length;
  return count >= 4 && fields.address != null && fields.price != null;
}

export class CondoInvestmentExtractor implements SiteSpecificListingExtractor {
  readonly name = "condoinvestment";
  readonly domains = ["condoinvestment.com", "www.condoinvestment.com"];

  supports(context: ListingExtractionContext): boolean {
    return this.domains.includes(context.siteDomain ?? "");
  }

  async extract(context: ListingExtractionContext) {
    try {
      const html = await fetchListingHtml(context.url);
      const siteFields = extractCondoInvestmentFields(html);

      if (!hasUsableSelectorFields(siteFields)) {
        return extractGenericListingFromHtml(context, html);
      }

      const siteResult = buildListingResult(htmlToText(html), siteFields, {
        siteDomain: context.siteDomain,
        fetchStatus: "success",
      });

      return siteResult;
    } catch (error) {
      return buildGenericFailureResult(context, error);
    }
  }
}

