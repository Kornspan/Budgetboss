
export type Cents = number;
export type UserId = string;

// --- Accounts ---

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'other';
export type AccountProvider = 'manual' | 'plaid' | 'teller' | 'other';

export interface Account {
  id: string;
  userId: UserId;
  name: string;
  type: AccountType;
  
  // Data Source Fields
  provider: AccountProvider;
  externalAccountId?: string;
  institutionName?: string;
  
  // Balance (Integer Cents)
  currentBalanceCents: Cents;
  
  isClosed?: boolean;
}

// --- Categories & Rules ---

export interface Category {
  id: string;
  userId: UserId;
  name: string;
  group?: string;
}

export interface CategoryRule {
  id: string;
  userId: UserId;
  pattern: string; // Simple substring match or regex string
  categoryId: string;
}

// --- Budgets ---

export interface BudgetMonth {
  id: string;
  userId: UserId;
  year: number;
  month: number; // 1-12
}

export interface BudgetEntry {
  id: string;
  userId: UserId;
  budgetMonthId: string;
  categoryId: string;
  budgetedCents: Cents;
}

// --- Transactions ---

export type TransactionSource = 'manual' | 'imported';
export type TransactionStatus = 'pending' | 'posted';

export interface Transaction {
  id: string;
  userId: UserId;
  accountId: string;
  
  date: string; // ISO YYYY-MM-DD
  name: string; // Was 'payee'
  amountCents: Cents; // Negative = expense, Positive = income
  
  categoryId: string | null;
  notes?: string; // Was 'note'
  
  // Integration Fields
  source: TransactionSource;
  status: TransactionStatus;
  externalTransactionId?: string;
  importedAt?: string; // ISO timestamp
}

// --- Goals & FIRE ---

export interface Goal {
  id: string;
  userId: UserId;
  name: string;
  targetCents: Cents;
  currentCents: Cents;
  targetYear?: number;
}

export interface FireConfig {
  currentPortfolioCents: Cents;
  monthlyContributionCents: Cents;
  expectedRealReturnPercent: number;
  annualSpendCents: Cents;
  safeWithdrawalRatePercent: number;
}

// --- Dashboard ---

export type DashboardWidgetType =
  | 'netWorthSummary'
  | 'budgetSummary'
  | 'fireCountdown'
  | 'topSpending'
  | 'recentTransactions'
  | 'aiAssistant';

export type DashboardWidgetSize = 'small' | 'medium' | 'large';

export interface DashboardWidgetConfig {
  id: string;
  type: DashboardWidgetType;
  label: string;
  enabled: boolean;
  position: number;
  size: DashboardWidgetSize;
}

// --- App Settings ---

export type ThemePreference = 'system' | 'light' | 'dark';
export type AiPersonality = 'friendly' | 'direct' | 'playful';

export interface AppSettings {
  profile: {
    displayName: string;
    email: string;
  };
  themePreference: ThemePreference;
  notificationsEnabled: boolean;
  ai: {
    personality: AiPersonality;
    searchGroundingEnabled: boolean;
  };
  prototypeMode: boolean;
}

// --- State ---

export interface FinanceState {
  userId: UserId;
  accounts: Account[];
  categories: Category[];
  categoryRules: CategoryRule[];
  budgetMonths: BudgetMonth[];
  budgetEntries: BudgetEntry[];
  transactions: Transaction[];
  goals: Goal[];
  fireConfig: FireConfig;
  dashboardWidgets: DashboardWidgetConfig[];
  appSettings: AppSettings;
}
