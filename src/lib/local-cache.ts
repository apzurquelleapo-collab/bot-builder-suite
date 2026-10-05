import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny browser cache (localStorage) with cross-tab sync and React hook.
 * Swap this module for Firebase/Firestore later without touching the UI.
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

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    const key = e.key.slice(PREFIX.length);
    memory.delete(key);
    listeners.get(key)?.forEach((l) => l());
  });
}

export function useCache<T>(key: string, fallback: T) {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(cb);
      return () => listeners.get(key)!.delete(cb);
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback((v: T | ((prev: T) => T)) => {
    const next = typeof v === "function" ? (v as (p: T) => T)(read(key, fallback)) : v;
    cacheSet(key, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, set] as const;
}
