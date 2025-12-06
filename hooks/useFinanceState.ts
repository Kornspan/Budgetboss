
import { useState, useEffect, useCallback, useRef } from 'react';
import { FinanceState, Transaction, Account, Category, BudgetEntry, DashboardWidgetConfig, FireConfig, CategoryRule, BudgetMonth, Goal, AppSettings, ThemePreference, AiPersonality } from '../types';
import { autoCategorizeTransaction } from '../lib/finance';
import { fetchFinanceSnapshot, FinanceSnapshot } from '../lib/financeSync';
import { supabase } from '../lib/supabaseClient';

const STORAGE_KEY = 'finance_prototype_v2_plaid_ready';
const LOCAL_USER_ID = 'local-user';

// Default Widgets
const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'w_nw', type: 'netWorthSummary', label: 'Net Worth', enabled: true, position: 0, size: 'small' },
  { id: 'w_budget', type: 'budgetSummary', label: 'Monthly Budget', enabled: true, position: 1, size: 'small' },
  { id: 'w_fire', type: 'fireCountdown', label: 'FIRE Countdown', enabled: true, position: 2, size: 'small' },
  { id: 'w_spending', type: 'topSpending', label: 'Top Spending', enabled: true, position: 3, size: 'medium' },
  { id: 'w_recent', type: 'recentTransactions', label: 'Recent Transactions', enabled: true, position: 4, size: 'medium' },
  { id: 'w_ai', type: 'aiAssistant', label: 'AI Assistant', enabled: true, position: 5, size: 'large' },
];

const DEFAULT_SETTINGS: AppSettings = {
  profile: {
    displayName: 'Demo User',
    email: 'user@example.com',
  },
  themePreference: 'system',
  notificationsEnabled: true,
  ai: {
    personality: 'friendly',
    searchGroundingEnabled: true,
  },
  prototypeMode: true,
};

const DEFAULT_STATE: FinanceState = {
  userId: LOCAL_USER_ID,
  accounts: [
    { 
      id: 'acc_1', userId: LOCAL_USER_ID, name: 'Main Checking', type: 'checking', 
      provider: 'manual', currentBalanceCents: 241458 
    },
    { 
      id: 'acc_2', userId: LOCAL_USER_ID, name: 'High Yield Savings', type: 'savings', 
      provider: 'manual', currentBalanceCents: 1000000 
    },
    { 
      id: 'acc_3', userId: LOCAL_USER_ID, name: 'Chase Sapphire', type: 'credit', 
      provider: 'manual', currentBalanceCents: -15000 
    },
  ],
  categories: [
    { id: 'cat_1', userId: LOCAL_USER_ID, name: 'Groceries', group: 'Living' },
    { id: 'cat_2', userId: LOCAL_USER_ID, name: 'Rent/Mortgage', group: 'Living' },
    { id: 'cat_3', userId: LOCAL_USER_ID, name: 'Dining Out', group: 'Discretionary' },
    { id: 'cat_4', userId: LOCAL_USER_ID, name: 'Transport', group: 'Living' },
    { id: 'cat_5', userId: LOCAL_USER_ID, name: 'General Savings', group: 'Savings' },
  ],
  categoryRules: [
    { id: 'rule_1', userId: LOCAL_USER_ID, pattern: 'Trader Joes', categoryId: 'cat_1' },
    { id: 'rule_2', userId: LOCAL_USER_ID, pattern: 'Coffee', categoryId: 'cat_3' },
  ],
  budgetMonths: [
    { id: 'bm_2024_05', userId: LOCAL_USER_ID, year: 2024, month: 5 },
  ],
  budgetEntries: [
    { id: 'be_1', userId: LOCAL_USER_ID, budgetMonthId: 'bm_2024_05', categoryId: 'cat_1', budgetedCents: 60000 },
    { id: 'be_2', userId: LOCAL_USER_ID, budgetMonthId: 'bm_2024_05', categoryId: 'cat_2', budgetedCents: 200000 },
    { id: 'be_3', userId: LOCAL_USER_ID, budgetMonthId: 'bm_2024_05', categoryId: 'cat_3', budgetedCents: 20000 },
  ],
  transactions: [
    { 
      id: 'tx_1', userId: LOCAL_USER_ID, date: new Date().toISOString().split('T')[0], 
      accountId: 'acc_1', categoryId: 'cat_1', name: 'Trader Joes', amountCents: -8542,
      source: 'manual', status: 'posted'
    },
    { 
      id: 'tx_2', userId: LOCAL_USER_ID, date: new Date().toISOString().split('T')[0], 
      accountId: 'acc_1', categoryId: 'cat_3', name: 'Local Coffee Shop', amountCents: -1250,
      source: 'manual', status: 'posted'
    }
  ],
  goals: [
    { id: 'goal_1', userId: LOCAL_USER_ID, name: 'New Laptop', targetCents: 200000, currentCents: 50000 },
  ],
  fireConfig: {
    currentPortfolioCents: 5000000,
    monthlyContributionCents: 100000,
    expectedRealReturnPercent: 7,
    annualSpendCents: 4000000,
    safeWithdrawalRatePercent: 4,
  },
  dashboardWidgets: DEFAULT_WIDGETS,
  appSettings: DEFAULT_SETTINGS,
};

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', category_group: 'Living' },
  { name: 'Restaurants / Eating Out', category_group: 'Living' },
  { name: 'Transport', category_group: 'Living' },
  { name: 'Rent / Housing', category_group: 'Living' },
  { name: 'Utilities', category_group: 'Living' },
  { name: 'Entertainment', category_group: 'Fun' },
  { name: 'Travel', category_group: 'Fun' },
  { name: 'Health / Fitness', category_group: 'Health' },
  { name: 'Shopping', category_group: 'Shopping' },
  { name: 'Electronics', category_group: 'Shopping' },
  { name: 'Car', category_group: 'Car' },
  { name: 'Gas', category_group: 'Car' },
  { name: 'Misc', category_group: 'General' },
];

async function loadCategoriesFromSupabase(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, category_group, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[finance] loadCategoriesFromSupabase error', { userId, error });
    return [];
  }

  console.log('[finance] loaded categories', { userId, count: data?.length ?? 0, sample: data?.[0] });

  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: userId,
    name: row.name,
    group: row.category_group ?? undefined,
  }));
}

export function useFinanceState() {
  const [state, setState] = useState<FinanceState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const autoCategorizedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULT_STATE, ...parsed };
        
        // Ensure widgets exist
        if (!merged.dashboardWidgets || merged.dashboardWidgets.length === 0) {
            merged.dashboardWidgets = DEFAULT_WIDGETS;
        }
        // Ensure settings exist (migration)
        if (!merged.appSettings) {
            merged.appSettings = DEFAULT_SETTINGS;
        } else {
            // Deep merge in case of new setting fields
            merged.appSettings = { ...DEFAULT_SETTINGS, ...merged.appSettings, ai: { ...DEFAULT_SETTINGS.ai, ...merged.appSettings.ai } };
        }

        setState(merged);
      }
    } catch (e) {
      console.error("Failed to load state", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const applySnapshot = useCallback((userId: string, snapshot: FinanceSnapshot) => {
    setState(prev => {
      const categorizedTransactions = snapshot.transactions.map(tx => {
        if (tx.categoryId) return tx;
        return autoCategorizeTransaction(tx, prev.categoryRules);
      });

      return {
        ...prev,
        userId,
        accounts: snapshot.accounts,
        categories: snapshot.categories,
        transactions: categorizedTransactions,
        budgetMonths: snapshot.budgetMonths,
        budgetEntries: snapshot.budgetEntries,
        goals: snapshot.goals,
        fireConfig: snapshot.fireConfig,
      };
    });
  }, []);

  // --- CORE ACTIONS ---

  const upsertAccount = useCallback((account: Account) => {
    setState(prev => {
      const exists = prev.accounts.some(a => a.id === account.id);
      let newAccounts;
      if (exists) {
        newAccounts = prev.accounts.map(a => a.id === account.id ? account : a);
      } else {
        newAccounts = [...prev.accounts, account];
      }
      return { ...prev, accounts: newAccounts };
    });
  }, []);

  const addManualTransaction = useCallback((input: Omit<Transaction, 'id' | 'userId' | 'source' | 'status' | 'importedAt'>) => {
    const newTx: Transaction = {
      ...input,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: state.userId,
      source: 'manual',
      status: 'posted'
    };

    const categorizedTx = autoCategorizeTransaction(newTx, state.categoryRules);

    setState(prev => {
      const newTransactions = [categorizedTx, ...prev.transactions];
      const newAccounts = prev.accounts.map(acc => {
        if (acc.id === categorizedTx.accountId) {
          return { ...acc, currentBalanceCents: acc.currentBalanceCents + categorizedTx.amountCents };
        }
        return acc;
      });

      return { ...prev, transactions: newTransactions, accounts: newAccounts };
    });
  }, [state.userId, state.categoryRules]);

  const importTransactionsFromProvider = useCallback((incomingTxs: Transaction[]) => {
    setState(prev => {
      let updatedTransactions = [...prev.transactions];
      let addedCount = 0;

      for (const tx of incomingTxs) {
        const exists = tx.externalTransactionId 
          ? updatedTransactions.find(t => t.externalTransactionId === tx.externalTransactionId)
          : false;

        if (!exists) {
          const readyTx = autoCategorizeTransaction(tx, prev.categoryRules);
          updatedTransactions.push(readyTx);
          addedCount++;
        }
      }
      updatedTransactions.sort((a, b) => b.date.localeCompare(a.date));
      console.log(`Imported ${addedCount} new transactions.`);
      return { ...prev, transactions: updatedTransactions };
    });
  }, []);

  const recomputeBudgetsForMonth = useCallback((year: number, month: number) => {
    setState(prev => {
      const existing = prev.budgetMonths.find(m => m.year === year && m.month === month);
      if (existing) return prev;
      
      const newMonth: BudgetMonth = {
          id: `bm_${year}_${month}`,
          userId: prev.userId,
          year,
          month
      };
      return { ...prev, budgetMonths: [...prev.budgetMonths, newMonth] };
    });
    return `bm_${year}_${month}`;
  }, []);

  // --- LEGACY/HELPER ACTIONS ---

  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setState(prev => {
      const oldTx = prev.transactions.find(t => t.id === id);
      if (!oldTx) return prev;

      const newAmount = updates.amountCents;
      const amountDiff = (newAmount !== undefined) ? newAmount - oldTx.amountCents : 0;
      
      let newAccounts = prev.accounts;
      if (oldTx.source === 'manual' && amountDiff !== 0) {
        newAccounts = prev.accounts.map(acc => {
          if (acc.id === oldTx.accountId) {
            return { ...acc, currentBalanceCents: acc.currentBalanceCents + amountDiff };
          }
          return acc;
        });
      }

      const newTransactions = prev.transactions.map(t => t.id === id ? { ...t, ...updates } : t);
      return { ...prev, transactions: newTransactions, accounts: newAccounts };
    });
  }, []);

  const addCategory = useCallback((name: string, group?: string) => {
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      userId: state.userId,
      name,
      group
    };
    setState(prev => ({ ...prev, categories: [...prev.categories, newCat] }));
  }, [state.userId]);

  const updateBudgetEntry = useCallback((categoryId: string, monthId: string, budgetedCents: number) => {
    setState(prev => {
      const existingIdx = prev.budgetEntries.findIndex(be => be.categoryId === categoryId && be.budgetMonthId === monthId);
      let newEntries = [...prev.budgetEntries];

      if (existingIdx >= 0) {
        newEntries[existingIdx] = { ...newEntries[existingIdx], budgetedCents };
      } else {
        newEntries.push({
          id: `be_${Date.now()}`,
          userId: prev.userId,
          budgetMonthId: monthId,
          categoryId,
          budgetedCents
        });
      }
      return { ...prev, budgetEntries: newEntries };
    });
  }, []);

  const updateFireConfig = useCallback((config: Partial<FireConfig>) => {
    setState(prev => ({ ...prev, fireConfig: { ...prev.fireConfig, ...config } }));
  }, []);

  const addGoal = useCallback((name: string, targetCents: number, currentCents: number) => {
    setState(prev => {
      const newGoal: Goal = {
        id: `goal_${Date.now()}`,
        userId: prev.userId,
        name,
        targetCents,
        currentCents
      };
      return { ...prev, goals: [...prev.goals, newGoal] };
    });
  }, []);

  // --- Dashboard Actions ---

  const toggleDashboardWidget = useCallback((id: string, enabled: boolean) => {
      setState(prev => ({
          ...prev,
          dashboardWidgets: prev.dashboardWidgets.map(w => w.id === id ? { ...w, enabled } : w)
      }));
  }, []);

  const moveDashboardWidget = useCallback((id: string, direction: 'up' | 'down') => {
      setState(prev => {
          const sorted = [...prev.dashboardWidgets].sort((a, b) => a.position - b.position);
          const index = sorted.findIndex(w => w.id === id);
          if (index === -1) return prev;

          if (direction === 'up' && index > 0) {
              const tempPos = sorted[index].position;
              sorted[index].position = sorted[index - 1].position;
              sorted[index - 1].position = tempPos;
          } else if (direction === 'down' && index < sorted.length - 1) {
              const tempPos = sorted[index].position;
              sorted[index].position = sorted[index + 1].position;
              sorted[index + 1].position = tempPos;
          }
          const reNormalized = sorted.sort((a,b) => a.position - b.position).map((w, i) => ({ ...w, position: i }));
          return { ...prev, dashboardWidgets: reNormalized };
      });
  }, []);

  const updateDashboardWidgets = useCallback((nextWidgets: DashboardWidgetConfig[]) => {
      setState(prev => ({ ...prev, dashboardWidgets: nextWidgets }));
  }, []);

  // --- Settings Actions ---

  const updateProfileSettings = useCallback((input: { displayName?: string; email?: string }) => {
    setState(prev => ({
      ...prev,
      appSettings: { ...prev.appSettings, profile: { ...prev.appSettings.profile, ...input } }
    }));
  }, []);

  const updateAppPreferences = useCallback((input: { themePreference?: ThemePreference; notificationsEnabled?: boolean }) => {
    setState(prev => ({
      ...prev,
      appSettings: { ...prev.appSettings, ...input }
    }));
  }, []);

  const updateAiSettings = useCallback((input: { personality?: AiPersonality; searchGroundingEnabled?: boolean }) => {
    setState(prev => ({
      ...prev,
      appSettings: { ...prev.appSettings, ai: { ...prev.appSettings.ai, ...input } }
    }));
  }, []);

  const exportStateAsJson = useCallback(() => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finance_app_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state]);

  const resetAllData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);

  const loadFromSupabaseForUser = useCallback(async (userId: string) => {
    let snapshot = await fetchFinanceSnapshot(userId);
    let categories = await loadCategoriesFromSupabase(userId);

    if (!categories || categories.length === 0) {
      const rowsToInsert = DEFAULT_CATEGORIES.map((cat) => ({
        user_id: userId,
        name: cat.name,
        category_group: cat.category_group,
      }));
      const { error: seedError } = await supabase
        .from('categories')
        .upsert(rowsToInsert, { onConflict: 'user_id,name' });
      console.log('[finance] seeded default categories', { userId, count: rowsToInsert.length, seedError });
      categories = await loadCategoriesFromSupabase(userId);
    }

    applySnapshot(userId, { ...snapshot, categories });
  }, [applySnapshot]);

  // Auto-categorize imported transactions lacking a category, one by one, using AI helper.
  useEffect(() => {
    const userId = state.userId;
    if (!isLoaded || !userId || !state.categories || state.categories.length === 0 || !state.transactions) return;

    const uncategorized = state.transactions.filter(
      (tx) =>
        !tx.categoryId &&
        tx.source === 'imported' &&
        !autoCategorizedIds.current.has(tx.id),
    );

    if (uncategorized.length === 0) return;

    let cancelled = false;

    const run = async () => {
      for (const tx of uncategorized) {
        autoCategorizedIds.current.add(tx.id);
        try {
          const suggestion = await import('../lib/ai').then(mod =>
            mod.getCategorySuggestion(tx, state.categories.map(c => ({ id: c.id, name: c.name })))
          );

          if (
            suggestion &&
            suggestion.suggestedCategoryId
          ) {
            const matched = state.categories.find(
              (c) =>
                c.id === suggestion.suggestedCategoryId ||
                c.name === suggestion.suggestedCategoryName,
            );
            if (matched && !cancelled) {
              console.log('[autoCategory] suggested', {
                txId: tx.id,
                name: tx.name,
                suggestedCategoryId: matched.id,
                suggestedCategoryName: matched.name,
              });
              await supabase
                .from('transactions')
                .update({ category_id: matched.id })
                .eq('id', tx.id)
                .eq('user_id', userId);

              setState((prev) => ({
                ...prev,
                transactions: prev.transactions.map((t) =>
                  t.id === tx.id ? { ...t, categoryId: matched.id } : t
                ),
              }));
            }
          } else {
            console.log('[autoCategory] no suggestion', { txId: tx.id, name: tx.name, reason: suggestion?.reason });
          }
        } catch (error) {
          console.error('[auto-categorize] failed', error);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [state.userId, state.transactions, state.categories, isLoaded]);

  return {
    state,
    isLoaded,
    addManualTransaction,
    importTransactionsFromProvider,
    upsertAccount,
    updateTransaction,
    addCategory,
    updateBudgetEntry,
    updateFireConfig,
    addGoal,
    recomputeBudgetsForMonth,
    toggleDashboardWidget,
    moveDashboardWidget,
    updateDashboardWidgets,
    updateProfileSettings,
    updateAppPreferences,
    updateAiSettings,
    exportStateAsJson,
    resetAllData,
    loadFromSupabaseForUser
  };
}
