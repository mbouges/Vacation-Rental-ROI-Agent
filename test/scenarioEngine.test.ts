import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { calculateRoi } from "../src/services/roiCalculator.js";
import { JsonAnalysisStore } from "../src/services/analysisStore.js";
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

function createTestEngine() {
  const dir = mkdtempSync(join(tmpdir(), "vacation-roi-agent-"));
  const storePath = join(dir, "analyses.json");
  const store = new JsonAnalysisStore(storePath);
  return {
    dir,
    storePath,
    engine: new ScenarioEngine(store),
  };
}

test("ScenarioEngine generates stable analysis IDs for the same inputs", () => {
  const { engine } = createTestEngine();
  const analysis = calculateRoi(property, assumptions);

  const first = engine.save(property, assumptions, analysis);
  const second = engine.save(property, assumptions, analysis);

  assert.equal(first.id, second.id);
});

test("ScenarioEngine persists property, assumptions, and analysis results", () => {
  const { engine, storePath } = createTestEngine();
  const analysis = calculateRoi(property, assumptions);
  const record = engine.save(property, assumptions, analysis);

  const stored = JSON.parse(readFileSync(storePath, "utf8")) as Record<string, unknown>;
  const persisted = stored[record.id] as {
    property: Property;
    assumptions: InvestmentAssumptions;
    analysis: ReturnType<typeof calculateRoi>;
  };

  assert.equal(persisted.property.address, property.address);
  assert.equal(persisted.assumptions.nightlyRate, assumptions.nightlyRate);
  assert.equal(persisted.analysis.annual_cash_flow, analysis.annual_cash_flow);
});

test("ScenarioEngine can answer follow-ups from a fresh engine instance", () => {
  const { storePath } = createTestEngine();
  const firstEngine = new ScenarioEngine(new JsonAnalysisStore(storePath));
  const analysis = calculateRoi(property, assumptions);
  const record = firstEngine.save(property, assumptions, analysis);

  const secondEngine = new ScenarioEngine(new JsonAnalysisStore(storePath));
  const followup = secondEngine.answerFollowup(record.id, "What if occupancy drops to 50%?");

  assert.equal(followup.updated_assumptions.occupancyRate, 0.5);
  assert.match(followup.explanation, /Assumed occupancy is 50.0%/);
});

test("ScenarioEngine treats 'drops by 10%' as relative occupancy decline", () => {
  const { engine } = createTestEngine();
  const analysis = calculateRoi(property, assumptions);
  const record = engine.save(property, assumptions, analysis);

  const followup = engine.answerFollowup(record.id, "What if occupancy drops by 10%?");

  assert.equal(followup.updated_assumptions.occupancyRate, 0.522);
});

test("ScenarioEngine updates nightly rate from dollar question", () => {
  const { engine } = createTestEngine();
  const analysis = calculateRoi(property, assumptions);
  const record = engine.save(property, assumptions, analysis);

  const followup = engine.answerFollowup(record.id, "What if nightly rate is $200?");

  assert.equal(followup.updated_assumptions.nightlyRate, 200);
});

