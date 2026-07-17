import dotenv from "dotenv";
import path from "path";

// Scripts/bots import this module before Next.js loads env — ensure .env is available.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let prisma: PrismaClient;

if (globalForPrisma.prisma) {
  prisma = globalForPrisma.prisma;
} else {
  const connectionString = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set. Please configure your PostgreSQL connection string.");
  }

  // Prisma 7 reads the datasource URL from prisma.config.ts at generate-time.
  // We still validate DATABASE_URL above for a clear early error in scripts/bots.
  prisma = new PrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }
}

export { prisma };
