import type { CategoryType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { categoryIconOptions, isCategoryIcon, parseCategoryIcon } from "../lib/icons.js";
import {
  categoryTypes,
  createCategory,
  deleteCategoryIfUnused,
  getCategoryForUser,
  listCategories,
  updateCategory
} from "../services/taxonomy.js";
import { requireCurrentUser } from "../services/users.js";
import { parseHexColor } from "./colors.js";
import { field, formBody } from "./form.js";

function validateCategoryInput(body: ReturnType<typeof formBody>) {
  const name = field(body, "name").trim();
  const type = field(body, "type") as CategoryType;

  if (!name) {
    throw new Error("Category name is required.");
  }

  if (!categoryTypes.includes(type)) {
    throw new Error("Choose a valid category type.");
  }

  return {
    name,
    type,
    parentId: field(body, "parentId"),
    color: parseHexColor(field(body, "color"), "#2563eb"),
    icon: parseCategoryIcon(field(body, "icon"))
  };
}

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/categories", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const categories = await listCategories(user.id);

    return reply.view("categories/index.ejs", {
      title: "Categories",
      categories,
      categoryTypes,
      categoryIconOptions,
      error: null
    });
  });

  app.post("/categories", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createCategory({
        userId: user.id,
        ...validateCategoryInput(body)
      });

      return reply.redirect("/categories");
    } catch (error) {
      const categories = await listCategories(user.id);

      return reply.code(400).view("categories/index.ejs", {
        title: "Categories",
        categories,
        categoryTypes,
        categoryIconOptions,
        error: error instanceof Error ? error.message : "Could not create category."
      });
    }
  });

  app.get("/categories/:categoryId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { categoryId } = request.params as { categoryId: string };
    const [category, categories] = await Promise.all([getCategoryForUser(user.id, categoryId), listCategories(user.id)]);

    if (!category) {
      return reply.redirect("/categories");
    }

    return reply.view("categories/edit.ejs", {
      title: "Edit category",
      category,
      categories: categories.filter((item) => item.id !== categoryId),
      categoryTypes,
      categoryIconOptions,
      selectedIcon: isCategoryIcon(category.icon) ? category.icon : "",
      error: null
    });
  });

  app.post("/categories/:categoryId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { categoryId } = request.params as { categoryId: string };
    const body = formBody(request.body);

    try {
      await updateCategory({
        userId: user.id,
        categoryId,
        ...validateCategoryInput(body)
      });

      return reply.redirect("/categories");
    } catch (error) {
      const [category, categories] = await Promise.all([getCategoryForUser(user.id, categoryId), listCategories(user.id)]);

      if (!category) {
        return reply.redirect("/categories");
      }

      return reply.code(400).view("categories/edit.ejs", {
        title: "Edit category",
        category,
        categories: categories.filter((item) => item.id !== categoryId),
        categoryTypes,
        categoryIconOptions,
        selectedIcon: isCategoryIcon(category.icon) ? category.icon : "",
        error: error instanceof Error ? error.message : "Could not update category."
      });
    }
  });

  app.post("/categories/:categoryId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { categoryId } = request.params as { categoryId: string };

    try {
      await deleteCategoryIfUnused(user.id, categoryId);
      return reply.redirect("/categories");
    } catch (error) {
      const categories = await listCategories(user.id);

      return reply.code(400).view("categories/index.ejs", {
        title: "Categories",
        categories,
        categoryTypes,
        categoryIconOptions,
        error: error instanceof Error ? error.message : "Could not delete category."
      });
    }
  });
}
