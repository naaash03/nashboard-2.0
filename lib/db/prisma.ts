import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function buildClient(): PrismaClient {
  if (!connectionString) {
    return new Proxy({} as PrismaClient, {
      get() {
        throw new Error("DATABASE_URL is not set in the environment");
      },
    });
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production" && connectionString) {
  globalForPrisma.prisma = prisma;
}

export default prisma;

