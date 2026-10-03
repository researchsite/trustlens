/**
 * TrustLens Demo Recorder — waits for each page state before continuing.
 * Run: node --env-file=.env.local scripts/record-demo.mjs
 * Output: _private/video/demo-raw.webm
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readdirSync, renameSync } from "fs";
import { resolve } from "path";

const OUT_DIR = resolve(process.cwd(), "_private/video");
mkdirSync(OUT_DIR, { recursive: true });

const APP_URL = "http://localhost:3000";

// ── Helpers ───────────────────────────────────────────────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Type character by character so it looks human on screen
async function typeSlowly(locator, text, delayMs = 60) {
  await locator.click();
  await locator.fill(""); // clear first
  for (const char of text) {
    await locator.pressSequentially(char, { delay: delayMs });
  }
}

// Inject a caption overlay at the bottom of the viewport
async function caption(page, text, holdMs = 0) {
  await page.evaluate((msg) => {
    const el = document.getElementById("tl-cap") ?? (() => {
      const d = document.createElement("div");
      d.id = "tl-cap";
      d.style.cssText = [
        "position:fixed", "bottom:28px", "left:50%", "transform:translateX(-50%)",
        "background:rgba(0,0,0,0.85)", "color:#fff", "padding:13px 26px",
        "border-radius:40px", "font:600 17px/1.4 -apple-system,sans-serif",
        "z-index:99999", "max-width:78%", "text-align:center",
        "border:1px solid rgba(255,255,255,0.14)", "backdrop-filter:blur(6px)",
        "pointer-events:none"
      ].join(";");
      document.body.appendChild(d);
      return d;
    })();
    el.textContent = msg;
    el.style.display = "block";
  }, text);
  if (holdMs > 0) await wait(holdMs);
}

async function hideCaption(page) {
  await page.evaluate(() => {
    const el = document.getElementById("tl-cap");
    if (el) el.style.display = "none";
  });
}

// Wait for the status header to show "Analyzing…"
async function waitForAnalyzing(page) {
  await page.waitForFunction(
    () => document.querySelector("span.uppercase.tracking-wider")
           ?.textContent?.includes("Analyzing"),
    { timeout: 12_000 }
  ).catch(() => console.log("  (analyzing state not detected — continuing)"));
}

// Wait for the status header to return to "TrustLens" (analysis done)
// With cache warm: typically 2-5s. Without: up to 60s.
async function waitForDone(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector("span.uppercase.tracking-wider");
      return el && !el.textContent?.includes("Analyzing");
    },
    { timeout: 20_000 }
  ).catch(async () => {
    // If still loading after 20s, wait longer (cache miss)
    console.log("  (still loading after 20s — waiting up to 90s for live response)");
    await page.waitForFunction(
      () => {
        const el = document.querySelector("span.uppercase.tracking-wider");
        return el && !el.textContent?.includes("Analyzing");
      },
      { timeout: 90_000 }
    );
  });
  // Also wait until the score number is visible in the chat ResultPreviewCard
  await page.waitForSelector(".text-2xl.font-black.tabular-nums", { timeout: 10_000 })
    .catch(() => {});
  await wait(1200); // let animations settle
}

// Wait for the right-panel results heading
async function waitForResultsPanel(page) {
  await page.waitForFunction(
    () => document.querySelector("h2")?.textContent?.includes("vendor"),
    { timeout: 10_000 }
  ).catch(() => {});
  await wait(800);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
console.log("\n  TrustLens Demo Recorder");
console.log("  Output:", OUT_DIR);

const browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

// Input & submit selectors (from actual ChatPanel.tsx)
const INPUT_SEL  = 'input[placeholder*="Echo Dot"]';
const SUBMIT_SEL = 'button[type="submit"]';

// ── SCENE 1  (0–14s): Opening ─────────────────────────────────────────────────
console.log("\n[Scene 1] Loading app…");
await page.goto(APP_URL, { waitUntil: "networkidle" });
await wait(1000);

await caption(page, "Every time you buy online — you're trusting a stranger.", 4500);
await caption(page, "Are those reviews real? Is this seller legitimate? Are the specs accurate?", 4500);
await caption(page, "TrustLens answers all three. In seconds.", 3500);
await hideCaption(page);
await wait(600);

// ── SCENE 2  (14–55s): Echo Dot search ───────────────────────────────────────
console.log("[Scene 2] Searching Echo Dot…");
await caption(page, "Let me search for: Amazon Echo Dot 5th Gen", 2800);

const input = page.locator(INPUT_SEL);
await input.waitFor({ timeout: 5000 });
await typeSlowly(input, "I want to buy Amazon Echo Dot 5th Gen", 55);
await wait(400);

await caption(page, "Searching vendors… fetching real review data… scoring with Qwen3 AI…", 0);
await page.locator(SUBMIT_SEL).click();

console.log("  Waiting for analysis to start…");
await waitForAnalyzing(page);
console.log("  Analyzing — waiting for results…");
await waitForDone(page);
console.log("  Results ready.");
await hideCaption(page);
await wait(800);

// ── SCENE 3  (55–90s): Walk through results ───────────────────────────────────
console.log("[Scene 3] Walking results…");
await waitForResultsPanel(page);

await caption(page, "Results in. PriceRunner scores 75 — Trusted. Real vendor data, consistent pricing, no exaggerated claims.", 5500);

// Scroll right panel to show more vendors
const rightPanel = page.locator("div.overflow-y-auto.p-6").first();
await rightPanel.evaluate((el) => el.scrollBy(0, 220));
await wait(600);
await caption(page, "Best Buy scores 70 — Trusted. Authorized reseller, specs all verified.", 4500);

await rightPanel.evaluate((el) => el.scrollBy(0, 220));
await wait(600);
await caption(page, "Second Best Buy listing: 55 — Caution. TrustLens flags mixed signals — worth double-checking.", 4500);

await rightPanel.evaluate((el) => el.scrollTo(0, 0));
await hideCaption(page);
await wait(600);

// ── SCENE 4  (90–130s): AVOID demo — Temu AirPods listing ────────────────────
console.log("[Scene 4] AVOID demo — Temu URL…");

// Clear chat
await page.locator('button:has-text("Clear")').click();
await wait(1200);

await caption(page, "Now let's try this $39 AirPods Pro deal I found on Temu…", 3200);

// Click the built-in AVOID chip — exact label must match ChatPanel.tsx AVOID_DEMOS
const avoidChip = page.locator('button').filter({ hasText: "AirPods Pro $39 — is this Temu deal real?" });
await avoidChip.waitFor({ timeout: 5000 });
await avoidChip.click();

await caption(page, "Checking the Temu listing… scraping product data… scoring vendor claims…", 0);

console.log("  Waiting for Temu AVOID analysis…");
await waitForAnalyzing(page);
await waitForDone(page);
console.log("  Temu results ready.");
await hideCaption(page);
await wait(800);

await waitForResultsPanel(page);
await caption(page, "Score 45 — Caution. This Temu listing is actually a cheap headphone case, not real AirPods. 85% of reviews are AI-generated. TrustLens shows Amazon and Swappa as safe alternatives.", 6000);
await hideCaption(page);
await wait(600);

// ── SCENE 5  (130–150s): SMS ──────────────────────────────────────────────────
console.log("[Scene 5] SMS demo…");
await caption(page, "Want to share the score with someone shopping on their phone?", 3500);

// Scroll to bottom of results to find "Send results to phone" button
await rightPanel.evaluate((el) => el.scrollTo(0, 99999));
await wait(600);

const smsBtn = page.locator('button:has-text("Send results to phone")');
await smsBtn.waitFor({ timeout: 6000 }).catch(() => {});
await smsBtn.click().catch(() => console.log("  (SMS button not found — continuing)"));
await wait(800);

await caption(page, "One tap. Full trust score delivered by SMS — no app, no account needed.", 4500);
await hideCaption(page);
await wait(800);

// Close SMS input
await page.keyboard.press("Escape");
await wait(500);

// ── SCENE 6  (150–165s): Close ────────────────────────────────────────────────
console.log("[Scene 6] Closing credits…");
await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
await wait(800);
await caption(page, "Built with: ZooWork · ZooData · Nebius · Novita · Tavily · Twilio · Next.js 15", 4500);
await caption(page, "TrustLens — Know who you're buying from, before you pay.", 5000);
await hideCaption(page);
await wait(1200);

// ── Finish ────────────────────────────────────────────────────────────────────
console.log("\n  Closing browser…");
await context.close();
await browser.close();

// Rename the auto-named webm
const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webm") && f !== "demo-raw.webm");
if (files.length) {
  renameSync(resolve(OUT_DIR, files[0]), resolve(OUT_DIR, "demo-raw.webm"));
}

console.log("  Video: _private/video/demo-raw.webm");
console.log("  Next:  .\\scripts\\make-video.ps1 -SkipNarration   (if narration already exists)");
console.log("         .\\scripts\\make-video.ps1                   (to regenerate everything)");
