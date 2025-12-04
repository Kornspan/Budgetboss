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
    if (!body || typeof body.userId !== 'string' || typeof body.plaidItemId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('id, access_token')
      .eq('user_id', body.userId)
      .eq('id', body.plaidItemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!plaidItem) {
      return new Response(JSON.stringify({ error: 'Plaid item not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const plaidAccounts = await plaidClient.accountsBalanceGet({
      access_token: plaidItem.access_token,
    });
    const externalAccountIds = plaidAccounts.data.accounts.map((acc) => acc.account_id);

    const { data, error: disconnectError } = await supabase.rpc('disconnect_plaid_item', {
      p_user_id: body.userId,
      p_plaid_item_id: body.plaidItemId,
      p_account_external_ids: externalAccountIds,
    });

    if (disconnectError) throw disconnectError;

    const result = Array.isArray(data) ? data[0] : data;
    return new Response(JSON.stringify({
      deletedAccounts: result?.deleted_accounts ?? 0,
      deletedTransactions: result?.deleted_transactions ?? 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    if (Deno.env.get('PLAID_ENV') === 'sandbox') {
      console.error('[plaid-disconnect-item] error', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to disconnect Plaid item' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
