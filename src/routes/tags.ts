import type { FastifyInstance } from "fastify";
import { createTranslator } from "../lib/i18n.js";
import { normalizeUserPreferences } from "../lib/preferences.js";
import { createTag, deleteTag, getTagByNameForUser, getTagForUser, listTags, updateTag } from "../services/taxonomy.js";
import { requireCurrentUser } from "../services/users.js";
import { formBody } from "./form.js";
import { quickTaxonomyError, validateTagInput } from "./taxonomyInput.js";

export async function tagRoutes(app: FastifyInstance) {
  app.post("/tags/quick", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const t = createTranslator(normalizeUserPreferences(user).language);
    try {
      const input = validateTagInput(formBody(request.body));
      try {
        const tag = await createTag({ userId: user.id, ...input });
        return reply.code(201).send({ tag: { id: tag.id, name: tag.name } });
      } catch (error) {
        const failure = quickTaxonomyError(error, "tag");
        if (failure.statusCode !== 409) throw error;
        const existing = await getTagByNameForUser(user.id, input.name);
        return reply.code(409).send({ error: t(failure.message), existing });
      }
    } catch (error) {
      const failure = quickTaxonomyError(error, "tag");
      if (failure.statusCode === 500) request.log.error("Quick tag creation failed");
      return reply.code(failure.statusCode).send({ error: t(failure.message) });
    }
  });

  app.get("/tags", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const tags = await listTags(user.id);

    return reply.view("tags/index.ejs", {
      title: "Tags",
      tags,
      error: null
    });
  });

  app.post("/tags", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createTag({
        userId: user.id,
        ...validateTagInput(body)
      });

      return reply.redirect("/tags");
    } catch (error) {
      const tags = await listTags(user.id);

      return reply.code(400).view("tags/index.ejs", {
        title: "Tags",
        tags,
        error: error instanceof Error ? error.message : "Could not create tag."
      });
    }
  });

  app.get("/tags/:tagId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { tagId } = request.params as { tagId: string };
    const tag = await getTagForUser(user.id, tagId);

    if (!tag) {
      return reply.redirect("/tags");
    }

    return reply.view("tags/edit.ejs", {
      title: "Edit tag",
      tag,
      error: null
    });
  });

  app.post("/tags/:tagId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { tagId } = request.params as { tagId: string };
    const body = formBody(request.body);

    try {
      await updateTag({
        userId: user.id,
        tagId,
        ...validateTagInput(body)
      });

      return reply.redirect("/tags");
    } catch (error) {
      const tag = await getTagForUser(user.id, tagId);

      if (!tag) {
        return reply.redirect("/tags");
      }

      return reply.code(400).view("tags/edit.ejs", {
        title: "Edit tag",
        tag,
        error: error instanceof Error ? error.message : "Could not update tag."
      });
    }
  });

  app.post("/tags/:tagId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { tagId } = request.params as { tagId: string };

    await deleteTag(user.id, tagId);
    return reply.redirect("/tags");
  });
}
