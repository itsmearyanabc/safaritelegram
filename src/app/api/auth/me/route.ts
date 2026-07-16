import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        wallet: true,
        orders: {
          select: {
            amountPaid: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

    const completedOrders = user.orders.filter(o => ["PAID", "READY", "COMPLETED"].includes(o.status));
    const totalSpent = completedOrders.reduce((sum, o) => sum + o.amountPaid, 0);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        telegramUsername: user.telegramUsername,
        telegramId: user.telegramId,
        createdAt: user.createdAt.toISOString(),
        totalOrders: completedOrders.length,
        totalSpent,
        wallet: {
          balance: user.wallet?.balance || 0.0,
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
