import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireTestDatabaseUrl } from "./integration-environment.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const testDatabaseUrl = requireTestDatabaseUrl();
const testEnvironment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  NODE_ENV: "test",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "integration-test-session-secret-change-me"
};

function runNodeModule(relativeModulePath: string, args: string[]) {
  const result = spawnSync(process.execPath, [path.join(projectRoot, relativeModulePath), ...args], {
    cwd: projectRoot,
    env: testEnvironment,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runNodeModule("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
runNodeModule("node_modules/vitest/vitest.mjs", ["run", "--config", "vitest.integration.config.ts"]);
