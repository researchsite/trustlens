"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import type { ChatPanelHandle } from "@/components/ChatPanel";
import { VendorCard } from "@/components/VendorCard";
import { TrustDial } from "@/components/TrustDial";
import type { PipelineResult } from "@/lib/pipeline";

// ─── Legend panel ─────────────────────────────────────────────────────────────
function LegendPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#0e0e0e] border border-gray-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base">How TrustLens Scores Work</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        {/* Score tiers */}
        <div className="space-y-2">
          <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold">Trust Tiers</p>
          {[
            { label: "HIGHLY TRUSTED", color: "#22c55e", range: "≥ 85", desc: "Strong evidence, genuine reviews, verified claims" },
            { label: "TRUSTED", color: "#86efac", range: "65–84", desc: "Mostly verified, minor exaggerations" },
            { label: "CAUTION", color: "#f59e0b", range: "40–64", desc: "Mixed signals — check reviews manually" },
            { label: "AVOID", color: "#ef4444", range: "< 40", desc: "Fabricated claims or high AI-review ratio" },
          ].map((t) => (
            <div key={t.label} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-900/50">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: t.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: t.color }}>{t.label}</span>
                  <span className="text-[10px] text-gray-700 tabular-nums">{t.range}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Claim verdicts */}
        <div className="space-y-2">
          <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold">Claim Labels</p>
          {[
            { label: "VERIFIED", color: "#22c55e", desc: "Claim backed by manufacturer specs, certifications, or third-party tests" },
            { label: "EXAGGERATED", color: "#f59e0b", desc: "Partially true but oversold — common in marketing copy" },
            { label: "FABRICATED", color: "#ef4444", desc: "No credible evidence found — red flag for fraud" },
          ].map((c) => (
            <div key={c.label} className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: c.color }} />
              <div>
                <span className="text-xs font-bold" style={{ color: c.color }}>{c.label}</span>
                <p className="text-[11px] text-gray-500 mt-0.5">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Result badges */}
        <div className="space-y-2">
          <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold">Result Badges</p>
          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-900/50">
            <span className="text-sm shrink-0">★</span>
            <div>
              <span className="text-xs font-bold text-green-300">TOP PICK</span>
              <p className="text-[11px] text-gray-500 mt-0.5">Highest TrustScore of all vendors, must be ≥65. This is the vendor TrustLens recommends.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/30">
            <span className="text-sm shrink-0">💎</span>
            <div>
              <span className="text-xs font-bold text-amber-300">HIDDEN GEM</span>
              <p className="text-[11px] text-gray-500 mt-0.5">
                A second vendor within 10 points of the top pick, TrustScore ≥70. Ranked lower in raw search results — but nearly as trustworthy. <em className="text-amber-600/70">The one you almost skipped.</em>
              </p>
            </div>
          </div>
        </div>

        {/* Formula */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 space-y-1">
          <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold mb-2">Score Formula</p>
          <code className="text-[11px] text-green-400 leading-relaxed block">
            base 50<br />
            + verified_ratio × 30<br />
            − fabricated_ratio × 40<br />
            − ai_review_ratio × 20<br />
            = TrustScore (clamped 0–100)
          </code>
          <p className="text-[10px] text-gray-700 mt-2">AI review ratio = fraction of reviews that appear AI-generated (identical phrasing, no specifics, excessive positivity)</p>
        </div>
      </div>
    </div>
  );
}

// ─── Empty panel ──────────────────────────────────────────────────────────────
function EmptyPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center select-none pointer-events-none">
      <div className="relative">
        <div className="w-24 h-24 rounded-full border-2 border-gray-800 flex items-center justify-center">
          <TrustDial score={0} size={72} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center">
          <span className="text-[10px] text-gray-500">?</span>
        </div>
      </div>
      <div>
        <p className="text-gray-500 font-semibold text-sm">Vendor scores appear here</p>
        <p className="text-gray-700 text-xs mt-1">Ask about any product in the chat →</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-700 max-w-xs">
        {[
          { icon: "🛒", label: "Buy mode", hint: "ranks online sellers" },
          { icon: "🔧", label: "Fix mode", hint: "finds repair shops" },
          { icon: "🔬", label: "AI scoring", hint: "claims · evidence · trust" },
        ].map((item) => (
          <div key={item.label} className="border border-gray-800 rounded-xl p-3 space-y-1">
            <div className="text-lg">{item.icon}</div>
            <div className="font-semibold text-gray-600">{item.label}</div>
            <div className="text-gray-700">{item.hint}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-gray-800 space-y-0.5 pointer-events-auto">
        <p>Try: <span className="text-gray-600">"Buy AirPods Pro"</span> · <span className="text-gray-600">"Fix MacBook screen"</span></p>
        <p><span className="text-gray-600">"Best drone under $500"</span> · <span className="text-gray-600">"Samsung TV repair"</span></p>
      </div>
    </div>
  );
}

// ─── Results panel ────────────────────────────────────────────────────────────
function ResultsPanel({ result }: { result: PipelineResult }) {
  const [showLegend, setShowLegend] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsState, setSmsState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [smsError, setSmsError] = useState<string | null>(null);

  async function sendSms() {
    if (!smsPhone.trim()) return;
    setSmsState("sending");
    setSmsError(null);
    const top = result.vendors[0];
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: smsPhone.trim(),
          topVendor: top?.name ?? "",
          trustScore: top?.trustScore ?? 0,
          productName: result.productName,
        }),
      });
      if (res.ok) {
        setSmsState("sent");
      } else {
        const data = await res.json();
        setSmsState("error");
        if (data.error === "unverified_number") {
          setSmsError("Trial account: verify this number at twilio.com/console first");
        } else {
          setSmsError(data.twilioMessage ?? "Send failed — check number format (+1…)");
        }
      }
    } catch {
      setSmsState("error");
      setSmsError("Network error — check connection");
    }
  }

  return (
    <div className="space-y-4">
      {showLegend && <LegendPanel onClose={() => setShowLegend(false)} />}

      {/* Header row */}
      <div className="flex items-center gap-3 pb-1 border-b border-gray-800/60">
        <h2 className="text-lg font-bold text-white">
          {result.vendors.length} vendor{result.vendors.length !== 1 ? "s" : ""} scored
        </h2>
        <span className="text-sm text-gray-500">&ldquo;{result.productName}&rdquo;</span>
        <span className="ml-auto text-xs text-gray-600 capitalize">{result.mode} mode</span>
        <button
          onClick={() => setShowLegend(true)}
          title="How scores work"
          className="text-[11px] text-gray-700 hover:text-gray-400 border border-gray-800 rounded-lg px-2 py-0.5 transition-colors"
        >
          ? Legend
        </button>
      </div>

      {result.vendors.map((v, i) => {
        const isOriginal = v.isOriginalUrl === true;
        // After the pasted URL vendor, show a divider + "Trusted alternatives" label
        const showAltDivider = isOriginal && result.vendors.length > 1;
        // For the original URL vendor, top pick is the best alternative (index 1+), not the original
        const altRank = isOriginal ? undefined : (result.originalUrl ? i : i + 1);

        return (
          <div key={v.url}>
            <VendorCard
              vendor={v}
              rank={altRank ?? i + 1}
              isTopPick={!isOriginal && (result.originalUrl ? i === 1 : i === 0) && v.trustScore >= 65}
              isHiddenGem={result.hiddenGem?.url === v.url && !isOriginal}
            />
            {showAltDivider && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 border-t border-gray-800/60" />
                <span className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap">
                  ✓ Trusted alternatives
                </span>
                <div className="flex-1 border-t border-gray-800/60" />
              </div>
            )}
          </div>
        );
      })}

      {/* Score legend row */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-800/40">
        {[
          { label: "HIGHLY TRUSTED", color: "#22c55e", min: "≥85" },
          { label: "TRUSTED", color: "#86efac", min: "≥65" },
          { label: "CAUTION", color: "#f59e0b", min: "≥40" },
          { label: "AVOID", color: "#ef4444", min: "<40" },
        ].map((tier) => (
          <div key={tier.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tier.color }} />
            <span>{tier.label}</span>
            <span className="text-gray-700">{tier.min}</span>
          </div>
        ))}
      </div>

      {/* SMS section */}
      <div className="pt-1">
        {!smsOpen && smsState !== "sent" && (
          <button
            onClick={() => setSmsOpen(true)}
            className="text-xs text-gray-600 hover:text-green-400 border border-gray-800 hover:border-green-800/60 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21l4-4 4 4M3 16V8a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            Send results to phone
          </button>
        )}
        {smsOpen && smsState !== "sent" && (
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-600/60"
            />
            <button
              onClick={sendSms}
              disabled={smsState === "sending" || !smsPhone.trim()}
              className="text-xs bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {smsState === "sending" ? "…" : "Send"}
            </button>
            <button onClick={() => setSmsOpen(false)} className="text-gray-600 hover:text-gray-400 text-sm">✕</button>
          </div>
        )}
        {smsState === "sent" && (
          <p className="text-xs text-green-400">✓ SMS sent to {smsPhone}</p>
        )}
        {smsState === "error" && (
          <p className="text-xs text-red-400">{smsError ?? "SMS failed"}</p>
        )}
      </div>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const chatRef = useRef<ChatPanelHandle>(null);

  function handleClear() {
    setResult(null);
    chatRef.current?.clear();
  }

  function handleSearchStart() {
    setResult(null);
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur">
        <span className="text-xl font-black tracking-tight bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
          TrustLens
        </span>
        <span className="text-xs text-gray-700 border border-gray-800 rounded px-1.5 py-0.5">BETA</span>
        <span className="hidden md:inline text-xs text-gray-700 ml-1">
          AI Commerce Gallery · 122 Riley Ave, SF
        </span>
        <Link
          href="/what-next"
          className="ml-auto text-xs text-gray-600 hover:text-green-400 transition-colors mr-4"
        >
          What&apos;s Next →
        </Link>
        <button
          onClick={handleClear}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          ✕ Clear
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className="w-full md:w-[420px] lg:w-[460px] shrink-0 flex flex-col border-r border-gray-800/60 overflow-hidden">
          <ChatPanel
            ref={chatRef}
            onResult={setResult}
            onSearchStart={handleSearchStart}
          />
        </div>

        {/* Results panel */}
        <div className="hidden md:flex flex-1 flex-col overflow-y-auto p-6 bg-[#080808]">
          {result ? <ResultsPanel result={result} /> : <EmptyPanel />}
        </div>
      </div>
    </div>
  );
}
