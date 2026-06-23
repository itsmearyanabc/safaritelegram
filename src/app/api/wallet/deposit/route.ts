import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount } = await req.json();
    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      return NextResponse.json({ error: "Invalid deposit amount" }, { status: 400 });
    }

    const updatedWallet = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: session.userId },
      });

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const newWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: depositAmount } },
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: "DEPOSIT",
          amount: depositAmount,
          description: `Simulated deposit of $${depositAmount.toFixed(2)}`,
        },
      });

      return newWallet;
    });

    return NextResponse.json({ success: true, balance: updatedWallet.balance });
  } catch (error: any) {
    console.error("Deposit error:", error);
    return NextResponse.json({ error: error.message || "Internal server error during deposit" }, { status: 500 });
  }
}
