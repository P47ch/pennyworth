import { csvEscape } from "./csv.js";
import { parseRuleMatchText } from "./formValidation.js";
export { parseRuleMatchText } from "./formValidation.js";

export type AppliedRule = {
  name: string;
  categoryName: string;
  addedTagNames: string[];
};

export function validateRuleMatchText(input: string): string {
  const terms = parseRuleMatchText(input);
  if (terms.length === 0) {
    throw new Error("Enter at least one matching word or phrase.");
  }
  return terms.map(csvEscape).join(", ");
}

export function validateBackupRuleMatchText(input: string): void {
  const trimmed = input.trim();
  // Historical imports allowed inert whitespace literals, including quoted
  // line breaks after migration. Preserve them without allowing empty form input.
  if (!trimmed || (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') && !trimmed.slice(1, -1).trim())) {
    return;
  }
  validateRuleMatchText(input);
}

// Versions 1–9 stored one literal phrase, including any commas or quotes.
export function encodeLegacyRuleMatchText(input: string): string {
  return csvEscape(input);
}

export function createRuleMatcher<T extends { matchText: string; isActive?: boolean }>(
  rules: T[]
) {
  const preparedRules = rules
    .filter((rule) => rule.isActive !== false)
    .map((rule) => ({ rule, terms: parseRuleMatchText(rule.matchText).map((term) => term.toLowerCase()) }));

  return (transaction: { description?: string | null; notes?: string | null }): T | null => {
    const searchableText = `${transaction.description ?? ""} ${transaction.notes ?? ""}`.toLowerCase();
    return preparedRules.find(({ terms }) => terms.some((term) => searchableText.includes(term)))?.rule ?? null;
  };
}

export function matchRuleForText<T extends { matchText: string; isActive?: boolean }>(
  transaction: { description?: string | null; notes?: string | null },
  rules: T[]
): T | null {
  return createRuleMatcher(rules)(transaction);
}
