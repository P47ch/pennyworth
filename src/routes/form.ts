export type FormData = Record<string, string | string[] | undefined>;

export function formBody(body: unknown): FormData {
  if (!body || typeof body !== "object") {
    return {};
  }

  return body as FormData;
}

export function field(body: FormData, name: string): string {
  const value = body[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function fields(body: FormData, name: string): string[] {
  const value = body[name];

  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
