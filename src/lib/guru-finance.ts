import type { Tables } from "../integrations/supabase/types";

export type GuruTransaction = Pick<
  Tables<"transactions">,
  "id" | "amount" | "type" | "category" | "note" | "date"
>;
export type GuruDebt = Pick<
  Tables<"debts">,
  "id" | "kind" | "title" | "principal" | "monthly" | "due_date" | "interest_rate" | "created_at"
>;
export type GuruEntry = Pick<
  Tables<"debt_entries">,
  "id" | "debt_id" | "amount" | "given_at" | "note"
>;
export type GuruPayment = Pick<
  Tables<"debt_payments">,
  "id" | "debt_id" | "amount" | "paid_at" | "note"
>;
export type GuruSettings = Pick<
  Tables<"user_settings">,
  "monthly_income" | "monthly_budget" | "savings_target" | "fixed_expenses" | "currency"
>;

export type GuruFinanceRows = {
  profile: { full_name: string | null; language: string; currency: string } | null;
  settings: GuruSettings | null;
  transactions: GuruTransaction[];
  debts: GuruDebt[];
  entries: GuruEntry[];
  payments: GuruPayment[];
};

const round = (n: number) => Math.round(n * 100) / 100;
const number = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const short = (v: string | null) => (v ?? "").replace(/\p{Cc}/gu, " ").slice(0, 120);
const indiaDate = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);

/** No browser totals, timezone ambiguity, invented salary dates or double-counted ledger principal. */
export function buildGuruFinance(rows: GuruFinanceRows, now = new Date()) {
  const stamp = now.getTime();
  const today = indiaDate(stamp);
  const month = today.slice(0, 7);
  const year = Number(today.slice(0, 4));
  const monthNum = Number(today.slice(5, 7));
  const previousMonth = new Date(Date.UTC(year, monthNum - 2, 15)).toISOString().slice(0, 7);
  const daysLeft = new Date(Date.UTC(year, monthNum, 0)).getUTCDate() - Number(today.slice(8)) + 1;
  const sums = { income: 0, expense: 0 };
  const current = { income: 0, expense: 0 };
  const previous = { income: 0, expense: 0 };
  const last30 = { income: 0, expense: 0 };
  const categories = new Map<string, number>();
  const past = rows.transactions
    .filter((t) => Number.isFinite(Date.parse(t.date)) && Date.parse(t.date) <= stamp)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  for (const t of past) {
    if (t.type !== "income" && t.type !== "expense") continue;
    const amount = Math.max(0, number(t.amount));
    sums[t.type] += amount;
    const key = indiaDate(Date.parse(t.date)).slice(0, 7);
    if (key === month) {
      current[t.type] += amount;
      if (t.type === "expense")
        categories.set(t.category, (categories.get(t.category) ?? 0) + amount);
    }
    if (key === previousMonth) previous[t.type] += amount;
    if (Date.parse(t.date) >= stamp - 30 * 86400000) last30[t.type] += amount;
  }
  const finish = (v: typeof sums) => ({
    income: round(v.income),
    expense: round(v.expense),
    net: round(v.income - v.expense),
    savingsRatePercent: v.income > 0 ? round((100 * (v.income - v.expense)) / v.income) : null,
  });
  const settings = rows.settings;
  const incomeBasis =
    number(settings?.monthly_income) > 0 ? number(settings?.monthly_income) : current.income;
  const savingsTarget = Math.max(0, number(settings?.savings_target));
  const fixedExpenses = Math.max(0, number(settings?.fixed_expenses));
  const explicitBudget = number(settings?.monthly_budget) > 0;
  const budget = explicitBudget
    ? number(settings?.monthly_budget)
    : Math.max(0, incomeBasis - savingsTarget - fixedExpenses);
  const hasBudgetData = explicitBudget || incomeBasis > 0;
  const available = Math.max(0, budget - current.expense);
  const entriesByDebt = new Map<string, GuruEntry[]>();
  const paymentsByDebt = new Map<string, GuruPayment[]>();
  for (const entry of rows.entries) {
    const list = entriesByDebt.get(entry.debt_id) ?? [];
    list.push(entry);
    entriesByDebt.set(entry.debt_id, list);
  }
  for (const payment of rows.payments) {
    if (Date.parse(payment.paid_at) > stamp || !Number.isFinite(Date.parse(payment.paid_at)))
      continue;
    const list = paymentsByDebt.get(payment.debt_id) ?? [];
    list.push(payment);
    paymentsByDebt.set(payment.debt_id, list);
  }
  let totalLent = 0,
    totalOwe = 0,
    totalEmi = 0;
  const debts = rows.debts
    .filter((d) => Date.parse(d.created_at) <= stamp)
    .map((d) => {
      const allEntries = entriesByDebt.get(d.id) ?? [];
      const entries = allEntries
        .filter((e) => Date.parse(e.given_at) <= stamp)
        .sort((a, b) => Date.parse(b.given_at) - Date.parse(a.given_at));
      const payments = (paymentsByDebt.get(d.id) ?? []).sort(
        (a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at),
      );
      const principal = allEntries.length
        ? entries.reduce((n, e) => n + number(e.amount), 0)
        : number(d.principal);
      const paid = payments.reduce((n, p) => n + number(p.amount), 0);
      // Same simple-interest convention as the existing debt cards (30-day month).
      const interest = Math.max(
        0,
        Math.round(
          ((principal * number(d.interest_rate)) / 100) *
            Math.max(0, (stamp - Date.parse(d.created_at)) / (30 * 86400000)),
        ),
      );
      const outstanding = Math.max(0, principal + interest - paid);
      if (d.kind === "udhari_given") totalLent += outstanding;
      else if (d.kind === "emi") totalEmi += outstanding;
      else if (d.kind === "udhari_taken") totalOwe += outstanding;
      return {
        name: short(d.title),
        kind: d.kind,
        principal: round(principal),
        paid: round(paid),
        interestEstimate: interest,
        outstanding: round(outstanding),
        overpaid: round(Math.max(0, paid - principal - interest)),
        monthlyInstallment: d.monthly,
        dueDate: d.due_date,
        overdue: Boolean(d.due_date && d.due_date < today && outstanding > 0),
        entryCount: entries.length,
        paymentCount: payments.length,
        recentEntries: entries
          .slice(0, 3)
          .map((e) => ({ date: e.given_at, amount: number(e.amount), note: short(e.note) })),
        recentPayments: payments
          .slice(0, 3)
          .map((p) => ({ date: p.paid_at, amount: number(p.amount), note: short(p.note) })),
      };
    });
  return {
    asOf: now.toISOString(),
    timezone: "Asia/Kolkata",
    name: short(rows.profile?.full_name ?? null),
    currency: settings?.currency ?? rows.profile?.currency ?? "INR",
    balance: {
      recordedNet: round(sums.income - sums.expense),
      basis:
        "Net of recorded income minus expenses; not a verified bank balance. Udhari is tracked separately.",
    },
    allTime: finish(sums),
    thisMonth: { month, ...finish(current) },
    previousMonth: { month: previousMonth, ...finish(previous) },
    last30Days: finish(last30),
    transactionCount: past.length,
    categoryTotalsThisMonth: [...categories]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([category, amount]) => ({ category: short(category), amount: round(amount) })),
    categoryDetailsLimited: categories.size > 20,
    safeToSpend: hasBudgetData
      ? {
          budget: round(budget),
          spent: round(current.expense),
          available: round(available),
          daysLeft,
          perDay: Math.floor(available / daysLeft),
          basis: explicitBudget
            ? "Configured monthly budget minus all recorded month spending."
            : "Configured/recorded monthly income minus savings target and fixed bills, minus all recorded month spending.",
          caution:
            "Planning estimate, not bank cash. Fixed bills may overlap recorded expenses; review settings. Next salary date is not stored.",
        }
      : null,
    moneySettings: settings
      ? {
          monthlyIncome: settings.monthly_income,
          monthlyBudget: settings.monthly_budget,
          savingsTarget,
          fixedExpenses,
        }
      : null,
    recentTransactions: past.slice(0, 20).map((t) => ({
      date: t.date,
      type: t.type,
      amount: number(t.amount),
      category: short(t.category),
      note: short(t.note),
    })),
    udhari: {
      toReceive: round(totalLent),
      toPay: round(totalOwe),
      emiOutstanding: round(totalEmi),
      totalPayable: round(totalOwe + totalEmi),
      count: debts.length,
      entries: debts.sort((a, b) => b.outstanding - a.outstanding).slice(0, 30),
      detailsLimited: debts.length > 30,
    },
    coverage:
      "Totals use all loaded records up to asOf. Details are limited to 20 largest monthly categories, 20 recent transactions and 30 debts with 3 recent entries/payments each. Missing names/dates/history must not be invented.",
  };
}
