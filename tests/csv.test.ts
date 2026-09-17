import { describe, expect, it } from "vitest";
import { parseCsv, spreadsheetSafeCsvText, toCsv } from "../src/lib/csv.js";
import {
  applyTransactionImportMapping,
  buildTransactionImportMappingOptions,
  detectTransactionImportHeaders,
  previewTransactionImportCsv
} from "../src/services/transactionImport.js";

describe("csv export", () => {
  it("escapes commas, quotes, and newlines", () => {
    const csv = toCsv([
      ["description", "notes"],
      ['Lunch, "client"', "line 1\nline 2"]
    ]);

    expect(csv).toBe('description,notes\r\n"Lunch, ""client""","line 1\nline 2"\r\n');
  });

  it("neutralizes spreadsheet formulas in user-controlled text", () => {
    expect(spreadsheetSafeCsvText("=2+2")).toBe("'=2+2");
    expect(spreadsheetSafeCsvText("  +SUM(1,1)")).toBe("'  +SUM(1,1)");
    expect(spreadsheetSafeCsvText("@external")).toBe("'@external");
    expect(spreadsheetSafeCsvText("ordinary text")).toBe("ordinary text");
  });
});

describe("csv parsing", () => {
  it("parses quoted fields, escaped quotes, and CRLF rows", () => {
    expect(parseCsv('name,notes\r\n"Groceries, market","said ""hello"""\r\n')).toEqual([
      ["name", "notes"],
      ["Groceries, market", 'said "hello"']
    ]);
  });
});

describe("transaction csv import preview", () => {
  const refs = {
    accounts: [
      { id: "checking", name: "Checking" },
      { id: "savings", name: "Savings" }
    ],
    categories: [
      { id: "salary", name: "Salary", type: "income" as const },
      { id: "food", name: "Food", type: "expense" as const }
    ],
    tags: [{ id: "recurring", name: "recurring" }]
  };
  const groceryRule = {
    id: "rule-grocery",
    name: "Grocery stores",
    matchText: "grocery",
    categoryId: "food",
    category: { id: "food", name: "Food", type: "expense" as const },
    tags: [{ tag: { id: "recurring", name: "recurring" } }]
  };

  it("previews valid income, expense, and transfer rows", () => {
    const preview = previewTransactionImportCsv(
      [
        "date,type,amount,account,destination_account,category,tags,description,notes",
        "2026-07-01,income,2500.00,Checking,,Salary,recurring,Paycheck,July",
        "2026-07-02,expense,-12.35,Checking,,Food,,Lunch,",
        "2026-07-03,transfer,100.00,Checking,Savings,,,Move money,"
      ].join("\n"),
      refs
    );

    expect(preview.validCount).toBe(3);
    expect(preview.errorCount).toBe(0);
    expect(preview.rows.map((row) => row.amountMinor)).toEqual([250000, 1235, 10000]);
    expect(preview.rows[2].categoryId).toBeNull();
  });

  it("reports unknown references without creating importable rows", () => {
    const preview = previewTransactionImportCsv(
      [
        "date,type,amount,account,destination_account,category,tags,description,notes",
        "2026-07-01,expense,10.00,Missing,,Unknown,missing-tag,Test,"
      ].join("\n"),
      refs
    );

    expect(preview.validCount).toBe(0);
    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0].errors).toEqual([
      "Account must match an existing account.",
      "Category must match an existing category.",
      'Tag "missing-tag" must match an existing tag.'
    ]);
  });

  it("warns when an import row matches an existing transaction", () => {
    const preview = previewTransactionImportCsv(
      [
        "date,type,amount,account,destination_account,category,tags,description,notes",
        "2026-07-02,expense,12.35,Checking,,Food,,Lunch,"
      ].join("\n"),
      {
        ...refs,
        existingTransactions: [
          {
            id: "existing-transaction",
            type: "expense",
            date: new Date("2026-07-02"),
            amountMinor: 1235,
            sourceAccountId: "checking",
            destinationAccountId: null,
            description: " Lunch "
          }
        ]
      }
    );

    expect(preview.validCount).toBe(1);
    expect(preview.errorCount).toBe(0);
    expect(preview.warningCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.rows[0].duplicateOfTransactionId).toBe("existing-transaction");
    expect(preview.rows[0].warnings).toEqual(["Possible duplicate of an existing transaction."]);
  });

  it("warns when two import rows duplicate each other", () => {
    const preview = previewTransactionImportCsv(
      [
        "date,type,amount,account,destination_account,category,tags,description,notes",
        "2026-07-02,expense,12.35,Checking,,Food,,Lunch,First",
        "2026-07-02,expense,12.35,Checking,,Food,, lunch ,Second"
      ].join("\n"),
      refs
    );

    expect(preview.validCount).toBe(2);
    expect(preview.errorCount).toBe(0);
    expect(preview.warningCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.rows[1].duplicateOfRowNumber).toBe(2);
    expect(preview.rows[1].warnings).toEqual(["Possible duplicate of CSV row 2."]);
  });

  it("detects headers and guesses common bank column names", () => {
    const headers = detectTransactionImportHeaders("Transaction Date,Merchant,Value\n2026-07-01,Cafe,-4.50\n");
    const options = buildTransactionImportMappingOptions(headers);
    const guessByKey = Object.fromEntries(options.map((option) => [option.key, option.guess]));

    expect(headers).toEqual(["Transaction Date", "Merchant", "Value"]);
    expect(guessByKey.dateColumn).toBe("Transaction Date");
    expect(guessByKey.descriptionColumn).toBe("Merchant");
    expect(guessByKey.amountColumn).toBe("Value");
  });

  it("normalizes mapped bank CSV before preview", () => {
    const normalizedCsv = applyTransactionImportMapping("Transaction Date,Merchant,Value\n2026-07-01,Cafe,-4.50\n", {
      dateColumn: "Transaction Date",
      typeColumn: "",
      amountColumn: "Value",
      amountMinorColumn: "",
      debitColumn: "",
      creditColumn: "",
      accountColumn: "",
      destinationAccountColumn: "",
      categoryColumn: "",
      tagsColumn: "",
      descriptionColumn: "Merchant",
      notesColumn: "",
      defaultType: "expense",
      defaultAccountId: "checking"
    });
    const preview = previewTransactionImportCsv(normalizedCsv, refs);

    expect(preview.validCount).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      type: "expense",
      amountMinor: 450,
      sourceAccountId: "checking",
      description: "Cafe"
    });
  });

  it("normalizes separate debit and credit columns into expense and income rows", () => {
    const normalizedCsv = applyTransactionImportMapping(
      [
        "Date,Description,Debit,Credit",
        "2026-07-01,Groceries,45.20,",
        "2026-07-02,Paycheck,,2500.00"
      ].join("\n"),
      {
        dateColumn: "Date",
        typeColumn: "",
        amountColumn: "",
        amountMinorColumn: "",
        debitColumn: "Debit",
        creditColumn: "Credit",
        accountColumn: "",
        destinationAccountColumn: "",
        categoryColumn: "",
        tagsColumn: "",
        descriptionColumn: "Description",
        notesColumn: "",
        defaultType: "",
        defaultAccountId: "checking"
      }
    );
    const preview = previewTransactionImportCsv(normalizedCsv, refs);

    expect(preview.validCount).toBe(2);
    expect(preview.rows.map((row) => row.type)).toEqual(["expense", "income"]);
    expect(preview.rows.map((row) => row.amountMinor)).toEqual([4520, 250000]);
  });

  it("rejects mapped rows with both debit and credit values", () => {
    expect(() =>
      applyTransactionImportMapping("Date,Description,Debit,Credit\n2026-07-01,Ambiguous,45.20,50.00\n", {
        dateColumn: "Date",
        typeColumn: "",
        amountColumn: "",
        amountMinorColumn: "",
        debitColumn: "Debit",
        creditColumn: "Credit",
        accountColumn: "",
        destinationAccountColumn: "",
        categoryColumn: "",
        tagsColumn: "",
        descriptionColumn: "Description",
        notesColumn: "",
        defaultType: "",
        defaultAccountId: "checking"
      })
    ).toThrow("Rows cannot have both debit and credit values.");
  });

  it("applies matching rules to uncategorized expense rows", () => {
    const preview = previewTransactionImportCsv(
      [
        "date,type,amount,account,destination_account,category,tags,description,notes",
        "2026-07-01,expense,45.20,Checking,,,,Corner Grocery,"
      ].join("\n"),
      { ...refs, rules: [groceryRule] }
    );

    expect(preview.rows[0].categoryId).toBe("food");
    expect(preview.rows[0].categoryName).toBe("Food");
    expect(preview.rows[0].appliedRuleName).toBe("Grocery stores");
    expect(preview.rows[0].warnings).toContain("Rule applied: Grocery stores.");
  });

  it("applies the first matching rule in supplied priority order", () => {
    const preview = previewTransactionImportCsv(
      [
        "date,type,amount,account,destination_account,category,tags,description,notes",
        "2026-07-01,expense,45.20,Checking,,,,Corner Grocery,"
      ].join("\n"),
      {
        ...refs,
        categories: [
          ...refs.categories,
          { id: "other", name: "Other", type: "both" as const }
        ],
        rules: [
          {
            id: "rule-corner",
            name: "Corner stores",
            matchText: "corner",
            categoryId: "other",
            category: { id: "other", name: "Other", type: "both" as const },
            tags: []
          },
          groceryRule
        ]
      }
    );

    expect(preview.rows[0].categoryId).toBe("other");
    expect(preview.rows[0].appliedRuleName).toBe("Corner stores");
  });

  it("does not override mapped categories with rules", () => {
    const preview = previewTransactionImportCsv(
      [
        "date,type,amount,account,destination_account,category,tags,description,notes",
        "2026-07-01,expense,45.20,Checking,,Food,,Corner Grocery,"
      ].join("\n"),
      { ...refs, rules: [groceryRule] }
    );

    expect(preview.rows[0].categoryId).toBe("food");
    expect(preview.rows[0].appliedRuleName).toBe("Grocery stores");
    expect(preview.rows[0].warnings).toContain("Rule applied: Grocery stores.");
    expect(preview.rows[0].tagIds).toEqual(["recurring"]);
  });

  it("does not apply expense rules to income rows", () => {
    const preview = previewTransactionImportCsv(
      [
        "date,type,amount,account,destination_account,category,tags,description,notes",
        "2026-07-01,income,45.20,Checking,,,,Corner Grocery,"
      ].join("\n"),
      { ...refs, rules: [groceryRule] }
    );

    expect(preview.rows[0].categoryId).toBeNull();
    expect(preview.rows[0].appliedRuleName).toBeNull();
  });

  it("rejects non-canonical minor-unit values with row and column context", () => {
    for (const value of ["123oops", "1.5", "1e3", "9007199254740992", "+123"]) {
      const preview = previewTransactionImportCsv(
        ["date,type,amount_minor,account", `2026-07-01,expense,${value},Checking`].join("\n"),
        refs
      );

      expect(preview.rows[0].errors[0]).toContain("Row 2, column amount_minor");
    }
  });
});
