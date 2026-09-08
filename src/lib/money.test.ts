import { describe, expect, it } from "vitest";
import {
  availableBalance,
  categoryTotals,
  dailyAverageSpend,
  guruInsight,
  ledgerTotals,
  moneyScore,
  projectedMonthSpend,
  safeToSpend,
  savingsRate,
  sumTotals,
  topCategory,
} from "./money";
import type { Transaction } from "./types";

let seq = 0;
const tx = (
  type: Transaction["type"],
  amount: number,
  category: Transaction["category"] = "other",
  date = new Date().toISOString(),
): Transaction => ({ id: `t${++seq}`, type, amount, category, note: "", date, source: "manual" });

describe("income and expense totals", () => {
  it("adds income and expenses separately", () => {
    const txs = [tx("income", 47250, "salary"), tx("expense", 12430, "food")];
    expect(sumTotals(txs)).toEqual({ income: 47250, expense: 12430, net: 34820 });
  });

  it("available balance is income minus expenses", () => {
    expect(availableBalance([tx("income", 5000), tx("expense", 1200)])).toBe(3800);
  });

  it("ignores deleted rows because it only reads what it is given", () => {
    const all = [tx("expense", 500), tx("expense", 300)];
    const afterDelete = all.slice(1);
    expect(sumTotals(afterDelete).expense).toBe(300);
  });

  it("reflects an edited amount", () => {
    const edited = [{ ...tx("expense", 500), amount: 250 }];
    expect(sumTotals(edited).expense).toBe(250);
  });
});

describe("udhari balance", () => {
  it("multiple lendings and a part repayment", () => {
    const balance = ledgerTotals([
      { kind: "given", amount: 2000 },
      { kind: "given", amount: 390 },
      { kind: "received", amount: 200 },
    ]);
    expect(balance.given).toBe(2390);
    expect(balance.received).toBe(200);
    expect(balance.outstanding).toBe(2190);
  });

  it("stays stable no matter the order the rows arrive in", () => {
    const a = ledgerTotals([
      { kind: "received", amount: 200 },
      { kind: "given", amount: 390 },
      { kind: "given", amount: 2000 },
    ]);
    expect(a.outstanding).toBe(2190);
  });

  it("never goes negative and reports the extra separately", () => {
    const balance = ledgerTotals([
      { kind: "given", amount: 1000 },
      { kind: "received", amount: 1200 },
    ]);
    expect(balance.outstanding).toBe(0);
    expect(balance.overpaid).toBe(200);
  });

  it("settles to zero when everything comes back", () => {
    expect(
      ledgerTotals([
        { kind: "given", amount: 500 },
        { kind: "received", amount: 300 },
        { kind: "received", amount: 200 },
      ]).outstanding,
    ).toBe(0);
  });

  it("deleting a lending row recalculates the balance", () => {
    const rows = [
      { kind: "given" as const, amount: 2000 },
      { kind: "given" as const, amount: 390 },
      { kind: "received" as const, amount: 200 },
    ];
    expect(ledgerTotals(rows.filter((r) => r.amount !== 390)).outstanding).toBe(1800);
  });

  it("guards against a bad amount instead of producing NaN", () => {
    expect(
      ledgerTotals([
        { kind: "given", amount: Number.NaN },
        { kind: "given", amount: 100 },
      ]).outstanding,
    ).toBe(100);
  });
});

describe("categories", () => {
  const txs = [
    tx("expense", 4850, "food"),
    tx("expense", 1200, "transport"),
    tx("expense", 950, "food"),
    tx("income", 40000, "salary"),
  ];

  it("groups expenses only and sorts by size", () => {
    const cats = categoryTotals(txs);
    expect(cats[0]).toMatchObject({ category: "food", amount: 5800 });
    expect(cats).toHaveLength(2);
  });

  it("shares add up to 100%", () => {
    const total = categoryTotals(txs).reduce((s, c) => s + c.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it("top category", () => {
    expect(topCategory(txs)?.category).toBe("food");
    expect(topCategory([])).toBeNull();
  });
});

describe("rates and projections", () => {
  it("savings rate", () => {
    expect(savingsRate({ income: 40000, expense: 30000, net: 10000 })).toBeCloseTo(0.25);
    expect(savingsRate({ income: 0, expense: 500, net: -500 })).toBe(0);
  });

  it("daily average spend", () => {
    expect(dailyAverageSpend([tx("expense", 700)], 7)).toBe(100);
    expect(dailyAverageSpend([tx("expense", 700)], 0)).toBe(0);
  });

  it("projects month-end spend from the pace so far", () => {
    const ref = new Date(2026, 8, 10); // 10 Sep, 30-day month
    const spent = [tx("expense", 10000, "food", new Date(2026, 8, 5).toISOString())];
    expect(projectedMonthSpend(spent, ref)).toBe(30000);
  });
});

describe("safe to spend", () => {
  const ref = new Date(2026, 8, 1); // 1 Sep -> 30 days left

  it("uses an explicit budget when set", () => {
    const s = safeToSpend([tx("expense", 1000)], { monthlyBudget: 14110 }, ref);
    expect(s.available).toBe(13110);
    expect(s.daysLeft).toBe(30);
    expect(s.perDay).toBe(437);
    expect(s.basis).toContain("13,110".replace("13,110", "1,000"));
  });

  it("derives a budget from income, savings target and fixed bills", () => {
    const s = safeToSpend([], { monthlyIncome: 40000, savingsTarget: 10000, fixedExpenses: 12000 }, ref);
    expect(s.budget).toBe(18000);
    expect(s.perDay).toBe(600);
  });

  it("falls back to income recorded this month", () => {
    const s = safeToSpend([tx("income", 30000, "salary"), tx("expense", 6000, "food")], {}, ref);
    expect(s.budget).toBe(30000);
    expect(s.available).toBe(24000);
  });

  it("never suggests spending money that is gone", () => {
    const s = safeToSpend([tx("expense", 20000)], { monthlyBudget: 10000 }, ref);
    expect(s.available).toBe(0);
    expect(s.perDay).toBe(0);
  });
});

describe("money score", () => {
  it("rewards a saver and explains why", () => {
    const monthTxs = [tx("income", 50000, "salary"), tx("expense", 20000, "food")];
    const result = moneyScore({ monthTxs, monthlyBudget: 30000 });
    expect(result.score).toBeGreaterThan(70);
    expect(result.band === "Good" || result.band === "Excellent").toBe(true);
    expect(result.factors).toHaveLength(5);
    expect(result.factors.every((f) => f.points <= f.max)).toBe(true);
  });

  it("marks down heavy overspending with debt", () => {
    const monthTxs = [tx("income", 20000, "salary"), tx("expense", 32000, "shopping")];
    const result = moneyScore({ monthTxs, owed: 25000, monthlyBudget: 15000 });
    expect(result.score).toBeLessThan(45);
    expect(result.band).toBe("Needs work");
  });

  it("always stays inside 0-100", () => {
    const result = moneyScore({ monthTxs: [] });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("guru insight", () => {
  const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

  it("says nothing when there is no data", () => {
    expect(guruInsight([], [], label as never)).toBeNull();
  });

  it("flags a category that jumped versus last month", () => {
    const insight = guruInsight(
      [tx("expense", 4850, "food")],
      [tx("expense", 3700, "food")],
      label as never,
    );
    expect(insight).toContain("31% higher");
  });

  it("praises a category that dropped", () => {
    const insight = guruInsight(
      [tx("expense", 2000, "shopping")],
      [tx("expense", 4000, "shopping")],
      label as never,
    );
    expect(insight).toContain("down 50%");
  });
});
