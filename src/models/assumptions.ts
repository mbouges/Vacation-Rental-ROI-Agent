export interface InvestmentAssumptions {
  nightlyRate: number;
  occupancyRate: number;
  managementRate: number;
  maintenanceRate: number;
  platformFeeRate: number;
  insuranceAnnual: number;
  utilitiesAnnual: number;
  loanRate: number;
  downPaymentPercent: number;
  loanTermYears: number;
  closingCostPercent: number;
}

export interface AnalyzePropertyInput {
  property: {
    address: string;
    price: number;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    hoa_monthly?: number | null;
    tax_annual?: number | null;
    property_type?: "condo" | "house" | "townhouse" | null;
    raw_listing_text?: string;
    listing_url?: string;
  };
  assumptions: {
    nightly_rate: number;
    occupancy_rate: number;
    management_rate: number;
    maintenance_rate: number;
    platform_fee_rate?: number;
    insurance_annual: number;
    utilities_annual: number;
    loan_rate: number;
    down_payment_percent: number;
    loan_term_years?: number;
    closing_cost_percent?: number;
  };
}
