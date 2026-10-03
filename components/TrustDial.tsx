"use client";

import { useEffect, useState } from "react";

interface Props {
  score: number; // 0–100
  size?: number;
  animate?: boolean;
}

const VERDICT_CONFIG = {
  HIGHLY_TRUSTED: { color: "#22c55e", glow: "rgba(34,197,94,0.4)", label: "HIGHLY TRUSTED" },
  TRUSTED:        { color: "#86efac", glow: "rgba(134,239,172,0.35)", label: "TRUSTED" },
  CAUTION:        { color: "#f59e0b", glow: "rgba(245,158,11,0.4)", label: "CAUTION" },
  AVOID:          { color: "#ef4444", glow: "rgba(239,68,68,0.4)", label: "AVOID" },
};

function verdictFromScore(score: number) {
  if (score >= 85) return "HIGHLY_TRUSTED" as const;
  if (score >= 65) return "TRUSTED" as const;
  if (score >= 40) return "CAUTION" as const;
  return "AVOID" as const;
}

export function TrustDial({ score, size = 120, animate = true }: Props) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) { setDisplayed(score); return; }
    let current = 0;
    const step = score / 40;
    const id = setInterval(() => {
      current = Math.min(current + step, score);
      setDisplayed(Math.round(current));
      if (current >= score) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [score, animate]);

  const verdict = verdictFromScore(score);
  const { color, glow, label } = VERDICT_CONFIG[verdict];
  const r = (size / 2) * 0.72;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  // 75% arc — starts at 135deg ends at 45deg
  const arcLen = circumference * 0.75;
  const dashOffset = arcLen - (arcLen * displayed) / 100;
  const rotation = 135; // start angle

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div style={{ width: size, height: size, position: "relative" }}>
        <svg width={size} height={size} style={{ transform: `rotate(${rotation}deg)` }}>
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={size * 0.09}
            strokeDasharray={`${arcLen} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Fill */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={size * 0.09}
            strokeDasharray={`${arcLen} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              transition: animate ? "stroke-dashoffset 0.05s linear" : "none",
              filter: `drop-shadow(0 0 ${size * 0.06}px ${glow})`,
            }}
          />
        </svg>
        {/* Center text */}
        <div
          style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
        >
          <span style={{ fontSize: size * 0.28, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {displayed}
          </span>
          <span style={{ fontSize: size * 0.09, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
            / 100
          </span>
        </div>
      </div>
      <span
        style={{
          fontSize: size * 0.1,
          fontWeight: 700,
          color,
          letterSpacing: "0.12em",
          textShadow: `0 0 12px ${glow}`,
        }}
      >
        {label}
      </span>
    </div>
  );
}
