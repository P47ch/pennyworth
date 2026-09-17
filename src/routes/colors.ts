const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export function parseHexColor(value: string, fallback = "#2563eb"): string {
  const color = value.trim();

  if (!color) {
    return fallback;
  }

  if (!hexColorPattern.test(color)) {
    throw new Error("Choose a valid color.");
  }

  return color.toLowerCase();
}
