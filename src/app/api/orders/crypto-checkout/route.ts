import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.stockState === "OUT_OF_STOCK") {
      return NextResponse.json({ error: "Product is out of stock" }, { status: 400 });
    }

    const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Coinbase Commerce API Key not configured" }, { status: 500 });
    }

    // 1. Create a placeholder order
    const order = await prisma.order.create({
      data: {
        userId: session.userId,
        productId: product.id,
        amountPaid: product.price,
        status: "PENDING_PAYMENT",
        orderSource: "WEBSITE",
        paymentMethod: "DIRECT_CRYPTO",
        cryptoCurrency: cryptoCurrency,
      },
    });

    // 2. Create Coinbase Charge
    const chargeRes = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey,
        "X-CC-Version": "2018-03-22",
      },
      body: JSON.stringify({
        name: product.name,
        description: `Order #${order.id.slice(0, 8)}`,
        local_price: {
          amount: product.price.toString(),
          currency: "USD",
        },
        pricing_type: "fixed_price",
        metadata: {
          orderId: order.id,
          userId: session.userId,
        },
      }),
    });

    const chargeData = await chargeRes.json();

    if (!chargeRes.ok) {
      // Cleanup placeholder order if charge creation fails
      await prisma.order.delete({ where: { id: order.id } });
      return NextResponse.json({ error: "Failed to create crypto payment" }, { status: 500 });
    }

    const chargeId = chargeData.data.id;
    const hostedUrl = chargeData.data.hosted_url;

    // 3. Update order with charge info
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        coinbaseChargeId: chargeId,
        coinbaseChargeUrl: hostedUrl,
      },
      include: {
        product: true,
      },
    });

    return NextResponse.json({ success: true, order: updatedOrder, hostedUrl });
  } catch (error: any) {
    console.error("Crypto checkout error:", error);
    return NextResponse.json({ error: error.message || "Internal server error during crypto checkout" }, { status: 500 });
  }
}
