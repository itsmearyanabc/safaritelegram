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

export async function register() {
  // Only run on the Node.js server runtime (not Edge, not during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
        try {
          const bot1 = createTelegramBot(token1, "Bot #1 (Customer)");
          bot1.start({
            onStart: (info) => {
              console.log(`🤖 [Bot #1 - Customer] @${info.username} running (long-polling).`);
            },
          });
        } catch (e) {
          console.error("❌ Error starting Bot #1:", e);
        }
      }

      if (hasBot2) {
        try {
          const bot2 = createTelegramBot(token2, "Bot #2 (Mirror)");
          bot2.start({
            onStart: (info) => {
              console.log(`🤖 [Bot #2 - Mirror] @${info.username} running (long-polling).`);
            },
          });
        } catch (e) {
          console.error("❌ Error starting Bot #2:", e);
        }
      }
    } catch (e) {
      console.error("❌ Failed to import bot module:", e);
    }

    console.log("=========================================");
  }
}
