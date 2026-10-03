"use client";

import { TrustDial } from "./TrustDial";
import type { VendorScore } from "@/lib/pipeline";

interface Props {
  vendor: VendorScore;
  rank: number;
  isTopPick?: boolean;
  isHiddenGem?: boolean;
}

const VERDICT_COLORS = {
  HIGHLY_TRUSTED: { border: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.05)" },
  TRUSTED:        { border: "rgba(134,239,172,0.25)", bg: "rgba(134,239,172,0.04)" },
  CAUTION:        { border: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.05)" },
  AVOID:          { border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.05)" },
};

const CLAIM_COLORS = {
  VERIFIED:    { dot: "#22c55e", text: "text-green-400" },
  EXAGGERATED: { dot: "#f59e0b", text: "text-amber-400" },
  FABRICATED:  { dot: "#ef4444", text: "text-red-400" },
};

export function VendorCard({ vendor, rank, isTopPick, isHiddenGem }: Props) {
  const isOriginal = vendor.isOriginalUrl === true;

  // Original URL vendor always gets a red dashed warning border regardless of verdict
  const { border, bg } = isOriginal
    ? { border: "rgba(239,68,68,0.55)", bg: "rgba(239,68,68,0.06)" }
    : (VERDICT_COLORS[vendor.verdict] ?? VERDICT_COLORS.CAUTION);

  const domain = (() => { try { return new URL(vendor.url).hostname.replace("www.", ""); } catch { return vendor.name; } })();
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  const aiPct = Math.round(vendor.aiReviewRatio * 100);

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-300 hover:scale-[1.01]"
      style={{
        border: `${isOriginal ? "2px dashed" : "1px solid"} ${border}`,
        background: bg,
        position: "relative",
      }}
    >
      {/* "You pasted this" banner for original URL */}
      {isOriginal && (
        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-red-950/40 border border-red-800/40">
          <span className="text-sm">📎</span>
          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">You pasted this URL</span>
          <span className="ml-auto text-[10px] text-red-600">See why it scored low ↓</span>
        </div>
      )}

      {/* Badges */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {!isOriginal && (
          <span className="text-xs font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            #{rank}
          </span>
        )}
        {isTopPick && (
          <span className="text-xs font-bold text-green-300 bg-green-900/40 border border-green-700/50 px-2 py-0.5 rounded-full">
            ★ TOP PICK
          </span>
        )}
        {isHiddenGem && (
          <span className="text-xs font-bold text-amber-300 bg-amber-900/30 border border-amber-600/40 px-2 py-0.5 rounded-full">
            💎 You almost skipped this
          </span>
        )}
        {isOriginal && (
          <span className="text-xs font-bold text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-full">
            ✗ {vendor.verdict.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Header row */}
      <div className="flex items-start gap-4">
        <TrustDial score={vendor.trustScore} size={88} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={faviconUrl} alt="" width={14} height={14} className="rounded shrink-0 opacity-80" />
            <span className="text-xs text-gray-500">{domain}</span>
          </div>
          <a
            href={vendor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-semibold text-sm hover:underline leading-snug block line-clamp-2"
          >
            {vendor.name}
          </a>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{vendor.summary}</p>
        </div>
      </div>

      {/* Claims */}
      {vendor.claims.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Claims checked</p>
          <div className="grid grid-cols-1 gap-1">
            {vendor.claims.slice(0, 4).map((c, i) => {
              const cfg = CLAIM_COLORS[c.verdict] ?? CLAIM_COLORS.EXAGGERATED;
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
                  <span className="text-gray-400 flex-1 min-w-0 truncate">{c.claim}</span>
                  <span className={`shrink-0 font-bold ${cfg.text}`}>{c.verdict}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer row: AI warning + YouTube link */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {aiPct > 20 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-2.5 py-1">
            <span>⚠</span>
            <span>{aiPct}% AI reviews</span>
          </div>
        )}
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(vendor.name + " review")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 border border-gray-800 hover:border-red-800/50 rounded-lg px-2.5 py-1 transition-colors"
        >
          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>
          Reviews
        </a>
        <a
          href={vendor.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-gray-600 hover:text-green-400 transition-colors"
        >
          Visit →
        </a>
      </div>
    </div>
  );
}
