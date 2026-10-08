import type { FastifyReply } from "fastify";
import { formBody } from "./form.js";

type DeleteDetail =
  | { label: string; value: string }
  | { label: string; type: string }
  | { label: string; amountMinor: number; currency: string };

type DeleteConfirmation = {
  title: string;
  recordName: string;
  deleteAction: string;
  cancelHref: string;
  details?: DeleteDetail[];
  warnings?: string[];
};

export function isDeleteConfirmed(body: unknown): boolean {
  return formBody(body).confirmDelete === "yes";
}

export function showDeleteConfirmation(reply: FastifyReply, confirmation: DeleteConfirmation) {
  return reply.view("delete-confirmation.ejs", {
    ...confirmation,
    details: confirmation.details ?? [],
    warnings: confirmation.warnings ?? []
  });
}
