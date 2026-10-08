import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/lib/config.js";

describe("config validation", () => {
  it("loads development config with a default local port", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/pennyworth"
    });

    expect(config.port).toBe(3000);
    expect(config.timeZone).toBe("UTC");
    expect(config.isProduction).toBe(false);
    expect(config.transportSecurity).toBe("trusted-private-http");
    expect(config.secureCookies).toBe(false);
    expect(config.updateCheckEnabled).toBe(false);
    expect(config.updateChannel).toBe("prerelease");
    expect(config.updateCheckIntervalHours).toBe(24);
  });

  it("requires a database URL", () => {
    expect(() => loadConfig({})).toThrow("DATABASE_URL is required.");
  });

  it("rejects the development session secret in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/pennyworth",
        SESSION_SECRET: "development-only-secret-change-me"
      })
    ).toThrow("SESSION_SECRET must be changed for production.");
  });

  it("requires a strong production session secret", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/pennyworth",
        SESSION_SECRET: "too-short"
      })
    ).toThrow("SESSION_SECRET must be at least 32 characters in production.");
  });

  it("rejects invalid ports", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/pennyworth",
        APP_PORT: "99999"
      })
    ).toThrow("APP_PORT must be an integer between 1 and 65535.");
  });

  it("accepts valid IANA time zones and rejects invalid values", () => {
    expect(
      loadConfig({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/pennyworth",
        APP_TIME_ZONE: "Europe/Rome"
      }).timeZone
    ).toBe("Europe/Rome");

    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/pennyworth",
        APP_TIME_ZONE: "Not/A_Time_Zone"
      })
    ).toThrow("APP_TIME_ZONE must be a valid IANA time zone");
  });

  it("requires an explicit production transport decision and enables secure cookies for HTTPS", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/pennyworth",
      SESSION_SECRET: "a-production-session-secret-that-is-long-enough"
    };

    expect(() => loadConfig(base)).toThrow("TRANSPORT_SECURITY");
    expect(loadConfig({ ...base, TRANSPORT_SECURITY: "https" }).secureCookies).toBe(true);
  });

  it("validates optional update-check configuration", () => {
    const base = { DATABASE_URL: "postgresql://user:pass@localhost:5432/pennyworth" };

    expect(loadConfig({ ...base, UPDATE_CHECK_ENABLED: "true", UPDATE_CHANNEL: "stable", UPDATE_CHECK_INTERVAL_HOURS: "168" }))
      .toMatchObject({ updateCheckEnabled: true, updateChannel: "stable", updateCheckIntervalHours: 168 });
    expect(() => loadConfig({ ...base, UPDATE_CHECK_ENABLED: "yes" })).toThrow("UPDATE_CHECK_ENABLED");
    expect(() => loadConfig({ ...base, UPDATE_CHANNEL: "nightly" })).toThrow("UPDATE_CHANNEL");
    expect(() => loadConfig({ ...base, UPDATE_CHECK_INTERVAL_HOURS: "0" })).toThrow("UPDATE_CHECK_INTERVAL_HOURS");
    expect(() => loadConfig({ ...base, UPDATE_CHECK_INTERVAL_HOURS: "1.5" })).toThrow("UPDATE_CHECK_INTERVAL_HOURS");
  });
});
