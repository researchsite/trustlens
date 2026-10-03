/**
 * ZooWork Vision Test
 * Run: node --env-file=.env.local scripts/test-zoowork-vision.mjs
 *
 * ZooWork provides vision models that route through Novita.
 * This script finds the working endpoint + model for image analysis.
 *
 * Add your ZooWork inference key to .env.local:
 *   ZOOWORK_API_KEY=<your key>
 */

const KEY = process.env.ZOOWORK_API_KEY ?? "";
const BASE = "https://clawapi.ecap.gsmo.ai/service/v1";

if (!KEY || KEY.startsWith("hms_")) {
  console.error("Set ZOOWORK_API_KEY in .env.local (the ZooWork inference/chat key, not the hms_ ZooData key)");
  process.exit(1);
}

const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;

// A tiny 1×1 red pixel PNG as base64 — just to test image acceptance
const TINY_IMAGE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

async function tryChat(label, url, body) {
  try {
    const t0 = Date.now();
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const ms = Date.now() - t0;
    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    const content = parsed?.choices?.[0]?.message?.content
      ?? parsed?.content?.[0]?.text
      ?? parsed?.message
      ?? parsed?.error?.message
      ?? text.slice(0, 120);

    if (r.ok && (parsed?.choices || parsed?.content)) {
      console.log(`  ${green("✓")} ${label} ${dim(`${ms}ms`)}`);
      console.log(dim(`    → "${content?.slice(0, 80)}"`));
      return true;
    } else {
      console.log(`  ${red("✗")} ${label} ${dim(`HTTP ${r.status}`)}`);
      console.log(dim(`    → ${content?.slice(0, 120)}`));
      return false;
    }
  } catch (e) {
    console.log(`  ${red("✗")} ${label} ${dim(e.message)}`);
    return false;
  }
}

console.log(bold("\n=== ZooWork Vision Tests ==="));
console.log(dim(`Key: ${KEY.slice(0, 20)}...`));
console.log(dim(`Base: ${BASE}\n`));

// ── Models that support images on ZooWork ────────────────────────────────────
const IMAGE_MODELS = [
  { model: "litellm/claude-haiku-4-5",       api: "anthropic-messages" },
  { model: "litellm/claude-sonnet-4-6",      api: "anthropic-messages" },
  { model: "litellm/gemini-3.8-flash",       api: "google-vertex"      },
  { model: "litellm/gemini-3.1-flash-lite",  api: "google-vertex"      },
  { model: "litellm/glm-5.3-flash",          api: "openai-completions" },
];

// ── Text-only ping first — confirms endpoint + key are working ───────────────
console.log(bold("[1] Text ping — confirm endpoint + key work"));
const textBody = {
  model: "litellm/claude-haiku-4-5",
  messages: [{ role: "user", content: "Reply with the single word: WORKING" }],
  max_tokens: 10,
};
const textWorked = await tryChat(
  "POST /v1/chat/completions (text)",
  `${BASE}/v1/chat/completions`,
  textBody
);

if (!textWorked) {
  // Try without the /service/v1 prefix
  console.log(dim("  → trying without /service/v1 prefix..."));
  const alt = await tryChat(
    "POST /chat/completions (root)",
    `https://clawapi.ecap.gsmo.ai/chat/completions`,
    textBody
  );
  if (!alt) {
    console.log(red("\n❌ No chat endpoint found. Ask ZooWork rep for the correct inference URL."));
    console.log(dim("   Key format: " + KEY.slice(0, 6) + "..."));
    process.exit(1);
  }
}

// ── Vision tests — try image-capable models ──────────────────────────────────
console.log(bold("\n[2] Vision — image + text input"));
const imageContent = [
  { type: "text", text: "What colour is this image? One word answer." },
  { type: "image_url", image_url: { url: `data:image/png;base64,${TINY_IMAGE_B64}` } },
];

for (const { model, api } of IMAGE_MODELS) {
  console.log(bold(`\n  Model: ${model} (${api})`));

  // OpenAI-compatible format (works for openai-completions + anthropic via litellm)
  const oaiBody = { model, messages: [{ role: "user", content: imageContent }], max_tokens: 20 };
  const worked = await tryChat(`${model} — OpenAI format`, `${BASE}/v1/chat/completions`, oaiBody);

  if (worked) {
    console.log(green(`\n  ✅ WORKING MODEL FOUND: ${model}`));
    console.log(green(`     Use this in .env.local:`));
    console.log(green(`     ZOOWORK_VISION_MODEL=${model}`));
    break;
  }
}

// ── What to tell the rep ──────────────────────────────────────────────────────
console.log(bold("\n─────────────────────────────────────────"));
console.log("Ask ZooWork rep:");
console.log("  • Which model should we use for product image identification?");
console.log("  • What is the correct inference endpoint URL?");
console.log("  • Is the key format zct_xxx, zwp_live_xxx, or something else?");
console.log("  • Does Novita vision route through /v1/chat/completions or a separate endpoint?");
