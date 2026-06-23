import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await prisma.depositRequest.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    });

    const walletSetting = await prisma.setting.findUnique({
      where: { key: "CRYPTO_WALLET_ADDRESS" },
    });

    const cryptoAddress = walletSetting?.value || "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

    return NextResponse.json({ requests, cryptoAddress });
  } catch (error: any) {
    console.error("Fetch deposit requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const wallet = await prisma.wallet.findUnique({
      where: { userId: session.userId },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    const depositRequest = await prisma.depositRequest.create({
      data: {
        userId: session.userId,
        amount: depositAmount,
        status: "PENDING",
      },
    });

    return NextResponse.json({ 
      success: true, 
      depositRequest: {
        id: depositRequest.id,
        amount: depositRequest.amount,
        status: depositRequest.status,
        createdAt: depositRequest.createdAt,
      }
    });
  } catch (error: any) {
    console.error("Deposit request error:", error);
    return NextResponse.json({ error: error.message || "Internal server error during deposit request" }, { status: 500 });
  }
}
