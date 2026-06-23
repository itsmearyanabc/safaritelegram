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
      },
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        telegramUsername: user.telegramUsername,
        telegramId: user.telegramId,
        wallet: {
          balance: user.wallet?.balance || 0.0,
        },
      },
    });
  } catch (error) {
    console.error("Fetch current user error:", error);
    return NextResponse.json({ error: "Internal server error fetching user session" }, { status: 500 });
  }
}
