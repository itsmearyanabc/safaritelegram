import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStockState } from "../../inventory/products/route";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Process checkout using database transactions to avoid race conditions
    const order = await prisma.$transaction(async (tx) => {
      // 1. Fetch user wallet and check balance
      const wallet = await tx.wallet.findUnique({
        where: { userId: session.userId },
      });

      if (!wallet || wallet.balance < product.price) {
        throw new Error("Insufficient wallet balance. Please deposit funds.");
      }

      // 2. Fetch oldest unallocated item for the product (FIFO)
      const item = await tx.inventoryItem.findFirst({
        where: { productId, isAllocated: false },
        orderBy: { createdAt: "asc" }, // FIFO ordering
      });

      if (!item) {
        throw new Error("This product is currently out of stock.");
      }

      // 3. Deduct from wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: product.price } },
      });

      // 4. Create ledger entry
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: "PURCHASE",
          amount: -product.price,
          description: `Purchase of compound: ${product.name} (${product.formula || "N/A"})`,
        },
      });

      // 5. Mark item as allocated
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          isAllocated: true,
          allocatedAt: new Date(),
        },
      });

      // 6. Recalculate and update stock state
      const unallocatedCount = await tx.inventoryItem.count({
        where: { productId, isAllocated: false },
      });

      await tx.product.update({
        where: { id: productId },
        data: { stockState: getStockState(unallocatedCount) },
      });

      // 7. Create Order with Cooldown Active (30 seconds for simulated packing/processing)
      const cooldownSeconds = 30;
      const cooldownEndAt = new Date(Date.now() + cooldownSeconds * 1000);

      const createdOrder = await tx.order.create({
        data: {
          userId: session.userId,
          productId: product.id,
          inventoryItemId: item.id,
          amountPaid: product.price,
          status: "COOLDOWN_ACTIVE",
          cooldownEndAt,
          orderSource: "WEBSITE",
          paymentMethod: "WALLET",
        },
        include: {
          product: true,
        },
      });

      return createdOrder;
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: error.message || "Internal server error during checkout" }, { status: 500 });
  }
}
