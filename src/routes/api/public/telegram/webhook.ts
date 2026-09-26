import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

function deriveSecret(telegramApiKey: string): string {
  return createHash("sha256").update(`telegram-webhook:${telegramApiKey}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

type TgUser = { id?: number; first_name?: string; last_name?: string; username?: string };
type TgChat = { id?: number; title?: string; type?: string; username?: string };
type TgMessage = {
  chat?: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  message_thread_id?: number;
  photo?: unknown;
  document?: unknown;
  voice?: unknown;
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const telegramKey = process.env["TELEGRAM_API_KEY"];
        if (!telegramKey) return new Response("Not configured", { status: 500 });

        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(provided, deriveSecret(telegramKey))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as Record<string, any>;
        if (typeof update?.["update_id"] !== "number") {
          return Response.json({ ok: true, ignored: true });
        }

        const callback = update["callback_query"];
        const message: TgMessage | undefined =
          update["message"] ??
          update["edited_message"] ??
          update["channel_post"] ??
          callback?.message;

        const kind = callback
          ? "callback_query"
          : message?.photo
            ? "photo"
            : message?.document
              ? "document"
              : message?.voice
                ? "voice"
                : "message";

        const from: TgUser | undefined = callback?.from ?? message?.from;
        const name = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("telegram_updates").upsert(
          {
            update_id: update["update_id"],
            chat_id: message?.chat?.id ?? null,
            chat_title: message?.chat?.title ?? message?.chat?.username ?? null,
            chat_type: message?.chat?.type ?? null,
            message_thread_id: message?.message_thread_id ?? null,
            from_id: from?.id ?? null,
            from_name: name,
            from_username: from?.username ?? null,
            text: callback?.data ?? message?.text ?? message?.caption ?? null,
            kind,
            raw: update,
          },
          { onConflict: "update_id" },
        );

        if (error) {
          console.error("Failed to store Telegram update", error);
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
