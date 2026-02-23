import { spawn } from "bun";

console.log("\x1b[36m%s\x1b[0m", "=== HIA Development Stack Starting ===");

const worker = spawn(["bun", "worker.ts"], { stdout: "inherit", stderr: "inherit" });
const next = spawn(["next", "dev", "--webpack"], { stdout: "inherit", stderr: "inherit" });

process.on("SIGINT", () => {
  worker.kill();
  next.kill();
  process.exit(0);
});

await Promise.all([worker.exited, next.exited]);
