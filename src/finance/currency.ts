export function assertPrimaryCurrency(currency: string, primaryCurrency: string, recordType: string): void {
  if (currency !== primaryCurrency) {
    throw new Error(
      `Only ${primaryCurrency} ${recordType} are supported until multi-currency conversion is implemented.`
    );
  }
}

export function assertSingleCurrency(
  records: ReadonlyArray<{ currency: string }>,
  primaryCurrency: string,
  recordType: string
): void {
  for (const record of records) {
    assertPrimaryCurrency(record.currency, primaryCurrency, recordType);
  }
}
