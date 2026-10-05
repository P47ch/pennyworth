import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { quickTaxonomyError, validateCategoryInput, validateTagInput } from "../src/routes/taxonomyInput.js";
import { formBody } from "../src/routes/form.js";
import { TaxonomyValidationError } from "../src/services/taxonomy.js";

describe("shared taxonomy validation", () => {
  it("trims names, preserves literal text, and keeps existing color/icon defaults", () => {
    expect(validateCategoryInput({ name: "  <Food> $&  ", type: "expense" })).toEqual({
      name: "<Food> $&", type: "expense", parentId: "", color: "#2563eb", icon: ""
    });
    expect(validateTagInput({ name: "  travel  ", color: "#AABBCC" })).toEqual({ name: "travel", color: "#aabbcc" });
  });

  it.each([
    [{ name: " ", type: "expense" }, "Category name is required."],
    [{ name: "Food", type: "transfer" }, "Choose a valid category type."],
    [{ name: "Food", type: "expense", color: "red" }, "Choose a valid color."],
    [{ name: "Food", type: "expense", icon: "<svg>" }, "Choose a valid icon."]
  ])("rejects invalid category fields", (body, message) => {
    expect(() => validateCategoryInput(body)).toThrow(message);
  });

  it("rejects empty tag names and non-string JSON values without an internal exception", () => {
    expect(() => validateTagInput({ name: " " })).toThrow("Tag name is required.");
    expect(() => validateTagInput(formBody({ name: 42 }))).toThrow(TaxonomyValidationError);
    expect(() => validateCategoryInput(formBody({ name: "Food", type: {}, color: "#2563eb" }))).toThrow(TaxonomyValidationError);
  });
});

describe("quick taxonomy error responses", () => {
  it("distinguishes safe validation, duplicate names, and unexpected errors", () => {
    expect(quickTaxonomyError(new TaxonomyValidationError("Choose a valid parent category."), "category"))
      .toEqual({ statusCode: 400, message: "Choose a valid parent category." });
    const duplicate = new Prisma.PrismaClientKnownRequestError("private database details", { code: "P2002", clientVersion: "test" });
    expect(quickTaxonomyError(duplicate, "tag"))
      .toEqual({ statusCode: 409, message: "A tag with that name already exists." });
    expect(quickTaxonomyError(duplicate, "category"))
      .toEqual({ statusCode: 409, message: "A category with that name already exists." });
    expect(quickTaxonomyError(new Error("secret database details"), "category"))
      .toEqual({ statusCode: 500, message: "Could not create category. Try again in a moment." });
  });
});
