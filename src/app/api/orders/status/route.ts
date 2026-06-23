import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    let order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        inventoryItem: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify ownership
    if (order.userId !== session.userId && !["STAFF", "ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized access to order" }, { status: 403 });
    }

    // Check if cooldown has finished
    if (order.status === "COOLDOWN_ACTIVE" && order.cooldownEndAt) {
      const now = new Date();
      if (now >= order.cooldownEndAt) {
        order = await prisma.order.update({
          where: { id: orderId },
          data: { status: "READY" },
          include: {
            product: true,
            inventoryItem: true,
          },
        });
      }
    }

    // Clean sensitive data if still in cooldown
    const isCooldownActive = order.status === "COOLDOWN_ACTIVE" && order.cooldownEndAt && new Date(order.cooldownEndAt).getTime() > Date.now();
    const cleanInventoryItem = isCooldownActive || !order.inventoryItem ? null : {
      id: order.inventoryItem.id,
      mediaUrl: order.inventoryItem.mediaUrl,
      locationData: order.inventoryItem.locationData,
      data: order.status === "READY" || order.status === "COMPLETED" ? order.inventoryItem.data : "[Available after Cooldown]",
    };

    return NextResponse.json({
      order: {
        ...order,
        inventoryItem: cleanInventoryItem,
      },
    });
  } catch (error) {
    console.error("Order status update error:", error);
    return NextResponse.json({ error: "Internal server error checking order status" }, { status: 500 });
  }
}
