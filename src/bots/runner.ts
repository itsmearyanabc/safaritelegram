import { createTelegramBot } from "./bot";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

const token1 = process.env.TELEGRAM_BOT_1_TOKEN;
const token2 = process.env.TELEGRAM_BOT_2_TOKEN;

async function startBots() {
  console.log("=========================================");
  console.log("   SAFARI BOYS TELEGRAM BOTS INITIATOR   ");
  console.log("=========================================");

  if (token1 && token1 !== "PLACEHOLDER_BOT_1_TOKEN" && token1.trim() !== "") {
    try {
      const bot1 = createTelegramBot(token1, "Bot #1 (Customer)");
      bot1.start();
      console.log("🤖 [Bot #1 - Customer] started running in long-polling mode.");
    } catch (e) {
      console.error("❌ Error starting Bot #1:", e);
    }
  } else {
    console.log("⚠️ [Bot #1 - Customer] Token is missing or placeholder. Skipping boot.");
  }

  if (token2 && token2 !== "PLACEHOLDER_BOT_2_TOKEN" && token2.trim() !== "") {
    try {
      const bot2 = createTelegramBot(token2, "Bot #2 (Mirror)");
      bot2.start();
      console.log("🤖 [Bot #2 - Mirror] started running in long-polling mode.");
    } catch (e) {
      console.error("❌ Error starting Bot #2:", e);
    }
  } else {
    console.log("⚠️ [Bot #2 - Mirror] Token is missing or placeholder. Skipping boot.");
  }
  
  console.log("=========================================");
}

startBots().catch(console.error);
