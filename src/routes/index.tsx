import { createFileRoute, Link } from "@tanstack/react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionPanel } from "@/components/workbench/ConnectionPanel";
import { ComposePanel } from "@/components/workbench/ComposePanel";
import { InboxPanel } from "@/components/workbench/InboxPanel";
import { PayloadTester } from "@/components/workbench/PayloadTester";
import { SuperpowersPanel } from "@/components/workbench/SuperpowersPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Telegram Bot Workbench — send, receive and test" },
      {
        name: "description",
        content:
          "A testing environment for Telegram bots: webhook control, multi-chat and forum-topic broadcasts, keyboards, media and a live inbound feed with raw payloads.",
      },
      { property: "og:title", content: "Telegram Bot Workbench" },
      {
        property: "og:description",
        content:
          "Control webhooks, broadcast to chats, groups, channels and forum topics, and inspect every Telegram API response live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workbench,
});

function Workbench() {
  return (
    <div className="min-h-screen bg-background">
      <div
        className="border-b border-border"
        style={{
          backgroundImage:
            "radial-gradient(120% 140% at 12% -20%, oklch(0.72 0.14 225 / 18%) 0%, transparent 55%)",
        }}
      >
        <header className="mx-auto max-w-7xl px-6 py-10">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-primary">
            Telegram bot ops
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Bot Workbench &amp; Testing Environment
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Wire up the webhook, broadcast across chats, groups, channels and forum topics, attach
            keyboards and media, and watch every inbound update arrive in real time.
          </p>
          <Link
            to="/guide"
            className="mt-5 inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-xs text-primary hover:bg-primary/20"
          >
            Open the feature guide → buttons, code, polls, calendar…
          </Link>
        </header>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Tabs defaultValue="connection" className="space-y-6">
          <TabsList className="bg-surface-strong font-mono text-xs">
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="superpowers">Superpowers</TabsTrigger>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="tester">Payload tester</TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <ConnectionPanel />
          </TabsContent>
          <TabsContent value="compose">
            <ComposePanel />
          </TabsContent>
          <TabsContent value="superpowers">
            <SuperpowersPanel />
          </TabsContent>
          <TabsContent value="inbox">
            <InboxPanel />
          </TabsContent>
          <TabsContent value="tester">
            <PayloadTester />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
