// supabase/functions/ai-suggest-category/index.ts

// deno-lint-ignore-file no-explicit-any
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
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

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return jsonResponse({ error: "Invalid JSON body", details: String(err) }, 400);
  }

  console.log("[ai-suggest-category] received payload:", body);

  // JUST ECHO BACK WHAT WE GOT
  return jsonResponse({ received: body });
});
