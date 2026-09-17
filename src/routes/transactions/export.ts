import type { FastifyInstance } from "fastify";
import { spreadsheetSafeCsvText, toCsv } from "../../lib/csv.js";
import { listTransactions } from "../../services/transactions.js";
import { requireCurrentUser } from "../../services/users.js";
import { parseTransactionFilters } from "./shared.js";

export async function transactionExportRoutes(app: FastifyInstance) {
  app.get("/transactions/export.csv", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const filters = parseTransactionFilters(request.query);
    const transactions = await listTransactions(user.id, filters);
    const rows = [
      ["date", "type", "amount_minor", "account", "destination_account", "category", "tags", "description", "notes"],
      ...transactions.map((transaction) => [
        transaction.date.toISOString().slice(0, 10),
        transaction.type,
        transaction.amountMinor,
        spreadsheetSafeCsvText(transaction.sourceAccount?.name ?? ""),
        spreadsheetSafeCsvText(transaction.destinationAccount?.name ?? ""),
        spreadsheetSafeCsvText(transaction.category?.name ?? ""),
        spreadsheetSafeCsvText(transaction.tags.map((item) => item.tag.name).join("; ")),
        spreadsheetSafeCsvText(transaction.description ?? ""),
        spreadsheetSafeCsvText(transaction.notes ?? "")
      ])
    ];

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", "attachment; filename=\"pennyworth-transactions.csv\"")
      .send(toCsv(rows));
  });
}
