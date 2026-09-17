import { describe, expect, it } from "vitest";
import { parseHexColor } from "../src/routes/colors.js";

describe("color parsing", () => {
  it("normalizes valid hex colors", () => {
    expect(parseHexColor("#ABC123")).toBe("#abc123");
  });

  it("uses a fallback for empty values", () => {
    expect(parseHexColor("", "#ff00aa")).toBe("#ff00aa");
  });

  it("rejects invalid colors", () => {
    expect(() => parseHexColor("red")).toThrow("Choose a valid color.");
    expect(() => parseHexColor("#123")).toThrow("Choose a valid color.");
  });
});
