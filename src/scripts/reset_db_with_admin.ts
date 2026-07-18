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
  await prisma.depositRequest.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.setting.deleteMany({});
  await prisma.user.deleteMany({});

  // Create default Admin account
  const salt = await bcrypt.genSalt(10);
  const adminPassword = process.env.ADMIN_PASSWORD || "admin2026";
  const adminPasswordHash = await bcrypt.hash(adminPassword, salt);

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: adminPasswordHash,
      passwordPlain: adminPassword,
      role: "SUPERADMIN",
    },
  });

  // Create wallet for admin
  await prisma.wallet.create({
    data: { userId: admin.id, balance: 0.0 },
  });

  // Seed default settings
  await prisma.setting.create({
    data: {
      key: "CRYPTO_WALLET_ADDRESS",
      value: process.env.CRYPTO_WALLET_ADDRESS || "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    },
  });

  console.log("====================================================");
  console.log("   DATABASE RESET COMPLETE WITH FRESH ADMIN SEED   ");
  console.log("====================================================");
  console.log("Username: admin");
  console.log(`Password: ${adminPassword}`);
  console.log("Role: SUPERADMIN");
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
