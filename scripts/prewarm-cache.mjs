/**
 * Pre-warms the TrustLens pipeline cache for the demo.
 * Run BEFORE record-demo.mjs — cache TTL is 30 minutes.
 * Covers every suggestion chip so the recording plays back instantly.
 *
 * Run: node --env-file=.env.local scripts/prewarm-cache.mjs
 */

const BASE = process.env.APP_URL || "http://localhost:3000";

const G   = (s) => `\x1b[32m${s}\x1b[0m`;
const R   = (s) => `\x1b[31m${s}\x1b[0m`;
const Y   = (s) => `\x1b[33m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const B   = (s) => `\x1b[1m${s}\x1b[0m`;
const C   = (s) => `\x1b[36m${s}\x1b[0m`;

// ── All queries to pre-warm ───────────────────────────────────────────────────
// These must exactly match what the UI sends when a chip is clicked or text is typed.

const QUERIES = [
  // === DEMO VIDEO QUERIES (must match record-demo.mjs exactly) ===
  {
    label: "DEMO Scene 2 — Echo Dot (typed)",
    message: "I want to buy Amazon Echo Dot 5th Gen",
    group: "demo",
  },
  {
    label: "DEMO Scene 4 — Temu AirPods AVOID",
    message: "AirPods Pro $39 https://www.temu.com/goods.html?goods_id=601099512468617",
    group: "demo",
  },

  // === SUGGESTION CHIPS ===
  { label: "Echo Dot chip",             message: "I want to buy an Echo Dot 5th Gen",         group: "chips" },
  { label: "Fix iPhone",               message: "Fix my iPhone 14 screen",                     group: "chips" },
  { label: "Sony WH-1000XM5",          message: "Best place to buy Sony WH-1000XM5?",          group: "chips" },
  { label: "Galaxy Watch 7",           message: "Samsung Galaxy Watch 7 buy online",            group: "chips" },
  { label: "MacBook repair",           message: "MacBook Pro repair near me",                   group: "chips" },
  { label: "DJI Mini 4 Pro",           message: "Where to buy DJI Mini 4 Pro drone?",          group: "chips" },

  // === DEMO IMAGE CHIPS ===
  { label: "Image chip — Echo Dot",    message: "Amazon Echo Dot 5th Gen",                     group: "images" },
  { label: "Image chip — iPhone 15",   message: "iPhone 15 Pro",                               group: "images" },
  { label: "Image chip — Headphones",  message: "Sony WH-1000XM5 headphones",                  group: "images" },
  { label: "Image chip — Galaxy Watch",message: "Samsung Galaxy Watch 7",                       group: "images" },

  // === HIDDEN GEM DEMOS ===
  { label: "USB-C hub gem",            message: "Buy USB-C hub for MacBook Pro",               group: "gems" },
  { label: "Anker charger gem",        message: "Buy Anker portable charger 20000mAh",         group: "gems" },
  { label: "Keychron keyboard gem",    message: "Buy Keychron mechanical keyboard",            group: "gems" },

  // === AVOID DEMOS ===
  { label: "Temu AirPods chip",        message: "AirPods Pro $39 https://www.temu.com/goods.html?goods_id=601099512468617", group: "avoid" },
  { label: "Fake Rolex chip",          message: "Cheap Rolex watches authentic free shipping", group: "avoid" },
];

async function consumeStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

function extractResults(raw) {
  const vendors = [];
  const matches = raw.matchAll(/"trustScore":(\d+),"verdict":"([^"]+)"/g);
  for (const m of matches) {
    vendors.push(`${m[1]}/${m[2]}`);
  }
  return vendors.slice(0, 3).join(", ") || "no scores found";
}

async function warmQuery({ label, message }) {
  const t0 = Date.now();
  process.stdout.write(`  ${Y("○")} ${label.padEnd(42)} `);

  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: message }] }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      process.stdout.write(`${Y("SKIP")} HTTP ${res.status}\n`);
      return false;
    }

    const raw = await consumeStream(res);
    const ms = Date.now() - t0;
    const scores = extractResults(raw);
    const fromCache = ms < 3000;
    process.stdout.write(`${G("✓")} ${DIM(`${(ms / 1000).toFixed(1)}s`)}${fromCache ? DIM(" [cache]") : ""} — ${DIM(scores)}\n`);
    return true;
  } catch (e) {
    process.stdout.write(`${R("ERR")} ${e.message.slice(0, 60)}\n`);
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(B("\n=== TrustLens Cache Pre-warm ==="));
console.log(DIM(`  Target: ${BASE}   TTL: 30 min   Queries: ${QUERIES.length}\n`));

const groups = [...new Set(QUERIES.map(q => q.group))];
let passed = 0, failed = 0;

for (const group of groups) {
  const groupQueries = QUERIES.filter(q => q.group === group);
  console.log(C(`\n  [${group.toUpperCase()}]`));
  for (const q of groupQueries) {
    const ok = await warmQuery(q);
    if (ok) passed++; else failed++;
  }
}

console.log(B(`\n  Done: ${passed} warmed, ${failed} failed`));
if (failed === 0) {
  console.log(G("  All queries cached — safe to record for 30 minutes.\n"));
} else {
  console.log(Y(`  ${failed} queries failed — check API keys or app is running.\n`));
}
