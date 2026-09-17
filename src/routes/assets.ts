import type { AssetType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { assetTypes, createAsset, deleteAsset, getAssetForUser, listAssets, updateAsset } from "../services/assets.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";

function validateAssetInput(body: ReturnType<typeof formBody>) {
  const symbol = field(body, "symbol").trim().toUpperCase();
  const name = field(body, "name").trim();
  const type = field(body, "type") as AssetType;
  const currency = field(body, "currency").trim().toUpperCase();
  const isActive = field(body, "isActive") === "on";

  if (!symbol) {
    throw new Error("Symbol is required.");
  }

  if (!name) {
    throw new Error("Name is required.");
  }

  if (!assetTypes.includes(type)) {
    throw new Error("Choose a valid asset type.");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a 3-letter code.");
  }

  return {
    symbol,
    name,
    type,
    currency,
    isActive
  };
}

export async function assetRoutes(app: FastifyInstance) {
  app.get("/assets", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const assets = await listAssets(user.id);

    return reply.view("assets/index.ejs", {
      title: "Assets",
      assets,
      assetTypes,
      error: null
    });
  });

  app.post("/assets", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createAsset({
        userId: user.id,
        ...validateAssetInput(body)
      });

      return reply.redirect("/assets");
    } catch (error) {
      const assets = await listAssets(user.id);

      return reply.code(400).view("assets/index.ejs", {
        title: "Assets",
        assets,
        assetTypes,
        error: error instanceof Error ? error.message : "Could not create asset."
      });
    }
  });

  app.get("/assets/:assetId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { assetId } = request.params as { assetId: string };
    const asset = await getAssetForUser(user.id, assetId);

    if (!asset) {
      return reply.redirect("/assets");
    }

    return reply.view("assets/edit.ejs", {
      title: "Edit asset",
      asset,
      assetTypes,
      error: null
    });
  });

  app.post("/assets/:assetId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { assetId } = request.params as { assetId: string };
    const body = formBody(request.body);

    try {
      await updateAsset({
        userId: user.id,
        assetId,
        ...validateAssetInput(body)
      });

      return reply.redirect("/assets");
    } catch (error) {
      const asset = await getAssetForUser(user.id, assetId);

      if (!asset) {
        return reply.redirect("/assets");
      }

      return reply.code(400).view("assets/edit.ejs", {
        title: "Edit asset",
        asset,
        assetTypes,
        error: error instanceof Error ? error.message : "Could not update asset."
      });
    }
  });

  app.post("/assets/:assetId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { assetId } = request.params as { assetId: string };

    await deleteAsset(user.id, assetId);
    return reply.redirect("/assets");
  });
}
