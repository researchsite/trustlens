/**
 * ZooData API helper — api.zoodata.ai
 * Used to enrich vendor scoring with real product data, reviews, and page content.
 * All functions return null when ZOODATA_API_KEY is absent or the call fails,
 * so the pipeline degrades gracefully to Tavily-only mode.
 */

const KEY = (process.env.ZOODATA_API_KEY ?? "").startsWith("hms_")
  ? process.env.ZOODATA_API_KEY
  : undefined;
const BASE = "https://api.zoodata.ai";

function log(msg: string) {
  console.log(`[ZooData ${new Date().toISOString().slice(11, 23)}] ${msg}`);
}

function headers() {
  return { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
}

// ─── ASIN extraction ──────────────────────────────────────────────────────────
export function extractAsin(url: string): string | null {
  const m = url.match(/\/dp\/([A-Z0-9]{10})/i) ?? url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return m?.[1]?.toUpperCase() ?? null;
}

export function isAmazonUrl(url: string): boolean {
  return /amazon\.(com|co\.uk|de|fr|co\.jp|ca|com\.au)/i.test(url);
}

// ─── Page scrape ──────────────────────────────────────────────────────────────
export interface ZooScrapeResult {
  markdown: string;
  json: Record<string, unknown> | null;
  title: string;
  statusCode: number;
}

export async function zooScrape(url: string): Promise<ZooScrapeResult | null> {
  if (!KEY) return null;
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/openapi/v2/webtools/scrape`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ url, formats: ["markdown", "json"] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { log(`scrape HTTP ${res.status} for ${url.slice(0, 60)}`); return null; }
    const data = await res.json();
    if (!data?.success || !data?.data) { log(`scrape returned success:false for ${url.slice(0, 60)}`); return null; }
    const d = data.data;
    const result: ZooScrapeResult = {
      markdown: d.markdown ?? "",
      json: d.json ?? null,
      title: d.meta?.title ?? "",
      statusCode: d.meta?.statusCode ?? 200,
    };
    log(`scrape OK ${url.slice(0, 50)} — ${result.markdown.length} chars [${Date.now() - t0}ms]`);
    return result;
  } catch (e) {
    log(`scrape error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Amazon real-time reviews ─────────────────────────────────────────────────
export interface ZooReview {
  body: string;
  rating: number;
  verifiedPurchase: boolean;
  vineProgram: boolean;
  date: string;
}

export async function zooReviews(asin: string): Promise<ZooReview[] | null> {
  if (!KEY) return null;
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/openapi/v2/realtime/reviews`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ asin }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { log(`reviews HTTP ${res.status} for ASIN ${asin}`); return null; }
    const data = await res.json();
    if (!data?.success) { log(`reviews returned success:false for ASIN ${asin}`); return null; }
    const reviews: ZooReview[] = (data.data?.reviews ?? []).map((r: Record<string, unknown>) => ({
      body: String(r.body ?? r.text ?? ""),
      rating: Number(r.rating ?? 3),
      verifiedPurchase: Boolean(r.verifiedPurchase ?? r.verified_purchase ?? false),
      vineProgram: Boolean(r.vineProgram ?? r.vine_program ?? false),
      date: String(r.date ?? ""),
    }));
    log(`reviews OK ASIN ${asin} — ${reviews.length} reviews [${Date.now() - t0}ms]`);
    return reviews;
  } catch (e) {
    log(`reviews error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Amazon real-time product data ────────────────────────────────────────────
export interface ZooProductData {
  title: string;
  rating: number | null;
  reviewCount: number | null;
  price: string | null;
  sellerCount: number | null;
  recentSales: string | null;
}

export async function zooProduct(asin: string): Promise<ZooProductData | null> {
  if (!KEY) return null;
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/openapi/v3/realtime/product`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ asin }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { log(`product HTTP ${res.status} for ASIN ${asin}`); return null; }
    const data = await res.json();
    if (!data?.success) { log(`product returned success:false for ASIN ${asin}`); return null; }
    const p = data.data ?? {};
    const result: ZooProductData = {
      title: String(p.title ?? ""),
      rating: p.rating != null ? Number(p.rating) : null,
      reviewCount: p.reviewCount ?? p.review_count ?? null,
      price: p.buyBoxPrice ?? p.price ?? null,
      sellerCount: p.sellerCount ?? p.seller_count ?? null,
      recentSales: p.recentSales ?? p.recent_sales ?? null,
    };
    log(`product OK ASIN ${asin} — rating ${result.rating} [${Date.now() - t0}ms]`);
    return result;
  } catch (e) {
    log(`product error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Review metrics calculator ────────────────────────────────────────────────
export interface ReviewMetrics {
  total: number;
  verifiedRatio: number;    // fraction with verified purchase
  vineRatio: number;        // fraction from Vine program (incentivised)
  unverifiedRatio: number;  // 1 - verifiedRatio
  avgRating: number;
  sampleTexts: string[];    // first 5 review bodies for LLM analysis
  // Composite "review quality" score (higher = more trustworthy reviews)
  reviewQualityScore: number; // 0-1, replaces estimated ai_review_ratio in pipeline
}

export function calcReviewMetrics(reviews: ZooReview[]): ReviewMetrics {
  if (!reviews.length) {
    return { total: 0, verifiedRatio: 0, vineRatio: 0, unverifiedRatio: 1, avgRating: 0, sampleTexts: [], reviewQualityScore: 0.5 };
  }
  const verified = reviews.filter((r) => r.verifiedPurchase).length;
  const vine = reviews.filter((r) => r.vineProgram).length;
  const verifiedRatio = verified / reviews.length;
  const vineRatio = vine / reviews.length;
  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  // reviewQualityScore: high unverified + high vine = low quality (more fake)
  // Formula: penalise unverified and vine, reward verified
  const reviewQualityScore = Math.max(0, Math.min(1,
    verifiedRatio * 0.7 - vineRatio * 0.3
  ));

  return {
    total: reviews.length,
    verifiedRatio,
    vineRatio,
    unverifiedRatio: 1 - verifiedRatio,
    avgRating,
    sampleTexts: reviews.slice(0, 5).map((r) => r.body.slice(0, 120)),
    reviewQualityScore,
  };
}
