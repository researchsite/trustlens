export const runtime = "nodejs";

export async function POST(req: Request) {
  const { phone, topVendor, trustScore, productName } = await req.json();

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return Response.json({ error: "SMS not configured" }, { status: 503 });
  }

  const body =
    `TrustLens result for "${productName}":\n` +
    `Top pick: ${topVendor} — TrustScore ${trustScore}/100\n` +
    `trustlens.vercel.app`;

  const creds = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: phone, Body: body }).toString(),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("[sms] Twilio error:", JSON.stringify(data));
    // Twilio error 21608 = unverified number on trial account
    const isUnverified = data?.code === 21608;
    return Response.json(
      {
        error: isUnverified
          ? "unverified_number"
          : "sms_failed",
        twilioCode: data?.code,
        twilioMessage: data?.message,
      },
      { status: 502 }
    );
  }

  console.log(`[sms] sent to ${phone} — sid=${data.sid}`);
  return Response.json({ sid: data.sid });
}
