/**
 * Telegram Workbench — React layer.
 * Provider + hooks. Import from "telegram-workbench/react".
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { TelegramClient } from "./core/client.js";
import { TelegramBots, normalizeBotId, type BotId } from "./core/bots.js";
import { describeUpdate, type UpdateSummary } from "./core/link-parser.js";
import { cacheGet, cacheSet, cacheClear } from "./core/local-cache.js";

// ---------- Provider ----------

const TelegramContext = createContext<TelegramBots | null>(null);

/**
 * One bot:   <TelegramProvider client={client}>
 * Many bots: <TelegramProvider bots={TelegramBots.fromEnv(env)}>  or  bots={{ "1": c1, support: c2 }}
 */
export function TelegramProvider({
  client,
  bots,
  children,
}: {
  client?: TelegramClient;
  bots?: TelegramBots | Record<string, TelegramClient>;
  children: ReactNode;
}) {
  const registry = useMemo(() => {
    if (bots instanceof TelegramBots) return bots;
    const r = new TelegramBots(bots ?? {});
    if (client) r.register("1", client);
    return r;
  }, [client, bots]);
  return <TelegramContext.Provider value={registry}>{children}</TelegramContext.Provider>;
}

/** All bots in the provider. */
export function useTelegramBots(): TelegramBots {
  const bots = useContext(TelegramContext);
  if (!bots) throw new Error("useTelegram must be used inside <TelegramProvider>");
  return bots;
}

/** Get a bot client. No id = default bot. */
export function useTelegram(botId?: BotId): TelegramClient {
  return useTelegramBots().get(botId);
}

// ---------- Bot status ----------

export type BotStatus = {
  loading: boolean;
  connected: boolean;
  botName?: string;
  botUsername?: string;
  error?: string;
};

/** Check a bot token with getMe. */
export function useBotStatus(botId?: BotId): BotStatus & { refresh: () => void } {
  const client = useTelegram(botId);

  const [state, setState] = useState<BotStatus>({ loading: true, connected: false });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    client
      .getMe()
      .then((r) => {
        if (!alive) return;
        const me = (r.body as { result?: { first_name?: string; username?: string } })?.result;
        setState({
          loading: false,
          connected: r.ok,
          botName: me?.first_name,
          botUsername: me?.username ? `@${me.username}` : undefined,
          error: r.ok ? undefined : `HTTP ${r.status}`,
        });
      })
      .catch((e: unknown) => {
        if (alive) setState({ loading: false, connected: false, error: String(e) });
      });
    return () => {
      alive = false;
    };
  }, [client, nonce]);

  return { ...state, refresh: () => setNonce((n) => n + 1) };
}

// ---------- Inbox (polling + local cache) ----------

export type InboxOptions = {
  /** Which bot to poll (default bot if omitted). */
  botId?: BotId;
  /** Poll interval in ms (default 3000). Set 0 to disable polling. */
  pollMs?: number;
  /** localStorage cache key (default "inbox" or "inbox:<botId>"). */
  cacheKey?: string;
  /** Max rows kept in the local cache (default 300). */
  limit?: number;
};

export type InboxState = {
  updates: UpdateSummary[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  clear: () => void;
  /** Acknowledge a button press so the spinner on the user's keyboard stops. */
  answerCallback: (callbackQueryId: string, text?: string) => Promise<void>;
};

/**
 * Live inbound feed: polls getUpdates and keeps the history in localStorage.
 * Polling only runs while the page is open.
 */
export function useInbox(options: InboxOptions = {}): InboxState {
  const client = useTelegram(options.botId);
  const pollMs = options.pollMs ?? 3000;
  const cacheKey =
    options.cacheKey ??
    (options.botId === undefined ? "inbox" : `inbox:${normalizeBotId(options.botId)}`);
  const limit = options.limit ?? 300;

  const [updates, setUpdates] = useState<UpdateSummary[]>(() => cacheGet(cacheKey, []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const offsetRef = useRef<number>(0);

  const persist = useCallback(
    (next: UpdateSummary[]) => {
      const trimmed = next.slice(0, limit);
      setUpdates(trimmed);
      cacheSet(cacheKey, trimmed);
    },
    [cacheKey, limit],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await client.getUpdates(offsetRef.current || undefined);
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      setError(undefined);
      const results = ((r.body as { result?: Record<string, unknown>[] })?.result ?? []) as Record<
        string,
        unknown
      >[];
      if (results.length) {
        for (const u of results) {
          const id = typeof u["update_id"] === "number" ? (u["update_id"] as number) : 0;
          offsetRef.current = Math.max(offsetRef.current, id + 1);
        }
        setUpdates((prev) => {
          const incoming = results.map(describeUpdate);
          const merged = [...incoming, ...prev].slice(0, limit);
          cacheSet(cacheKey, merged);
          return merged;
        });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [client, cacheKey, limit]);

  // Initial pull + interval polling while mounted.
  useEffect(() => {
    if (!pollMs) return;
    void refresh();
    const t = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(t);
  }, [pollMs, refresh]);

  const clear = useCallback(() => {
    cacheClear();
    setUpdates([]);
    offsetRef.current = 0;
  }, []);

  const answerCallback = useCallback(
    async (callbackQueryId: string, text?: string) => {
      await client.answerCallbackQuery(callbackQueryId, text ?? "");
    },
    [client],
  );

  return { updates, loading, error, refresh, clear, answerCallback };
}

// ---------- One-shot send helper ----------

export type SendState = {
  sending: boolean;
  lastResult?: unknown;
  error?: string;
};

/** Convenience wrapper around client.sendMessage with pending/error state. */
export function useSend(botId?: BotId): SendState & {
  send: (params: Parameters<TelegramClient["sendMessage"]>[0]) => Promise<unknown>;
} {
  const client = useTelegram(botId);
  const [state, setState] = useState<SendState>({ sending: false });

  const send = useCallback(
    async (params: Parameters<TelegramClient["sendMessage"]>[0]) => {
      setState({ sending: true });
      try {
        const r = await client.sendMessage(params);
        setState({ sending: false, lastResult: r, error: r.ok ? undefined : `HTTP ${r.status}` });
        return r;
      } catch (e) {
        setState({ sending: false, error: String(e) });
        throw e;
      }
    },
    [client],
  );

  return { ...state, send };
}

// Re-exports so apps only need one import from "telegram-workbench/react".
export { cacheGet, cacheSet, cacheClear };
export { parseTelegramLink, describeUpdate } from "./core/link-parser.js";
export type { ParsedTelegramLink, UpdateSummary } from "./core/link-parser.js";
export { TelegramClient } from "./core/client.js";
export type { TelegramClientOptions, SendMessageParams, BroadcastParams } from "./core/client.js";
export { escapeMarkdownV2, escapeHtml } from "./core/client.js";
export { useSyncExternalStore };
