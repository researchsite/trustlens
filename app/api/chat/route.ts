import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { runTrustPipeline } from "@/lib/pipeline";

export const maxDuration = 120;

const nebius = createOpenAI({
  baseURL: process.env.NEBIUS_BASE_URL || "https://api.studio.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY!,
});

const SYSTEM_PROMPT = `You are TrustLens — an AI that scores vendor trustworthiness.

When a user names a product, describes what they want to buy/fix, OR pastes a product URL: IMMEDIATELY call analyzeTrust. No clarification needed first.

━━ URL DETECTION ━━
If the message contains a product URL (Temu, AliExpress, Amazon, Walmart, Wish, Shein, eBay, or any e-commerce URL):
1. Extract the product name from the URL path slug (e.g., "heavy-duty-tire-wheel-brush-with-long-handle" → "Heavy Duty Tire Wheel Brush")
2. Pass productName = the clean extracted name
3. Pass originalUrl = the FULL original URL exactly as the user pasted it
4. Set mode = "buy"
The pipeline will SCORE THE ORIGINAL VENDOR so the user sees why it's bad, PLUS find 2 trusted alternatives.

━━ MODE DETECTION (evaluate fresh from each message) ━━
- "buy", "purchase", "get", "order", "where to buy", "best price", or any shopping URL → mode: buy
- "fix", "repair", "broken", "cracked", "service" → mode: fix

━━ DEFAULT CITY ━━
Fix mode default: city="San Francisco, CA" (event at 122 Riley Ave, 94129) unless user specifies otherwise.

━━ AFTER RESULTS ━━
When analyzeTrust returns with an originalUrl (URL was pasted):
  Write exactly 2 sentences:
  1. Why the original vendor scored low — mention its score, verdict, and the key reason (e.g., fabricated claims, high AI review ratio).
  2. A short intro to the alternatives found and which is the top pick.
  Example: "The Temu listing scores 23/100 (AVOID) — 71% AI-generated reviews and 3 fabricated claims. Amazon scores 81 as the best alternative."

For all other queries: one short sentence (max 30 words) highlighting the top pick's name and score.

NEVER make up scores. ALWAYS call analyzeTrust for real data.`;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMsg = messages[messages.length - 1];
  console.log(`[chat] POST — ${messages.length} msg(s), last: "${String(lastMsg?.content ?? "").slice(0, 80)}"`);

  const result = streamText({
    model: nebius(process.env.NEBIUS_MODEL || "Qwen/Qwen3-30B-A3B-Instruct-2507"),
    system: SYSTEM_PROMPT,
    messages,
    maxSteps: 5,
    tools: {
      analyzeTrust: tool({
        description:
          "Analyze and score vendors. When originalUrl is provided: scores that specific vendor AND finds trusted alternatives. Always call this immediately when user names a product or pastes a URL.",
        parameters: z.object({
          productName: z.string().describe("Clean product name (extracted from URL path if URL was pasted)"),
          mode: z.enum(["buy", "fix"]).describe("buy = find sellers, fix = find repair shops"),
          city: z.string().optional().describe("City for fix mode"),
          originalUrl: z.string().optional().describe("Full original URL if user pasted one — pipeline scores this vendor AND finds alternatives"),
        }),
        execute: async ({ productName, mode, city, originalUrl }) => {
          return await runTrustPipeline({ productName, mode, city, originalUrl });
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
