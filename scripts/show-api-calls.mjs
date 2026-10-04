/**
 * Learning script: shows every raw API call TrustLens makes and the response it gets.
 * Run: node --env-file=.env.local scripts/show-api-calls.mjs
 *
 * Traces 4 APIs in order:
 *  1. Tavily  — finds vendor URLs for a product
 *  2. ZooData scrape  — fetches full page content as markdown
 *  3. ZooData reviews — gets Amazon review flags (verifiedPurchase, vineProgram)
 *  4. Nebius  — the LLM scores one vendor using the data above
 */

import OpenAI from "openai";

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  cyan:   "\x1b[36m",
  yellow: "\x1b[33m",
  blue:   "\x1b[34m",
  red:    "\x1b[31m",
  magenta:"\x1b[35m",
};

function banner(step, title, color = C.cyan) {
  console.log(`\n${color}${C.bold}${"─".repeat(60)}`);
  console.log(`  STEP ${step}: ${title}`);
  console.log(`${"─".repeat(60)}${C.reset}`);
}

function req(label, payload) {
  console.log(`\n${C.yellow}${C.bold}▶ REQUEST — ${label}${C.reset}`);
  console.log(C.dim + JSON.stringify(payload, null, 2).slice(0, 1200) + C.reset);
}

function res(label, payload) {
  console.log(`\n${C.green}${C.bold}◀ RESPONSE — ${label}${C.reset}`);
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  console.log(C.dim + text.slice(0, 2000) + (text.length > 2000 ? "\n…(truncated)" : "") + C.reset);
}

function highlight(label, value) {
  console.log(`\n${C.magenta}${C.bold}★ ${label}${C.reset}`);
  console.log(C.bold + String(value) + C.reset);
}

// ── Config ────────────────────────────────────────────────────────────────────
const PRODUCT    = "Amazon Echo Dot 5th Gen";
// PriceRunner for scraping — Amazon/BestBuy block scrapers, price comparison sites work well
const SCRAPE_URL = "https://www.pricerunner.com/pl/267-3202550989/Speakers/Amazon-Echo-Dot-5th-Generation-Compare-Prices";
// Amazon ASIN for reviews — ZooData reviews API uses ASIN directly
const AMAZON_URL = "https://www.amazon.com/dp/B09B8T5VGV";
const ASIN       = "B09B8T5VGV";

const TAVILY_KEY  = process.env.TAVILY_API_KEY;
const ZOO_KEY     = process.env.ZOODATA_API_KEY;
const NEBIUS_KEY  = process.env.NEBIUS_API_KEY;
const NEBIUS_URL  = process.env.NEBIUS_BASE_URL  || "https://api.studio.nebius.com/v1/";
const NEBIUS_MODEL= process.env.NEBIUS_MODEL     || "Qwen/Qwen3-30B-A3B-Instruct-2507";

if (!TAVILY_KEY || !ZOO_KEY || !NEBIUS_KEY) {
  console.error("Missing env vars — run with: node --env-file=.env.local scripts/show-api-calls.mjs");
  process.exit(1);
}

console.log(`\n${C.bold}TrustLens — Live API Call Walkthrough${C.reset}`);
console.log(`${C.dim}Product: "${PRODUCT}"${C.reset}`);

// ════════════════════════════════════════════════════════════════════
// STEP 1 — TAVILY: find vendor URLs
// ════════════════════════════════════════════════════════════════════
banner(1, "TAVILY — Vendor Discovery", C.blue);

const tavilyBody = {
  api_key: TAVILY_KEY.slice(0, 12) + "…",   // masked for display
  query: `${PRODUCT} buy online best price`,
  search_depth: "advanced",
  max_results: 5,
};
req("POST https://api.tavily.com/search", tavilyBody);

const t0 = Date.now();
const tavilyRes = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...tavilyBody, api_key: TAVILY_KEY }),
});
const tavilyData = await tavilyRes.json();
console.log(`\n${C.dim}(${Date.now() - t0}ms)${C.reset}`);

const vendors = (tavilyData.results ?? []).slice(0, 3);
res("Tavily — top 3 results", vendors.map(v => ({
  url:     v.url,
  title:   v.title,
  score:   v.score,
  snippet: v.content?.slice(0, 120) + "…",
})));

highlight("What this gives us", vendors.map((v, i) => `${i+1}. ${v.url}`).join("\n"));

// ════════════════════════════════════════════════════════════════════
// STEP 2 — ZOODATA SCRAPE: get full page markdown for Amazon
// ════════════════════════════════════════════════════════════════════
banner(2, "ZOODATA SCRAPE — Full Page Content", C.cyan);

const scrapeBody = {
  url: SCRAPE_URL,
  formats: ["markdown", "json"],
};
req(`POST https://api.zoodata.ai/openapi/v2/webtools/scrape\n  (using BestBuy — Amazon blocks scrapers)`, scrapeBody);

const t1 = Date.now();
const scrapeRes = await fetch("https://api.zoodata.ai/openapi/v2/webtools/scrape", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${ZOO_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(scrapeBody),
  signal: AbortSignal.timeout(30_000),
});
const scrapeData = await scrapeRes.json();
console.log(`\n${C.dim}(${Date.now() - t1}ms)${C.reset}`);

const markdown = scrapeData?.data?.markdown ?? "";
// Show the full raw response so we can see exactly what ZooData returned
res("ZooData Scrape — full raw response (top-level keys)", {
  success:    scrapeData.success,
  error:      scrapeData.error ?? scrapeData.message ?? "(none)",
  dataKeys:   scrapeData.data ? Object.keys(scrapeData.data) : "(no data)",
  title:      scrapeData?.data?.meta?.title ?? "(none)",
  statusCode: scrapeData?.data?.meta?.statusCode ?? "(none)",
  markdownLength: markdown.length + " chars",
  markdownPreview: markdown.length > 0 ? markdown.slice(0, 500) + "…" : "(empty — site likely blocked scraper)",
});

highlight("What this gives us",
  "Full product page as clean markdown — pricing, specs, seller info — for the LLM to analyse"
);

// ════════════════════════════════════════════════════════════════════
// STEP 3 — ZOODATA REVIEWS: real Amazon review flags
// ════════════════════════════════════════════════════════════════════
banner(3, "ZOODATA REVIEWS — Real Amazon Review Flags", C.cyan);

const reviewsBody = { asin: ASIN };
req(`POST https://api.zoodata.ai/openapi/v2/realtime/reviews  (ASIN: ${ASIN})`, reviewsBody);

const t2 = Date.now();
const reviewsRes = await fetch("https://api.zoodata.ai/openapi/v2/realtime/reviews", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${ZOO_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(reviewsBody),
  signal: AbortSignal.timeout(20_000),
});
const reviewsData = await reviewsRes.json();
console.log(`\n${C.dim}(${Date.now() - t2}ms)${C.reset}`);

const reviews = (reviewsData?.data?.reviews ?? []).slice(0, 5);
// Show raw top-level shape first so we can see what ZooData actually returned
res("ZooData Reviews — raw response shape", {
  success:     reviewsData.success,
  error:       reviewsData.error ?? "(none)",
  dataKeys:    reviewsData.data ? Object.keys(reviewsData.data) : "(no data)",
  reviewCount: (reviewsData?.data?.reviews ?? []).length,
  rawSample:   reviewsData?.data?.reviews?.[0] ?? "(no reviews in response)",
});

res("ZooData Reviews — first 5 reviews (normalised fields)", reviews.map(r => ({
  rating:          r.rating,
  verifiedPurchase: r.verifiedPurchase,   // ← this is the KEY field
  vineProgram:     r.vineProgram,          // ← and this
  date:            r.date,
  bodyPreview:     String(r.body ?? r.text ?? "").slice(0, 80) + "…",
})));

// Calculate metrics
const all = reviewsData?.data?.reviews ?? [];
const verified  = all.filter(r => r.verifiedPurchase).length;
const vine      = all.filter(r => r.vineProgram).length;
const verifiedRatio = all.length ? verified / all.length : 0;
const vineRatio     = all.length ? vine / all.length : 0;
const avgRating     = all.length ? all.reduce((s, r) => s + (r.rating ?? 0), 0) / all.length : 0;

highlight(
  `What this gives us (from ${all.length} reviews)`,
  `verifiedPurchase: ${(verifiedRatio * 100).toFixed(0)}%  ← Amazon's own flag (not estimated)
vineProgram:      ${(vineRatio * 100).toFixed(0)}%  ← incentivised/free-product reviews
avgRating:        ${avgRating.toFixed(2)} / 5
reviewQualityScore: ${Math.max(0, (verifiedRatio * 0.7 - vineRatio * 0.3)).toFixed(2)} (used in trust formula)`
);

// ════════════════════════════════════════════════════════════════════
// STEP 4 — NEBIUS LLM: claim scoring
// ════════════════════════════════════════════════════════════════════
banner(4, "NEBIUS (Qwen3-30B) — Claim Verification + Trust Score", C.magenta);

const reviewBlock = all.length
  ? `REAL REVIEW DATA (from ZooData):
- Total reviews sampled: ${all.length}
- Verified purchases: ${(verifiedRatio * 100).toFixed(0)}%
- Vine/incentivised: ${(vineRatio * 100).toFixed(0)}%
- Avg rating: ${avgRating.toFixed(1)}/5
For ai_review_ratio use ${(1 - Math.max(0, verifiedRatio * 0.7 - vineRatio * 0.3)).toFixed(2)} (from real data)`
  : "No real review data — estimate from page content.";

const systemPrompt = `You are a trust analyst. Given a vendor page about a product, you must:
1. Extract 3-4 verifiable claims (specs, certifications, measurements — not marketing)
2. Classify each claim as VERIFIED, EXAGGERATED, or FABRICATED
3. Set ai_review_ratio (0-1)
4. Calculate trust_score 0-100: base 50 + (verified_ratio×30) - (fabricated_ratio×40) - (ai_review_ratio×20), clamp 0-100
5. Assign verdict: ≥85 HIGHLY_TRUSTED, ≥65 TRUSTED, ≥40 CAUTION, <40 AVOID
Return ONLY valid JSON: { "claims": [...], "ai_review_ratio": 0.0, "trust_score": 0, "verdict": "...", "summary": "..." }`;

const userContent = `Product: ${PRODUCT}
Vendor: BestBuy.com
URL: ${SCRAPE_URL}

${reviewBlock}

Page content:
${markdown.slice(0, 2000)}`;

const llmMessages = [
  { role: "system", content: systemPrompt },
  { role: "user",   content: userContent.slice(0, 3000) + "\n…(truncated for display)" },
];

req(`POST ${NEBIUS_URL}chat/completions  model: ${NEBIUS_MODEL}`, {
  model:           NEBIUS_MODEL,
  max_tokens:      600,
  response_format: { type: "json_object" },
  messages:        llmMessages,
});

const llm = new OpenAI({
  baseURL: NEBIUS_URL,
  apiKey:  NEBIUS_KEY,
  timeout: 40_000,
});

const t3 = Date.now();
const llmRes = await llm.chat.completions.create({
  model: NEBIUS_MODEL,
  max_tokens: 600,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userContent },
  ],
});
console.log(`\n${C.dim}(${Date.now() - t3}ms)${C.reset}`);

const rawJson = llmRes.choices[0].message.content ?? "{}";
let parsed;
try { parsed = JSON.parse(rawJson); } catch { parsed = { error: "parse failed", raw: rawJson }; }

res("Nebius LLM — raw JSON output", parsed);

highlight("Final trust score", `${parsed.trust_score ?? "?"} / 100  →  ${parsed.verdict ?? "?"}`);

// ════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════
console.log(`\n${C.bold}${"═".repeat(60)}`);
console.log(`  PIPELINE SUMMARY for "${PRODUCT}" on Amazon`);
console.log(`${"═".repeat(60)}${C.reset}`);
console.log(`\n  Tavily found vendors:        ${vendors.length} URLs`);
console.log(`  ZooData page content:        ${markdown.length} chars of markdown`);
console.log(`  ZooData review flags:        ${all.length} reviews (${(verifiedRatio*100).toFixed(0)}% verified, ${(vineRatio*100).toFixed(0)}% Vine)`);
console.log(`  Nebius trust score:          ${parsed.trust_score ?? "?"} / 100`);
console.log(`  Verdict:                     ${parsed.verdict ?? "?"}`);
if (parsed.claims?.length) {
  console.log(`\n  Claims checked:`);
  for (const c of parsed.claims) {
    // LLM sometimes drifts: returns strings, {claim,verdict}, or {text,verification}
    if (typeof c === "string") {
      console.log(`    ${C.yellow}~${C.reset} (no verdict)  ${c.slice(0, 70)}`);
    } else {
      const verdict = c.verdict ?? c.verification ?? "?";
      const text    = c.claim  ?? c.text  ?? JSON.stringify(c).slice(0, 70);
      const dot = verdict === "VERIFIED" ? C.green + "✓" : verdict === "FABRICATED" ? C.red + "✗" : C.yellow + "~";
      console.log(`    ${dot} ${verdict}${C.reset}  ${text.slice(0, 70)}`);
    }
  }
  if (parsed.claims.some(c => typeof c === "string")) {
    console.log(`\n  ${C.yellow}Note: LLM returned claims as strings instead of objects.${C.reset}`);
    console.log(`  ${C.dim}This means it drifted from the JSON schema — the pipeline handles this gracefully.${C.reset}`);
  }
}
console.log();
