import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { telegramId, telegramUsername } = await req.json();

    // Check if telegramId is already linked to a different user
    if (telegramId) {
      const existingUser = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) }
      });
      if (existingUser && existingUser.id !== session.userId) {
        return NextResponse.json({ error: "This Telegram ID is already linked to another account." }, { status: 400 });
      }
    }

    // Update user's telegram account details
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        telegramId: telegramId ? String(telegramId) : null,
        telegramUsername: telegramUsername || null
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        telegramId: updatedUser.telegramId,
        telegramUsername: updatedUser.telegramUsername
      }
    });
  } catch (error) {
    console.error("Update telegram error:", error);
    return NextResponse.json({ error: "Internal server error updating Telegram info." }, { status: 500 });
  }
}
