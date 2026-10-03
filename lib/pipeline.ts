import OpenAI from "openai";
import { cacheGet, cacheSet } from "./cache";

// ─── Logger ──────────────────────────────────────────────────────────────────
function log(step: string, detail: string, ms?: number) {
  const ts = new Date().toISOString().slice(11, 23);
  const timing = ms !== undefined ? ` [${ms}ms]` : "";
  console.log(`[TrustLens ${ts}] ${step} — ${detail}${timing}`);
}

// ─── LLM client ──────────────────────────────────────────────────────────────
const llm = new OpenAI({
  baseURL: process.env.NEBIUS_BASE_URL || "https://api.studio.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY!,
  timeout: 30_000,
});
const MODEL = process.env.NEBIUS_MODEL || "Qwen/Qwen3-30B-A3B-Instruct-2507";

// ─── Tavily search ────────────────────────────────────────────────────────────
interface TavilyOptions {
  include_domains?: string[];
  exclude_domains?: string[];
}

async function tavilySearch(
  query: string,
  depth: "basic" | "advanced" = "basic",
  options: TavilyOptions = {}
): Promise<TavilyResult[]> {
  const cacheKey = query + depth + JSON.stringify(options);
  const cached = cacheGet<TavilyResult[]>("tavily", cacheKey);
  if (cached) { log("cache HIT", query.slice(0, 60)); return cached; }

  const t0 = Date.now();
  const body: Record<string, unknown> = {
    api_key: process.env.TAVILY_API_KEY,
    query,
    search_depth: depth,
    max_results: 5,
  };
  if (options.include_domains?.length) body.include_domains = options.include_domains;
  if (options.exclude_domains?.length) body.exclude_domains = options.exclude_domains;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  const results = (data.results ?? []) as TavilyResult[];
  log("Tavily", `${depth} "${query.slice(0, 50)}" → ${results.length}`, Date.now() - t0);
  cacheSet("tavily", cacheKey, results);
  return results;
}

// ─── Single-shot vendor scorer ────────────────────────────────────────────────
async function scoreVendor(
  vendor: TavilyResult,
  productName: string,
  isOriginalUrl = false
): Promise<VendorScore> {
  const cacheKey = vendor.url + productName;
  const cached = cacheGet<VendorScore>("vendor", cacheKey);
  if (cached) { log("cache HIT", `vendor ${vendor.url}`); return { ...cached, isOriginalUrl }; }

  const t0 = Date.now();
  const res = await llm.chat.completions.create({
    model: MODEL,
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a trust analyst. Given a vendor page about a product, you must:
1. Extract 3-4 verifiable claims (specs, certifications, measurements — not marketing)
2. Classify each claim as VERIFIED (well-established fact), EXAGGERATED (partially true), or FABRICATED (no basis)
3. Estimate ai_review_ratio (0-1): fraction of reviews that seem AI-generated (identical phrasing, excessive positivity, no specifics)
4. Calculate trust_score 0-100: base 50 + (verified_ratio×30) - (fabricated_ratio×40) - (ai_review_ratio×20), clamp 0-100
5. Assign verdict: ≥85 HIGHLY_TRUSTED, ≥65 TRUSTED, ≥40 CAUTION, <40 AVOID
6. Write a one-sentence summary of the vendor's trustworthiness

Return ONLY valid JSON (no markdown, no extra text):
{
  "claims": [{"claim":"...","verdict":"VERIFIED|EXAGGERATED|FABRICATED","reason":"..."}],
  "ai_review_ratio": 0.0,
  "trust_score": 0,
  "verdict": "TRUSTED",
  "summary": "..."
}`,
      },
      {
        role: "user",
        content: `Product: ${productName}
Vendor: ${vendor.title}
URL: ${vendor.url}
Page content:
${vendor.content.slice(0, 2000)}`,
      },
    ],
  });

  const raw = res.choices[0].message.content ?? "{}";
  let parsed: TrustVerdict;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log("WARN", `JSON parse failed for ${vendor.url}, using defaults`);
    parsed = { claims: [], ai_review_ratio: 0.3, trust_score: 50, verdict: "CAUTION", summary: "Analysis unavailable." };
  }

  const score: VendorScore = {
    vendorName: vendor.title,
    name: vendor.title,
    url: vendor.url,
    snippet: vendor.content.slice(0, 200),
    trustScore: parsed.trust_score ?? 50,
    verdict: parsed.verdict ?? "CAUTION",
    summary: parsed.summary ?? "",
    claims: parsed.claims ?? [],
    aiReviewRatio: parsed.ai_review_ratio ?? 0,
    isOriginalUrl,
  };

  log("scoreVendor", `"${vendor.title.slice(0, 35)}" → ${score.trustScore} ${score.verdict}${isOriginalUrl ? " [ORIGINAL]" : ""}`, Date.now() - t0);
  // Cache without isOriginalUrl flag so the same URL scored normally later is still cached
  cacheSet("vendor", cacheKey, { ...score, isOriginalUrl: false });
  return score;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────
export async function runTrustPipeline(params: PipelineParams): Promise<PipelineResult> {
  const { productName, mode, city, originalUrl } = params;
  const t0 = Date.now();
  log("pipeline", `START — "${productName}" mode=${mode}${city ? " city=" + city : ""}${originalUrl ? " URL=" + originalUrl.slice(0, 60) : ""}`);

  // ── URL mode: score the pasted vendor + find alternatives ──────────────────
  if (originalUrl) {
    const originalDomain = (() => {
      try { return new URL(originalUrl).hostname.replace("www.", ""); } catch { return null; }
    })();

    log("pipeline", `URL mode — original domain: ${originalDomain ?? "unknown"}`);

    // Search original domain for content AND search for trusted alternatives — parallel
    const [originalResults, altResults] = await Promise.all([
      originalDomain
        ? tavilySearch(`${productName}`, "basic", { include_domains: [originalDomain] })
        : Promise.resolve([] as TavilyResult[]),
      tavilySearch(
        `${productName} buy online trusted`,
        "advanced",
        originalDomain ? { exclude_domains: [originalDomain] } : {}
      ),
    ]);

    // Build the original vendor entry — use Tavily result if found, else synthesise from URL
    const originalEntry: TavilyResult =
      originalResults.length > 0
        ? { ...originalResults[0], url: originalUrl }
        : {
            url: originalUrl,
            title: productName + (originalDomain ? ` on ${originalDomain}` : ""),
            content: `Product listed on ${originalDomain ?? "marketplace"}. URL: ${originalUrl}. No detailed page content available — score is based on platform reputation and URL signals.`,
            score: 0.5,
          };

    const altVendors = altResults.slice(0, 2);

    if (!altVendors.length && !originalEntry) {
      log("pipeline", "no vendors — aborting");
      return { productName, mode, vendors: [], topPick: null, hiddenGem: null, originalUrl };
    }

    // Score original + alternatives in parallel
    const [originalScored, ...altScored] = await Promise.all([
      scoreVendor(originalEntry, productName, true),
      ...altVendors.map((v) => scoreVendor(v, productName, false)),
    ]);

    const altSorted = altScored.sort((a, b) => b.trustScore - a.trustScore);
    // Original URL vendor always first so the user sees "why it's bad" immediately
    const allVendors = [originalScored, ...altSorted];

    const topPick = altSorted[0] ?? null; // Best alternative, not the pasted URL
    const hiddenGem =
      altSorted.find((v, i) => i > 0 && v.trustScore >= 70 && v.trustScore >= (altSorted[0]?.trustScore ?? 0) - 10) ?? null;

    log(
      "pipeline",
      `URL DONE — original: ${originalScored.trustScore} ${originalScored.verdict} | best alt: "${altSorted[0]?.name?.slice(0, 30)}" ${altSorted[0]?.trustScore}`,
      Date.now() - t0
    );
    return { productName, mode, vendors: allVendors, topPick, hiddenGem, originalUrl };
  }

  // ── Standard mode ──────────────────────────────────────────────────────────
  const searchQuery =
    mode === "buy"
      ? `${productName} buy online best price`
      : `${productName} repair service ${city ?? "near me"}`;

  const vendorResults = await tavilySearch(searchQuery, "advanced");
  const vendors = vendorResults.slice(0, 3);
  log("pipeline", `${vendors.length} vendors discovered`);

  if (!vendors.length) {
    log("pipeline", "no vendors — aborting");
    return { productName, mode, vendors: [], topPick: null, hiddenGem: null };
  }

  log("pipeline", `scoring ${vendors.length} vendors in parallel…`);
  const scored = await Promise.all(vendors.map((v) => scoreVendor(v, productName)));

  const sorted = scored.sort((a, b) => b.trustScore - a.trustScore);
  const topPick = sorted[0] ?? null;
  const hiddenGem =
    sorted.find((v, i) => i > 0 && v.trustScore >= 70 && v.trustScore >= (sorted[0]?.trustScore ?? 0) - 10) ?? null;

  log("pipeline", `DONE — top="${topPick?.name?.slice(0, 40)}" score=${topPick?.trustScore}`, Date.now() - t0);
  return { productName, mode, vendors: sorted, topPick, hiddenGem };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PipelineParams {
  productName: string;
  mode: "buy" | "fix";
  city?: string;
  originalUrl?: string;
}

export interface PipelineResult {
  productName: string;
  mode: "buy" | "fix";
  vendors: VendorScore[];
  topPick: VendorScore | null;
  hiddenGem: VendorScore | null;
  originalUrl?: string;
}

export interface VendorScore {
  vendorName: string;
  name: string;
  url: string;
  snippet: string;
  trustScore: number;
  verdict: "HIGHLY_TRUSTED" | "TRUSTED" | "CAUTION" | "AVOID";
  summary: string;
  claims: ClaimVerdict[];
  aiReviewRatio: number;
  isOriginalUrl?: boolean;
}

interface ClaimVerdict { claim: string; verdict: "VERIFIED" | "EXAGGERATED" | "FABRICATED"; reason: string; }
interface TrustVerdict {
  claims: ClaimVerdict[];
  ai_review_ratio: number;
  trust_score: number;
  verdict: "HIGHLY_TRUSTED" | "TRUSTED" | "CAUTION" | "AVOID";
  summary: string;
}
interface TavilyResult { url: string; title: string; content: string; score: number; }
