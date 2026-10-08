import type { FastifyInstance } from "fastify";
import { categoryIconOptions, isCategoryIcon } from "../lib/icons.js";
import { createTranslator } from "../lib/i18n.js";
import { normalizeUserPreferences } from "../lib/preferences.js";
import {
  categoryTypes,
  createCategory,
  deleteCategoryIfUnused,
  getCategoryByNameForUser,
  getCategoryForUser,
  listCategories,
  updateCategory
} from "../services/taxonomy.js";
import { requireCurrentUser } from "../services/users.js";
import { isDeleteConfirmed, showDeleteConfirmation } from "./deleteConfirmation.js";
import { formBody } from "./form.js";
import { quickTaxonomyError, validateCategoryInput } from "./taxonomyInput.js";

export async function categoryRoutes(app: FastifyInstance) {
  app.post("/categories/quick", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const t = createTranslator(normalizeUserPreferences(user).language);
    try {
      const input = validateCategoryInput(formBody(request.body));
      try {
        const category = await createCategory({ userId: user.id, ...input });
        return reply.code(201).send({ category: { id: category.id, name: category.name, type: category.type } });
      } catch (error) {
        const failure = quickTaxonomyError(error, "category");
        if (failure.statusCode !== 409) throw error;
        const existing = await getCategoryByNameForUser(user.id, input.name);
        return reply.code(409).send({ error: t(failure.message), existing });
      }
    } catch (error) {
      const failure = quickTaxonomyError(error, "category");
      if (failure.statusCode === 500) request.log.error("Quick category creation failed");
      return reply.code(failure.statusCode).send({ error: t(failure.message) });
    }
  });

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
    const category = await getCategoryForUser(user.id, categoryId);

    if (!category) return reply.redirect("/categories");
    if (!isDeleteConfirmed(request.body)) {
      return showDeleteConfirmation(reply, {
        title: "Delete category", recordName: category.name,
        deleteAction: `/categories/${category.id}/delete`, cancelHref: "/categories",
        warnings: ["Categories in use or with child categories cannot be deleted."]
      });
    }

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
