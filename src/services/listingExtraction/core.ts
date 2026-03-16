import { buildAssumptionGuidance } from "../assumptionPrompter.js";
import {
  ExtractListingResult,
  ExtractionConfidence,
  FetchStatus,
  ManualEntryPrompt,
  ParseStatus,
  PropertyType,
} from "../../models/property.js";

const fieldNames: Array<
  keyof Omit<
    ExtractListingResult,
    | "raw_listing_text"
    | "extracted_fields"
    | "missing_fields"
    | "extraction_confidence"
    | "fetch_status"
    | "parse_status"
    | "site_domain"
    | "invalid_fields"
    | "assumption_guidance"
    | "manual_entry_prompt"
  >
> = ["address", "price", "beds", "baths", "sqft", "hoa_monthly", "tax_annual", "property_type"];

export type PartialListingFields = Partial<
  Omit<
    ExtractListingResult,
    | "raw_listing_text"
    | "extracted_fields"
    | "missing_fields"
    | "extraction_confidence"
    | "fetch_status"
    | "parse_status"
    | "site_domain"
    | "invalid_fields"
    | "assumption_guidance"
    | "manual_entry_prompt"
  >
>;

type JsonRecord = Record<string, unknown>;

type BuildResultOptions = {
  siteDomain?: string | null;
  fetchStatus?: FetchStatus;
};

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

  if (normalized.includes("house") || normalized.includes("single family") || normalized.includes("single-family")) {
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

export function htmlToText(html: string): string {
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

  const parts = [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode]
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

export function extractStructuredListingFields(html: string): PartialListingFields {
  const objects = extractJsonLdObjects(html);
  const result: PartialListingFields = {};

  for (const obj of objects) {
    const typeValue = obj["@type"];
    const types = Array.isArray(typeValue)
      ? typeValue.filter((value): value is string => typeof value === "string")
      : [typeValue].filter((value): value is string => typeof value === "string");
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
    price: matchNumber([/(?:list price|price)[:\s]*\$([\d,]+(?:\.\d+)?)/i, /\$([\d,]+(?:\.\d+)?)/], rawText),
    beds: matchNumber([/(?:beds?|bedrooms?)[:\s]+(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)\s*(?:bed|beds|br)\b/i], rawText),
    baths: matchNumber([/(?:baths?|bathrooms?)[:\s]+(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)\s*(?:bath|baths|ba)\b/i], rawText),
    sqft: matchNumber([/(?:sq\.?\s*ft|sqft|square feet)[:\s]+([\d,]+)/i, /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)\b/i], rawText),
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

function isPollutedAddress(address: string | null): boolean {
  if (!address) {
    return false;
  }

  const normalized = address.toLowerCase();
  const badPhrases = [
    "terms of use",
    "privacy policy",
    "contact us",
    "copyright",
    "follow us",
    "all information is deemed reliable",
    "do not call",
  ];

  if (address.length > 120) {
    return true;
  }

  return badPhrases.some((phrase) => normalized.includes(phrase));
}

function sanitizeFields(fields: PartialListingFields): { sanitized: PartialListingFields; invalidFields: string[] } {
  const sanitized: PartialListingFields = { ...fields };
  const invalidFields: string[] = [];

  if (isPollutedAddress(sanitized.address ?? null)) {
    sanitized.address = null;
    invalidFields.push("address");
  }

  if (sanitized.price != null && sanitized.price < 10000) {
    sanitized.price = null;
    invalidFields.push("price");
  }

  if (sanitized.beds != null && sanitized.beds > 20) {
    sanitized.beds = null;
    invalidFields.push("beds");
  }

  if (sanitized.baths != null && sanitized.baths > 20) {
    sanitized.baths = null;
    invalidFields.push("baths");
  }

  if (sanitized.sqft != null && sanitized.sqft <= 0) {
    sanitized.sqft = null;
    invalidFields.push("sqft");
  }

  if (
    sanitized.tax_annual != null &&
    sanitized.price != null &&
    Math.abs(sanitized.tax_annual - sanitized.price) / Math.max(sanitized.price, 1) < 0.05
  ) {
    sanitized.tax_annual = null;
    invalidFields.push("tax_annual");
  }

  return { sanitized, invalidFields };
}

function computeConfidence(params: {
  extractedFields: string[];
  invalidFields: string[];
  fetchStatus: FetchStatus;
  parseStatus: ParseStatus;
}): ExtractionConfidence {
  if (params.fetchStatus === "blocked" || params.fetchStatus === "error") {
    return "low";
  }

  if (params.parseStatus === "failed" || params.parseStatus === "corrupt") {
    return "low";
  }

  if (params.invalidFields.length > 0) {
    return "low";
  }

  if (params.extractedFields.length >= 6) {
    return "high";
  }

  if (params.extractedFields.length >= 3) {
    return "medium";
  }

  return "low";
}

function deriveParseStatus(extractedFields: string[], invalidFields: string[]): ParseStatus {
  if (extractedFields.length === 0) {
    return "failed";
  }

  if (invalidFields.length > 0) {
    return extractedFields.length >= 2 ? "corrupt" : "failed";
  }

  if (extractedFields.length === fieldNames.length) {
    return "success";
  }

  return "partial";
}

export function extractSiteDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

export function deriveFetchStatus(errorMessage: string): FetchStatus {
  if (/403|429|forbidden|blocked/i.test(errorMessage)) {
    return "blocked";
  }

  return "error";
}

export function isExtractionUsable(result: {
  extracted_fields: string[];
  parse_status: ParseStatus;
  fetch_status: FetchStatus;
}): boolean {
  if (result.fetch_status === "blocked" || result.fetch_status === "error") {
    return false;
  }

  if (result.parse_status === "failed" || result.parse_status === "corrupt") {
    return false;
  }

  return result.extracted_fields.length >= 2;
}

function buildManualEntryPrompt(result: {
  fetch_status: FetchStatus;
  parse_status: ParseStatus;
  extraction_confidence: ExtractionConfidence;
  site_domain: string | null;
  extracted_fields: string[];
  missing_fields: string[];
  invalid_fields: string[];
}): ManualEntryPrompt {
  const reason =
    result.fetch_status === "blocked"
      ? `The source site${result.site_domain ? ` (${result.site_domain})` : ""} blocked automated extraction.`
      : result.parse_status === "corrupt"
        ? "The page was fetched, but some extracted values were unreliable and need confirmation before analysis."
        : result.extraction_confidence === "low" && result.extracted_fields.length > 0
          ? "I found a few listing details, but the result is still too low-confidence to trust without manual confirmation."
          : "The page did not produce enough reliable property details to continue automatically.";

  const suggestedUserPrompt =
    result.fetch_status === "blocked"
      ? "This site blocked automated extraction. Please paste the listing description or share the address, asking price, beds, baths, sqft, property type, HOA, and annual taxes so I can continue."
      : result.invalid_fields.length > 0 || result.extracted_fields.length > 0
        ? "I found some listing details, but please confirm the core property facts and fill in anything missing: address, asking price, beds, baths, sqft, property type, HOA, and annual taxes."
        : "Please paste the listing description or provide the address, asking price, beds, baths, sqft, property type, HOA, and annual taxes so I can continue the analysis.";

  return {
    reason,
    requested_property_fields: ["address", "price", "beds", "baths", "sqft", "property_type", "hoa_monthly", "tax_annual"],
    suggested_user_prompt: suggestedUserPrompt,
    follow_up_questions: [
      "What is the property address?",
      "What is the asking price?",
      "How many beds and baths does it have?",
      "What is the square footage?",
      "What is the property type?",
      "If available, what are the monthly HOA dues and annual property taxes?",
    ],
  };
}

export function buildListingResult(
  rawText: string,
  structuredFields: PartialListingFields = {},
  options: BuildResultOptions = {},
): ExtractListingResult {
  const normalizedText = rawText.replace(/\s+/g, " ").trim();
  const heuristicFields = buildHeuristicFields(rawText);
  const mergedFields = mergeListingFields(structuredFields, heuristicFields);
  const { sanitized, invalidFields } = sanitizeFields(mergedFields);

  const extractedFields = fieldNames.filter((field) => sanitized[field] != null).map((field) => field as string);
  const missingFields = fieldNames.filter((field) => sanitized[field] == null).map((field) => field as string);
  const fetchStatus = options.fetchStatus ?? "not_applicable";
  const parseStatus = deriveParseStatus(extractedFields, invalidFields);

  const partialResult = {
    address: sanitized.address ?? null,
    price: sanitized.price ?? null,
    beds: sanitized.beds ?? null,
    baths: sanitized.baths ?? null,
    sqft: sanitized.sqft ?? null,
    hoa_monthly: sanitized.hoa_monthly ?? null,
    tax_annual: sanitized.tax_annual ?? null,
    property_type: sanitized.property_type ?? null,
    raw_listing_text: normalizedText,
    extracted_fields: extractedFields,
    missing_fields: missingFields,
    extraction_confidence: computeConfidence({ extractedFields, invalidFields, fetchStatus, parseStatus }),
    fetch_status: fetchStatus,
    parse_status: parseStatus,
    site_domain: options.siteDomain ?? null,
    invalid_fields: invalidFields,
  };

  const usable = isExtractionUsable(partialResult);
  const allowSuggestedDefaults = usable && partialResult.extraction_confidence !== "low";

  return {
    ...partialResult,
    assumption_guidance: buildAssumptionGuidance(partialResult, { allowSuggestedDefaults }),
    manual_entry_prompt: allowSuggestedDefaults ? null : buildManualEntryPrompt(partialResult),
  };
}
