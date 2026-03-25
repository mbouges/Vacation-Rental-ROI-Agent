import { buildAssumptionGuidance } from "../assumptionPrompter.js";
import {
  ExtractListingResult,
  ExtractionConfidence,
  ExtractionFieldName,
  ExtractionFieldProvenanceMap,
  ExtractionFieldSource,
  FetchStatus,
  ManualEntryPrompt,
  ParseStatus,
  PropertyType,
} from "../../models/property.js";

const fieldNames: ExtractionFieldName[] = [
  "address",
  "price",
  "beds",
  "baths",
  "sqft",
  "hoa_monthly",
  "tax_annual",
  "property_type",
];

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
    | "field_provenance"
    | "assumption_guidance"
    | "manual_entry_prompt"
  >
>;

type ListingFieldValue = NonNullable<PartialListingFields[ExtractionFieldName]>;

export interface ListingFieldCandidate {
  value: ListingFieldValue;
  source: ExtractionFieldSource;
  confidence: ExtractionConfidence;
}

export type ListingFieldCandidates = Partial<Record<ExtractionFieldName, ListingFieldCandidate>>;

type JsonRecord = Record<string, unknown>;

type BuildResultOptions = {
  siteDomain?: string | null;
  fetchStatus?: FetchStatus;
  primaryCandidates?: ListingFieldCandidates;
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

function extractHoaMonthly(text: string): number | null {
  const patterns = [
    /\$([\d,]+(?:\.\d+)?)\s*(?:\/\s*month|per month|monthly)\s*(?:hoa|hoa dues|hoa fee|hoa fees)\b/i,
    /(?:hoa|hoa dues|hoa fee|hoa fees)\b[^$\d]{0,20}\$([\d,]+(?:\.\d+)?)\s*(?:\/\s*month|per month|monthly)?/i,
    /(?:monthly hoa)\b[^$\d]{0,20}\$?([\d,]+(?:\.\d+)?)/i,
  ];

  return matchNumber(patterns, text);
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

function createCandidate(
  value: PartialListingFields[ExtractionFieldName] | null | undefined,
  source: ExtractionFieldSource,
  confidence: ExtractionConfidence,
): ListingFieldCandidate | null {
  if (value == null) {
    return null;
  }

  return {
    value: value as ListingFieldValue,
    source,
    confidence,
  };
}

export function buildFieldCandidates(
  fields: PartialListingFields,
  source: ExtractionFieldSource,
  confidence: ExtractionConfidence,
): ListingFieldCandidates {
  const candidates: ListingFieldCandidates = {};

  for (const field of fieldNames) {
    const candidate = createCandidate(fields[field], source, confidence);
    if (candidate) {
      candidates[field] = candidate;
    }
  }

  return candidates;
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

export function extractStructuredListingCandidates(html: string): ListingFieldCandidates {
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

  return buildFieldCandidates(result, "structured_data", "high");
}

export function extractStructuredListingFields(html: string): PartialListingFields {
  return candidatesToFields(extractStructuredListingCandidates(html));
}

function buildHeuristicFields(rawText: string): PartialListingFields {
  return {
    address: extractAddress(rawText),
    price: matchNumber([/(?:list price|price)[:\s]*\$([\d,]+(?:\.\d+)?)/i, /\$([\d,]+(?:\.\d+)?)/], rawText),
    beds: matchNumber(
      [
        /(?:beds?|bedrooms?)[:\s]+(\d+(?:\.\d+)?)/i,
        /(\d+(?:\.\d+)?)\s*(?:bed|beds|br)\b/i,
        /(\d+(?:\.\d+)?)\s*-\s*bedroom\b/i,
        /(\d+(?:\.\d+)?)\s*bedroom\b/i,
      ],
      rawText,
    ),
    baths: matchNumber([/(?:baths?|bathrooms?)[:\s]+(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)\s*(?:bath|baths|ba)\b/i], rawText),
    sqft: matchNumber([/(?:sq\.?\s*ft|sqft|square feet)[:\s]+([\d,]+)/i, /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)\b/i], rawText),
    hoa_monthly: extractHoaMonthly(rawText),
    tax_annual: matchNumber([
      /(?:property )?tax(?:es)?[^$\d]*\$?([\d,]+(?:\.\d+)?)\s*(?:\/\s*year|per year|annual|yearly)?/i,
      /annual taxes?[^$\d]*\$?([\d,]+(?:\.\d+)?)/i,
    ], rawText),
    property_type: matchPropertyType(rawText),
  };
}

function buildHeuristicCandidates(rawText: string): ListingFieldCandidates {
  return buildFieldCandidates(buildHeuristicFields(rawText), "heuristic_text", "medium");
}

function candidatesToFields(candidates: ListingFieldCandidates): PartialListingFields {
  const fields: PartialListingFields = {};

  for (const field of fieldNames) {
    const candidate = candidates[field];
    if (candidate) {
      fields[field] = candidate.value as never;
    }
  }

  return fields;
}

function mergeListingCandidates(primary: ListingFieldCandidates, fallback: ListingFieldCandidates): ListingFieldCandidates {
  const merged: ListingFieldCandidates = {};

  for (const field of fieldNames) {
    merged[field] = primary[field] ?? fallback[field];
  }

  return merged;
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

function sanitizeCandidates(candidates: ListingFieldCandidates): {
  sanitized: PartialListingFields;
  invalidFields: string[];
  fieldProvenance: ExtractionFieldProvenanceMap;
} {
  const sanitizedCandidates: ListingFieldCandidates = { ...candidates };
  const invalidFields: string[] = [];

  if (isPollutedAddress((sanitizedCandidates.address?.value as string | null | undefined) ?? null)) {
    delete sanitizedCandidates.address;
    invalidFields.push("address");
  }

  if (typeof sanitizedCandidates.sqft?.value === "number" && sanitizedCandidates.sqft.value <= 0) {
    delete sanitizedCandidates.sqft;
    invalidFields.push("sqft");
  }

  if (typeof sanitizedCandidates.price?.value === "number" && sanitizedCandidates.price.value < 10000) {
    delete sanitizedCandidates.price;
    invalidFields.push("price");
  }

  if (typeof sanitizedCandidates.beds?.value === "number" && sanitizedCandidates.beds.value > 20) {
    delete sanitizedCandidates.beds;
    invalidFields.push("beds");
  }

  if (typeof sanitizedCandidates.baths?.value === "number" && sanitizedCandidates.baths.value > 20) {
    delete sanitizedCandidates.baths;
    invalidFields.push("baths");
  }

  if (
    typeof sanitizedCandidates.tax_annual?.value === "number" &&
    typeof sanitizedCandidates.price?.value === "number" &&
    Math.abs(sanitizedCandidates.tax_annual.value - sanitizedCandidates.price.value) /
      Math.max(sanitizedCandidates.price.value, 1) <
      0.05
  ) {
    delete sanitizedCandidates.tax_annual;
    invalidFields.push("tax_annual");
  }

  const fieldProvenance = fieldNames.reduce<ExtractionFieldProvenanceMap>((acc, field) => {
    const originalCandidate = candidates[field];
    const sanitizedCandidate = sanitizedCandidates[field];

    if (!originalCandidate) {
      acc[field] = {
        source: "missing",
        confidence: "none",
        status: "missing",
      };
      return acc;
    }

    if (!sanitizedCandidate) {
      acc[field] = {
        source: originalCandidate.source,
        confidence: "low",
        status: "invalid",
      };
      return acc;
    }

    acc[field] = {
      source: sanitizedCandidate.source,
      confidence: sanitizedCandidate.confidence,
      status: "extracted",
    };
    return acc;
  }, {} as ExtractionFieldProvenanceMap);

  return { sanitized: candidatesToFields(sanitizedCandidates), invalidFields, fieldProvenance };
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
  const requiredPropertyFacts = ["address", "price"];
  const helpfulPropertyFacts = ["beds", "baths", "sqft", "property_type", "hoa_monthly", "tax_annual"];
  const optionalAssumptions = [
    "nightly_rate",
    "occupancy_rate",
    "insurance_annual",
    "utilities_annual",
    "loan_rate",
    "down_payment_percent",
  ];

  const reason =
    result.fetch_status === "blocked"
      ? `The source site${result.site_domain ? ` (${result.site_domain})` : ""} blocked automated extraction.`
      : result.parse_status === "corrupt"
        ? "The page was fetched, but some extracted values were unreliable and need confirmation before analysis."
        : result.fetch_status === "error"
          ? "The listing could not be fetched reliably, so I could not extract enough trusted property facts."
          : result.extraction_confidence === "low" && result.extracted_fields.length > 0
            ? "I found a few listing details, but the result is still too low-confidence to trust without manual confirmation."
            : "The page did not produce enough reliable property details to continue automatically.";

  const nextStep =
    result.fetch_status === "blocked" || result.fetch_status === "error"
      ? "Paste the listing text if you have it. If not, send the address and asking price first."
      : "Paste the listing text or confirm the address and asking price so I can continue with ROI analysis.";

  const suggestedUserPrompt =
    result.fetch_status === "blocked" || result.fetch_status === "error"
      ? "Please paste the listing description first. If you do not have it, send the address and asking price, then any beds, baths, sqft, property type, HOA, and annual taxes you can find."
      : "Please paste the listing description or confirm the address and asking price first. After that, share any available beds, baths, sqft, property type, HOA, and annual taxes.";

  return {
    reason,
    next_step: nextStep,
    preferred_input: "paste_listing_text",
    required_property_facts: requiredPropertyFacts,
    helpful_property_facts: helpfulPropertyFacts,
    optional_assumptions: optionalAssumptions,
    requested_property_fields: [...requiredPropertyFacts, ...helpfulPropertyFacts],
    suggested_user_prompt: suggestedUserPrompt,
    follow_up_questions: [
      "Can you paste the listing text?",
      "If not, what is the property address?",
      "What is the asking price?",
      "If available, how many beds and baths does it have?",
      "If available, what are the square footage, property type, HOA dues, and annual taxes?",
    ],
  };
}

export function buildListingResult(
  rawText: string,
  structuredFields: PartialListingFields = {},
  options: BuildResultOptions = {},
): ExtractListingResult {
  const normalizedText = rawText.replace(/\s+/g, " ").trim();
  const heuristicCandidates = buildHeuristicCandidates(rawText);
  const primaryCandidates = options.primaryCandidates ?? buildFieldCandidates(structuredFields, "structured_data", "high");
  const mergedCandidates = mergeListingCandidates(primaryCandidates, heuristicCandidates);
  const { sanitized, invalidFields, fieldProvenance } = sanitizeCandidates(mergedCandidates);

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
    field_provenance: fieldProvenance,
  };

  const usable = isExtractionUsable(partialResult);
  const needsFallbackWorkflow = !usable || partialResult.extraction_confidence === "low";
  const allowSuggestedDefaults = usable && partialResult.extraction_confidence !== "low";

  return {
    ...partialResult,
    assumption_guidance: buildAssumptionGuidance(partialResult, { allowSuggestedDefaults }),
    manual_entry_prompt: needsFallbackWorkflow ? buildManualEntryPrompt(partialResult) : null,
  };
}
