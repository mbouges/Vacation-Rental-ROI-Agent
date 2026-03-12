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
    .map(([label, amount]) => `${label.replace(/_/g, " ")} at ${formatCurrency(amount)}`);
}

function occupancyContext(assumptions: InvestmentAssumptions, analysis: RoiAnalysis): string {
  const occupancy = formatPercent(assumptions.occupancyRate);
  const breakEven = formatPercent(analysis.break_even_occupancy);

  if (analysis.annual_cash_flow >= 0) {
    return `At ${occupancy} occupancy, the property is above the estimated break-even level of ${breakEven}.`;
  }

  return `At ${occupancy} occupancy, the property is below the estimated break-even level of ${breakEven}.`;
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

  const headline =
    analysis.annual_cash_flow >= 0
      ? `${property.address} looks cash-flow positive at roughly ${cashFlow} per year.`
      : `${property.address} currently looks cash-flow negative at roughly ${cashFlow} per year.`;

  const performance = `It generates about ${revenue} in annual gross revenue, ${noi} in NOI, a cap rate near ${capRate}, and cash-on-cash return around ${cashOnCash}.`;

  const drivers = expenseDrivers.length > 0
    ? `The biggest expense drivers are ${expenseDrivers.join(" and ")}.`
    : "";

  return [headline, occupancyContext(assumptions, analysis), performance, drivers]
    .filter(Boolean)
    .join(" ");
}
