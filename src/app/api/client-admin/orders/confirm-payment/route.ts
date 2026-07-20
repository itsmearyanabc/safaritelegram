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
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "PENDING_PAYMENT") {
      return NextResponse.json({ error: "Order is not awaiting payment" }, { status: 400 });
    }

    // Use a transaction to safely allocate items
    await prisma.$transaction(async (tx) => {
      let anyOutOfStock = false;
      const updatedProductIds: string[] = [];

      const cooldownSeconds = 30;
      const cooldownEndAt = new Date(Date.now() + cooldownSeconds * 1000);

      for (const orderItem of order.items) {
        // 1. Fetch oldest unallocated item for the product (FIFO)
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { productId: orderItem.productId, isAllocated: false },
          orderBy: { createdAt: "asc" },
        });

        if (!inventoryItem) {
          anyOutOfStock = true;
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: {
              status: "PAID",
              adminMessage: "Payment confirmed but this item went out of stock. Contact admin.",
            },
          });
        } else {
          // 2. Mark item as allocated
          const claimed = await tx.inventoryItem.updateMany({
            where: { id: inventoryItem.id, isAllocated: false },
            data: { isAllocated: true, allocatedAt: new Date() },
          });
          if (claimed.count !== 1) {
            throw new Error(`Inventory item for ${orderItem.product.name} is no longer available. Refresh and try again.`);
          }

          if (!updatedProductIds.includes(orderItem.productId)) {
            updatedProductIds.push(orderItem.productId);
          }

          // 3. Update order item to COOLDOWN_ACTIVE
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: {
              inventoryItemId: inventoryItem.id,
              status: "COOLDOWN_ACTIVE",
              cooldownEndAt,
            },
          });
        }
      }

      // 4. Recalculate stock state
      for (const pid of updatedProductIds) {
        const unallocatedCount = await tx.inventoryItem.count({
          where: { productId: pid, isAllocated: false },
        });
        await tx.product.update({
          where: { id: pid },
          data: { stockState: getStockState(unallocatedCount) },
        });
      }

      // 5. Update master order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: anyOutOfStock ? "PAID" : "COOLDOWN_ACTIVE",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confirm payment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
