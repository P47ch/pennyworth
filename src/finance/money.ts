export const minimumMoneyMinor = -2_147_483_648;
export const maximumMoneyMinor = 2_147_483_647;

export function parseMoneyToMinorUnits(input: string): number {
  const normalized = input.trim().replace(",", ".");

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter a valid amount with up to two decimal places.");
  }

  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace("-", "");
  const [whole, fraction = ""] = unsigned.split(".");
  const minor = Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0"), 10);

  const signedMinor = sign * minor;

  if (!Number.isSafeInteger(signedMinor) || signedMinor < minimumMoneyMinor || signedMinor > maximumMoneyMinor) {
    throw new Error("Amount is outside the supported range.");
  }

  return signedMinor;
}

export type MoneyFormatter = (amountMinor: number | bigint, currency?: string) => string;

export function formatMoneyFromMinorUnits(amountMinor: number | bigint, currency: string): string {
  const numericAmount = typeof amountMinor === "bigint" ? Number(amountMinor) : amountMinor;

  if (!Number.isSafeInteger(numericAmount)) {
    throw new Error("Money value exceeds the safe integer range for display.");
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(numericAmount / 100);
}

export function createMoneyFormatter(primaryCurrency: string): MoneyFormatter {
  return (amountMinor, currency = primaryCurrency) => formatMoneyFromMinorUnits(amountMinor, currency);
}
