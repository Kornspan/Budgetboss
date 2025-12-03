
import React from 'react';
import { FinanceState } from '../types';
import { calculateNetWorth, formatMoney } from '../lib/finance';

interface AccountsViewProps {
  state: FinanceState;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ state }) => {
  const { assets, liabilities, netWorth } = calculateNetWorth(state.accounts);

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      
      {/* Summary Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 flex flex-col md:flex-row justify-between items-center gap-6 transition-colors duration-200 w-full">
         <div className="text-center md:text-left">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Net Worth</h2>
            <p className="text-4xl font-extrabold text-slate-900 dark:text-white mt-1">{formatMoney(netWorth)}</p>
         </div>
         <div className="flex gap-12">
            <div className="text-center md:text-right">
                <p className="text-xs text-slate-400 uppercase font-semibold">Assets</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatMoney(assets)}</p>
            </div>
            <div className="text-center md:text-right">
                <p className="text-xs text-slate-400 uppercase font-semibold">Liabilities</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatMoney(liabilities)}</p>
            </div>
         </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden transition-colors duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Your Accounts</h3>
        </div>
        <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Balance</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                    {state.accounts.map(acc => {
                        const isLiability = acc.currentBalanceCents < 0 && (acc.type === 'credit' || acc.type === 'other'); 
                        // Note: A negative balance on a credit card is usually a liability. 
                        // The logic in calculateNetWorth handles this. Visual coloring here helps users.
                        
                        return (
                            <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                    <div className="flex flex-col">
                                        <span>{acc.name}</span>
                                        {acc.institutionName && (
                                            <span className="text-xs text-slate-400 font-normal">{acc.institutionName}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 capitalize">
                                    {acc.type}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {acc.provider === 'manual' ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                            Manual
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                                            Linked
                                        </span>
                                    )}
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${acc.currentBalanceCents < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {formatMoney(acc.currentBalanceCents)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};
