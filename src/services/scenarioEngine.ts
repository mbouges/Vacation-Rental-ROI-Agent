import { InvestmentAssumptions } from "../models/assumptions.js";
import { Property } from "../models/property.js";
import { buildAnalysisExplanation } from "./analysisExplainer.js";
import { AnalysisRecord, JsonAnalysisStore, generateAnalysisId } from "./analysisStore.js";
import { RoiAnalysis, calculateRoi, normalizeOccupancyRate, normalizePercent } from "./roiCalculator.js";

export interface FollowupResponse {
  analysis_id: string;
  question: string;
  updated_assumptions: InvestmentAssumptions;
  analysis: RoiAnalysis;
  explanation: string;
}

export class ScenarioEngine {
  private readonly analyses = new Map<string, AnalysisRecord>();

  constructor(private readonly analysisStore: JsonAnalysisStore = new JsonAnalysisStore()) {}

  save(property: Property, assumptions: InvestmentAssumptions, analysis: RoiAnalysis): AnalysisRecord {
    const id = generateAnalysisId(property, assumptions);
    const record = this.analysisStore.save({ id, property, assumptions, analysis });
    this.analyses.set(id, record);
    return record;
  }

  get(id: string): AnalysisRecord | undefined {
    const cached = this.analyses.get(id);
    if (cached) {
      return cached;
    }

    const stored = this.analysisStore.get(id);
    if (stored) {
      this.analyses.set(id, stored);
    }

    return stored;
  }

  answerFollowup(analysisId: string, question: string): FollowupResponse {
    const record = this.get(analysisId);
    if (!record) {
      throw new Error(`Unknown analysis_id: ${analysisId}`);
    }

    const updatedAssumptions = this.applyQuestionToAssumptions(record.assumptions, question);
    const analysis = calculateRoi(record.property, updatedAssumptions);

    const updatedRecord = this.analysisStore.save({
      id: analysisId,
      property: record.property,
      assumptions: updatedAssumptions,
      analysis,
    });
    this.analyses.set(analysisId, updatedRecord);

    return {
      analysis_id: analysisId,
      question,
      updated_assumptions: updatedAssumptions,
      analysis,
      explanation: buildAnalysisExplanation(record.property, updatedAssumptions, analysis),
    };
  }

  private applyQuestionToAssumptions(
    assumptions: InvestmentAssumptions,
    question: string,
  ): InvestmentAssumptions {
    const normalizedQuestion = question.toLowerCase();
    const percentValue = this.extractPercent(question);
    const dollarValue = this.extractDollar(question);

    if (normalizedQuestion.includes("occupancy")) {
      if ((normalizedQuestion.includes("drop by") || normalizedQuestion.includes("drops by")) && percentValue != null) {
        const current = normalizeOccupancyRate(assumptions.occupancyRate);
        return { ...assumptions, occupancyRate: Math.max(0, current * (1 - percentValue)) };
      }

      if (percentValue != null) {
        return { ...assumptions, occupancyRate: percentValue };
      }
    }

    if ((normalizedQuestion.includes("nightly") || normalizedQuestion.includes("rate")) && dollarValue != null) {
      return { ...assumptions, nightlyRate: dollarValue };
    }

    if (normalizedQuestion.includes("down") && normalizedQuestion.includes("payment") && percentValue != null) {
      return { ...assumptions, downPaymentPercent: percentValue };
    }

    return assumptions;
  }

  private extractPercent(question: string): number | null {
    const match = question.match(/(\d+(?:\.\d+)?)\s*%/);
    return match?.[1] ? normalizePercent(Number(match[1])) : null;
  }

  private extractDollar(question: string): number | null {
    const match = question.match(/\$([\d,]+(?:\.\d+)?)/);
    if (!match?.[1]) {
      return null;
    }

    return Number(match[1].replace(/,/g, ""));
  }
}
