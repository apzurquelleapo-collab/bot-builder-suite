# Telegram Library — Integration & Usage Guide

How to connect the Telegram bot library from the **Telegram Bot Workbench** project into any other Lovable project, and how to use every feature it provides.

---

## 1. What you get

A server-side Telegram client built on TanStack Start server functions. It gives you:

| Capability | Function / Method |
|---|---|
| Check bot connection | `getBotInfo` → `getMe` |
| Manage the webhook | `registerWebhook`, `getWebhookInfo`, `removeWebhook` |
| Send messages (single, multi-chat, multi-topic) | `sendBroadcast` → `sendMessage` |
| Send media (photo / document / voice) | `sendBroadcast` with `mediaKind` |
| Keyboards (inline + reply) | `replyMarkup` in any send |
| Answer button taps | `answerCallback` → `answerCallbackQuery` |
| Edit / forward / copy / pin / delete messages | `editMessageText`, `forwardMessage`, `copyMessage`, `pinChatMessage`, `deleteMessage` |
| Reactions & "typing…" | `setMessageReaction`, `sendChatAction` |
| Albums, stickers, GIFs, videos | `sendMediaGroup`, `sendSticker`, `sendAnimation`, `sendVideo` |
| Polls, quizzes, dice, location, venue, contact | `sendPoll`, `sendDice`, `sendLocation`, `sendVenue`, `sendContact` |
| Payments (Telegram Stars) | `sendInvoice` |
| Receive messages | webhook route → `telegram_updates` table |
| Audit log of every API call | `telegram_api_log` table |
| Generic escape hatch (any Bot API method) | `telegramCall({ method, payload })` |

---

## 2. Connecting it to a new project

### Step 1 — Connect Telegram in Lovable

1. In the new project, open **Connectors → Telegram** and connect your bot (the same bot can be shared, or create a new one with @BotFather).
2. This makes two secrets available to server code:
   - `LOVABLE_API_KEY` (automatic)
   - `TELEGRAM_API_KEY` (from the connection)

### Step 2 — Copy the library file

Copy `src/lib/telegram.functions.ts` into the new project at the same path. It is self-contained — the only dependency is the optional audit log (see Step 3).

### Step 3 — (Optional) Enable the database pieces

Only needed if you want the **live inbox** and the **API call log**:

- Run the migration that creates `telegram_updates` and `telegram_api_log` (copy it from this project's `supabase/migrations`).
- Copy the webhook route `src/routes/api/public/telegram/webhook.ts`.

If you only need to **send** messages, skip this step and delete the `supabaseAdmin` logging block inside `callTelegram` (or leave it — it fails silently if the table is missing).

### Step 4 — Register the webhook (only if receiving messages)

Each project needs its own webhook URL. From the new project, call:

```ts
await registerWebhook({ url: "https://project--<new-project-id>-dev.<host>/api/public/telegram/webhook" });
```

⚠️ **One bot = one webhook.** If two projects share one bot, only the last registered URL receives messages. Use a separate bot per project if both need inbound messages.

---

## 3. How to call it

All functions are TanStack Start server functions — call them from any component with `useServerFn`, or from other server code directly.

```tsx
import { useServerFn } from "@tanstack/react-start";
import { sendBroadcast } from "@/lib/telegram.functions";

const send = useServerFn(sendBroadcast);

const result = await send({
  data: {
    chatIds: ["7012824179"],
    text: "Hello from my other project!",
    parseMode: "HTML",
  },
});

if (result.ok) {
  // result.body contains Telegram's response (message_id, chat, …)
} else {
  // result.status + result.body explain the failure
}
```

Every call returns the same shape:

```ts
{ ok: boolean; status: number; body: Json; method: string; durationMs: number }
```

For anything without a dedicated function, use the escape hatch:

```ts
await telegramCall({ data: { method: "getChat", payload: { chat_id: "-1001234567890" } } });
```

---

## 4. Using each feature

### 4.1 Simple message

```ts
sendBroadcast({ data: { chatIds: ["7012824179"], text: "Hi!", parseMode: "HTML" } });
```

### 4.2 Multi-group & multi-topic broadcast

Send to every combination of chats × forum topics in one call:

```ts
sendBroadcast({
  data: {
    chatIds: ["-1001111111111", "-1002222222222"],   // several groups/channels
    threadIds: [12, 34],                             // several forum topics
    text: "Broadcast to 4 destinations",
    parseMode: "HTML",
  },
});
```

- Group/channel IDs are negative numbers as strings (`-100…`).
- Topic IDs come from the link decoder (`parseTelegramLink`) or the inbox feed.

### 4.3 Formatting

`parseMode: "HTML"` (recommended — only `<`, `>`, `&` need escaping):

```html
<b>Bold</b> <i>italic</i> <u>underline</u> <s>strike</s>
<tg-spoiler>spoiler</tg-spoiler>
<code>inline code</code>
<pre><code class="language-python">print("hi")</code></pre>
<a href="https://example.com">link</a>
<blockquote>quote</blockquote>
```

`parseMode: "MarkdownV2"` — every special character outside styling must be escaped with `\`:
`! ( ) . - # + = | { } [ ] > _ * ~ \``. An unescaped `!` or an unclosed ``` block makes Telegram reject the message. This is the #1 cause of "MarkdownV2 not working".

### 4.4 Inline keyboard buttons

```ts
sendBroadcast({
  data: {
    chatIds: ["7012824179"],
    text: "Pick one:",
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "✅ Yes", callback_data: "yes" },
          { text: "❌ No", callback_data: "no" },
        ],
        [{ text: "🌐 Open website", url: "https://example.com" }],
        [{ text: "📋 Copy code", copy_text: { text: "PROMO-2026" } }],
      ],
    },
  },
});
```

Button taps arrive in the inbox as `callback_query` — answer them so the loading spinner stops:

```ts
answerCallback({ data: { callbackQueryId: "<id from inbox>", text: "You picked Yes!" } });
```

A **calendar** is just an inline keyboard: one row per week, one button per day, `callback_data` like `cal:2026-10-05`. Month switching = `editMessageText` with a rebuilt keyboard.

### 4.5 Reply keyboard (menu under the input field)

```ts
replyMarkup: {
  keyboard: [
    [{ text: "📍 Share location", request_location: true }],
    [{ text: "📞 Share contact", request_contact: true }],
    [{ text: "Help" }, { text: "Settings" }],
  ],
  resize_keyboard: true,
}
```

Remove it with `replyMarkup: { remove_keyboard: true }`.

### 4.6 Media

```ts
sendBroadcast({
  data: {
    chatIds: ["7012824179"],
    text: "Caption with <b>formatting</b>",
    parseMode: "HTML",
    mediaKind: "photo",            // "photo" | "document" | "voice" | "none"
    mediaUrl: "https://…/pic.jpg", // URL, file_id, or uploaded file
  },
});
```

Albums (2–10 items in one message):

```ts
telegramCall({
  data: {
    method: "sendMediaGroup",
    payload: {
      chat_id: "7012824179",
      media: [
        { type: "photo", media: "https://…/1.jpg" },
        { type: "photo", media: "https://…/2.jpg", caption: "Second" },
      ],
    },
  },
});
```

### 4.7 Polls, quiz, dice

```ts
// Poll
telegramCall({ data: { method: "sendPoll", payload: {
  chat_id: "7012824179",
  question: "Best framework?",
  options: [{ text: "React" }, { text: "Vue" }],
  is_anonymous: false,
}}});

// Quiz (same call, type "quiz" + correct option)
telegramCall({ data: { method: "sendPoll", payload: {
  chat_id: "7012824179",
  question: "2 + 2 = ?",
  options: [{ text: "3" }, { text: "4" }, { text: "5" }],
  type: "quiz",
  correct_option_id: 1,
}}});

// Dice 🎲 (also 🎯 🏀 ⚽ 🎳 🎰 via emoji)
telegramCall({ data: { method: "sendDice", payload: { chat_id: "7012824179", emoji: "🎰" } } });
```

### 4.8 Location, venue, contact

```ts
telegramCall({ data: { method: "sendLocation", payload: { chat_id: "7012824179", latitude: 48.2082, longitude: 16.3738 } } });
telegramCall({ data: { method: "sendVenue", payload: { chat_id: "7012824179", latitude: 48.2082, longitude: 16.3738, title: "Office", address: "Vienna" } } });
telegramCall({ data: { method: "sendContact", payload: { chat_id: "7012824179", phone_number: "+43…", first_name: "Jane" } } });
```

### 4.9 Edit, forward, copy, pin, delete, react

```ts
telegramCall({ data: { method: "editMessageText", payload: { chat_id, message_id, text: "Updated!", parse_mode: "HTML" } } });
telegramCall({ data: { method: "forwardMessage", payload: { chat_id: target, from_chat_id: source, message_id } } });
telegramCall({ data: { method: "copyMessage", payload: { chat_id: target, from_chat_id: source, message_id } } });
telegramCall({ data: { method: "pinChatMessage", payload: { chat_id, message_id, disable_notification: true } } });
telegramCall({ data: { method: "deleteMessage", payload: { chat_id, message_id } } });
telegramCall({ data: { method: "setMessageReaction", payload: { chat_id, message_id, reaction: [{ type: "emoji", emoji: "🔥" }] } } });
telegramCall({ data: { method: "sendChatAction", payload: { chat_id, action: "typing" } } });
```

### 4.10 Payments (Telegram Stars)

```ts
telegramCall({ data: { method: "sendInvoice", payload: {
  chat_id: "7012824179",
  title: "Premium plan",
  description: "One month of premium access",
  payload: "premium-1m-user-123",     // your internal reference
  currency: "XTR",                     // XTR = Telegram Stars
  prices: [{ label: "Premium", amount: 250 }],  // amount in Stars
}}});
```

### 4.11 Receiving messages

Incoming updates land in the `telegram_updates` table (verified by a secret token derived from `TELEGRAM_API_KEY`). Each row has: `update_id`, `chat_id`, `message_thread_id` (topic), `user_id`, `text`, `kind` (`message` / `callback_query` / `photo` / `document`), `status` (`new` / `accepted` / `dismissed`) and the full `raw` JSON. Subscribe with Supabase Realtime for a live feed.

### 4.12 Decoding Telegram links

`parseTelegramLink(input)` from `src/lib/telegram-link.ts` turns any of these into `{ chatId, threadId?, messageId? }`:

- `https://t.me/c/1234567890/12/345` → private group, topic 12
- `https://t.me/publicchannel/55` → public channel
- `tg://privatepost?channel=1234567890&post=55&thread=12`
- Raw IDs (`-1001234567890`) and `@usernames`

Note: for private-group links, Telegram's `/c/<id>` number becomes `-100<id>`.

---

## 5. Errors & debugging

- Every call is logged to `telegram_api_log` (method, request, response, status) — check there first when something fails.
- `result.ok === false` → read `result.body`: Telegram's own error message names the exact problem (bad chat id, unescaped Markdown character, missing permission…).
- Common failures: bot not admin in a channel, bot blocked by the user, chat id without the `-100` prefix, MarkdownV2 special characters not escaped.

---

## 6. Checklist for a new project

1. ☐ Connect the Telegram connector (gets `TELEGRAM_API_KEY`)
2. ☐ Copy `src/lib/telegram.functions.ts` (and `telegram-link.ts` if you want link decoding)
3. ☐ Sending only? Done. Receiving too? → copy the migration + webhook route, register the webhook
4. ☐ Test with `getBotInfo` — if it returns your bot's username, everything is wired up
