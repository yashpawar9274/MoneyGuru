import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import type { Transaction } from "./types";

const KEY = "money-fyi:transactions";

type Ctx = {
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, "id">) => void;
  removeTransaction: (id: string) => void;
  clearAll: () => void;
};
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setTransactions(JSON.parse(v)));
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(transactions));
  }, [transactions]);

  return (
    <StoreCtx.Provider
      value={{
        transactions,
        addTransaction: (tx) =>
          setTransactions((p) => [{ ...tx, id: String(uuid.v4()) }, ...p]),
        removeTransaction: (id) => setTransactions((p) => p.filter((t) => t.id !== id)),
        clearAll: () => setTransactions([]),
      }}
    >
      {children}
    </StoreCtx.Provider>
  );
}

export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
};

export function totals(txs: Transaction[]) {
  let income = 0, expense = 0;
  for (const t of txs) t.type === "income" ? (income += t.amount) : (expense += t.amount);
  return { income, expense, balance: income - expense };
}

export function inRange(txs: Transaction[], days: number) {
  const cutoff = Date.now() - days * 86400000;
  return txs.filter((t) => new Date(t.date).getTime() >= cutoff);
}

export function groupByDay(txs: Transaction[]) {
  const m = new Map<string, Transaction[]>();
  for (const t of txs) {
    const k = t.date.slice(0, 10);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(t);
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
}
