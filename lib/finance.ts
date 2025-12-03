
import { Account, Transaction, Cents, FireConfig, CategoryRule } from '../types';

export const DOLLAR_TO_CENTS = 100;

export function formatMoney(cents: Cents): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / DOLLAR_TO_CENTS);
}

export function parseMoney(amountStr: string): Cents {
  const clean = amountStr.replace(/[^0-9.-]+/g, '');
  const floatVal = parseFloat(clean);
  if (isNaN(floatVal)) return 0;
  return Math.round(floatVal * DOLLAR_TO_CENTS);
}

/**
 * Calculates the current balance of an account.
 * For this new data model, the Account object holds the current balance source of truth.
 * This function is kept for compatibility if we need to add computed logic later.
 */
export function calculateAccountBalance(account: Account): Cents {
  return account.currentBalanceCents;
}

export function calculateNetWorth(accounts: Account[]): {
  assets: Cents;
  liabilities: Cents;
  netWorth: Cents;
} {
  let assets = 0;
  let liabilities = 0;

  for (const acc of accounts) {
    const balance = acc.currentBalanceCents;
    
    // Logic: 
    // Credit cards usually have negative balance = debt.
    // Loans have negative balance = debt.
    // Savings/Checking positive = asset.
    
    if (balance >= 0) {
      assets += balance;
    } else {
      liabilities += Math.abs(balance);
    }
  }

  return { assets, liabilities, netWorth: assets - liabilities };
}

export function getTransactionsForMonth(
  transactions: Transaction[],
  year: number,
  month: number
): Transaction[] {
  const monthStr = month.toString().padStart(2, '0');
  const prefix = `${year}-${monthStr}`;
  return transactions.filter((t) => t.date.startsWith(prefix));
}

export function calculateCategorySpent(
  transactions: Transaction[], 
  categoryId: string
): Cents {
  return transactions
    .filter((t) => t.categoryId === categoryId && t.amountCents < 0)
    .reduce((sum, t) => sum + t.amountCents, 0); // Returns negative number
}

// --- Auto Categorization ---

export function autoCategorizeTransaction(
  tx: Transaction,
  rules: CategoryRule[]
): Transaction {
  // If already categorized, don't overwrite
  if (tx.categoryId) return tx;

  const normalize = (s: string) => s.toLowerCase();
  const txName = normalize(tx.name);

  for (const rule of rules) {
    const pattern = normalize(rule.pattern);
    if (txName.includes(pattern)) {
      return { ...tx, categoryId: rule.categoryId };
    }
  }

  return tx;
}

// --- FIRE Simulation ---

export interface FireProjection {
  yearsToFI: number | null;
  yearlyValues: { yearIndex: number; valueCents: Cents; age: number }[];
}

export function simulateFire(config: FireConfig): FireProjection {
  const {
    currentPortfolioCents,
    monthlyContributionCents,
    expectedRealReturnPercent,
    annualSpendCents,
    safeWithdrawalRatePercent,
  } = config;

  const targetCents = (annualSpendCents * 100) / safeWithdrawalRatePercent;
  const yearlyContributionCents = monthlyContributionCents * 12;
  const returnRate = expectedRealReturnPercent / 100;

  const yearlyValues: { yearIndex: number; valueCents: Cents; age: number }[] = [];
  let currentVal = currentPortfolioCents;
  let years = 0;
  const MAX_YEARS = 60; // Cap simulation

  while (currentVal < targetCents && years < MAX_YEARS) {
    // Add contribution
    currentVal += yearlyContributionCents;
    // Compound return
    currentVal = Math.round(currentVal * (1 + returnRate));
    
    years++;
    yearlyValues.push({ yearIndex: years, valueCents: currentVal, age: years });
  }

  return {
    yearsToFI: currentVal >= targetCents ? years : null,
    yearlyValues,
  };
}
