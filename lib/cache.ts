import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".next", "trust-cache");
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function key(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function cacheGet<T>(namespace: string, id: string): T | null {
  try {
    const file = path.join(CACHE_DIR, `${namespace}-${key(id)}.json`);
    if (!fs.existsSync(file)) return null;
    const { ts, data } = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Date.now() - ts > TTL_MS) { fs.unlinkSync(file); return null; }
    return data as T;
  } catch { return null; }
}

export function cacheSet(namespace: string, id: string, data: unknown) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, `${namespace}-${key(id)}.json`);
    fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* non-fatal */ }
}
