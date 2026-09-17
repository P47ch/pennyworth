export function requireTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === "production") {
    throw new Error("Integration tests are disabled when NODE_ENV=production.");
  }

  const value = env.TEST_DATABASE_URL;

  if (!value) {
    throw new Error("TEST_DATABASE_URL is required for integration tests.");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must use the postgresql protocol.");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, "")).toLowerCase();
  const schemaName = (url.searchParams.get("schema") ?? "").toLowerCase();

  if (!databaseName.includes("test") && !schemaName.includes("test")) {
    throw new Error("TEST_DATABASE_URL database or schema name must contain 'test'.");
  }

  return value;
}
