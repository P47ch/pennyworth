import type { FastifyInstance } from "fastify";
import { monthInputValue, parseBudgetMonth } from "../finance/budgets.js";
import { parseMoneyToMinorUnits } from "../finance/money.js";
import { loadConfig } from "../lib/config.js";
import { currentDateOnly } from "../lib/dates.js";
import { createBudget, deleteBudget, getBudgetForUser, getBudgetPageData, updateBudget } from "../services/budgets.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";

const timeZone = loadConfig().timeZone;

function selectedMonthFromQuery(query: unknown) {
  const params = query && typeof query === "object" ? (query as Record<string, string | undefined>) : {};
  return params.month ? parseBudgetMonth(params.month) : currentDateOnly(timeZone);
}

function selectedMonthFromForm(body: ReturnType<typeof formBody>) {
  const value = field(body, "month");

  if (!value) {
    return currentDateOnly(timeZone);
  }

  try {
    return parseBudgetMonth(value);
  } catch {
    return currentDateOnly(timeZone);
  }
}

function validateBudgetInput(body: ReturnType<typeof formBody>) {
  const categoryId = field(body, "categoryId");
  const amountMinor = parseMoneyToMinorUnits(field(body, "amount"));

  if (!categoryId) {
    throw new Error("Choose a category.");
  }

  if (amountMinor <= 0) {
    throw new Error("Budget amount must be greater than zero.");
  }

  return {
    categoryId,
    month: parseBudgetMonth(field(body, "month")),
    amountMinor
  };
}

export async function budgetRoutes(app: FastifyInstance) {
  app.get("/budgets", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const selectedMonth = selectedMonthFromQuery(request.query);
    const data = await getBudgetPageData(user.id, selectedMonth);

    return reply.view("budgets/index.ejs", {
      title: "Budgets",
      ...data,
      selectedMonth,
      selectedMonthValue: monthInputValue(selectedMonth),
      error: null,
    });
  });

  app.post("/budgets", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      const input = validateBudgetInput(body);
      await createBudget({ userId: user.id, ...input });
      return reply.redirect(`/budgets?month=${monthInputValue(input.month)}`);
    } catch (error) {
      const selectedMonth = selectedMonthFromForm(body);
      const data = await getBudgetPageData(user.id, selectedMonth);

      return reply.code(400).view("budgets/index.ejs", {
        title: "Budgets",
        ...data,
        selectedMonth,
        selectedMonthValue: monthInputValue(selectedMonth),
        error: error instanceof Error ? error.message : "Could not create budget.",
      });
    }
  });

  app.get("/budgets/:budgetId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { budgetId } = request.params as { budgetId: string };
    const budget = await getBudgetForUser(user.id, budgetId);
    const { categories } = await getBudgetPageData(user.id, budget?.month ?? currentDateOnly(timeZone));

    if (!budget) {
      return reply.redirect("/budgets");
    }

    return reply.view("budgets/edit.ejs", {
      title: "Edit budget",
      budget,
      categories,
      error: null
    });
  });

  app.post("/budgets/:budgetId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { budgetId } = request.params as { budgetId: string };
    const body = formBody(request.body);

    try {
      const input = validateBudgetInput(body);
      await updateBudget({ userId: user.id, budgetId, ...input });
      return reply.redirect(`/budgets?month=${monthInputValue(input.month)}`);
    } catch (error) {
      const budget = await getBudgetForUser(user.id, budgetId);

      if (!budget) {
        return reply.redirect("/budgets");
      }

      const { categories } = await getBudgetPageData(user.id, budget.month);
      return reply.code(400).view("budgets/edit.ejs", {
        title: "Edit budget",
        budget,
        categories,
        error: error instanceof Error ? error.message : "Could not update budget."
      });
    }
  });

  app.post("/budgets/:budgetId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { budgetId } = request.params as { budgetId: string };
    const budget = await getBudgetForUser(user.id, budgetId);

    await deleteBudget(user.id, budgetId);
    return reply.redirect(`/budgets${budget ? `?month=${monthInputValue(budget.month)}` : ""}`);
  });
}
