# telegram-workbench — Use it as a React library in any project

The folder `telegram-library/` is a standalone package. It has **no dependencies**: no Lovable, no Supabase, no TanStack. React is optional.

- `telegram-workbench` is the core client. It works in Node, Bun, Deno, Workers and the browser.
- `telegram-workbench/react` adds a Provider and hooks (`useBotStatus`, `useInbox`, `useSend`).

---

## 1. Add it to another project

Choose one option:

**A. Copy the folder (simplest)**
1. Copy `telegram-library/` into your other project, for example to `packages/telegram-library/`.
2. Build it: `cd packages/telegram-library && bun install && bun run build`. This creates `dist/`.
3. Install it: `bun add ./packages/telegram-library`. npm works too: `npm i ./packages/telegram-library`.

**B. Install from GitHub**
1. Push `telegram-library/` to its own repo, with `dist/` committed or built in a `prepare` script.
2. Install it: `bun add github:<you>/telegram-workbench`

**C. Publish to npm**
1. Run `cd telegram-library && bun run build && npm publish`. You can rename it in `package.json` first.
2. Install it everywhere: `bun add telegram-workbench`

---

## 2. The bot token

Get a token from @BotFather. It looks like `123456:ABC-DEF...`.

- **Server, recommended:** keep it in `.env` as `TELEGRAM_BOT_TOKEN=...` and create the client only in server code.
- **Browser:** this works for private tools only. The token is visible to anyone who opens the app, for example through `VITE_TELEGRAM_BOT_TOKEN`. Never do this in a public site.

```ts
import { TelegramClient } from "telegram-workbench";
export const tg = new TelegramClient({ token: process.env.TELEGRAM_BOT_TOKEN! });
```

Every call returns `{ ok, status, body, method, durationMs }`.

---

## 3. React setup

```tsx
import { TelegramClient } from "telegram-workbench";
import { TelegramProvider } from "telegram-workbench/react";

const client = new TelegramClient({ token: import.meta.env.VITE_TELEGRAM_BOT_TOKEN });

export function App() {
  return <TelegramProvider client={client}><Dashboard /></TelegramProvider>;
}
```

### Hooks

```tsx
import { useBotStatus, useSend, useInbox } from "telegram-workbench/react";

function Dashboard() {
  const bot = useBotStatus();                 // { loading, connected, botName, botUsername, error, refresh }
  const { send, sending } = useSend();        // send({ chatId, text, parseMode, replyMarkup, threadId })
  const inbox = useInbox({ pollMs: 3000 });   // { updates, loading, error, refresh, clear, answerCallback }

  return (
    <div>
      <p>{bot.connected ? `Connected as ${bot.botUsername}` : "Not connected"}</p>
      <button disabled={sending} onClick={() => send({ chatId: "7012824179", text: "<b>Hi</b>", parseMode: "HTML" })}>
        Send
      </button>
      <ul>{inbox.updates.map((u, i) => <li key={i}>{JSON.stringify(u)}</li>)}</ul>
    </div>
  );
}
```

How `useInbox` works:
- It polls `getUpdates` and saves the history in localStorage (key prefix `tgwb:`).
- Polling only runs while the page is open.
- It **cannot run at the same time as a webhook** on the same bot. Call `client.deleteWebhook()` first.

---

## 4. Every feature

```ts
// Connection & webhook
await tg.getMe();
await tg.getWebhookInfo();
await tg.setWebhook("https://my.site/api/telegram", { secretToken: "abc" });
await tg.deleteWebhook();

// Message (direct, group, channel, forum topic)
await tg.sendMessage({ chatId: "-1003956104814", threadId: 12, text: "Hi", parseMode: "HTML" });

// Multi-group × multi-topic broadcast (one request per combination)
await tg.broadcast({ chatIds: ["-100111", "-100222"], threadIds: [12, 34], text: "To all", parseMode: "HTML" });

// Media from a URL or file_id
await tg.broadcast({ chatIds: ["7012824179"], text: "Caption", mediaKind: "photo", mediaUrl: "https://…/pic.jpg" });

// Upload a file (File in the browser, Blob in Node)
await tg.uploadMedia({ chatId: "7012824179", kind: "document", file, filename: "report.pdf", caption: "Report" });

// Inline keyboard + answering a button tap
await tg.sendMessage({ chatId, text: "Pick:", replyMarkup: { inline_keyboard: [[
  { text: "Yes", callback_data: "yes" }, { text: "Site", url: "https://example.com" }]] } });
await tg.answerCallbackQuery(callbackQueryId, "Got it!");

// Reply keyboard / remove it
replyMarkup: { keyboard: [[{ text: "Help" }]], resize_keyboard: true }
replyMarkup: { remove_keyboard: true }

// Edit, delete, forward, copy, pin, react, typing
await tg.editMessageText(chatId, messageId, "Updated", "HTML");
await tg.deleteMessage(chatId, messageId);
await tg.forwardMessage(fromChatId, toChatId, messageId);
await tg.copyMessage(fromChatId, toChatId, messageId);
await tg.pinChatMessage(chatId, messageId);
await tg.setMessageReaction(chatId, messageId, "🔥");
await tg.sendChatAction(chatId, "typing");

// Polls, quiz, dice, location, contact
await tg.sendPoll(chatId, "Best?", ["A", "B"]);
await tg.sendPoll(chatId, "2+2?", ["3", "4"], true);
await tg.sendDice(chatId, "🎰");
await tg.sendLocation(chatId, 48.2082, 16.3738);
await tg.sendContact(chatId, "+43…", "Jane");

// Group admin & forum topics
await tg.createChatInviteLink(chatId);
await tg.banChatMember(chatId, userId);
await tg.unbanChatMember(chatId, userId);
await tg.createForumTopic(chatId, "Support");
await tg.closeForumTopic(chatId, threadId);
await tg.reopenForumTopic(chatId, threadId);
await tg.deleteForumTopic(chatId, threadId);

// Bot command menu
await tg.setMyCommands([{ command: "start", description: "Start the bot" }]);

// Any other Bot API method (albums, stickers, Stars invoices, venues…)
await tg.call("sendInvoice", { chat_id: chatId, title: "Premium", description: "1 month",
  payload: "ref-1", currency: "XTR", prices: [{ label: "Premium", amount: 250 }] });
```

### Helpers

```ts
import { parseTelegramLink, describeUpdate, escapeHtml, escapeMarkdownV2 } from "telegram-workbench";

parseTelegramLink("https://t.me/c/3956104814/12/345");
// → { chatId: "-1003956104814", threadId: 12, messageId: 345, ... }

escapeMarkdownV2("Price: 5.00!"); // makes MarkdownV2 text safe
```

---

## 5. Notes

- **HTML is the safest formatting.** MarkdownV2 fails on special characters that aren't escaped, so use `escapeMarkdownV2`.
- **One bot = one webhook.** If two projects both need to receive messages, use two bots.
- Group and channel IDs start with `-100`. The bot must be an admin to post in a channel.
- Failed calls are logged with `console.error`, and `result.body` holds Telegram's exact error text.
