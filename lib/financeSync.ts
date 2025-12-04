import { supabase } from './supabaseClient';
import { FinanceState, Account, Category, Transaction, BudgetMonth, BudgetEntry, Goal, FireConfig } from '../types';

export type FinanceSnapshot = Pick<
  FinanceState,
  'accounts' | 'categories' | 'transactions' | 'budgetMonths' | 'budgetEntries' | 'goals' | 'fireConfig'
>;

function mapAccounts(rows: any[]): Account[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    provider: row.provider,
    externalAccountId: row.external_account_id ?? undefined,
    institutionName: row.institution_name ?? undefined,
    currentBalanceCents: Number(row.current_balance_cents ?? 0),
    isClosed: row.is_closed ?? undefined,
  }));
}

function mapCategories(rows: any[]): Category[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    group: row.category_group ?? undefined,
  }));
}

function mapTransactions(rows: any[]): Transaction[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    categoryId: row.category_id ?? null,
    name: row.name,
    amountCents: Number(row.amount_cents ?? 0),
    date: row.transaction_date,
    notes: row.notes ?? undefined,
    source: row.source,
    status: row.status,
    externalTransactionId: row.external_transaction_id ?? undefined,
    importedAt: row.imported_at ?? undefined,
  }));
}

function mapBudgetMonths(rows: any[]): BudgetMonth[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    year: Number(row.year),
    month: Number(row.month),
  }));
}

function mapBudgetEntries(rows: any[]): BudgetEntry[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    budgetMonthId: row.budget_month_id,
    categoryId: row.category_id,
    budgetedCents: Number(row.budgeted_cents ?? 0),
  }));
}

function mapGoals(rows: any[]): Goal[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    targetCents: Number(row.target_cents ?? 0),
    currentCents: Number(row.current_cents ?? 0),
    targetYear: row.target_year === null || row.target_year === undefined ? undefined : Number(row.target_year),
  }));
}

function mapFireConfig(row: any | null): FireConfig {
  if (!row) {
    return {
      currentPortfolioCents: 0,
      monthlyContributionCents: 0,
      expectedRealReturnPercent: 0,
      annualSpendCents: 0,
      safeWithdrawalRatePercent: 4,
    };
  }

  return {
    currentPortfolioCents: Number(row.current_portfolio_cents ?? 0),
    monthlyContributionCents: Number(row.monthly_contribution_cents ?? 0),
    expectedRealReturnPercent: Number(row.expected_real_return_percent ?? 0),
    annualSpendCents: Number(row.annual_spend_cents ?? 0),
    safeWithdrawalRatePercent: Number(row.safe_withdrawal_rate_percent ?? 4),
  };
}

async function queryTable(table: string, userId: string) {
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchFinanceSnapshot(userId: string): Promise<FinanceSnapshot> {
  const fireConfigQuery = supabase.from('fire_configs').select('*').eq('user_id', userId).maybeSingle();

  const [accountsData, categoriesData, transactionsData, budgetMonthsData, budgetEntriesData, goalsData, fireConfigResponse] =
    await Promise.all([
      queryTable('accounts', userId),
      queryTable('categories', userId),
      queryTable('transactions', userId),
      queryTable('budget_months', userId),
      queryTable('budget_entries', userId),
      queryTable('goals', userId),
      fireConfigQuery,
    ]);

  if (fireConfigResponse.error) {
    throw fireConfigResponse.error;
  }

  const fireConfigRow = fireConfigResponse.data;

  return {
    accounts: mapAccounts(accountsData),
    categories: mapCategories(categoriesData),
    transactions: mapTransactions(transactionsData),
    budgetMonths: mapBudgetMonths(budgetMonthsData),
    budgetEntries: mapBudgetEntries(budgetEntriesData),
    goals: mapGoals(goalsData),
    fireConfig: mapFireConfig(fireConfigRow),
  };
}
