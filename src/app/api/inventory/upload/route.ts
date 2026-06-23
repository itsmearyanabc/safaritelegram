import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStockState } from "../products/route";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["STAFF", "ADMIN", "SUPERADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden. Staff or Admin role required." }, { status: 403 });
    }

    const { productId, data, mediaUrl, locationData } = await req.json();

    if (!productId || !data) {
      return NextResponse.json({ error: "Product ID and item data are required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Insert inventory item and update stock state in transaction
    const newItem = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          productId,
          data,
          mediaUrl: mediaUrl || null,
          locationData: locationData || null,
          isAllocated: false,
        },
      });

      // Recalculate count
      const unallocatedCount = await tx.inventoryItem.count({
        where: { productId, isAllocated: false },
      });

      // Update state
      await tx.product.update({
        where: { id: productId },
        data: { stockState: getStockState(unallocatedCount) },
      });

      return item;
    });

    return NextResponse.json({ success: true, item: newItem });
  } catch (error: any) {
    console.error("Inventory upload error:", error);
    return NextResponse.json({ error: "Internal server error during upload" }, { status: 500 });
  }
}
