import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../lib/db";
import { getStockState } from "../app/api/inventory/products/route";

export function createTelegramBot(token: string, botName: string) {
  const bot = new Bot(token);

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

    const user = await getUserByTelegram(telegramId);

    if (!user) {
      const welcomeNoAuth = 
        `👋 Welcome to *Safari Boys Laboratory Bot* (${botName})!\n\n` +
        `We could not find an account linked to your Telegram ID: \`${telegramId}\`.\n\n` +
        `Please register on our website and associate this Telegram ID or your username \`@${ctx.from?.username || ""}\` in your profile.`;
      
      const keyboard = new InlineKeyboard()
        .url("🌐 Visit Website", "http://localhost:3000")
        .row()
        .text("🔄 Check Link / Refresh", "refresh_auth");

      await ctx.reply(welcomeNoAuth, { parse_mode: "Markdown", reply_markup: keyboard });
      return;
    }

    // Welcomes authenticated user
    const welcomeAuth = 
      `🧪 *Safari Boys Laboratory* - Main Menu (${botName})\n\n` +
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

  // Action: Refresh Auth
  bot.callbackQuery("refresh_auth", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await getUserByTelegram(telegramId);
    if (!user) {
      await ctx.answerCallbackQuery({ text: "❌ Link not found yet. Please check your website settings.", show_alert: true });
    } else {
      await ctx.answerCallbackQuery({ text: "✅ Account linked successfully!" });
      await ctx.editMessageText(`Setup complete! Run /start to open the Main Menu.`);
    }
  });

  // Action: Main Menu (Back button)
  bot.callbackQuery("main_menu", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await getUserByTelegram(telegramId);
    if (!user) return;

    const welcomeAuth = 
      `🧪 *Safari Boys Laboratory* - Main Menu (${botName})\n\n` +
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
          throw new Error("Insufficient wallet balance.");
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
            cooldownEndAt: new Date(Date.now() + 30 * 1000) // 30s cooldown
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
        `Paid: *$${product.price.toFixed(2)}*\n\n` +
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

    const keyboard = new InlineKeyboard()
      .text("➕ Simulate Deposit (+$100)", "sim_deposit")
      .row()
      .text("⬅️ Back to Main Menu", "main_menu");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Simulate Deposit Action
  bot.callbackQuery("sim_deposit", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await getUserByTelegram(telegramId);
    if (!user || !user.wallet) return;

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: { balance: { increment: 100.0 } }
      });
      await tx.walletLedger.create({
        data: {
          walletId: user.wallet!.id,
          type: "DEPOSIT",
          amount: 100.0,
          description: `Telegram Deposit Simulation`,
        }
      });
    });

    await ctx.answerCallbackQuery({ text: "💰 Added $100.00 to your wallet!" });
    // Refresh view
    const refreshedUser = await getUserByTelegram(telegramId);
    if (!refreshedUser) return;

    const ledgers = await prisma.walletLedger.findMany({
      where: { walletId: refreshedUser.wallet?.id },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    let text = 
      `💳 *Wallet Information*\n\n` +
      `Current Balance: *$${refreshedUser.wallet?.balance.toFixed(2)}*\n\n` +
      `*Recent Ledger History*:\n`;

    ledgers.forEach((log) => {
      text += `• ${log.type === "DEPOSIT" || log.type === "REFUND" ? "🟢" : "🔴"} *${log.type}*: ${log.amount > 0 ? "+" : ""}$${log.amount.toFixed(2)} (${log.description})\n`;
    });

    const keyboard = new InlineKeyboard()
      .text("➕ Simulate Deposit (+$100)", "sim_deposit")
      .row()
      .text("⬅️ Back to Main Menu", "main_menu");

    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
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

  return bot;
}
