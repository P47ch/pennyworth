import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import { describe, expect, it } from "vitest";
import { createTranslator } from "../src/lib/i18n.js";
import { renderCategoryLabel, renderColorSwatch, renderIcon } from "../src/lib/icons.js";
import { localizeEjsTemplate } from "../src/lib/localizedEjs.js";
import { validateRuleMatchText } from "../src/lib/ruleMatching.js";

const shared = {
  csrfToken: "test-token", error: null, rules: [], categories: [], tags: [],
  icon: renderIcon, categoryLabel: renderCategoryLabel, colorSwatch: renderColorSwatch,
  form: { name: "", matchText: "", categoryId: "", tagIds: [], isActive: true }
};

describe("rules views", () => {
  for (const language of ["en", "it"] as const) {
    for (const view of ["index", "edit"] as const) {
      it(`renders the ${language} ${view} help control and matching guidance`, () => {
        const filename = fileURLToPath(new URL(`../src/views/rules/${view}.ejs`, import.meta.url));
        const html = ejs.render(localizeEjsTemplate(readFileSync(filename, "utf8")), {
          ...shared, t: createTranslator(language),
          rule: { id: "rule-1", name: "Supermarkets", matchText: "lidl, aldi", categoryId: "", tags: [], isActive: true }
        }, { filename });
        expect(html).toContain('class="icon icon-help"');
        expect(html).toContain(`aria-label="${language === "it" ? "Come funzionano le regole" : "How rules work"}"`);
        expect(html).toContain('aria-describedby="rule-match-hint"');
        expect(html).toContain(language === "it" ? "Separa le alternative con virgole." : "Separate alternatives with commas.");
        expect(html).toContain(language === "it" ? "Le regole attive categorizzano" : "Active rules automatically categorize");
      });

      it.each([
        [", ,", "Enter at least one matching word or phrase.", "Inserisci almeno una parola o frase da cercare."],
        ['Smith "Inc"', "Quote the whole phrase and double any quotes inside it.", "Racchiudi l'intera frase tra virgolette e raddoppia quelle al suo interno."],
        ['"closed"extra', "Separate quoted phrases with commas.", "Separa le frasi tra virgolette con virgole."],
        ['"unclosed', "Match text contains an unclosed quoted phrase.", "Il testo da cercare contiene una frase con virgolette non chiuse."]
      ])(`renders ${language} validation errors in ${view} for %s`, (matchText, english, italian) => {
        let message = "";
        try {
          validateRuleMatchText(matchText);
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          message = error.message;
        }
        expect(message).toBe(english);

        const filename = fileURLToPath(new URL(`../src/views/rules/${view}.ejs`, import.meta.url));
        const html = ejs.render(localizeEjsTemplate(readFileSync(filename, "utf8")), {
          ...shared, t: createTranslator(language), error: message,
          form: { ...shared.form, matchText },
          rule: { id: "rule-1", name: "Supermarkets", matchText, categoryId: "", tags: [], isActive: true }
        }, { filename });
        const renderedError = html.match(/<p class="error">([^<]*)<\/p>/)?.[1];
        expect(renderedError).toBe(ejs.escapeXML(language === "it" ? italian : english));
      });
    }
  }
});
