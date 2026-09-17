import { describe, expect, it } from "vitest";
import { requireTestDatabaseUrl } from "../scripts/integration-environment.js";

describe("integration database safety", () => {
  it("requires an explicitly test-named database or schema", () => {
    expect(() => requireTestDatabaseUrl({})).toThrow("TEST_DATABASE_URL is required");
    expect(() =>
      requireTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://user:password@localhost:5432/pennyworth?schema=public"
      })
    ).toThrow("database or schema name must contain 'test'");
  });

  it("accepts test databases and test schemas", () => {
    expect(
      requireTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://user:password@localhost:5432/pennyworth_test?schema=public"
      })
    ).toContain("pennyworth_test");
    expect(
      requireTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://user:password@localhost:5432/pennyworth?schema=integration_test"
      })
    ).toContain("integration_test");
  });

  it("refuses production execution", () => {
    expect(() =>
      requireTestDatabaseUrl({
        NODE_ENV: "production",
        TEST_DATABASE_URL: "postgresql://user:password@localhost:5432/pennyworth_test?schema=public"
      })
    ).toThrow("disabled when NODE_ENV=production");
  });
});
