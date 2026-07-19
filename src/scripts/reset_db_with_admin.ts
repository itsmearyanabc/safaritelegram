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
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 8) {
    throw new Error("ADMIN_PASSWORD env var must be set and at least 8 characters long");
  }
  const salt = await bcrypt.genSalt(10);
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
  const walletAddress = process.env.CRYPTO_WALLET_ADDRESS;
  if (!walletAddress) {
    console.warn("⚠️  CRYPTO_WALLET_ADDRESS not set — skipping default wallet address seed");
  } else {
    await prisma.setting.create({
      data: {
        key: "CRYPTO_WALLET_ADDRESS",
        value: walletAddress,
      },
    });
  }

  console.log("====================================================");
  console.log("   DATABASE RESET COMPLETE WITH FRESH ADMIN SEED   ");
  console.log("====================================================");
  console.log("Username: admin");
  console.log("Password: [HIDDEN — set via ADMIN_PASSWORD env var]");
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
