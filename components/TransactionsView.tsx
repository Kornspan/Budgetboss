
import React, { useState, useMemo } from 'react';
import { FinanceState, Transaction } from '../types';
import { formatMoney, parseMoney } from '../lib/finance';
import { getCategorySuggestion } from '../lib/ai';

interface TransactionsViewProps {
  state: FinanceState;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'userId' | 'source' | 'status' | 'importedAt'>) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
}

type SortField = 'date' | 'amount';
type SortDirection = 'asc' | 'desc';

export const TransactionsView: React.FC<TransactionsViewProps> = ({ state, onAddTransaction, onUpdateTransaction }) => {
  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    categoryId: '',
    accountId: '',
    amountStr: '',
    notes: ''
  });

  // Filter & Sort State
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterName, setFilterName] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Suggestion State
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ id: string; name: string; reason: string; categoryId: string } | null>(null);
  const [suggestionMessage, setSuggestionMessage] = useState<{ id: string; text: string; kind: 'error' | 'info' } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.accountId || !formData.amountStr) return;

    const cents = parseMoney(formData.amountStr);

    onAddTransaction({
      date: formData.date,
      name: formData.name,
      categoryId: formData.categoryId || null,
      accountId: formData.accountId,
      amountCents: cents,
      notes: formData.notes
    });

    setFormData({ ...formData, name: '', amountStr: '', notes: '' });
  };

  const handleSuggestCategory = async (tx: Transaction) => {
      setSuggestingId(tx.id);
      setSuggestion(null);
      setSuggestionMessage(null);

      const categories = state.categories.map(c => ({ id: c.id, name: c.name }));
      try {
        const result = await getCategorySuggestion(tx, categories);

        if (result?.suggestedCategoryId) {
            const matchedCat = state.categories.find(c => c.id === result.suggestedCategoryId) ||
              state.categories.find(c => c.name === result.suggestedCategoryName);
            if (matchedCat) {
                setSuggestion({
                    id: tx.id,
                    name: matchedCat.name,
                    reason: result.reason,
                    categoryId: matchedCat.id
                });
                setSuggestionMessage({ id: tx.id, text: `Suggested: ${matchedCat.name} – ${result.reason}`, kind: 'success' });
            } else {
              setSuggestionMessage({ id: tx.id, text: 'AI suggested a category that was not found in your list.', kind: 'error' });
            }
        } else if (result?.suggestedCategoryName) {
          const matchedCat = state.categories.find(c => c.name === result.suggestedCategoryName);
          if (matchedCat) {
            setSuggestion({
              id: tx.id,
              name: matchedCat.name,
              reason: result.reason,
              categoryId: matchedCat.id,
            });
          } else {
            setSuggestionMessage({ id: tx.id, text: `AI suggested "${result.suggestedCategoryName}", but you don't have that category yet.`, kind: 'error' });
          }
        } else {
          setSuggestionMessage({ id: tx.id, text: result?.reason || 'No category suggestion available.', kind: 'info' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'See console for details';
        setSuggestionMessage({ id: tx.id, text: `AI suggestion failed: ${message}`, kind: 'error' });
        console.error('AI suggestion failed', err);
      }
      setSuggestingId(null);
  };

  const applySuggestion = (txId: string) => {
      if (suggestion && suggestion.id === txId) {
          onUpdateTransaction(txId, { categoryId: suggestion.categoryId });
          setSuggestion(null);
      }
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...state.transactions];

    // 1. Filter
    if (filterStart) result = result.filter(t => t.date >= filterStart);
    if (filterEnd) result = result.filter(t => t.date <= filterEnd);
    if (filterCategory) result = result.filter(t => t.categoryId === filterCategory);
    if (filterAccount) result = result.filter(t => t.accountId === filterAccount);
    if (filterName) result = result.filter(t => t.name.toLowerCase().includes(filterName.toLowerCase()));

    // 2. Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = a.id.localeCompare(b.id);
      } else if (sortField === 'amount') {
        cmp = a.amountCents - b.amountCents;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [state.transactions, filterStart, filterEnd, filterCategory, filterAccount, filterName, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); 
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-300 dark:text-slate-600 ml-1 opacity-0 group-hover:opacity-50">↕</span>;
    return <span className="text-indigo-600 dark:text-indigo-400 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
      
      {/* LEFT COLUMN: List & Filters (Span 2) */}
      <div className="lg:col-span-2 space-y-4 w-full">
        
        {/* Toolbar */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3 transition-colors duration-200">
            <div className="flex flex-col sm:flex-row gap-3">
                <input 
                    type="text" 
                    placeholder="Search Payee..."
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    className="w-full sm:flex-1 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                />
                <select 
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="w-full sm:flex-1 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                >
                    <option value="">All Categories</option>
                    {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select 
                    value={filterAccount}
                    onChange={e => setFilterAccount(e.target.value)}
                    className="w-full sm:flex-1 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                >
                    <option value="">All Accounts</option>
                    {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            </div>
            <div className="flex gap-3 flex-wrap">
                <input 
                    type="date" 
                    value={filterStart}
                    onChange={e => setFilterStart(e.target.value)}
                    className="flex-1 min-w-[130px] rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                />
                 <span className="self-center text-slate-400 text-sm">to</span>
                <input 
                    type="date" 
                    value={filterEnd}
                    onChange={e => setFilterEnd(e.target.value)}
                    className="flex-1 min-w-[130px] rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                />
            </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden transition-colors duration-200">
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th 
                      className="group px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none min-w-[120px]"
                      onClick={() => toggleSort('date')}
                  >
                      Date <SortIcon field="date" />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[150px]">Payee</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[150px]">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[120px]">Account</th>
                  <th 
                      className="group px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none min-w-[100px]"
                      onClick={() => toggleSort('amount')}
                  >
                      Amount <SortIcon field="amount" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                {filteredAndSortedTransactions.map((tx) => {
                    const category = state.categories.find(c => c.id === tx.categoryId);
                    const account = state.accounts.find(a => a.id === tx.accountId);
                    const hasSuggestion = suggestion && suggestion.id === tx.id;
                    const isSuggesting = suggestingId === tx.id;
                    const messageForRow = suggestionMessage && suggestionMessage.id === tx.id ? suggestionMessage : null;

                    return (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{tx.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                           {tx.name}
                           {tx.source === 'imported' && (
                             <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800">Bank</span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                                {category ? (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        {category.name}
                                    </span>
                                ) : (
                                    <button 
                                        onClick={() => handleSuggestCategory(tx)}
                                        disabled={isSuggesting || state.categories.length === 0}
                                        className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline flex items-center"
                                    >
                                        {state.categories.length === 0 ? 'Add categories first' : isSuggesting ? 'Thinking...' : '✨ Suggest'}
                                    </button>
                                )}
                                
                                {hasSuggestion && (
                                    <div className="mt-1 flex flex-col bg-indigo-50 dark:bg-slate-700/80 p-2 rounded-md border border-indigo-100 dark:border-slate-600">
                                        <div className="text-xs text-indigo-900 dark:text-indigo-200">
                                            <strong>{suggestion.name}</strong> <span className="opacity-75">- {suggestion.reason}</span>
                                        </div>
                                        <div className="flex gap-2 mt-1.5">
                                            <button 
                                                onClick={() => applySuggestion(tx.id)}
                                                className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded"
                                            >
                                                Apply
                                            </button>
                                            <button 
                                                onClick={() => setSuggestion(null)}
                                                className="text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {messageForRow && (
                                  <div className={`text-xs mt-1 ${messageForRow.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {messageForRow.text}
                                  </div>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{account?.name || 'Unknown'}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${tx.amountCents >= 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                            {formatMoney(tx.amountCents)}
                        </td>
                        </tr>
                    );
                })}
                {filteredAndSortedTransactions.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No transactions match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Add Form (Span 1) */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 sticky top-24 transition-colors duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">New Manual Transaction</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Payee / Name</label>
                <input
                    type="text"
                    required
                    placeholder="e.g. Target"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Amount</label>
                <input
                    type="text"
                    required
                    placeholder="-0.00"
                    value={formData.amountStr}
                    onChange={e => setFormData({...formData, amountStr: e.target.value})}
                    className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Account</label>
                <select
                    required
                    value={formData.accountId}
                    onChange={e => setFormData({...formData, accountId: e.target.value})}
                    className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                >
                    <option value="">Select Account</option>
                    {state.accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                    value={formData.categoryId}
                    onChange={e => setFormData({...formData, categoryId: e.target.value})}
                    className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                >
                    <option value="">Uncategorized</option>
                    {state.categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <input
                    type="text"
                    placeholder="Optional"
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 border"
                />
            </div>
            <button type="submit" className="w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-2 transition-colors">
                Add Transaction
            </button>
            </form>
        </div>
      </div>
    </div>
  );
};
