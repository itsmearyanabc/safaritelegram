import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderItemId, status } = await req.json();

    if (!orderItemId || !status) {
      return NextResponse.json({ error: "Order Item ID and status are required" }, { status: 400 });
    }

    const validStatuses = ["PENDING_PAYMENT", "PAID", "PROCESSING", "COOLDOWN_ACTIVE", "READY", "COMPLETED", "REFUNDED", "FAILED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status provided" }, { status: 400 });
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });

    if (!orderItem) {
      return NextResponse.json({ error: "Order Item not found" }, { status: 404 });
    }

    const updatedOrderItem = await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.update({
        where: { id: orderItemId },
        data: { status },
      });

      // Simple sync to master order: if all items are completed/ready, update master
      const allItems = await tx.orderItem.findMany({ where: { orderId: orderItem.orderId } });
      const allCompleted = allItems.every(i => i.status === "COMPLETED");
      const allReadyOrCompleted = allItems.every(i => ["READY", "COMPLETED"].includes(i.status));

      if (allCompleted) {
        await tx.order.update({ where: { id: orderItem.orderId }, data: { status: "COMPLETED" } });
      } else if (allReadyOrCompleted) {
        await tx.order.update({ where: { id: orderItem.orderId }, data: { status: "READY" } });
      }

      return item;
    });

    return NextResponse.json({ success: true, orderItem: updatedOrderItem });
  } catch (err) {
    console.error("update-status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
