import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type TelegramCallResult = {
  ok: boolean;
  status: number;
  body: Json;
  method: string;
  durationMs: number;
};

/**
 * Direct mode: when TELEGRAM_BOT_TOKEN is set (project .env), the app talks to
 * api.telegram.org itself — fully independent of Lovable connectors.
 * Fallback: the Lovable connector gateway (TELEGRAM_API_KEY + LOVABLE_API_KEY).
 */
/** Bot ids: 1 (default) -> TELEGRAM_BOT_TOKEN, 2 -> TELEGRAM_BOT_TOKEN_2, "alerts" -> TELEGRAM_BOT_TOKEN_ALERTS. */
export type BotRef = { botId?: string | number | null };

function botEnvName(botId?: string | number | null): string {
  const id = botId == null || botId === "" ? "1" : String(botId).trim().toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(id)) throw new Error("Invalid bot id");
  return id === "1" ? "TELEGRAM_BOT_TOKEN" : `TELEGRAM_BOT_TOKEN_${id}`;
}

function botToken(botId?: string | number | null): string | undefined {
  const name = botEnvName(botId);
  const token = process.env[name] ?? (name === "TELEGRAM_BOT_TOKEN" ? process.env["TELEGRAM_BOT_TOKEN_1"] : undefined);
  if (!token && name !== "TELEGRAM_BOT_TOKEN") throw new Error(`Bot not configured: set ${name} in .env`);
  return token;
}

function telegramEndpoint(
  method: string,
  botId?: string | number | null,
): { url: string; headers: Record<string, string> } {
  const botToken_ = botToken(botId);
  const botToken = botToken_;
  if (botToken) {
    return {
      url: `https://api.telegram.org/bot${botToken}/${method}`,
      headers: { "Content-Type": "application/json" },
    };
  }
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const telegramKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey || !telegramKey) {
    throw new Error(
      "No Telegram credentials: set TELEGRAM_BOT_TOKEN in .env (direct mode) or link the Telegram connector",
    );
  }
  return {
    url: `${GATEWAY_URL}/${method}`,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
  };
}

async function callTelegram(
  method: string,
  payload: Record<string, unknown>,
  botId?: string | number | null,
): Promise<TelegramCallResult> {
  const { url, headers } = telegramEndpoint(method, botId);

  const started = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let body: Json;
  try {
    body = JSON.parse(raw) as Json;
  } catch {
    body = raw;
  }

  const ok =
    response.ok &&
    (typeof body !== "object" || body === null || (body as { ok?: boolean }).ok !== false);

  if (!response.ok) {
    console.error(`Telegram ${method} failed [${response.status}]: ${raw}`);
  }

  const result: TelegramCallResult = {
    ok,
    status: response.status,
    body,
    method,
    durationMs: Date.now() - started,
  };

  return result;
}

export async function deriveTelegramWebhookSecret(credential: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`telegram-webhook:${credential}`).digest("base64url");
}

function telegramCredential(botId?: string | number | null): string {
  const credential = botToken(botId) ?? process.env["TELEGRAM_API_KEY"];
  if (!credential) throw new Error("No Telegram credential configured");
  return credential;
}

/** Generic escape hatch used by the payload tester. */
export const telegramCall = createServerFn({ method: "POST" })
  .inputValidator((input: { method: string; payload?: Record<string, unknown> } & BotRef) => {
    if (!input?.method || !/^[a-zA-Z]+$/.test(input.method)) {
      throw new Error("Invalid Telegram method name");
    }
    return { method: input.method, payload: input.payload ?? {}, botId: input.botId };
  })
  .handler(async ({ data }) => callTelegram(data.method, data.payload, data.botId));

export const getBotInfo = createServerFn({ method: "POST" })
  .inputValidator((d: BotRef | undefined) => ({ botId: d?.botId ?? null }))
  .handler(async ({ data }) => callTelegram("getMe", {}, data.botId));

export const getWebhookInfo = createServerFn({ method: "POST" })
  .inputValidator((d: BotRef | undefined) => ({ botId: d?.botId ?? null }))
  .handler(async ({ data }) => callTelegram("getWebhookInfo", {}, data.botId));

export const registerWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string } & BotRef) => {
    if (!input?.url?.startsWith("https://")) throw new Error("Webhook URL must start with https://");
    return input;
  })
  .handler(async ({ data }) =>
    callTelegram("setWebhook", {
      url: data.url,
      secret_token: await deriveTelegramWebhookSecret(telegramCredential(data.botId)),
      allowed_updates: ["message", "edited_message", "channel_post", "callback_query"],
      drop_pending_updates: false,
    }, data.botId),
  );

export const removeWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: BotRef | undefined) => ({ botId: d?.botId ?? null }))
  .handler(async ({ data }) => callTelegram("deleteWebhook", { drop_pending_updates: false }, data.botId));

export type SendPayload = BotRef & {
  chatIds: string[];
  threadIds?: (number | null)[];
  text: string;
  parseMode?: "HTML" | "MarkdownV2" | "None";
  disablePreview?: boolean;
  replyToMessageId?: number | null;
  mediaKind?: "none" | "photo" | "document" | "voice";
  mediaUrl?: string;
  replyMarkup?: Record<string, unknown> | null;
};

export const sendBroadcast = createServerFn({ method: "POST" })
  .inputValidator((input: SendPayload) => {
    if (!input?.chatIds?.length) throw new Error("At least one chat ID is required");
    if (input.mediaKind && input.mediaKind !== "none" && !input.mediaUrl) {
      throw new Error("A media URL is required for photo, document or voice sends");
    }
    if ((!input.mediaKind || input.mediaKind === "none") && !input.text?.trim()) {
      throw new Error("Message text is required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const threadIds = data.threadIds?.length ? data.threadIds : [null];
    const method =
      data.mediaKind === "photo"
        ? "sendPhoto"
        : data.mediaKind === "document"
          ? "sendDocument"
          : data.mediaKind === "voice"
            ? "sendVoice"
            : "sendMessage";

    const results: (TelegramCallResult & { chatId: string; threadId: number | null })[] = [];

    for (const chatId of data.chatIds) {
      for (const threadId of threadIds) {
        const payload: Record<string, unknown> = { chat_id: chatId };
        if (threadId != null) payload["message_thread_id"] = threadId;
        if (data.parseMode && data.parseMode !== "None") payload["parse_mode"] = data.parseMode;
        if (data.replyToMessageId) payload["reply_to_message_id"] = data.replyToMessageId;
        if (data.replyMarkup) payload["reply_markup"] = data.replyMarkup;

        if (method === "sendMessage") {
          payload["text"] = data.text;
          if (data.disablePreview) payload["link_preview_options"] = { is_disabled: true };
        } else {
          if (data.text?.trim()) payload["caption"] = data.text;
          payload[
            method === "sendPhoto" ? "photo" : method === "sendDocument" ? "document" : "voice"
          ] = data.mediaUrl;
        }

        const result = await callTelegram(method, payload, data.botId);
        results.push({ ...result, chatId, threadId });
      }
    }

    return results;
  });

export const answerCallback = createServerFn({ method: "POST" })
  .inputValidator((input: { callbackQueryId: string; text?: string } & BotRef) => {
    if (!input?.callbackQueryId) throw new Error("callback_query_id is required");
    return input;
  })
  .handler(async ({ data }) =>
    callTelegram("answerCallbackQuery", {
      callback_query_id: data.callbackQueryId,
      text: data.text ?? "",
    }, data.botId),
  );

// ============= File uploads (multipart/form-data) =============

const UPLOAD_KINDS = {
  photo: "sendPhoto",
  document: "sendDocument",
  voice: "sendVoice",
  video: "sendVideo",
  animation: "sendAnimation",
  videoNote: "sendVideoNote",
} as const;

export type UploadPayload = BotRef & {
  chatId: string;
  kind: keyof typeof UPLOAD_KINDS;
  fileBase64: string;
  filename: string;
  caption?: string;
  parseMode?: "HTML" | "MarkdownV2" | "None";
  threadId?: number | null;
};

/** Sends a file straight from the user's computer via multipart/form-data. */
export const uploadMedia = createServerFn({ method: "POST" })
  .inputValidator((input: UploadPayload) => {
    if (!input?.chatId?.trim()) throw new Error("A chat ID is required");
    if (!UPLOAD_KINDS[input.kind]) throw new Error("Unknown media kind");
    if (!input.fileBase64) throw new Error("A file is required");
    if (input.fileBase64.length > 14_000_000) {
      throw new Error("File is too large — keep uploads under about 10 MB");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { url, headers } = telegramEndpoint(UPLOAD_KINDS[data.kind], data.botId);
    // Multipart: browser/fetch sets its own Content-Type boundary — drop ours.
    delete headers["Content-Type"];

    const base64 = data.fileBase64.includes(",") ? data.fileBase64.split(",")[1]! : data.fileBase64;
    const buffer = Buffer.from(base64, "base64");

    const form = new FormData();
    form.append("chat_id", data.chatId.trim());
    if (data.threadId != null) form.append("message_thread_id", String(data.threadId));
    if (data.caption?.trim()) {
      form.append("caption", data.caption.trim());
      if (data.parseMode && data.parseMode !== "None") form.append("parse_mode", data.parseMode);
    }
    form.append(
      data.kind === "videoNote" ? "video_note" : data.kind,
      new Blob([new Uint8Array(buffer)]),
      data.filename || "upload",
    );

    const method = UPLOAD_KINDS[data.kind];
    const started = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: form,
    });

    const raw = await response.text();
    let body: Json;
    try {
      body = JSON.parse(raw) as Json;
    } catch {
      body = raw;
    }
    const ok =
      response.ok &&
      (typeof body !== "object" || body === null || (body as { ok?: boolean }).ok !== false);

    if (!response.ok) {
      console.error(`Telegram ${method} upload failed [${response.status}]: ${raw}`);
    }

    return { ok, status: response.status, body, method, durationMs: Date.now() - started };
  });

/** Pull new updates (no webhook, no database). Clears the webhook if one blocks polling. */
export const pollUpdates = createServerFn({ method: "POST" })
  .inputValidator((d: { offset?: number | undefined } & BotRef) => ({ offset: typeof d?.offset === "number" ? d.offset : undefined, botId: d?.botId ?? null }))
  .handler(async ({ data }) => {
    const payload = { offset: data.offset, timeout: 0, allowed_updates: ["message", "edited_message", "channel_post", "callback_query"] };
    let r = await callTelegram("getUpdates", payload, data.botId);
    if (r.status === 409) {
      await callTelegram("deleteWebhook", { drop_pending_updates: false }, data.botId);
      r = await callTelegram("getUpdates", payload, data.botId);
    }
    return r;
  });

/** Every bot configured in .env (TELEGRAM_BOT_TOKEN, _2, _3, _NAME...) with its username. */
export const listBots = createServerFn({ method: "POST" }).handler(async () => {
  const ids = new Set<string>();
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    if (k === "TELEGRAM_BOT_TOKEN" || k === "TELEGRAM_BOT_TOKEN_1") ids.add("1");
    else if (k.startsWith("TELEGRAM_BOT_TOKEN_")) ids.add(k.slice(19).toLowerCase());
  }
  if (ids.size === 0) ids.add("1"); // connector fallback
  return Promise.all(
    [...ids].map(async (id) => {
      try {
        const r = await callTelegram("getMe", {}, id);
        const me = (r.body as { result?: { username?: string; first_name?: string } })?.result;
        return { id, env: botEnvName(id), ok: r.ok, username: me?.username ?? null, name: me?.first_name ?? null };
      } catch (e) {
        return { id, env: botEnvName(id), ok: false, username: null, name: null, error: String(e) };
      }
    }),
  );
});
