
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { FinanceState, DashboardWidgetConfig, FireConfig, Category, Transaction, BudgetEntry, AppSettings } from '../types';
import { calculateNetWorth, formatMoney, getTransactionsForMonth, simulateFire, calculateCategorySpent } from '../lib/finance';
import { useAiChat } from '../hooks/useAiChat'; // Use new hook
import ReactMarkdown from 'react-markdown';

// --- PROPS & INTERFACES ---

interface DashboardViewProps {
  state: FinanceState;
  onToggleWidget: (id: string, enabled: boolean) => void;
  onMoveWidget: (id: string, direction: 'up' | 'down') => void;
}

// --- WIDGET COMPONENTS ---

const NetWorthWidget = ({ netWorth, assets, liabilities }: { netWorth: number; assets: number; liabilities: number }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-36 transition-colors duration-200">
    <div>
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Worth</h3>
      <p className={`mt-2 text-3xl font-extrabold ${netWorth >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
        {formatMoney(netWorth)}
      </p>
    </div>
    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
      <span>Assets: <span className="text-green-600 dark:text-green-400 font-medium">{formatMoney(assets)}</span></span>
      <span>Liabilities: <span className="text-red-600 dark:text-red-400 font-medium">{formatMoney(liabilities)}</span></span>
    </div>
  </div>
);

const BudgetWidget = ({ remaining, spent, budgeted, monthName }: { remaining: number; spent: number; budgeted: number; monthName: string }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-36 transition-colors duration-200">
    <div>
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        Budget ({monthName})
      </h3>
      <div className="mt-2 flex items-baseline space-x-2">
        <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
          {formatMoney(remaining)}
        </p>
        <span className="text-xs text-slate-400 dark:text-slate-500">left</span>
      </div>
    </div>
    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mt-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${remaining < 0 ? 'bg-red-500' : 'bg-indigo-500 dark:bg-indigo-400'}`}
        style={{ width: `${Math.min(100, (Math.abs(spent) / (budgeted || 1)) * 100)}%` }}
      ></div>
    </div>
  </div>
);

const FireWidget = ({ projection, config }: { projection: any; config: FireConfig }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-36 transition-colors duration-200">
    <div>
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">FIRE Countdown</h3>
      <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
        {projection.yearsToFI ? `~${projection.yearsToFI} Years` : "On Track"}
      </p>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
      Target: <span className="font-medium text-slate-700 dark:text-slate-300">{formatMoney((config.annualSpendCents * 100) / config.safeWithdrawalRatePercent)}</span>
    </p>
  </div>
);

const TopSpendingWidget = ({ items }: { items: { name: string; spent: number; budget: number }[] }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors duration-200 h-full">
    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Top Spending</h3>
    {items.length === 0 ? (
      <p className="text-slate-400 text-sm">No spending yet.</p>
    ) : (
      <div className="space-y-5">
        {items.map((item) => {
          const percent = item.budget ? Math.min(100, (Math.abs(item.spent) / item.budget) * 100) : 0;
          return (
            <div key={item.name}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                <span className="text-slate-900 dark:text-white font-semibold">{formatMoney(item.spent)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 dark:bg-indigo-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const RecentTransactionsWidget = ({ transactions }: { transactions: Transaction[] }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors duration-200 h-full">
    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Recent Transactions</h3>
    <div className="overflow-hidden">
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {transactions.map((tx) => (
          <li key={tx.id} className="py-4 flex justify-between items-center text-sm group hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-4 px-4 transition-colors">
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900 dark:text-white">{tx.name}</span>
              <span className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{tx.date}</span>
            </div>
            <span className={`font-bold ${tx.amountCents < 0 ? 'text-slate-900 dark:text-white' : 'text-green-600 dark:text-green-400'}`}>
              {formatMoney(tx.amountCents)}
            </span>
          </li>
        ))}
        {transactions.length === 0 && (
          <p className="text-slate-400 text-sm">No transactions found.</p>
        )}
      </ul>
    </div>
  </div>
);

const AiAssistantWidget = ({ contextData, appSettings }: { contextData: any; appSettings: AppSettings }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the shared hook
  const { messages, isTyping, sendMessage } = useAiChat(contextData, {
    personality: appSettings.ai.personality,
    searchGroundingEnabled: appSettings.ai.searchGroundingEnabled,
    displayName: appSettings.profile.displayName
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-[350px] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-indigo-100 dark:border-slate-700 overflow-hidden transition-colors duration-200">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-slate-700 dark:to-slate-800 p-3 shrink-0">
        <h3 className="text-white font-bold flex items-center gap-2 text-sm">
          <span>🤖</span> AI Financial Assistant
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-900/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm text-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-none'
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'
              }`}>
              {msg.role === 'model' ? (
                <div className="prose prose-sm prose-indigo dark:prose-invert">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                msg.text
              )}
              {msg.groundingSources && msg.groundingSources.length > 0 && (
                <div className="mt-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
                   <p className="font-semibold text-slate-500 mb-1">Sources:</p>
                   <div className="flex flex-wrap gap-2">
                     {msg.groundingSources.map((source, i) => (
                       <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[150px]">
                         {source.title}
                       </a>
                     ))}
                   </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 text-slate-500 text-xs px-3 py-2 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask about your budget, spending..."
          className="flex-1 rounded-lg border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isTyping}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </form>
    </div>
  );
};

// --- MAIN DASHBOARD COMPONENT ---

export const DashboardView: React.FC<DashboardViewProps> = ({ state, onToggleWidget, onMoveWidget }) => {
  const [showCustomize, setShowCustomize] = useState(false);

  // 1. Prepare Data for widgets
  const { assets, liabilities, netWorth } = calculateNetWorth(state.accounts);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthTransactions = useMemo(() => getTransactionsForMonth(state.transactions, year, month), [state.transactions, year, month]);
  
  const budgetSummary = useMemo(() => {
    const monthId = `bm_${year}_${month}`;
    let totalBudgeted = 0;
    let totalSpent = 0;

    state.categories.forEach(cat => {
      const entry = state.budgetEntries.find(be => be.categoryId === cat.id && be.budgetMonthId === monthId);
      const budgeted = entry?.budgetedCents || 0;
      const spent = calculateCategorySpent(monthTransactions, cat.id); // negative
      totalBudgeted += budgeted;
      totalSpent += spent;
    });

    return {
      budgeted: totalBudgeted,
      spent: totalSpent,
      remaining: totalBudgeted + totalSpent
    };
  }, [state.categories, state.budgetEntries, monthTransactions, year, month]);

  const topSpending = useMemo(() => {
    const map = new Map<string, { spent: number; budget: number }>();
    const monthId = `bm_${year}_${month}`;

    monthTransactions.forEach(tx => {
      if (tx.amountCents < 0 && tx.categoryId) {
        const cat = state.categories.find(c => c.id === tx.categoryId);
        if (cat) {
          const current = map.get(cat.name) || { spent: 0, budget: 0 };
          const entry = state.budgetEntries.find(be => be.categoryId === cat.id && be.budgetMonthId === monthId);
          current.spent += tx.amountCents;
          current.budget = entry?.budgetedCents || 0;
          map.set(cat.name, current);
        }
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, spent: data.spent, budget: data.budget }))
      .sort((a, b) => a.spent - b.spent) // Most negative first
      .slice(0, 5);
  }, [monthTransactions, state.categories, state.budgetEntries, year, month]);

  const recentTransactions = useMemo(() => {
    return [...state.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [state.transactions]);

  const fireProjection = useMemo(() => simulateFire(state.fireConfig), [state.fireConfig]);

  // 2. Filter Active Widgets
  const activeWidgets = state.dashboardWidgets
    .filter(w => w.enabled)
    .sort((a, b) => a.position - b.position);

  // 3. Render Widget Helper
  const renderWidget = (config: DashboardWidgetConfig) => {
    switch (config.type) {
      case 'netWorthSummary':
        return <NetWorthWidget netWorth={netWorth} assets={assets} liabilities={liabilities} />;
      case 'budgetSummary':
        return <BudgetWidget remaining={budgetSummary.remaining} spent={budgetSummary.spent} budgeted={budgetSummary.budgeted} monthName={today.toLocaleString('default', { month: 'long' })} />;
      case 'fireCountdown':
        return <FireWidget projection={fireProjection} config={state.fireConfig} />;
      case 'topSpending':
        return <TopSpendingWidget items={topSpending} />;
      case 'recentTransactions':
        return <RecentTransactionsWidget transactions={recentTransactions} />;
      case 'aiAssistant':
        return <AiAssistantWidget contextData={{ netWorth, budgetSummary, recentTransactions }} appSettings={state.appSettings} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
        <button 
          onClick={() => setShowCustomize(!showCustomize)}
          className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
        >
          {showCustomize ? 'Done' : 'Customize Layout'}
        </button>
      </div>

      {/* Customization Panel */}
      {showCustomize && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 mb-8 animate-fade-in-down">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">Manage Widgets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...state.dashboardWidgets].sort((a, b) => a.position - b.position).map((widget) => (
              <div key={widget.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{widget.label}</span>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => onMoveWidget(widget.id, 'up')}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30"
                    disabled={widget.position === 0}
                  >
                    ↑
                  </button>
                  <button 
                    onClick={() => onMoveWidget(widget.id, 'down')}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30"
                    disabled={widget.position === state.dashboardWidgets.length - 1}
                  >
                    ↓
                  </button>
                  <button 
                    onClick={() => onToggleWidget(widget.id, !widget.enabled)}
                    className={`ml-2 w-8 h-4 rounded-full transition-colors relative ${widget.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${widget.enabled ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-min">
        {activeWidgets.map(widget => {
          let colSpan = 'md:col-span-1';
          if (widget.size === 'medium') colSpan = 'md:col-span-1 xl:col-span-1';
          if (widget.size === 'large') colSpan = 'md:col-span-2 xl:col-span-2'; // Expanded AI widget
          
          return (
            <div key={widget.id} className={`${colSpan}`}>
              {renderWidget(widget)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
