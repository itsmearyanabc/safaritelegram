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

    const { userId, amount } = await req.json();
    const adjustAmount = parseFloat(amount);

    if (!userId || isNaN(adjustAmount)) {
      return NextResponse.json({ error: "User ID and valid adjustment amount are required" }, { status: 400 });
    }

    const updatedWallet = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new Error("Target user wallet not found");
      }

      const newWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: adjustAmount } },
      });

      // Log adjustment in transaction ledger
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          amount: adjustAmount,
          description: `Admin manual balance adjustment: ${adjustAmount > 0 ? "+" : ""}$${adjustAmount.toFixed(2)} applied by admin ${session.username}`,
        },
      });

      return newWallet;
    });

    return NextResponse.json({ success: true, balance: updatedWallet.balance });
  } catch (error: any) {
    console.error("Admin wallet adjust error:", error);
    return NextResponse.json({ error: error.message || "Internal server error adjusting wallet" }, { status: 500 });
  }
}
