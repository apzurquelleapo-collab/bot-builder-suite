<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Telegram workbench
- All Telegram Bot API calls go through `callTelegram` in `src/lib/telegram.functions.ts` (connector gateway), so every call is logged to `telegram_api_log` in one place.
- Inbound updates arrive only at `src/routes/api/public/telegram/webhook.ts`, verified with a secret token derived from `TELEGRAM_API_KEY`; keep `node:crypto` imports inside handlers so the module stays browser-safe.
