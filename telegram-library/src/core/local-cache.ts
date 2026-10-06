/**
 * Tiny browser cache (localStorage) with cross-tab sync.
 * Framework-agnostic — no React import. Swap for Firebase later.
 */
const PREFIX = "tgwb:";
const listeners = new Map<string, Set<() => void>>();
const memory = new Map<string, unknown>();

function read<T>(key: string, fallback: T): T {
  if (memory.has(key)) return memory.get(key) as T;
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    const value = raw ? (JSON.parse(raw) as T) : fallback;
    memory.set(key, value);
    return value;
  } catch {
    return fallback;
  }
}

export function cacheGet<T>(key: string, fallback: T): T {
  return read(key, fallback);
}

export function cacheSet<T>(key: string, value: T) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn("Local cache full or unavailable", e);
  }
  listeners.get(key)?.forEach((l) => l());
}

export function cacheClear(): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  for (const k of keys) window.localStorage.removeItem(k);
  memory.clear();
  listeners.forEach((set) => set.forEach((l) => l()));
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    const key = e.key.slice(PREFIX.length);
    memory.delete(key);
    listeners.get(key)?.forEach((l) => l());
  });
}
