import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getStockState } from "../../inventory/products/route";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-cc-webhook-signature");
    const webhookSecret = process.env.COINBASE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: "Missing signature or secret" },
        { status: 400 },
      );
    }

    // Verify signature
    const hmac = crypto.createHmac("sha256", webhookSecret);
    const computedSignature = hmac.update(rawBody).digest("hex");

    // We can use a simple string equality check or timingSafeEqual if preferred.
    if (computedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event?.type;
    const orderId = event.event?.data?.metadata?.orderId;

    if (!orderId) {
      return NextResponse.json({ received: true, ignored: true });
    }

    if (eventType === "charge:confirmed" || eventType === "charge:resolved") {
      // Process successful payment
      await processSuccessfulCharge(orderId);
    } else if (eventType === "charge:failed") {
      // Process failed payment
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "FAILED" },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Coinbase webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function processSuccessfulCharge(orderId: string) {
  // Use a transaction to safely allocate item
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order || order.status !== "PENDING_PAYMENT") {
      return; // Already processed or not found
    }

    // 1. Fetch oldest unallocated item for the product (FIFO)
    const item = await tx.inventoryItem.findFirst({
      where: { productId: order.productId, isAllocated: false },
      orderBy: { createdAt: "asc" },
    });

    if (!item) {
      // If out of stock after payment, we might need manual intervention
      // Mark as PAID but flag it
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          adminMessage:
            "Payment received but item went out of stock. Contact admin.",
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

    // 3. Recalculate and update stock state
    const unallocatedCount = await tx.inventoryItem.count({
      where: { productId: order.productId, isAllocated: false },
    });

    await tx.product.update({
      where: { id: order.productId },
      data: { stockState: getStockState(unallocatedCount) },
    });

    // 4. Update order to COOLDOWN_ACTIVE with inventory item assigned
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

    // We don't create a wallet ledger entry because this bypassed the wallet.
  });
}
