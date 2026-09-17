import { describe, expect, it } from "vitest";
import { calendarMonthRange, formatDateOnly, parseDateOnly, todayDateInput } from "../src/lib/dates.js";

describe("accounting calendar dates", () => {
  it("parses and formats date-only values at UTC midnight", () => {
    expect(parseDateOnly("2026-07-18").toISOString()).toBe("2026-07-18T00:00:00.000Z");
    expect(formatDateOnly(parseDateOnly("2026-07-18"))).toBe("2026-07-18");
    expect(() => parseDateOnly("2026-02-30")).toThrow("Choose a valid date.");
  });

  it("uses the configured time zone to choose today without changing stored date semantics", () => {
    const instant = new Date("2026-07-01T00:30:00.000Z");

    expect(todayDateInput("Europe/Rome", instant)).toBe("2026-07-01");
    expect(todayDateInput("America/New_York", instant)).toBe("2026-06-30");
  });

  it("builds UTC month boundaries from the configured calendar month", () => {
    const instant = new Date("2026-07-01T00:30:00.000Z");
    const utc = calendarMonthRange("UTC", instant);
    const newYork = calendarMonthRange("America/New_York", instant);

    expect(utc.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(utc.end.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(newYork.start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(newYork.end.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});
