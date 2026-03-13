import { AssumptionPromptGuidance, AssumptionPromptField, PropertyType } from "../models/property.js";

export interface ListingSnapshot {
  address: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  hoa_monthly: number | null;
  tax_annual: number | null;
  property_type: PropertyType | null;
}

const requiredAssumptionFields = [
  "nightly_rate",
  "occupancy_rate",
  "management_rate",
  "maintenance_rate",
  "platform_fee_rate",
  "insurance_annual",
  "utilities_annual",
  "loan_rate",
  "down_payment_percent",
  "loan_term_years",
  "closing_cost_percent",
] as const;

const propertyFieldNames = [
  "address",
  "price",
  "beds",
  "baths",
  "sqft",
  "hoa_monthly",
  "tax_annual",
  "property_type",
] as const;

function roundMoney(value: number): number {
  return Math.round(value / 25) * 25;
}

function propertyTypeMultiplier(propertyType: PropertyType | null, map: Record<PropertyType, number>, fallback: number): number {
  if (!propertyType) {
    return fallback;
  }

  return map[propertyType];
}

function suggestNightlyRate(result: ListingSnapshot): number {
  const baseFromPrice = (result.price ?? 350000) * propertyTypeMultiplier(
    result.property_type,
    { condo: 0.00055, townhouse: 0.0006, house: 0.0007 },
    0.0006,
  );
  const bedroomLift = Math.max(0, ((result.beds ?? 2) - 1) * 20);
  return roundMoney(Math.max(125, baseFromPrice + bedroomLift));
}

function suggestOccupancyRate(result: ListingSnapshot): number {
  if (result.property_type === "condo") {
    return 0.6;
  }

  if (result.property_type === "house") {
    return 0.55;
  }

  return 0.58;
}

function suggestInsuranceAnnual(result: ListingSnapshot): number {
  const price = result.price ?? 350000;
  const multiplier = propertyTypeMultiplier(
    result.property_type,
    { condo: 0.003, townhouse: 0.0035, house: 0.0045 },
    0.0035,
  );
  return roundMoney(Math.max(1200, price * multiplier));
}

function suggestUtilitiesAnnual(result: ListingSnapshot): number {
  const sqft = result.sqft ?? 1100;
  const base = propertyTypeMultiplier(
    result.property_type,
    { condo: 1800, townhouse: 2400, house: 3000 },
    2200,
  );
  const perSqft = propertyTypeMultiplier(
    result.property_type,
    { condo: 0.9, townhouse: 1.1, house: 1.35 },
    1,
  );
  return roundMoney(base + sqft * perSqft);
}

export function buildAssumptionGuidance(
  result: ListingSnapshot,
  options: { allowSuggestedDefaults?: boolean } = {},
): AssumptionPromptGuidance {
  const allowSuggestedDefaults = options.allowSuggestedDefaults ?? true;
  const fullSuggestedDefaults = {
    nightly_rate: suggestNightlyRate(result),
    occupancy_rate: suggestOccupancyRate(result),
    management_rate: 0.2,
    maintenance_rate: 0.08,
    platform_fee_rate: 0.03,
    insurance_annual: suggestInsuranceAnnual(result),
    utilities_annual: suggestUtilitiesAnnual(result),
    loan_rate: 0.0675,
    down_payment_percent: 0.2,
    loan_term_years: 30,
    closing_cost_percent: 0.03,
  };
  const suggestedDefaults = allowSuggestedDefaults ? fullSuggestedDefaults : {};

  const propertyKnown: string[] = propertyFieldNames.filter((field) => result[field] != null) as unknown as string[];
  const propertyMissing: string[] = propertyFieldNames.filter((field) => result[field] == null) as unknown as string[];

  const fieldsToConfirm: AssumptionPromptField[] = [
    {
      field: "nightly_rate",
      reason: "Nightly rate drives gross revenue and break-even occupancy.",
      suggested_value: allowSuggestedDefaults ? fullSuggestedDefaults.nightly_rate : null,
      question: allowSuggestedDefaults
        ? `What nightly rate do you want to assume? A reasonable starting point is about $${fullSuggestedDefaults.nightly_rate}.`
        : "What nightly rate should we use once the property details are confirmed?",
    },
    {
      field: "occupancy_rate",
      reason: "Occupancy determines how often the property is booked.",
      suggested_value: allowSuggestedDefaults ? fullSuggestedDefaults.occupancy_rate : null,
      question: allowSuggestedDefaults
        ? `What occupancy rate should we use? A reasonable baseline is ${(fullSuggestedDefaults.occupancy_rate * 100).toFixed(0)}%.`
        : "What occupancy rate should we assume once the property details are confirmed?",
    },
    {
      field: "insurance_annual",
      reason: "Insurance is a fixed annual operating cost that affects NOI.",
      suggested_value: allowSuggestedDefaults ? fullSuggestedDefaults.insurance_annual : null,
      question: allowSuggestedDefaults
        ? `Do you want to use an annual insurance estimate around $${fullSuggestedDefaults.insurance_annual}?`
        : "What annual insurance estimate should we use after the property details are confirmed?",
    },
    {
      field: "utilities_annual",
      reason: "Utilities meaningfully affect operating costs for short-term rentals.",
      suggested_value: allowSuggestedDefaults ? fullSuggestedDefaults.utilities_annual : null,
      question: allowSuggestedDefaults
        ? `Should we estimate annual utilities at about $${fullSuggestedDefaults.utilities_annual}?`
        : "What annual utilities estimate should we use after the property details are confirmed?",
    },
    {
      field: "loan_rate",
      reason: "Financing assumptions change mortgage cost and cash flow.",
      suggested_value: allowSuggestedDefaults ? fullSuggestedDefaults.loan_rate : null,
      question: allowSuggestedDefaults
        ? `What loan interest rate should we use? A placeholder is ${(fullSuggestedDefaults.loan_rate * 100).toFixed(2)}%.`
        : "What loan interest rate should we use?",
    },
    {
      field: "down_payment_percent",
      reason: "Down payment changes leverage, mortgage payment, and cash-on-cash return.",
      suggested_value: allowSuggestedDefaults ? fullSuggestedDefaults.down_payment_percent : null,
      question: allowSuggestedDefaults
        ? `What down payment percent should we use? A common baseline is ${(fullSuggestedDefaults.down_payment_percent * 100).toFixed(0)}%.`
        : "What down payment percent should we use?",
    },
  ];

  return {
    property_fields: {
      known: propertyKnown,
      missing: propertyMissing,
    },
    assumption_fields: {
      required: [...requiredAssumptionFields],
      missing: [...requiredAssumptionFields],
      suggested_defaults: suggestedDefaults,
    },
    llm_prompt: {
      summary: allowSuggestedDefaults
        ? "Use the extracted property fields as facts, treat the assumption fields as user-confirmed inputs, and ask concise follow-up questions for any assumptions before running ROI analysis."
        : "Extraction did not produce enough trustworthy property facts. Ask the user for missing property details first, then gather investment assumptions.",
      follow_up_questions: fieldsToConfirm.map((field) => field.question),
      fields_to_confirm: fieldsToConfirm,
    },
  };
}
