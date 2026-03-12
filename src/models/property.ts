export type PropertyType = "condo" | "house" | "townhouse";

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
  missing_fields: string[];
}
