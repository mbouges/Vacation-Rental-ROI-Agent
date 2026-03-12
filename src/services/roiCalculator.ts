import { InvestmentAssumptions } from "../models/assumptions.js";
import { Property } from "../models/property.js";

export interface RoiAnalysis {
  gross_revenue: number;
  annual_operating_expenses: number;
  annual_expenses: number;
  noi: number;
  annual_cash_flow: number;
  cap_rate: number;
  cash_on_cash_return: number;
  break_even_occupancy: number;
  annual_mortgage_payment: number;
  total_cash_invested: number;
  operating_expense_breakdown: Record<string, number>;
  total_expense_breakdown: Record<string, number>;
  assumptions_used: InvestmentAssumptions;
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;
const roundRatio = (value: number): number => Math.round(value * 10000) / 10000;

export function normalizeOccupancyRate(rate: number): number {
  if (rate > 1) {
    return rate / 100;
  }

  return rate;
}

export function normalizePercent(rate: number): number {
  if (rate > 1) {
    return rate / 100;
  }

  return rate;
}

export function mortgagePaymentAnnual(
  principal: number,
  annualRate: number,
  termYears: number,
): number {
  if (principal <= 0) {
    return 0;
  }

  const monthlyRate = normalizePercent(annualRate) / 12;
  const periods = termYears * 12;

  if (monthlyRate === 0) {
    return principal / termYears;
  }

  const monthlyPayment =
    (principal * monthlyRate * (1 + monthlyRate) ** periods) /
    ((1 + monthlyRate) ** periods - 1);

  return monthlyPayment * 12;
}

export function calculateRoi(
  property: Property,
  assumptions: InvestmentAssumptions,
): RoiAnalysis {
  const occupancyRate = normalizeOccupancyRate(assumptions.occupancyRate);
  const managementRate = normalizePercent(assumptions.managementRate);
  const maintenanceRate = normalizePercent(assumptions.maintenanceRate);
  const platformFeeRate = normalizePercent(assumptions.platformFeeRate);
  const loanRate = normalizePercent(assumptions.loanRate);
  const downPaymentPercent = normalizePercent(assumptions.downPaymentPercent);
  const closingCostPercent = normalizePercent(assumptions.closingCostPercent);

  const grossRevenue = assumptions.nightlyRate * 365 * occupancyRate;
  const managementFee = grossRevenue * managementRate;
  const maintenanceReserve = grossRevenue * maintenanceRate;
  const platformFees = grossRevenue * platformFeeRate;
  const hoaAnnual = (property.hoaMonthly ?? 0) * 12;
  const taxesAnnual = property.taxAnnual ?? 0;

  const operatingExpenseBreakdown = {
    hoa: roundCurrency(hoaAnnual),
    taxes: roundCurrency(taxesAnnual),
    insurance: roundCurrency(assumptions.insuranceAnnual),
    utilities: roundCurrency(assumptions.utilitiesAnnual),
    management: roundCurrency(managementFee),
    maintenance: roundCurrency(maintenanceReserve),
    platform_fees: roundCurrency(platformFees),
  };

  const annualOperatingExpenses = Object.values(operatingExpenseBreakdown).reduce(
    (sum, value) => sum + value,
    0,
  );
  const noi = grossRevenue - annualOperatingExpenses;

  const loanAmount = property.price * (1 - downPaymentPercent);
  const annualMortgagePayment = mortgagePaymentAnnual(
    loanAmount,
    loanRate,
    assumptions.loanTermYears,
  );
  const annualExpenses = annualOperatingExpenses + annualMortgagePayment;
  const annualCashFlow = grossRevenue - annualExpenses;
  const totalCashInvested =
    property.price * downPaymentPercent + property.price * closingCostPercent;

  const breakEvenOccupancy =
    assumptions.nightlyRate > 0 ? annualExpenses / (assumptions.nightlyRate * 365) : 0;

  return {
    gross_revenue: roundCurrency(grossRevenue),
    annual_operating_expenses: roundCurrency(annualOperatingExpenses),
    annual_expenses: roundCurrency(annualExpenses),
    noi: roundCurrency(noi),
    annual_cash_flow: roundCurrency(annualCashFlow),
    cap_rate: property.price > 0 ? roundRatio(noi / property.price) : 0,
    cash_on_cash_return:
      totalCashInvested > 0 ? roundRatio(annualCashFlow / totalCashInvested) : 0,
    break_even_occupancy: roundRatio(breakEvenOccupancy),
    annual_mortgage_payment: roundCurrency(annualMortgagePayment),
    total_cash_invested: roundCurrency(totalCashInvested),
    operating_expense_breakdown: operatingExpenseBreakdown,
    total_expense_breakdown: {
      ...operatingExpenseBreakdown,
      mortgage: roundCurrency(annualMortgagePayment),
    },
    assumptions_used: {
      ...assumptions,
      occupancyRate,
      managementRate,
      maintenanceRate,
      platformFeeRate,
      loanRate,
      downPaymentPercent,
      closingCostPercent,
    },
  };
}
