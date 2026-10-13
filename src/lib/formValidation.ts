// Browser-safe field contracts. This module is also compiled verbatim for the browser.
export type FormValues = Record<string, unknown>;
type Condition = { field: string; values: readonly string[] };
export type FieldRule = {
  required?: boolean; requiredWhen?: Condition; when?: Condition;
  kind?: "money" | "quantity" | "date" | "month" | "email" | "currency" | "color" | "password" | "passphrase" | "rule" | "file";
  minimum?: "positive" | "nonnegative"; choices?: readonly string[]; multiple?: boolean;
  maxLength?: number; equals?: string;
  maxBytes?: number;
};
export type ValidationContext = { primaryCurrency?: string; originalName?: string; backupFileBytes?: number; categoryTypes?: Record<string, string>; categoryId?: string; categoryParents?: Record<string, string | null> };
export type FieldError = { field: string; message: string };
const required: FieldRule = { required: true };
const positiveMoney: FieldRule = { required: true, kind: "money", minimum: "positive" };
const transfer: Condition = { field: "type", values: ["transfer"] };
const trade: Condition = { field: "type", values: ["buy", "sell"] };
const transactionType = ["income", "expense", "transfer"];
const accountType = ["bank", "cash", "credit_card", "savings", "investment", "crypto_wallet", "other"];
const assetType = ["stock", "etf", "fund", "bond", "crypto", "other"];
const categoryType = ["income", "expense", "both"];
const icons = ["salary", "food", "home", "transport", "health", "subscription", "investment", "tax", "shopping", "entertainment", "education", "travel", "business", "gift", "pets", "utilities", "savings", "other"];
const feeFields: Record<string, FieldRule> = {
  feeAmount: { kind: "money", minimum: "nonnegative" }, feeAccount: { choices: ["source", "destination"] }
};
export const formContracts = {
  account: { name: required, type: { ...required, choices: accountType }, currency: { ...required, kind: "currency" }, openingBalance: { ...required, kind: "money" }, institution: {} },
  asset: { name: required, symbol: required, type: { ...required, choices: assetType }, currency: { ...required, kind: "currency" }, isActive: { choices: ["on"] } },
  category: { name: required, type: { ...required, choices: categoryType }, parentId: {}, color: { kind: "color" }, icon: { choices: icons } },
  tag: { name: required, color: { kind: "color" } },
  transaction: {
    type: { ...required, choices: transactionType }, sourceAccountId: required,
    destinationAccountId: { requiredWhen: transfer, when: transfer }, date: { ...required, kind: "date" },
    amount: positiveMoney, categoryId: {}, description: {}, notes: {}, tagIds: { multiple: true }
  },
  recurring: {
    name: required, type: { ...required, choices: transactionType }, sourceAccountId: required,
    destinationAccountId: { requiredWhen: transfer, when: transfer },
    amountMode: { choices: ["fixed", "target_balance"] },
    amount: { ...positiveMoney, when: { field: "amountMode", values: ["", "fixed"] } },
    targetBalance: { ...required, kind: "money", minimum: "nonnegative", when: { field: "amountMode", values: ["target_balance"] } },
    ...feeFields, feeCategoryId: {}, categoryId: {}, description: {}, notes: {},
    frequency: { ...required, choices: ["daily", "weekly", "monthly", "every_3_months", "every_6_months"] },
    nextDate: { ...required, kind: "date" }, isActive: { choices: ["on"] }
  },
  fee: feeFields,
  holding: { accountId: required, assetId: required, quantity: { ...required, kind: "quantity" }, averageCost: { ...required, kind: "money", minimum: "nonnegative" }, notes: {} },
  investment: {
    accountId: required, assetId: required, cashAccountId: {}, type: { ...required, choices: ["buy", "sell", "dividend", "interest", "fee"] },
    date: { ...required, kind: "date" }, quantity: { kind: "quantity", requiredWhen: trade }, price: { kind: "money", minimum: "positive", requiredWhen: trade },
    amount: positiveMoney, cashAmount: { kind: "money", minimum: "positive" }, notes: {}
  },
  price: { assetId: required, date: { ...required, kind: "date" }, price: positiveMoney },
  budget: { month: { ...required, kind: "month" }, categoryId: required, amount: positiveMoney },
  month: { month: { ...required, kind: "month" } },
  rule: { name: required, matchText: { ...required, kind: "rule" }, categoryId: required, tagIds: { multiple: true }, isActive: { choices: ["on"] } },
  user: { name: { ...required, maxLength: 100 }, email: { ...required, kind: "email", maxLength: 320 } },
  login: { email: { ...required, kind: "email" }, password: required },
  password: { currentPassword: required, newPassword: { ...required, kind: "password" }, confirmPassword: { ...required, equals: "newPassword" } },
  backupExport: { backupPassphrase: { ...required, kind: "passphrase" }, backupPassphraseConfirmation: { ...required, equals: "backupPassphrase" } },
  backupRestore: { backupFile: { kind: "file" }, backupJson: {}, backupPassphrase: { maxBytes: 1024 } },
  restoreConfirm: { confirmation: required, backupPassphrase: { maxBytes: 1024 } },
  preferences: {
    language: { ...required, choices: ["en", "it"] }, theme: { ...required, choices: ["light", "dark"] },
    avatarKey: { ...required, choices: ["initials", "auditor", "archivist", "operator", "courier", "custodian"] },
    visibleMenuItems: { multiple: true, choices: ["dashboard", "statistics", "budgets", "recurring", "accounts", "transactions", "categories", "tags", "rules", "investments", "assets", "holdings", "investment-transactions", "asset-prices"] }
  },
  csv: { csvText: required },
  importMapping: { csvText: required, dateColumn: required, amountColumn: {}, amountMinorColumn: {}, debitColumn: {}, creditColumn: {}, typeColumn: {}, accountColumn: {}, destinationAccountColumn: {}, categoryColumn: {}, tagsColumn: {}, descriptionColumn: {}, notesColumn: {}, defaultType: { choices: transactionType }, defaultAccountId: {} },
  importConfirm: { csvText: required, duplicateMode: { choices: ["skip", "include"] } },
  filters: { type: { choices: transactionType }, from: { kind: "date" }, to: { kind: "date" }, accountId: {}, categoryId: {}, tagId: {}, search: {} },
  action: {}
} satisfies Record<string, Record<string, FieldRule>>;
export type FormKind = keyof typeof formContracts;

function value(values: FormValues, field: string): string {
  return typeof values[field] === "string" ? values[field] : "";
}
export function conditionMatches(condition: Condition | undefined, values: FormValues): boolean {
  return !condition || condition.values.includes(value(values, condition.field));
}
export function fieldIsRequired(rule: FieldRule, values: FormValues): boolean {
  return conditionMatches(rule.when, values) && (rule.required === true || (!!rule.requiredWhen && conditionMatches(rule.requiredWhen, values)));
}
export function passwordFieldError(password: string, label = "Password"): string | null {
  if (!password) return `${label} is required.`;
  if (password.length < 12) return `${label} must be at least 12 characters.`;
  if (new TextEncoder().encode(password).length > 72) return `${label} must be no more than 72 UTF-8 bytes for the current password hashing format.`;
  if (["change-me-now", "password", "admin", "admin123"].includes(password.toLowerCase())) return `${label} uses a forbidden default password.`;
  return null;
}
function decimalMinor(input: string): bigint | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace(/^-/, "").split(".");
  const digits = whole.replace(/^0+/, "") || "0";
  // Bound conversion cost as well as value for very long submitted decimal strings.
  if (digits.length > 8) return negative ? -2147483649n : 2147483648n;
  return (negative ? -1n : 1n) * (BigInt(digits) * 100n + BigInt(fraction.padEnd(2, "0")));
}
function validDate(input: string, monthOnly = false): boolean {
  if (!(monthOnly ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(input)) return false;
  const [year, month, day = 1] = input.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, monthOnly ? 7 : 10) === input;
}
export function validateForm(kind: FormKind, values: FormValues, context: ValidationContext = {}): FieldError[] {
  const errors: FieldError[] = [];
  const add = (field: string, message: string) => { if (!errors.some(error => error.field === field)) errors.push({ field, message }); };
  for (const [name, rule] of Object.entries(formContracts[kind]) as [string, FieldRule][]) {
    const raw = values[name];
    if (rule.kind === "file") continue; // Size and file/pasted-input checks use explicit context below.
    if (raw !== undefined && typeof raw !== "string" && !(rule.multiple && Array.isArray(raw) && raw.every(item => typeof item === "string"))) {
      add(name, "Check the submitted fields."); continue;
    }
    if (!conditionMatches(rule.when, values)) continue;
    const input = value(values, name);
    const trimmed = input.trim();
    if (rule.maxBytes && new TextEncoder().encode(input).length > rule.maxBytes) add(name, "Backup passphrase must be no more than 1024 UTF-8 bytes.");
    if (fieldIsRequired(rule, values) && !(rule.kind === "password" || name.toLowerCase().includes("password") || rule.kind === "passphrase" ? input : trimmed)) {
      add(name, "Complete this field."); continue;
    }
    if (rule.equals && input !== value(values, rule.equals)) add(name, "The confirmation does not match.");
    if (rule.choices) {
      const selected = rule.multiple && Array.isArray(raw) ? raw : [input];
      if (selected.some(item => item && !rule.choices!.includes(item))) add(name, "Choose a valid option.");
    }
    if (!trimmed && !["password", "passphrase"].includes(rule.kind ?? "")) continue;
    if (rule.maxLength && trimmed.length > rule.maxLength) add(name, "This value is too long.");
    switch (rule.kind) {
      case "money": {
        const minor = decimalMinor(input);
        if (minor === null) add(name, "Enter an amount with up to 2 decimal places.");
        else if (minor < -2147483648n || minor > 2147483647n) add(name, "Amount is outside the supported range.");
        else if (rule.minimum === "positive" && minor <= 0n) add(name, "Amount must be greater than zero.");
        else if (rule.minimum === "nonnegative" && minor < 0n) add(name, "Amount must be zero or greater.");
        break;
      }
      case "quantity": {
        const normalized = trimmed.replace(",", ".");
        if (!/^\d+(\.\d{1,8})?$/.test(normalized) || !/[1-9]/.test(normalized)) add(name, "Quantity must be a positive number with up to 8 decimal places.");
        else if (normalized.split(".")[0].replace(/^0+/, "").length > 16) add(name, "Quantity is outside the supported range.");
        break;
      }
      case "date": if (!validDate(input)) add(name, "Choose a valid date."); break;
      case "month": if (!validDate(input, true)) add(name, "Choose a valid month."); break;
      case "email": if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) add(name, "Enter a valid email address."); break;
      case "currency": if (!/^[A-Z]{3}$/.test(trimmed.toUpperCase()) || (context.primaryCurrency && trimmed.toUpperCase() !== context.primaryCurrency)) add(name, "Use the primary currency."); break;
      case "color": if (!/^#[a-f\d]{6}$/i.test(trimmed)) add(name, "Choose a valid color."); break;
      case "password": { const message = passwordFieldError(input, "New password"); if (message) add(name, message); break; }
      case "passphrase": if (Array.from(input).length < 12) add(name, "Backup passphrase must be at least 12 characters."); else if (new TextEncoder().encode(input).length > 1024) add(name, "Backup passphrase must be no more than 1024 UTF-8 bytes."); break;
      case "rule": try { if (!parseRuleMatchText(input).length) add(name, "Enter at least one matching word or phrase."); } catch (error) { add(name, (error as Error).message); } break;
    }
  }
  if ((kind === "transaction" || kind === "recurring") && value(values, "type") === "transfer" && value(values, "sourceAccountId") === value(values, "destinationAccountId")) add("destinationAccountId", "Transfer accounts must be different.");
  if ((kind === "transaction" || kind === "recurring") && value(values, "type") !== "transfer") {
    const categoryType = context.categoryTypes?.[value(values, "categoryId")];
    if (categoryType && categoryType !== "both" && categoryType !== value(values, "type")) add("categoryId", "Choose a category compatible with the transaction type.");
  }
  if (kind === "recurring") {
    const name = value(values, "name").trim();
    if (name.length > 100 && name !== context.originalName?.trim()) add("name", "Name must contain between 1 and 100 characters.");
    if (value(values, "amountMode") === "target_balance" && value(values, "type") !== "transfer") add("amountMode", "Target balances are only available for transfers.");
    if (value(values, "type") !== "transfer" && ((decimalMinor(value(values, "feeAmount") || "0") ?? 0n) !== 0n || value(values, "feeCategoryId") || (value(values, "feeAccount") && value(values, "feeAccount") !== "source"))) add("feeAmount", "Top-up fees are only available for transfers.");
  }
  if (kind === "filters" && value(values, "from") && value(values, "to") && value(values, "from") > value(values, "to")) add("to", "The end date must be on or after the start date.");
  if (kind === "category" && context.categoryParents) {
    const message = categoryParentError(context.categoryId, value(values, "parentId"), context.categoryParents);
    if (message) add("parentId", message);
  }
  if (kind === "restoreConfirm" && value(values, "confirmation").trim() !== "RESTORE") add("confirmation", "Type RESTORE to confirm.");
  if (kind === "backupRestore") {
    const fileBytes = context.backupFileBytes ?? 0;
    const json = value(values, "backupJson").trim();
    if (!!fileBytes === !!json) add("backupJson", "Choose a backup file or paste JSON, but not both.");
    if (fileBytes > 14 * 1024 * 1024) add("backupFile", "Backup file is too large.");
    if (json) {
      if (new TextEncoder().encode(json).length > 10 * 1024 * 1024) add("backupJson", "Backup JSON is too large.");
      else try {
        const data: unknown = JSON.parse(json);
        if (!data || typeof data !== "object" || Array.isArray(data)) add("backupJson", "Paste a valid JSON backup.");
        else if ((data as { format?: string }).format === "pennyworth-encrypted-backup" && !value(values, "backupPassphrase")) add("backupPassphrase", "Enter the backup passphrase.");
      } catch { add("backupJson", "Paste a valid JSON backup."); }
    }
  }
  if (kind === "importMapping") {
    if (!["amountColumn", "amountMinorColumn", "debitColumn", "creditColumn"].some(name => value(values, name))) add("amountColumn", "Map an amount, amount minor, debit, or credit column.");
    if (!["typeColumn", "debitColumn", "creditColumn", "defaultType"].some(name => value(values, name))) add("defaultType", "Map a type column or choose a default transaction type.");
    if (!value(values, "accountColumn") && !value(values, "defaultAccountId")) add("defaultAccountId", "Map an account column or choose a default account.");
  }
  return errors;
}
export class FormValidationError extends Error {
  readonly statusCode = 400;
  constructor(readonly errors: FieldError[]) { super(errors[0]?.message ?? "Check the submitted fields."); }
}
export function assertForm(kind: FormKind, values: FormValues, context?: ValidationContext): void {
  const errors = validateForm(kind, values, context);
  if (errors.length) throw new FormValidationError(errors);
}

export function categoryParentError(categoryId: string | null | undefined, parentId: string | undefined, parents: Record<string, string | null>): string | null {
  if (!parentId) return null;
  if (categoryId && parentId === categoryId) return "A category cannot be its own parent.";
  if (!Object.hasOwn(parents, parentId)) return "Choose a valid parent category.";
  let currentParentId: string | null | undefined = parentId;
  const visited = new Set<string>();
  while (currentParentId) {
    if (visited.has(currentParentId)) return "Category hierarchy contains a cycle.";
    visited.add(currentParentId);
    if (categoryId && currentParentId === categoryId) return "A category cannot use one of its children as parent.";
    currentParentId = Object.hasOwn(parents, currentParentId) ? parents[currentParentId] : undefined;
  }
  return null;
}

export const italianValidationMessages: Record<string, string> = {
  "A category cannot be its own parent.": "Una categoria non può essere il proprio genitore.",
  "Choose a valid parent category.": "Scegli una categoria padre valida.",
  "Category hierarchy contains a cycle.": "La gerarchia delle categorie contiene un ciclo.",
  "A category cannot use one of its children as parent.": "Una categoria non può usare una delle sue sottocategorie come genitore.",
  "Choose a category compatible with the transaction type.": "Scegli una categoria compatibile con il tipo di transazione.",
  "Checking the backup file.": "Controllo del file di backup in corso.",
  "Complete this field.": "Compila questo campo.",
  "Check the submitted fields.": "Controlla i campi inviati.",
  "The confirmation does not match.": "La conferma non corrisponde.",
  "Choose a valid option.": "Scegli un’opzione valida.",
  "This value is too long.": "Questo valore è troppo lungo.",
  "Enter an amount with up to 2 decimal places.": "Inserisci un importo con al massimo 2 cifre decimali.",
  "Amount is outside the supported range.": "L’importo è fuori dall’intervallo supportato.",
  "Amount must be greater than zero.": "L’importo deve essere maggiore di zero.",
  "Amount must be zero or greater.": "L’importo deve essere maggiore o uguale a zero.",
  "Quantity must be a positive number with up to 8 decimal places.": "La quantità deve essere positiva e avere al massimo 8 cifre decimali.",
  "Quantity is outside the supported range.": "La quantità è fuori dall’intervallo supportato.",
  "Choose a valid date.": "Scegli una data valida.",
  "Choose a valid month.": "Scegli un mese valido.",
  "Enter a valid email address.": "Inserisci un indirizzo email valido.",
  "Use the primary currency.": "Usa la valuta principale.",
  "Choose a valid color.": "Scegli un colore valido.",
  "New password is required.": "La nuova password è obbligatoria.",
  "New password must be at least 12 characters.": "La nuova password deve contenere almeno 12 caratteri.",
  "New password must be no more than 72 UTF-8 bytes for the current password hashing format.": "La nuova password deve contenere al massimo 72 byte UTF-8 per il formato di hashing attuale.",
  "New password uses a forbidden default password.": "La nuova password usa una password predefinita non consentita.",
  "Backup passphrase must be at least 12 characters.": "La passphrase del backup deve contenere almeno 12 caratteri.",
  "Backup passphrase must be no more than 1024 UTF-8 bytes.": "La passphrase del backup deve contenere al massimo 1024 byte UTF-8.",
  "Enter at least one matching word or phrase.": "Inserisci almeno una parola o frase da cercare.",
  "Quote the whole phrase and double any quotes inside it.": "Racchiudi l’intera frase tra virgolette e raddoppia quelle al suo interno.",
  "Separate quoted phrases with commas.": "Separa le frasi tra virgolette con virgole.",
  "Match text contains an unclosed quoted phrase.": "Il testo contiene una frase con virgolette non chiuse.",
  "Transfer accounts must be different.": "I conti del trasferimento devono essere diversi.",
  "Name must contain between 1 and 100 characters.": "Il nome deve contenere da 1 a 100 caratteri.",
  "Target balances are only available for transfers.": "I saldi obiettivo sono disponibili solo per i trasferimenti.",
  "Top-up fees are only available for transfers.": "Le commissioni di ricarica sono disponibili solo per i trasferimenti.",
  "The end date must be on or after the start date.": "La data finale deve essere uguale o successiva alla data iniziale.",
  "Type RESTORE to confirm.": "Digita RESTORE per confermare.",
  "Choose a backup file or paste JSON, but not both.": "Scegli un file di backup oppure incolla il JSON, non entrambi.",
  "Backup file is too large.": "Il file di backup è troppo grande.",
  "Backup JSON is too large.": "Il JSON del backup è troppo grande.",
  "Paste a valid JSON backup.": "Incolla un backup JSON valido.",
  "Enter the backup passphrase.": "Inserisci la passphrase del backup.",
  "Map an amount, amount minor, debit, or credit column.": "Associa una colonna importo, unità minori, addebito o accredito.",
  "Map a type column or choose a default transaction type.": "Associa una colonna tipo oppure scegli un tipo di transazione predefinito.",
  "Map an account column or choose a default account.": "Associa una colonna conto oppure scegli un conto predefinito."
};
export function translateValidationMessage(message: string, language: string): string {
  return language === "it" ? italianValidationMessages[message] ?? message : message;
}

export function parseRuleMatchText(input: string): string[] {
  const terms: string[] = [];
  const seenTerms = new Set<string>();
  let term = "", inQuotes = false, closedQuote = false;
  function addTerm() {
    const trimmed = term.trim();
    if (trimmed && !seenTerms.has(trimmed.toLowerCase())) { terms.push(trimmed); seenTerms.add(trimmed.toLowerCase()); }
    term = ""; closedQuote = false;
  }
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inQuotes) {
      if (character === '"' && input[index + 1] === '"') { term += '"'; index += 1; }
      else if (character === '"') { inQuotes = false; closedQuote = true; }
      else term += character;
    } else if (character === ",") addTerm();
    else if (character === '"') {
      if (term.trim() || closedQuote) throw new Error("Quote the whole phrase and double any quotes inside it.");
      term = ""; inQuotes = true;
    } else if (closedQuote && character.trim()) throw new Error("Separate quoted phrases with commas.");
    else if (!closedQuote) term += character;
  }
  if (inQuotes) throw new Error("Match text contains an unclosed quoted phrase.");
  addTerm(); return terms;
}
