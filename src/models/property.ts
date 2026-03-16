export type PropertyType = "condo" | "house" | "townhouse";
export type ExtractionConfidence = "low" | "medium" | "high";
export type FetchStatus = "not_applicable" | "success" | "blocked" | "error";
export type ParseStatus = "success" | "partial" | "failed" | "corrupt";

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
  suggested_value: number | null;
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

export interface ManualEntryPrompt {
  reason: string;
  next_step: string;
  preferred_input: "paste_listing_text";
  required_property_facts: string[];
  helpful_property_facts: string[];
  optional_assumptions: string[];
  requested_property_fields: string[];
  suggested_user_prompt: string;
  follow_up_questions: string[];
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
  fetch_status: FetchStatus;
  parse_status: ParseStatus;
  site_domain: string | null;
  invalid_fields: string[];
  assumption_guidance: AssumptionPromptGuidance;
  manual_entry_prompt: ManualEntryPrompt | null;
}
