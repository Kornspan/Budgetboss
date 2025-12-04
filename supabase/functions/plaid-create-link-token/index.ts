import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createLinkToken } from '../_shared/plaidClient.ts';

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
    if (!body || typeof body.userId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const linkToken = await createLinkToken(body.userId);
    return new Response(JSON.stringify({ link_token: linkToken }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    if (Deno.env.get('PLAID_ENV') === 'sandbox') {
      console.error('[plaid-create-link-token] error', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to create link token' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
