import { describe, expect, it } from "vitest";
import { addOneMonth } from "../src/services/recurring.js";

describe("recurring date scheduling", () => {
  it("clamps monthly recurrence to February instead of overflowing into March", () => {
    expect(addOneMonth(new Date("2026-01-31T00:00:00.000Z")).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("handles leap-year February", () => {
    expect(addOneMonth(new Date("2028-01-31T00:00:00.000Z")).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
});
