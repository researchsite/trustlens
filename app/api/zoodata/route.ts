import { NextRequest, NextResponse } from "next/server";

// ZooWork is an agent platform (agents/sessions/events), NOT a data scraper.
// Real base URL: https://clawapi.ecap.gsmo.ai/service/v1
// Real endpoints: /models, /agents, /agents/{id}/sessions, /agents/{id}/sessions/{id}/events
// This route is kept for future integration when we build a ZooWork trust agent.

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url param required" }, { status: 400 });

  return NextResponse.json({
    _note: "ZooWork is an agent platform, not a scraper. Product data comes from Tavily + Nebius pipeline.",
    url,
    zoowork_base: "https://clawapi.ecap.gsmo.ai/service/v1",
    available_endpoints: ["/models", "/agents", "/agents/{id}/start", "/agents/{id}/sessions"],
  });
}
