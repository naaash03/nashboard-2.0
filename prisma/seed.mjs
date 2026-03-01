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
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@nashboard.local" },
    update: { name: "Demo User" },
    create: {
      name: "Demo User",
      email: "demo@nashboard.local",
      emailVerified: new Date(),
    },
  });

  const dashboard = await prisma.dashboard.upsert({
    where: { userId: demoUser.id },
    update: {
      title: "Demo User's Dashboard",
      sport: "NFL",
      isPrivate: true,
      shareScope: "PRIVATE",
      layoutLocked: false,
    },
    create: {
      userId: demoUser.id,
      title: "Demo User's Dashboard",
      sport: "NFL",
      isPrivate: true,
      shareScope: "PRIVATE",
      layoutLocked: false,
    },
  });

  const existingWidgets = await prisma.widgetInstance.findMany({
    where: { dashboardId: dashboard.id },
    select: { widgetType: true, playerId: true },
  });

  const hasSlate = existingWidgets.some((item) => item.widgetType === "tonights_slate");
  const hasHealth = existingWidgets.some((item) => item.widgetType === "data_health");
  const hasWatchlist = existingWidgets.some((item) => item.widgetType === "watchlist");

  if (!hasSlate) {
    await prisma.widgetInstance.create({
      data: {
        dashboardId: dashboard.id,
        widgetType: "tonights_slate",
        sport: "NFL",
        mode: "BEGINNER",
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        config: {},
      },
    });
  }

  if (!hasHealth) {
    await prisma.widgetInstance.create({
      data: {
        dashboardId: dashboard.id,
        widgetType: "data_health",
        sport: "UTILITIES",
        mode: "BEGINNER",
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        config: {},
      },
    });
  }

  if (!hasWatchlist) {
    await prisma.widgetInstance.create({
      data: {
        dashboardId: dashboard.id,
        widgetType: "watchlist",
        sport: "NFL",
        mode: "BEGINNER",
        x: 2,
        y: 0,
        w: 1,
        h: 1,
        config: {},
      },
    });
  }

  const watchlistCount = await prisma.watchlistTeam.count({ where: { userId: demoUser.id, sport: "NFL" } });
  if (watchlistCount === 0) {
    await prisma.watchlistTeam.createMany({
      data: [
        { userId: demoUser.id, sport: "NFL", teamKey: "PHI", teamName: "Philadelphia Eagles" },
        { userId: demoUser.id, sport: "NFL", teamKey: "BUF", teamName: "Buffalo Bills" },
      ],
      skipDuplicates: true,
    });
  }

  console.log("Seed complete.");
  console.log(`Demo user: ${demoUser.email}`);
  console.log(`Dashboard: ${dashboard.title}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
