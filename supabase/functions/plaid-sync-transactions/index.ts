import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { plaidClient } from '../_shared/plaidClient.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing for the Edge Function.');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const formatDate = (date: Date) => date.toISOString().split('T')[0];

async function fetchTransactionsForItem(accessToken: string, startDate: string, endDate: string) {
  const transactions: any[] = [];
  let offset = 0;
  const count = 100;

  while (true) {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { offset, count },
    });

    transactions.push(...response.data.transactions);
    offset += response.data.transactions.length;
    if (transactions.length >= response.data.total_transactions) {
      break;
    }
  }

  return transactions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.userId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const daysBack = typeof body.daysBack === 'number' && body.daysBack > 0 ? body.daysBack : 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const [{ data: plaidItems, error: itemsError }, { data: accounts, error: accountsError }] =
      await Promise.all([
        supabase
          .from('plaid_items')
          .select('id, access_token')
          .eq('user_id', body.userId),
        supabase
          .from('accounts')
          .select('id, external_account_id')
          .eq('user_id', body.userId),
      ]);

    if (itemsError) throw itemsError;
    if (accountsError) throw accountsError;

    if (!plaidItems || plaidItems.length === 0) {
      return new Response(JSON.stringify({ importedTransactions: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const accountMap = new Map<string, string>();
    accounts?.forEach((acc) => {
      if (acc.external_account_id) accountMap.set(acc.external_account_id, acc.id);
    });

    const allRows: any[] = [];
    const syncTime = new Date().toISOString();

    for (const item of plaidItems ?? []) {
      const transactions = await fetchTransactionsForItem(
        item.access_token,
        formatDate(startDate),
        formatDate(endDate),
      );

      for (const txn of transactions) {
        const accountId = accountMap.get(txn.account_id);
        if (!accountId) continue;

        const baseAmount = Math.round(Math.abs(txn.amount) * 100);
        const amountCents = txn.transaction_type === 'credit' ? baseAmount : -baseAmount;

        allRows.push({
          id: `plaid_tx_${txn.transaction_id}`,
          user_id: body.userId,
          account_id: accountId,
          category_id: null,
          name: txn.name ?? txn.merchant_name ?? 'Plaid Transaction',
          amount_cents: amountCents,
          transaction_date: txn.date,
          source: 'imported',
          status: 'posted',
          external_transaction_id: txn.transaction_id,
          imported_at: syncTime,
          notes: txn.pending ? 'Pending from Plaid' : null,
        });
      }
    }

    if (allRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('transactions')
        .upsert(allRows, { onConflict: 'user_id,external_transaction_id' });

      if (upsertError) throw upsertError;
    }

    const itemIds = plaidItems.map((item) => item.id);
    if (itemIds.length > 0) {
      const { error: updateError } = await supabase
        .from('plaid_items')
        .update({
          transactions_last_synced_at: syncTime,
          updated_at: syncTime,
        })
        .in('id', itemIds);

      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({
      importedTransactions: allRows.length,
      transactionsLastSyncedAt: syncTime,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    if (Deno.env.get('PLAID_ENV') === 'sandbox') {
      console.error('[plaid-sync-transactions] error', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to sync transactions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
