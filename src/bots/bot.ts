import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../lib/db";
import { getStockState } from "../app/api/inventory/products/route";
import bcrypt from "bcryptjs";

// Session state storage for bot login/registration
interface AuthState {
  action: "LOGIN" | "SIGNUP" | null;
  step: "CAPTCHA" | "USERNAME" | "PASSWORD";
  captchaAnswer?: number;
  username?: string;
}
const userStates = new Map<number, AuthState>();

export function createTelegramBot(token: string, botName: string) {
  const bot = new Bot(token);

  // Global error handler — keeps the bot alive on errors
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;
    // Attempt to notify the user
    try {
      ctx.reply("⚠️ Something went wrong. Please try again later or type /start.").catch(() => {});
    } catch {}
  });
  // Helper: Find or verify user by Telegram ID
  async function getUserByTelegram(telegramId: number) {
    return prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      include: { wallet: true },
    });
  }

  // 1. Start Command / Welcome Menu
  bot.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Clear active auth state on start
    userStates.delete(telegramId);

    const user = await getUserByTelegram(telegramId);

    if (!user) {
      const welcomeNoAuth = 
        `👋 Welcome to *Safari Bois Bot* (${botName})!\n\n` +
        `We could not find an account linked to your Telegram ID: \`${telegramId}\`.\n\n` +
        `Choose an option below to get started:`;
      
      const keyboard = new InlineKeyboard()
        .text("🔑 Link Existing Account", "auth_login")
        .row()
        .text("📝 Create New Account", "auth_signup");

      await ctx.reply(welcomeNoAuth, { parse_mode: "Markdown", reply_markup: keyboard });
      return;
    }

    // Welcomes authenticated user
    const welcomeAuth = 
      `🧪 *Safari Bois* - Main Menu (${botName})\n\n` +
      `User: *${user.username}* | Role: *${user.role}*\n` +
      `Wallet Balance: *$${user.wallet?.balance.toFixed(2) || "0.00"}*\n\n` +
      `Manage your orders, browse stock, or raise disputes below.`;

    const keyboard = new InlineKeyboard()
      .text("🧪 Browse Shop", "shop_categories")
      .text("💳 Wallet & Ledger", "wallet_menu")
      .row()
      .text("📦 Track Orders", "orders_menu")
      .text("⚖️ Disputes Log", "disputes_menu");

    await ctx.reply(welcomeAuth, { parse_mode: "Markdown", reply_markup: keyboard });
  });

  // Action: Initiate Login
  bot.callbackQuery("auth_login", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = Math.floor(Math.random() * 9) + 1;
    const sum = num1 + num2;

    userStates.set(telegramId, { action: "LOGIN", step: "CAPTCHA", captchaAnswer: sum });
    await ctx.editMessageText(
      `🤖 *Security Verification*\n\n` +
      `Solve the mathematical verification (same as website):\n` +
      `*What is ${num1} + ${num2}?*`,
      { parse_mode: "Markdown" }
    );
    await ctx.answerCallbackQuery();
  });

  // Action: Initiate Signup
  bot.callbackQuery("auth_signup", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = Math.floor(Math.random() * 9) + 1;
    const sum = num1 + num2;

    userStates.set(telegramId, { action: "SIGNUP", step: "CAPTCHA", captchaAnswer: sum });
    await ctx.editMessageText(
      `🤖 *Security Verification*\n\n` +
      `Solve the mathematical verification (same as website):\n` +
      `*What is ${num1} + ${num2}?*`,
      { parse_mode: "Markdown" }
    );
    await ctx.answerCallbackQuery();
  });

  // Action: Main Menu (Back button)
  bot.callbackQuery("main_menu", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await getUserByTelegram(telegramId);
    if (!user) return;

    const welcomeAuth = 
      `🧪 *Safari Bois* - Main Menu (${botName})\n\n` +
      `User: *${user.username}* | Role: *${user.role}*\n` +
      `Wallet Balance: *$${user.wallet?.balance.toFixed(2) || "0.00"}*\n\n` +
      `Select an option below:`;

    const keyboard = new InlineKeyboard()
      .text("🧪 Browse Shop", "shop_categories")
      .text("💳 Wallet & Ledger", "wallet_menu")
      .row()
      .text("📦 Track Orders", "orders_menu")
      .text("⚖️ Disputes Log", "disputes_menu");

    await ctx.editMessageText(welcomeAuth, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // 2. Shop Categories
  bot.callbackQuery("shop_categories", async (ctx) => {
    const categories = await prisma.category.findMany();
    const keyboard = new InlineKeyboard();
    
    categories.forEach((cat) => {
      keyboard.text(`🧪 ${cat.name}`, `cat_${cat.id}`).row();
    });
    
    keyboard.text("⬅️ Back to Main Menu", "main_menu");

    await ctx.editMessageText("Select a Chemical Category:", { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Category Products List
  bot.callbackQuery(/^cat_(.+)$/, async (ctx) => {
    const catId = ctx.match[1];
    const category = await prisma.category.findUnique({
      where: { id: catId },
      include: {
        products: {
          include: {
            items: { where: { isAllocated: false } }
          }
        }
      }
    });

    if (!category) return;

    const keyboard = new InlineKeyboard();
    let text = `🧪 *${category.name} Catalog*:\n\n`;

    category.products.forEach((prod) => {
      const stockCount = prod.items.length;
      const state = getStockState(stockCount);
      text += `• *${prod.name}* (${prod.formula || ""})\n  Price: $${prod.price.toFixed(2)} | Stock: ${state.replace("_", " ")}\n\n`;
      
      if (stockCount > 0) {
        keyboard.text(`Order ${prod.name}`, `buy_${prod.id}`).row();
      }
    });

    keyboard.text("⬅️ Back to Categories", "shop_categories");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Purchase Product (Buy)
  bot.callbackQuery(/^buy_(.+)$/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await getUserByTelegram(telegramId);
    if (!user) return;

    const productId = ctx.match[1];
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;

    try {
      const order = await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet || wallet.balance < product.price) {
          throw new Error(`Insufficient wallet balance.\n\nPlease log in to our website to pay directly with Crypto (BTC, ETH, USDT, SOL, TRX) or to deposit funds.`);
        }

        const item = await tx.inventoryItem.findFirst({
          where: { productId, isAllocated: false },
          orderBy: { createdAt: "asc" }
        });

        if (!item) {
          throw new Error("This compound is currently out of stock.");
        }

        // Deduct
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: product.price } }
        });

        // Ledger
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            type: "PURCHASE",
            amount: -product.price,
            description: `Telegram Bot Order: ${product.name}`,
          }
        });

        // Allocate
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { isAllocated: true, allocatedAt: new Date() }
        });

        // Recalculate
        const unallocatedCount = await tx.inventoryItem.count({
          where: { productId, isAllocated: false }
        });

        await tx.product.update({
          where: { id: productId },
          data: { stockState: getStockState(unallocatedCount) }
        });

        // Order
        return tx.order.create({
          data: {
            userId: user.id,
            productId: product.id,
            inventoryItemId: item.id,
            amountPaid: product.price,
            status: "COOLDOWN_ACTIVE",
            cooldownEndAt: new Date(Date.now() + 30 * 1000), // 30s cooldown
            orderSource: "TELEGRAM",
            paymentMethod: "WALLET",
          }
        });
      });

      const keyboard = new InlineKeyboard()
        .text("📦 Track Order Status", `order_${order.id}`)
        .row()
        .text("⬅️ Back to Shop", "shop_categories");

      await ctx.editMessageText(
        `✅ *Order Placed!* \n\n` +
        `Order ID: \`${order.id}\`\n` +
        `Compound: *${product.name}*\n` +
        `Paid: *$${product.price.toFixed(2)}* (from Wallet)\n\n` +
        `⚠️ *Order Cooldown is Active.* Your pickup details will be generated in 30 seconds.`,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    } catch (e: any) {
      await ctx.answerCallbackQuery({ text: `❌ ${e.message || "Checkout failed"}`, show_alert: true });
    }
  });

  // 3. Wallet Menu
  bot.callbackQuery("wallet_menu", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await getUserByTelegram(telegramId);
    if (!user) return;

    const ledgers = await prisma.walletLedger.findMany({
      where: { walletId: user.wallet?.id },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    let text = 
      `💳 *Wallet Information*\n\n` +
      `Current Balance: *$${user.wallet?.balance.toFixed(2)}*\n\n` +
      `*Recent Ledger History*:\n`;

    if (ledgers.length === 0) {
      text += `_No recent wallet actions recorded._`;
    } else {
      ledgers.forEach((log) => {
        text += `• ${log.type === "DEPOSIT" || log.type === "REFUND" ? "🟢" : "🔴"} *${log.type}*: ${log.amount > 0 ? "+" : ""}$${log.amount.toFixed(2)} (${log.description})\n`;
      });
    }

    text += `\n\nℹ️ *To deposit funds using Crypto (BTC, ETH, SOL, etc.), please log in to our website.*`;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const keyboard = new InlineKeyboard()
      .url("🌐 Visit Website to Deposit", siteUrl)
      .row()
      .text("⬅️ Back to Main Menu", "main_menu");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // 4. Orders Menu list
  bot.callbackQuery("orders_menu", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await getUserByTelegram(telegramId);
    if (!user) return;

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 6
    });

    let text = `📦 *Your Active & Past Orders*:\n\n`;
    const keyboard = new InlineKeyboard();

    if (orders.length === 0) {
      text += `_No orders found. Buy chemical compounds in the Shop._`;
    } else {
      orders.forEach((o) => {
        text += `• *Order #${o.id.substring(0,8)}...* - ${o.product.name} (${o.status})\n`;
        keyboard.text(`View #${o.id.substring(0,8)}`, `order_${o.id}`);
      });
      keyboard.row();
    }

    keyboard.text("⬅️ Back to Main Menu", "main_menu");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // View specific order details
  bot.callbackQuery(/^order_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    let order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true, inventoryItem: true }
    });

    if (!order) return;

    // Check if cooldown has expired and update status
    if (order.status === "COOLDOWN_ACTIVE" && order.cooldownEndAt) {
      const now = new Date();
      if (now >= order.cooldownEndAt) {
        order = await prisma.order.update({
          where: { id: orderId },
          data: { status: "READY" },
          include: { product: true, inventoryItem: true }
        });
      }
    }

    let text = 
      `📦 *Order Details*\n\n` +
      `Product: *${order.product.name}*\n` +
      `Value: *$${order.amountPaid.toFixed(2)}*\n` +
      `Status: *${order.status}*\n\n`;

    const keyboard = new InlineKeyboard();

    if (order.status === "COOLDOWN_ACTIVE") {
      const secLeft = Math.max(0, Math.ceil((new Date(order.cooldownEndAt!).getTime() - Date.now()) / 1000));
      text += `⚠️ *Cooldown Timer Active.*\nEstimated delivery details in: *${secLeft} seconds*.\nRefresh the page using the button below.`;
      keyboard.text("🔄 Refresh Status", `order_${order.id}`).row();
    } else if (order.status === "READY" || order.status === "COMPLETED") {
      text += `📍 *FIFO Batch Pickup Details*:\n`;
      text += `🔑 *Locker/Serial Code:* \`${order.inventoryItem?.data}\`\n`;
      text += `📌 *Coordinates/Location:* \`${order.inventoryItem?.locationData || "N/A"}\`\n`;
      
      if (order.status === "READY") {
        keyboard.text("✅ Confirm Collection (Complete)", `complete_${order.id}`).row();
      }
    } else if (order.status === "REFUNDED") {
      text += `ℹ️ *Refund credited.* The dispute was resolved and the money was returned to your wallet balance.`;
    }

    keyboard.text("⬅️ Back to Orders List", "orders_menu");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Action: Complete Order from Telegram
  bot.callbackQuery(/^complete_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "COMPLETED" }
    });

    await ctx.answerCallbackQuery({ text: "🎉 Order marked as Completed!" });
    
    // Refresh view
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true, inventoryItem: true }
    });

    if (!order) return;

    const text = 
      `📦 *Order Details*\n\n` +
      `Product: *${order.product.name}*\n` +
      `Value: *$${order.amountPaid.toFixed(2)}*\n` +
      `Status: *${order.status}*\n\n` +
      `📍 *FIFO Batch Pickup Details*:\n` +
      `🔑 *Locker/Serial Code:* \`${order.inventoryItem?.data}\`\n` +
      `📌 *Coordinates/Location:* \`${order.inventoryItem?.locationData || "N/A"}\`\n`;

    const keyboard = new InlineKeyboard()
      .text("⬅️ Back to Orders List", "orders_menu");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
  });

  // 5. Disputes Menu list
  bot.callbackQuery("disputes_menu", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await getUserByTelegram(telegramId);
    if (!user) return;

    const disputes = await prisma.dispute.findMany({
      where: { userId: user.id },
      include: { order: { include: { product: true } } },
      orderBy: { createdAt: "desc" }
    });

    let text = `⚖️ *Your Disputes tickets*:\n\n`;

    if (disputes.length === 0) {
      text += `_No disputes submitted._`;
    } else {
      disputes.forEach((d) => {
        text += `• *Dispute for ${d.order.product.name}* - [${d.status}]\n  Claim: "${d.reason}"\n`;
        if (d.status === "RESOLVED") {
          text += `  Resolution: *${d.resolutionType}*\n`;
        }
        text += `\n`;
      });
    }

    const keyboard = new InlineKeyboard()
      .text("⬅️ Back to Main Menu", "main_menu");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Handle text messages for Login / Signup state machine
  bot.on("message:text", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const state = userStates.get(telegramId);
    if (!state) return;

    const text = ctx.message.text.trim();

    // Cancel command
    if (text === "/cancel") {
      userStates.delete(telegramId);
      await ctx.reply("❌ Authentication cancelled. Type /start to try again.");
      return;
    }

    if (state.step === "CAPTCHA") {
      const answer = parseInt(text);
      if (isNaN(answer) || answer !== state.captchaAnswer) {
        userStates.delete(telegramId);
        await ctx.reply("❌ Incorrect CAPTCHA verification. Authentication cancelled. Type /start to try again.");
        return;
      }
      
      // Captcha verification passed, proceed to Username
      userStates.set(telegramId, { ...state, step: "USERNAME" });
      if (state.action === "LOGIN") {
        await ctx.reply("🔑 Please enter your website Username:");
      } else {
        await ctx.reply("📝 Please enter a new Username for your account (minimum 3 characters):");
      }
      return;
    }

    if (state.action === "LOGIN") {
      if (state.step === "USERNAME") {
        const user = await prisma.user.findUnique({ where: { username: text } });
        if (!user) {
          await ctx.reply("❌ Username not found on website. Please enter your website Username (or type /cancel):");
          return;
        }
        userStates.set(telegramId, { action: "LOGIN", step: "PASSWORD", username: text });
        await ctx.reply("🔑 Please enter your Password:");
      } else if (state.step === "PASSWORD") {
        const username = state.username!;
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
          userStates.delete(telegramId);
          await ctx.reply("❌ User not found. Please start over with /start.");
          return;
        }

        const passwordMatch = await bcrypt.compare(text, user.passwordHash);
        if (!passwordMatch) {
          await ctx.reply("❌ Incorrect password. Please try again (or type /cancel):");
          return;
        }

        // Link this Telegram account
        await prisma.user.update({
          where: { id: user.id },
          data: {
            telegramId: String(telegramId),
            telegramUsername: ctx.from.username || null,
          },
        });

        userStates.delete(telegramId);
        await ctx.reply("✅ Success! Your Telegram account has been linked to your website profile. Type /start to open the Shop!");
      }
    } else if (state.action === "SIGNUP") {
      if (state.step === "USERNAME") {
        if (text.length < 3) {
          await ctx.reply("❌ Username must be at least 3 characters. Please enter a different Username:");
          return;
        }

        const existingUser = await prisma.user.findUnique({ where: { username: text } });
        if (existingUser) {
          await ctx.reply("❌ Username is already taken on the website. Please choose a different Username:");
          return;
        }

        userStates.set(telegramId, { action: "SIGNUP", step: "PASSWORD", username: text });
        await ctx.reply("🔑 Please enter a new Password (minimum 6 characters):");
      } else if (state.step === "PASSWORD") {
        if (text.length < 6) {
          await ctx.reply("❌ Password must be at least 6 characters. Please enter your password again:");
          return;
        }

        const username = state.username!;
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(text, salt);

        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              username,
              passwordHash,
              passwordPlain: text,
              telegramId: String(telegramId),
              telegramUsername: ctx.from.username || null,
              role: "CUSTOMER",
            },
          });

          await tx.wallet.create({
            data: {
              userId: user.id,
              balance: 0.0,
            },
          });
        });

        userStates.delete(telegramId);
        await ctx.reply("🎉 Account successfully registered and linked! You can now access all services. Type /start to open the Shop!");
      }
    }
  });

  return bot;
}
