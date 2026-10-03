export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { imageBase64, mimeType = "image/jpeg" } = await req.json();

  const apiKey = process.env.NOVITA_API_KEY;
  const baseURL = process.env.NOVITA_BASE_URL || "https://api.novita.ai/v3/openai";
  const model = process.env.NOVITA_VISION_MODEL || "qwen/qwen3-vl-30b-a3b-instruct";

  if (!apiKey) {
    return Response.json({ error: "Vision API not configured" }, { status: 503 });
  }

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 60,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What product is shown in this image? Return ONLY the product name and brand, max 8 words. Example: 'Sony WH-1000XM5 headphones' or 'Amazon Echo Dot 5th Gen'",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[vision] Novita error:", res.status, err);
    // Distinguish balance errors from other failures so UI can show a clear message
    const isBalance = res.status === 403 || err.includes("balance") || err.includes("BALANCE");
    return Response.json(
      {
        error: isBalance ? "vision_no_balance" : "Vision API failed",
        detail: isBalance ? "Novita account needs credit top-up at novita.ai" : err,
        status: res.status,
      },
      { status: 502 }
    );
  }

  const data = await res.json();
  const productName = data.choices?.[0]?.message?.content?.trim() ?? "";
  console.log(`[vision] identified: "${productName}"`);
  return Response.json({ productName });
}
