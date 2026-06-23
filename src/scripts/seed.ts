import { prisma } from "../lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.dispute.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.walletLedger.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create Users
  const salt = await bcrypt.genSalt(10);
  
  const adminPassword = await bcrypt.hash("admin123", salt);
  const staffPassword = await bcrypt.hash("staff123", salt);
  const customerPassword = await bcrypt.hash("customer123", salt);

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const staff = await prisma.user.create({
    data: {
      username: "staff",
      passwordHash: staffPassword,
      role: "STAFF",
    },
  });

  const customer = await prisma.user.create({
    data: {
      username: "customer",
      passwordHash: customerPassword,
      role: "CUSTOMER",
    },
  });

  // Initialize customer wallet
  await prisma.wallet.create({
    data: {
      userId: customer.id,
      balance: 500.0, // Start with some test cash
    },
  });

  console.log("Users seeded successfully.");

  // 2. Create Categories
  const acids = await prisma.category.create({
    data: { name: "Acids", description: "Corrosive chemical compounds with pH < 7" },
  });

  const bases = await prisma.category.create({
    data: { name: "Bases", description: "Alkaline chemical compounds with pH > 7" },
  });

  const salts = await prisma.category.create({
    data: { name: "Salts", description: "Neutral ionic compounds formed by acid-base neutralization" },
  });

  const solvents = await prisma.category.create({
    data: { name: "Organic Solvents", description: "Carbon-based solvents for dissolution" },
  });

  console.log("Categories seeded successfully.");

  // 3. Create Products (Chemical Compounds)
  const productData = [
    {
      categoryId: acids.id,
      name: "Sulfuric Acid 98%",
      description: "Industrial grade concentrated sulfuric acid for chemistry labs.",
      price: 45.0,
      formula: "H2SO4",
      casNumber: "7664-93-9",
      stockState: "IN_STOCK",
    },
    {
      categoryId: acids.id,
      name: "Hydrochloric Acid 37%",
      description: "Laboratory grade hydrochloric acid for pH adjustment and cleaning.",
      price: 25.0,
      formula: "HCl",
      casNumber: "7647-01-0",
      stockState: "IN_STOCK",
    },
    {
      categoryId: bases.id,
      name: "Sodium Hydroxide (Lye) Pellets",
      description: "Anhydrous NaOH pellets, high purity 99%, for neutralization and soap making.",
      price: 18.5,
      formula: "NaOH",
      casNumber: "1310-73-2",
      stockState: "IN_STOCK",
    },
    {
      categoryId: salts.id,
      name: "Copper(II) Sulfate Pentahydrate",
      description: "Bright blue crystalline salt for analytical testing and agricultural use.",
      price: 32.0,
      formula: "CuSO4·5H2O",
      casNumber: "7758-99-8",
      stockState: "IN_STOCK",
    },
    {
      categoryId: solvents.id,
      name: "Acetone 99.9% Pure",
      description: "Aqueous-free pure organic solvent for cleaning laboratory glassware.",
      price: 22.0,
      formula: "CH3COCH3",
      casNumber: "67-64-1",
      stockState: "IN_STOCK",
    },
  ];

  const products = [];
  for (const p of productData) {
    const createdProduct = await prisma.product.create({ data: p });
    products.push(createdProduct);
  }

  console.log("Products seeded successfully.");

  // 4. Create FIFO Inventory Items (allocated in order of creation)
  // For each product, we create 5 inventory items
  for (const product of products) {
    for (let i = 1; i <= 5; i++) {
      await prisma.inventoryItem.create({
        data: {
          productId: product.id,
          data: `BATCH-${product.formula || "CHEM"}-${1000 + i} | Batch Certificate: https://certificates.safari-boys.io/batch-${product.formula?.toLowerCase()}-${i}.pdf | Lab pickup locker instructions: Go to shelf A${i}, enter code *9821#`,
          mediaUrl: `https://images.unsplash.com/photo-1603126857599-${i}?w=500&auto=format&fit=crop`,
          locationData: `Storage Bay ${String.fromCharCode(65 + i)}-${i * 10} | Coordinates: 45.4215° N, 75.6972° W`,
          isAllocated: false,
        },
      });
    }
  }

  console.log("FIFO Inventory Items seeded successfully.");
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
