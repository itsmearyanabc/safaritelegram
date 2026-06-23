import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deposits = await prisma.depositRequest.findMany({
      include: {
        user: {
          select: {
            username: true,
            telegramUsername: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ deposits });
  } catch (error: any) {
    console.error("Fetch deposits error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { depositRequestId, action } = await req.json();

    if (!depositRequestId || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const depositRequest = await prisma.depositRequest.findUnique({
      where: { id: depositRequestId },
      include: { user: { include: { wallet: true } } },
    });

    if (!depositRequest) {
      return NextResponse.json({ error: "Deposit request not found" }, { status: 404 });
    }

    if (depositRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Deposit request has already been processed" }, { status: 400 });
    }

    if (action === "REJECT") {
      const updated = await prisma.depositRequest.update({
        where: { id: depositRequestId },
        data: { status: "REJECTED" },
      });
      return NextResponse.json({ success: true, status: updated.status });
    }

    // Approve action (transaction)
    const result = await prisma.$transaction(async (tx) => {
      const wallet = depositRequest.user.wallet;
      if (!wallet) {
        throw new Error("User does not have a wallet");
      }

      // 1. Increment balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: depositRequest.amount } },
      });

      // 2. Create Ledger
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: "DEPOSIT",
          amount: depositRequest.amount,
          description: `Crypto Deposit Approved (Req: ${depositRequest.id.slice(0, 8)})`,
        },
      });

      // 3. Mark request as approved
      const updatedRequest = await tx.depositRequest.update({
        where: { id: depositRequestId },
        data: { status: "APPROVED" },
      });

      return { wallet: updatedWallet, request: updatedRequest };
    });

    return NextResponse.json({ success: true, status: result.request.status, newBalance: result.wallet.balance });
  } catch (error: any) {
    console.error("Process deposit error:", error);
    return NextResponse.json({ error: error.message || "Internal server error during deposit processing" }, { status: 500 });
  }
}
