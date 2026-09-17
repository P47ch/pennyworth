import { fileURLToPath } from "node:url";
import type { ReadStream, WriteStream } from "node:tty";
import { prisma } from "../src/lib/db.js";
import { resetUserPasswordByEmail } from "../src/services/passwordRecovery.js";

const usage = "Usage: npm run auth:reset-password -- --email user@example.com";

export function recoveryEmailArgument(args: string[]) {
  if (args.length !== 2 || args[0] !== "--email" || !args[1]) {
    throw new Error(usage);
  }

  return args[1];
}

export function promptForHiddenInput(
  prompt: string,
  input = process.stdin as ReadStream,
  output = process.stdout as WriteStream
): Promise<string> {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Password recovery requires an interactive terminal.");
  }

  const wasRaw = input.isRaw;
  output.write(prompt);
  input.setEncoding("utf8");
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
    };

    const onData = (chunk: Buffer | string) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("Password recovery cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u0008" || character === "\u007f") {
          value = Array.from(value).slice(0, -1).join("");
          continue;
        }

        if (character >= " ") {
          value += character;
        }
      }
    };

    input.on("data", onData);
  });
}

async function main() {
  const email = recoveryEmailArgument(process.argv.slice(2));
  const password = await promptForHiddenInput("New password: ");
  const confirmation = await promptForHiddenInput("Confirm new password: ");

  if (password !== confirmation) {
    throw new Error("New passwords do not match.");
  }

  const user = await resetUserPasswordByEmail(email, password);
  process.stdout.write(`Password reset for ${user.email}. Existing sessions are now invalid.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Could not reset password.";
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
