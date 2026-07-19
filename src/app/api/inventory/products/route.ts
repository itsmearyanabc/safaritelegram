import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStockState } from "@/lib/stock";


export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        products: {
          include: {
            items: {
              where: { isAllocated: false },
            },
          },
        },
      },
    });

    // Format output and dynamically update stockState in DB if there is a mismatch
    const formattedCategories = await Promise.all(
      categories.map(async (category) => {
        const products = await Promise.all(
          category.products.map(async (product) => {
            const unallocatedCount = product.items.length;

            return {
              id: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              currency: product.currency,
              formula: product.formula,
              casNumber: product.casNumber,
              imageUrl: product.imageUrl,
              stockState: product.stockState,
              stockCount: unallocatedCount,
            };
          })
        );

        return {
          id: category.id,
          name: category.name,
          description: category.description,
          products,
        };
      })
    );

    return NextResponse.json({ categories: formattedCategories });
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json({ error: "Internal server error fetching products" }, { status: 500 });
  }
}
