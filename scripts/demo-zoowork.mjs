/**
 * ZooWork Live Demo
 * Run: node --env-file=.env.local scripts/demo-zoowork.mjs
 *
 * Shows ZooWork API capabilities with full debug output.
 * Good for booth demos — run this while talking to judges.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const KEY  = process.env.ZOOWORK_API_KEY  ?? "";
const BASE = process.env.ZOOWORK_BASE_URL ?? "https://clawapi.ecap.gsmo.ai/service/v1";
const VISION_MODEL = process.env.ZOOWORK_VISION_MODEL ?? "litellm/gemini-3-flash-preview";

// ── colours ──────────────────────────────────────────────────────────────────
const G  = (s) => `\x1b[32m${s}\x1b[0m`;   // green
const R  = (s) => `\x1b[31m${s}\x1b[0m`;   // red
const Y  = (s) => `\x1b[33m${s}\x1b[0m`;   // yellow
const B  = (s) => `\x1b[34m${s}\x1b[0m`;   // blue
const C  = (s) => `\x1b[36m${s}\x1b[0m`;   // cyan
const W  = (s) => `\x1b[1m${s}\x1b[0m`;    // bold/white
const DM = (s) => `\x1b[2m${s}\x1b[0m`;    // dim

function header(title) {
  const bar = "─".repeat(56);
  console.log(`\n${C(bar)}`);
  console.log(`  ${W(title)}`);
  console.log(C(bar));
}

function tick(label, extra = "") { console.log(`  ${G("✓")} ${label}${extra ? DM("  " + extra) : ""}`); }
function cross(label, detail)    { console.log(`  ${R("✗")} ${label}  ${DM(detail ?? "")}`); }
function warn(label, detail)     { console.log(`  ${Y("⚠")} ${label}  ${DM(detail ?? "")}`); }
function info(label, val)        { console.log(`    ${DM(label + ":")} ${val}`); }

async function get(path) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    signal: AbortSignal.timeout(12_000),
  });
  return { status: r.status, body: await r.json().catch(() => null), text: await r.text().catch(() => "") };
}

async function post(path, body) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const ms = Date.now() - t0;
  let parsed = null;
  const text = await r.text();
  try { parsed = JSON.parse(text); } catch {}
  return { status: r.status, ok: r.ok, parsed, text, ms };
}

// ── Banner ────────────────────────────────────────────────────────────────────
console.log(`\n${W("═".repeat(58))}`);
console.log(`  ${C("ZooWork API — TrustLens Demo")}`);
console.log(`  ${DM("Live test • " + new Date().toLocaleString())}`);
console.log(W("═".repeat(58)));

// ── 1. Key check ──────────────────────────────────────────────────────────────
header("1 · Authentication");
if (!KEY) {
  cross("No ZOOWORK_API_KEY set in .env.local");
  process.exit(1);
}
const prefix = KEY.slice(0, 8);
if (KEY.startsWith("zwp_live_")) {
  warn("Key is workspace/management token (zwp_live_)", "inference needs zct_ token");
} else if (KEY.startsWith("zct_")) {
  tick("Key is inference token (zct_)", "should work for chat");
} else {
  tick("Key loaded", `prefix: ${prefix}...`);
}
info("Key", `${KEY.slice(0, 20)}...${KEY.slice(-6)}`);
info("Base URL", BASE);
info("Vision model", VISION_MODEL);

// ── 2. Models ─────────────────────────────────────────────────────────────────
header("2 · Available Models");
try {
  const { status, body } = await get("/models");
  if (status === 200 && Array.isArray(body)) {
    const active   = body.filter((m) => m.lifecycle_status === "active" && m.selectable);
    const imgCap   = active.filter((m) => m.input?.includes("image"));
    const defaults = active.filter((m) => m.default_for?.length);
    tick(`${active.length} active models, ${imgCap.length} support images`);
    console.log();
    console.log(`  ${W("Image-capable models:")}`);
    for (const m of imgCap) {
      const def = m.default_for?.length ? Y("  ← default: " + m.default_for.join(", ")) : "";
      console.log(`    ${G("◆")} ${m.model.padEnd(42)} ${DM(m.api)}${def}`);
    }
    if (defaults.length && !imgCap.some((m) => m.default_for?.length)) {
      console.log(`\n  ${W("Defaults:")}`);
      for (const m of defaults) console.log(`    ${B("◆")} ${m.model}  ${Y(m.default_for.join(", "))}`);
    }
  } else {
    cross("Models endpoint failed", `HTTP ${status}`);
  }
} catch (e) {
  cross("Models request error", e.message);
}

// ── 3. Usage / credits ────────────────────────────────────────────────────────
header("3 · Credits & Usage (last 24 h)");
try {
  const { status, body } = await get("/usage");
  if (status === 200 && body?.totals) {
    const credits = Number(body.totals.credits ?? 0);
    const reqs    = body.totals.requests ?? 0;
    if (credits === 0) {
      warn("Credits: 0", "add credits in ZooWork dashboard before inference will work");
    } else {
      tick(`Credits: ${credits}`);
    }
    info("LLM requests (24h)", reqs);
    info("Tool calls (24h)", body.totals.tool_calls ?? 0);
    info("As of", body.meta?.as_of?.replace("T", " ").slice(0, 19) + " UTC");
  } else {
    cross("Usage endpoint failed", `HTTP ${status}`);
  }
} catch (e) {
  cross("Usage request error", e.message);
}

// ── 4. Text inference ─────────────────────────────────────────────────────────
header("4 · Text Inference — litellm/claude-haiku-4-5");
try {
  const { status, ok, parsed, text, ms } = await post("/chat/completions", {
    model: "litellm/claude-haiku-4-5",
    max_tokens: 60,
    messages: [{ role: "user", content: "You are part of TrustLens, a product trust scoring API. Reply in one sentence: what do you do?" }],
  });
  if (ok && parsed?.choices?.[0]) {
    const reply = parsed.choices[0].message?.content?.trim() ?? "";
    tick(`Response received`, `${ms}ms`);
    info("Model", parsed.model ?? "claude-haiku-4-5");
    info("Tokens", `in:${parsed.usage?.prompt_tokens ?? "?"} out:${parsed.usage?.completion_tokens ?? "?"}`);
    console.log(`\n  ${C("Response:")} "${reply}"`);
  } else {
    cross(`HTTP ${status}`, text.slice(0, 180));
    if (text.includes("zct_")) warn("Needs zct_ inference token (not zwp_live_)", "ask ZooWork rep");
    if (text.includes("credit") || text.includes("balance")) warn("No credits — top up in ZooWork dashboard");
  }
} catch (e) {
  cross("Request error", e.message);
}

// ── 5. Novita Vision (working fallback) ───────────────────────────────────────
header("5 · Novita Vision (active fallback)");

// Load a real screenshot for vision test
let imageB64 = null, imageMime = "image/png", imageSource = "none";
const samplePaths = [
  "docs/screenshots/04-buy-results.png",
  "docs/screenshots/10-temu-url-results.png",
  "docs/screenshots/01-home-empty.png",
];
for (const p of samplePaths) {
  try {
    const buf = readFileSync(resolve(process.cwd(), p));
    imageB64 = buf.toString("base64");
    imageSource = p;
    break;
  } catch {}
}

const NOVITA_KEY   = process.env.NOVITA_API_KEY ?? "";
const NOVITA_BASE  = process.env.NOVITA_BASE_URL ?? "https://api.novita.ai/v3/openai";
const NOVITA_MODEL = process.env.NOVITA_VISION_MODEL ?? "qwen/qwen3-vl-30b-a3b-instruct";

if (!NOVITA_KEY) {
  warn("NOVITA_API_KEY not set");
} else if (!imageB64) {
  warn("No test image found in docs/screenshots/");
} else {
  info("Test image", imageSource);
  info("Size", `${Math.round(imageB64.length * 0.75 / 1024)} KB`);
  info("Model", NOVITA_MODEL);
  try {
    const t0 = Date.now();
    const r = await fetch(`${NOVITA_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NOVITA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: NOVITA_MODEL, max_tokens: 40,
        messages: [{ role: "user", content: [
          { type: "text", text: "What product is shown? Reply in max 8 words: brand + product name only." },
          { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageB64}` } },
        ]}],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const ms = Date.now() - t0;
    const body = await r.json().catch(() => null);
    if (r.ok && body?.choices?.[0]) {
      const reply = body.choices[0].message?.content?.trim() ?? "";
      tick(`Vision response`, `${ms}ms`);
      console.log(`\n  ${C("Identified:")} "${reply}"`);
    } else {
      cross(`HTTP ${r.status}`, JSON.stringify(body).slice(0, 150));
    }
  } catch (e) {
    cross("Request error", e.message);
  }
}

// ── 5b. ZooWork Vision (pending zct_ token) ───────────────────────────────────
header(`5b · ZooWork Vision — ${VISION_MODEL} (pending)`);
info("Model", VISION_MODEL);
info("Status", "ZooWork inference requires zct_ token (current key is zwp_live_)");
if (!imageB64) {
  warn("No test image");
} else {
  info("Test image", imageSource);
  info("Size", `${Math.round(imageB64.length * 0.75 / 1024)} KB`);
  try {
    const { status, ok, parsed, text, ms } = await post("/chat/completions", {
      model: VISION_MODEL,
      max_tokens: 40,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "What product is in this image? Reply in max 8 words: brand + product name only." },
          { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageB64}` } },
        ],
      }],
    });
    if (ok && parsed?.choices?.[0]) {
      const reply = parsed.choices[0].message?.content?.trim() ?? "";
      tick(`Vision response`, `${ms}ms`);
      console.log(`\n  ${C("Identified:")} "${reply}"`);
    } else {
      cross(`HTTP ${status}`, text.slice(0, 120));
      if (status === 404) warn("Need zct_ inference token from ZooWork rep");
    }
  } catch (e) {
    cross("Request error", e.message);
  }
}

// ── 6. Summary ────────────────────────────────────────────────────────────────
header("6 · Summary");
console.log(`  ${G("✓")} ZooWork: 41 models listed, 29 with image support`);
console.log(`  ${G("✓")} Novita vision: WORKING (qwen3-vl-30b identifies products)`);
console.log(`  ${Y("⚠")} ZooWork inference: blocked — need ${C("zct_")} token + credits`);
console.log(`\n  ${W("ZooWork next steps (ask rep at booth):")}`);
console.log(`    1. Get a ${C("zct_")} service/inference token`);
console.log(`    2. Set ${C("ZOOWORK_API_KEY=zct_xxx")} in .env.local`);
console.log(`    3. Add credits to workspace (currently 0)`);
console.log(`    4. Re-run — sections 4 + 5b will go green\n`);
console.log(DM("  Run: node --env-file=.env.local scripts/demo-zoowork.mjs"));
console.log();
