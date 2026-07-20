import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStockState } from "@/lib/stock";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cart, paymentMethod } = await req.json();
    
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Process checkout using database transactions to avoid race conditions
    const order = await prisma.$transaction(async (tx) => {
      // 1. Fetch user wallet
      const wallet = await tx.wallet.findUnique({
        where: { userId: session.userId },
      });

      if (!wallet) throw new Error("Wallet not found.");

      let totalAmountDue = 0;
      const orderItemsData = [];
      const claimedInventoryIds: string[] = [];
      const updatedProductIds: string[] = [];

      // 2. Validate inventory and calculate total price
      for (const cartItem of cart) {
        const { productId, quantity } = cartItem;
        
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product) throw new Error(`Product not found: ${productId}`);

        // Fetch oldest unallocated items for this product
        const items = await tx.inventoryItem.findMany({
          where: { productId, isAllocated: false },
          orderBy: { createdAt: "asc" }, // FIFO ordering
          take: quantity,
        });

        if (items.length < quantity) {
          throw new Error(`Not enough stock for ${product.name}. Requested: ${quantity}, Available: ${items.length}`);
        }

        const itemCost = Number(product.price);
        totalAmountDue += itemCost * quantity;

        for (const item of items) {
          claimedInventoryIds.push(item.id);
          orderItemsData.push({
            productId: product.id,
            inventoryItemId: item.id,
            priceAtPurchase: product.price,
            status: "COOLDOWN_ACTIVE",
            cooldownEndAt: new Date(Date.now() + 30 * 1000), // 30 sec cooldown
          });
        }
        
        if (!updatedProductIds.includes(product.id)) {
          updatedProductIds.push(product.id);
        }
      }

      // 3. Handle Wallet Payment
      if (paymentMethod === "WALLET") {
        if (Number(wallet.balance) < totalAmountDue) {
          throw new Error("Insufficient wallet balance. Please deposit funds or select Crypto.");
        }

        // Deduct from wallet balance
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: totalAmountDue } },
        });

        // Create ledger entry
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            type: "PURCHASE",
            amount: -totalAmountDue,
            description: `Checkout of ${cart.length} item(s)`,
          },
        });
      }

      // 4. Mark items as allocated
      const claimed = await tx.inventoryItem.updateMany({
        where: { id: { in: claimedInventoryIds }, isAllocated: false },
        data: { isAllocated: true, allocatedAt: new Date() },
      });
      
      if (claimed.count !== claimedInventoryIds.length) {
        throw new Error("Some items were just purchased by another customer. Please try again.");
      }

      // 5. Recalculate and update stock state for affected products
      for (const pid of updatedProductIds) {
        const unallocatedCount = await tx.inventoryItem.count({
          where: { productId: pid, isAllocated: false },
        });

        await tx.product.update({
          where: { id: pid },
          data: { stockState: getStockState(unallocatedCount) },
        });
      }

      // 6. Create Master Order and OrderItems
      const createdOrder = await tx.order.create({
        data: {
          userId: session.userId,
          totalAmount: totalAmountDue,
          status: paymentMethod === "WALLET" ? "COOLDOWN_ACTIVE" : "PENDING_PAYMENT",
          orderSource: "WEBSITE",
          paymentMethod: paymentMethod || "WALLET",
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: { product: true }
          }
        },
      });

      return createdOrder;
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    const msg = error?.message || "";
    const isUserError = msg.includes("Insufficient") || msg.includes("Not enough stock") || msg.includes("another customer");
    return NextResponse.json({ error: isUserError ? msg : "Checkout failed" }, { status: isUserError ? 400 : 500 });
  }
}
