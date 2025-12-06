import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenAI } from 'npm:@google/genai';

const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY for ai-chat function.');
}

const ai = new GoogleGenAI({ apiKey });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Mode = 'chat' | 'fireCoach';

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
    const mode: Mode = body?.mode === 'fireCoach' ? 'fireCoach' : 'chat';

    if (!body || typeof body.message !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const model = ai.getGenerativeModel({
      model: mode === 'fireCoach' ? 'gemini-1.5-pro' : 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.6,
      },
    });

    let prompt = body.message;

    if (mode === 'chat') {
      const contextData = typeof body.contextData === 'string' ? body.contextData : '';
      const personality = body.options?.personality ?? 'friendly';
      const displayName = body.options?.displayName ?? 'the user';
      const tone =
        personality === 'direct'
          ? 'Be brief and data-focused.'
          : personality === 'playful'
            ? 'Be encouraging and use a light, playful tone.'
            : 'Be concise, friendly, and clear.';

      prompt = `
You are an AI Financial Coach for ${displayName}.
${tone}

User data (JSON):
${contextData}

User message:
${body.message}
`;
    }

    if (mode === 'fireCoach') {
      const cfg = body.config;
      const goals = Array.isArray(body.goals) ? body.goals : [];
      prompt = `
You are a FIRE (Financial Independence, Retire Early) expert.
${body.options?.personality === 'direct' ? 'Be direct and data-focused.' : 'Be encouraging and practical.'}

User Financial Profile:
- Portfolio Value: $${((cfg?.currentPortfolioCents ?? 0) / 100).toFixed(2)}
- Monthly Contribution: $${((cfg?.monthlyContributionCents ?? 0) / 100).toFixed(2)}
- Expected Real Return: ${cfg?.expectedRealReturnPercent ?? 0}%
- Annual Spend Target: $${((cfg?.annualSpendCents ?? 0) / 100).toFixed(2)}
- Safe Withdrawal Rate: ${cfg?.safeWithdrawalRatePercent ?? 4}%

Active Goals:
${goals.map((g: any) => `- ${g.name}: $${((g.currentCents ?? 0) / 100).toFixed(2)} of $${((g.targetCents ?? 0) / 100).toFixed(2)}`).join('\n')}

User Question: "${body.question ?? body.message}"

Please answer in 2-4 short paragraphs (max 200 words).
Provide at least 1 concrete recommendation.
`;
    }

    const response = await model.generateContent(prompt);
    const text = response.response.text?.() ?? '';

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    if (Deno.env.get('PLAID_ENV') === 'sandbox') {
      console.error('[ai-chat] error', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to process AI request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
