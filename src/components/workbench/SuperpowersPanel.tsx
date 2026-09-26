import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { JsonView } from "./JsonView";
import { telegramCall, uploadMedia } from "@/lib/telegram.functions";

function describe(body: unknown): string {
  const d = (body as { description?: string } | null)?.description;
  return typeof d === "string" ? d : "Telegram rejected the request";
}

function useTg() {
  const call = useMutation({ mutationFn: useServerFn(telegramCall) });
  const run = useCallback(
    (method: string, payload: Record<string, unknown>, note?: string) => {
      call.mutate(
        { data: { method, payload } },
        {
          onSuccess: (r) =>
            r.ok
              ? toast.success(note ?? `${method} worked`)
              : toast.error(`${method} failed`, { description: describe(r.body) }),
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [call],
  );
  return { call, run };
}

const REACTION_EMOJI = ["👍", "❤️", "🔥", "🎉", "🤔", "😁", "😢", "👎"];
const CHAT_ACTIONS = [
  "typing",
  "upload_photo",
  "record_video",
  "record_voice",
  "upload_document",
  "choose_sticker",
  "find_location",
];

function num(value: string): number | null {
  const n = Number(value.trim());
  return value.trim() && Number.isFinite(n) ? n : null;
}

export function SuperpowersPanel() {
  const { call, run } = useTg();

  // --- Edit / forward / copy / pin
  const [chatId, setChatId] = useState("7012824179");
  const [messageId, setMessageId] = useState("");
  const [newText, setNewText] = useState("<b>Edited!</b> I changed this message after sending it.");
  const [toChat, setToChat] = useState("");

  const requireIds = (): { chatId: string; messageId: number } | null => {
    const mid = num(messageId);
    if (!chatId.trim() || mid === null) {
      toast.error("Chat ID and a numeric message ID are required");
      return null;
    }
    return { chatId: chatId.trim(), messageId: mid };
  };

  // --- Reactions & activity
  const [reactionEmoji, setReactionEmoji] = useState("🔥");
  const [chatAction, setChatAction] = useState("typing");

  // --- Upload from the computer
  const [uploadChat, setUploadChat] = useState("7012824179");
  const [uploadKind, setUploadKind] = useState<"photo" | "document" | "voice" | "video" | "animation" | "videoNote">("document");
  const [uploadCaption, setUploadCaption] = useState("");
  const [fileName, setFileName] = useState("");
  const fileData = useRef<{ dataUrl: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useMutation({ mutationFn: useServerFn(uploadMedia) });

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 9_500_000) {
      toast.error("File is too large — keep uploads under about 9 MB");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    fileData.current = { dataUrl, name: file.name };
    setFileName(file.name);
  }

  function doUpload() {
    if (!fileData.current) {
      toast.error("Choose a file first");
      return;
    }
    if (!uploadChat.trim()) {
      toast.error("A chat ID is required");
      return;
    }
    upload.mutate(
      {
        data: {
          chatId: uploadChat.trim(),
          kind: uploadKind,
          fileBase64: fileData.current.dataUrl,
          filename: fileData.current.name,
          caption: uploadCaption,
          parseMode: "HTML",
        },
      },
      {
        onSuccess: (r) =>
          r.ok
            ? toast.success("File uploaded and delivered")
            : toast.error("Upload failed", { description: describe(r.body) }),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  // --- Albums, stickers, GIFs, video
  const [mediaChat, setMediaChat] = useState("7012824179");
  const [albumA, setAlbumA] = useState("https://picsum.photos/seed/sup1/800/500");
  const [albumB, setAlbumB] = useState("https://picsum.photos/seed/sup2/800/500");
  const [stickerId, setStickerId] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("https://www.w3schools.com/html/mov_bbb.mp4");

  // --- Group & channel admin
  const [groupChat, setGroupChat] = useState("");
  const [inviteName, setInviteName] = useState("Workbench invite");
  const [inviteHours, setInviteHours] = useState("24");
  const [inviteLimit, setInviteLimit] = useState("");
  const [banUser, setBanUser] = useState("");
  const [topicName, setTopicName] = useState("New topic");
  const [topicId, setTopicId] = useState("");

  // --- Bot command menu
  const [commands, setCommands] = useState(
    "start - Show the main menu\nbookings - List your bookings\nhelp - How to use the bot",
  );
  const menuCommands = commands
    .split("\n")
    .map((line) => {
      const [cmd, ...rest] = line.split("-");
      const command = (cmd ?? "").trim().replace(/^\//, "").toLowerCase();
      const description = rest.join("-").trim();
      return command && description
        ? { command: command.slice(0, 32), description: description.slice(0, 256) }
        : null;
    })
    .filter((c): c is { command: string; description: string } => c !== null);

  // --- Mini Apps & Stars payments
  const [webText, setWebText] = useState("Tap to open the workbench as a Mini App:");
  const [webUrl, setWebUrl] = useState("https://telegram.org");
  const [invoiceTitle, setInvoiceTitle] = useState("Pro tip");
  const [invoiceDesc, setInvoiceDesc] = useState("Thanks for supporting the bot");
  const [invoiceStars, setInvoiceStars] = useState("25");
  const [invoiceLabel, setInvoiceLabel] = useState("Coffee");

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-5">
        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">
              Edit · forward · copy · pin
            </CardTitle>
            <CardDescription>
              Change a message after sending, move it to another chat, or pin it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Chat ID</Label>
                <Input value={chatId} onChange={(e) => setChatId(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Message ID</Label>
                <Input value={messageId} onChange={(e) => setMessageId(e.target.value)} placeholder="12345" className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>New text (HTML)</Label>
              <Textarea rows={2} value={newText} onChange={(e) => setNewText(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label>Forward / copy target (defaults to the same chat)</Label>
              <Input value={toChat} onChange={(e) => setToChat(e.target.value)} placeholder={chatId} className="font-mono text-xs" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={upload.isPending || call.isPending} onClick={() => {
                const ids = requireIds();
                if (ids) run("editMessageText", { chat_id: ids.chatId, message_id: ids.messageId, text: newText, parse_mode: "HTML" }, "Message edited");
              }}>Edit text</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const ids = requireIds();
                if (ids) run("forwardMessage", { chat_id: toChat.trim() || ids.chatId, from_chat_id: ids.chatId, message_id: ids.messageId }, "Message forwarded");
              }}>Forward →</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const ids = requireIds();
                if (ids) run("copyMessage", { chat_id: toChat.trim() || ids.chatId, from_chat_id: ids.chatId, message_id: ids.messageId }, "Message copied");
              }}>Copy →</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const ids = requireIds();
                if (ids) run("pinChatMessage", { chat_id: ids.chatId, message_id: ids.messageId }, "Message pinned");
              }}>Pin</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const ids = requireIds();
                if (ids) run("unpinChatMessage", { chat_id: ids.chatId, message_id: ids.messageId }, "Message unpinned");
              }}>Unpin</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">Reactions &amp; activity</CardTitle>
            <CardDescription>
              Put an emoji reaction on a message or show a status bubble like “typing…”.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Reaction</Label>
                <Select value={reactionEmoji} onValueChange={setReactionEmoji}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REACTION_EMOJI.map((e) => (
                      <SelectItem key={e} value={e} className="font-mono">{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Activity bubble</Label>
                <Select value={chatAction} onValueChange={setChatAction}>
                  <SelectTrigger className="font-mono text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHAT_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a} className="font-mono text-xs">{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => {
                const ids = requireIds();
                if (ids) run("setMessageReaction", { chat_id: ids.chatId, message_id: ids.messageId, reaction: [{ type: "emoji", emoji: reactionEmoji }] }, "Reaction set");
              }}>React {reactionEmoji}</Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (!chatId.trim()) return toast.error("Chat ID is required");
                run("sendChatAction", { chat_id: chatId.trim(), action: chatAction }, "Activity shown");
              }}>Show “{chatAction}”</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">Upload from your computer</CardTitle>
            <CardDescription>
              Sends the real file — photos, documents, videos, GIFs, voice notes and square video notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Chat ID</Label>
                <Input value={uploadChat} onChange={(e) => setUploadChat(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={uploadKind} onValueChange={(v) => setUploadKind(v as typeof uploadKind)}>
                  <SelectTrigger className="font-mono text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="animation">GIF / animation</SelectItem>
                    <SelectItem value="voice">Voice note</SelectItem>
                    <SelectItem value="videoNote">Video note (square)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Caption (optional, HTML)</Label>
              <Input value={uploadCaption} onChange={(e) => setUploadCaption(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
              <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                Choose file…
              </Button>
              {fileName ? <Badge variant="secondary" className="font-mono text-[11px]">{fileName}</Badge> : null}
              <Button size="sm" onClick={doUpload} disabled={upload.isPending}>
                {upload.isPending ? "Uploading…" : "Upload & send"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">Albums, stickers, GIFs &amp; video</CardTitle>
            <CardDescription>By URL or Telegram file_id.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Chat ID</Label>
              <Input value={mediaChat} onChange={(e) => setMediaChat(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Album photo 1 URL</Label>
                <Input value={albumA} onChange={(e) => setAlbumA(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Album photo 2 URL</Label>
                <Input value={albumB} onChange={(e) => setAlbumB(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sticker file_id</Label>
                <Input value={stickerId} onChange={(e) => setStickerId(e.target.value)} placeholder="CAACAg…" className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>GIF URL</Label>
                <Input value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} placeholder="https://…/fun.gif" className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => {
                if (!mediaChat.trim()) return toast.error("Chat ID is required");
                run("sendMediaGroup", { chat_id: mediaChat.trim(), media: [
                  { type: "photo", media: albumA.trim(), caption: "Album photo 1" },
                  { type: "photo", media: albumB.trim(), caption: "Album photo 2" },
                ] }, "Album sent");
              }} disabled={!albumA.trim() || !albumB.trim()}>Send album</Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (!stickerId.trim()) return toast.error("A sticker file_id is required");
                run("sendSticker", { chat_id: mediaChat.trim(), sticker: stickerId.trim() }, "Sticker sent");
              }}>Send sticker</Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (!gifUrl.trim()) return toast.error("A GIF URL is required");
                run("sendAnimation", { chat_id: mediaChat.trim(), animation: gifUrl.trim() }, "GIF sent");
              }}>Send GIF</Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (!videoUrl.trim()) return toast.error("A video URL is required");
                run("sendVideo", { chat_id: mediaChat.trim(), video: videoUrl.trim() }, "Video sent");
              }}>Send video</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">Group &amp; channel admin</CardTitle>
            <CardDescription>
              The bot must be an admin in that chat. Invite links, banning and forum topics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Group / channel ID</Label>
              <Input value={groupChat} onChange={(e) => setGroupChat(e.target.value)} placeholder="-1001234567890" className="font-mono text-xs" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Invite link name</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expires (hours)</Label>
                <Input value={inviteHours} onChange={(e) => setInviteHours(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Member limit</Label>
                <Input value={inviteLimit} onChange={(e) => setInviteLimit(e.target.value)} placeholder="unlimited" className="font-mono text-xs" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => {
                if (!groupChat.trim()) return toast.error("Group / channel ID is required");
                const payload: Record<string, unknown> = { chat_id: groupChat.trim(), name: inviteName.trim() || undefined };
                const hours = num(inviteHours);
                if (hours) payload["expire_date"] = Math.floor(Date.now() / 1000) + hours * 3600;
                const limit = num(inviteLimit);
                if (limit) payload["member_limit"] = limit;
                run("createChatInviteLink", payload, "Invite link created");
              }}>Create invite link</Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (!groupChat.trim() || !num(banUser)) return toast.error("Group ID and a numeric user ID are required");
                run("banChatMember", { chat_id: groupChat.trim(), user_id: num(banUser) }, "Member banned");
              }}>Ban user</Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (!groupChat.trim() || !num(banUser)) return toast.error("Group ID and a numeric user ID are required");
                run("unbanChatMember", { chat_id: groupChat.trim(), user_id: num(banUser), only_if_banned: true }, "Member unbanned");
              }}>Unban user</Button>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Create forum topic</Label>
                  <Input value={topicName} onChange={(e) => setTopicName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Topic ID (close / reopen / delete)</Label>
                  <Input value={topicId} onChange={(e) => setTopicId(e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => {
                  if (!groupChat.trim()) return toast.error("Group ID is required");
                  run("createForumTopic", { chat_id: groupChat.trim(), name: topicName.trim() || "New topic", icon_color: 7322096 }, "Topic created");
                }}>Create topic</Button>
                <Button size="sm" variant="outline" disabled={!num(topicId)} onClick={() => {
                  run("closeForumTopic", { chat_id: groupChat.trim(), message_thread_id: num(topicId) }, "Topic closed");
                }}>Close</Button>
                <Button size="sm" variant="outline" disabled={!num(topicId)} onClick={() => {
                  run("reopenForumTopic", { chat_id: groupChat.trim(), message_thread_id: num(topicId) }, "Topic reopened");
                }}>Reopen</Button>
                <Button size="sm" variant="outline" disabled={!num(topicId)} onClick={() => {
                  run("deleteForumTopic", { chat_id: groupChat.trim(), message_thread_id: num(topicId) }, "Topic deleted");
                }}>Delete</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">Bot command menu</CardTitle>
            <CardDescription>The “/” menu every user sees when they open the bot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={4}
              value={commands}
              onChange={(e) => setCommands(e.target.value)}
              className="font-mono text-xs"
              placeholder={"start - Show the main menu\nhelp - How to use the bot"}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => {
                if (!menuCommands.length) return toast.error("Add at least one command line like: start - Description");
                run("setMyCommands", { commands: menuCommands }, "Command menu saved");
              }}>Save menu</Button>
              <Button size="sm" variant="outline" onClick={() => run("getMyCommands", {}, "Current menu fetched")}>Get current</Button>
              <Button size="sm" variant="outline" onClick={() => run("deleteMyCommands", {}, "Command menu cleared")}>Delete menu</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-panel">
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">Mini Apps &amp; Stars payments</CardTitle>
            <CardDescription>
              Buttons that open a web page inside Telegram, and invoices paid in Telegram Stars.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mini App button URL (https)</Label>
              <Input value={webUrl} onChange={(e) => setWebUrl(e.target.value)} className="font-mono text-xs" />
              <div className="flex flex-wrap items-center gap-2">
                <Input value={webText} onChange={(e) => setWebText(e.target.value)} className="min-w-40 flex-1 font-mono text-xs" />
                <Button size="sm" onClick={() => {
                  if (!chatId.trim() || !webUrl.trim().startsWith("https://")) return toast.error("Chat ID and an https:// URL are required");
                  run("sendMessage", { chat_id: chatId.trim(), text: webText, reply_markup: { inline_keyboard: [[{ text: "🚀 Open Mini App", web_app: { url: webUrl.trim() } }]] } }, "Mini App message sent");
                }}>Send Mini App button</Button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Invoice title</Label>
                <Input value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Price in Stars ⭐</Label>
                <Input value={invoiceStars} onChange={(e) => setInvoiceStars(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={invoiceDesc} onChange={(e) => setInvoiceDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Price label</Label>
                <Input value={invoiceLabel} onChange={(e) => setInvoiceLabel(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={() => {
              const stars = num(invoiceStars);
              if (!chatId.trim() || !stars) return toast.error("Chat ID and a Star amount are required");
              run("sendInvoice", {
                chat_id: chatId.trim(),
                title: invoiceTitle.trim() || "Payment",
                description: invoiceDesc.trim() || "Thanks!",
                payload: "stars-demo",
                currency: "XTR",
                prices: [{ label: invoiceLabel.trim() || "Payment", amount: stars }],
              }, "Stars invoice sent");
            }}>Send Stars invoice ⭐</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit border-border bg-card shadow-panel lg:sticky lg:top-6">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-base tracking-tight">Last response</CardTitle>
            <CardDescription>Raw reply from Telegram for the newest action.</CardDescription>
          </div>
          {call.data ? (
            <Badge variant={call.data.ok ? "default" : "destructive"} className="font-mono text-[11px]">
              {call.data.status} · {call.data.durationMs}ms
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {call.data ? (
            <JsonView value={call.data.body} maxHeight="max-h-[36rem]" />
          ) : (
            <p className="text-sm text-muted-foreground">No action run yet.</p>
          )}
          {call.error ? (
            <p className="mt-3 text-sm text-destructive">{(call.error as Error).message}</p>
          ) : null}
          {upload.data ? (
            <>
              <p className="mt-4 font-mono text-xs text-muted-foreground">Upload · {upload.data.method}</p>
              <JsonView value={upload.data.body} maxHeight="max-h-64" />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
