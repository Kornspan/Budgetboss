import { supabase } from './supabaseClient';

export type PlaidSyncMode = 'accounts' | 'transactions' | 'all';

export interface PlaidSyncResult {
  accounts?: {
    imported: number;
    lastSyncedAt: string | null;
  };
  transactions?: {
    imported: number;
    lastSyncedAt: string | null;
  };
}

export async function syncPlaidData({
  userId,
  mode = 'all',
}: {
  userId: string;
  mode?: PlaidSyncMode;
}): Promise<PlaidSyncResult> {
  const result: PlaidSyncResult = {};
  const shouldSyncAccounts = mode === 'all' || mode === 'accounts';
  const shouldSyncTransactions = mode === 'all' || mode === 'transactions';

  if (shouldSyncAccounts) {
    const { data, error } = await supabase.functions.invoke('plaid-sync-accounts', {
      body: { userId },
    });
    if (error) throw error;
    result.accounts = {
      imported: data?.importedAccounts ?? 0,
      lastSyncedAt: data?.accountsLastSyncedAt ?? null,
    };
  }

  if (shouldSyncTransactions) {
    const { data, error } = await supabase.functions.invoke('plaid-sync-transactions', {
      body: { userId },
    });
    if (error) throw error;
    result.transactions = {
      imported: data?.importedTransactions ?? 0,
      lastSyncedAt: data?.transactionsLastSyncedAt ?? null,
    };
  }

  return result;
}
