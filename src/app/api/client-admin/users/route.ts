import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      include: {
        wallet: true,
        orders: {
          select: { totalAmount: true, status: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    const enrichedUsers = users.map(u => {
      const completedOrders = u.orders.filter(o => ["PAID", "READY", "COMPLETED"].includes(o.status));
      const totalSpent = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

      return {
        id: u.id,
        username: u.username,
        role: u.role,
        telegramUsername: u.telegramUsername,
        telegramId: u.telegramId,
        passwordPlain: u.passwordPlain,
        createdAt: u.createdAt.toISOString(),
        totalOrders: u.orders.length,
        totalSpent,
        wallet: u.wallet ? { balance: u.wallet.balance } : { balance: 0 },
      };
    });

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Client Admin fetch users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
