
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FinanceState, ThemePreference, AiPersonality } from '../types';
import { useAuth } from '../auth/AuthContext';
import { usePlaidLink } from 'react-plaid-link';
import { supabase } from '../lib/supabaseClient';
import { syncPlaidData } from '../lib/plaidSyncClient';

interface PlaidItemInfo {
  id: string;
  itemId: string;
  institutionName: string | null;
  accountsLastSyncedAt: string | null;
  transactionsLastSyncedAt: string | null;
}

const formatRelativeTime = (iso?: string | null) => {
  if (!iso) return 'Never synced';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never synced';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Just now';
  if (diffMs < 60 * 1000) return 'Just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const getLatestTimestamp = (items: PlaidItemInfo[], field: 'accountsLastSyncedAt' | 'transactionsLastSyncedAt') => {
  return items.reduce<string | null>((latest, item) => {
    const value = item[field];
    if (!value) return latest;
    if (!latest || value > latest) {
      return value;
    }
    return latest;
  }, null);
};

type SettingsTab = 'profile' | 'data' | 'app';

interface SettingsViewProps {
  state: FinanceState;
  onUpdateProfile: (input: { displayName?: string; email?: string }) => void;
  onUpdateAppPreferences: (input: { themePreference?: ThemePreference; notificationsEnabled?: boolean }) => void;
  onUpdateAiSettings: (input: { personality?: AiPersonality; searchGroundingEnabled?: boolean }) => void;
  onExportData: () => void;
  onResetData: () => void;
  onLoadFromSupabaseForUser: (userId: string) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateProfile,
  onUpdateAppPreferences,
  onUpdateAiSettings,
  onExportData,
  onResetData,
  onLoadFromSupabaseForUser
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isLoadingSupabase, setIsLoadingSupabase] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [showTwoFactorNote, setShowTwoFactorNote] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isConnectingPlaid, setIsConnectingPlaid] = useState(false);
  const [plaidError, setPlaidError] = useState<string | null>(null);
  const [plaidSuccess, setPlaidSuccess] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isSyncingPlaidAccounts, setIsSyncingPlaidAccounts] = useState(false);
  const [plaidSyncError, setPlaidSyncError] = useState<string | null>(null);
  const [plaidSyncSuccess, setPlaidSyncSuccess] = useState<string | null>(null);
  const [isSyncingPlaidTransactions, setIsSyncingPlaidTransactions] = useState(false);
  const [plaidTransactionsError, setPlaidTransactionsError] = useState<string | null>(null);
  const [plaidTransactionsSuccess, setPlaidTransactionsSuccess] = useState<string | null>(null);
  const [isSyncingPlaidAll, setIsSyncingPlaidAll] = useState(false);
  const [plaidAllError, setPlaidAllError] = useState<string | null>(null);
  const [plaidAllSuccess, setPlaidAllSuccess] = useState<string | null>(null);
  const [plaidItems, setPlaidItems] = useState<PlaidItemInfo[]>([]);
  const [plaidItemsError, setPlaidItemsError] = useState<string | null>(null);
  const [isLoadingPlaidItems, setIsLoadingPlaidItems] = useState(false);
  const [disconnectingItemId, setDisconnectingItemId] = useState<string | null>(null);
  const [plaidDisconnectError, setPlaidDisconnectError] = useState<string | null>(null);
  const [plaidDisconnectSuccess, setPlaidDisconnectSuccess] = useState<string | null>(null);
  const { appSettings, accounts } = state;
  const { user, userId, updatePassword } = useAuth();
  const canChangePassword = Boolean(user);
  const plaidAccounts = accounts.filter(acc => acc.provider === 'plaid');
  const hasPlaidAccounts = plaidAccounts.length > 0;
  const accountsLastSyncedAt = useMemo(() => getLatestTimestamp(plaidItems, 'accountsLastSyncedAt'), [plaidItems]);
  const transactionsLastSyncedAt = useMemo(() => getLatestTimestamp(plaidItems, 'transactionsLastSyncedAt'), [plaidItems]);
  const isAnyPlaidSyncing = isSyncingPlaidAccounts || isSyncingPlaidTransactions || isSyncingPlaidAll;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile & Security', icon: '👤' },
    { id: 'data', label: 'Data & Connections', icon: '🔗' },
    { id: 'app', label: 'App & AI', icon: '🤖' },
  ];

  const loadPlaidItems = useCallback(async () => {
    if (!userId) {
      setPlaidItems([]);
      setPlaidItemsError(null);
      return;
    }

    setIsLoadingPlaidItems(true);
    setPlaidItemsError(null);
    try {
      const { data, error } = await supabase
        .from('plaid_items')
        .select('id, item_id, institution_name, accounts_last_synced_at, transactions_last_synced_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const normalized: PlaidItemInfo[] = (data ?? []).map((item: any) => ({
        id: item.id,
        itemId: item.item_id,
        institutionName: item.institution_name,
        accountsLastSyncedAt: item.accounts_last_synced_at,
        transactionsLastSyncedAt: item.transactions_last_synced_at,
      }));

      setPlaidItems(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Plaid connections.';
      setPlaidItemsError(message);
    } finally {
      setIsLoadingPlaidItems(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPlaidItems();
  }, [loadPlaidItems]);

  const handleReset = () => {
    if (window.confirm("Are you sure? This will delete all your data locally and refresh the page.")) {
      onResetData();
    }
  };

  const handleLoadFromSupabase = async () => {
    if (!userId) {
      setSupabaseError('Sign in to load data from Supabase.');
      return;
    }
    setIsLoadingSupabase(true);
    setSupabaseError(null);
    try {
      await onLoadFromSupabaseForUser(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data from Supabase.';
      setSupabaseError(message);
    } finally {
      setIsLoadingSupabase(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!user) {
      setPasswordError('Sign in to update your password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await updatePassword(newPassword);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password.';
      setPasswordError(message);
      setPasswordLoading(false);
      return;
    }
    setPasswordLoading(false);

    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordForm(false);
    setPasswordSuccess('Password updated successfully.');
  };

  const startPlaidLink = async () => {
    if (!userId) return;
    setPlaidError(null);
    setPlaidSuccess(null);
    setIsConnectingPlaid(true);
    try {
      const { data, error } = await supabase.functions.invoke('plaid-create-link-token', {
        body: { userId },
      });
      if (error) throw error;
      const token = data?.link_token;
      if (!token) throw new Error('Missing link token.');
      setLinkToken(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start Plaid Link.';
      setPlaidError(message);
      setIsConnectingPlaid(false);
    }
  };

  const handlePlaidSuccess = async (publicToken: string, institutionName?: string | null) => {
    if (!userId) return;
    try {
      const { error } = await supabase.functions.invoke('plaid-exchange-public-token', {
        body: {
          userId,
          publicToken,
          institutionName: institutionName ?? null,
        },
      });
      if (error) throw error;
      setPlaidSuccess('Bank connected successfully.');
      await loadPlaidItems();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save Plaid item.';
      setPlaidError(message);
    } finally {
      setIsConnectingPlaid(false);
      setLinkToken(null);
    }
  };

  const handlePlaidExit = () => {
    setIsConnectingPlaid(false);
    setLinkToken(null);
  };

  const handlePlaidAccountsSync = async () => {
    if (!userId) return;
    setPlaidSyncError(null);
    setPlaidSyncSuccess(null);
    setIsSyncingPlaidAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke('plaid-sync-accounts', {
        body: { userId },
      });
      if (error) throw error;
      const imported = data?.importedAccounts ?? 0;
      await onLoadFromSupabaseForUser(userId);
       await loadPlaidItems();
      const summary =
        imported > 0
          ? `Synced ${imported} account${imported === 1 ? '' : 's'}.`
          : 'No new accounts to sync.';
      const timeHint = data?.accountsLastSyncedAt ? ` (updated ${formatRelativeTime(data.accountsLastSyncedAt)})` : '';
      setPlaidSyncSuccess(`${summary}${timeHint}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync Plaid accounts.';
      setPlaidSyncError(message);
    } finally {
      setIsSyncingPlaidAccounts(false);
    }
  };

  const handlePlaidTransactionsSync = async () => {
    if (!userId) return;
    setPlaidTransactionsError(null);
    setPlaidTransactionsSuccess(null);
    setIsSyncingPlaidTransactions(true);
    try {
      const { data, error } = await supabase.functions.invoke('plaid-sync-transactions', {
        body: { userId },
      });
      if (error) throw error;
      const imported = data?.importedTransactions ?? 0;
      await onLoadFromSupabaseForUser(userId);
      await loadPlaidItems();
      const summary =
        imported > 0
          ? `Synced ${imported} transaction${imported === 1 ? '' : 's'}.`
          : 'No new transactions to sync.';
      const timeHint = data?.transactionsLastSyncedAt
        ? ` (updated ${formatRelativeTime(data.transactionsLastSyncedAt)})`
        : '';
      setPlaidTransactionsSuccess(`${summary}${timeHint}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync Plaid transactions.';
      setPlaidTransactionsError(message);
    } finally {
      setIsSyncingPlaidTransactions(false);
    }
  };

  const handlePlaidAllSync = async () => {
    if (!userId) return;
    setPlaidAllError(null);
    setPlaidAllSuccess(null);
    setIsSyncingPlaidAll(true);
    try {
      const result = await syncPlaidData({ userId, mode: 'all' });
      await onLoadFromSupabaseForUser(userId);
      await loadPlaidItems();
      const timestamp = result.transactions?.lastSyncedAt ?? result.accounts?.lastSyncedAt ?? null;
      const summary = timestamp
        ? `Synced accounts & transactions (${formatRelativeTime(timestamp)}).`
        : 'Synced accounts & transactions.';
      setPlaidAllSuccess(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync all Plaid data.';
      setPlaidAllError(message);
    } finally {
      setIsSyncingPlaidAll(false);
    }
  };

  const handleDisconnectPlaidItem = async (plaidItemId: string, label: string | null) => {
    if (!userId) return;
    if (
      !window.confirm(
        `Disconnect ${label ?? 'this institution'}? This will remove its linked accounts and transactions.`,
      )
    ) {
      return;
    }

    setPlaidDisconnectError(null);
    setPlaidDisconnectSuccess(null);
    setDisconnectingItemId(plaidItemId);
    try {
      const { data, error } = await supabase.functions.invoke('plaid-disconnect-item', {
        body: { userId, plaidItemId },
      });
      if (error) throw error;
      await onLoadFromSupabaseForUser(userId);
      await loadPlaidItems();
      const removedAccounts = data?.deletedAccounts ?? 0;
      setPlaidDisconnectSuccess(
        `Disconnected ${label ?? 'institution'} (${removedAccounts} account${removedAccounts === 1 ? '' : 's'} removed).`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect Plaid institution.';
      setPlaidDisconnectError(message);
    } finally {
      setDisconnectingItemId(null);
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
                <button
                  type="button"
                  onClick={() => setShowTwoFactorNote(true)}
                  className="w-10 h-5 bg-slate-300 dark:bg-slate-600 rounded-full relative text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full"></span>
                </button>
              </div>
              {showTwoFactorNote && (
                <p className="text-xs text-slate-500 dark:text-slate-400 pl-1">
                  Two-factor authentication is not available yet.
                </p>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700">
                 <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">Change Password</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Update your login credentials.</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (!canChangePassword) return;
                      setShowPasswordForm((prev) => !prev);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    disabled={!canChangePassword}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                  >
                    {showPasswordForm ? 'Close' : 'Update'}
                  </button>
                </div>
                {!canChangePassword && (
                  <p className="text-xs text-slate-500 mt-2">Sign in to change your password.</p>
                )}
                {showPasswordForm && canChangePassword && (
                  <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                    {passwordSuccess && <p className="text-xs text-green-600">{passwordSuccess}</p>}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordError(null);
                          setPasswordSuccess(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg disabled:opacity-60"
                      >
                        {passwordLoading ? 'Updating…' : 'Save Password'}
                      </button>
                    </div>
                  </form>
                )}
                {passwordSuccess && !showPasswordForm && (
                  <p className="text-xs text-green-600 mt-2">{passwordSuccess}</p>
                )}
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
                <div className="space-y-3 max-w-xl">
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row gap-2 sm:items-center">
                    <span>Accounts last synced: {formatRelativeTime(accountsLastSyncedAt)}</span>
                    <span>Transactions last synced: {formatRelativeTime(transactionsLastSyncedAt)}</span>
                  </div>
                  {isLoadingPlaidItems && <p className="text-xs text-slate-500">Loading Plaid connections…</p>}
                  {plaidItemsError && <p className="text-xs text-red-500">{plaidItemsError}</p>}
                  {plaidItems.length > 0 && (
                    <div className="space-y-2">
                      {plaidItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-white">
                              {item.institutionName ?? 'Plaid connection'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Accounts: {formatRelativeTime(item.accountsLastSyncedAt)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Transactions: {formatRelativeTime(item.transactionsLastSyncedAt)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDisconnectPlaidItem(item.id, item.institutionName)}
                            disabled={!userId || disconnectingItemId === item.id}
                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
                          >
                            {disconnectingItemId === item.id ? 'Disconnecting…' : 'Disconnect'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {plaidDisconnectError && <p className="text-xs text-red-500">{plaidDisconnectError}</p>}
                  {plaidDisconnectSuccess && <p className="text-xs text-green-600">{plaidDisconnectSuccess}</p>}
                  <div className="space-y-2">
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
                </div>
                <div className="mt-4 space-y-3">
                  <button
                    onClick={startPlaidLink}
                    disabled={!userId || isConnectingPlaid}
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left disabled:opacity-60"
                  >
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                        {isConnectingPlaid
                          ? 'Connecting to Plaid…'
                          : hasPlaidAccounts
                            ? 'Connect another bank'
                            : 'Connect Bank (Plaid)'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {hasPlaidAccounts
                          ? 'Plaid connection active. Connect another institution or re-link if needed.'
                          : 'Securely connect a bank via Plaid Link.'}
                      </p>
                    </div>
                    <span className="text-xl">🏦</span>
                  </button>
                  {hasPlaidAccounts && (
                    <p className="text-xs text-slate-500">
                      {plaidAccounts.length} account{plaidAccounts.length === 1 ? '' : 's'} linked via Plaid.
                    </p>
                  )}
                  <button
                    onClick={handlePlaidAccountsSync}
                    disabled={!userId || isSyncingPlaidAccounts}
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left disabled:opacity-60"
                  >
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                        {isSyncingPlaidAccounts ? 'Syncing accounts…' : 'Sync Plaid accounts'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Import linked balances into Budgetboss.
                      </p>
                    </div>
                    <span className="text-xl">🔄</span>
                  </button>
                  <button
                    onClick={handlePlaidTransactionsSync}
                    disabled={!userId || isSyncingPlaidTransactions}
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left disabled:opacity-60"
                  >
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                        {isSyncingPlaidTransactions ? 'Syncing transactions…' : 'Sync Plaid transactions'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Import recent activity from linked Plaid accounts.
                      </p>
                    </div>
                    <span className="text-xl">📄</span>
                  </button>
                  <button
                    onClick={handlePlaidAllSync}
                    disabled={!userId || isAnyPlaidSyncing}
                    className="w-full flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors text-left disabled:opacity-60"
                  >
                    <div>
                      <p className="font-medium text-indigo-700 dark:text-indigo-200 text-sm">
                        {isSyncingPlaidAll ? 'Syncing all Plaid data…' : 'Sync all Plaid data'}
                      </p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-300">
                        Refresh accounts and transactions in one step.
                      </p>
                    </div>
                    <span className="text-xl">⚡</span>
                  </button>
                  {!userId && (
                    <p className="text-xs text-slate-500">Sign in to connect or sync a bank.</p>
                  )}
                  {plaidError && <p className="text-xs text-red-500">{plaidError}</p>}
                  {plaidSuccess && <p className="text-xs text-green-600">{plaidSuccess}</p>}
                  {plaidSyncError && <p className="text-xs text-red-500">{plaidSyncError}</p>}
                  {plaidSyncSuccess && <p className="text-xs text-green-600">{plaidSyncSuccess}</p>}
                  {plaidTransactionsError && <p className="text-xs text-red-500">{plaidTransactionsError}</p>}
                  {plaidTransactionsSuccess && <p className="text-xs text-green-600">{plaidTransactionsSuccess}</p>}
                  {plaidAllError && <p className="text-xs text-red-500">{plaidAllError}</p>}
                  {plaidAllSuccess && <p className="text-xs text-green-600">{plaidAllSuccess}</p>}
                </div>
                <button disabled className="mt-3 text-sm text-indigo-400 font-medium cursor-not-allowed flex items-center gap-1 opacity-70">
                    + Add New Connection (Coming Soon)
                </button>
             </div>

             <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2 pt-4">Data Management</h3>
             <div className="max-w-xl space-y-4">
                 <button 
                   onClick={handleLoadFromSupabase}
                   disabled={isLoadingSupabase || !userId}
                   className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left disabled:opacity-60"
                 >
                     <div>
                         <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                           {isLoadingSupabase ? 'Loading from Supabase…' : 'Load Data from Supabase'}
                         </p>
                         <p className="text-xs text-slate-500">Overwrite local data with the latest snapshot.</p>
                     </div>
                     <span className="text-xl">☁️</span>
                 </button>
                 {!userId && (
                   <p className="text-xs text-slate-500">Sign in to connect with your Supabase workspace.</p>
                 )}
                 {supabaseError && (
                   <p className="text-sm text-red-500">{supabaseError}</p>
                 )}

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
        {linkToken && userId && (
          <PlaidLinkLauncher
            token={linkToken}
            onSuccess={(publicToken, metadata) =>
              handlePlaidSuccess(publicToken, metadata?.institution?.name ?? null)
            }
            onExit={handlePlaidExit}
          />
        )}
      </div>
    </div>
  );
};

interface PlaidLinkLauncherProps {
  token: string;
  onSuccess: (publicToken: string, metadata: any) => void;
  onExit: () => void;
}

const PlaidLinkLauncher: React.FC<PlaidLinkLauncherProps> = ({ token, onSuccess, onExit }) => {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit,
  });

  useEffect(() => {
    if (ready) {
      open();
    }
  }, [ready, open]);

  return null;
};
