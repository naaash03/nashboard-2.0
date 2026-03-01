import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const dockerBin = isWindows ? "docker.exe" : "docker";
const wslBin = isWindows ? "wsl.exe" : "wsl";

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  const ok = result.status === 0;
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return {
    ok,
    output: combined,
    status: result.status,
    error: result.error ? String(result.error) : null,
  };
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printResult(label, result) {
  console.log(`\n$ ${label}`);
  if (result.error) {
    console.log(result.error);
    return;
  }
  if (result.output.length > 0) {
    console.log(result.output);
  } else {
    console.log("(no output)");
  }
}

console.log("NashBoard DB Doctor");
console.log("Checking Docker connectivity for db:bootstrap...");

printSection("Docker Version");
const dockerVersion = runCommand(dockerBin, ["version"]);
printResult("docker version", dockerVersion);

printSection("Docker Contexts");
const dockerContexts = runCommand(dockerBin, ["context", "ls"]);
printResult("docker context ls", dockerContexts);

printSection("Docker Info");
const dockerInfo = runCommand(dockerBin, ["info"]);
printResult("docker info", dockerInfo);

if (isWindows) {
  printSection("WSL Status");
  const wslStatus = runCommand(wslBin, ["--status"]);
  printResult("wsl --status", wslStatus);
}

printSection("Diagnosis");
const dockerHealthy = dockerVersion.ok && dockerContexts.ok && dockerInfo.ok;
if (dockerHealthy) {
  console.log("Docker appears healthy. You can run: npm run db:bootstrap");
} else {
  console.log("Docker is not ready on this machine.");
  console.log("Next steps:");
  console.log("1) Start Docker Desktop.");
  console.log("2) In Docker Desktop settings, enable 'Use the WSL 2 based engine'.");
  if (isWindows) {
    console.log("3) Confirm WSL2 works: wsl --status");
    console.log("4) Check contexts: docker context ls");
    console.log("5) Switch context if needed: docker context use desktop-linux");
  }
  console.log("6) Re-run: npm run db:doctor");
  console.log("If Docker is unavailable, use external Postgres and then run:");
  console.log("  npm run db:migrate");
  console.log("  npm run db:seed");
}
