/**
 * ZooWork / ZooData API Test Script
 * Run: node --env-file=.env.local scripts/test-zoowork.mjs
 *
 * ZooWork has TWO separate things to test:
 *   A) ZooData  — extract structured product data from a URL (what TrustLens needs)
 *   B) ZooWork agents — create sandboxed LLM agents (advanced, future use)
 *
 * NOTE: The .env.local has ZOOWORK_BASE_URL=https://clawapi.ecap.gsmo.ai/service/v1
 *       Docs say api.zoowork.ai but our .env says clawapi.ecap.gsmo.ai — test both.
 */

const KEY = process.env.ZOOWORK_API_KEY;
const BASE_ENV = process.env.ZOOWORK_BASE_URL ?? "https://clawapi.ecap.gsmo.ai/service/v1";
const BASE_DOCS = "https://api.zoowork.ai";

if (!KEY) {
  console.error("❌  ZOOWORK_API_KEY not found in .env.local");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;

function pass(label, detail = "") { console.log(`  ${green("✓")} ${label} ${dim(detail)}`); }
function fail(label, detail = "") { console.log(`  ${red("✗")} ${label} ${dim(detail)}`); }

// ─── TEST A1: ZooData via docs URL ──────────────────────────────────────────
console.log(bold("\n[A1] ZooData — extract product data (docs URL: api.zoowork.ai)"));
const AMAZON_URL = "https://www.amazon.com/Sony-WH1000XM5-Canceling-Headphones-Hands-Free/dp/B09XS7JWHH";
try {
  const t0 = Date.now();
  const res = await fetch(
    `${BASE_DOCS}/zoodata?url=${encodeURIComponent(AMAZON_URL)}`,
    { headers }
  );
  const ms = Date.now() - t0;

  if (!res.ok) {
    fail(`HTTP ${res.status} from ${BASE_DOCS}`, await res.text());
  } else {
    const data = await res.json();
    pass(`Response received`, `${ms}ms`);
    console.log(dim("    title:       ") + (data.title ?? "—"));
    console.log(dim("    price:       ") + (data.price ?? "—"));
    console.log(dim("    rating:      ") + (data.rating ?? "—"));
    console.log(dim("    review_count:") + (data.review_count ?? "—"));
    console.log(dim("    reviews[0]:  ") + (data.reviews?.[0]?.text?.slice(0, 80) ?? "no reviews"));
    console.log(dim("    claims:      ") + JSON.stringify(data.claims ?? []).slice(0, 100));
  }
} catch (e) {
  fail("ZooData (docs URL) threw", e.message);
}

// ─── TEST A2: ZooData via .env URL ──────────────────────────────────────────
console.log(bold(`\n[A2] ZooData — same call via .env URL: ${BASE_ENV}`));
try {
  const t0 = Date.now();
  const res = await fetch(
    `${BASE_ENV}/zoodata?url=${encodeURIComponent(AMAZON_URL)}`,
    { headers }
  );
  const ms = Date.now() - t0;

  if (!res.ok) {
    fail(`HTTP ${res.status}`, await res.text());
  } else {
    const data = await res.json();
    pass(`Response received`, `${ms}ms · title: ${data.title ?? "—"}`);
  }
} catch (e) {
  fail(".env URL threw", e.message);
}

// ─── TEST B1: ZooWork agents — list models ──────────────────────────────────
console.log(bold("\n[B1] ZooWork Agents — list available models (.env URL)"));
try {
  const t0 = Date.now();
  const res = await fetch(`${BASE_ENV}/models`, { headers });
  const ms = Date.now() - t0;

  if (!res.ok) {
    fail(`HTTP ${res.status}`, await res.text());
  } else {
    const data = await res.json();
    const models = data.data ?? data.models ?? data ?? [];
    pass(`${Array.isArray(models) ? models.length : "?"} models listed`, `${ms}ms`);
    const list = Array.isArray(models) ? models.slice(0, 5) : [];
    list.forEach((m) => console.log(dim(`     • ${m.id ?? m.name ?? JSON.stringify(m)}`)));
  }
} catch (e) {
  fail("List models threw", e.message);
}

// ─── TEST B2: ZooWork agents — create a simple agent ────────────────────────
console.log(bold("\n[B2] ZooWork Agents — create a test agent (.env URL)"));
try {
  const t0 = Date.now();
  const res = await fetch(`${BASE_ENV}/agents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "TrustLens-Test",
      description: "Test agent for TrustLens hackathon",
      model: "claude-3-5-sonnet-20241022", // adjust to what list-models returns
      system_prompt: "You analyze vendor trustworthiness. Return JSON only.",
      max_iterations: 1,
    }),
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    fail(`HTTP ${res.status}`, (await res.text()).slice(0, 200));
  } else {
    const data = await res.json();
    pass(`Agent created`, `${ms}ms · id: ${data.id ?? data.agent_id ?? "—"}`);
    console.log(dim("     Full response: " + JSON.stringify(data).slice(0, 200)));
  }
} catch (e) {
  fail("Create agent threw", e.message);
}

// ─── TEST C: Temu/AliExpress URL with ZooData ───────────────────────────────
console.log(bold("\n[C] ZooData with Temu URL (the one user tested)"));
const TEMU_URL =
  "https://www.temu.com/-heavy-duty-tire-wheel-brush-with-long-handle-non-scratch-deep-cleaning-car-tires-plush-bristles-for-wheel-rims-hubcaps-alloy-mag-wheel--auto-detailing-tool-garage-use-durable-car-washing-brush-ergonomic-g-601104358416832.html";
try {
  const t0 = Date.now();
  const res = await fetch(
    `${BASE_DOCS}/zoodata?url=${encodeURIComponent(TEMU_URL)}`,
    { headers }
  );
  const ms = Date.now() - t0;

  if (!res.ok) {
    fail(`HTTP ${res.status}`, (await res.text()).slice(0, 200));
  } else {
    const data = await res.json();
    pass(`Temu extraction worked`, `${ms}ms`);
    console.log(dim("    title:   ") + (data.title ?? "—"));
    console.log(dim("    price:   ") + (data.price ?? "—"));
    console.log(dim("    reviews: ") + (data.review_count ?? 0));
  }
} catch (e) {
  fail("Temu ZooData threw", e.message);
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────");
console.log("Ask ZooWork rep:");
console.log("  • Is the correct base URL api.zoowork.ai or clawapi.ecap.gsmo.ai?");
console.log("  • Does ZooData support Temu, AliExpress, Shein URLs?");
console.log("  • What fields are guaranteed in the response schema?");
console.log("  • Free tier rate limit for ZooData calls?");
console.log("  • For agents: what model IDs are available and what are the costs?");
console.log("  • Can agents make external HTTP calls (e.g., call Tavily from inside)?");
console.log("  • Is there a webhook/callback for long-running agent tasks?\n");
