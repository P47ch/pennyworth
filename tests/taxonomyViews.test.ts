import { readFileSync } from "node:fs";
import ejs from "ejs";
import { describe, expect, it } from "vitest";
import {
  categoryIconOptions,
  renderCategoryIcon,
  renderCategoryLabel,
  renderColorSwatch,
  renderIcon
} from "../src/lib/icons.js";
import { createTranslator } from "../src/lib/i18n.js";
import { localizeEjsTemplate } from "../src/lib/localizedEjs.js";

function compileView(path: string) {
  return ejs.compile(localizeEjsTemplate(readFileSync(new URL(path, import.meta.url), "utf8")));
}

const renderCategories = compileView("../src/views/categories/index.ejs");
const renderTags = compileView("../src/views/tags/index.ejs");
const renderTransactions = compileView("../src/views/transactions/index.ejs");
const sharedLocals = {
  csrfToken: "test-token",
  error: null,
  t: createTranslator("en"),
  icon: renderIcon,
  categoryIcon: renderCategoryIcon,
  categoryLabel: renderCategoryLabel,
  colorSwatch: renderColorSwatch,
  primaryCurrency: "EUR"
};

describe("taxonomy list views", () => {
  it("shows a real colored category icon without raw color and icon columns", () => {
    const html = renderCategories({
      ...sharedLocals,
      categoryIconOptions,
      categoryTypes: ["income", "expense", "both"],
      categories: [
        {
          id: "category-1",
          name: "Food",
          type: "expense",
          parent: null,
          color: "#d97706",
          icon: "food"
        }
      ]
    });

    expect(html).toContain('class="icon icon-food"');
    expect(html).toContain('stroke="#d97706"');
    expect(html).not.toContain("<th>Color</th>");
    expect(html).not.toContain("<th>Icon</th>");
    expect(html).toContain('type="radio" name="icon"');
  });

  it("shows tag colors as compact visual swatches", () => {
    const html = renderTags({
      ...sharedLocals,
      tags: [{ id: "tag-1", name: "recurring", color: "#2563eb" }]
    });

    expect(html).toContain('class="color-swatch"');
    expect(html).toContain('fill="#2563eb"');
    expect(html).not.toContain("<th>Color</th>");
  });

  it("shows the category icon and color in transaction rows", () => {
    const category = { id: "category-1", name: "Food", type: "expense", color: "#d97706", icon: "food" };
    const html = renderTransactions({
      ...sharedLocals,
      transactionTypes: ["income", "expense", "transfer"],
      accounts: [{ id: "account-1", name: "Main bank" }],
      categories: [category],
      tags: [],
      form: {
        type: "expense",
        date: "2026-09-04",
        amount: "",
        sourceAccountId: "",
        destinationAccountId: "",
        categoryId: "",
        description: "",
        tagIds: [],
        notes: ""
      },
      filters: {
        typeValue: "",
        accountIdValue: "",
        categoryIdValue: "",
        tagIdValue: "",
        fromValue: "",
        toValue: "",
        searchValue: ""
      },
      pagination: {
        totalCount: 1,
        page: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      },
      transactions: [
        {
          id: "transaction-1",
          date: new Date("2026-09-04T00:00:00.000Z"),
          type: "expense",
          description: "Lunch",
          amountMinor: 1250,
          sourceAccount: { name: "Main bank" },
          destinationAccount: null,
          category,
          tags: []
        }
      ],
      formatMoney: (amountMinor: number) => `EUR ${amountMinor}`
    });

    expect(html).toContain('data-label="Category"');
    expect(html).toContain('class="icon icon-food"');
    expect(html).toContain('stroke="#d97706"');
  });
});
