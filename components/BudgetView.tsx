import React, { useState, useEffect, useMemo } from 'react';
import { FinanceState, Category } from '../types';
import { formatMoney, parseMoney, getTransactionsForMonth, calculateCategorySpent } from '../lib/finance';

interface BudgetViewProps {
  state: FinanceState;
  onUpdateBudget: (categoryId: string, monthId: string, amount: number) => void;
  onAddCategory: (name: string, group?: string) => void;
  onEnsureMonth: (year: number, month: number) => string;
}

interface CategoryMetric {
  cat: Category;
  budgeted: number;
  spent: number;
  remaining: number;
}

export const BudgetView: React.FC<BudgetViewProps> = ({ state, onUpdateBudget, onAddCategory, onEnsureMonth }) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroup, setNewCatGroup] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  // Adding category UI state
  const [isAdding, setIsAdding] = useState(false);

  // Default to current month
  const today = new Date();
  const [year] = useState(today.getFullYear());
  const [month] = useState(today.getMonth() + 1);

  useEffect(() => {
    onEnsureMonth(year, month);
  }, [year, month, onEnsureMonth]);

  const monthId = `bm_${year}_${month}`;
  
  const monthTransactions = useMemo(() => 
    getTransactionsForMonth(state.transactions, year, month),
    [state.transactions, year, month]
  );

  const handleBudgetChange = (catId: string, val: string) => {
    const cents = parseMoney(val);
    onUpdateBudget(catId, monthId, cents);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim(), newCatGroup.trim() || 'General');
      setNewCatName('');
      setNewCatGroup('');
      setIsAdding(false);
    }
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => ({...prev, [group]: !prev[group]}));
  };

  const categoryMetrics = useMemo<CategoryMetric[]>(() => {
    return state.categories.map(cat => {
      const entry = state.budgetEntries.find(be => be.categoryId === cat.id && be.budgetMonthId === monthId);
      const budgeted = entry?.budgetedCents || 0;
      const spent = calculateCategorySpent(monthTransactions, cat.id); // negative
      const remaining = budgeted + spent;
      return { cat, budgeted, spent, remaining };
    });
  }, [state.categories, state.budgetEntries, monthTransactions, monthId]);

  const groupedData = useMemo<Record<string, CategoryMetric[]>>(() => {
    const groups: Record<string, CategoryMetric[]> = {};
    categoryMetrics.forEach(item => {
      const group = item.cat.group || 'Uncategorized';
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  }, [categoryMetrics]);

  return (
    <div className="space-y-6 w-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
           {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
      </div>

      <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden transition-colors duration-200">
        <div className="overflow-x-auto w-full">
            <table className="min-w-full text-sm">
            <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left">
                <th className="px-6 py-4 font-semibold w-1/3 min-w-[150px]">Category</th>
                <th className="px-6 py-4 font-semibold text-right min-w-[100px]">Budgeted</th>
                <th className="px-6 py-4 font-semibold text-right min-w-[100px]">Spent</th>
                <th className="px-6 py-4 font-semibold text-right min-w-[100px]">Remaining</th>
                <th className="px-6 py-4 font-semibold w-24 min-w-[100px]">Usage</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {Object.entries(groupedData).map(([group, items]: [string, CategoryMetric[]]) => {
                const groupBudgeted = items.reduce((sum, item) => sum + item.budgeted, 0);
                const groupSpent = items.reduce((sum, item) => sum + item.spent, 0);
                const groupRemaining = items.reduce((sum, item) => sum + item.remaining, 0);
                const isCollapsed = collapsedGroups[group];

                return (
                    <React.Fragment key={group}>
                    {/* Group Header */}
                    <tr 
                        className="bg-slate-50/50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors" 
                        onClick={() => toggleGroup(group)}
                    >
                        <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200 flex items-center whitespace-nowrap">
                            <span className="mr-2 text-slate-400 text-[10px] w-4">
                                {isCollapsed ? '▶' : '▼'}
                            </span>
                            {group}
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatMoney(groupBudgeted)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatMoney(groupSpent)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatMoney(groupRemaining)}</td>
                        <td className="px-6 py-3"></td>
                    </tr>

                    {/* Category Rows */}
                    {!isCollapsed && items.map(({ cat, budgeted, spent, remaining }) => {
                        const progressPercent = budgeted > 0 ? Math.min(100, (Math.abs(spent) / budgeted) * 100) : (spent < 0 ? 100 : 0);
                        const barColor = remaining < 0 ? 'bg-red-500' : 'bg-green-500';
                        
                        return (
                        <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 group transition-colors">
                            <td className="px-6 py-3 pl-12 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {cat.name}
                            </td>
                            <td className="px-6 py-3 text-right whitespace-nowrap">
                            <input 
                                type="text"
                                defaultValue={(budgeted / 100).toFixed(2)}
                                onBlur={(e) => handleBudgetChange(cat.id, e.target.value)}
                                className="w-24 text-right bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-slate-600 dark:text-slate-300 transition-all outline-none"
                            />
                            </td>
                            <td className="px-6 py-3 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatMoney(spent)}
                            </td>
                            <td className={`px-6 py-3 text-right font-bold whitespace-nowrap ${remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {formatMoney(remaining)}
                            </td>
                            <td className="px-6 py-3 align-middle min-w-[100px]">
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor}`} style={{ width: `${progressPercent}%` }}></div>
                            </div>
                            </td>
                        </tr>
                        );
                    })}
                    </React.Fragment>
                );
                })}
                {state.categories.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No categories found. Start by adding one below.</td></tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* Inline Add Form */}
      <div className="mt-4">
        {!isAdding ? (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            <span className="text-lg mr-1">+</span> Add Category
          </button>
        ) : (
          <form onSubmit={handleAddCategory} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 items-end sm:items-center animate-fade-in-down w-full">
            <div className="flex-1 w-full">
                <input 
                  type="text" 
                  placeholder="Category Name" 
                  autoFocus
                  required
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                />
            </div>
            <div className="w-full sm:w-48">
                <input 
                  type="text" 
                  placeholder="Group (e.g. Living)" 
                  value={newCatGroup}
                  onChange={e => setNewCatGroup(e.target.value)}
                  className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <button type="submit" className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm">
                Save
                </button>
                <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                Cancel
                </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};