import { readFileSync } from "node:fs";
import path from "node:path";

type PackageManifest = {
  version?: unknown;
};

function readApplicationVersion(): string {
  const manifestPath = path.join(process.cwd(), "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;

  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("package.json must define a non-empty application version.");
  }

  return manifest.version;
}

export const applicationVersion = readApplicationVersion();
