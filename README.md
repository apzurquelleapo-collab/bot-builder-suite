# Telegram Bot Workbench

A complete testing and operations console for a Telegram bot. Connect a bot, receive live messages, broadcast to many chats and forum topics at once, build interactive keyboards, and test every Bot API method — all from one web app.

## What it does

### 1. Connection & Webhook Management (Connection tab)

- **Bot status check** — runs `getMe` automatically and shows whether the bot token is valid, with the bot's name and username.
- **Webhook receiver** — a public endpoint (`/api/public/telegram/webhook`) that ingests every incoming message, edited message, channel post and button tap (callback query).
- **Webhook controls** — register (`setWebhook`), inspect (`getWebhookInfo`), or remove (`deleteWebhook`) the webhook with one click. The webhook is protected by a secret token derived from the bot key, so only Telegram can post to it.
- The webhook URL is auto-suggested for the current environment (preview or published).

### 2. Multi-Target Messaging (Compose tab)

Send one message to **many destinations at once**:

- **Multiple chats** — comma-separated list of chat IDs or `@usernames` (users, groups, channels).
- **Multiple forum topics** — comma-separated list of `message_thread_id` values. Every chat × topic combination receives the message (multi-group, multi-topic broadcast from a single action).
- **Telegram link decoder** — paste any `t.me` link (public channel, private group, topic link) and the chat ID and topic ID are extracted and filled in automatically.
- **Formatting** — HTML, MarkdownV2, or plain text.
- **Media** — text, photo, document, or voice note (by URL or `file_id`), with caption.
- **Link preview toggle**.
- **Delivery report** — per-target success/failure after sending.

### 3. Interactive Features

- **Inline keyboards** — URL buttons, callback buttons, switch-inline buttons, copy-text buttons. Build rows of buttons visually in the Compose tab.
- **Reply keyboards** — custom button menus that replace the user's keyboard, plus "remove keyboard".
- **Calendars, polls, location, albums** — see the in-app **Guide** page (`/guide`) for copy-paste JSON examples of every interactive payload Telegram supports, with "Send test" buttons that deliver a live demo to your chat.

### 4. Live Inbox (Inbox tab)

- Real-time feed of every incoming update: sender name/username, chat ID, topic ID, message text, and the raw JSON payload.
- Per-message actions: **Accept**, **Dismiss**, **Edit & reply** (reply goes back to the exact chat + topic it came from), and **Answer** for button taps (callback queries).

### 5. Payload Tester (Tester tab)

- Preset templates for the major Bot API methods (`getMe`, `sendMessage`, `sendPhoto`, `setWebhook`, `getUpdates`, …).
- Edit the method and JSON payload freely, run it, and inspect the full API response (ok/status/duration).
- Every API call is logged to the `telegram_api_log` table for auditing.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | TanStack Start (React 19), Tailwind CSS v4, shadcn/ui, TanStack Query |
| Backend logic | `createServerFn` server functions (`src/lib/telegram.functions.ts`) |
| Webhook | TanStack server route `src/routes/api/public/telegram/webhook.ts` |
| Database | Lovable Cloud (Supabase): `telegram_updates` (inbox), `telegram_api_log` (audit) |
| Realtime | Supabase Realtime `postgres_changes` subscription on `telegram_updates` |
| Telegram access | Lovable Telegram connector gateway — the bot token is managed by the connector, never stored in code |

### Key files

- `src/lib/telegram.functions.ts` — `callTelegram` gateway helper (logs every call), `getBotInfo`, `getWebhookInfo`, `registerWebhook`, `removeWebhook`, `sendBroadcast` (multi-chat × multi-topic), `answerCallback`.
- `src/lib/telegram-link.ts` — parser that turns `t.me` links into chat IDs / topic IDs.
- `src/routes/api/public/telegram/webhook.ts` — verified webhook receiver, upserts updates into `telegram_updates`.
- `src/components/workbench/` — `ConnectionPanel`, `ComposePanel`, `InboxPanel`, `PayloadTester`, `JsonView`, `StatusDot`.
- `src/routes/guide.tsx` — interactive feature guide with live "Send test" demos.

## Capabilities checklist

- [x] Bot token connection with live `getMe` status
- [x] Secure webhook receiver + register/inspect/delete controls
- [x] Direct messages to users, groups and channels
- [x] Forum topics (`message_thread_id`) — single or multi-topic broadcast
- [x] Multi-group sending (many chats in one action)
- [x] HTML / MarkdownV2 / plain formatting
- [x] Photos, documents, voice notes with captions
- [x] Inline keyboards (URL, callback, copy-text, switch-inline)
- [x] Reply keyboards + remove keyboard
- [x] Live inbound feed with raw JSON and reply/accept/dismiss actions
- [x] Callback query answering
- [x] Payload tester with presets and full API response inspection
- [x] API call audit log
- [x] Telegram link decoder (paste a link → chat/topic IDs filled in)
- [x] In-app interactive guide with live test sends
