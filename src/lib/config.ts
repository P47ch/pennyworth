const developmentSessionSecret = "development-only-secret-change-me";

export type AppConfig = {
  sessionSecret: string;
  primaryCurrency: string;
  port: number;
  host: string;
  timeZone: string;
  isProduction: boolean;
  transportSecurity: "trusted-private-http" | "https";
  secureCookies: boolean;
  updateCheckEnabled: boolean;
  updateChannel: "stable" | "prerelease";
  updateCheckIntervalHours: number;
};

function parsePort(value: string | undefined): number {
  const port = Number.parseInt(value ?? "3000", 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("APP_PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function parseTimeZone(value: string | undefined): string {
  const timeZone = value?.trim() || "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new Error("APP_TIME_ZONE must be a valid IANA time zone such as Europe/Rome or America/New_York.");
  }

  return timeZone;
}

function parseBoolean(value: string | undefined, name: string, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be either true or false.`);
}

function parseUpdateChannel(value: string | undefined): "stable" | "prerelease" {
  const channel = value?.trim() || "prerelease";

  if (channel !== "stable" && channel !== "prerelease") {
    throw new Error("UPDATE_CHANNEL must be either stable or prerelease.");
  }

  return channel;
}

function parseUpdateCheckInterval(value: string | undefined): number {
  const raw = value?.trim() || "24";
  const hours = Number(raw);

  if (!/^\d+$/.test(raw) || !Number.isInteger(hours) || hours < 1 || hours > 168) {
    throw new Error("UPDATE_CHECK_INTERVAL_HOURS must be an integer between 1 and 168.");
  }

  return hours;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === "production";
  const databaseUrl = env.DATABASE_URL;
  const sessionSecret = env.SESSION_SECRET ?? (isProduction ? undefined : developmentSessionSecret);
  const primaryCurrency = (env.PRIMARY_CURRENCY ?? "EUR").trim().toUpperCase();
  const transportSecurity = env.TRANSPORT_SECURITY?.trim() || (isProduction ? "" : "trusted-private-http");

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required.");
  }

  if (isProduction && sessionSecret === developmentSessionSecret) {
    throw new Error("SESSION_SECRET must be changed for production.");
  }

  if (isProduction && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }

  if (!/^[A-Z]{3}$/.test(primaryCurrency)) {
    throw new Error("PRIMARY_CURRENCY must be a 3-letter currency code such as EUR or USD.");
  }

  if (transportSecurity !== "trusted-private-http" && transportSecurity !== "https") {
    throw new Error("TRANSPORT_SECURITY must be explicitly set to trusted-private-http or https in production.");
  }

  return {
    sessionSecret,
    primaryCurrency,
    port: parsePort(env.APP_PORT),
    host: env.APP_HOST ?? "0.0.0.0",
    timeZone: parseTimeZone(env.APP_TIME_ZONE),
    isProduction,
    transportSecurity,
    secureCookies: transportSecurity === "https",
    updateCheckEnabled: parseBoolean(env.UPDATE_CHECK_ENABLED, "UPDATE_CHECK_ENABLED", false),
    updateChannel: parseUpdateChannel(env.UPDATE_CHANNEL),
    updateCheckIntervalHours: parseUpdateCheckInterval(env.UPDATE_CHECK_INTERVAL_HOURS)
  };
}
