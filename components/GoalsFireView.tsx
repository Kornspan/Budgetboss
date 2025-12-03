
import React, { useMemo, useState } from 'react';
import { FinanceState, FireConfig } from '../types';
import { formatMoney, simulateFire, parseMoney } from '../lib/finance';
import { askFireCoach } from '../lib/ai';

interface GoalsFireViewProps {
  state: FinanceState;
  onUpdateFireConfig: (config: Partial<FireConfig>) => void;
  onAddGoal: (name: string, targetCents: number, currentCents: number) => void;
}

export const GoalsFireView: React.FC<GoalsFireViewProps> = ({ state, onUpdateFireConfig, onAddGoal }) => {
  const { yearsToFI, yearlyValues } = simulateFire(state.fireConfig);
  
  // AI State
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Add Goal State
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTargetStr, setNewGoalTargetStr] = useState('');
  const [newGoalCurrentStr, setNewGoalCurrentStr] = useState('');

  const handleConfigChange = (field: keyof FireConfig, val: string) => {
    let numVal: number;
    if (field.includes('Cents')) {
        numVal = parseMoney(val);
    } else {
        numVal = parseFloat(val);
        if (isNaN(numVal)) numVal = 0;
    }
    onUpdateFireConfig({ [field]: numVal });
  };

  const handleAskCoach = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!question.trim()) return;

      setLoadingAi(true);
      setAnswer(null);

      try {
          const response = await askFireCoach({
              config: state.fireConfig,
              goals: state.goals,
              question: question.trim(),
              options: {
                personality: state.appSettings.ai.personality,
                searchGroundingEnabled: state.appSettings.ai.searchGroundingEnabled,
                displayName: state.appSettings.profile.displayName
              }
          });
          setAnswer(response);
      } catch (err) {
          setAnswer("Sorry, I couldn't reach the coach right now.");
      } finally {
          setLoadingAi(false);
      }
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGoalName && newGoalTargetStr) {
        onAddGoal(newGoalName, parseMoney(newGoalTargetStr), parseMoney(newGoalCurrentStr));
        setIsAddingGoal(false);
        setNewGoalName('');
        setNewGoalTargetStr('');
        setNewGoalCurrentStr('');
    }
  };

  const projectionTable = useMemo(() => {
    // Show every 5th year + the final FI year
    return yearlyValues.filter(v => v.yearIndex % 5 === 0 || v.yearIndex === 1 || (yearsToFI && v.yearIndex === yearsToFI));
  }, [yearlyValues, yearsToFI]);

  return (
    <div className="space-y-12 max-w-6xl mx-auto w-full">
      
      {/* SECTION 1: GOALS */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Savings Goals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.goals.map(goal => {
                const percent = Math.min(100, Math.round((goal.currentCents / (goal.targetCents || 1)) * 100));
                return (
                    <div key={goal.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-40 transition-colors duration-200">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-slate-800 dark:text-white">{goal.name}</h3>
                                <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full">{percent}%</span>
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                {formatMoney(goal.currentCents)} of {formatMoney(goal.targetCents)}
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
                            <div className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                        </div>
                    </div>
                )
            })}
             {/* Add Goal UI */}
             {!isAddingGoal ? (
                 <div onClick={() => setIsAddingGoal(true)} className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center h-40 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer select-none">
                    + Add Goal
                 </div>
             ) : (
                 <form onSubmit={handleAddGoal} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-40 flex flex-col justify-center animate-fade-in-down">
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="Goal Name (e.g. Car)" 
                            required
                            autoFocus
                            value={newGoalName} 
                            onChange={e => setNewGoalName(e.target.value)}
                            className="block w-full text-sm border-b border-slate-200 dark:border-slate-600 bg-transparent focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white pb-1 placeholder-slate-400"
                        />
                         <div className="flex gap-3">
                             <input 
                                type="text" 
                                placeholder="Target $" 
                                required
                                value={newGoalTargetStr} 
                                onChange={e => setNewGoalTargetStr(e.target.value)}
                                className="block w-1/2 text-sm border-b border-slate-200 dark:border-slate-600 bg-transparent focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white pb-1 placeholder-slate-400"
                            />
                             <input 
                                type="text" 
                                placeholder="Current $" 
                                value={newGoalCurrentStr} 
                                onChange={e => setNewGoalCurrentStr(e.target.value)}
                                className="block w-1/2 text-sm border-b border-slate-200 dark:border-slate-600 bg-transparent focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white pb-1 placeholder-slate-400"
                            />
                         </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setIsAddingGoal(false)} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1">Cancel</button>
                        <button type="submit" className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 font-medium">Save Goal</button>
                    </div>
                 </form>
             )}
        </div>
      </div>

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* SECTION 2: FIRE Calculator */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Financial Independence / Retire Early</h2>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* INPUTS (Left Col) */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-fit transition-colors duration-200">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">Parameters</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Current Portfolio</label>
                        <input 
                        type="text" 
                        defaultValue={(state.fireConfig.currentPortfolioCents / 100).toFixed(2)}
                        onBlur={e => handleConfigChange('currentPortfolioCents', e.target.value)}
                        className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Monthly Contribution</label>
                        <input 
                        type="text" 
                        defaultValue={(state.fireConfig.monthlyContributionCents / 100).toFixed(2)}
                        onBlur={e => handleConfigChange('monthlyContributionCents', e.target.value)}
                        className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Annual Spend (Target)</label>
                        <input 
                        type="text" 
                        defaultValue={(state.fireConfig.annualSpendCents / 100).toFixed(2)}
                        onBlur={e => handleConfigChange('annualSpendCents', e.target.value)}
                        className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Return %</label>
                            <input 
                            type="number" 
                            defaultValue={state.fireConfig.expectedRealReturnPercent}
                            onBlur={e => handleConfigChange('expectedRealReturnPercent', e.target.value)}
                            className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">SWR %</label>
                            <input 
                            type="number" 
                            defaultValue={state.fireConfig.safeWithdrawalRatePercent}
                            onBlur={e => handleConfigChange('safeWithdrawalRatePercent', e.target.value)}
                            className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* RESULTS (Right Col) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* PROJECTION CARD */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col transition-colors duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Projection</h3>
                            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                                {yearsToFI ? `${yearsToFI} Years` : '60+ Years'}
                            </p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">FI Number</h3>
                            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                {formatMoney((state.fireConfig.annualSpendCents * 100) / state.fireConfig.safeWithdrawalRatePercent)}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-x-auto rounded border border-slate-100 dark:border-slate-700">
                        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">Timeline</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">Portfolio Value</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-50 dark:divide-slate-700 text-sm">
                                {projectionTable.map(v => (
                                    <tr key={v.yearIndex} className={v.yearIndex === yearsToFI ? "bg-green-50 dark:bg-green-900/20 font-semibold" : ""}>
                                        <td className="px-4 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">Year {v.yearIndex}</td>
                                        <td className="px-4 py-2 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">{formatMoney(v.valueCents)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* AI COACH CARD */}
                <div className="bg-indigo-50 dark:bg-slate-800/80 p-6 rounded-2xl shadow-sm border border-indigo-100 dark:border-slate-700">
                     <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2">
                        <span>🤖</span> Ask FI Coach
                     </h3>
                     <form onSubmit={handleAskCoach} className="space-y-4">
                        <textarea
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            placeholder='E.g. "What if I increase my monthly contribution by $200?" or "Is a 4% withdrawal rate safe?"'
                            className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-3 border min-h-[80px]"
                        />
                        <div className="flex justify-end">
                            <button 
                                type="submit" 
                                disabled={loadingAi || !question.trim()}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                            >
                                {loadingAi ? 'Thinking...' : 'Ask Gemini'}
                            </button>
                        </div>
                     </form>

                     {answer && (
                         <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-slate-600">
                             <div className="prose prose-sm prose-indigo dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                 {answer}
                             </div>
                             <p className="text-[10px] text-slate-400 mt-2 italic">
                                AI-generated. Financial situations vary; consult a professional.
                             </p>
                         </div>
                     )}
                </div>

            </div>

        </div>
      </div>
    </div>
  );
};
