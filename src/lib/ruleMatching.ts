import { csvEscape } from "./csv.js";

export type AppliedRule = {
  name: string;
  categoryName: string;
  addedTagNames: string[];
};

export function parseRuleMatchText(input: string): string[] {
  const terms: string[] = [];
  const seenTerms = new Set<string>();
  let term = "";
  let inQuotes = false;
  let closedQuote = false;

  function addTerm() {
    const trimmed = term.trim();
    if (trimmed && !seenTerms.has(trimmed.toLowerCase())) {
      terms.push(trimmed);
      seenTerms.add(trimmed.toLowerCase());
    }
    term = "";
    closedQuote = false;
  }

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inQuotes) {
      if (character === '"' && input[index + 1] === '"') {
        term += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
        closedQuote = true;
      } else {
        term += character;
      }
    } else if (character === ",") {
      addTerm();
    } else if (character === '"') {
      if (term.trim() || closedQuote) {
        throw new Error("Quote the whole phrase and double any quotes inside it.");
      }
      term = "";
      inQuotes = true;
    } else if (closedQuote && character.trim()) {
      throw new Error("Separate quoted phrases with commas.");
    } else if (!closedQuote) {
      term += character;
    }
  }

  if (inQuotes) {
    throw new Error("Match text contains an unclosed quoted phrase.");
  }

  addTerm();
  return terms;
}

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
