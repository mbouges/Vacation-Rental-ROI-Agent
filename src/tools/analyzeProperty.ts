import { z } from "zod";
import { AnalyzePropertyInput, InvestmentAssumptions } from "../models/assumptions.js";
import { Property } from "../models/property.js";
import { buildAnalysisExplanation } from "../services/analysisExplainer.js";
import { RoiAnalysis, calculateRoi } from "../services/roiCalculator.js";
import { ScenarioEngine } from "../services/scenarioEngine.js";

const analyzePropertySchema = z.object({
  property: z.object({
    address: z.string(),
    price: z.number().positive(),
    beds: z.number().nullable().optional(),
    baths: z.number().nullable().optional(),
    sqft: z.number().nullable().optional(),
    hoa_monthly: z.number().nullable().optional(),
    tax_annual: z.number().nullable().optional(),
    property_type: z.enum(["condo", "house", "townhouse"]).nullable().optional(),
    raw_listing_text: z.string().optional(),
    listing_url: z.string().url().optional(),
  }),
  assumptions: z.object({
    nightly_rate: z.number().nonnegative(),
    occupancy_rate: z.number().nonnegative(),
    management_rate: z.number().nonnegative(),
    maintenance_rate: z.number().nonnegative(),
    platform_fee_rate: z.number().nonnegative().optional(),
    insurance_annual: z.number().nonnegative(),
    utilities_annual: z.number().nonnegative(),
    loan_rate: z.number().nonnegative(),
    down_payment_percent: z.number().nonnegative(),
    loan_term_years: z.number().positive().optional(),
    closing_cost_percent: z.number().nonnegative().optional(),
  }),
});

export type AnalyzePropertyToolInput = AnalyzePropertyInput;

function toProperty(input: AnalyzePropertyInput["property"]): Property {
  return {
    address: input.address,
    price: input.price,
    beds: input.beds ?? null,
    baths: input.baths ?? null,
    sqft: input.sqft ?? null,
    hoaMonthly: input.hoa_monthly ?? null,
    taxAnnual: input.tax_annual ?? null,
    propertyType: input.property_type ?? null,
    rawListingText: input.raw_listing_text ?? "",
    listingUrl: input.listing_url,
  };
}

function toAssumptions(input: AnalyzePropertyInput["assumptions"]): InvestmentAssumptions {
  return {
    nightlyRate: input.nightly_rate,
    occupancyRate: input.occupancy_rate,
    managementRate: input.management_rate,
    maintenanceRate: input.maintenance_rate,
    platformFeeRate: input.platform_fee_rate ?? 0.03,
    insuranceAnnual: input.insurance_annual,
    utilitiesAnnual: input.utilities_annual,
    loanRate: input.loan_rate,
    downPaymentPercent: input.down_payment_percent,
    loanTermYears: input.loan_term_years ?? 30,
    closingCostPercent: input.closing_cost_percent ?? 0.03,
  };
}

export interface AnalyzePropertyResponse extends RoiAnalysis {
  analysis_id: string;
  explanation: string;
}

export function createAnalyzePropertyTool(scenarioEngine: ScenarioEngine) {
  return async function analyzeProperty(input: AnalyzePropertyToolInput): Promise<AnalyzePropertyResponse> {
    const parsed = analyzePropertySchema.parse(input);
    const property = toProperty(parsed.property);
    const assumptions = toAssumptions(parsed.assumptions);
    const analysis = calculateRoi(property, assumptions);
    const record = scenarioEngine.save(property, assumptions, analysis);

    return {
      analysis_id: record.id,
      explanation: buildAnalysisExplanation(property, assumptions, analysis),
      ...analysis,
    };
  };
}
