import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, reason } = await req.json();

    if (!orderId || !reason) {
      return NextResponse.json({ error: "Order ID and reason are required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.userId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized. You do not own this order." }, { status: 403 });
    }

    // Prevent duplicate open disputes for the same order
    const existingDispute = await prisma.dispute.findFirst({
      where: { orderId, status: { in: ["OPEN", "INVESTIGATING"] } },
    });
    if (existingDispute) {
      return NextResponse.json({ error: "An open dispute already exists for this order." }, { status: 400 });
    }

    // Create the dispute and seed initial message
    const dispute = await prisma.$transaction(async (tx) => {
      const d = await tx.dispute.create({
        data: {
          orderId,
          userId: session.userId,
          reason,
          status: "OPEN",
        },
        include: { user: true }
      });
      await tx.disputeMessage.create({
        data: {
          disputeId: d.id,
          senderRole: "CUSTOMER",
          senderName: d.user.username,
          message: reason,
        }
      });
      return d;
    });

    return NextResponse.json({ success: true, dispute });
  } catch (error) {
    console.error("Submit dispute error:", error);
    return NextResponse.json({ error: "Internal server error submitting dispute" }, { status: 500 });
  }
}
