import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Category, PaymentMethod, Transaction } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

interface StoreCtx {
  transactions: Transaction[];
  loading: boolean;
  addTransaction: (tx: Omit<Transaction, "id">) => Promise<Transaction>;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

const COLUMNS = "id,type,amount,category,note,date,method,source";

interface Row {
  id: string;
  type: string;
  amount: number | string;
  category: string;
  note: string | null;
  date: string;
  method?: string | null;
  source?: string | null;
}

function fromRow(r: Row): Transaction {
  return {
    id: r.id,
    type: r.type === "income" ? "income" : "expense",
    amount: Number(r.amount),
    category: r.category as Category,
    note: r.note ?? "",
    date: r.date,
    method: (r.method as PaymentMethod | null) ?? null,
    source: (r.source as Transaction["source"]) ?? "manual",
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    supabase
      .from("transactions")
      .select(COLUMNS)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (!alive) return;
        setTransactions((data ?? []).map((r) => fromRow(r as unknown as Row)));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const addTransaction = useCallback(
    async (tx: Omit<Transaction, "id">) => {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          type: tx.type,
          amount: tx.amount,
          category: tx.category,
          note: tx.note,
          date: tx.date,
          method: tx.method ?? null,
          source: tx.source ?? "manual",
        })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      const next = fromRow(data as unknown as Row);
      setTransactions((prev) =>
        [next, ...prev].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("money-fyi:tx-added", { detail: next }));
      }
      return next;
    },
    [],
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Omit<Transaction, "id">>) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.type !== undefined) dbPatch["type"] = patch.type;
      if (patch.amount !== undefined) dbPatch["amount"] = patch.amount;
      if (patch.category !== undefined) dbPatch["category"] = patch.category;
      if (patch.note !== undefined) dbPatch["note"] = patch.note;
      if (patch.date !== undefined) dbPatch["date"] = patch.date;
      if (patch.method !== undefined) dbPatch["method"] = patch.method ?? null;
      const { error } = await supabase
        .from("transactions")
        .update(dbPatch as never)
        .eq("id", id);
      if (error) throw error;
      setTransactions((prev) =>
        prev
          .map((t) => (t.id === id ? { ...t, ...patch } : t))
          .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
      );
    },
    [],
  );

  const removeTransaction = useCallback(async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("transactions").delete().eq("id", id);
  }, []);


  const clearAll = useCallback(async () => {
    if (!user) return;
    setTransactions([]);
    await supabase.from("transactions").delete().eq("user_id", user.id);
  }, [user]);

  const value = useMemo(
    () => ({ transactions, loading, addTransaction, updateTransaction, removeTransaction, clearAll }),
    [transactions, loading, addTransaction, updateTransaction, removeTransaction, clearAll],
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
  let income = 0,
    expense = 0;
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

export function thisMonth(txs: Transaction[]) {
  const now = new Date();
  return txs.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

export function toCsv(txs: Transaction[]) {
  const head = "date,type,category,note,amount";
  const rows = txs.map((t) =>
    [
      new Date(t.date).toISOString(),
      t.type,
      t.category,
      `"${(t.note ?? "").replace(/"/g, '""')}"`,
      t.amount,
    ].join(","),
  );
  return [head, ...rows].join("\n");
}
