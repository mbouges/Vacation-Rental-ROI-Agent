import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { InvestmentAssumptions } from "../models/assumptions.js";
import { Property } from "../models/property.js";
import { RoiAnalysis } from "./roiCalculator.js";

export interface AnalysisRecord {
  id: string;
  property: Property;
  assumptions: InvestmentAssumptions;
  analysis: RoiAnalysis;
  createdAt: string;
  updatedAt: string;
}

type StoredAnalyses = Record<string, AnalysisRecord>;

export function getDefaultAnalysisStorePath(): string {
  return resolve(process.cwd(), "data", "analyses.json");
}

export function generateAnalysisId(
  property: Property,
  assumptions: InvestmentAssumptions,
): string {
  const payload = {
    property: {
      address: property.address,
      price: property.price,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft,
      hoaMonthly: property.hoaMonthly,
      taxAnnual: property.taxAnnual,
      propertyType: property.propertyType,
      rawListingText: property.rawListingText,
      listingUrl: property.listingUrl ?? null,
    },
    assumptions: {
      nightlyRate: assumptions.nightlyRate,
      occupancyRate: assumptions.occupancyRate,
      managementRate: assumptions.managementRate,
      maintenanceRate: assumptions.maintenanceRate,
      platformFeeRate: assumptions.platformFeeRate,
      insuranceAnnual: assumptions.insuranceAnnual,
      utilitiesAnnual: assumptions.utilitiesAnnual,
      loanRate: assumptions.loanRate,
      downPaymentPercent: assumptions.downPaymentPercent,
      loanTermYears: assumptions.loanTermYears,
      closingCostPercent: assumptions.closingCostPercent,
    },
  };

  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
  return `analysis_${digest}`;
}

export class JsonAnalysisStore {
  constructor(private readonly filePath: string = getDefaultAnalysisStorePath()) {}

  get(id: string): AnalysisRecord | undefined {
    return this.readAll()[id];
  }

  save(params: {
    id: string;
    property: Property;
    assumptions: InvestmentAssumptions;
    analysis: RoiAnalysis;
  }): AnalysisRecord {
    const records = this.readAll();
    const existing = records[params.id];
    const now = new Date().toISOString();

    const record: AnalysisRecord = {
      id: params.id,
      property: params.property,
      assumptions: params.assumptions,
      analysis: params.analysis,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    records[params.id] = record;
    this.writeAll(records);

    return record;
  }

  private readAll(): StoredAnalyses {
    if (!existsSync(this.filePath)) {
      return {};
    }

    const raw = readFileSync(this.filePath, "utf8");
    if (!raw.trim()) {
      return {};
    }

    return JSON.parse(raw) as StoredAnalyses;
  }

  private writeAll(records: StoredAnalyses): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(records, null, 2));
  }
}
