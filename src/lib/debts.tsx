import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DebtKind = "udhari_given" | "udhari_taken" | "emi";

export interface DebtPayment {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export interface Debt {
  id: string;
  kind: DebtKind;
  title: string;        // person name or loan name
  principal: number;    // total amount
  monthly?: number;     // EMI per month (optional)
  dueDate?: string;     // ISO due date
  createdAt: string;
  payments: DebtPayment[];
}

const KEY = "money_fyi_debts_v1";

interface Ctx {
  debts: Debt[];
  addDebt: (d: Omit<Debt, "id" | "createdAt" | "payments">) => void;
  removeDebt: (id: string) => void;
  addPayment: (debtId: string, amount: number, note?: string) => void;
}

const DebtsCtx = createContext<Ctx | null>(null);

export function DebtsProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDebts(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(debts));
  }, [debts, hydrated]);

  const addDebt: Ctx["addDebt"] = useCallback((d) => {
    setDebts((p) => [
      { ...d, id: crypto.randomUUID(), createdAt: new Date().toISOString(), payments: [] },
      ...p,
    ]);
  }, []);

  const removeDebt = useCallback((id: string) => {
    setDebts((p) => p.filter((d) => d.id !== id));
  }, []);

  const addPayment = useCallback((debtId: string, amount: number, note?: string) => {
    setDebts((p) =>
      p.map((d) =>
        d.id === debtId
          ? {
              ...d,
              payments: [
                { id: crypto.randomUUID(), amount, date: new Date().toISOString(), note },
                ...d.payments,
              ],
            }
          : d,
      ),
    );
  }, []);

  const value = useMemo(() => ({ debts, addDebt, removeDebt, addPayment }), [debts, addDebt, removeDebt, addPayment]);
  return <DebtsCtx.Provider value={value}>{children}</DebtsCtx.Provider>;
}

export function useDebts() {
  const ctx = useContext(DebtsCtx);
  if (!ctx) throw new Error("useDebts must be used within DebtsProvider");
  return ctx;
}

export function paidTotal(d: Debt) {
  return d.payments.reduce((s, p) => s + p.amount, 0);
}

export function remaining(d: Debt) {
  return Math.max(0, d.principal - paidTotal(d));
}
