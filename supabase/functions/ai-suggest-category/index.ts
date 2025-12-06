// @ts-nocheck
// supabase/functions/ai-suggest-category/index.ts

// deno-lint-ignore-file no-explicit-any

const MODEL_NAME = "gemini-1.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ---- Parse body, accept a couple of shapes defensively ----
  let raw: any;
  try {
    raw = await req.json();
  } catch (err) {
    return jsonResponse(
      { error: "Invalid JSON body", details: String(err) },
      400,
    );
  }

  // Allow for { transaction, categories } OR { payload: { transaction, categories } }
  // OR { received: { ... } } from your temporary debug function.
  let payload: any = raw?.payload ?? raw?.received ?? raw ?? {};
  let transaction = payload.transaction;
  let categories = payload.categories;

  // If categories came as an object map, normalize to array
  if (!Array.isArray(categories) && categories && typeof categories === "object") {
    categories = Object.values(categories);
  }

  if (!transaction || !Array.isArray(categories) || categories.length === 0) {
    console.error("[ai-suggest-category] Bad payload", payload);
    return jsonResponse(
      { error: "Body must include transaction and non-empty categories array" },
      400,
    );
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[ai-suggest-category] Missing GEMINI_API_KEY");
    return jsonResponse(
      { error: "GEMINI_API_KEY is not set in Edge Function secrets" },
      500,
    );
  }

  // ---- Build a compact summary for Gemini ----
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

  const catSummary = categories.map((c: Category) => ({
    id: c.id,
    name: c.name,
  }));

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

  const geminiBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
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
  } catch (_err) {
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
