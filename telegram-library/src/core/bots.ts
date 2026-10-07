/**
 * Multi-bot registry.
 *
 * Env convention (any number of bots):
 *   TELEGRAM_BOT_TOKEN          -> bot "1" (the default)
 *   TELEGRAM_BOT_TOKEN_2        -> bot "2"
 *   TELEGRAM_BOT_TOKEN_3        -> bot "3" ...
 *   TELEGRAM_BOT_TOKEN_ALERTS   -> bot "alerts" (named bots work too)
 */
import { TelegramClient, type TelegramClientOptions, type BroadcastParams, type BroadcastResult } from "./client.js";

export const DEFAULT_BOT_ID = "1";
const ENV_PREFIX = "TELEGRAM_BOT_TOKEN";

export type BotId = string | number;

/** Normalise "TELEGRAM_BOT_TOKEN_2" / 2 / "2" / undefined into a bot id. */
export function normalizeBotId(id?: BotId | null): string {
  if (id === undefined || id === null || id === "") return DEFAULT_BOT_ID;
  return String(id).trim().toLowerCase();
}

/** Env variable name for a bot id: "1" -> TELEGRAM_BOT_TOKEN, "2" -> TELEGRAM_BOT_TOKEN_2. */
export function envNameForBot(id?: BotId | null, prefix = ENV_PREFIX): string {
  const n = normalizeBotId(id);
  return n === DEFAULT_BOT_ID ? prefix : `${prefix}_${n.toUpperCase()}`;
}

/** Find every bot token in an env object. */
export function discoverBotTokens(
  env: Record<string, string | undefined>,
  prefix = ENV_PREFIX,
): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (key === prefix || key === `${prefix}_1`) {
      found[DEFAULT_BOT_ID] ??= value;
    } else if (key.startsWith(`${prefix}_`)) {
      const id = key.slice(prefix.length + 1).toLowerCase();
      if (id) found[id] = value;
    }
  }
  return found;
}

export type BotsOptions = Omit<TelegramClientOptions, "token">;

export class TelegramBots {
  private readonly clients = new Map<string, TelegramClient>();

  constructor(
    tokens: Record<string, string | TelegramClient> = {},
    private readonly options: BotsOptions = {},
  ) {
    for (const [id, t] of Object.entries(tokens)) this.register(id, t);
  }

  /** Build from env vars (process.env, import.meta.env, Deno.env.toObject(), ...). */
  static fromEnv(env: Record<string, string | undefined>, options: BotsOptions & { prefix?: string } = {}) {
    const { prefix, ...rest } = options;
    return new TelegramBots(discoverBotTokens(env, prefix), rest);
  }

  register(id: BotId, tokenOrClient: string | TelegramClient): TelegramClient {
    const client =
      typeof tokenOrClient === "string"
        ? new TelegramClient({ ...this.options, token: tokenOrClient })
        : tokenOrClient;
    this.clients.set(normalizeBotId(id), client);
    return client;
  }

  remove(id: BotId) {
    this.clients.delete(normalizeBotId(id));
  }

  has(id?: BotId | null) {
    return this.clients.has(normalizeBotId(id));
  }

  /** Get a bot. No id = default bot ("1"), or the only bot if just one is configured. */
  get(id?: BotId | null): TelegramClient {
    const key = normalizeBotId(id);
    const client = this.clients.get(key);
    if (client) return client;
    if ((id === undefined || id === null || id === "") && this.clients.size > 0) {
      return this.clients.values().next().value as TelegramClient;
    }
    throw new Error(
      `Telegram bot "${key}" is not configured (expected env ${envNameForBot(key)}). Known bots: ${this.ids().join(", ") || "none"}`,
    );
  }

  ids(): string[] {
    return [...this.clients.keys()];
  }

  get size() {
    return this.clients.size;
  }

  /** getMe for every bot — handy for a status page. */
  async list() {
    return Promise.all(
      this.ids().map(async (id) => {
        try {
          const r = await this.get(id).getMe();
          const me = (r.body as { result?: { username?: string; first_name?: string } })?.result;
          return { id, ok: r.ok, username: me?.username, name: me?.first_name };
        } catch (e) {
          return { id, ok: false, error: String(e) };
        }
      }),
    );
  }

  /** Same message from several bots, each to several chats × topics. */
  async broadcastFromBots(
    botIds: BotId[],
    params: BroadcastParams,
  ): Promise<(BroadcastResult & { botId: string })[]> {
    const all: (BroadcastResult & { botId: string })[] = [];
    for (const id of botIds) {
      const results = await this.get(id).broadcast(params);
      for (const r of results) all.push({ ...r, botId: normalizeBotId(id) });
    }
    return all;
  }
}
