import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch helper with timeout to avoid hanging connections
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// Fetch helper with retry and exponential backoff for rate limiting and network errors
async function fetchWithRetry(
  url: string,
  options: any = {},
  timeoutMs = 15000,
  maxRetries = 3,
  delayMs = 2000
) {
  let res;
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.status === 429) {
        const jitter = Math.random() * 1000;
        const sleepTime = delayMs + jitter;
        console.warn(`Rate limit (429) hit on ${url}. Retrying in ${Math.round(sleepTime)}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
        delayMs *= 2; // exponential backoff
        continue;
      }
      return res;
    } catch (err) {
      const jitter = Math.random() * 1000;
      const sleepTime = delayMs + jitter;
      console.warn(`Fetch error on ${url}: ${err}. Retrying in ${Math.round(sleepTime)}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      delayMs *= 2;
    }
  }
  if (res) return res;
  throw lastError || new Error(`Request to ${url} failed after ${maxRetries} attempts.`);
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { documentText, filename } = await req.json();

    if (!documentText) {
      return new Response(JSON.stringify({ error: "Missing documentText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
    const tavilyApiKey = Deno.env.get("TAVILY_API_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase URL or service key environment variables.");
    }
    if (!geminiApiKey || !tavilyApiKey) {
      throw new Error("Missing Gemini or Tavily API keys environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Create document row in database
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        filename: filename || "document.pdf",
        status: "processing",
        total_claims: 0,
        verified_count: 0,
        inaccurate_count: 0,
        false_count: 0,
      })
      .select()
      .single();

    if (docError || !doc) {
      throw new Error(`Failed to create document record: ${docError?.message || "unknown error"}`);
    }

    const documentId = doc.id;

    // 2. Start claims audit processing in the background (runs asynchronously)
    const backgroundPromise = (async () => {
      try {
        console.log(`Starting background claims extraction for document ${documentId}...`);

        // A. Detect available v1beta models for this API key to auto-recover from 404 errors
        let targetModel = "models/gemini-3.1-flash-lite";
        try {
          const listRes = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            const availableModels = listData.models?.map((m: any) => m.name) || [];
            console.log("Available v1beta models:", availableModels);
            
            const priorities = [
              "models/gemini-3.1-flash-lite",
              "models/gemini-3.1-flash-lite-latest",
              "models/gemini-2.5-flash-lite",
              "models/gemini-2.5-flash-lite-latest",
              "models/gemini-1.5-flash",
              "models/gemini-1.5-flash-latest",
              "models/gemini-2.0-flash",
              "models/gemini-2.0-flash-latest",
              "models/gemini-2.5-flash",
              "models/gemini-1.5-pro",
              "models/gemini-1.5-pro-latest",
              "models/gemini-2.5-pro",
              "models/gemini-2.0-pro"
            ];

            let found = false;
            for (const p of priorities) {
              if (availableModels.includes(p)) {
                targetModel = p;
                found = true;
                break;
              }
            }
            
            if (!found && availableModels.length > 0) {
              const generateContentModel = listData.models?.find(
                (m: any) => m.supportedGenerationMethods?.includes("generateContent")
              );
              if (generateContentModel) {
                targetModel = generateContentModel.name;
              }
            }
          } else {
            console.warn(`Failed to query models list. Status: ${listRes.status}`);
          }
        } catch (e) {
          console.error("Error detecting available models:", e);
        }
        
        console.log(`Using selected Gemini model: ${targetModel}`);

        // B. Extract claims using Gemini
        const extractionPrompt = `Extract up to 10 distinct, factual claims (e.g. stats, dates, financials, technical specs) that can be verified from the following text. Catalog each claim and choose the most appropriate category tag (STAT, DATE, FINANCIAL, TECHNICAL). Return ONLY a JSON object matching this schema:
{
  "claims": [
    {
      "claim_text": "text of the claim",
      "claim_type": "STAT" | "DATE" | "FINANCIAL" | "TECHNICAL"
    }
  ]
}

Text content to audit:
"""
${documentText}
"""`;

        const geminiExtractRes = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: extractionPrompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: {
                    claims: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          claim_text: { type: "STRING" },
                          claim_type: {
                            type: "STRING",
                            enum: ["STAT", "DATE", "FINANCIAL", "TECHNICAL"],
                          },
                        },
                        required: ["claim_text", "claim_type"],
                      },
                    },
                  },
                  required: ["claims"],
                },
              },
            }),
          },
          20000
        );

        if (!geminiExtractRes.ok) {
          const errText = await geminiExtractRes.text();
          throw new Error(`Gemini claims extraction API failed: ${errText}`);
        }

        const extractData = await geminiExtractRes.json();
        const claimsList = extractData?.candidates?.[0]?.content?.parts?.[0]?.text
          ? JSON.parse(extractData.candidates[0].content.parts[0].text).claims
          : [];

        console.log(`Extracted ${claimsList.length} claims. Registering in DB...`);

        // Update total_claims in document
        await supabase
          .from("documents")
          .update({ total_claims: claimsList.length })
          .eq("id", documentId);

        if (claimsList.length === 0) {
          await supabase
            .from("documents")
            .update({ status: "completed" })
            .eq("id", documentId);
          return;
        }

        // C. Bulk insert all claims as pending
        console.log(`Inserting all ${claimsList.length} claims as pending...`);
        const claimsToInsert = claimsList.map((c: any) => ({
          document_id: documentId,
          claim_text: c.claim_text,
          claim_type: c.claim_type,
          verdict: "pending",
          reasoning: null,
          source_url: null,
          source_snippet: null,
          correct_fact: null,
        }));

        const { data: insertedClaims, error: claimsInsError } = await supabase
          .from("claims")
          .insert(claimsToInsert)
          .select();

        if (claimsInsError || !insertedClaims) {
          throw new Error(`Failed to bulk insert claims: ${claimsInsError?.message || "unknown error"}`);
        }

        console.log(`Successfully bulk inserted ${insertedClaims.length} claims. Processing...`);

        // D. Gather Tavily search results for all claims concurrently (Tavily doesn't rate limit)
        console.log(`Searching web for all ${insertedClaims.length} claims concurrently...`);
        const searchResultsMap: Record<string, any[]> = {};
        
        await Promise.all(
          insertedClaims.map(async (c: any) => {
            try {
              console.log(`Searching Tavily for claim: "${c.claim_text}"`);
              const results = await searchWeb(c.claim_text, tavilyApiKey);
              searchResultsMap[c.id] = results;
            } catch (err) {
              console.error(`Tavily search failed for claim "${c.claim_text}":`, err);
              searchResultsMap[c.id] = [];
            }
          })
        );

        // E. Build a single unified evaluation prompt for Gemini
        console.log("Building unified evaluation prompt for Gemini...");
        const evaluationsPrompt = `You are a forensic fact-checking agent. Below are multiple claims to verify, along with their corresponding search engine results.

${insertedClaims.map((c: any, idx: number) => {
  const claimSearch = searchResultsMap[c.id] || [];
  const evidenceText = claimSearch
    .map((r: any, rIdx: number) => `${rIdx + 1}. URL: ${r.url}\nContent: ${r.content}`)
    .join("\n\n");
  return `Claim #${idx + 1}:
ID: ${c.id}
Text: "${c.claim_text}"
Type: ${c.claim_type}
Evidence:
"""
${evidenceText || "No search results found."}
"""`;
}).join("\n\n---\n\n")}

For each claim, evaluate if it is Verified, Inaccurate, or False based strictly on the search results.
If there is no web evidence supporting or refuting the claim, verify it as "verified" if it is highly standard, or "inaccurate" / "false" if refuted. Be strict and forensic.
Return ONLY a JSON object matching this schema:
{
  "evaluations": [
    {
      "claim_id": "string (the exact ID of the claim)",
      "verdict": "verified" | "inaccurate" | "false",
      "reasoning": "Forensic proof/disproof explanation based on search results",
      "correct_fact": "The true fact if inaccurate or false, else null",
      "source_url": "The most relevant source URL from search results, or null",
      "source_snippet": "The exact snippet from the source URL supporting your verdict, or null"
    }
  ]
}

Ensure the output is valid JSON and contains evaluations for all input claims.`;

        // F. Call Gemini evaluation ONCE using fetchWithRetry with a 25-second timeout
        console.log("Calling Gemini evaluation API in a single batch request...");
        const geminiEvalRes = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: evaluationsPrompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: {
                    evaluations: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          claim_id: { type: "STRING" },
                          verdict: {
                            type: "STRING",
                            enum: ["verified", "inaccurate", "false"],
                          },
                          reasoning: { type: "STRING" },
                          correct_fact: { type: "STRING" },
                          source_url: { type: "STRING" },
                          source_snippet: { type: "STRING" },
                        },
                        required: ["claim_id", "verdict", "reasoning"],
                      },
                    },
                  },
                  required: ["evaluations"],
                },
              },
            }),
          },
          25000
        );

        if (!geminiEvalRes.ok) {
          const errBody = await geminiEvalRes.text().catch(() => "");
          throw new Error(`Gemini evaluation API returned status code ${geminiEvalRes.status}. Details: ${errBody}`);
        }

        const evalJson = await geminiEvalRes.json();
        const textContent = evalJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) {
          throw new Error("Gemini evaluation returned an empty text response.");
        }

        let evalDataResult;
        try {
          evalDataResult = JSON.parse(textContent);
        } catch (e) {
          console.error("Failed to parse evaluations JSON:", e);
          throw new Error(`Failed to parse Gemini evaluations JSON: ${e.message}`);
        }

        const evaluationsList = evalDataResult.evaluations || [];
        console.log(`Received evaluations for ${evaluationsList.length} claims. Updating DB...`);

        // G. Update database claim rows
        const processedClaimIds = new Set<string>();
        const cleanString = (val: any) => {
          if (val === null || val === undefined) return null;
          const s = String(val).trim();
          if (s.toLowerCase() === "null" || s === "") return null;
          return s;
        };

        for (const evalItem of evaluationsList) {
          const verdict = cleanString(evalItem.verdict) || "verified";
          const reasoning = cleanString(evalItem.reasoning) || "Verification complete.";
          const correctFact = cleanString(evalItem.correct_fact);
          const sourceUrl = cleanString(evalItem.source_url);
          const sourceSnippet = cleanString(evalItem.source_snippet);

          await supabase
            .from("claims")
            .update({
              verdict,
              reasoning,
              correct_fact: correctFact,
              source_url: sourceUrl,
              source_snippet: sourceSnippet,
            })
            .eq("id", evalItem.claim_id);

          processedClaimIds.add(evalItem.claim_id);
          console.log(`Updated claim ${evalItem.claim_id} to verdict: ${verdict}`);
        }

        // Catch any claims that were not returned in the AI evaluations
        for (const c of insertedClaims) {
          if (!processedClaimIds.has(c.id)) {
            await supabase
              .from("claims")
              .update({
                verdict: "error",
                reasoning: "Claim was not evaluated by the AI verification agent."
              })
              .eq("id", c.id);
          }
        }

        // H. Update progress document counts thread-safely by querying the database state
        const { data: claimsInDoc, error: countsError } = await supabase
          .from("claims")
          .select("verdict")
          .eq("document_id", documentId);

        if (!countsError && claimsInDoc) {
          const verifiedCount = claimsInDoc.filter((c: any) => c.verdict === "verified").length;
          const inaccurateCount = claimsInDoc.filter((c: any) => c.verdict === "inaccurate").length;
          const falseCount = claimsInDoc.filter((c: any) => c.verdict === "false").length;

          await supabase
            .from("documents")
            .update({
              verified_count: verifiedCount,
              inaccurate_count: inaccurateCount,
              false_count: falseCount,
            })
            .eq("id", documentId);
        }

        // F. Finish document processing successfully
        await supabase
          .from("documents")
          .update({ status: "completed" })
          .eq("id", documentId);

        console.log(`Document verification completed for ${documentId}`);
      } catch (err: any) {
        console.error(`Error in background claims processing for document ${documentId}:`, err);
        await supabase
          .from("documents")
          .update({ status: "error" })
          .eq("id", documentId);

        // Also update any remaining pending claims to "error" verdict so they don't spin forever
        try {
          await supabase
            .from("claims")
            .update({
              verdict: "error",
              reasoning: `Verification aborted: ${err?.message || "Internal background process error."}`
            })
            .eq("document_id", documentId)
            .eq("verdict", "pending");
        } catch (dbErr) {
          console.error("Failed to update pending claims to error:", dbErr);
        }
      }
    })();

    // @ts-ignore
    EdgeRuntime.waitUntil(backgroundPromise);

    // Return documentId immediately to client
    return new Response(JSON.stringify({ documentId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Edge Function request error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function searchWeb(query: string, apiKey: string) {
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_answer: false,
        max_results: 3,
      }),
    }, 8000);

    if (!res.ok) {
      throw new Error(`Tavily search request failed with status: ${res.status}`);
    }

    const searchData = await res.json();
    return searchData.results || [];
  } catch (err) {
    console.error(`Tavily search error for query "${query}":`, err);
    return [];
  }
}
