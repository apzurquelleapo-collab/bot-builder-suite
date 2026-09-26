import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { JsonView } from "./JsonView";
import { sendBroadcast } from "@/lib/telegram.functions";
import { parseTelegramLink, type ParsedTelegramLink } from "@/lib/telegram-link";

type InlineButton = { text: string; url: string; callback_data: string };

function parseList(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function ComposePanel({ prefill }: { prefill?: { chatId?: string; threadId?: string } }) {
  const [chats, setChats] = useState(prefill?.chatId ?? "");
  const [threads, setThreads] = useState(prefill?.threadId ?? "");
  const [text, setText] = useState("");
  const [parseMode, setParseMode] = useState<"HTML" | "MarkdownV2" | "None">("HTML");
  const [disablePreview, setDisablePreview] = useState(false);
  const [mediaKind, setMediaKind] = useState<"none" | "photo" | "document" | "voice">("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [keyboardKind, setKeyboardKind] = useState<"none" | "inline" | "reply" | "remove">("none");
  const [inlineButtons, setInlineButtons] = useState<InlineButton[]>([
    { text: "", url: "", callback_data: "" },
  ]);
  const [replyRows, setReplyRows] = useState("Yes, No\nMore info");
  const [results, setResults] = useState<unknown>(null);
  const [link, setLink] = useState("");
  const [decoded, setDecoded] = useState<ParsedTelegramLink | null>(null);

  const addUnique = (current: string, value: string) => {
    const list = current.split(",").map((s) => s.trim()).filter(Boolean);
    if (!list.includes(value)) list.push(value);
    return list.join(", ");
  };

  const applyLink = (value?: string) => {
    const parsed = parseTelegramLink(value ?? link);
    if (!parsed) {
      toast.error("Couldn't read that link", { description: "Use a t.me link, @username or numeric chat ID." });
      return;
    }
    setDecoded(parsed);
    setChats((c) => addUnique(c, parsed.chatId));
    if (parsed.threadId !== undefined) setThreads((t) => addUnique(t, String(parsed.threadId)));
    toast.success(`Added ${parsed.chatId}${parsed.threadId !== undefined ? ` · topic ${parsed.threadId}` : ""}`);
    setLink("");
  };

  const send = useMutation({ mutationFn: useServerFn(sendBroadcast) });

  function buildReplyMarkup(): Record<string, unknown> | null {
    if (keyboardKind === "none") return null;
    if (keyboardKind === "remove") return { remove_keyboard: true };
    if (keyboardKind === "reply") {
      const keyboard = replyRows
        .split("\n")
        .map((row) => parseList(row).map((label) => ({ text: label })))
        .filter((row) => row.length);
      return { keyboard, resize_keyboard: true, one_time_keyboard: false };
    }
    const rows = inlineButtons
      .filter((b) => b.text.trim() && (b.url.trim() || b.callback_data.trim()))
      .map((b) => [
        b.url.trim()
          ? { text: b.text, url: b.url.trim() }
          : { text: b.text, callback_data: b.callback_data.trim() },
      ]);
    return rows.length ? { inline_keyboard: rows } : null;
  }

  const chatIds = parseList(chats);
  const threadIds = parseList(threads).map((t) => Number(t));
  const targetCount = chatIds.length * Math.max(threadIds.length, 1);

  function submit() {
    send.mutate(
      {
        data: {
          chatIds,
          threadIds: threadIds.length ? threadIds : [],
          text,
          parseMode,
          disablePreview,
          mediaKind,
          mediaUrl,
          replyMarkup: buildReplyMarkup(),
        },
      },
      {
        onSuccess: (r) => {
          setResults(r);
          const failed = r.filter((x) => !x.ok).length;
          failed
            ? toast.error(`${failed} of ${r.length} sends failed`)
            : toast.success(`Delivered to ${r.length} target${r.length === 1 ? "" : "s"}`);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-border bg-card shadow-panel">
        <CardHeader>
          <CardTitle className="font-mono text-base tracking-tight">Compose & broadcast</CardTitle>
          <CardDescription>
            Send to one or many chats. Add topic IDs to fan the same message across forum topics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tglink">Paste a Telegram link (group, channel, topic)</Label>
            <div className="flex gap-2">
              <Input
                id="tglink"
                placeholder="https://t.me/c/1234567890/55/120"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyLink()}
                onPaste={(e) => {
                  const v = e.clipboardData.getData("text");
                  setTimeout(() => applyLink(v), 0);
                }}
                className="font-mono text-xs"
              />
              <Button type="button" variant="secondary" onClick={() => applyLink()}>
                Decode
              </Button>
            </div>
            {decoded && (
              <p className="font-mono text-xs text-muted-foreground">
                {decoded.note}: chat <span className="text-foreground">{decoded.chatId}</span>
                {decoded.threadId !== undefined && (
                  <> · topic <span className="text-foreground">{decoded.threadId}</span></>
                )}
                {decoded.messageId !== undefined && <> · message {decoded.messageId}</>}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chats">Chat IDs (user, group, channel)</Label>
              <Input
                id="chats"
                placeholder="123456789, -1001234567890, @mychannel"
                value={chats}
                onChange={(e) => setChats(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threads">Forum topic IDs (optional)</Label>
              <Input
                id="threads"
                placeholder="12, 47, 88"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="text">Message {mediaKind === "none" ? "text" : "caption"}</Label>
            <Textarea
              id="text"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="<b>Deploy finished</b> — all checks green."
              className="font-mono text-xs"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Formatting</Label>
              <Select value={parseMode} onValueChange={(v) => setParseMode(v as typeof parseMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTML">HTML</SelectItem>
                  <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                  <SelectItem value="None">Plain text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Attachment</Label>
              <Select value={mediaKind} onValueChange={(v) => setMediaKind(v as typeof mediaKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Text only</SelectItem>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="voice">Voice note</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mediaKind !== "none" ? (
            <div className="space-y-2">
              <Label htmlFor="media">File URL or Telegram file_id</Label>
              <Input
                id="media"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="font-mono text-xs"
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
            <Label htmlFor="preview" className="text-sm font-normal text-muted-foreground">
              Disable link previews
            </Label>
            <Switch id="preview" checked={disablePreview} onCheckedChange={setDisablePreview} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={send.isPending || !chatIds.length}>
              {send.isPending ? "Sending…" : "Send"}
            </Button>
            <Badge variant="secondary" className="font-mono text-[11px]">
              {targetCount} target{targetCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">Keyboard</CardTitle>
            <CardDescription>Attach inline buttons or a custom reply menu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={keyboardKind}
              onValueChange={(v) => setKeyboardKind(v as typeof keyboardKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No keyboard</SelectItem>
                <SelectItem value="inline">Inline keyboard</SelectItem>
                <SelectItem value="reply">Reply keyboard</SelectItem>
                <SelectItem value="remove">Remove reply keyboard</SelectItem>
              </SelectContent>
            </Select>

            {keyboardKind === "inline" ? (
              <div className="space-y-3">
                {inlineButtons.map((button, index) => (
                  <div key={index} className="grid gap-2 rounded-md border border-border p-3">
                    <Input
                      placeholder="Button label"
                      value={button.text}
                      onChange={(e) =>
                        setInlineButtons((prev) =>
                          prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)),
                        )
                      }
                    />
                    <Input
                      placeholder="https://… (URL button)"
                      value={button.url}
                      onChange={(e) =>
                        setInlineButtons((prev) =>
                          prev.map((b, i) => (i === index ? { ...b, url: e.target.value } : b)),
                        )
                      }
                      className="font-mono text-xs"
                    />
                    <Input
                      placeholder="callback_data (used when no URL)"
                      value={button.callback_data}
                      onChange={(e) =>
                        setInlineButtons((prev) =>
                          prev.map((b, i) =>
                            i === index ? { ...b, callback_data: e.target.value } : b,
                          ),
                        )
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setInlineButtons((prev) => [...prev, { text: "", url: "", callback_data: "" }])
                  }
                >
                  Add button
                </Button>
              </div>
            ) : null}

            {keyboardKind === "reply" ? (
              <div className="space-y-2">
                <Label htmlFor="rows">Menu rows (one row per line, comma separated)</Label>
                <Textarea
                  id="rows"
                  rows={4}
                  value={replyRows}
                  onChange={(e) => setReplyRows(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">Delivery report</CardTitle>
            <CardDescription>Telegram's reply for every target.</CardDescription>
          </CardHeader>
          <CardContent>
            {results ? (
              <JsonView value={results} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
