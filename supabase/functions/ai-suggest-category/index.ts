import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenAI, Type } from 'npm:@google/genai';

const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY for ai-suggest-category function.');
}

const ai = new GoogleGenAI({ apiKey });

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
    if (
      !body ||
      typeof body.payee !== 'string' ||
      typeof body.amountCents !== 'number' ||
      !Array.isArray(body.categoryNames)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const model = ai.getGenerativeModel({
      model: 'gemini-2.0-flash-lite-preview-02-05',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryName: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ['categoryName', 'reason'],
        },
      },
    });

    const prompt = `
Suggest the single best category for this transaction.
Payee: "${body.payee}"
Amount (USD cents): ${body.amountCents}

Available Categories: ${body.categoryNames.join(', ')}

Return JSON with:
- categoryName: Must be exactly one of the available categories, or "Uncategorized" if no fit.
- reason: A short (5-10 words) explanation.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text?.();
    const suggestion = text ? JSON.parse(text) : null;

    return new Response(JSON.stringify({ suggestion }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    if (Deno.env.get('PLAID_ENV') === 'sandbox') {
      console.error('[ai-suggest-category] error', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to suggest category' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
