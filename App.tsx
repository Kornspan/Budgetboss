
import React, { useState, useEffect } from 'react';
import { NavTabs } from './components/NavTabs';
import { DashboardView } from './components/DashboardView';
import { BudgetView } from './components/BudgetView';
import { TransactionsView } from './components/TransactionsView';
import { AccountsView } from './components/AccountsView';
import { GoalsFireView } from './components/GoalsFireView';
import { SettingsView } from './components/SettingsView';
import { FloatingAssistant } from './components/FloatingAssistant';
import { useFinanceState } from './hooks/useFinanceState';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'budgets' | 'transactions' | 'accounts' | 'goals' | 'settings'>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  
  const { 
    state, 
    addManualTransaction,
    updateTransaction,
    addCategory, 
    updateBudgetEntry, 
    updateFireConfig,
    addGoal,
    recomputeBudgetsForMonth,
    toggleDashboardWidget,
    moveDashboardWidget,
    updateProfileSettings,
    updateAppPreferences,
    updateAiSettings,
    exportStateAsJson,
    resetAllData
  } = useFinanceState();

  // Apply Theme
  useEffect(() => {
    const preference = state.appSettings.themePreference;
    let isDark = false;
    
    if (preference === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = preference === 'dark';
    }
    
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.appSettings.themePreference]);

  // Toggle button behavior: cycles light/dark explicit overrides
  const toggleDarkMode = () => {
    const nextTheme = darkMode ? 'light' : 'dark';
    updateAppPreferences({ themePreference: nextTheme });
  };

  return (
    <div>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200 w-full relative">
        <NavTabs 
          currentTab={currentTab} 
          onTabChange={setCurrentTab} 
          darkMode={darkMode} 
          toggleDarkMode={toggleDarkMode}
        />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {currentTab === 'dashboard' && (
            <DashboardView 
              state={state} 
              onToggleWidget={toggleDashboardWidget}
              onMoveWidget={moveDashboardWidget}
            />
          )}
          
          {currentTab === 'budgets' && (
            <BudgetView 
              state={state} 
              onAddCategory={addCategory} 
              onUpdateBudget={updateBudgetEntry}
              onEnsureMonth={recomputeBudgetsForMonth}
            />
          )}
          
          {currentTab === 'transactions' && (
            <TransactionsView 
              state={state} 
              onAddTransaction={addManualTransaction}
              onUpdateTransaction={updateTransaction}
            />
          )}
          
          {currentTab === 'accounts' && <AccountsView state={state} />}
          
          {currentTab === 'goals' && (
            <GoalsFireView 
              state={state} 
              onUpdateFireConfig={updateFireConfig} 
              onAddGoal={addGoal}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView 
              state={state}
              onUpdateProfile={updateProfileSettings}
              onUpdateAppPreferences={updateAppPreferences}
              onUpdateAiSettings={updateAiSettings}
              onExportData={exportStateAsJson}
              onResetData={resetAllData}
            />
          )}
        </main>

        <FloatingAssistant state={state} />
      </div>
    </div>
  );
}
