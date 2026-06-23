import { prisma } from "../lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Wiping database and creating fresh admin account...");

  // Wipe all records in correct order of dependency
  await prisma.dispute.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.walletLedger.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.user.deleteMany({});

  // Create default Admin account
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash("admin123", salt);

  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  console.log("====================================================");
  console.log("   DATABASE RESET COMPLETE WITH FRESH ADMIN SEED   ");
  console.log("====================================================");
  console.log("Username: admin");
  console.log("Password: admin123");
  console.log("====================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
