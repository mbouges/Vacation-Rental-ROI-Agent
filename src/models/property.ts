export type PropertyType = "condo" | "house" | "townhouse";
export type ExtractionConfidence = "low" | "medium" | "high";

export interface Property {
  address: string;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  hoaMonthly: number | null;
  taxAnnual: number | null;
  propertyType: PropertyType | null;
  rawListingText: string;
  listingUrl?: string;
}

export interface AssumptionPromptField {
  field: string;
  reason: string;
  suggested_value: number;
  question: string;
}

export interface AssumptionPromptGuidance {
  property_fields: {
    known: string[];
    missing: string[];
  };
  assumption_fields: {
    required: string[];
    missing: string[];
    suggested_defaults: Record<string, number>;
  };
  llm_prompt: {
    summary: string;
    follow_up_questions: string[];
    fields_to_confirm: AssumptionPromptField[];
  };
}

export interface ExtractListingResult {
  address: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  hoa_monthly: number | null;
  tax_annual: number | null;
  property_type: PropertyType | null;
  raw_listing_text: string;
  extracted_fields: string[];
  missing_fields: string[];
  extraction_confidence: ExtractionConfidence;
  site_domain: string | null;
  assumption_guidance: AssumptionPromptGuidance;
}
