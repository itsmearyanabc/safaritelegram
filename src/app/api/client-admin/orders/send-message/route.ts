import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { escapeTelegramMarkdown } from "@/lib/stock";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, message, file, fileName, fileType } = await req.json();

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

    // Save file locally if provided
    let fileUrl: string | null = null;
    let localFileType: string | null = null;
    let fileBuffer: Buffer | null = null;

    if (file && fileName && fileType) {
      // Decode base64 file
      const matches = file.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      const base64Data = matches ? matches[2] : file;
      fileBuffer = Buffer.from(base64Data, "base64");

      const uploadDir = path.join(process.cwd(), "public", "uploads", "attachments");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uniqueFileName = `${orderId}-${Date.now()}-${fileName}`;
      const filePath = path.join(uploadDir, uniqueFileName);
      fs.writeFileSync(filePath, fileBuffer);
      fileUrl = `/uploads/attachments/${uniqueFileName}`;
      localFileType = fileType;
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
        adminMessageFileUrl: fileUrl,
        adminMessageFileType: localFileType,
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

          if (fileBuffer && fileName && localFileType) {
            // Send as file attachment using multipart FormData
            const formData = new FormData();
            formData.append("chat_id", order.user.telegramId);

            // Determine method and field based on file type
            let method = "sendDocument";
            let field = "document";

            if (localFileType.startsWith("image/")) {
              method = "sendPhoto";
              field = "photo";
            } else if (localFileType.startsWith("video/")) {
              method = "sendVideo";
              field = "video";
            }

            const blob = new Blob([new Uint8Array(fileBuffer)], { type: localFileType });
            formData.append(field, blob, fileName);
            formData.append("caption", telegramMessage);
            formData.append("parse_mode", "Markdown");

            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
              method: "POST",
              body: formData,
            });

            const tgBody = (await tgRes.json().catch(() => null)) as {
              ok?: boolean;
              description?: string;
            } | null;

            if (tgRes.ok && tgBody?.ok) {
              telegramSent = true;
            } else {
              telegramError = tgBody?.description || `Telegram HTTP ${tgRes.status}`;
            }
          } else {
            // Send regular text message
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
            }
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
