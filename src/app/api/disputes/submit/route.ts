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

    // Create the dispute
    const dispute = await prisma.dispute.create({
      data: {
        orderId,
        userId: session.userId,
        reason,
        status: "OPEN",
      },
    });

    return NextResponse.json({ success: true, dispute });
  } catch (error) {
    console.error("Submit dispute error:", error);
    return NextResponse.json({ error: "Internal server error submitting dispute" }, { status: 500 });
  }
}
