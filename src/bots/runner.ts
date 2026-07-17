import dotenv from "dotenv";
import path from "path";

// MUST run before any module that reads process.env (e.g. prisma/db)
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

function isUsableToken(token: string | undefined, placeholder: string): token is string {
  return Boolean(token && token !== placeholder && token.length > 10);
}

async function startBots() {
  // Dynamic import so dotenv runs before db.ts evaluates DATABASE_URL
  const { createTelegramBot } = await import("./bot");

  const token1 = process.env.TELEGRAM_BOT_1_TOKEN?.trim().replace(/^["']|["']$/g, "");
  const token2 = process.env.TELEGRAM_BOT_2_TOKEN?.trim().replace(/^["']|["']$/g, "");

  console.log("=========================================");
  console.log("   SAFARIBOYZ TELEGRAM BOTS INITIATOR   ");
  console.log("=========================================");
  console.log(`📂 Loading env from: ${envPath}`);
  console.log(`🔑 Bot #1 token: ${isUsableToken(token1, "PLACEHOLDER_BOT_1_TOKEN") ? "present" : "MISSING"}`);
  console.log(`🔑 Bot #2 token: ${isUsableToken(token2, "PLACEHOLDER_BOT_2_TOKEN") ? "present" : "missing (optional)"}`);
  console.log(`🗄️  DATABASE_URL: ${process.env.DATABASE_URL ? "present" : "MISSING"}`);

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is required. Bots cannot start without a database.");
    process.exit(1);
  }

  if (isUsableToken(token1, "PLACEHOLDER_BOT_1_TOKEN")) {
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
  } else {
    console.log("⚠️ [Bot #1 - Customer] Token is missing or placeholder. Skipping boot.");
    console.log("   Set TELEGRAM_BOT_1_TOKEN in .env, then run: npm run bots");
  }

  if (isUsableToken(token2, "PLACEHOLDER_BOT_2_TOKEN")) {
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
  } else {
    console.log("⚠️ [Bot #2 - Mirror] Token is missing or placeholder. Skipping boot.");
  }

  console.log("=========================================");
  console.log("💡 Keep this process running. The website (npm run dev) does NOT start bots.");
  console.log("=========================================");
}

startBots().catch((err) => {
  console.error("Fatal bot runner error:", err);
  process.exit(1);
});
