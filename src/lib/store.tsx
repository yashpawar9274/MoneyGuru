import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Transaction } from "./types";

const STORAGE_KEY = "money_fyi_tx_v1";

interface StoreCtx {
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, "id">) => Transaction;
  removeTransaction: (id: string) => void;
  clearAll: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

function seed(): Transaction[] {
  const now = new Date();
  const day = (offset: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return [
    { id: "s1", type: "income", amount: 45000, category: "salary", note: "Monthly Salary", date: day(2, 10) },
    { id: "s2", type: "expense", amount: 450, category: "food", note: "Burger King", date: day(0, 13, 40) },
    { id: "s3", type: "expense", amount: 180, category: "transport", note: "Uber Ride", date: day(0, 9, 15) },
    { id: "s4", type: "expense", amount: 1299, category: "shopping", note: "Sneakers", date: day(1, 18) },
    { id: "s5", type: "expense", amount: 599, category: "entertainment", note: "Netflix", date: day(1, 21) },
    { id: "s6", type: "income", amount: 1200, category: "freelance", note: "Logo gig", date: day(0, 11) },
    { id: "s7", type: "expense", amount: 320, category: "food", note: "Zomato", date: day(2, 20) },
    { id: "s8", type: "expense", amount: 89, category: "transport", note: "Metro", date: day(3, 8) },
    { id: "s9", type: "expense", amount: 240, category: "food", note: "Starbucks", date: day(4, 11) },
    { id: "s10", type: "expense", amount: 1499, category: "bills", note: "Electricity", date: day(5, 14) },
  ];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTransactions(JSON.parse(raw));
      else setTransactions(seed());
    } catch {
      setTransactions(seed());
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions, hydrated]);

  const addTransaction = useCallback((tx: Omit<Transaction, "id">) => {
    const next: Transaction = { ...tx, id: crypto.randomUUID() };
    setTransactions((prev) => [next, ...prev]);
    return next;
  }, []);

  const removeTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => setTransactions([]), []);

  const value = useMemo(
    () => ({ transactions, addTransaction, removeTransaction, clearAll }),
    [transactions, addTransaction, removeTransaction, clearAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// Selectors
export function groupByDay(txs: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  for (const t of [...txs].sort((a, b) => +new Date(b.date) - +new Date(a.date))) {
    const k = new Date(t.date).toISOString().slice(0, 10);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  return Array.from(groups.entries()); // [dateISO, txs[]]
}

export function totals(txs: Transaction[]) {
  let income = 0, expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export function inRange(txs: Transaction[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return txs.filter((t) => +new Date(t.date) >= cutoff);
}
