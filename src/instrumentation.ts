/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * We use this to boot the Telegram bots inside the same process as the
 * web server, avoiding the need for a separate background worker service
 * (which Render's free plan does not support).
 */

function isUsableToken(token: string | undefined, placeholder: string): token is string {
  return Boolean(token && token !== placeholder && token.length > 10);
}

function startBotWithRetry(bot: any, name: string) {
  bot
    .start({
      onStart: (info: any) => {
        console.log(`🤖 [${name}] @${info.username} running (long-polling).`);
      },
    })
    .catch((err: any) => {
      console.error(`❌ [${name}] Error:`, err.message);
      console.log(`🔄 [${name}] Retrying in 5 seconds...`);
      setTimeout(() => startBotWithRetry(bot, name), 5000);
    });
}

declare global {
  var __telegram_bots_started: boolean;
}

export async function register() {
  // Only run on the Node.js server runtime (not Edge, not during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (global.__telegram_bots_started) {
      return;
    }
    global.__telegram_bots_started = true;

    if (process.env.DISABLE_EMBEDDED_BOTS === "true") {
      console.log("⚠️ [Bots] Embedded bots disabled via DISABLE_EMBEDDED_BOTS=true");
      return;
    }

    const token1 = process.env.TELEGRAM_BOT_1_TOKEN?.trim().replace(/^["']|["']$/g, "");
    const token2 = process.env.TELEGRAM_BOT_2_TOKEN?.trim().replace(/^["']|["']$/g, "");

    const hasBot1 = isUsableToken(token1, "PLACEHOLDER_BOT_1_TOKEN");
    const hasBot2 = isUsableToken(token2, "PLACEHOLDER_BOT_2_TOKEN");

    if (!hasBot1 && !hasBot2) {
      console.log("⚠️ [Bots] No Telegram bot tokens configured. Bots will not start.");
      return;
    }

    console.log("=========================================");
    console.log("   SAFARIBOYZ TELEGRAM BOTS (embedded)   ");
    console.log("=========================================");

    try {
      const { createTelegramBot } = await import("./bots/bot");

      if (hasBot1) {
        const bot1 = createTelegramBot(token1, "Bot #1 (Customer)");
        startBotWithRetry(bot1, "Bot #1 - Customer");
      }

      if (hasBot2) {
        const bot2 = createTelegramBot(token2, "Bot #2 (Mirror)");
        startBotWithRetry(bot2, "Bot #2 - Mirror");
      }
    } catch (e) {
      console.error("❌ Failed to import bot module:", e);
    }

    console.log("=========================================");
  }
}
