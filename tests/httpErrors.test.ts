import { describe, expect, it } from "vitest";
import { errorPageModel } from "../src/lib/httpErrors.js";

describe("HTTP error presentation", () => {
  it("does not expose database error details in a server-error model", () => {
    const model = errorPageModel(
      {
        code: "P2037",
        message: "Too many database connections opened: FATAL: too many connections for role pennyworth"
      },
      "req-123"
    );
    const renderedData = JSON.stringify(model);

    expect(model).toEqual({
      statusCode: 500,
      title: "Application error",
      heading: "Something went wrong",
      message: "Pennyworth could not complete the request. Try again in a moment.",
      requestId: "req-123"
    });
    expect(renderedData).not.toContain("P2037");
    expect(renderedData).not.toContain("database connections");
    expect(renderedData).not.toContain("pennyworth");
  });

  it("preserves safe client status codes without exposing their original message", () => {
    const model = errorPageModel({ statusCode: 429, message: "internal limiter details" }, "req-429");

    expect(model.statusCode).toBe(429);
    expect(model.message).toContain("Wait a moment");
    expect(JSON.stringify(model)).not.toContain("internal limiter details");
  });
});
