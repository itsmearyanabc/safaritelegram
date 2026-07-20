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
          items: {
            include: { product: true, inventoryItem: true }
          }
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Customers see only their own orders
      orders = await prisma.order.findMany({
        where: { userId: session.userId },
        include: {
          items: {
            include: { product: true, inventoryItem: true }
          }
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // Safety: Hide inventory item sensitive details if cooldown is still active per item
    const formattedOrders = orders.map((order) => {
      return {
        ...order,
        items: order.items.map((item) => {
          const isCooldownActive = item.status === "COOLDOWN_ACTIVE" && item.cooldownEndAt && item.cooldownEndAt.getTime() > Date.now();
          return {
            ...item,
            inventoryItem: isCooldownActive || !item.inventoryItem ? null : {
              id: item.inventoryItem.id,
              mediaUrl: item.inventoryItem.mediaUrl,
              locationData: item.inventoryItem.locationData,
              data: item.status === "READY" || item.status === "COMPLETED" ? item.inventoryItem.data : "[Available after Cooldown]",
            }
          };
        })
      };
    });

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error("Fetch orders list error:", error);
    return NextResponse.json({ error: "Internal server error fetching orders" }, { status: 500 });
  }
}
