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
    let updated = { ...assumptions };

    const assignmentOccupancyRate = this.extractAssignmentRate(normalizedQuestion, "occupancy_rate");
    const occupancyRate = assignmentOccupancyRate ?? this.extractOccupancyRate(normalizedQuestion, assumptions);
    if (occupancyRate != null) {
      updated.occupancyRate = occupancyRate;
    }

    const assignmentManagementRate = this.extractAssignmentRate(normalizedQuestion, "management_rate");
    const managementRate = assignmentManagementRate ?? this.extractManagementRate(normalizedQuestion);
    if (managementRate != null) {
      updated.managementRate = managementRate;
    }

    const assignmentNightlyRate = this.extractAssignmentNumber(normalizedQuestion, "nightly_rate");
    const nightlyRate = assignmentNightlyRate ?? this.extractNightlyRate(question, normalizedQuestion);
    if (nightlyRate != null) {
      updated.nightlyRate = nightlyRate;
    }

    const assignmentDownPaymentPercent = this.extractAssignmentRate(normalizedQuestion, "down_payment_percent");
    const downPaymentPercent = assignmentDownPaymentPercent ?? this.extractDownPaymentPercent(question, normalizedQuestion);
    if (downPaymentPercent != null) {
      updated.downPaymentPercent = downPaymentPercent;
    }

    return updated;
  }

  private extractPercent(question: string): number | null {
    const match = question.match(/(\d+(?:\.\d+)?)\s*%/);
    return match?.[1] ? normalizePercent(Number(match[1])) : null;
  }

  private extractPercentNearKeyword(question: string, keywordPattern: RegExp): number | null {
    const patterns = [
      new RegExp(`${keywordPattern.source}[^\\d%]{0,40}(\\d+(?:\\.\\d+)?)\\s*%`, "i"),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%[^\\n.]{0,40}${keywordPattern.source}`, "i"),
    ];

    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match?.[1]) {
        return normalizePercent(Number(match[1]));
      }
    }

    return null;
  }

  private extractDollar(question: string): number | null {
    const match = question.match(/\$([\d,]+(?:\.\d+)?)/);
    if (!match?.[1]) {
      return null;
    }

    return Number(match[1].replace(/,/g, ""));
  }

  private extractAssignmentNumber(question: string, key: string): number | null {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = question.match(new RegExp(`${escapedKey}\\s*=\\s*(\\d+(?:\\.\\d+)?)`, "i"));
    if (!match?.[1]) {
      return null;
    }

    return Number(match[1]);
  }

  private extractAssignmentRate(question: string, key: string): number | null {
    const value = this.extractAssignmentNumber(question, key);
    return value == null ? null : normalizePercent(value);
  }

  private extractOccupancyRate(question: string, assumptions: InvestmentAssumptions): number | null {
    if (!question.includes("occupancy")) {
      return null;
    }

    const dropByMatch = question.match(/occupancy[\w\s]{0,20}(?:drops?|drop)\s+by\s+(\d+(?:\.\d+)?)\s*%/i);
    if (dropByMatch?.[1]) {
      const current = normalizeOccupancyRate(assumptions.occupancyRate);
      return Math.max(0, current * (1 - normalizePercent(Number(dropByMatch[1]))));
    }

    const dropToMatch = question.match(/occupancy[\w\s]{0,20}(?:drops?|drop)\s+to\s+(\d+(?:\.\d+)?)\s*%/i);
    if (dropToMatch?.[1]) {
      return normalizePercent(Number(dropToMatch[1]));
    }

    const explicitToMatch = question.match(/occupancy[\w\s]{0,20}(?:to|at|is|becomes?)\s+(\d+(?:\.\d+)?)\s*%/i);
    if (explicitToMatch?.[1]) {
      return normalizePercent(Number(explicitToMatch[1]));
    }

    const nearKeyword = this.extractPercentNearKeyword(question, /occupancy/);
    if (nearKeyword != null) {
      return nearKeyword;
    }

    return null;
  }

  private extractManagementRate(question: string): number | null {
    if (!(question.includes("manage") || question.includes("management"))) {
      return null;
    }

    if (/\bself-manage(?:d|ment)?\b/i.test(question) || /\b0\s*%\s*management\b/i.test(question)) {
      return 0;
    }

    const directMatch = question.match(/management[\w\s]{0,20}(?:to|at|is|becomes?|drops?\s+to)\s+(\d+(?:\.\d+)?)\s*%/i);
    if (directMatch?.[1]) {
      return normalizePercent(Number(directMatch[1]));
    }

    const percentNearManagement = this.extractPercentNearKeyword(question, /management|manage(?:ment|d)?/);
    if (percentNearManagement != null) {
      return percentNearManagement;
    }

    return null;
  }

  private extractNightlyRate(question: string, normalizedQuestion: string): number | null {
    const dollarValue = this.extractDollar(question);
    if (dollarValue == null) {
      return null;
    }

    if (normalizedQuestion.includes("nightly") || normalizedQuestion.includes("nightly rate")) {
      return dollarValue;
    }

    return null;
  }

  private extractDownPaymentPercent(question: string, normalizedQuestion: string): number | null {
    if (!(normalizedQuestion.includes("down") && normalizedQuestion.includes("payment"))) {
      return null;
    }

    return this.extractPercent(question);
  }
}
