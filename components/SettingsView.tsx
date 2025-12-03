
import React, { useState } from 'react';
import { FinanceState, ThemePreference, AiPersonality } from '../types';

type SettingsTab = 'profile' | 'data' | 'app';

interface SettingsViewProps {
  state: FinanceState;
  onUpdateProfile: (input: { displayName?: string; email?: string }) => void;
  onUpdateAppPreferences: (input: { themePreference?: ThemePreference; notificationsEnabled?: boolean }) => void;
  onUpdateAiSettings: (input: { personality?: AiPersonality; searchGroundingEnabled?: boolean }) => void;
  onExportData: () => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateProfile,
  onUpdateAppPreferences,
  onUpdateAiSettings,
  onExportData,
  onResetData
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { appSettings, accounts } = state;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile & Security', icon: '👤' },
    { id: 'data', label: 'Data & Connections', icon: '🔗' },
    { id: 'app', label: 'App & AI', icon: '🤖' },
  ];

  const handleReset = () => {
    if (window.confirm("Are you sure? This will delete all your data locally and refresh the page.")) {
      onResetData();
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Profile Details</h3>
            
            <div className="grid gap-6 max-w-xl">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-2xl">
                  👨‍💻
                </div>
                <div>
                  <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Change Avatar</button>
                  <p className="text-xs text-slate-500">JPG or PNG, max 2MB (Placeholder)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={appSettings.profile.displayName}
                  onChange={(e) => onUpdateProfile({ displayName: e.target.value })}
                  className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={appSettings.profile.email}
                  onChange={(e) => onUpdateProfile({ email: e.target.value })}
                  className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2 pt-4">Security</h3>
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">Two-Factor Authentication</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Add an extra layer of security.</p>
                </div>
                <div className="w-10 h-5 bg-slate-300 dark:bg-slate-600 rounded-full relative cursor-not-allowed" title="Not available in prototype">
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700">
                 <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">Change Password</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Last changed 3 months ago.</p>
                </div>
                <button disabled className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg cursor-not-allowed">
                  Update
                </button>
              </div>
            </div>
          </div>
        );
      case 'data':
        return (
          <div className="space-y-6 animate-fade-in">
             <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Data & Connections</h3>
             
             {appSettings.prototypeMode && (
               <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                  <span className="text-xl">ℹ️</span>
                  <div>
                      <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">Prototype Mode</h4>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                          Currently running in local-first mode. Data is stored in your browser's LocalStorage. 
                          Future updates will support Plaid/Teller integration.
                      </p>
                  </div>
               </div>
             )}

             <div>
                <h4 className="font-medium text-slate-700 dark:text-slate-200 text-sm mb-3">Linked Accounts</h4>
                <div className="space-y-2 max-w-xl">
                    {accounts.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-500 uppercase">
                                  {acc.name.substring(0, 2)}
                              </div>
                              <div>
                                  <p className="text-sm font-medium text-slate-800 dark:text-white">{acc.name}</p>
                                  <p className="text-xs text-slate-500 capitalize">{acc.type} • {acc.provider}</p>
                              </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${acc.provider === 'manual' ? 'bg-slate-100 dark:bg-slate-700 text-slate-500' : 'bg-blue-100 text-blue-800'}`}>
                            {acc.provider === 'manual' ? 'Manual' : 'Linked'}
                          </span>
                      </div>
                    ))}
                    {accounts.length === 0 && <p className="text-sm text-slate-500">No accounts connected.</p>}
                </div>
                <button disabled className="mt-3 text-sm text-indigo-400 font-medium cursor-not-allowed flex items-center gap-1 opacity-70">
                    + Add New Connection (Coming Soon)
                </button>
             </div>

             <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2 pt-4">Data Management</h3>
             <div className="max-w-xl space-y-4">
                 <button 
                   onClick={onExportData}
                   className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                 >
                     <div>
                         <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">Export Data</p>
                         <p className="text-xs text-slate-500">Download your transactions and budget history as JSON.</p>
                     </div>
                     <span className="text-xl">⬇️</span>
                 </button>
                 
                 <div className="border-t border-red-100 dark:border-red-900/30 pt-4 mt-4">
                    <button 
                      onClick={handleReset}
                      className="text-red-600 dark:text-red-400 text-sm font-medium hover:underline"
                    >
                        Reset All Data (Danger Zone)
                    </button>
                 </div>
             </div>
          </div>
        );
      case 'app':
        return (
           <div className="space-y-6 animate-fade-in">
             <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">App Preferences</h3>
             
             <div className="max-w-xl space-y-4">
                <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                        <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">Theme Preference</p>
                        <p className="text-xs text-slate-500">Sync with system or manual toggle.</p>
                    </div>
                    <select 
                      value={appSettings.themePreference}
                      onChange={(e) => onUpdateAppPreferences({ themePreference: e.target.value as ThemePreference })}
                      className="text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 rounded-lg p-1.5 text-slate-700 dark:text-slate-300"
                    >
                        <option value="system">System Default</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                        <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">Notifications</p>
                        <p className="text-xs text-slate-500">Weekly budget summaries.</p>
                    </div>
                    <button 
                      onClick={() => onUpdateAppPreferences({ notificationsEnabled: !appSettings.notificationsEnabled })}
                      className={`w-10 h-5 rounded-full relative transition-colors ${appSettings.notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${appSettings.notificationsEnabled ? 'translate-x-5' : ''}`}></div>
                    </button>
                </div>
             </div>

             <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2 pt-4">AI Configuration</h3>
             <div className="max-w-xl space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">AI Coach Personality</label>
                    <select 
                      value={appSettings.ai.personality}
                      onChange={(e) => onUpdateAiSettings({ personality: e.target.value as AiPersonality })}
                      className="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    >
                        <option value="friendly">Friendly & Encouraging (Default)</option>
                        <option value="direct">Strict & Direct</option>
                        <option value="playful">Playful & Emojis</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Controls the tone of the AI Assistant on the dashboard.</p>
                 </div>
                 
                 <div className="flex items-start gap-2 pt-2">
                     <input 
                       type="checkbox" 
                       id="ai-search" 
                       checked={appSettings.ai.searchGroundingEnabled}
                       onChange={(e) => onUpdateAiSettings({ searchGroundingEnabled: e.target.checked })}
                       className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                     />
                     <label htmlFor="ai-search" className="text-sm text-slate-700 dark:text-slate-300">
                        Enable Google Search Grounding
                        <span className="block text-xs text-slate-500">Allows the AI to fetch real-time stock and economic data.</span>
                     </label>
                 </div>
             </div>
           </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <nav className="w-full md:w-64 flex-shrink-0">
           <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 space-y-1 sticky top-24 transition-colors duration-200">
             {tabs.map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                   activeTab === tab.id
                     ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                     : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
                 }`}
               >
                 <span className="text-lg">{tab.icon}</span>
                 {tab.label}
               </button>
             ))}
           </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 min-h-[500px] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-colors duration-200">
           {renderContent()}
        </div>
      </div>
    </div>
  );
};
