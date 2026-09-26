export type ParsedTelegramLink = {
  chatId: string;
  threadId?: number;
  messageId?: number;
  kind: "private-group" | "public" | "raw-id";
  note: string;
};

/**
 * Decode a Telegram share link into chat_id / message_thread_id.
 * Supports t.me/c/<id>/<topic>/<msg>, t.me/c/<id>/<topic>, t.me/<user>/<topic>/<msg>,
 * ?thread= / ?topic= params, tg://privatepost, and raw ids.
 */
export function parseTelegramLink(input: string): ParsedTelegramLink | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^-?\d+$/.test(raw)) return { chatId: raw, kind: "raw-id", note: "Numeric chat ID" };
  if (/^@\w{4,}$/.test(raw)) return { chatId: raw, kind: "public", note: "Public username" };

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const qThread = Number(url.searchParams.get("thread") ?? url.searchParams.get("topic") ?? NaN);

  // tg://privatepost?channel=123&post=5&thread=7
  if (url.protocol === "tg:") {
    const channel = url.searchParams.get("channel");
    const domain = url.searchParams.get("domain");
    const post = Number(url.searchParams.get("post") ?? NaN);
    if (channel) return { chatId: `-100${channel}`, threadId: isNaN(qThread) ? undefined : qThread, messageId: isNaN(post) ? undefined : post, kind: "private-group", note: "Private group/channel" };
    if (domain) return { chatId: `@${domain}`, threadId: isNaN(qThread) ? undefined : qThread, messageId: isNaN(post) ? undefined : post, kind: "public", note: "Public group/channel" };
    return null;
  }

  if (!/(^|\.)t\.me$|(^|\.)telegram\.(me|dog)$/i.test(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "s") parts.shift();

  const nums = (arr: string[]) => arr.map(Number).filter((n) => !isNaN(n));

  if (parts[0] === "c" && /^\d+$/.test(parts[1] ?? "")) {
    const rest = nums(parts.slice(2));
    const chatId = `-100${parts[1]}`;
    let threadId: number | undefined;
    let messageId: number | undefined;
    if (rest.length >= 2) [threadId, messageId] = rest;
    else if (rest.length === 1) threadId = rest[0];
    if (!isNaN(qThread)) threadId = qThread;
    return { chatId, threadId, messageId, kind: "private-group", note: threadId ? "Private supergroup topic" : "Private group/channel" };
  }

  const user = parts[0];
  if (user && /^\w{4,}$/.test(user)) {
    const rest = nums(parts.slice(1));
    let threadId: number | undefined;
    let messageId: number | undefined;
    if (rest.length >= 2) [threadId, messageId] = rest;
    else if (rest.length === 1) threadId = rest[0];
    if (!isNaN(qThread)) threadId = qThread;
    return { chatId: `@${user}`, threadId, messageId, kind: "public", note: threadId ? "Public group topic" : "Public user/group/channel" };
  }
  return null;
}
