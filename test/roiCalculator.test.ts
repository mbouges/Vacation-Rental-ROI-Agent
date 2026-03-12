import assert from "node:assert/strict";
import test from "node:test";
import { calculateRoi } from "../src/services/roiCalculator.js";
import { InvestmentAssumptions } from "../src/models/assumptions.js";
import { Property } from "../src/models/property.js";

const property: Property = {
  address: "123 Beach Ave, Gulf Shores, AL",
  price: 420000,
  beds: 2,
  baths: 2,
  sqft: 1100,
  hoaMonthly: 850,
  taxAnnual: 4200,
  propertyType: "condo",
  rawListingText: "Beachfront condo",
};

const assumptions: InvestmentAssumptions = {
  nightlyRate: 225,
  occupancyRate: 0.58,
  managementRate: 0.2,
  maintenanceRate: 0.08,
  platformFeeRate: 0.03,
  insuranceAnnual: 1800,
  utilitiesAnnual: 3600,
  loanRate: 0.0675,
  downPaymentPercent: 0.2,
  loanTermYears: 30,
  closingCostPercent: 0.03,
};

test("calculateRoi returns expected core metrics", () => {
  const result = calculateRoi(property, assumptions);

  assert.equal(result.gross_revenue, 47632.5);
  assert.equal(result.noi, 13066.42);
  assert.equal(result.annual_cash_flow, -13085.06);
  assert.equal(result.break_even_occupancy, 0.7393);
  assert.equal(result.total_expense_breakdown.mortgage, 26151.48);
});
