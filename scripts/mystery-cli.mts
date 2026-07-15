import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    loadEnv({ path });
  }
}

const command = process.argv[2];
const { runMysteryCli } = await import("../lib/daily-mystery/cli");

runMysteryCli(command).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
