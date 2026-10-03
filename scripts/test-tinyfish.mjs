/**
 * TinyFish API Test Script
 * Run: node --env-file=.env.local scripts/test-tinyfish.mjs
 *
 * Tests 3 endpoints:
 *   1. Search  — find vendor URLs for a product
 *   2. Fetch   — extract markdown content from a vendor page
 *   3. Browser — (paid) anti-bot bypass (optional, only run if you have credits)
 */

const BASE = "https://api.tinyfish.ai";
const KEY = process.env.TINYFISH_API_KEY;

if (!KEY) {
  console.error("❌  TINYFISH_API_KEY not found in .env.local");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${KEY}` };

// ─── ANSI helpers ──────────────────────────────────────────────────────────
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;

function pass(label, detail = "") { console.log(`  ${green("✓")} ${label} ${dim(detail)}`); }
function fail(label, detail = "") { console.log(`  ${red("✗")} ${label} ${dim(detail)}`); }

// ─── TEST 1: Search ─────────────────────────────────────────────────────────
console.log(bold("\n[1] TinyFish Search — vendor discovery"));
try {
  const t0 = Date.now();
  const query = "Sony WH-1000XM5 headphones buy online";
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&limit=5`, { headers });
  const ms = Date.now() - t0;

  if (!res.ok) {
    fail(`HTTP ${res.status}`, await res.text());
  } else {
    const data = await res.json();
    const results = data.results ?? data ?? [];
    if (results.length > 0) {
      pass(`${results.length} results returned`, `${ms}ms`);
      results.forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.title ?? r.url}`);
        console.log(dim(`        ${r.url}`));
      });
    } else {
      fail("No results in response", JSON.stringify(data).slice(0, 200));
    }
  }
} catch (e) {
  fail("Search request threw", e.message);
}

// ─── TEST 2: Fetch — extract page content ───────────────────────────────────
console.log(bold("\n[2] TinyFish Fetch — extract page content as markdown"));
const TEST_URL = "https://www.amazon.com/Sony-WH1000XM5-Canceling-Headphones-Hands-Free/dp/B09XS7JWHH";
try {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/fetch`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ url: TEST_URL, format: "markdown" }),
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    fail(`HTTP ${res.status}`, await res.text());
  } else {
    const data = await res.json();
    const content = data.content ?? data.markdown ?? data.text ?? "";
    if (content.length > 100) {
      pass(`Content extracted`, `${ms}ms · ${content.length} chars`);
      console.log(dim("     Preview: " + content.slice(0, 200).replace(/\n/g, " ") + "…"));
    } else {
      fail("Content too short or empty", JSON.stringify(data).slice(0, 200));
    }
  }
} catch (e) {
  fail("Fetch request threw", e.message);
}

// ─── TEST 3: Browser (paid — skip if no credits) ────────────────────────────
console.log(bold("\n[3] TinyFish Browser — anti-bot bypass (paid, skip if no credits)"));
console.log(dim("    Skipping to preserve credits. Uncomment below to test."));
// Uncomment to test:
// try {
//   const res = await fetch(`${BASE}/browser`, {
//     method: "POST",
//     headers: { ...headers, "Content-Type": "application/json" },
//     body: JSON.stringify({ url: TEST_URL, extract: ["reviews", "rating", "price"] }),
//   });
//   const data = await res.json();
//   console.log("  Browser result:", JSON.stringify(data, null, 2).slice(0, 500));
// } catch (e) {
//   fail("Browser request threw", e.message);
// }

// ─── Summary ────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────");
console.log("Ask TinyFish rep:");
console.log("  • What search depth / ranking model do results use?");
console.log("  • Fetch rate limit on free tier? (docs say 25/min)");
console.log("  • Does Browser API handle Temu / AliExpress JS rendering?");
console.log("  • Is there a bulk/batch search endpoint?");
console.log("  • Webhook support for async fetches?\n");
