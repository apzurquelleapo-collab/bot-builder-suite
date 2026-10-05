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
- All Telegram Bot API calls go through `callTelegram` in `src/lib/telegram.functions.ts` (connector gateway), so request handling lives in one place.
- 

## Storage
- No database: the inbox polls `getUpdates` via `pollUpdates` and stores updates in the browser through `src/lib/local-cache.ts` (localStorage); swap that module for Firebase later. The webhook route was removed because polling and webhooks can't coexist.
