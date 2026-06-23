import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST: Add inventory items to a product
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId, items } = await req.json();

  if (!productId) {
    return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one inventory item is required" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Create inventory items
  const created = await prisma.inventoryItem.createMany({
    data: items.map((item: any) => ({
      productId,
      data: item.data || "N/A",
      mediaUrl: item.mediaUrl || null,
      locationData: item.locationData || null,
    })),
  });

  // Update product stock state
  const availableCount = await prisma.inventoryItem.count({
    where: { productId, isAllocated: false },
  });

  let stockState = "OUT_OF_STOCK";
  if (availableCount >= 10) stockState = "IN_STOCK";
  else if (availableCount >= 5) stockState = "LOW_STOCK";
  else if (availableCount >= 1) stockState = "CRITICAL_STOCK";

  await prisma.product.update({
    where: { id: productId },
    data: { stockState },
  });

  return NextResponse.json({
    success: true,
    itemsCreated: created.count,
    newStockState: stockState,
    availableCount,
  });
}
