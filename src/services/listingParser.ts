import { ExtractListingResult, PropertyType } from "../models/property.js";

const currencyToNumber = (value: string): number =>
  Number(value.replace(/[^0-9.]/g, ""));

function matchNumber(pattern: RegExp, text: string): number | null {
  const match = text.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  return currencyToNumber(match[1]);
}

function matchPropertyType(text: string): PropertyType | null {
  const normalized = text.toLowerCase();

  if (normalized.includes("townhouse") || normalized.includes("townhome")) {
    return "townhouse";
  }

  if (normalized.includes("condo") || normalized.includes("condominium")) {
    return "condo";
  }

  if (normalized.includes("house") || normalized.includes("single family")) {
    return "house";
  }

  return null;
}

export function parseListingFromText(rawText: string): ExtractListingResult {
  const addressMatch = rawText.match(/address[:\s]+(.+)/i);
  const price = matchNumber(/\$([\d,]+(?:\.\d+)?)/, rawText);
  const beds = matchNumber(/(\d+(?:\.\d+)?)\s*(?:bed|beds|br)\b/i, rawText);
  const baths = matchNumber(/(\d+(?:\.\d+)?)\s*(?:bath|baths|ba)\b/i, rawText);
  const sqft = matchNumber(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)\b/i, rawText);
  const hoaMonthly = matchNumber(/hoa[^$\d]*\$?([\d,]+(?:\.\d+)?)/i, rawText);
  const taxAnnual = matchNumber(/tax(?:es)?[^$\d]*\$?([\d,]+(?:\.\d+)?)/i, rawText);
  const propertyType = matchPropertyType(rawText);

  const result: ExtractListingResult = {
    address: addressMatch?.[1]?.trim() ?? null,
    price,
    beds,
    baths,
    sqft,
    hoa_monthly: hoaMonthly,
    tax_annual: taxAnnual,
    property_type: propertyType,
    raw_listing_text: rawText,
    missing_fields: [],
  };

  const requiredFields: Array<keyof Omit<ExtractListingResult, "raw_listing_text" | "missing_fields">> = [
    "address",
    "price",
    "beds",
    "baths",
    "sqft",
    "property_type",
  ];

  result.missing_fields = requiredFields.filter((field) => result[field] == null);

  return result;
}

export async function parseListingFromUrl(url: string): Promise<ExtractListingResult> {
  return {
    address: null,
    price: null,
    beds: null,
    baths: null,
    sqft: null,
    hoa_monthly: null,
    tax_annual: null,
    property_type: null,
    raw_listing_text: `URL ingestion scaffold created for ${url}. Live fetching is not enabled in this MVP scaffold.`,
    missing_fields: ["address", "price", "beds", "baths", "sqft", "property_type"],
  };
}
