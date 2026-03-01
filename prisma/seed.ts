import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run seed.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@nashboard.local" },
    update: {
      name: "Admin",
      role: "ADMIN",
      emailVerified: new Date(),
    },
    create: {
      email: "admin@nashboard.local",
      name: "Admin",
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  console.log("Seed complete.");
  console.log(`Admin user ready: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
