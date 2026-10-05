import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { JsonView } from "./JsonView";
import { answerCallback, pollUpdates, sendBroadcast } from "@/lib/telegram.functions";
import { cacheGet, cacheSet, useCache } from "@/lib/local-cache";

type Row = {
  id: string;
  update_id: number;
  chat_id: number | null;
  chat_title: string | null;
  chat_type: string | null;
  message_thread_id: number | null;
  from_name: string | null;
  from_username: string | null;
  text: string | null;
  kind: string;
  status: string;
  raw: Record<string, unknown>;
  created_at: string;
};

const MAX_ROWS = 300;

function toRow(update: Record<string, any>): Row {
  const callback = update["callback_query"];
  const message =
    update["message"] ?? update["edited_message"] ?? update["channel_post"] ?? callback?.message;
  const kind = callback ? "callback_query" : message?.photo ? "photo" : message?.document ? "document" : message?.voice ? "voice" : "message";
  const from = callback?.from ?? message?.from;
  return {
    id: String(update["update_id"]),
    update_id: update["update_id"],
    chat_id: message?.chat?.id ?? null,
    chat_title: message?.chat?.title ?? message?.chat?.username ?? null,
    chat_type: message?.chat?.type ?? null,
    message_thread_id: message?.message_thread_id ?? null,
    from_name: [from?.first_name, from?.last_name].filter(Boolean).join(" ") || null,
    from_username: from?.username ?? null,
    text: callback?.data ?? message?.text ?? message?.caption ?? null,
    kind,
    status: "new",
    raw: update,
    created_at: new Date((message?.date ?? Date.now() / 1000) * 1000).toISOString(),
  };
}

export function InboxPanel() {
  const [openRaw, setOpenRaw] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [rows, setRows] = useCache<Row[]>("inbox", []);
  const poll = useServerFn(pollUpdates);
  const busy = useRef(false);
  const isLoading = false;

  useEffect(() => {
    let stop = false;
    async function tick() {
      if (busy.current || stop) return;
      busy.current = true;
      try {
        const offset = cacheGet<number | undefined>("offset", undefined);
        const r = await poll({ data: { offset } });
        const list = (r.body as { result?: Record<string, any>[] } | null)?.result;
        if (r.ok && Array.isArray(list) && list.length) {
          const fresh = list.map(toRow);
          cacheSet("offset", Math.max(...list.map((u) => u["update_id"] as number)) + 1);
          setRows((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...fresh.filter((f) => !seen.has(f.id)).reverse(), ...prev].slice(0, MAX_ROWS);
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        busy.current = false;
      }
    }
    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [poll, setRows]);

  const send = useMutation({ mutationFn: useServerFn(sendBroadcast) });
  const ack = useMutation({ mutationFn: useServerFn(answerCallback) });

  function setStatus(id: string, status: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  function reply(row: Row) {
    if (!row.chat_id) {
      toast.error("This update has no chat to reply to");
      return;
    }
    send.mutate(
      {
        data: {
          chatIds: [String(row.chat_id)],
          threadIds: row.message_thread_id ? [row.message_thread_id] : [],
          text: replyText,
          parseMode: "HTML",
        },
      },
      {
        onSuccess: (r) => {
          r.every((x) => x.ok) ? toast.success("Reply sent") : toast.error("Telegram rejected the reply");
          setReplyFor(null);
          setReplyText("");
          void setStatus(row.id, "accepted");
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <Card className="border-border bg-card shadow-panel">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="font-mono text-base tracking-tight">Live inbound feed</CardTitle>
          <CardDescription>
            Every incoming message and button press, with sender, chat, topic and raw payload.
          </CardDescription>
        </div>
        <Badge variant="secondary" className="font-mono text-[11px]">
          {rows.length} update{rows.length === 1 ? "" : "s"}
        </Badge>
        <Button size="sm" variant="ghost" onClick={() => setRows([])}>
          Clear cache
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!isLoading && !rows.length ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Message your bot — new updates are fetched every few seconds and kept in this browser
          </p>
        ) : null}

        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono">
                {row.kind}
              </Badge>
              <span className="font-medium text-foreground">
                {row.from_name ?? "Unknown"}
                {row.from_username ? ` · @${row.from_username}` : ""}
              </span>
              <span className="font-mono text-muted-foreground">chat {row.chat_id ?? "—"}</span>
              {row.message_thread_id ? (
                <span className="font-mono text-muted-foreground">
                  topic {row.message_thread_id}
                </span>
              ) : null}
              <span className="ml-auto font-mono text-muted-foreground">
                {new Date(row.created_at).toLocaleTimeString()}
              </span>
              <Badge
                variant={row.status === "new" ? "default" : "secondary"}
                className="font-mono text-[10px] uppercase"
              >
                {row.status}
              </Badge>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
              {row.text ?? <span className="text-muted-foreground">(no text)</span>}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setStatus(row.id, "accepted")}>
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(row.id, "dismissed")}>
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setReplyFor(replyFor === row.id ? null : row.id);
                  setReplyText(row.text ? `Re: ${row.text.slice(0, 80)}\n` : "");
                }}
              >
                {replyFor === row.id ? "Cancel reply" : "Edit & reply"}
              </Button>
              {row.kind === "callback_query" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    ack.mutate(
                      {
                        data: {
                          callbackQueryId: String(
                            (row.raw as { callback_query?: { id?: string } }).callback_query?.id ??
                              "",
                          ),
                          text: "Received",
                        },
                      },
                      {
                        onSuccess: () => toast.success("Button press acknowledged"),
                        onError: (e) => toast.error((e as Error).message),
                      },
                    )
                  }
                >
                  Answer button
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpenRaw(openRaw === row.id ? null : row.id)}
              >
                {openRaw === row.id ? "Hide JSON" : "Raw JSON"}
              </Button>
            </div>

            {replyFor === row.id ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button size="sm" onClick={() => reply(row)} disabled={send.isPending}>
                  {send.isPending ? "Sending…" : "Send reply"}
                </Button>
              </div>
            ) : null}

            {openRaw === row.id ? <JsonView value={row.raw} className="mt-3" /> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
