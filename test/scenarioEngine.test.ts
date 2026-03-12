import assert from "node:assert/strict";
import test from "node:test";
import { calculateRoi } from "../src/services/roiCalculator.js";
import { ScenarioEngine } from "../src/services/scenarioEngine.js";
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

test("ScenarioEngine treats 'drops to 50%' as absolute occupancy", () => {
  const engine = new ScenarioEngine();
  const analysis = calculateRoi(property, assumptions);
  const record = engine.save(property, assumptions, analysis);

  const followup = engine.answerFollowup(record.id, "What if occupancy drops to 50%?");

  assert.equal(followup.updated_assumptions.occupancyRate, 0.5);
  assert.match(followup.explanation, /50.0% occupancy/);
});

test("ScenarioEngine treats 'drops by 10%' as relative occupancy decline", () => {
  const engine = new ScenarioEngine();
  const analysis = calculateRoi(property, assumptions);
  const record = engine.save(property, assumptions, analysis);

  const followup = engine.answerFollowup(record.id, "What if occupancy drops by 10%?");

  assert.equal(followup.updated_assumptions.occupancyRate, 0.522);
});

test("ScenarioEngine updates nightly rate from dollar question", () => {
  const engine = new ScenarioEngine();
  const analysis = calculateRoi(property, assumptions);
  const record = engine.save(property, assumptions, analysis);

  const followup = engine.answerFollowup(record.id, "What if nightly rate is $200?");

  assert.equal(followup.updated_assumptions.nightlyRate, 200);
});
