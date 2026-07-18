import { prisma } from "../lib/db";

async function main() {
  console.log("Deleting all CUSTOMER accounts and associated data...");
  
  const result = await prisma.user.deleteMany({
    where: { role: "CUSTOMER" }
  });

  console.log(`Successfully deleted ${result.count} customer accounts.`);
  console.log("All associated orders, wallets, and disputes were also deleted via cascading constraints.");
}

main()
  .catch((e) => {
    console.error("Error wiping customers:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
