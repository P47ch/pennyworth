import type { FastifyInstance } from "fastify";
import { parseMoneyToMinorUnits } from "../finance/money.js";
import { formatDateOnly, parseDateOnly } from "../lib/dates.js";
import {
  createAssetPrice,
  deleteAssetPrice,
  getAssetPriceForUser,
  listAssetPriceFormOptions,
  listAssetPrices,
  updateAssetPrice
} from "../services/assetPrices.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";

function validateAssetPriceInput(body: ReturnType<typeof formBody>) {
  const assetId = field(body, "assetId");
  const date = parseDateOnly(field(body, "date"), "Date must be valid.");
  const priceMinor = parseMoneyToMinorUnits(field(body, "price"));

  if (!assetId) {
    throw new Error("Choose an asset.");
  }

  if (priceMinor <= 0) {
    throw new Error("Price must be greater than zero.");
  }

  return {
    assetId,
    date,
    priceMinor
  };
}

export async function assetPriceRoutes(app: FastifyInstance) {
  app.get("/asset-prices", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const [assetPrices, assets] = await Promise.all([listAssetPrices(user.id), listAssetPriceFormOptions(user.id)]);

    return reply.view("asset-prices/index.ejs", {
      title: "Asset prices",
      assetPrices,
      assets,
      error: null,
      formatDateInput: formatDateOnly,
    });
  });

  app.post("/asset-prices", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createAssetPrice({
        userId: user.id,
        ...validateAssetPriceInput(body)
      });

      return reply.redirect("/asset-prices");
    } catch (error) {
      const [assetPrices, assets] = await Promise.all([listAssetPrices(user.id), listAssetPriceFormOptions(user.id)]);

      return reply.code(400).view("asset-prices/index.ejs", {
        title: "Asset prices",
        assetPrices,
        assets,
        error: error instanceof Error ? error.message : "Could not create asset price.",
        formatDateInput: formatDateOnly,
      });
    }
  });

  app.get("/asset-prices/:assetPriceId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { assetPriceId } = request.params as { assetPriceId: string };
    const [assetPrice, assets] = await Promise.all([getAssetPriceForUser(user.id, assetPriceId), listAssetPriceFormOptions(user.id)]);

    if (!assetPrice) {
      return reply.redirect("/asset-prices");
    }

    return reply.view("asset-prices/edit.ejs", {
      title: "Edit asset price",
      assetPrice,
      assets,
      error: null,
      formatDateInput: formatDateOnly
    });
  });

  app.post("/asset-prices/:assetPriceId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { assetPriceId } = request.params as { assetPriceId: string };
    const body = formBody(request.body);

    try {
      await updateAssetPrice({
        userId: user.id,
        assetPriceId,
        ...validateAssetPriceInput(body)
      });

      return reply.redirect("/asset-prices");
    } catch (error) {
      const [assetPrice, assets] = await Promise.all([getAssetPriceForUser(user.id, assetPriceId), listAssetPriceFormOptions(user.id)]);

      if (!assetPrice) {
        return reply.redirect("/asset-prices");
      }

      return reply.code(400).view("asset-prices/edit.ejs", {
        title: "Edit asset price",
        assetPrice,
        assets,
        error: error instanceof Error ? error.message : "Could not update asset price.",
        formatDateInput: formatDateOnly
      });
    }
  });

  app.post("/asset-prices/:assetPriceId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { assetPriceId } = request.params as { assetPriceId: string };

    await deleteAssetPrice(user.id, assetPriceId);
    return reply.redirect("/asset-prices");
  });
}
