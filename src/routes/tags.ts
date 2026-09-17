import type { FastifyInstance } from "fastify";
import { createTag, deleteTag, getTagForUser, listTags, updateTag } from "../services/taxonomy.js";
import { requireCurrentUser } from "../services/users.js";
import { parseHexColor } from "./colors.js";
import { field, formBody } from "./form.js";

function validateTagInput(body: ReturnType<typeof formBody>) {
  const name = field(body, "name").trim();

  if (!name) {
    throw new Error("Tag name is required.");
  }

  return {
    name,
    color: parseHexColor(field(body, "color"), "#2563eb")
  };
}

export async function tagRoutes(app: FastifyInstance) {
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
