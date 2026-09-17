import { describe, expect, it } from "vitest";
import {
  parseCategoryIcon,
  renderCategoryIcon,
  renderCategoryLabel,
  renderColorSwatch,
  renderIcon
} from "../src/lib/icons.js";

describe("icon rendering", () => {
  it("renders an approved Lucide icon with shared accessibility attributes", () => {
    const svg = renderIcon("dashboard");

    expect(svg).toContain("<svg");
    expect(svg).toContain('class="icon icon-dashboard"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
  });

  it("uses a fixed fallback class for unknown icon names", () => {
    const svg = renderIcon('unknown"><script>');

    expect(svg).toContain('class="icon icon-fallback"');
    expect(svg).not.toContain("<script>");
  });

  it("renders approved category icons in their saved color", () => {
    const svg = renderIcon("food", "#D97706");

    expect(svg).toContain('class="icon icon-food"');
    expect(svg).toContain('stroke="#d97706"');
  });

  it("uses the fallback for legacy values outside the category catalog", () => {
    const svg = renderCategoryIcon("dashboard", "#2563eb");

    expect(svg).toContain('class="icon icon-fallback"');
    expect(svg).toContain('stroke="#2563eb"');
  });

  it("does not interpolate invalid colors into icon markup", () => {
    const svg = renderIcon("food", '#fff\"><script>alert(1)</script>');

    expect(svg).toContain('stroke="currentColor"');
    expect(svg).not.toContain("<script>");
  });

  it("accepts only icons exposed by the category picker", () => {
    expect(parseCategoryIcon(" food ")).toBe("food");
    expect(parseCategoryIcon(" ")).toBe("");
    expect(() => parseCategoryIcon("made-up-icon")).toThrow("Choose a valid icon.");
  });

  it("renders color swatches only for valid hex values", () => {
    expect(renderColorSwatch("#ABC123")).toContain('fill="#abc123"');
    expect(renderColorSwatch('red\"><script>')).toBe("");
  });

  it("renders safe reusable category labels", () => {
    const html = renderCategoryLabel({ name: "Food & <script>", icon: "food", color: "#d97706" });

    expect(html).toContain('class="category-reference"');
    expect(html).toContain('class="icon icon-food"');
    expect(html).toContain("Food &amp; &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(renderCategoryLabel(null)).toBe("-");
  });
});
