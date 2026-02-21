import { spawn } from "bun";

async function startDev() {
  console.log("\x1b[36m%s\x1b[0m", "=== HIA Development Stack Starting ===");

  // 1. Start Worker
  const worker = spawn(["bun", "worker.ts"], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, DEBUG: "worker" }
  });

  // 2. Start Next.js
  const next = spawn(["next", "dev", "--webpack"], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, PORT: "3000" }
  });

  console.log("\x1b[32m%s\x1b[0m", "✔ Worker and Next.js are running.");
  console.log("\x1b[90m%s\x1b[0m", "Press Ctrl+C to stop all processes.");

  // Handle shutdown
  process.on("SIGINT", () => {
    console.log("
\x1b[33m%s\x1b[0m", "Shutting down...");
    worker.kill();
    next.kill();
    process.exit(0);
  });

  // Keep alive
  await Promise.all([worker.exited, next.exited]);
}

startDev();
