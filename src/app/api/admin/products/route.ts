import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    include: {
      category: { select: { id: true, name: true } },
      items: { select: { id: true, isAllocated: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    products: products.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      formula: p.formula,
      casNumber: p.casNumber,
      imageUrl: p.imageUrl,
      stockState: p.stockState,
      categoryId: p.category.id,
      categoryName: p.category.name,
      totalItems: p.items.length,
      availableItems: p.items.filter((i: any) => !i.isAllocated).length,
      allocatedItems: p.items.filter((i: any) => i.isAllocated).length,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, price, formula, casNumber, imageUrl, categoryId } = await req.json();

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Product name must be at least 2 characters" }, { status: 400 });
  }
  if (!price || price <= 0) {
    return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
  }
  if (!categoryId) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Product with this name already exists" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      price: parseFloat(price),
      formula: formula?.trim() || null,
      casNumber: casNumber?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      categoryId,
    },
  });

  return NextResponse.json({ product });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId } = await req.json();
  if (!productId) {
    return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
  }

  await prisma.product.delete({ where: { id: productId } });
  return NextResponse.json({ success: true });
}
