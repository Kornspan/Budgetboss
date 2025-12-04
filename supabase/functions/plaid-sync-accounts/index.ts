import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { AccountBase } from 'npm:plaid';
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

const mapAccountType = (account: AccountBase): string => {
  const subtype = account.subtype ?? '';
  switch (account.type) {
    case 'depository':
      if (subtype === 'checking') return 'checking';
      if (subtype === 'savings' || subtype === 'money market') return 'savings';
      return 'other';
    case 'credit':
      return 'credit';
    case 'investment':
    case 'brokerage':
      return 'investment';
    default:
      return 'other';
  }
};

const toCents = (value?: number | null) => Math.round((value ?? 0) * 100);

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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: plaidItems, error: itemsError } = await supabase
      .from('plaid_items')
      .select('id, access_token, institution_name')
      .eq('user_id', body.userId);

    if (itemsError) {
      throw itemsError;
    }

    if (!plaidItems || plaidItems.length === 0) {
      return new Response(JSON.stringify({ importedAccounts: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const accountRows: Record<string, unknown>[] = [];
    const syncTime = new Date().toISOString();

    for (const item of plaidItems) {
      const response = await plaidClient.accountsBalanceGet({
        access_token: item.access_token,
      });

      for (const account of response.data.accounts) {
        const balance = account.balances.available ?? account.balances.current ?? 0;
        accountRows.push({
          id: `plaid_${account.account_id}`,
          user_id: body.userId,
          name: account.name ?? account.official_name ?? account.subtype ?? 'Plaid Account',
          type: mapAccountType(account),
          provider: 'plaid',
          external_account_id: account.account_id,
          institution_name: item.institution_name ?? null,
          current_balance_cents: toCents(balance),
          is_closed: false,
          updated_at: syncTime,
        });
      }
    }

    if (accountRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('accounts')
        .upsert(accountRows, { onConflict: 'id' });

      if (upsertError) {
        throw upsertError;
      }
    }

    const itemIds = plaidItems.map((item) => item.id);
    if (itemIds.length > 0) {
      const { error: updateError } = await supabase
        .from('plaid_items')
        .update({
          accounts_last_synced_at: syncTime,
          updated_at: syncTime,
        })
        .in('id', itemIds);

      if (updateError) {
        throw updateError;
      }
    }

    return new Response(JSON.stringify({
      importedAccounts: accountRows.length,
      accountsLastSyncedAt: syncTime,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    if (Deno.env.get('PLAID_ENV') === 'sandbox') {
      console.error('[plaid-sync-accounts] error', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to sync accounts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
