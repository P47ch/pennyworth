import type { FastifyInstance } from "fastify";
import { transactionCrudRoutes } from "./transactions/crud.js";
import { transactionExportRoutes } from "./transactions/export.js";
import { transactionImportRoutes } from "./transactions/import.js";

export async function transactionRoutes(app: FastifyInstance) {
  await transactionCrudRoutes(app);
  await transactionExportRoutes(app);
  await transactionImportRoutes(app);
}
