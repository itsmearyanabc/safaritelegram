import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // Telegram Bot Integration - send message if user has linked their Telegram
    if (order.user.telegramId) {
      const botToken = process.env.TELEGRAM_BOT_1_TOKEN;
      if (botToken && botToken !== "PLACEHOLDER_BOT_1_TOKEN") {
        try {
          const telegramMessage = `📦 *Order Update for ${order.product.name}*\n\n` +
                                  `Admin sent coordinates/details:\n` +
                                  `\`${message}\`\n\n` +
                                  `Status updated to: *${newStatus}*`;
          
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: order.user.telegramId,
              text: telegramMessage,
              parse_mode: 'Markdown',
            })
          });
        } catch {
          // Don't fail the request if Telegram fails, as the message is saved in DB.
        }
      }
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
