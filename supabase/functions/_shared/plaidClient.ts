import { Configuration, PlaidApi, PlaidEnvironments } from 'npm:plaid';

const clientId = Deno.env.get('PLAID_CLIENT_ID');
const secret = Deno.env.get('PLAID_SECRET');
const envName = Deno.env.get('PLAID_ENV') ?? 'sandbox';

if (!clientId || !secret) {
  throw new Error('Missing PLAID_CLIENT_ID or PLAID_SECRET environment variables.');
}

const plaidEnv = PlaidEnvironments[envName as keyof typeof PlaidEnvironments];
if (!plaidEnv) {
  throw new Error(`Unsupported PLAID_ENV "${envName}".`);
}

const configuration = new Configuration({
  basePath: plaidEnv,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': clientId,
      'PLAID-SECRET': secret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export async function createLinkToken(userId: string): Promise<string> {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'FinanceApp',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
  });
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string }> {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}
