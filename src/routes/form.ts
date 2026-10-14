import { FormValidationError } from "../lib/formValidation.js";
export type FormData = Record<string, string | string[] | undefined>;

export function assertSubmittedFields(body: unknown, allowBackupFile = false): void {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new FormValidationError([{ field: "", message: "Check the submitted fields." }]);
  }
  for (const [name, value] of Object.entries(body)) {
    if (typeof value === "string") continue;
    if (["tagIds", "visibleMenuItems", "confirmDelete"].includes(name) && Array.isArray(value) && value.every(item => typeof item === "string")) continue;
    if (allowBackupFile && name === "backupFile" && Buffer.isBuffer(value)) continue;
    throw new FormValidationError([{ field: name, message: "Check the submitted fields." }]);
  }
}

export function formBody(body: unknown): FormData {
  if (!body || typeof body !== "object") {
    return {};
  }

  return body as FormData;
}

export function field(body: FormData, name: string): string {
  const value = body[name];
  return typeof value === "string" ? value : "";
}

export function fields(body: FormData, name: string): string[] {
  const value = body[name];

  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? [value] : [];
}

export function formDraftHelpers(body: unknown) {
  const draft = body === undefined ? undefined : formBody(body);
  return {
    draftField(name: string, fallback: string): string { return draft ? field(draft, name) : fallback; },
    draftSelected(name: string, option: string, fallback: boolean | string): boolean {
      return draft ? fields(draft, name).includes(option) : Boolean(fallback);
    }
  };
}
