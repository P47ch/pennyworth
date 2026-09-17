export function safeBigIntToNumber(value: bigint, label: string): number {
  const result = Number(value);

  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }

  return result;
}
