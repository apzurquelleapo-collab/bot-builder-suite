/**
 * Telegram Workbench — core layer (framework-agnostic).
 * Use this entry in Node scripts, serverless functions, or any JS project.
 */
export { TelegramClient, escapeMarkdownV2, escapeHtml } from "./core/client.js";
export type {
  TelegramClientOptions,
  TelegramCallResult,
  SendMessageParams,
  BroadcastParams,
  BroadcastResult,
  UploadMediaParams,
  ParseMode,
  Json,
} from "./core/client.js";
export { parseTelegramLink, describeUpdate } from "./core/link-parser.js";
export type { ParsedTelegramLink, UpdateSummary } from "./core/link-parser.js";
export { cacheGet, cacheSet, cacheClear } from "./core/local-cache.js";
export {
  TelegramBots,
  discoverBotTokens,
  envNameForBot,
  normalizeBotId,
  DEFAULT_BOT_ID,
} from "./core/bots.js";
export type { BotId, BotsOptions } from "./core/bots.js";
