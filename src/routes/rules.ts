import type { FastifyInstance } from "fastify";
import {
  applyRuleApplications,
  createRule,
  deleteRule,
  getRuleForUser,
  listRules,
  moveRule,
  previewRuleApplications,
  updateRule
} from "../services/rules.js";
import { listCategories, listTags } from "../services/taxonomy.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";

function validateRuleInput(body: ReturnType<typeof formBody>) {
  const name = field(body, "name").trim();
  const matchText = field(body, "matchText").trim();
  const categoryId = field(body, "categoryId");
  const tagIds = Array.isArray(body.tagIds) ? body.tagIds.filter(Boolean) : body.tagIds ? [body.tagIds].filter(Boolean) : [];
  const isActive = field(body, "isActive") === "on";

  if (!name) {
    throw new Error("Rule name is required.");
  }

  if (!matchText) {
    throw new Error("Match text is required.");
  }

  if (!categoryId) {
    throw new Error("Choose a category.");
  }

  return {
    name,
    matchText,
    categoryId,
    tagIds,
    isActive
  };
}

export async function ruleRoutes(app: FastifyInstance) {
  app.get("/rules", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const [rules, categories, tags] = await Promise.all([listRules(user.id), listCategories(user.id), listTags(user.id)]);

    return reply.view("rules/index.ejs", {
      title: "Rules",
      rules,
      categories: categories.filter((category) => category.type === "expense" || category.type === "both"),
      tags,
      error: null
    });
  });

  app.post("/rules", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createRule({
        userId: user.id,
        ...validateRuleInput(body)
      });

      return reply.redirect("/rules");
    } catch (error) {
      const [rules, categories, tags] = await Promise.all([listRules(user.id), listCategories(user.id), listTags(user.id)]);

      return reply.code(400).view("rules/index.ejs", {
        title: "Rules",
        rules,
        categories: categories.filter((category) => category.type === "expense" || category.type === "both"),
        tags,
        error: error instanceof Error ? error.message : "Could not create rule."
      });
    }
  });

  app.get("/rules/:ruleId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { ruleId } = request.params as { ruleId: string };
    const [rule, categories, tags] = await Promise.all([getRuleForUser(user.id, ruleId), listCategories(user.id), listTags(user.id)]);

    if (!rule) {
      return reply.redirect("/rules");
    }

    return reply.view("rules/edit.ejs", {
      title: "Edit rule",
      rule,
      categories: categories.filter((category) => category.type === "expense" || category.type === "both"),
      tags,
      error: null
    });
  });

  app.post("/rules/:ruleId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { ruleId } = request.params as { ruleId: string };
    const body = formBody(request.body);

    try {
      await updateRule({
        userId: user.id,
        ruleId,
        ...validateRuleInput(body)
      });

      return reply.redirect("/rules");
    } catch (error) {
      const [rule, categories, tags] = await Promise.all([getRuleForUser(user.id, ruleId), listCategories(user.id), listTags(user.id)]);

      if (!rule) {
        return reply.redirect("/rules");
      }

      return reply.code(400).view("rules/edit.ejs", {
        title: "Edit rule",
        rule,
        categories: categories.filter((category) => category.type === "expense" || category.type === "both"),
        tags,
        error: error instanceof Error ? error.message : "Could not update rule."
      });
    }
  });

  app.post("/rules/:ruleId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { ruleId } = request.params as { ruleId: string };

    await deleteRule(user.id, ruleId);
    return reply.redirect("/rules");
  });

  app.post("/rules/:ruleId/move", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { ruleId } = request.params as { ruleId: string };
    const body = formBody(request.body);
    const direction = field(body, "direction") === "up" ? "up" : "down";

    await moveRule(user.id, ruleId, direction);
    return reply.redirect("/rules");
  });

  app.get("/rules/apply", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const applications = await previewRuleApplications(user.id);

    return reply.view("rules/apply.ejs", {
      title: "Apply rules",
      applications,
      error: null
    });
  });

  app.post("/rules/apply", async (request, reply) => {
    const user = await requireCurrentUser(request);

    await applyRuleApplications(user.id);
    return reply.redirect("/transactions");
  });
}
