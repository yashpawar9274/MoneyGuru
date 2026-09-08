/**
 * The single source of truth for every money calculation in MoneyGuruAI.
 * Everything here is pure so it can be unit-tested and reused by the UI,
 * the receipts and the Guru AI context builder.
 */
import type { Category, Transaction } from "./types";

export const inr = (n: number) =>
  "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN") .replace(/^/, n < 0 ? "-" : "");

export interface Totals {
  income: number;
  expense: number;
  net: number;
}

export function sumTotals(txs: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

/** Net of every transaction ever recorded — the user's available balance. */
export function availableBalance(txs: Transaction[]) {
  return sumTotals(txs).net;
}

export type Period = "today" | "week" | "month" | "all";

export function startOf(period: Period, ref = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  if (period === "today") return d;
  if (period === "week") {
    // Week starts Monday, the way Indian users read a week.
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }
  if (period === "month") {
    d.setDate(1);
    return d;
  }
  return new Date(0);
}

export function inPeriod(txs: Transaction[], period: Period, ref = new Date()) {
  if (period === "all") return txs;
  const from = +startOf(period, ref);
  return txs.filter((t) => +new Date(t.date) >= from);
}

export function between(txs: Transaction[], from: Date, to: Date) {
  const a = +from;
  const b = +to;
  return txs.filter((t) => {
    const at = +new Date(t.date);
    return at >= a && at <= b;
  });
}

export function lastMonthRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

export interface CategoryTotal {
  category: Category;
  amount: number;
  share: number;
}

export function categoryTotals(txs: Transaction[]): CategoryTotal[] {
  const map = new Map<Category, number>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    total += t.amount;
  }
  return [...map.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function topCategory(txs: Transaction[]): CategoryTotal | null {
  return categoryTotals(txs)[0] ?? null;
}

export function daysElapsedInMonth(ref = new Date()) {
  return ref.getDate();
}

export function daysInMonth(ref = new Date()) {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
}

export function daysLeftInMonth(ref = new Date()) {
  return Math.max(1, daysInMonth(ref) - daysElapsedInMonth(ref) + 1);
}

/** Average spend per elapsed day, so early-month numbers stay honest. */
export function dailyAverageSpend(txs: Transaction[], days: number) {
  if (days <= 0) return 0;
  return sumTotals(txs).expense / days;
}

export function savingsRate(t: Totals) {
  if (t.income <= 0) return 0;
  return Math.max(-1, Math.min(1, t.net / t.income));
}

/** Straight-line projection of month-end spending from the pace so far. */
export function projectedMonthSpend(monthTxs: Transaction[], ref = new Date()) {
  const elapsed = daysElapsedInMonth(ref);
  const spent = sumTotals(monthTxs).expense;
  if (elapsed <= 0) return spent;
  return Math.round((spent / elapsed) * daysInMonth(ref));
}

/* ------------------------------------------------------------------ udhari */

export interface LedgerLine {
  kind: "given" | "received";
  amount: number;
}

export interface LedgerTotals {
  given: number;
  received: number;
  /** What is still owed. Never negative, even if extra money came back. */
  outstanding: number;
  /** Money returned beyond what was lent, kept visible instead of hidden. */
  overpaid: number;
}

/**
 * The ledger is the only source of truth for a person's balance:
 * every "given" adds, every "received" subtracts.
 */
export function ledgerTotals(lines: LedgerLine[]): LedgerTotals {
  let given = 0;
  let received = 0;
  for (const line of lines) {
    const amount = Number.isFinite(line.amount) ? Math.abs(line.amount) : 0;
    if (line.kind === "given") given += amount;
    else received += amount;
  }
  const diff = given - received;
  return {
    given,
    received,
    outstanding: Math.max(0, diff),
    overpaid: Math.max(0, -diff),
  };
}

/* ----------------------------------------------------------- safe to spend */

export interface SafeToSpendSettings {
  monthlyIncome?: number | null;
  monthlyBudget?: number | null;
  savingsTarget?: number | null;
  fixedExpenses?: number | null;
}

export interface SafeToSpend {
  budget: number;
  spent: number;
  available: number;
  daysLeft: number;
  perDay: number;
  /** Plain-English explanation of the numbers above. */
  basis: string;
}

export function safeToSpend(
  monthTxs: Transaction[],
  settings: SafeToSpendSettings = {},
  ref = new Date(),
): SafeToSpend {
  const { income, expense } = sumTotals(monthTxs);
  const daysLeft = daysLeftInMonth(ref);

  let budget: number;
  let basis: string;

  if (settings.monthlyBudget && settings.monthlyBudget > 0) {
    budget = settings.monthlyBudget;
    basis = `Your monthly budget of ${inr(budget)}`;
  } else {
    const base = settings.monthlyIncome && settings.monthlyIncome > 0 ? settings.monthlyIncome : income;
    const savings = settings.savingsTarget ?? 0;
    const fixed = settings.fixedExpenses ?? 0;
    budget = Math.max(0, base - savings - fixed);
    basis =
      settings.monthlyIncome || savings || fixed
        ? `Income ${inr(base)} minus savings target ${inr(savings)} and fixed bills ${inr(fixed)}`
        : `Income recorded this month (${inr(base)})`;
  }

  const available = Math.max(0, budget - expense);
  return {
    budget,
    spent: expense,
    available,
    daysLeft,
    perDay: Math.floor(available / daysLeft),
    basis: `${basis}, minus ${inr(expense)} already spent, spread over ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`,
  };
}

/* ------------------------------------------------------------- money score */

export interface ScoreFactor {
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface MoneyScore {
  score: number;
  band: "Needs work" | "Okay" | "Good" | "Excellent";
  factors: ScoreFactor[];
}

export interface ScoreInput {
  monthTxs: Transaction[];
  lastMonthTxs?: Transaction[];
  monthlyBudget?: number | null;
  /** Money the user still owes others. */
  owed?: number;
}

export function moneyScore({
  monthTxs,
  lastMonthTxs = [],
  monthlyBudget,
  owed = 0,
}: ScoreInput): MoneyScore {
  const now = sumTotals(monthTxs);
  const prev = sumTotals(lastMonthTxs);
  const factors: ScoreFactor[] = [];

  // 1. Spending against income (30)
  const ratio = now.income > 0 ? now.expense / now.income : now.expense > 0 ? 1.2 : 0;
  const spendPoints = Math.round(30 * Math.max(0, Math.min(1, 1 - ratio / 1.1)));
  factors.push({
    label: "Spending vs income",
    points: spendPoints,
    max: 30,
    detail:
      now.income > 0
        ? `You spent ${Math.round(ratio * 100)}% of what you earned.`
        : "No income recorded this month yet.",
  });

  // 2. Savings rate (25)
  const rate = savingsRate(now);
  const savePoints = Math.round(25 * Math.max(0, Math.min(1, rate / 0.3)));
  factors.push({
    label: "Savings rate",
    points: savePoints,
    max: 25,
    detail: `You kept ${Math.round(rate * 100)}% of your income.`,
  });

  // 3. Budget adherence (20)
  let budgetPoints = 12;
  let budgetDetail = "No monthly budget set — set one to score full marks.";
  if (monthlyBudget && monthlyBudget > 0) {
    const used = now.expense / monthlyBudget;
    budgetPoints = Math.round(20 * Math.max(0, Math.min(1, 1.1 - used)));
    budgetDetail = `You've used ${Math.round(used * 100)}% of your ${inr(monthlyBudget)} budget.`;
  }
  factors.push({ label: "Budget adherence", points: budgetPoints, max: 20, detail: budgetDetail });

  // 4. Udhari / debt position (15)
  const debtRatio = now.income > 0 ? owed / now.income : owed > 0 ? 1 : 0;
  const debtPoints = Math.round(15 * Math.max(0, Math.min(1, 1 - debtRatio)));
  factors.push({
    label: "Udhari position",
    points: debtPoints,
    max: 15,
    detail: owed > 0 ? `You still owe ${inr(owed)}.` : "You owe nothing right now.",
  });

  // 5. Recent behaviour vs last month (10)
  let trendPoints = 6;
  let trendDetail = "Not enough history to compare with last month.";
  if (prev.expense > 0) {
    const change = (now.expense - prev.expense) / prev.expense;
    trendPoints = Math.round(10 * Math.max(0, Math.min(1, 0.5 - change + 0.5)));
    trendDetail =
      change <= 0
        ? `Spending is down ${Math.abs(Math.round(change * 100))}% from last month.`
        : `Spending is up ${Math.round(change * 100)}% from last month.`;
  }
  factors.push({ label: "Recent behaviour", points: trendPoints, max: 10, detail: trendDetail });

  const score = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)));
  const band: MoneyScore["band"] =
    score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Okay" : "Needs work";
  return { score, band, factors };
}

/* ----------------------------------------------------------- guru insight */

/** One evidence-backed sentence about this month, or null when there's no story. */
export function guruInsight(
  monthTxs: Transaction[],
  lastMonthTxs: Transaction[],
  labelFor: (c: Category) => string,
): string | null {
  const now = sumTotals(monthTxs);
  if (monthTxs.length === 0) return null;

  const nowCats = categoryTotals(monthTxs);
  const prevMap = new Map(categoryTotals(lastMonthTxs).map((c) => [c.category, c.amount]));

  for (const cat of nowCats.slice(0, 4)) {
    const prev = prevMap.get(cat.category);
    if (prev && prev > 0) {
      const change = (cat.amount - prev) / prev;
      if (change >= 0.2)
        return `Your ${labelFor(cat.category).toLowerCase()} spending is ${Math.round(change * 100)}% higher than last month (${inr(cat.amount)} vs ${inr(prev)}).`;
      if (change <= -0.2)
        return `Nice — ${labelFor(cat.category).toLowerCase()} spending is down ${Math.abs(Math.round(change * 100))}% from last month.`;
    }
  }

  const top = nowCats[0];
  if (top && top.share >= 0.3)
    return `${labelFor(top.category)} is your biggest spend this month: ${inr(top.amount)}, ${Math.round(top.share * 100)}% of everything.`;

  if (now.income > 0 && now.net > 0)
    return `You've kept ${inr(now.net)} this month — ${Math.round(savingsRate(now) * 100)}% of what you earned.`;

  if (now.expense > 0)
    return `You've spent ${inr(now.expense)} this month across ${nowCats.length} categor${nowCats.length === 1 ? "y" : "ies"}.`;

  return null;
}
