import { assertForm, FormValidationError } from "../lib/formValidation.js";
import { Prisma, type CategoryType } from "@prisma/client";
import { parseCategoryIcon } from "../lib/icons.js";
import { categoryTypes, TaxonomyValidationError } from "../services/taxonomy.js";
import { parseHexColor } from "./colors.js";
import { field, type FormData } from "./form.js";

function assertTaxonomyForm(kind: "category" | "tag", body: FormData) {
  try { assertForm(kind, body); }
  catch (error) {
    if (error instanceof FormValidationError) throw new TaxonomyValidationError(error.message);
    throw error;
  }
}

function textField(body: FormData, name: string): string {
  const value = field(body, name);
  if (typeof value !== "string") {
    throw new TaxonomyValidationError("Check the submitted fields.");
  }
  return value;
}

export function validateCategoryInput(body: FormData) {
  assertTaxonomyForm("category", body);
  const name = textField(body, "name").trim();
  const type = textField(body, "type") as CategoryType;
  if (!name) throw new TaxonomyValidationError("Category name is required.");
  if (!categoryTypes.includes(type)) throw new TaxonomyValidationError("Choose a valid category type.");

  const parentId = textField(body, "parentId");
  const color = textField(body, "color");
  const icon = textField(body, "icon");
  try {
    return { name, type, parentId, color: parseHexColor(color), icon: parseCategoryIcon(icon) };
  } catch (error) {
    throw new TaxonomyValidationError(error instanceof Error ? error.message : "Check the submitted fields.");
  }
}

export function validateTagInput(body: FormData) {
  assertTaxonomyForm("tag", body);
  const name = textField(body, "name").trim();
  if (!name) throw new TaxonomyValidationError("Tag name is required.");
  const color = textField(body, "color");
  try {
    return { name, color: parseHexColor(color) };
  } catch (error) {
    throw new TaxonomyValidationError(error instanceof Error ? error.message : "Check the submitted fields.");
  }
}

export function quickTaxonomyError(error: unknown, kind: "category" | "tag") {
  if (error instanceof TaxonomyValidationError || error instanceof FormValidationError) {
    return { statusCode: 400, message: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      statusCode: 409,
      message: kind === "category" ? "A category with that name already exists." : "A tag with that name already exists."
    };
  }
  return {
    statusCode: 500,
    message: kind === "category" ? "Could not create category. Try again in a moment." : "Could not create tag. Try again in a moment."
  };
}
