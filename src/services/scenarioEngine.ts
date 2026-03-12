import { InvestmentAssumptions } from "../models/assumptions.js";
import { Property } from "../models/property.js";
import { RoiAnalysis, calculateRoi, normalizeOccupancyRate, normalizePercent } from "./roiCalculator.js";

export interface AnalysisRecord {
  id: string;
  property: Property;
  assumptions: InvestmentAssumptions;
  analysis: RoiAnalysis;
}

export interface FollowupResponse {
  analysis_id: string;
  question: string;
  updated_assumptions: InvestmentAssumptions;
  analysis: RoiAnalysis;
  explanation: string;
}

export class ScenarioEngine {
  private readonly analyses = new Map<string, AnalysisRecord>();

  save(property: Property, assumptions: InvestmentAssumptions, analysis: RoiAnalysis): AnalysisRecord {
    const id = `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = { id, property, assumptions, analysis };
    this.analyses.set(id, record);
    return record;
  }

  get(id: string): AnalysisRecord | undefined {
    return this.analyses.get(id);
  }

  answerFollowup(analysisId: string, question: string): FollowupResponse {
    const record = this.analyses.get(analysisId);
    if (!record) {
      throw new Error(`Unknown analysis_id: ${analysisId}`);
    }

    const updatedAssumptions = this.applyQuestionToAssumptions(record.assumptions, question);
    const analysis = calculateRoi(record.property, updatedAssumptions);

    const updatedRecord = {
      ...record,
      assumptions: updatedAssumptions,
      analysis,
    };
    this.analyses.set(analysisId, updatedRecord);

    return {
      analysis_id: analysisId,
      question,
      updated_assumptions: updatedAssumptions,
      analysis,
      explanation: this.buildExplanation(record.property.address, analysis),
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

  private buildExplanation(address: string, analysis: RoiAnalysis): string {
    const breakEvenPercent = (analysis.break_even_occupancy * 100).toFixed(1);
    const cashFlow = analysis.annual_cash_flow.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    return `${address} now projects ${cashFlow} in annual cash flow, with break-even occupancy near ${breakEvenPercent}%.`;
  }
}
