import { describe, expect, it } from "vitest";
import ejs from "ejs";
import { createTranslator } from "../src/lib/i18n.js";
import { localizeEjsTemplate } from "../src/lib/localizedEjs.js";
import { menuItemIds, normalizeUserPreferences, themes } from "../src/lib/preferences.js";

describe("user preferences", () => {
  it("keeps supported values and removes duplicate hidden menu IDs", () => {
    expect(
      normalizeUserPreferences({
        language: "it",
        theme: "dark",
        avatarKey: "initials",
        hiddenMenuItems: ["budgets", "budgets", "unknown"]
      })
    ).toEqual({
      language: "it",
      theme: "dark",
      avatarKey: "initials",
      hiddenMenuItems: ["budgets"]
    });
  });

  it("falls back for unsupported values", () => {
    expect(normalizeUserPreferences({ language: "fr", theme: "unknown" })).toEqual({
      language: "en",
      theme: "light",
      avatarKey: "initials",
      hiddenMenuItems: []
    });
  });

  it("keeps a supported built-in avatar", () => {
    expect(normalizeUserPreferences({ avatarKey: "operator" }).avatarKey).toBe("operator");
  });

  it("exposes unique stable menu IDs", () => {
    expect(new Set(menuItemIds).size).toBe(menuItemIds.length);
    expect(menuItemIds).toContain("transactions");
  });

  it("offers only the light and dark appearances", () => {
    expect(themes.map((theme) => theme.id)).toEqual(["light", "dark"]);
  });
});

describe("localization", () => {
  it("translates Italian messages and falls back to the source message", () => {
    const t = createTranslator("it");

    expect(t("Transactions")).toBe("Transazioni");
    expect(t("User-defined value")).toBe("User-defined value");
  });

  it("adds translation calls only to static template content", () => {
    const localized = localizeEjsTemplate(
      '<h1 title="Accounts">Accounts</h1><p><%= userDefinedName %></p><td data-label="Amount"><%= amount %></td>'
    );

    expect(localized).toContain('title="<%= t("Accounts") %>"');
    expect(localized).toContain('><%= t("Accounts") %><');
    expect(localized).toContain('data-label="<%= t("Amount") %>"');
    expect(localized).toContain("<%= userDefinedName %>");
    expect(localized).not.toContain('t("userDefinedName")');

    const html = ejs.compile(localized)({
      t: createTranslator("it"),
      userDefinedName: "Accounts",
      amount: "12.00"
    });
    expect(html).toContain('<h1 title="Conti">Conti</h1>');
    expect(html).toContain("<p>Accounts</p>");
    expect(html).toContain('<td data-label="Importo">12.00</td>');
  });
});
