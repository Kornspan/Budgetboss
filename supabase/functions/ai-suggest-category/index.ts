// supabase/functions/ai-suggest-category/index.ts

import "jsr:@supabase/functions-js/edge-runtime@2";

// Shut TypeScript up locally; Supabase Edge provides the real Deno at runtime.
declare const Deno: any;

const MODEL_NAME = "gemini-1.5-flash";

interface Category {
  id: string;
  name: string;
}

interface AiSuggestCategoryRequest {
  transaction: any;
  categories: Category[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno?.env?.get?.("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[ai-suggest-category] Missing GEMINI_API_KEY");
    return jsonResponse(
      { error: "GEMINI_API_KEY is not set in Edge Function secrets" },
      500,
    );
  }

  let payload: AiSuggestCategoryRequest;
  try {
    payload = (await req.json()) as AiSuggestCategoryRequest;
  } catch (err) {
    console.error("[ai-suggest-category] Invalid JSON body", err);
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { transaction, categories } = payload || {};
  if (!transaction || !Array.isArray(categories) || categories.length === 0) {
    return jsonResponse(
      { error: "Body must include transaction and non-empty categories array" },
      400,
    );
  }

  const txSummary = {
    payee:
      transaction.payee ??
      transaction.name ??
      transaction.description ??
      transaction.merchant ??
      "",
    amount:
      transaction.amount ??
      (typeof transaction.amount_cents === "number"
        ? transaction.amount_cents / 100
        : undefined),
    date: transaction.transaction_date ?? transaction.date ?? null,
  };

  const catSummary = categories.map((c) => ({ id: c.id, name: c.name }));

  const prompt = `
You are an assistant that assigns personal finance categories.

Pick the SINGLE best category id from the provided list for this transaction.
Return ONLY a JSON object, no markdown, no extra text, with this exact shape:

{
  "suggestedCategoryId": "<id from categories>",
  "suggestedCategoryName": "<name from categories>",
  "reason": "<short explanation>"
}

Transaction (JSON):
${JSON.stringify(txSummary)}

Available categories (JSON):
${JSON.stringify(catSummary)}
`.trim();

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[ai-suggest-category] Gemini error", resp.status, text);
    return jsonResponse(
      { error: "Gemini API error", status: resp.status, details: text },
      500,
    );
  }

  const data = (await resp.json()) as any;
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  if (!text) {
    console.error("[ai-suggest-category] No text from Gemini", data);
    return jsonResponse({ error: "No content from Gemini" }, 500);
  }

  let parsed:
    | {
        suggestedCategoryId?: string;
        suggestedCategoryName?: string;
        reason?: string;
      }
    | undefined;

  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.warn(
      "[ai-suggest-category] Gemini returned non-JSON, returning raw text",
      text,
    );
    return jsonResponse({
      suggestedCategoryId: null,
      suggestedCategoryName: null,
      reason: text,
      raw: text,
    });
  }

  return jsonResponse({
    suggestedCategoryId: parsed?.suggestedCategoryId ?? null,
    suggestedCategoryName: parsed?.suggestedCategoryName ?? null,
    reason: parsed?.reason ?? "",
    raw: text,
  });
});
