import { prisma } from "../lib/db";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const defaultWallet = process.env.CRYPTO_WALLET_ADDRESS || "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
  
  await prisma.setting.upsert({
    where: { key: "CRYPTO_WALLET_ADDRESS" },
    update: {}, // Don't overwrite if it exists
    create: {
      key: "CRYPTO_WALLET_ADDRESS",
      value: defaultWallet,
    },
  });

  console.log("Seeded CRYPTO_WALLET_ADDRESS setting.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
