import { describe, expect, it } from "vitest";
import { createRuleMatcher, encodeLegacyRuleMatchText, matchRuleForText, parseRuleMatchText, validateBackupRuleMatchText, validateRuleMatchText } from "../src/lib/ruleMatching.js";

describe("rule text matching", () => {
  it("matches any comma-separated alternative without splitting phrases", () => {
    const rule = { matchText: "lidl, ALDI, amazon prime" };
    for (const description of ["Shopping at LIDL", "aldi store", "AMAZON PRIME renewal"]) {
      expect(matchRuleForText({ description }, [rule])).toBe(rule);
    }
    expect(matchRuleForText({ description: "amazon purchase" }, [rule])).toBeNull();
  });

  it("searches notes and handles missing or unrelated text", () => {
    const rule = { matchText: "grocery" };
    expect(matchRuleForText({ description: null, notes: "Weekly GROCERY shopping" }, [rule])).toBe(rule);
    expect(matchRuleForText({ description: null, notes: null }, [rule])).toBeNull();
    expect(matchRuleForText({ description: "fuel" }, [rule])).toBeNull();
  });

  it("uses substring matching and selects the first active rule in supplied order", () => {
    const inactive = { matchText: "shop", isActive: false };
    const first = { matchText: "shopping" };
    const second = { matchText: "shop" };
    expect(matchRuleForText({ description: "Shopping" }, [inactive, first, second])).toBe(first);
  });

  it("ignores whitespace, empty alternatives, and duplicate terms", () => {
    expect(parseRuleMatchText(" , Lidl, aldi , LIDL, , ")).toEqual(["Lidl", "aldi"]);
    expect(validateRuleMatchText(" , Lidl, aldi , LIDL, , ")).toBe("Lidl, aldi");
    for (const value of ["", "  ", ",,", '"", ,']) {
      expect(() => validateRuleMatchText(value)).toThrow("Enter at least one");
      expect(matchRuleForText({ description: "anything" }, [{ matchText: value }])).toBeNull();
    }
  });

  it("supports quoted literal commas and doubled quotes", () => {
    const text = '  "Smith, Inc", "The ""Corner"" Shop"  ';
    expect(parseRuleMatchText(text)).toEqual(["Smith, Inc", 'The "Corner" Shop']);
    expect(validateRuleMatchText(text)).toBe('"Smith, Inc", "The ""Corner"" Shop"');
    expect(matchRuleForText({ description: "Smith" }, [{ matchText: text }])).toBeNull();
    expect(matchRuleForText({ description: "Paid Smith, Inc today" }, [{ matchText: text }])).not.toBeNull();
  });

  it("rejects malformed quoted phrases", () => {
    for (const value of ['"', '"unclosed', 'Smith "Inc"', '"closed"extra', '"closed""']) {
      expect(() => validateRuleMatchText(value)).toThrow();
      expect(() => validateBackupRuleMatchText(value)).toThrow();
    }
  });

  it("allows inert whitespace literals in backups while requiring terms in rule forms", () => {
    for (const literal of ["   ", "\t", "\r\n", " \n\t ", "\u00a0\n"]) {
      for (const matchText of [literal, encodeLegacyRuleMatchText(literal)]) {
        expect(() => validateBackupRuleMatchText(matchText)).not.toThrow();
        expect(() => validateRuleMatchText(matchText)).toThrow("Enter at least one");
        expect(matchRuleForText({ description: "Anything", notes: literal }, [{ matchText }])).toBeNull();
      }
    }
    expect(() => validateBackupRuleMatchText('", ,"')).not.toThrow();
    for (const matchText of [", ,", '"", ,']) {
      expect(() => validateBackupRuleMatchText(matchText)).toThrow("Enter at least one");
    }
  });

  it("prepares each active rule once and reuses terms in priority order across a batch", () => {
    let matchTextReads = 0;
    const inactive = { matchText: '"unclosed', isActive: false };
    const first = { get matchText() { matchTextReads += 1; return 'ALDI, "Smith, Inc"'; } };
    const second = { get matchText() { matchTextReads += 1; return "smith, grocery"; } };
    const matchRule = createRuleMatcher([inactive, first, second]);
    for (let index = 0; index < 100; index += 1) {
      expect(matchRule({ notes: "Paid Aldi" })).toBe(first);
      expect(matchRule({ description: "Smith, Inc" })).toBe(first);
      expect(matchRule({ description: "Smith" })).toBe(second);
      expect(matchRule({ description: "Unrelated" })).toBeNull();
    }
    expect(matchTextReads).toBe(2);
  });

  it("preserves historical literal matching, including commas, quotes, and line breaks", () => {
    for (const literal of ["grocery", "Smith, Inc", 'Smith "Inc"', ",,", "line\nbreak", "grocery, rent, spotify"]) {
      const upgraded = encodeLegacyRuleMatchText(literal);
      expect(parseRuleMatchText(upgraded)).toEqual([literal]);
      expect(matchRuleForText({ description: literal }, [{ matchText: upgraded }])).not.toBeNull();
    }
    expect(matchRuleForText({ description: "grocery" }, [{ matchText: encodeLegacyRuleMatchText("grocery, rent") }])).toBeNull();
  });
});
