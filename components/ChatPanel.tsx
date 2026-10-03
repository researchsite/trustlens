"use client";

import { useChat } from "ai/react";
import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { PipelineResult } from "@/lib/pipeline";

export interface ChatPanelHandle {
  clear: () => void;
}

interface Props {
  onResult: (result: PipelineResult | null) => void;
  onSearchStart?: () => void;
}

const SUGGESTIONS = [
  "I want to buy an Echo Dot 5th Gen",
  "Fix my iPhone 14 screen",
  "Best place to buy Sony WH-1000XM5?",
  "Samsung Galaxy Watch 7 buy online",
  "MacBook Pro repair near me",
  "Where to buy DJI Mini 4 Pro drone?",
];

// Queries that typically expose low-trust / AVOID vendors
const AVOID_DEMOS = [
  "Buy AirPods Pro $39 online deals",
  "Cheap Rolex watches authentic free shipping",
];

// Queries that frequently surface a highly-trusted second vendor (hidden gem)
const HIDDEN_GEM_DEMOS = [
  "Buy USB-C hub for MacBook Pro",
  "Buy Anker portable charger 20000mAh",
  "Buy Keychron mechanical keyboard",
];

const DEMO_IMAGES = [
  { label: "Echo Dot", src: "/samples/echo-dot.svg", query: "Amazon Echo Dot 5th Gen" },
  { label: "iPhone 15", src: "/samples/iphone.svg", query: "iPhone 15 Pro" },
  { label: "Headphones", src: "/samples/headphones.svg", query: "Sony WH-1000XM5 headphones" },
  { label: "Galaxy Watch", src: "/samples/smartwatch.svg", query: "Samsung Galaxy Watch 7" },
];

function Spinner() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-green-400 opacity-80"
          style={{ animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite` }}
        />
      ))}
    </div>
  );
}

function AnalyzingCard() {
  const steps = ["Searching vendors…", "Extracting claims…", "Grounding evidence…", "Scoring trust…", "Ranking…"];
  return (
    <div className="rounded-xl border border-green-800/40 bg-green-950/20 p-3 my-1 space-y-1.5">
      <p className="text-[11px] font-bold text-green-500 uppercase tracking-wider">Analyzing…</p>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px] text-green-800">
          <span className="w-3 h-3 rounded-full border border-green-800/60 animate-pulse shrink-0" />
          {s}
        </div>
      ))}
    </div>
  );
}

function ResultPreviewCard({ result }: { result: PipelineResult }) {
  const top = result.vendors[0];
  if (!top) return null;
  const scoreColor =
    top.trustScore >= 85 ? "#22c55e"
    : top.trustScore >= 65 ? "#86efac"
    : top.trustScore >= 40 ? "#f59e0b"
    : "#ef4444";
  return (
    <div className="rounded-xl border p-3 my-1 space-y-1.5" style={{ borderColor: scoreColor + "55", background: scoreColor + "09" }}>
      <div className="flex items-center gap-2.5">
        <span className="text-2xl font-black tabular-nums shrink-0" style={{ color: scoreColor, textShadow: `0 0 16px ${scoreColor}50` }}>
          {top.trustScore}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{top.name}</p>
          <p className="text-[10px] text-gray-500">{top.verdict.replace(/_/g, " ")}</p>
        </div>
        {result.vendors.length > 1 && (
          <span className="text-[10px] text-gray-600 shrink-0">+{result.vendors.length - 1} more →</span>
        )}
      </div>
      {top.summary && <p className="text-[11px] text-gray-400 line-clamp-2">{top.summary}</p>}
    </div>
  );
}

// Shown after vision identifies a product — lets user pick action
function ImageActionCard({
  productName,
  onAction,
  onDismiss,
}: {
  productName: string;
  onAction: (query: string) => void;
  onDismiss: () => void;
}) {
  const short = productName.length > 40 ? productName.slice(0, 40) + "…" : productName;
  return (
    <div className="mx-4 mb-2 rounded-xl border border-green-800/50 bg-green-950/20 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] text-green-600 uppercase tracking-wider font-semibold">Product identified</p>
          <p className="text-sm text-white font-semibold mt-0.5">{short}</p>
        </div>
        <button onClick={onDismiss} className="text-gray-700 hover:text-gray-400 text-sm leading-none mt-0.5">✕</button>
      </div>
      <p className="text-[11px] text-gray-500">What do you need?</p>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => onAction(`I want to buy ${productName}`)}
          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-green-900/40 hover:bg-green-800/50 border border-green-800/40 text-green-300 transition-colors"
        >
          <span className="text-base">🛒</span>
          <span className="text-[10px] font-semibold">Buy online</span>
        </button>
        <button
          onClick={() => onAction(`Fix my ${productName}`)}
          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-blue-900/30 hover:bg-blue-800/40 border border-blue-800/40 text-blue-300 transition-colors"
        >
          <span className="text-base">🔧</span>
          <span className="text-[10px] font-semibold">Repair shops</span>
        </button>
        <button
          onClick={() => onAction(`${productName} accessories`)}
          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-purple-900/30 hover:bg-purple-800/40 border border-purple-800/40 text-purple-300 transition-colors"
        >
          <span className="text-base">🎒</span>
          <span className="text-[10px] font-semibold">Accessories</span>
        </button>
      </div>
    </div>
  );
}

export const ChatPanel = forwardRef<ChatPanelHandle, Props>(
  ({ onResult, onSearchStart }, ref) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [suggested, setSuggested] = useState(true);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [visionLoading, setVisionLoading] = useState(false);
    const [imageAction, setImageAction] = useState<string | null>(null);

    const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, setInput } =
      useChat({ api: "/api/chat" });
    // Results are pushed via the useEffect below — onFinish is NOT used here
    // because it captures a stale `messages` closure and re-pushes the OLD result.

    useImperativeHandle(ref, () => ({
      clear: () => {
        setMessages([]);
        setImagePreview(null);
        setImageAction(null);
        setSuggested(true);
      },
    }));

    function findAndPushResult() {
      // Only scan assistant messages that came AFTER the most recent user message —
      // prevents re-surfacing stale results from an older conversation turn.
      let lastUserIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") { lastUserIdx = i; break; }
      }
      for (let i = messages.length - 1; i > lastUserIdx; i--) {
        const m = messages[i];
        if (m.role !== "assistant") continue;
        const inv = m.toolInvocations;
        if (!inv?.length) continue;
        for (let j = inv.length - 1; j >= 0; j--) {
          const t = inv[j];
          if (t.toolName === "analyzeTrust" && t.state === "result") {
            onResult(t.result as PipelineResult);
            return;
          }
        }
      }
    }

    useEffect(() => {
      // Don't re-surface stale results while a new query is in flight
      const last = messages[messages.length - 1];
      if (!last || last.role === "user") return;
      findAndPushResult();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages]);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    function sendQuery(text: string) {
      setSuggested(false);
      setImagePreview(null);
      setImageAction(null);
      if (onSearchStart) onSearchStart();
      setInput(text);
      setTimeout(() => inputRef.current?.closest("form")?.requestSubmit(), 0);
    }

    async function handleImageFile(file: File) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setImagePreview(dataUrl);
        setImageAction(null);

        const base64 = dataUrl.split(",")[1];
        const mimeType = file.type || "image/jpeg";
        setVisionLoading(true);
        try {
          const res = await fetch("/api/vision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, mimeType }),
          });
          if (res.ok) {
            const { productName } = await res.json();
            if (productName) {
              setImageAction(productName);
              setInput(productName);
            }
          }
        } catch {
          // vision failed — let user type manually
        } finally {
          setVisionLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
      e.target.value = "";
    }

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-gray-800/60">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors ${isLoading ? "bg-yellow-400 animate-pulse" : "bg-green-400"}`} />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {isLoading ? "Analyzing…" : "TrustLens"}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
          {messages.length === 0 && (
            <div className="py-2 space-y-4">
              <p className="text-gray-500 text-sm leading-relaxed">
                Drop a product name and I&apos;ll score every vendor using 3 AI agents.
              </p>

              {/* Demo product image chips */}
              <div>
                <p className="text-[11px] text-gray-700 uppercase tracking-wider mb-2">Try a demo product</p>
                <div className="grid grid-cols-4 gap-2">
                  {DEMO_IMAGES.map((img) => (
                    <button
                      key={img.label}
                      onClick={() => sendQuery(img.query)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-gray-800 hover:border-green-700/60 bg-gray-900/40 hover:bg-green-950/20 transition-all group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt={img.label} className="w-10 h-10 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[10px] text-gray-600 group-hover:text-green-400 transition-colors text-center leading-tight">{img.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Regular suggestions */}
              {suggested && (
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendQuery(s)}
                      className="block w-full text-left text-[12px] text-gray-500 border border-gray-800 rounded-lg px-3 py-2 hover:border-green-700/60 hover:text-green-300 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                  {/* Hidden Gem demos */}
                  <p className="text-[10px] text-gray-700 uppercase tracking-wider pt-1">💎 Hidden Gem examples</p>
                  {HIDDEN_GEM_DEMOS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendQuery(s)}
                      className="block w-full text-left text-[12px] text-gray-600 border border-purple-900/30 rounded-lg px-3 py-2 hover:border-purple-700/50 hover:text-purple-400 transition-all"
                    >
                      💎 {s}
                    </button>
                  ))}
                  {/* AVOID demo section */}
                  <p className="text-[10px] text-gray-700 uppercase tracking-wider pt-1">⚠ AVOID detection examples</p>
                  {AVOID_DEMOS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendQuery(s)}
                      className="block w-full text-left text-[12px] text-gray-600 border border-red-900/30 rounded-lg px-3 py-2 hover:border-red-700/50 hover:text-red-400 transition-all"
                    >
                      ⚠ {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[88%] space-y-1">
                {m.role === "user" ? (
                  <div className="bg-gray-800/80 rounded-2xl rounded-tr-md px-3 py-2 text-sm text-white">{m.content}</div>
                ) : (
                  <div className="space-y-1">
                    {m.toolInvocations?.map((inv) => {
                      if (inv.toolName !== "analyzeTrust") return null;
                      if (inv.state === "result")
                        return <ResultPreviewCard key={inv.toolCallId} result={inv.result as PipelineResult} />;
                      return <AnalyzingCard key={inv.toolCallId} />;
                    })}
                    {m.content && <p className="text-sm text-gray-200 leading-relaxed">{m.content}</p>}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-gray-900/40 rounded-xl px-3 py-2.5">
                <Spinner />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Image action card — shown after vision identifies a product */}
        {imageAction && !isLoading && (
          <ImageActionCard
            productName={imageAction}
            onAction={sendQuery}
            onDismiss={() => { setImageAction(null); setImagePreview(null); }}
          />
        )}

        {/* Image preview strip — shown while vision is loading */}
        {imagePreview && !imageAction && (
          <div className="shrink-0 px-4 pb-2 flex items-center gap-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-gray-700" />
              {visionLoading && (
                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] text-green-400 animate-pulse">AI…</span>
                </div>
              )}
            </div>
            <p className="flex-1 text-xs text-green-400 animate-pulse">Identifying product…</p>
            <button onClick={() => { setImagePreview(null); setInput(""); }} className="text-gray-600 hover:text-gray-400 text-sm">✕</button>
          </div>
        )}

        {/* Input row */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-800/60">
          <form
            onSubmit={(e) => {
              setSuggested(false);
              setImagePreview(null);
              setImageAction(null);
              if (onSearchStart) onSearchStart();
              handleSubmit(e);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Echo Dot, Sony headphones, iPhone repair…"
              disabled={isLoading}
              className="flex-1 bg-gray-900/80 border border-gray-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600/60 disabled:opacity-40 transition-colors"
            />

            {/* Upload from files */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Upload product photo"
              className="shrink-0 w-9 h-9 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-400 hover:text-white rounded-xl transition-colors border border-gray-700/60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
            </button>

            {/* Take photo with camera — mobile only */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isLoading}
              title="Take photo"
              className="md:hidden shrink-0 w-9 h-9 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-400 hover:text-white rounded-xl transition-colors border border-gray-700/60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </button>

            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} className="hidden" />

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 bg-green-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              {isLoading ? "…" : "→"}
            </button>
          </form>
        </div>
      </div>
    );
  }
);

ChatPanel.displayName = "ChatPanel";
