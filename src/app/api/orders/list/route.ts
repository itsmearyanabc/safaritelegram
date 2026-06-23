import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let orders;
    
    // Admins and Staff see all orders in the system
    if (["STAFF", "ADMIN", "SUPERADMIN"].includes(session.role)) {
      orders = await prisma.order.findMany({
        include: {
          user: { select: { username: true, telegramUsername: true } },
          product: true,
          inventoryItem: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Customers see only their own orders
      orders = await prisma.order.findMany({
        where: { userId: session.userId },
        include: {
          product: true,
          inventoryItem: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // Safety: Hide inventory item sensitive details if cooldown is still active
    const formattedOrders = orders.map((order) => {
      const isCooldownActive = order.status === "COOLDOWN_ACTIVE" && order.cooldownEndAt && order.cooldownEndAt.getTime() > Date.now();
      
      return {
        ...order,
        orderSource: order.orderSource,
        adminMessage: order.adminMessage,
        adminMessageSentAt: order.adminMessageSentAt,
        inventoryItem: isCooldownActive || !order.inventoryItem ? null : {
          id: order.inventoryItem.id,
          mediaUrl: order.inventoryItem.mediaUrl,
          locationData: order.inventoryItem.locationData,
          data: order.status === "READY" || order.status === "COMPLETED" ? order.inventoryItem.data : "[Available after Cooldown]",
        },
      };
    });

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error("Fetch orders list error:", error);
    return NextResponse.json({ error: "Internal server error fetching orders" }, { status: 500 });
  }
}
