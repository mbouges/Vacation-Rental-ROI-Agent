import { InvestmentAssumptions } from "../models/assumptions.js";
import { Property } from "../models/property.js";
import { RoiAnalysis } from "./roiCalculator.js";

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function topExpenseLines(analysis: RoiAnalysis): string[] {
  return Object.entries(analysis.total_expense_breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label, amount]) => `${label.replace(/_/g, " ")} ${formatCurrency(amount)}`);
}

function breakEvenContext(assumptions: InvestmentAssumptions, analysis: RoiAnalysis): string {
  const occupancy = formatPercent(assumptions.occupancyRate);
  const breakEven = formatPercent(analysis.break_even_occupancy);

  if (analysis.annual_cash_flow >= 0) {
    return `Assumed occupancy is ${occupancy} versus break-even at ${breakEven}.`;
  }

  return `Assumed occupancy is ${occupancy} versus break-even at ${breakEven}, so this deal is currently under the break-even threshold.`;
}

export function buildAnalysisExplanation(
  property: Property,
  assumptions: InvestmentAssumptions,
  analysis: RoiAnalysis,
): string {
  const cashFlow = formatCurrency(analysis.annual_cash_flow);
  const noi = formatCurrency(analysis.noi);
  const capRate = formatPercent(analysis.cap_rate);
  const cashOnCash = formatPercent(analysis.cash_on_cash_return);
  const revenue = formatCurrency(analysis.gross_revenue);
  const expenseDrivers = topExpenseLines(analysis);

  const headline = `${property.address}: estimated annual cash flow is ${cashFlow}.`;
  const performance = `Annual revenue is about ${revenue}, NOI is ${noi}, cap rate is ${capRate}, and cash-on-cash return is ${cashOnCash}.`;
  const drivers = expenseDrivers.length > 0 ? `Largest costs: ${expenseDrivers.join(" and ")}.` : "";

  return [headline, breakEvenContext(assumptions, analysis), performance, drivers].filter(Boolean).join(" ");
}
