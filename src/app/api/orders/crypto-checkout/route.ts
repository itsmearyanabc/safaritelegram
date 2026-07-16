import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCryptoInfo, CRYPTO_CURRENCIES } from "@/lib/currencies";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, cryptoCurrency } = await req.json();
    if (!productId || !cryptoCurrency) {
      return NextResponse.json({ error: "Product ID and crypto currency are required" }, { status: 400 });
    }

    // Validate crypto currency
    const cryptoInfo = getCryptoInfo(cryptoCurrency);
    if (!cryptoInfo) {
      return NextResponse.json({ 
        error: "Unsupported cryptocurrency",
        supported: CRYPTO_CURRENCIES.map(c => c.code),
      }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.stockState === "OUT_OF_STOCK") {
      return NextResponse.json({ error: "Product is out of stock" }, { status: 400 });
    }

    // Fetch the admin's wallet address for this currency
    const walletSetting = await prisma.setting.findUnique({
      where: { key: cryptoInfo.settingKey },
    });

    if (!walletSetting || !walletSetting.value) {
      return NextResponse.json({ error: "Payment method not configured for this currency" }, { status: 400 });
    }

    // Fetch estimated network fee for this currency
    const feeSetting = await prisma.setting.findUnique({
      where: { key: cryptoInfo.feeSettingKey },
    });
    const networkFee = feeSetting ? parseFloat(feeSetting.value) : 0;

    // Create order with PENDING_PAYMENT status
    const order = await prisma.order.create({
      data: {
        userId: session.userId,
        productId: product.id,
        amountPaid: product.price,
        currency: product.currency,
        status: "PENDING_PAYMENT",
        orderSource: "WEBSITE",
        paymentMethod: "DIRECT_CRYPTO",
        cryptoCurrency: cryptoCurrency,
        networkFee: networkFee,
        cryptoAmountDue: (product.price + networkFee).toFixed(2),
        paymentWalletAddress: walletSetting.value,
      },
      include: {
        product: true,
      },
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        productName: order.product.name,
        amountPaid: order.amountPaid,
        currency: order.currency,
        cryptoCurrency: cryptoCurrency,
        cryptoName: cryptoInfo.name,
        network: cryptoInfo.network,
        networkFee: networkFee,
        totalDue: product.price + networkFee,
        walletAddress: walletSetting.value,
        status: order.status,
      },
    });
  } catch {
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
