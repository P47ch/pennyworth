import type { FastifyInstance } from "fastify";
import type { AccountType } from "@prisma/client";
import { parseMoneyToMinorUnits } from "../finance/money.js";
import {
  accountTypes,
  createAccount,
  deleteAccountIfUnused,
  getAccountForUser,
  listAccountsWithBalances,
  setAccountActiveState,
  updateAccount
} from "../services/accounts.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";
import { loadConfig } from "../lib/config.js";

const primaryCurrency = loadConfig().primaryCurrency;

function validateAccountInput(body: ReturnType<typeof formBody>) {
  const name = field(body, "name").trim();
  const type = field(body, "type") as AccountType;
  const currency = field(body, "currency").trim().toUpperCase() || primaryCurrency;
  const institution = field(body, "institution").trim();

  if (!name) {
    throw new Error("Account name is required.");
  }

  if (!accountTypes.includes(type)) {
    throw new Error("Choose a valid account type.");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a 3-letter code such as EUR or USD.");
  }

  return {
    name,
    type,
    currency,
    institution,
    openingBalanceMinor: parseMoneyToMinorUnits(field(body, "openingBalance"))
  };
}

export async function accountRoutes(app: FastifyInstance) {
  app.get("/accounts", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const accounts = await listAccountsWithBalances(user.id);

    return reply.view("accounts/index.ejs", {
      title: "Accounts",
      accounts,
      accountTypes,
      error: null,
    });
  });

  app.post("/accounts", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createAccount({
        userId: user.id,
        ...validateAccountInput(body)
      });

      return reply.redirect("/accounts");
    } catch (error) {
      const accounts = await listAccountsWithBalances(user.id);

      return reply.code(400).view("accounts/index.ejs", {
        title: "Accounts",
        accounts,
        accountTypes,
        error: error instanceof Error ? error.message : "Could not create account.",
      });
    }
  });

  app.get("/accounts/:accountId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { accountId } = request.params as { accountId: string };
    const account = await getAccountForUser(user.id, accountId);

    if (!account) {
      return reply.redirect("/accounts");
    }

    return reply.view("accounts/edit.ejs", {
      title: "Edit account",
      account,
      accountTypes,
      error: null
    });
  });

  app.post("/accounts/:accountId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { accountId } = request.params as { accountId: string };
    const body = formBody(request.body);

    try {
      await updateAccount({
        userId: user.id,
        accountId,
        ...validateAccountInput(body)
      });

      return reply.redirect("/accounts");
    } catch (error) {
      const account = await getAccountForUser(user.id, accountId);

      if (!account) {
        return reply.redirect("/accounts");
      }

      return reply.code(400).view("accounts/edit.ejs", {
        title: "Edit account",
        account,
        accountTypes,
        error: error instanceof Error ? error.message : "Could not update account."
      });
    }
  });

  app.post("/accounts/:accountId/toggle-active", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { accountId } = request.params as { accountId: string };
    const account = await getAccountForUser(user.id, accountId);

    if (account) {
      await setAccountActiveState(user.id, accountId, !account.isActive);
    }

    return reply.redirect("/accounts");
  });

  app.post("/accounts/:accountId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { accountId } = request.params as { accountId: string };

    await deleteAccountIfUnused(user.id, accountId);
    return reply.redirect("/accounts");
  });
}
