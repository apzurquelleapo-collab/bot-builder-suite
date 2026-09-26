import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { JsonView } from "./JsonView";
import { telegramCall } from "@/lib/telegram.functions";

const PRESETS: { name: string; method: string; payload: Record<string, unknown> }[] = [
  { name: "getMe", method: "getMe", payload: {} },
  { name: "getWebhookInfo", method: "getWebhookInfo", payload: {} },
  {
    name: "sendMessage",
    method: "sendMessage",
    payload: { chat_id: "123456789", text: "<b>Hello</b>", parse_mode: "HTML" },
  },
  {
    name: "sendMessage → topic",
    method: "sendMessage",
    payload: { chat_id: "-1001234567890", message_thread_id: 12, text: "Topic ping" },
  },
  {
    name: "inline keyboard",
    method: "sendMessage",
    payload: {
      chat_id: "123456789",
      text: "Pick one",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Open docs", url: "https://core.telegram.org/bots/api" },
            { text: "Ping", callback_data: "ping" },
          ],
        ],
      },
    },
  },
  {
    name: "sendPhoto",
    method: "sendPhoto",
    payload: { chat_id: "123456789", photo: "https://picsum.photos/600/400", caption: "Sample" },
  },
  {
    name: "sendDocument",
    method: "sendDocument",
    payload: { chat_id: "123456789", document: "https://example.com/file.pdf" },
  },
  {
    name: "sendChatAction",
    method: "sendChatAction",
    payload: { chat_id: "123456789", action: "typing" },
  },
  { name: "getChat", method: "getChat", payload: { chat_id: "-1001234567890" } },
  {
    name: "getForumTopicIconStickers",
    method: "getForumTopicIconStickers",
    payload: {},
  },
  {
    name: "answerCallbackQuery",
    method: "answerCallbackQuery",
    payload: { callback_query_id: "REPLACE", text: "Got it" },
  },
  { name: "deleteWebhook", method: "deleteWebhook", payload: { drop_pending_updates: false } },
];

export function PayloadTester() {
  const [method, setMethod] = useState("getMe");
  const [body, setBody] = useState("{}");
  const call = useMutation({ mutationFn: useServerFn(telegramCall) });

  function run() {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      toast.error("The payload is not valid JSON");
      return;
    }
    call.mutate(
      { data: { method, payload } },
      {
        onSuccess: (r) => (r.ok ? toast.success(`${method} ok`) : toast.error(`${method} failed`)),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-border bg-card shadow-panel">
        <CardHeader>
          <CardTitle className="font-mono text-base tracking-tight">Payload tester</CardTitle>
          <CardDescription>
            Call any Telegram Bot API method and inspect the exact reply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.name}
                size="sm"
                variant="outline"
                className="font-mono text-[11px]"
                onClick={() => {
                  setMethod(preset.method);
                  setBody(JSON.stringify(preset.payload, null, 2));
                }}
              >
                {preset.name}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <Input
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payload">JSON payload</Label>
            <Textarea
              id="payload"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <Button onClick={run} disabled={call.isPending}>
            {call.isPending ? "Calling…" : "Run request"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-panel">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-base tracking-tight">Response</CardTitle>
            <CardDescription>Raw reply straight from Telegram.</CardDescription>
          </div>
          {call.data ? (
            <Badge
              variant={call.data.ok ? "default" : "destructive"}
              className="font-mono text-[11px]"
            >
              {call.data.status} · {call.data.durationMs}ms
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {call.data ? (
            <JsonView value={call.data.body} maxHeight="max-h-[32rem]" />
          ) : (
            <p className="text-sm text-muted-foreground">No request run yet.</p>
          )}
          {call.error ? (
            <p className="mt-3 text-sm text-destructive">{(call.error as Error).message}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
