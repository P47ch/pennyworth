import type { FastifyInstance } from "fastify";
import { listAccountsWithBalances } from "../../services/accounts.js";
import { listActiveRules } from "../../services/rules.js";
import { listCategories, listTags } from "../../services/taxonomy.js";
import {
  applyTransactionImportMapping,
  buildTransactionImportMappingOptions,
  createTransactionImportBatch,
  detectTransactionImportHeaders,
  persistTransactionImport,
  previewTransactionImportCsv,
  type TransactionImportMapping,
  type TransactionImportPreview
} from "../../services/transactionImport.js";
import { listTransactionDuplicateCandidates, transactionTypes } from "../../services/transactions.js";
import { requireCurrentUser } from "../../services/users.js";
import { field, formBody } from "../form.js";

async function previewImportForUser(userId: string, csvText: string): Promise<TransactionImportPreview> {
  const [accounts, categories, tags, rules] = await Promise.all([
    listAccountsWithBalances(userId),
    listCategories(userId),
    listTags(userId),
    listActiveRules(userId)
  ]);
  const refs = { accounts, categories, tags, rules };
  const initialPreview = previewTransactionImportCsv(csvText, refs);
  let from: Date | null = null;
  let to: Date | null = null;

  for (const row of initialPreview.rows) {
    if (!row.date) {
      continue;
    }

    if (!from || row.date < from) {
      from = row.date;
    }

    if (!to || row.date > to) {
      to = row.date;
    }
  }

  if (!from || !to) {
    return initialPreview;
  }

  const existingTransactions = await listTransactionDuplicateCandidates(userId, from, to);

  return previewTransactionImportCsv(csvText, { ...refs, existingTransactions });
}

function importMappingFromBody(body: ReturnType<typeof formBody>): TransactionImportMapping {
  return {
    dateColumn: field(body, "dateColumn"),
    typeColumn: field(body, "typeColumn"),
    amountColumn: field(body, "amountColumn"),
    amountMinorColumn: field(body, "amountMinorColumn"),
    debitColumn: field(body, "debitColumn"),
    creditColumn: field(body, "creditColumn"),
    accountColumn: field(body, "accountColumn"),
    destinationAccountColumn: field(body, "destinationAccountColumn"),
    categoryColumn: field(body, "categoryColumn"),
    tagsColumn: field(body, "tagsColumn"),
    descriptionColumn: field(body, "descriptionColumn"),
    notesColumn: field(body, "notesColumn"),
    defaultType: field(body, "defaultType"),
    defaultAccountId: field(body, "defaultAccountId")
  };
}

export async function transactionImportRoutes(app: FastifyInstance) {
  app.get("/transactions/import", async (_request, reply) => {
    return reply.view("transactions/import.ejs", {
      title: "Import transactions",
      csvText: "",
      error: null
    });
  });

  app.post("/transactions/import/map", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);
    const csvText = field(body, "csvText").trim();

    try {
      const [headers, accounts] = await Promise.all([
        Promise.resolve(detectTransactionImportHeaders(csvText)),
        listAccountsWithBalances(user.id)
      ]);
      const mappingOptions = buildTransactionImportMappingOptions(headers);

      return reply.view("transactions/import-map.ejs", {
        title: "Map import columns",
        csvText,
        headers,
        mappingOptions,
        accounts,
        transactionTypes,
        mapping: Object.fromEntries(mappingOptions.map((option) => [option.key, option.guess])),
        error: null
      });
    } catch (error) {
      return reply.code(400).view("transactions/import.ejs", {
        title: "Import transactions",
        csvText,
        error: error instanceof Error ? error.message : "Could not read CSV headers."
      });
    }
  });

  app.post("/transactions/import/preview", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);
    const csvText = field(body, "csvText").trim();
    const mappedCsvText = field(body, "mappedCsvText").trim();

    try {
      const normalizedCsvText = mappedCsvText || applyTransactionImportMapping(csvText, importMappingFromBody(body));
      const preview = await previewImportForUser(user.id, normalizedCsvText);
      const importBatchId =
        preview.errorCount === 0 ? await createTransactionImportBatch(user.id, normalizedCsvText) : null;

      return reply.view("transactions/import-preview.ejs", {
        title: "Import preview",
        csvText: normalizedCsvText,
        preview,
        importBatchId,
        error: null,
      });
    } catch (error) {
      let headers: string[] = [];
      let accounts: Awaited<ReturnType<typeof listAccountsWithBalances>> = [];

      try {
        headers = detectTransactionImportHeaders(csvText);
        accounts = await listAccountsWithBalances(user.id);
      } catch {
        // Fall back to the source form when the CSV itself cannot be parsed.
      }

      if (headers.length > 0) {
        return reply.code(400).view("transactions/import-map.ejs", {
          title: "Map import columns",
          csvText,
          headers,
          mappingOptions: buildTransactionImportMappingOptions(headers),
          accounts,
          transactionTypes,
          mapping: importMappingFromBody(body),
          error: error instanceof Error ? error.message : "Could not preview CSV import."
        });
      }

      return reply.code(400).view("transactions/import.ejs", {
        title: "Import transactions",
        csvText,
        error: error instanceof Error ? error.message : "Could not preview CSV import."
      });
    }
  });

  app.post("/transactions/import/confirm", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);
    const csvText = field(body, "csvText").trim();
    const duplicateMode = field(body, "duplicateMode");
    const importBatchId = field(body, "importBatchId");
    const includeDuplicates = duplicateMode === "include" || field(body, "includeDuplicates") === "yes";

    try {
      const preview = await previewImportForUser(user.id, csvText);
      await persistTransactionImport(user.id, importBatchId, csvText, preview, includeDuplicates);

      return reply.redirect("/transactions");
    } catch (error) {
      let preview: TransactionImportPreview | null = null;

      try {
        preview = await previewImportForUser(user.id, csvText);
      } catch {
        // Keep the confirmation error when the preview cannot be rebuilt.
      }

      return reply.code(400).view(preview ? "transactions/import-preview.ejs" : "transactions/import.ejs", {
        title: preview ? "Import preview" : "Import transactions",
        csvText,
        preview,
        importBatchId,
        error: error instanceof Error ? error.message : "Could not import transactions.",
      });
    }
  });
}
