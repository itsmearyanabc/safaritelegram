import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { escapeTelegramMarkdown } from "@/lib/stock";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, message } = await req.json();

    if (!orderId || !message) {
      return NextResponse.json({ error: "Order ID and message are required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, product: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Determine new status. If COOLDOWN_ACTIVE or PAID, progress to READY.
    let newStatus = order.status;
    if (["COOLDOWN_ACTIVE", "PAID"].includes(order.status)) {
      newStatus = "READY";
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        adminMessage: message,
        adminMessageSentAt: new Date(),
        status: newStatus,
      },
    });

    let telegramSent = false;
    let telegramError: string | null = null;

    // Telegram Bot Integration - send message if user has linked their Telegram
    if (order.user.telegramId) {
      const botToken = process.env.TELEGRAM_BOT_1_TOKEN?.trim().replace(/^["']|["']$/g, "");
      if (botToken && botToken !== "PLACEHOLDER_BOT_1_TOKEN") {
        try {
          const telegramMessage =
            `📦 *Order Update for ${escapeTelegramMarkdown(order.product.name)}*\n\n` +
            `Admin sent coordinates/details:\n` +
            `\`${String(message).replace(/`/g, "'")}\`\n\n` +
            `Status updated to: *${escapeTelegramMarkdown(newStatus)}*`;

          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: order.user.telegramId,
              text: telegramMessage,
              parse_mode: "Markdown",
            }),
          });

          const tgBody = (await tgRes.json().catch(() => null)) as {
            ok?: boolean;
            description?: string;
          } | null;

          if (tgRes.ok && tgBody?.ok) {
            telegramSent = true;
          } else {
            telegramError = tgBody?.description || `Telegram HTTP ${tgRes.status}`;
            console.error("Telegram sendMessage failed:", telegramError);
          }
        } catch (err) {
          telegramError = err instanceof Error ? err.message : "Telegram request failed";
          console.error("Telegram sendMessage error:", err);
        }
      } else {
        telegramError = "TELEGRAM_BOT_1_TOKEN is not configured";
      }
    } else {
      telegramError = "User has no linked Telegram ID";
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      telegramSent,
      telegramError: telegramSent ? null : telegramError,
    });
  } catch (err) {
    console.error("send-message error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
