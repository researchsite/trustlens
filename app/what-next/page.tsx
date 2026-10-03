import Link from "next/link";

const nearTerm = [
  {
    title: "Browser Extension",
    desc: "A Chrome/Firefox extension that adds a TrustScore badge on every Amazon, Temu, and AliExpress product card as you browse — no search needed.",
    effort: "1 week",
    impact: "HIGH",
  },
  {
    title: "Price + Trust Scatter Plot",
    desc: "A two-axis chart: price on X, TrustScore on Y. The ideal vendor is top-left (high trust, low price). Makes the tradeoff visual.",
    effort: "1 day",
    impact: "HIGH",
  },
  {
    title: "Return Policy Checker",
    desc: "Extract and highlight return policy from vendor pages. \"30-day free returns\" vs. \"All sales final\" is a major trust signal currently invisible.",
    effort: "2 days",
    impact: "MEDIUM",
  },
  {
    title: "Comparison Mode",
    desc: "Side-by-side TrustScore breakdown for two user-selected vendors. \"Amazon vs. B&H Photo for this Sony headphone.\"",
    effort: "2 days",
    impact: "MEDIUM",
  },
  {
    title: "Voice Input",
    desc: "Microphone button using Web Speech API (browser-native, no cost). Speak \"I want to buy Sony headphones\" → fills the search box.",
    effort: "1 day",
    impact: "MEDIUM",
  },
];

const mediumTerm = [
  {
    title: "ZooWork Deep Integration",
    desc: "Replace LLM-estimated AI review ratio with real ZooWork ZooData: actual review texts, verified purchase flags, star breakdowns per variant.",
    effort: "1 week",
    impact: "HIGH",
  },
  {
    title: "TinyFish Content Extraction",
    desc: "Replace 200-char Tavily snippets with full page markdown from TinyFish. Richer data → more accurate claim verification.",
    effort: "1 week",
    impact: "HIGH",
  },
  {
    title: "WhatsApp Integration",
    desc: "Send results as a rich WhatsApp message with vendor card image via SignalWire. SMS is text-only; WhatsApp shows the full card.",
    effort: "3 days",
    impact: "MEDIUM",
  },
  {
    title: "Watchlist + Alerts",
    desc: "\"Watch this vendor\" — TrustLens checks their score weekly. If it drops below threshold, sends a SMS/email alert.",
    effort: "2 weeks",
    impact: "HIGH",
  },
  {
    title: "Seller Fingerprinting",
    desc: "Detect when the same bad actor operates multiple storefronts. Shared seller ID, factory address, or review patterns → shared trust score.",
    effort: "2 weeks",
    impact: "HIGH",
  },
];

const biggerBets = [
  {
    title: "Trust API (B2B)",
    desc: "Expose TrustLens as an API any checkout app can call. Show a TrustScore badge before payment confirmation. Per-query pricing like Stripe.",
    effort: "1 month",
    impact: "VERY HIGH",
  },
  {
    title: "Community Trust Layer",
    desc: "Users flag: \"I bought from this — it was legit\" or \"Scam.\". Aggregate into a community modifier on top of the AI score. Wirecutter + Trustpilot built on AI.",
    effort: "1 month",
    impact: "VERY HIGH",
  },
  {
    title: "Price History Integration",
    desc: "Pull price history via Keepa API. A spike right before a fake \"sale\" is a manipulation signal. \"Was $200, now $89\" — is that real?",
    effort: "1 week",
    impact: "MEDIUM",
  },
  {
    title: "Purchase Protection",
    desc: "If TrustScore < 40 and user still buys — offer automatic purchase protection insurance (Extend/SquareTrade). Turns a warning into a product.",
    effort: "2 months",
    impact: "VERY HIGH",
  },
  {
    title: "Multi-Language Support",
    desc: "German/French Amazon, Korean Coupang, Japanese Rakuten — same trust problem, same solution. Much bigger market.",
    effort: "2 months",
    impact: "HIGH",
  },
];

const impactColor: Record<string, string> = {
  "VERY HIGH": "text-green-400 bg-green-950/40 border-green-800/40",
  HIGH: "text-emerald-400 bg-emerald-950/30 border-emerald-800/30",
  MEDIUM: "text-amber-400 bg-amber-950/30 border-amber-700/30",
};

function IdeaCard({
  title,
  desc,
  effort,
  impact,
}: {
  title: string;
  desc: string;
  effort: string;
  impact: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${impactColor[impact]}`}
        >
          {impact}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed mb-3">{desc}</p>
      <span className="text-[10px] text-gray-600 font-mono">{effort}</span>
    </div>
  );
}

function Section({
  title,
  subtitle,
  ideas,
}: {
  title: string;
  subtitle: string;
  ideas: typeof nearTerm;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="text-base font-bold text-white">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.title} {...idea} />
        ))}
      </div>
    </section>
  );
}

export default function WhatNextPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="text-xl font-black tracking-tight bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent"
          >
            TrustLens
          </Link>
          <span className="text-gray-700 text-sm">›</span>
          <span className="text-sm text-gray-400">What&apos;s Next</span>
          <Link
            href="/"
            className="ml-auto text-xs text-gray-600 hover:text-gray-300 transition-colors"
          >
            ← Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl font-black text-white mb-2">What&apos;s Next for TrustLens</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            TrustLens v1 scores vendors, detects fake reviews, and finds alternatives for bad URLs.
            Here&apos;s what we&apos;re building next — from things that could ship this week to the bigger bets.
          </p>
        </div>

        {/* Current capabilities */}
        <div className="mb-10 rounded-xl border border-green-900/50 bg-green-950/20 p-5">
          <p className="text-[11px] text-green-600 uppercase tracking-wider font-semibold mb-3">Shipping Today (v1)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              "Vendor trust scoring",
              "Fake review detection",
              "Claim verification",
              "Repair shop finder",
              "Photo product ID",
              "Temu URL analysis",
              "Hidden Gem surfacing",
              "SMS results",
            ].map((f) => (
              <div key={f} className="flex items-center gap-1.5">
                <span className="text-green-500 text-xs">✓</span>
                <span className="text-xs text-gray-300">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <Section
          title="Near-term"
          subtitle="Could ship this week with current stack"
          ideas={nearTerm}
        />
        <Section
          title="Medium-term"
          subtitle="Good second sprint — requires deeper API integration"
          ideas={mediumTerm}
        />
        <Section
          title="Bigger bets"
          subtitle="Post-hackathon — these are the moat"
          ideas={biggerBets}
        />

        {/* CTA */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-6 text-center mt-4">
          <p className="text-sm text-gray-400 mb-3">
            Built at the AI Commerce Gallery Hackathon · San Francisco · October 2026
          </p>
          <Link
            href="/"
            className="inline-block text-sm font-semibold text-black bg-green-400 hover:bg-green-300 px-5 py-2 rounded-lg transition-colors"
          >
            Try TrustLens →
          </Link>
        </div>
      </main>
    </div>
  );
}
