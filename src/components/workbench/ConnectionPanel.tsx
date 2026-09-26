import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JsonView } from "./JsonView";
import { StatusDot } from "./StatusDot";
import {
  getBotInfo,
  getWebhookInfo,
  registerWebhook,
  removeWebhook,
} from "@/lib/telegram.functions";

const DEFAULT_WEBHOOK_PATH = "/api/public/telegram/webhook";

function suggestedWebhookUrl(): string {
  if (typeof window === "undefined") return DEFAULT_WEBHOOK_PATH;
  const host = window.location.hostname;
  const match = host.match(/^id-preview--(.+?)\.(.+)$/);
  if (match) return `https://project--${match[1]}-dev.${match[2]}${DEFAULT_WEBHOOK_PATH}`;
  return `${window.location.origin}${DEFAULT_WEBHOOK_PATH}`;
}

export function ConnectionPanel() {
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_PATH);
  const [lastResponse, setLastResponse] = useState<unknown>(null);

  useEffect(() => setWebhookUrl(suggestedWebhookUrl()), []);

  const me = useMutation({ mutationFn: useServerFn(getBotInfo) });
  const info = useMutation({ mutationFn: useServerFn(getWebhookInfo) });
  const register = useMutation({ mutationFn: useServerFn(registerWebhook) });
  const remove = useMutation({ mutationFn: useServerFn(removeWebhook) });

  useEffect(() => {
    me.mutate({} as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bot = (me.data?.body as { result?: { username?: string; first_name?: string } } | undefined)
    ?.result;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-border bg-card shadow-panel">
        <CardHeader>
          <CardTitle className="font-mono text-base tracking-tight">Bot connection</CardTitle>
          <CardDescription>
            The bot credential is held securely by the connected Telegram account — no token needs
            to be pasted here. Run a live check to confirm which bot is answering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => me.mutate({} as never)} disabled={me.isPending}>
              {me.isPending ? "Checking…" : "Run getMe"}
            </Button>
            <StatusDot
              tone={me.isPending ? "pending" : me.data ? (me.data.ok ? "ok" : "error") : "idle"}
              label={
                me.isPending
                  ? "checking"
                  : bot?.username
                    ? `@${bot.username}`
                    : me.data
                      ? "failed"
                      : "not checked"
              }
            />
          </div>
          {me.data ? <JsonView value={me.data.body} maxHeight="max-h-56" /> : null}
          {me.error ? (
            <p className="text-sm text-destructive">{(me.error as Error).message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-panel">
        <CardHeader>
          <CardTitle className="font-mono text-base tracking-tight">Webhook control</CardTitle>
          <CardDescription>
            Point Telegram at this app so incoming messages appear in the live feed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                register.mutate(
                  { data: { url: webhookUrl } },
                  {
                    onSuccess: (r) => {
                      setLastResponse(r.body);
                      r.ok ? toast.success("Webhook registered") : toast.error("Telegram refused the webhook");
                    },
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
              disabled={register.isPending}
            >
              {register.isPending ? "Registering…" : "setWebhook"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                info.mutate({} as never, {
                  onSuccess: (r) => setLastResponse(r.body),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              disabled={info.isPending}
            >
              getWebhookInfo
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                remove.mutate({} as never, {
                  onSuccess: (r) => {
                    setLastResponse(r.body);
                    toast.success("Webhook deleted");
                  },
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              disabled={remove.isPending}
            >
              deleteWebhook
            </Button>
          </div>
          {lastResponse ? <JsonView value={lastResponse} maxHeight="max-h-56" /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
