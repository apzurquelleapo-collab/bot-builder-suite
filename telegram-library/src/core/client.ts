/**
 * Telegram Workbench — framework-agnostic Telegram Bot API client.
 * Zero dependencies. Works in Node 18+, Bun, Deno, Cloudflare Workers, Vercel Edge.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type TelegramCallResult = {
  ok: boolean;
  status: number;
  body: Json;
  method: string;
  durationMs: number;
};

export type ParseMode = "HTML" | "MarkdownV2" | "None";

export type TelegramClientOptions = {
  /** Bot token from @BotFather, e.g. "123456:ABC-DEF..." */
  token: string;
  /** Override the API origin (default https://api.telegram.org). */
  apiBaseUrl?: string;
  /** Custom fetch implementation (Node 18+/Bun/Deno/Workers all provide global fetch). */
  fetchImpl?: typeof fetch;
};

export type SendMessageParams = {
  chatId: string;
  text: string;
  parseMode?: ParseMode;
  threadId?: number | null;
  replyToMessageId?: number | null;
  disablePreview?: boolean;
  replyMarkup?: Record<string, unknown> | null;
};

export type BroadcastParams = {
  chatIds: string[];
  threadIds?: (number | null)[];
  text: string;
  parseMode?: ParseMode;
  disablePreview?: boolean;
  replyToMessageId?: number | null;
  mediaKind?: "none" | "photo" | "document" | "voice";
  mediaUrl?: string;
  replyMarkup?: Record<string, unknown> | null;
};

export type BroadcastResult = TelegramCallResult & { chatId: string; threadId: number | null };

export type UploadMediaParams = {
  chatId: string;
  kind: "photo" | "document" | "voice" | "video" | "animation" | "videoNote";
  /** A File (browser) or a Blob + filename (Node). */
  file: Blob;
  filename?: string;
  caption?: string;
  parseMode?: ParseMode;
  threadId?: number | null;
};

const UPLOAD_FIELD: Record<UploadMediaParams["kind"], string> = {
  photo: "photo",
  document: "document",
  voice: "voice",
  video: "video",
  animation: "animation",
  videoNote: "video_note",
};

/**
 * Direct Telegram Bot API client.
 *
 * Security: the bot token is a secret. Run this client on a server/edge backend
 * and expose your own endpoints to the browser — never bundle the token into
 * client-side JavaScript. For quick local scripts it is fine to use it directly.
 */
export class TelegramClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TelegramClientOptions) {
    if (!options.token) throw new Error("TelegramClient requires a bot token");
    this.token = options.token;
    this.baseUrl = (options.apiBaseUrl ?? "https://api.telegram.org").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Raw escape hatch — call any Bot API method by name. */
  async call(method: string, payload: Record<string, unknown> = {}): Promise<TelegramCallResult> {
    if (!/^[a-zA-Z]+$/.test(method)) throw new Error("Invalid Telegram method name");
    const started = Date.now();
    const response = await this.fetchImpl(`${this.baseUrl}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    if (!ok) console.error(`Telegram ${method} failed [${response.status}]: ${raw}`);
    return { ok, status: response.status, body, method, durationMs: Date.now() - started };
  }

  // ---------- Connection ----------

  getMe() {
    return this.call("getMe");
  }

  getWebhookInfo() {
    return this.call("getWebhookInfo");
  }

  async setWebhook(url: string, opts: { secretToken?: string } = {}) {
    return this.call("setWebhook", {
      url,
      secret_token: opts.secretToken,
      allowed_updates: ["message", "edited_message", "channel_post", "callback_query"],
      drop_pending_updates: false,
    });
  }

  deleteWebhook() {
    return this.call("deleteWebhook", { drop_pending_updates: false });
  }

  /** Pull new updates by polling. Clears a blocking webhook automatically on 409. */
  async getUpdates(offset?: number) {
    const payload = {
      offset,
      timeout: 0,
      allowed_updates: ["message", "edited_message", "channel_post", "callback_query"],
    };
    let result = await this.call("getUpdates", payload);
    if (result.status === 409) {
      await this.deleteWebhook();
      result = await this.call("getUpdates", payload);
    }
    return result;
  }

  // ---------- Messaging ----------

  async sendMessage(params: SendMessageParams) {
    const payload: Record<string, unknown> = { chat_id: params.chatId, text: params.text };
    if (params.threadId != null) payload["message_thread_id"] = params.threadId;
    if (params.parseMode && params.parseMode !== "None") payload["parse_mode"] = params.parseMode;
    if (params.replyToMessageId) payload["reply_to_message_id"] = params.replyToMessageId;
    if (params.disablePreview) payload["link_preview_options"] = { is_disabled: true };
    if (params.replyMarkup) payload["reply_markup"] = params.replyMarkup;
    return this.call("sendMessage", payload);
  }

  /**
   * Fan-out to many chats and many forum topics at once
   * (chatIds × threadIds = one message per combination).
   */
  async broadcast(params: BroadcastParams): Promise<BroadcastResult[]> {
    if (!params.chatIds?.length) throw new Error("At least one chat ID is required");
    if (params.mediaKind && params.mediaKind !== "none" && !params.mediaUrl) {
      throw new Error("A media URL is required for photo, document or voice sends");
    }
    if ((!params.mediaKind || params.mediaKind === "none") && !params.text?.trim()) {
      throw new Error("Message text is required");
    }

    const threadIds = params.threadIds?.length ? params.threadIds : [null];
    const method =
      params.mediaKind === "photo"
        ? "sendPhoto"
        : params.mediaKind === "document"
          ? "sendDocument"
          : params.mediaKind === "voice"
            ? "sendVoice"
            : "sendMessage";

    const results: BroadcastResult[] = [];
    for (const chatId of params.chatIds) {
      for (const threadId of threadIds) {
        const payload: Record<string, unknown> = { chat_id: chatId };
        if (threadId != null) payload["message_thread_id"] = threadId;
        if (params.parseMode && params.parseMode !== "None")
          payload["parse_mode"] = params.parseMode;
        if (params.replyToMessageId) payload["reply_to_message_id"] = params.replyToMessageId;
        if (params.replyMarkup) payload["reply_markup"] = params.replyMarkup;

        if (method === "sendMessage") {
          payload["text"] = params.text;
          if (params.disablePreview) payload["link_preview_options"] = { is_disabled: true };
        } else {
          if (params.text?.trim()) payload["caption"] = params.text;
          payload[method === "sendPhoto" ? "photo" : method === "sendDocument" ? "document" : "voice"] =
            params.mediaUrl;
        }

        const result = await this.call(method, payload);
        results.push({ ...result, chatId, threadId });
      }
    }
    return results;
  }

  // ---------- Media uploads ----------

  /** Upload a file from disk or the browser via multipart/form-data. */
  async uploadMedia(params: UploadMediaParams) {
    const field = UPLOAD_FIELD[params.kind];
    const form = new FormData();
    form.append("chat_id", params.chatId);
    if (params.threadId != null) form.append("message_thread_id", String(params.threadId));
    if (params.caption?.trim()) {
      form.append("caption", params.caption.trim());
      if (params.parseMode && params.parseMode !== "None")
        form.append("parse_mode", params.parseMode);
    }
    form.append(field, params.file, params.filename ?? "upload");

    const started = Date.now();
    const response = await this.fetchImpl(`${this.baseUrl}/bot${this.token}/${field === "video_note" ? "sendVideoNote" : `send${field[0]!.toUpperCase()}${field.slice(1)}`}`, {
      method: "POST",
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
    if (!ok) console.error(`Telegram upload (${params.kind}) failed [${response.status}]: ${raw}`);
    return { ok, status: response.status, body, method: field, durationMs: Date.now() - started };
  }

  // ---------- Callbacks & message management ----------

  answerCallbackQuery(callbackQueryId: string, text = "") {
    return this.call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
  }

  editMessageText(chatId: string, messageId: number, text: string, parseMode?: ParseMode) {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };
    if (parseMode && parseMode !== "None") payload["parse_mode"] = parseMode;
    return this.call("editMessageText", payload);
  }

  deleteMessage(chatId: string, messageId: number) {
    return this.call("deleteMessage", { chat_id: chatId, message_id: messageId });
  }

  forwardMessage(fromChatId: string, toChatId: string, messageId: number) {
    return this.call("forwardMessage", {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    });
  }

  copyMessage(fromChatId: string, toChatId: string, messageId: number) {
    return this.call("copyMessage", {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    });
  }

  pinChatMessage(chatId: string, messageId: number) {
    return this.call("pinChatMessage", { chat_id: chatId, message_id: messageId });
  }

  setMessageReaction(chatId: string, messageId: number, emoji: string) {
    return this.call("setMessageReaction", {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: "emoji", emoji }],
    });
  }

  sendChatAction(chatId: string, action = "typing") {
    return this.call("sendChatAction", { chat_id: chatId, action });
  }

  // ---------- Group admin & forum topics ----------

  createForumTopic(chatId: string, name: string) {
    return this.call("createForumTopic", { chat_id: chatId, name });
  }

  closeForumTopic(chatId: string, threadId: number) {
    return this.call("closeForumTopic", { chat_id: chatId, message_thread_id: threadId });
  }

  reopenForumTopic(chatId: string, threadId: number) {
    return this.call("reopenForumTopic", { chat_id: chatId, message_thread_id: threadId });
  }

  deleteForumTopic(chatId: string, threadId: number) {
    return this.call("deleteForumTopic", { chat_id: chatId, message_thread_id: threadId });
  }

  banChatMember(chatId: string, userId: number) {
    return this.call("banChatMember", { chat_id: chatId, user_id: userId });
  }

  unbanChatMember(chatId: string, userId: number) {
    return this.call("unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
  }

  createChatInviteLink(chatId: string) {
    return this.call("createChatInviteLink", { chat_id: chatId });
  }

  setMyCommands(commands: { command: string; description: string }[]) {
    return this.call("setMyCommands", { commands });
  }

  // ---------- Extras ----------

  sendPoll(chatId: string, question: string, options: string[], quiz = false, threadId?: number | null) {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      question,
      options,
      type: quiz ? "quiz" : "regular",
    };
    if (threadId != null) payload["message_thread_id"] = threadId;
    return this.call("sendPoll", payload);
  }

  sendDice(chatId: string, emoji = "🎲") {
    return this.call("sendDice", { chat_id: chatId, emoji });
  }

  sendLocation(chatId: string, latitude: number, longitude: number) {
    return this.call("sendLocation", { chat_id: chatId, latitude, longitude });
  }

  sendContact(chatId: string, phoneNumber: string, firstName: string) {
    return this.call("sendContact", { chat_id: chatId, phone_number: phoneNumber, first_name: firstName });
  }
}

/** Escape text for MarkdownV2 (outside code blocks). */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/** Escape text for HTML parse mode. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
