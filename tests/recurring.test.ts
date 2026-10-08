import { describe, expect, it } from "vitest";
import { addOneMonth } from "../src/services/recurring.js";
import { parseRecurringConfirmationDate } from "../src/routes/recurringInput.js";

describe("recurring date scheduling", () => {
  it("clamps monthly recurrence to February instead of overflowing into March", () => {
    expect(addOneMonth(new Date("2026-01-31T00:00:00.000Z")).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("handles leap-year February", () => {
    expect(addOneMonth(new Date("2028-01-31T00:00:00.000Z")).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
});

describe("recurring confirmation dates", () => {
  it("preserves the complete occurrence time and milliseconds", () => {
    expect(parseRecurringConfirmationDate("2026-10-05T12:34:56.789Z").toISOString()).toBe("2026-10-05T12:34:56.789Z");
  });
  it("accepts old midnight confirmation forms", () => {
    expect(parseRecurringConfirmationDate("2026-10-05").toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it.each(["", "2026-02-30", "2026-02-30T12:00:00.000Z", "2026-10-05T25:00:00.000Z", "2026-10-05T12:00:00", "garbage"])(
    "rejects invalid or ambiguous occurrence input %s", value => {
      expect(() => parseRecurringConfirmationDate(value)).toThrow("Choose a valid next date.");
    }
  );
});
