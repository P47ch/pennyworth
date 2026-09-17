import type { FastifyInstance } from "fastify";
import { parseMoneyToMinorUnits } from "../finance/money.js";
import {
  createHolding,
  deleteHolding,
  getHoldingForUser,
  listHoldingFormOptions,
  listHoldings,
  updateHolding
} from "../services/holdings.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";

function parseQuantity(input: string): string {
  const normalized = input.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
    throw new Error("Quantity must be a positive number with up to 8 decimal places.");
  }

  if (Number(normalized) <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  return normalized;
}

function formatQuantity(value: { toString(): string }) {
  return value.toString().replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function validateHoldingInput(body: ReturnType<typeof formBody>) {
  const accountId = field(body, "accountId");
  const assetId = field(body, "assetId");
  const quantity = parseQuantity(field(body, "quantity"));
  const averageCostMinor = parseMoneyToMinorUnits(field(body, "averageCost"));
  const notes = field(body, "notes").trim();

  if (!accountId) {
    throw new Error("Choose an account.");
  }

  if (!assetId) {
    throw new Error("Choose an asset.");
  }

  if (averageCostMinor < 0) {
    throw new Error("Average cost cannot be negative.");
  }

  return {
    accountId,
    assetId,
    quantity,
    averageCostMinor,
    notes
  };
}

export async function holdingRoutes(app: FastifyInstance) {
  app.get("/holdings", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const [holdings, options] = await Promise.all([listHoldings(user.id), listHoldingFormOptions(user.id)]);

    return reply.view("holdings/index.ejs", {
      title: "Holdings",
      holdings,
      accounts: options.accounts,
      assets: options.assets,
      error: null,
      formatQuantity
    });
  });

  app.post("/holdings", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createHolding({
        userId: user.id,
        ...validateHoldingInput(body)
      });

      return reply.redirect("/holdings");
    } catch (error) {
      const [holdings, options] = await Promise.all([listHoldings(user.id), listHoldingFormOptions(user.id)]);

      return reply.code(400).view("holdings/index.ejs", {
        title: "Holdings",
        holdings,
        accounts: options.accounts,
        assets: options.assets,
        error: error instanceof Error ? error.message : "Could not create holding.",
        formatQuantity
      });
    }
  });

  app.get("/holdings/:holdingId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { holdingId } = request.params as { holdingId: string };
    const [holding, options] = await Promise.all([getHoldingForUser(user.id, holdingId), listHoldingFormOptions(user.id)]);

    if (!holding) {
      return reply.redirect("/holdings");
    }

    return reply.view("holdings/edit.ejs", {
      title: "Edit holding",
      holding,
      accounts: options.accounts,
      assets: options.assets,
      error: null,
      formatQuantity
    });
  });

  app.post("/holdings/:holdingId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { holdingId } = request.params as { holdingId: string };
    const body = formBody(request.body);

    try {
      await updateHolding({
        userId: user.id,
        holdingId,
        ...validateHoldingInput(body)
      });

      return reply.redirect("/holdings");
    } catch (error) {
      const [holding, options] = await Promise.all([getHoldingForUser(user.id, holdingId), listHoldingFormOptions(user.id)]);

      if (!holding) {
        return reply.redirect("/holdings");
      }

      return reply.code(400).view("holdings/edit.ejs", {
        title: "Edit holding",
        holding,
        accounts: options.accounts,
        assets: options.assets,
        error: error instanceof Error ? error.message : "Could not update holding.",
        formatQuantity
      });
    }
  });

  app.post("/holdings/:holdingId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { holdingId } = request.params as { holdingId: string };

    await deleteHolding(user.id, holdingId);
    return reply.redirect("/holdings");
  });
}
