import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden. Admin privileges required." }, { status: 403 });
    }

    const { disputeId, resolutionType } = await req.json();

    if (!disputeId || !resolutionType) {
      return NextResponse.json({ error: "Dispute ID and resolution type are required" }, { status: 400 });
    }

    if (!["REFUND", "CREDIT", "REPLACEMENT", "REJECTED"].includes(resolutionType)) {
      return NextResponse.json({ error: "Invalid resolution type" }, { status: 400 });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (dispute.status === "RESOLVED") {
      return NextResponse.json({ error: "Dispute has already been resolved" }, { status: 400 });
    }

    const resolvedDispute = await prisma.$transaction(async (tx) => {
      // 1. Process resolution
      if (resolutionType === "REFUND" || resolutionType === "CREDIT") {
        const wallet = await tx.wallet.findUnique({
          where: { userId: dispute.userId },
        });

        if (!wallet) {
          throw new Error("User wallet not found");
        }

        // Add funds back
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: dispute.order.amountPaid } },
        });

        // Add ledger record
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            type: "REFUND",
            amount: dispute.order.amountPaid,
            description: `Refund for order #${dispute.orderId} (Dispute resolved as ${resolutionType})`,
          },
        });

        // Update order status to REFUNDED
        await tx.order.update({
          where: { id: dispute.orderId },
          data: { status: "REFUNDED" },
        });
      } else if (resolutionType === "REPLACEMENT") {
        // Find next FIFO item
        const nextItem = await tx.inventoryItem.findFirst({
          where: { productId: dispute.order.productId, isAllocated: false },
          orderBy: { createdAt: "asc" },
        });

        if (!nextItem) {
          throw new Error("No replacement items in stock. Please resolve with REFUND instead.");
        }

        // Allocate replacement item
        await tx.inventoryItem.update({
          where: { id: nextItem.id },
          data: { isAllocated: true, allocatedAt: new Date() },
        });

        // Update order with new item and reset status to READY
        await tx.order.update({
          where: { id: dispute.orderId },
          data: { inventoryItemId: nextItem.id, status: "READY" },
        });
      }

      // 2. Update dispute status to RESOLVED
      const updatedDispute = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: "RESOLVED",
          resolutionType,
        },
      });

      return updatedDispute;
    });

    return NextResponse.json({ success: true, dispute: resolvedDispute });
  } catch (error: any) {
    console.error("Resolve dispute error:", error);
    return NextResponse.json({ error: error.message || "Internal server error resolving dispute" }, { status: 500 });
  }
}
