import { ExtractListingResult, PropertyType } from "../models/property.js";

const fieldNames: Array<keyof Omit<ExtractListingResult, "raw_listing_text" | "missing_fields">> = [
  "address",
  "price",
  "beds",
  "baths",
  "sqft",
  "hoa_monthly",
  "tax_annual",
  "property_type",
];

type PartialListingFields = Partial<Omit<ExtractListingResult, "raw_listing_text" | "missing_fields">>;

type JsonRecord = Record<string, unknown>;

function currencyToNumber(value: string): number {
  return Number(value.replace(/[^0-9.]/g, ""));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = currencyToNumber(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
  }

  return null;
}

function matchNumber(patterns: RegExp[], text: string): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return currencyToNumber(match[1]);
    }
  }

  return null;
}

function matchPropertyType(text: string): PropertyType | null {
  const normalized = text.toLowerCase();

  if (normalized.includes("townhouse") || normalized.includes("townhome")) {
    return "townhouse";
  }

  if (normalized.includes("condo") || normalized.includes("condominium") || normalized.includes("apartment")) {
    return "condo";
  }

  if (
    normalized.includes("house") ||
    normalized.includes("single family") ||
    normalized.includes("single-family")
  ) {
    return "house";
  }

  return null;
}

function extractAddress(text: string): string | null {
  const labeledMatch = text.match(/address[:\s]+([^\n|]+)/i);
  if (labeledMatch?.[1]) {
    return labeledMatch[1].trim();
  }

  const streetMatch = text.match(
    /(\d{1,6}\s+[A-Za-z0-9.\-#' ]+\s(?:Ave|Avenue|St|Street|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Way|Ct|Court|Cir|Circle|Pl|Place|Pkwy|Parkway|Ter|Terrace)\b[^\n|,]*(?:,\s*[A-Za-z .'-]+,?\s*[A-Z]{2}(?:\s+\d{5})?)?)/i,
  );

  return streetMatch?.[1]?.trim() ?? null;
}

function decodeHtml(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function coerceObject(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function getNested(obj: JsonRecord | null, path: string[]): unknown {
  let current: unknown = obj;

  for (const key of path) {
    const record = coerceObject(current);
    if (!record || !(key in record)) {
      return null;
    }

    current = record[key];
  }

  return current;
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim();
  }

  const address = coerceObject(value);
  if (!address) {
    return null;
  }

  const parts = [
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizePropertyType(value: unknown): PropertyType | null {
  if (typeof value !== "string") {
    return null;
  }

  return matchPropertyType(value);
}

function extractJsonLdObjects(html: string): JsonRecord[] {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const objects: JsonRecord[] = [];

  for (const match of matches) {
    const rawJson = decodeHtml(match[1] ?? "").trim();
    if (!rawJson) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const queue = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of queue) {
        const record = coerceObject(item);
        if (!record) {
          continue;
        }

        if (Array.isArray(record["@graph"])) {
          for (const nested of record["@graph"]) {
            const nestedRecord = coerceObject(nested);
            if (nestedRecord) {
              objects.push(nestedRecord);
            }
          }
        }

        objects.push(record);
      }
    } catch {
      continue;
    }
  }

  return objects;
}

function extractStructuredListingFields(html: string): PartialListingFields {
  const objects = extractJsonLdObjects(html);
  const result: PartialListingFields = {};

  for (const obj of objects) {
    const typeValue = obj["@type"];
    const types = Array.isArray(typeValue)
      ? typeValue.filter((v): v is string => typeof v === "string")
      : [typeValue].filter((v): v is string => typeof v === "string");
    const normalizedTypes = types.map((value) => value.toLowerCase());
    const looksLikeListing = normalizedTypes.some((value) =>
      ["house", "singlefamilyresidence", "residence", "apartment", "offer", "product", "place"].includes(value),
    );

    if (!looksLikeListing && types.length === 0) {
      continue;
    }

    result.address ??= normalizeAddress(obj.address);
    result.price ??= toNumber(obj.price) ?? toNumber(getNested(obj, ["offers", "price"]));
    result.beds ??= toNumber(obj.numberOfRooms) ?? toNumber(obj.numberOfBedrooms) ?? toNumber(obj.numberOfBeds);
    result.baths ??=
      toNumber(obj.numberOfBathroomsTotal) ??
      toNumber(obj.numberOfBathroomsFull) ??
      toNumber(obj.numberOfBathrooms);
    result.sqft ??= toNumber(obj.floorSize) ?? toNumber(getNested(obj, ["floorSize", "value"]));
    result.property_type ??=
      normalizePropertyType(obj.additionalType) ??
      normalizePropertyType(types[0] ?? null) ??
      normalizePropertyType(obj.name);
  }

  return result;
}

function buildHeuristicFields(rawText: string): PartialListingFields {
  return {
    address: extractAddress(rawText),
    price: matchNumber([
      /(?:list price|price)[:\s]*\$([\d,]+(?:\.\d+)?)/i,
      /\$([\d,]+(?:\.\d+)?)/,
    ], rawText),
    beds: matchNumber([
      /(?:beds?|bedrooms?)[:\s]+(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*(?:bed|beds|br)\b/i,
    ], rawText),
    baths: matchNumber([
      /(?:baths?|bathrooms?)[:\s]+(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*(?:bath|baths|ba)\b/i,
    ], rawText),
    sqft: matchNumber([
      /(?:sq\.?\s*ft|sqft|square feet)[:\s]+([\d,]+)/i,
      /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)\b/i,
    ], rawText),
    hoa_monthly: matchNumber([
      /hoa(?: dues| fee| fees)?[^$\d]*\$?([\d,]+(?:\.\d+)?)\s*(?:\/\s*month|per month|monthly)?/i,
      /monthly hoa[^$\d]*\$?([\d,]+(?:\.\d+)?)/i,
    ], rawText),
    tax_annual: matchNumber([
      /(?:property )?tax(?:es)?[^$\d]*\$?([\d,]+(?:\.\d+)?)\s*(?:\/\s*year|per year|annual|yearly)?/i,
      /annual taxes?[^$\d]*\$?([\d,]+(?:\.\d+)?)/i,
    ], rawText),
    property_type: matchPropertyType(rawText),
  };
}

function mergeListingFields(primary: PartialListingFields, fallback: PartialListingFields): PartialListingFields {
  return {
    address: primary.address ?? fallback.address ?? null,
    price: primary.price ?? fallback.price ?? null,
    beds: primary.beds ?? fallback.beds ?? null,
    baths: primary.baths ?? fallback.baths ?? null,
    sqft: primary.sqft ?? fallback.sqft ?? null,
    hoa_monthly: primary.hoa_monthly ?? fallback.hoa_monthly ?? null,
    tax_annual: primary.tax_annual ?? fallback.tax_annual ?? null,
    property_type: primary.property_type ?? fallback.property_type ?? null,
  };
}

function buildResult(rawText: string, structuredFields: PartialListingFields = {}): ExtractListingResult {
  const normalizedText = rawText.replace(/\s+/g, " ").trim();
  const heuristicFields = buildHeuristicFields(rawText);
  const mergedFields = mergeListingFields(structuredFields, heuristicFields);

  const result: ExtractListingResult = {
    address: mergedFields.address ?? null,
    price: mergedFields.price ?? null,
    beds: mergedFields.beds ?? null,
    baths: mergedFields.baths ?? null,
    sqft: mergedFields.sqft ?? null,
    hoa_monthly: mergedFields.hoa_monthly ?? null,
    tax_annual: mergedFields.tax_annual ?? null,
    property_type: mergedFields.property_type ?? null,
    raw_listing_text: normalizedText,
    missing_fields: [],
  };

  result.missing_fields = fieldNames.filter((field) => result[field] == null);
  return result;
}

export function parseListingFromText(rawText: string): ExtractListingResult {
  return buildResult(rawText);
}

export async function parseListingFromUrl(url: string): Promise<ExtractListingResult> {
  try {
    const response = await fetch(url, {
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
    const parsed = buildResult(text, structuredFields);

    return {
      ...parsed,
      raw_listing_text: parsed.raw_listing_text || `Fetched ${url} but could not extract readable listing text.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";

    return {
      address: null,
      price: null,
      beds: null,
      baths: null,
      sqft: null,
      hoa_monthly: null,
      tax_annual: null,
      property_type: null,
      raw_listing_text: `Unable to fetch or parse ${url}. ${message}`,
      missing_fields: [...fieldNames],
    };
  }
}
