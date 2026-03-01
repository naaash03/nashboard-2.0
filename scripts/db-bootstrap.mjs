import { spawnSync } from "node:child_process";

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpmScript(scriptName) {
  console.log(`\n> npm run ${scriptName}`);
  const result = spawnSync(npmBin, ["run", scriptName], {
    stdio: "inherit",
    shell: false,
  });
  return result.status ?? 1;
}

function printDockerFailureGuidance() {
  console.error("\nDatabase bootstrap stopped: unable to start Docker Postgres.");
  console.error("Options:");
  console.error("A) Start Docker Desktop and retry:");
  console.error("   1) Open Docker Desktop");
  console.error("   2) Enable 'Use the WSL 2 based engine' in Settings");
  console.error("   3) Run: npm run db:doctor");
  console.error("   4) Retry: npm run db:bootstrap");
  console.error("B) Use external Postgres (Neon/Supabase/local Postgres):");
  console.error("   1) Set DATABASE_URL in .env.local");
  console.error("   2) Run: npm run db:migrate");
  console.error("   3) Run: npm run db:seed");
}

console.log("NashBoard DB Bootstrap");
console.log("Step 1/3: starting Postgres with Docker...");
const upCode = runNpmScript("db:up");
if (upCode !== 0) {
  printDockerFailureGuidance();
  process.exit(upCode);
}

console.log("\nStep 2/3: applying migrations...");
const migrateCode = runNpmScript("db:migrate");
if (migrateCode !== 0) {
  process.exit(migrateCode);
}

console.log("\nStep 3/3: seeding data...");
const seedCode = runNpmScript("db:seed");
if (seedCode !== 0) {
  process.exit(seedCode);
}

console.log("\nDatabase bootstrap completed.");
