import { categoryTotals, safeToSpend, sumTotals } from "./money";
import type { Transaction } from "./types";

export interface GuruDebtRow {
  id: string;
  kind: string;
  title: string;
  principal: number;
  monthly: number | null;
  dueDate: string | null;
  entries: number[];
  payments: number[];
}

export interface GuruMoneySettings {
  monthlyIncome: number | null;
  monthlyBudget: number | null;
  savingsTarget: number | null;
  fixedExpenses: number | null;
}

export interface GuruFinanceContext {
  totals: { income: number; expense: number; balance: number };
  month: { income: number; expense: number; balance: number };
  safeToSpend: { available: number; perDay: number; daysLeft: number; basis: string };
  categories: Array<{ category: string; amount: number }>;
  recentTransactions: Array<Pick<Transaction, "type" | "amount" | "category" | "note" | "date">>;
  udhari: { given: number; taken: number };
  emis: Array<{ title: string; outstanding: number; monthly: number; dueDate: string | null }>;
}

const outstanding = (debt: GuruDebtRow) => {
  const principal = debt.entries.length > 0
    ? debt.entries.reduce((sum, amount) => sum + amount, 0)
    : debt.principal;
  return Math.max(0, principal - debt.payments.reduce((sum, amount) => sum + amount, 0));
};

export function buildGuruFinanceContext(
  transactions: Transaction[],
  debts: GuruDebtRow[],
  settings: GuruMoneySettings,
  now = new Date(),
): GuruFinanceContext {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthTxs = transactions.filter((tx) => new Date(tx.date).getTime() >= monthStart);
  const all = sumTotals(transactions);
  const month = sumTotals(monthTxs);
  const safe = safeToSpend(monthTxs, settings, now);
  let given = 0;
  let taken = 0;
  const emis: GuruFinanceContext["emis"] = [];

  for (const debt of debts) {
    const balance = outstanding(debt);
    if (debt.kind === "udhari_given") given += balance;
    if (debt.kind === "udhari_taken") taken += balance;
    if (debt.kind === "emi") {
      emis.push({
        title: debt.title,
        outstanding: balance,
        monthly: debt.monthly ?? 0,
        dueDate: debt.dueDate,
      });
    }
  }

  return {
    totals: { income: all.income, expense: all.expense, balance: all.net },
    month: { income: month.income, expense: month.expense, balance: month.net },
    safeToSpend: {
      available: safe.available,
      perDay: safe.perDay,
      daysLeft: safe.daysLeft,
      basis: safe.basis,
    },
    categories: categoryTotals(monthTxs).slice(0, 8).map(({ category, amount }) => ({ category, amount })),
    recentTransactions: [...transactions]
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 30)
      .map(({ type, amount, category, note, date }) => ({ type, amount, category, note, date })),
    udhari: { given, taken },
    emis,
  };
}