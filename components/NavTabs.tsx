import React from 'react';

type Tab = 'dashboard' | 'budgets' | 'transactions' | 'accounts' | 'goals' | 'settings';

interface NavTabsProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const NavTabs: React.FC<NavTabsProps> = ({ currentTab, onTabChange, darkMode, toggleDarkMode }) => {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'budgets', label: 'Budgets' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'goals', label: 'Goals / FIRE' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <span className="font-bold text-xl text-indigo-600 dark:text-indigo-400 tracking-tight">
              Finance<span className="text-slate-900 dark:text-white">App</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex space-x-1">
              {tabs.map((tab) => {
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${isActive 
                        ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? (
                // Sun Icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                // Moon Icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu - Rendered in flow (not absolute) so it pushes content down */}
      <div className="sm:hidden w-full bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 px-4 py-2">
         <div className="flex overflow-x-auto space-x-2 no-scrollbar pb-1">
             {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    whitespace-nowrap px-3 py-1 text-sm font-medium rounded-md flex-shrink-0
                    ${currentTab === tab.id 
                      ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-slate-700' 
                      : 'text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-600'
                    }
                  `}
                >
                  {tab.label}
                </button>
             ))}
         </div>
      </div>
    </nav>
  );
};