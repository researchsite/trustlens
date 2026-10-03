/**
 * ZooData API Test Script — based on openapi-spec-latest.json
 * Run: node --env-file=.env.local scripts/test-zoowork.mjs
 *
 * TWO SEPARATE APIs — do not confuse them:
 *   ZooData  (api.zoodata.ai)       — e-commerce data: scrape, search, reviews, product
 *                                     key format: hms_xxx    env: ZOODATA_API_KEY
 *   ZooWork  (clawapi.ecap.gsmo.ai) — LLM proxy: 40+ models
 *                                     key format: zwp_live_xxx  env: ZOOWORK_API_KEY
 *
 * This script tests ZooData. Get hms_xxx key from ZooData rep at the event.
 *
 * Tests:
 *   A) Account balance      — verify key works
 *   B) Scrape (markdown)    — extract product page as markdown
 *   C) Scrape (json)        — extract structured page summary
 *   D) Realtime reviews     — get Amazon reviews by ASIN
 *   E) Realtime product     — get live Amazon product data by ASIN
 *   F) Web search           — search with domain filters (Tavily replacement candidate)
 *   G) Scrape Temu URL      — test JS-rendered marketplace page
 */

// Prefer ZOODATA_API_KEY; fall back to ZOOWORK_API_KEY with a warning
const RAW_KEY = process.env.ZOODATA_API_KEY ?? process.env.ZOOWORK_API_KEY ?? "";
if (!RAW_KEY) {
  console.error("❌  Neither ZOODATA_API_KEY nor ZOOWORK_API_KEY found in .env.local");
  process.exit(1);
}

if (!RAW_KEY.startsWith("hms_") && !RAW_KEY.startsWith("Bearer hms_")) {
  console.warn(`\x1b[33m⚠  Key starts with '${RAW_KEY.slice(0,15)}...' — ZooData requires 'hms_xxx' format.\x1b[0m`);
  console.warn(`\x1b[33m   Add ZOODATA_API_KEY=hms_xxx... to .env.local (get from ZooData rep).\x1b[0m\n`);
}

const AUTH_TOKEN = RAW_KEY.startsWith("Bearer ") ? RAW_KEY : `Bearer ${RAW_KEY}`;

// ZooData API — correct base URL confirmed (separate from ZooWork LLM proxy)
const BASE = "https://api.zoodata.ai";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function pass(label, detail = "") { console.log(`  ${green("✓")} ${label} ${dim(detail)}`); }
function fail(label, detail = "") { console.log(`  ${red("✗")} ${label} ${dim(detail)}`); }
function warn(label, detail = "") { console.log(`  ${yellow("⚠")} ${label} ${dim(detail)}`); }

function printJson(obj, indent = "    ") {
  const s = JSON.stringify(obj, null, 2)
    .split("\n")
    .map((l) => indent + l)
    .join("\n");
  console.log(dim(s.slice(0, 600) + (s.length > 600 ? "\n    ... (truncated)" : "")));
}

async function post(path, body) {
  const url = `${BASE}${path}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: AUTH_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { ok: res.ok, status: res.status, ms, data };
}

async function get(path) {
  const url = `${BASE}${path}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { Authorization: AUTH_TOKEN },
  });
  const ms = Date.now() - t0;
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { ok: res.ok, status: res.status, ms, data };
}

// Test product ASIN — Sony WH-1000XM5
const AMAZON_ASIN = "B09XS7JWHH";
const AMAZON_URL = `https://www.amazon.com/dp/${AMAZON_ASIN}`;
const TEMU_URL =
  "https://www.temu.com/-heavy-duty-tire-wheel-brush-with-long-handle-non-scratch-deep-cleaning-car-tires-plush-bristles-for-wheel-rims-hubcaps-alloy-mag-wheel--auto-detailing-tool-garage-use-durable-car-washing-brush-ergonomic-g-601104358416832.html";

console.log(bold("\n=== ZooWork API Tests ==="));
console.log(dim(`Base URL: ${BASE}`));
console.log(dim(`Auth:     ${AUTH_TOKEN.slice(0, 20)}...`));

// ─── A: Account balance — verify key + base URL ──────────────────────────────
console.log(bold("\n[A] Account Balance (GET /openapi/v2/account/balance)"));
console.log(dim("    Checks: Does the API key work? Is the base URL correct?"));
try {
  const r = await get("/openapi/v2/account/balance");
  if (!r.ok) {
    fail(`HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 200));
    console.log(dim("    → If 401: wrong API key format (must be 'Bearer hms_xxx')"));
    console.log(dim("    → If 404: wrong base URL — ask rep for correct host"));
  } else {
    pass(`Key valid`, `${r.ms}ms`);
    printJson(r.data);
  }
} catch (e) {
  fail("Request threw", e.message);
}

// ─── B: Scrape Amazon product (markdown) ─────────────────────────────────────
console.log(bold("\n[B] Scrape Amazon product page — markdown (POST /openapi/v2/webtools/scrape)"));
console.log(dim("    Checks: Can we get full page content? Do reviews appear in markdown?"));
try {
  const r = await post("/openapi/v2/webtools/scrape", {
    url: AMAZON_URL,
    formats: ["markdown"],
  });
  if (!r.ok) {
    fail(`HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 200));
  } else if (!r.data?.data?.markdown) {
    warn("Response OK but no markdown field", JSON.stringify(r.data).slice(0, 200));
  } else {
    const md = r.data.data.markdown;
    const hasReviews = /review|star|rating/i.test(md);
    pass(`Markdown received`, `${r.ms}ms · ${md.length} chars`);
    console.log(dim(`    meta.title:      ${r.data.data.meta?.title ?? "—"}`));
    console.log(dim(`    meta.statusCode: ${r.data.data.meta?.statusCode ?? "—"}`));
    console.log(dim(`    contains reviews: ${hasReviews ? green("YES") : red("NO")}`));
    console.log(dim("    First 400 chars of markdown:"));
    console.log(dim("    " + md.slice(0, 400).replace(/\n/g, "\n    ")));
  }
} catch (e) {
  fail("Request threw", e.message);
}

// ─── C: Scrape Amazon product (structured JSON) ───────────────────────────────
console.log(bold("\n[C] Scrape Amazon product — structured JSON (POST /openapi/v2/webtools/scrape)"));
console.log(dim("    Checks: Does json format return useful structured fields (price, rating, claims)?"));
try {
  const r = await post("/openapi/v2/webtools/scrape", {
    url: AMAZON_URL,
    formats: ["json"],
  });
  if (!r.ok) {
    fail(`HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 200));
  } else if (!r.data?.data?.json) {
    warn("Response OK but no json field", JSON.stringify(r.data).slice(0, 200));
  } else {
    pass(`Structured JSON received`, `${r.ms}ms`);
    printJson(r.data.data.json);
  }
} catch (e) {
  fail("Request threw", e.message);
}

// ─── D: Realtime reviews for ASIN ────────────────────────────────────────────
console.log(bold(`\n[D] Realtime Reviews (POST /openapi/v2/realtime/reviews) — ASIN: ${AMAZON_ASIN}`));
console.log(dim("    Checks: Do we get actual review text? verified_purchase flag? rating per review?"));
try {
  const r = await post("/openapi/v2/realtime/reviews", {
    asin: AMAZON_ASIN,
  });
  if (!r.ok) {
    fail(`HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 200));
  } else {
    const reviews = r.data?.data?.reviews ?? r.data?.data ?? [];
    const count = Array.isArray(reviews) ? reviews.length : "?";
    pass(`${count} reviews received`, `${r.ms}ms`);
    if (Array.isArray(reviews) && reviews.length > 0) {
      const first = reviews[0];
      console.log(dim(`    First review keys: ${Object.keys(first).join(", ")}`));
      console.log(dim(`    rating:            ${first.rating ?? first.stars ?? "—"}`));
      console.log(dim(`    verified:          ${first.verifiedPurchase ?? first.verified_purchase ?? first.verified ?? "—"}`));
      console.log(dim(`    text:              "${(first.body ?? first.text ?? first.content ?? "—").slice(0, 100)}"`));
    } else {
      console.log(dim("    Response shape: " + JSON.stringify(r.data).slice(0, 300)));
    }
  }
} catch (e) {
  fail("Request threw", e.message);
}

// ─── E: Realtime product data (ASIN) ─────────────────────────────────────────
console.log(bold(`\n[E] Realtime Product (POST /openapi/v3/realtime/product) — ASIN: ${AMAZON_ASIN}`));
console.log(dim("    Checks: Price, rating, review count, BSR, Buy Box seller — real-time data"));
try {
  const r = await post("/openapi/v3/realtime/product", {
    asin: AMAZON_ASIN,
  });
  if (!r.ok) {
    fail(`HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 200));
  } else {
    const p = r.data?.data ?? r.data;
    pass(`Product data received`, `${r.ms}ms`);
    console.log(dim(`    title:        ${p?.title ?? "—"}`));
    console.log(dim(`    price:        ${p?.price ?? p?.buyBoxPrice ?? "—"}`));
    console.log(dim(`    rating:       ${p?.rating ?? "—"}`));
    console.log(dim(`    reviewCount:  ${p?.reviewCount ?? p?.review_count ?? "—"}`));
    console.log(dim(`    bsr:          ${JSON.stringify(p?.bsr ?? p?.bestSellersRank ?? "—").slice(0, 80)}`));
  }
} catch (e) {
  fail("Request threw", e.message);
}

// ─── F: Web search with domain filter ────────────────────────────────────────
console.log(bold("\n[F] Web Search (POST /openapi/v2/webtools/search)"));
console.log(dim("    Checks: Can this replace Tavily? includeDomains/excludeDomains support?"));
try {
  const r = await post("/openapi/v2/webtools/search", {
    query: "Sony WH-1000XM5 headphones buy trusted vendor",
    limit: 5,
    excludeDomains: ["temu.com", "aliexpress.com"],
  });
  if (!r.ok) {
    fail(`HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 200));
  } else {
    const results = r.data?.data?.results ?? r.data?.data ?? [];
    const count = Array.isArray(results) ? results.length : "?";
    pass(`${count} results received`, `${r.ms}ms`);
    if (Array.isArray(results)) {
      results.slice(0, 3).forEach((res, i) => {
        console.log(dim(`    [${i + 1}] ${res.url ?? res.link ?? "—"}`));
        console.log(dim(`        ${(res.meta?.description ?? res.snippet ?? res.description ?? "").slice(0, 80)}`));
      });
    }
  }
} catch (e) {
  fail("Request threw", e.message);
}

// ─── G: Scrape Temu URL ───────────────────────────────────────────────────────
console.log(bold("\n[G] Scrape Temu URL — static first, then interactive if blocked"));
console.log(dim("    Checks: Can we extract content from Temu (JS-rendered, anti-bot)?"));
console.log(dim(`    URL: ${TEMU_URL.slice(0, 80)}...`));

let temuWorked = false;
try {
  const r = await post("/openapi/v2/webtools/scrape", {
    url: TEMU_URL,
    formats: ["json", "markdown"],
  });
  if (!r.ok) {
    warn(`Static scrape HTTP ${r.status} — will try interactive`, JSON.stringify(r.data).slice(0, 100));
  } else if (r.data?.data?.error?.code === "ACCESS_DENIED" || !r.data?.success) {
    warn("Static scrape blocked (ACCESS_DENIED)", "trying scrape-interactive...");
  } else {
    const d = r.data?.data;
    pass(`Static scrape worked`, `${r.ms}ms`);
    console.log(dim(`    meta.title:      ${d?.meta?.title ?? "—"}`));
    console.log(dim(`    meta.statusCode: ${d?.meta?.statusCode ?? "—"}`));
    console.log(dim(`    json keys:       ${Object.keys(d?.json ?? {}).join(", ") || "—"}`));
    console.log(dim(`    markdown length: ${d?.markdown?.length ?? 0} chars`));
    temuWorked = true;
  }
} catch (e) {
  warn("Static scrape threw", e.message);
}

if (!temuWorked) {
  console.log(dim("    → Trying /webtools/scrape-interactive (headless browser)..."));
  try {
    const r = await post("/openapi/v2/webtools/scrape-interactive", {
      url: TEMU_URL,
      actions: [
        { type: "wait", milliseconds: 2000 },
      ],
      formats: ["json"],
    });
    if (!r.ok) {
      fail(`Interactive scrape HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 200));
    } else if (!r.data?.success) {
      fail("Interactive scrape returned success:false", JSON.stringify(r.data?.error ?? {}).slice(0, 100));
    } else {
      pass(`Interactive scrape worked`, `${r.ms}ms`);
      console.log(dim(`    title: ${r.data?.data?.meta?.title ?? "—"}`));
    }
  } catch (e) {
    fail("Interactive scrape threw", e.message);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────");
console.log(bold("Key questions to confirm with the rep:"));
console.log("  • What is the correct base URL? (spec paths start with /openapi/v2/...)");
console.log("  • ZOOWORK_API_KEY should be in 'hms_xxx' format — is that right?");
console.log("  • [D] reviews — does each review have verified_purchase true/false?");
console.log("  • [G] Temu — does scrape-interactive bypass their anti-bot?");
console.log("  • Billing: 1 credit per scrape call — what is credit cost in USD?");
console.log("  • Rate limit for /webtools/scrape at hackathon demo load?\n");
