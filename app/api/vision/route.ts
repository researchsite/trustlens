export const runtime = "nodejs";
export const maxDuration = 30;

const ZOOWORK_LLM_KEY = process.env.ZOOWORK_API_KEY ?? "";
const ZOOWORK_BASE = process.env.ZOOWORK_BASE_URL ?? "https://clawapi.ecap.gsmo.ai/service/v1";
const ZOOWORK_VISION_MODEL = process.env.ZOOWORK_VISION_MODEL ?? "litellm/claude-haiku-4-5";

const NOVITA_KEY = process.env.NOVITA_API_KEY ?? "";
const NOVITA_BASE = process.env.NOVITA_BASE_URL ?? "https://api.novita.ai/v3/openai";
const NOVITA_MODEL = process.env.NOVITA_VISION_MODEL ?? "qwen/qwen3-vl-30b-a3b-instruct";

const VISION_PROMPT =
  "What product is shown in this image? Return ONLY the product name and brand, max 8 words. Example: 'Sony WH-1000XM5 headphones' or 'Amazon Echo Dot 5th Gen'";

function buildMessages(imageBase64: string, mimeType: string) {
  return [
    {
      role: "user",
      content: [
        { type: "text", text: VISION_PROMPT },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      ],
    },
  ];
}

async function callVision(
  baseURL: string,
  apiKey: string,
  model: string,
  messages: unknown[]
): Promise<{ productName: string } | { error: string; detail?: string; status?: number }> {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 60, messages }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[vision] ${baseURL} error:`, res.status, err.slice(0, 200));
    const isBalance = res.status === 403 || err.includes("balance") || err.includes("BALANCE");
    return {
      error: isBalance ? "vision_no_balance" : "Vision API failed",
      detail: isBalance ? "Vision provider needs credit top-up" : err,
      status: res.status,
    };
  }

  const data = await res.json();
  const productName = data.choices?.[0]?.message?.content?.trim() ?? "";
  console.log(`[vision] identified via ${baseURL}: "${productName}"`);
  return { productName };
}

export async function POST(req: Request) {
  const { imageBase64, mimeType = "image/jpeg" } = await req.json();

  if (!imageBase64 || imageBase64.length < 500) {
    return Response.json({ error: "Image too small or missing" }, { status: 400 });
  }

  const messages = buildMessages(imageBase64, mimeType);

  // Try ZooWork first — only with zct_ inference tokens, not zwp_live_ management tokens
  if (ZOOWORK_LLM_KEY && ZOOWORK_LLM_KEY.startsWith("zct_")) {
    console.log(`[vision] trying ZooWork model: ${ZOOWORK_VISION_MODEL}`);
    const result = await callVision(ZOOWORK_BASE, ZOOWORK_LLM_KEY, ZOOWORK_VISION_MODEL, messages);
    if ("productName" in result) return Response.json(result);
    console.log("[vision] ZooWork failed, falling back to Novita direct");
  }

  // Fall back to Novita direct
  if (!NOVITA_KEY) {
    return Response.json({ error: "Vision API not configured" }, { status: 503 });
  }

  console.log(`[vision] trying Novita direct model: ${NOVITA_MODEL}`);
  const result = await callVision(NOVITA_BASE, NOVITA_KEY, NOVITA_MODEL, messages);
  if ("productName" in result) return Response.json(result);

  return Response.json(
    {
      error: (result as { error: string }).error,
      detail: (result as { detail?: string }).detail,
      status: (result as { status?: number }).status,
    },
    { status: 502 }
  );
}
