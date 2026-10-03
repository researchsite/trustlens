import fs from "fs";
import path from "path";
import crypto from "crypto";

// ── Config ─────────────────────────────────────────────────────────────────────
// 6 hours: long enough to survive a full hackathon demo day.
const TTL_MS = 6 * 60 * 60 * 1000;

// On Vercel only /tmp is writable. Locally use .cache/ (outside .next/).
const CACHE_DIR = process.env.VERCEL
  ? "/tmp/trust-cache"
  : path.join(process.cwd(), ".cache", "trust-cache");

// ── Layer 1: in-memory Map (fastest — survives within a warm serverless instance)
const mem = new Map<string, { ts: number; data: unknown }>();

// ── Layer 2: pre-seeded data bundled with the deployment ──────────────────────
// Loaded once at module init from public/cache-seed.json so cold starts are warm.
function loadSeed() {
  try {
    // public/ is served as static files; the actual file lives at that path on disk
    const seedPath = path.join(process.cwd(), "public", "cache-seed.json");
    if (!fs.existsSync(seedPath)) return;
    const raw: Record<string, { ts: number; data: unknown }> = JSON.parse(
      fs.readFileSync(seedPath, "utf8")
    );
    let n = 0;
    for (const [k, v] of Object.entries(raw)) {
      if (Date.now() - v.ts < TTL_MS && !mem.has(k)) {
        mem.set(k, v);
        n++;
      }
    }
    if (n > 0) console.log(`[cache] seeded ${n} entries from cache-seed.json`);
  } catch { /* non-fatal */ }
}
loadSeed();

// ── Helpers ────────────────────────────────────────────────────────────────────
function hashKey(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}
function mapKey(namespace: string, id: string) {
  return `${namespace}-${hashKey(id)}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function cacheGet<T>(namespace: string, id: string): T | null {
  const k = mapKey(namespace, id);

  // Layer 1: memory
  const mem_entry = mem.get(k);
  if (mem_entry) {
    if (Date.now() - mem_entry.ts < TTL_MS) return mem_entry.data as T;
    mem.delete(k);
  }

  // Layer 2: file system (only exists on warm /tmp or local .cache/)
  try {
    const file = path.join(CACHE_DIR, `${k}.json`);
    if (!fs.existsSync(file)) return null;
    const entry = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Date.now() - entry.ts > TTL_MS) { fs.unlinkSync(file); return null; }
    mem.set(k, entry); // promote to memory
    return entry.data as T;
  } catch { return null; }
}

export function cacheSet(namespace: string, id: string, data: unknown) {
  const k = mapKey(namespace, id);
  const entry = { ts: Date.now(), data };

  // Layer 1: memory (always)
  mem.set(k, entry);

  // Layer 2: file system (best-effort)
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${k}.json`), JSON.stringify(entry));
  } catch { /* non-fatal */ }
}
