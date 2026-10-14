import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertForm, categoryParentError, formContracts, validateForm } from "../src/lib/formValidation.js";
import { parseMoneyToMinorUnits } from "../src/finance/money.js";
import { recurringFrequencies } from "../src/finance/recurring.js";
import { categoryIconOptions } from "../src/lib/icons.js";
import { avatarOptions } from "../src/lib/avatar.js";
import { menuItemIds } from "../src/lib/preferences.js";
import { assertSubmittedFields, field, formBody } from "../src/routes/form.js";

const recurring = { name: "Top-up", type: "transfer", sourceAccountId: "bank", destinationAccountId: "wallet", amountMode: "fixed", amount: "10", feeAmount: "0", feeAccount: "source", frequency: "weekly", nextDate: "2026-10-13" };
describe("shared browser/server field contracts", () => {
  it("requires both transfer accounts, distinct accounts and positive money", () => {
    expect(validateForm("recurring", recurring)).toEqual([]);
    for (const input of [{ sourceAccountId: "" }, { destinationAccountId: "" }, { destinationAccountId: "bank" }, { amount: "0" }, { amount: "-1" }, { amount: "1.234" }, { amount: "bad" }, { feeAmount: "-1" }, { feeAccount: "other" }]) {
      expect(() => assertForm("recurring", { ...recurring, ...input })).toThrow();
    }
    expect(validateForm("recurring", { ...recurring, type: "expense", destinationAccountId: "", feeAccount: "source" })).toEqual([]);
    expect(validateForm("recurring", { ...recurring, amountMode: "target_balance", amount: "", targetBalance: "0" })).toEqual([]);
  });
  it.each(["0", "-0.01", "21474836.47", "-21474836.48", "1,25", " 01.20 "])("matches the financial parser for signed money %s", openingBalance => {
    expect(validateForm("account", { name: "Bank", type: "bank", currency: "EUR", openingBalance })).toEqual([]);
    expect(Number.isInteger(parseMoneyToMinorUnits(openingBalance))).toBe(true);
  });
  it.each(["21474836.48", "-21474836.49", "1e2", "1.000", ".1", "NaN"])("rejects malformed/out-of-range money %s", openingBalance => {
    expect(validateForm("account", { name: "Bank", type: "bank", currency: "EUR", openingBalance }).some(error => error.field === "openingBalance")).toBe(true);
    expect(() => parseMoneyToMinorUnits(openingBalance)).toThrow();
  });
  it("validates quantity precision/range and conditional trade fields", () => {
    const investment = { type: "buy", accountId: "investment", assetId: "asset", amount: "5", date: "2026-10-13" };
    expect(validateForm("investment", investment).map(error => error.field)).toEqual(["quantity", "price"]);
    expect(validateForm("investment", { ...investment, type: "dividend" })).toEqual([]);
    for (const quantity of ["0", "1.000000001", "10000000000000000", "1e5"]) expect(validateForm("investment", { ...investment, quantity, price: "5" })).not.toEqual([]);
    expect(validateForm("investment", { ...investment, quantity: "9999999999999999.99999999", price: "5" })).toEqual([]);
  });
  it("checks trimmed names, real dates, month ranges, enums and rule grammar", () => {
    expect(() => assertForm("tag", { name: "   " })).toThrow();
    expect(() => assertForm("rule", { name: "Rule", categoryId: "food", matchText: '"unclosed' })).toThrow();
    for (const nextDate of ["2026-02-30", "0099-01-01", "bad", "2026-1-1"]) expect(() => assertForm("recurring", { ...recurring, nextDate })).toThrow();
    expect(() => assertForm("month", { month: "2026-13" })).toThrow();
    expect(() => assertForm("filters", { from: "2026-10-13", to: "2026-10-12" })).toThrow();
    expect(() => assertForm("preferences", { language: "de", theme: "dark", avatarKey: "initials" })).toThrow();
  });
  it("preserves an unchanged legacy recurring name without allowing a longer replacement", () => {
    const originalName = "x".repeat(120);
    expect(validateForm("recurring", { ...recurring, name: originalName }, { originalName })).toEqual([]);
    expect(validateForm("recurring", { ...recurring, name: "y".repeat(120) }, { originalName })).not.toEqual([]);
  });
  it("checks parent ownership and cycles with the same hierarchy rule in both layers", () => {
    const parents = { parent: null, child: "parent", grandchild: "child" };
    expect(categoryParentError("child", "parent", parents)).toBeNull();
    expect(categoryParentError("parent", "parent", parents)).toBe("A category cannot be its own parent.");
    expect(categoryParentError("parent", "grandchild", parents)).toBe("A category cannot use one of its children as parent.");
    expect(categoryParentError(null, "foreign", parents)).toBe("Choose a valid parent category.");
    expect(categoryParentError(null, "a", { a: "b", b: "a" })).toBe("Category hierarchy contains a cycle.");
    expect(validateForm("category", { name: "Parent", type: "expense", parentId: "child" }, { categoryId: "parent", categoryParents: parents })).not.toEqual([]);
  });
  it("checks UTF-8 limits, password confirmations and backup source exclusivity", () => {
    const password = { currentPassword: "old", newPassword: "é".repeat(37), confirmPassword: "é".repeat(37) };
    expect(validateForm("password", password).map(error => error.field)).toEqual(["newPassword"]);
    expect(() => assertForm("password", { ...password, newPassword: "valid-new-password" })).toThrow();
    expect(() => assertForm("backupExport", { backupPassphrase: "😀".repeat(300), backupPassphraseConfirmation: "😀".repeat(300) })).toThrow();
    expect(() => assertForm("backupRestore", {})).toThrow();
    expect(() => assertForm("backupRestore", { backupJson: "{}" }, { backupFileBytes: 1 })).toThrow();
    expect(() => assertForm("backupRestore", { backupJson: "not json" })).toThrow();
    expect(() => assertForm("restoreConfirm", { confirmation: "restore" })).toThrow();
  });
  it("rejects malformed and repeated scalar fields without breaking error rendering", () => {
    for (const input of [{ name: 42 }, { name: {} }, { name: ["a", "b"] }, ["a"]]) expect(() => assertSubmittedFields(input)).toThrow();
    expect(field(formBody({ name: 42 }), "name")).toBe("");
    expect(() => assertSubmittedFields({ tagIds: ["a", "b"], visibleMenuItems: ["accounts"] })).not.toThrow();
  });
  it("keeps choice contracts aligned with the domain and generated browser module", () => {
    expect(formContracts.recurring.frequency.choices).toEqual(recurringFrequencies);
    expect(formContracts.category.icon.choices).toEqual(categoryIconOptions.map(option => option.name));
    expect(formContracts.preferences.avatarKey.choices).toEqual(avatarOptions.map(option => option.id));
    expect(formContracts.preferences.visibleMenuItems.choices).toEqual(menuItemIds);
    execFileSync(process.execPath, ["scripts/build-form-validation.mjs", "--check"]);
  });
  it("requires an explicit validation contract on every form template", () => {
    function files(path: string): string[] { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${path}/${entry.name}`) : [`${path}/${entry.name}`]); }
    for (const path of files("src/views").filter(file => file.endsWith(".ejs"))) {
      for (const match of readFileSync(path, "utf8").matchAll(/<form\b(?:(?:<%[\s\S]*?%>)|[^>])*>/g)) expect(match[0], path).toMatch(/data-validation="/);
    }
  });
});
