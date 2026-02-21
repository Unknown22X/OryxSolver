import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
serve(async (req) => {
  // Handle CORS for browser extension requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { question } = await req.json();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });
    }
    // 1. Verify User (Clerk) and check limits
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    // In a real production app, you would use the Clerk Backend SDK here to verify the JWT.
    // For this example, we'll assume the Clerk ID is passed in the header or payload securely.
    // Let's assume you've verified them and have their userId.
    const userId = "placeholder_user_id"; // Replace with actual verified Clerk ID
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, questions_asked_today')
        .eq('id', userId)
        .single();
    if (profile?.subscription_tier === 'free' && profile.questions_asked_today >= 5) {
      return new Response(JSON.stringify({ error: 'Daily limit reached. Please upgrade.' }), { status: 403, headers: corsHeaders });
    }
    // 2. Vector Caching
    // First, we need to convert the text question into an embedding.
    // Google provides a text-embedding model you can call.
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    // Get Embedding (Simplified fetch)
    const embedRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: question }] }
      })
    });

    const embedData = await embedRes.json();
    const embedding = embedData.embedding.values; // Array of 768 floats
    // Check Supabase for similar vectors using a remote procedure call (RPC)
    // We will write the SQL for `match_questions` shortly.
    const { data: cachedDocs } = await supabase.rpc('match_questions', {
      query_embedding: embedding,
      match_threshold: 0.95, // 95% similar or higher
      match_count: 1
    });
    if (cachedDocs && cachedDocs.length > 0) {
      console.log("Cache hit!");

      // Update hit count asynchronously (fire and forget)
      supabase.rpc('update_cache_hit', { cache_id: cachedDocs[0].id }).then();

      return new Response(JSON.stringify({ answer: cachedDocs[0].answer, cached: true }), { headers: corsHeaders });
    }
    // 3. No cache found. Call Gemini Flash-Lite.
    console.log("Cache miss. Calling Gemini...");
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Solve this step-by-step: ${question}` }] }]
      })
    });
    const aiData = await aiRes.json();
    const answer = aiData.candidates[0].content.parts[0].text;
    // 4. Save to Cache and Update User Limits
    await supabase.from('questions_cache').insert({
      question_text: question,
      embedding: embedding,
      answer: answer
    });
    await supabase.rpc('increment_questions_asked', { target_user_id: userId });
    // Return the fresh answer
    return new Response(JSON.stringify({ answer: answer, cached: false }), { headers: corsHeaders });
  } catch (error) {
    console.error("AI Proxy Error:", error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: corsHeaders });
  }
});


// // Follow this setup guide to integrate the Deno language server with your editor:
// // https://deno.land/manual/getting_started/setup_your_environment
// // This enables autocomplete, go to definition, etc.
//
// // Setup type definitions for built-in Supabase Runtime APIs
// import "@supabase/functions-js/edge-runtime.d.ts"
//
// console.log("Hello from Functions!")
//
// Deno.serve(async (req) => {
//   const { name } = await req.json()
//   const data = {
//     message: `Hello ${name}!`,
//   }
//
//   return new Response(
//     JSON.stringify(data),
//     { headers: { "Content-Type": "application/json" } },
//   )
// })
//
// /* To invoke locally:
//
//   1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
//   2. Make an HTTP request:
//
//   curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/ai-proxy' \
//     --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//     --header 'Content-Type: application/json' \
//     --data '{"name":"Functions"}'
//
// */
