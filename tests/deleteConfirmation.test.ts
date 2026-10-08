import { readFileSync } from "node:fs";
import ejs from "ejs";
import { describe, expect, it } from "vitest";
import { createMoneyFormatter } from "../src/finance/money.js";
import { createTranslator, createTypeLabelFormatter } from "../src/lib/i18n.js";
import { localizeEjsTemplate } from "../src/lib/localizedEjs.js";
import { isDeleteConfirmed } from "../src/routes/deleteConfirmation.js";

const render = ejs.compile(localizeEjsTemplate(
  readFileSync(new URL("../src/views/delete-confirmation.ejs", import.meta.url), "utf8")
));

describe("deletion confirmations", () => {
  it.each([undefined, null, {}, { confirmDelete: "" }, { confirmDelete: "no" },
    { confirmDelete: true }, { confirmDelete: ["yes"] }, { confirmDelete: ["yes", "no"] }])(
    "does not confirm deletion for %j", (body) => {
      expect(isDeleteConfirmed(body)).toBe(false);
    }
  );

  it("requires an explicit scalar confirmation", () => {
    expect(isDeleteConfirmed({ confirmDelete: "yes" })).toBe(true);
  });

  it.each(["en", "it"] as const)("renders an accessible, localized %s review form", (language) => {
    const html = render({
      title: "Delete transaction", recordName: '<script>alert("test")</script>',
      deleteAction: "/transactions/record-1/delete", cancelHref: "/transactions", csrfToken: "test-token",
      details: [{ label: "Type", type: "expense" }, { label: "Date", value: "2026-10-07" },
        { label: "Amount", amountMinor: 2387, currency: "EUR" }],
      warnings: ["This transaction will be permanently deleted."],
      formatMoney: createMoneyFormatter("EUR"), t: createTranslator(language), typeLabel: createTypeLabelFormatter(language)
    });

    expect(html).toContain(language === "it" ? "Elimina transazione" : "Delete transaction");
    expect(html).toContain(language === "it" ? "Conferma eliminazione" : "Confirm deletion");
    expect(html).toContain(language === "it" ? "Annulla" : "Cancel");
    expect(html).toContain(language === "it" ? "Spesa" : "Expense");
    expect(html).toContain("€23.87");
    expect(html).toContain('action="/transactions/record-1/delete"');
    expect(html).toContain('href="/transactions"');
    expect(html).toContain('name="csrfToken" value="test-token"');
    expect(html).toContain('type="submit" name="confirmDelete" value="yes"');
    expect(html).not.toContain('type="hidden" name="confirmDelete"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
