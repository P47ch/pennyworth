import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applicationVersion } from "../src/lib/version.js";

type Lockfile = {
  version?: string;
  packages?: Record<string, { version?: string }>;
};

describe("application version", () => {
  it("uses one valid Semantic Version across package metadata", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as { version?: string };
    const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8")) as Lockfile;

    expect(applicationVersion).toBe(manifest.version);
    expect(lockfile.version).toBe(applicationVersion);
    expect(lockfile.packages?.[""]?.version).toBe(applicationVersion);
    expect(applicationVersion).toMatch(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
    );
  });

  it("renders the authoritative version in the authenticated layout", () => {
    const layout = readFileSync("src/views/layout.ejs", "utf8");

    expect(layout).toContain("v<%= appVersion %>");
  });
});
