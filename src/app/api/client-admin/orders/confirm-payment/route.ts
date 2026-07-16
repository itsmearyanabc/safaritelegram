import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStockState } from "@/lib/stock";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "PENDING_PAYMENT") {
      return NextResponse.json({ error: "Order is not awaiting payment" }, { status: 400 });
    }

    // Use a transaction to safely allocate item
    await prisma.$transaction(async (tx) => {
      // 1. Fetch oldest unallocated item for the product (FIFO)
      const item = await tx.inventoryItem.findFirst({
        where: { productId: order.productId, isAllocated: false },
        orderBy: { createdAt: "asc" },
      });

      if (!item) {
        // If out of stock after payment, flag it
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "PAID",
            adminMessage: "Payment confirmed but item went out of stock. Contact admin.",
          },
        });
        return;
      }

      // 2. Mark item as allocated
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          isAllocated: true,
          allocatedAt: new Date(),
        },
      });

      // 3. Recalculate stock state
      const unallocatedCount = await tx.inventoryItem.count({
        where: { productId: order.productId, isAllocated: false },
      });

      await tx.product.update({
        where: { id: order.productId },
        data: { stockState: getStockState(unallocatedCount) },
      });

      // 4. Update order to COOLDOWN_ACTIVE
      const cooldownSeconds = 30;
      const cooldownEndAt = new Date(Date.now() + cooldownSeconds * 1000);

      await tx.order.update({
        where: { id: orderId },
        data: {
          inventoryItemId: item.id,
          status: "COOLDOWN_ACTIVE",
          cooldownEndAt,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
