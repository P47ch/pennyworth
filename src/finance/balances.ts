export type BalanceTransaction = {
  type: "income" | "expense" | "transfer";
  amountMinor: number;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
};

export type InvestmentCashTransaction = {
  type: "buy" | "sell" | "dividend" | "interest" | "fee";
  accountId: string;
  cashAccountId: string | null;
  cashAmountMinor: number;
};

export type AccountOpeningBalance = {
  id: string;
  openingBalanceMinor: number;
};

export function calculateAccountBalances(
  accounts: AccountOpeningBalance[],
  transactions: BalanceTransaction[],
  investmentTransactions: InvestmentCashTransaction[] = []
): Map<string, number> {
  const balances = new Map(accounts.map((account) => [account.id, account.openingBalanceMinor]));

  for (const transaction of transactions) {
    if (transaction.type === "income" && transaction.sourceAccountId) {
      balances.set(transaction.sourceAccountId, (balances.get(transaction.sourceAccountId) ?? 0) + transaction.amountMinor);
    }

    if (transaction.type === "expense" && transaction.sourceAccountId) {
      balances.set(transaction.sourceAccountId, (balances.get(transaction.sourceAccountId) ?? 0) - transaction.amountMinor);
    }

    if (transaction.type === "transfer" && transaction.sourceAccountId && transaction.destinationAccountId) {
      balances.set(transaction.sourceAccountId, (balances.get(transaction.sourceAccountId) ?? 0) - transaction.amountMinor);
      balances.set(
        transaction.destinationAccountId,
        (balances.get(transaction.destinationAccountId) ?? 0) + transaction.amountMinor
      );
    }
  }

  for (const transaction of investmentTransactions) {
    const cashAccountId = transaction.cashAccountId ?? transaction.accountId;

    if (transaction.type === "buy" || transaction.type === "fee") {
      balances.set(cashAccountId, (balances.get(cashAccountId) ?? 0) - transaction.cashAmountMinor);
    }

    if (transaction.type === "sell" || transaction.type === "dividend" || transaction.type === "interest") {
      balances.set(cashAccountId, (balances.get(cashAccountId) ?? 0) + transaction.cashAmountMinor);
    }
  }

  return balances;
}
