import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JsonView } from "@/components/workbench/JsonView";
import { telegramCall } from "@/lib/telegram.functions";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Telegram Feature Guide — buttons, formatting, polls" },
      {
        name: "description",
        content:
          "How to send inline buttons, reply menus, code blocks, MarkdownV2, spoilers, polls, calendars, locations and media with the Telegram Bot API — with one-click tests.",
      },
      { property: "og:title", content: "Telegram Feature Guide" },
      {
        property: "og:description",
        content: "Copy-ready examples of every Telegram message feature, testable in one click.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Guide,
});

type Example = {
  title: string;
  info: string;
  method: string;
  payload: Record<string, unknown>;
};

function calendar(): unknown[][] {
  const rows: unknown[][] = [
    [{ text: "October 2026", callback_data: "ignore" }],
    "Mo Tu We Th Fr Sa Su".split(" ").map((d) => ({ text: d, callback_data: "ignore" })),
  ];
  const days = ["", "", ...Array.from({ length: 31 }, (_, i) => String(i + 1))];
  while (days.length % 7) days.push("");
  for (let i = 0; i < days.length; i += 7) {
    rows.push(
      days.slice(i, i + 7).map((d) => ({
        text: d || " ",
        callback_data: d ? `date:2026-10-${d.padStart(2, "0")}` : "ignore",
      })),
    );
  }
  rows.push([
    { text: "‹ Prev", callback_data: "cal:prev" },
    { text: "Next ›", callback_data: "cal:next" },
  ]);
  return rows;
}

const SECTIONS: { heading: string; intro: string; examples: Example[] }[] = [
  {
    heading: "1. Text formatting",
    intro:
      "Set parse_mode to HTML or MarkdownV2. HTML is the easiest — only < > & need escaping. MarkdownV2 fails if ANY of these characters appear un-escaped outside formatting: _ * [ ] ( ) ~ ` > # + - = | { } . !  — put a backslash before them (\\! \\. \\( …). Code blocks must be closed with ```.",
    examples: [
      {
        title: "HTML — all styles",
        info: "<b> <i> <u> <s> <tg-spoiler> <code> <pre> <a> <blockquote expandable>",
        method: "sendMessage",
        payload: {
          parse_mode: "HTML",
          text:
            '<b>Bold</b>, <i>italic</i>, <u>underline</u>, <s>strike</s>, <tg-spoiler>spoiler</tg-spoiler>\n<code>inline code</code>\n<pre><code class="language-python">print("Hello, Telegram!")</code></pre>\n<a href="https://telegram.org">Link</a>\n<blockquote expandable>Expandable quote\nline 2\nline 3</blockquote>',
        },
      },
      {
        title: "MarkdownV2 — correctly escaped",
        info: "*bold* _italic_ __underline__ ~strike~ ||spoiler|| `code` ```lang block``` [link](url) >quote",
        method: "sendMessage",
        payload: {
          parse_mode: "MarkdownV2",
          text:
            '🌟 *Ultimate MarkdownV2 Demo* 🌟\n\n*Bold* _Italic_ __Underline__ ~Strike~ ||Spoiler||\n*__Bold and Underlined__*\n`Inline code`\n[Link to Telegram](https://telegram.org)\n>This is a quote\n```python\nprint("Hello, Telegram!")\n```\nEscaped chars: \\! \\. \\( \\) \\- \\#',
        },
      },
    ],
  },
  {
    heading: "2. Buttons under a message (inline keyboard)",
    intro:
      "Add reply_markup.inline_keyboard — an array of rows, each row an array of buttons. Button types: callback_data (bot receives a callback_query — shows in your Inbox with an Answer button), url, copy_text, switch_inline_query, web_app (Mini App).",
    examples: [
      {
        title: "Callback, URL and copy buttons",
        info: "Tap Yes/No → appears in Inbox as a callback",
        method: "sendMessage",
        payload: {
          parse_mode: "HTML",
          text: "<b>Do you confirm the booking?</b>",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Yes", callback_data: "yes" },
                { text: "❌ No", callback_data: "no" },
              ],
              [{ text: "🌐 Open website", url: "https://telegram.org" }],
              [{ text: "📋 Copy promo code", copy_text: { text: "PROMO-2026" } }],
            ],
          },
        },
      },
      {
        title: "Calendar / date picker",
        info: "Telegram has no native calendar — it is built from inline buttons. Each day sends date:YYYY-MM-DD.",
        method: "sendMessage",
        payload: { text: "📅 Pick a check-in date:", reply_markup: { inline_keyboard: calendar() } },
      },
    ],
  },
  {
    heading: "3. Menu instead of the keyboard (reply keyboard)",
    intro:
      "reply_markup.keyboard replaces the user's keyboard with buttons. Tapping sends the text as a normal message. Special buttons can request location or contact. Remove it with { remove_keyboard: true }.",
    examples: [
      {
        title: "Menu with location & contact request",
        info: "Only works in private chats for request_location/contact",
        method: "sendMessage",
        payload: {
          text: "Choose from the menu below 👇",
          reply_markup: {
            keyboard: [
              [{ text: "📅 Book" }, { text: "💶 Prices" }],
              [
                { text: "📍 Send my location", request_location: true },
                { text: "📞 Share contact", request_contact: true },
              ],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      },
      {
        title: "Remove the menu",
        info: "remove_keyboard: true",
        method: "sendMessage",
        payload: { text: "Menu closed.", reply_markup: { remove_keyboard: true } },
      },
    ],
  },
  {
    heading: "4. Polls, quizzes and dice",
    intro: "sendPoll creates a vote or quiz (type: quiz + correct_option_id). sendDice sends an animated 🎲 🎯 🏀 ⚽ 🎳 🎰.",
    examples: [
      {
        title: "Poll",
        info: "sendPoll",
        method: "sendPoll",
        payload: {
          question: "Which apartment do you prefer?",
          options: [{ text: "Garden view" }, { text: "City view" }, { text: "Penthouse" }],
          is_anonymous: false,
        },
      },
      {
        title: "Quiz",
        info: "type: quiz",
        method: "sendPoll",
        payload: {
          question: "Capital of Austria?",
          options: [{ text: "Salzburg" }, { text: "Vienna" }, { text: "Graz" }],
          type: "quiz",
          correct_option_id: 1,
          explanation: "Vienna it is!",
        },
      },
      { title: "Dice", info: "sendDice", method: "sendDice", payload: { emoji: "🎰" } },
    ],
  },
  {
    heading: "5. Location, venue, contact",
    intro: "Share a map pin, a named place, or a phone contact card.",
    examples: [
      { title: "Location", info: "sendLocation", method: "sendLocation", payload: { latitude: 48.2082, longitude: 16.3738 } },
      {
        title: "Venue",
        info: "sendVenue",
        method: "sendVenue",
        payload: { latitude: 48.2082, longitude: 16.3738, title: "Apartments Quelle", address: "Vienna, Austria" },
      },
      { title: "Contact", info: "sendContact", method: "sendContact", payload: { phone_number: "+431234567", first_name: "Reception" } },
    ],
  },
  {
    heading: "6. Media with caption and buttons",
    intro: "sendPhoto, sendDocument, sendVoice, sendVideo, sendMediaGroup (album). Use a public URL or a file_id. caption + parse_mode + reply_markup work here too.",
    examples: [
      {
        title: "Photo + caption + button",
        info: "sendPhoto",
        method: "sendPhoto",
        payload: {
          photo: "https://picsum.photos/800/500",
          caption: "<b>Garden apartment</b>\n<i>from €89 / night</i>",
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "Book now", url: "https://telegram.org" }]] },
        },
      },
      {
        title: "Album (2 photos)",
        info: "sendMediaGroup",
        method: "sendMediaGroup",
        payload: {
          media: [
            { type: "photo", media: "https://picsum.photos/seed/a/800/500", caption: "Album photo 1" },
            { type: "photo", media: "https://picsum.photos/seed/b/800/500" },
          ],
        },
      },
    ],
  },
];

function Guide() {
  const call = useServerFn(telegramCall);
  const [chatId, setChatId] = useState("7012824179");
  const [threadId, setThreadId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<unknown>(null);

  const send = async (ex: Example) => {
    if (!chatId.trim()) {
      toast.error("Enter a chat ID first");
      return;
    }
    setBusy(ex.title);
    try {
      const payload: Record<string, unknown> = { chat_id: chatId.trim(), ...ex.payload };
      if (threadId.trim()) payload["message_thread_id"] = Number(threadId);
      const res = (await call({ data: { method: ex.method, payload } })) as { ok: boolean; body: { description?: string } };
      setLast(res);
      if (res.ok) toast.success(`${ex.title} sent`);
      else toast.error("Telegram rejected it", { description: res.body?.description });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <div>
          <Link to="/" className="font-mono text-xs text-primary hover:underline">
            ← Back to workbench
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Telegram feature guide</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Everything a bot can send — with the exact payload. Press <b>Send test</b> to deliver it to the chat below,
            or copy the method and JSON into the Payload tester.
          </p>
        </div>

        <Card className="sticky top-2 z-10 border-border bg-card shadow-panel">
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="g-chat">Send tests to chat ID</Label>
              <Input id="g-chat" value={chatId} onChange={(e) => setChatId(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-thread">Forum topic ID (optional)</Label>
              <Input id="g-thread" value={threadId} onChange={(e) => setThreadId(e.target.value)} className="font-mono text-xs" />
            </div>
          </CardContent>
        </Card>

        {SECTIONS.map((s) => (
          <section key={s.heading} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{s.heading}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.intro}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {s.examples.map((ex) => (
                <Card key={ex.title} className="border-border bg-card shadow-panel">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      {ex.title}
                      <span className="font-mono text-xs font-normal text-primary">{ex.method}</span>
                    </CardTitle>
                    <CardDescription className="text-xs">{ex.info}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="max-h-56 overflow-auto">
                      <JsonView value={ex.payload} />
                    </div>
                    <Button size="sm" onClick={() => send(ex)} disabled={busy !== null}>
                      {busy === ex.title ? "Sending…" : "Send test"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {last !== null && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Last Telegram response</h2>
            <JsonView value={last} />
          </section>
        )}
      </main>
    </div>
  );
}
