/**
 * Demo flow screenshot script for TrustLens
 * Usage: node scripts/take-screenshots.mjs
 * Requires: npx playwright install chromium (one-time setup)
 * Requires: dev server running on localhost:3000
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../docs/screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 };

async function shot(page, name) {
  await page.screenshot({
    path: join(OUT_DIR, `${name}.png`),
    fullPage: false,
  });
  console.log(`  ✓ ${name}.png`);
}

async function waitForResults(page) {
  // Wait for trust score dial or vendor card to appear in the results panel
  await page.locator('.rounded-2xl.p-4').first().waitFor({ timeout: 90000 });
  // Extra wait for all 3 cards to render
  await page.waitForTimeout(2500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  console.log("📸 TrustLens Screenshot Capture\n");

  // ── 01: Empty home screen ────────────────────────────────────────────────
  console.log("01 — Home (empty state)");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await shot(page, "01-home-empty");

  // ── 02: Typing in the chat ───────────────────────────────────────────────
  const CHAT_INPUT = 'input[placeholder*="Echo Dot"], input[placeholder*="headphones"], input:not([type="file"]):not([type="submit"]):not([type="hidden"])';
  console.log("02 — Typing search query");
  await page.click(CHAT_INPUT);
  await page.type(CHAT_INPUT, "Buy Sony WH-1000XM5 headphones", { delay: 30 });
  await shot(page, "02-typing-query");

  // ── 03: Analyzing state ──────────────────────────────────────────────────
  console.log("03 — Analyzing (spinner state)");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500); // catch mid-analysis
  await shot(page, "03-analyzing");

  // ── 04: Buy results ──────────────────────────────────────────────────────
  console.log("04 — Buy results (waiting for data)...");
  await waitForResults(page);
  await shot(page, "04-buy-results");

  // ── 05: Scroll results panel ─────────────────────────────────────────────
  console.log("05 — Results scrolled down");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await shot(page, "05-results-scrolled");

  // ── 06: Clear + Fix mode ─────────────────────────────────────────────────
  console.log("06 — Fix mode search");
  // Click Clear button
  const clearBtn = page.locator('button:has-text("Clear"), button[aria-label="Clear"]');
  if (await clearBtn.count() > 0) await clearBtn.first().click();
  else await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.click(CHAT_INPUT);
  await page.type(CHAT_INPUT, "Fix my iPhone 14 screen in San Francisco", { delay: 25 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  await shot(page, "06-fix-analyzing");

  console.log("   waiting for fix results...");
  await waitForResults(page);
  await shot(page, "07-fix-results");

  // ── 08: Temu URL paste ───────────────────────────────────────────────────
  console.log("08 — Temu URL paste (URL mode)");
  const clearBtn2 = page.locator('button:has-text("Clear"), button[aria-label="Clear"]');
  if (await clearBtn2.count() > 0) await clearBtn2.first().click();
  else await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.click(CHAT_INPUT);
  await page.type(
    CHAT_INPUT,
    "https://www.temu.com/goods.html?goods_id=601099516697673",
    { delay: 10 }
  );
  await shot(page, "08-temu-url-typed");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  await shot(page, "09-temu-analyzing");

  console.log("   waiting for Temu URL results...");
  await waitForResults(page);
  await shot(page, "10-temu-url-results");

  // ── 11: SMS modal ────────────────────────────────────────────────────────
  console.log("11 — SMS modal");
  const smsBtn = page.locator('button:has-text("Send"), button:has-text("SMS"), button:has-text("Phone")');
  if (await smsBtn.count() > 0) {
    await smsBtn.first().click();
    await page.waitForTimeout(800);
    await shot(page, "11-sms-modal");
    // Close modal
    await page.keyboard.press("Escape");
  } else {
    console.log("  ⚠ SMS button not found — skipping");
  }

  // ── 12: Legend modal ─────────────────────────────────────────────────────
  console.log("12 — Legend modal");
  const legendBtn = page.locator('button:has-text("?"), button:has-text("Legend"), button[aria-label*="legend" i]');
  if (await legendBtn.count() > 0) {
    await legendBtn.first().click();
    await page.waitForTimeout(800);
    await shot(page, "12-legend-modal");
    await page.keyboard.press("Escape");
  } else {
    console.log("  ⚠ Legend button not found — skipping");
  }

  await browser.close();

  console.log(`\n✅ All screenshots saved to docs/screenshots/`);
  console.log(`   Open the folder: start "" "${OUT_DIR}"`);
})().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
