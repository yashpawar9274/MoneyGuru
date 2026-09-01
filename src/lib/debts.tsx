import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type DebtKind = "udhari_given" | "udhari_taken" | "emi";

export interface DebtPayment {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export type PayFreq = "daily" | "weekly" | "monthly";

export interface Debt {
  id: string;
  kind: DebtKind;
  title: string; // person name or loan name
  principal: number; // total amount
  monthly?: number; // EMI per month (optional)
  dueDate?: string; // ISO due date
  createdAt: string;
  payments: DebtPayment[];
  planAmount?: number; // amount per installment of the payoff plan
  planFreq?: PayFreq; // how often you can pay
  interestRate?: number; // % per month on the outstanding amount
  reason?: string; // why the money was lent / taken
  contactPhone?: string; // for WhatsApp reminders
}

export type NewDebt = Omit<Debt, "id" | "createdAt" | "payments">;

interface Ctx {
  debts: Debt[];
  loading: boolean;
  addDebt: (d: NewDebt) => Promise<void>;
  updateDebt: (id: string, patch: Partial<NewDebt>) => Promise<void>;
  removeDebt: (id: string) => Promise<void>;
  addPayment: (debtId: string, amount: number, note?: string) => Promise<void>;
}

const DebtsCtx = createContext<Ctx | null>(null);

interface DebtRow {
  id: string;
  kind: string;
  title: string;
  principal: number | string;
  monthly: number | string | null;
  due_date: string | null;
  plan_amount: number | string | null;
  plan_freq: string | null;
  interest_rate: number | string | null;
  reason: string | null;
  contact_phone: string | null;
  created_at: string;
}

interface PaymentRow {
  id: string;
  debt_id: string;
  amount: number | string;
  note: string | null;
  paid_at: string;
}

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined ? undefined : Number(v);

function toDbPatch(d: Partial<NewDebt>) {
  const patch: Record<string, unknown> = {};
  if (d.kind !== undefined) patch["kind"] = d.kind;
  if (d.title !== undefined) patch["title"] = d.title;
  if (d.principal !== undefined) patch["principal"] = d.principal;
  if (d.monthly !== undefined) patch["monthly"] = d.monthly ?? null;
  if (d.dueDate !== undefined) patch["due_date"] = d.dueDate ? d.dueDate.slice(0, 10) : null;
  if (d.planAmount !== undefined) patch["plan_amount"] = d.planAmount ?? null;
  if (d.planFreq !== undefined) patch["plan_freq"] = d.planFreq ?? null;
  if (d.interestRate !== undefined) patch["interest_rate"] = d.interestRate ?? 0;
  if (d.reason !== undefined) patch["reason"] = d.reason ?? null;
  if (d.contactPhone !== undefined) patch["contact_phone"] = d.contactPhone ?? null;
  return patch;
}

export function DebtsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: rows }, { data: pays }] = await Promise.all([
      supabase
        .from("debts")
        .select(
          "id,kind,title,principal,monthly,due_date,plan_amount,plan_freq,interest_rate,reason,contact_phone,created_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("debt_payments").select("id,debt_id,amount,note,paid_at"),
    ]);
    const byDebt = new Map<string, DebtPayment[]>();
    for (const p of (pays ?? []) as unknown as PaymentRow[]) {
      const list = byDebt.get(p.debt_id) ?? [];
      list.push({ id: p.id, amount: Number(p.amount), date: p.paid_at, note: p.note ?? undefined });
      byDebt.set(p.debt_id, list);
    }
    setDebts(
      ((rows ?? []) as unknown as DebtRow[]).map((r) => ({
        id: r.id,
        kind: r.kind as DebtKind,
        title: r.title,
        principal: Number(r.principal),
        monthly: num(r.monthly),
        dueDate: r.due_date ?? undefined,
        planAmount: num(r.plan_amount),
        planFreq: (r.plan_freq as PayFreq | null) ?? undefined,
        interestRate: num(r.interest_rate) ?? 0,
        reason: r.reason ?? undefined,
        contactPhone: r.contact_phone ?? undefined,
        createdAt: r.created_at,
        payments: (byDebt.get(r.id) ?? []).sort((a, b) => +new Date(b.date) - +new Date(a.date)),
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) {
      setDebts([]);
      setLoading(false);
      return;
    }
    void fetchAll();
  }, [user, fetchAll]);

  const addDebt = useCallback(
    async (d: NewDebt) => {
      const { error } = await supabase.from("debts").insert(toDbPatch(d) as never);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll],
  );

  const updateDebt = useCallback(
    async (id: string, patch: Partial<NewDebt>) => {
      const { error } = await supabase
        .from("debts")
        .update(toDbPatch(patch) as never)
        .eq("id", id);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll],
  );

  const removeDebt = useCallback(async (id: string) => {
    setDebts((p) => p.filter((d) => d.id !== id));
    await supabase.from("debts").delete().eq("id", id);
  }, []);

  const addPayment = useCallback(
    async (debtId: string, amount: number, note?: string) => {
      const { data, error } = await supabase
        .from("debt_payments")
        .insert({ debt_id: debtId, amount, note: note ?? null })
        .select("id,debt_id,amount,note,paid_at")
        .single();
      if (error) throw error;
      const row = data as unknown as PaymentRow;
      setDebts((p) =>
        p.map((d) =>
          d.id === debtId
            ? {
                ...d,
                payments: [
                  {
                    id: row.id,
                    amount: Number(row.amount),
                    date: row.paid_at,
                    note: row.note ?? undefined,
                  },
                  ...d.payments,
                ],
              }
            : d,
        ),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({ debts, loading, addDebt, updateDebt, removeDebt, addPayment }),
    [debts, loading, addDebt, updateDebt, removeDebt, addPayment],
  );
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

/** Months elapsed (fractional) since the debt was created. */
export function monthsElapsed(d: Debt) {
  return Math.max(0, (Date.now() - +new Date(d.createdAt)) / (30 * 86400000));
}

/** Simple interest accrued on the principal at `interestRate` % per month. */
export function interestAccrued(d: Debt) {
  const rate = (d.interestRate ?? 0) / 100;
  if (rate <= 0) return 0;
  return Math.round(d.principal * rate * monthsElapsed(d));
}

/** What is still owed today: principal + accrued interest − payments made. */
export function remaining(d: Debt) {
  return Math.max(0, d.principal + interestAccrued(d) - paidTotal(d));
}

const FREQ_DAYS: Record<PayFreq, number> = { daily: 1, weekly: 7, monthly: 30 };

export interface Forecast {
  installments: number;
  days: number;
  freedomDate: Date;
  perInstallment: number;
  freq: PayFreq;
  totalInterest: number;
  /** true when the installment is too small to ever beat the interest */
  impossible: boolean;
}

function addPeriods(from: Date, freq: PayFreq, count: number) {
  const d = new Date(from);
  if (freq === "monthly") d.setMonth(d.getMonth() + count);
  else d.setDate(d.getDate() + count * FREQ_DAYS[freq]);
  return d;
}

/**
 * Simulates the payoff schedule installment by installment, applying the
 * monthly interest rate pro-rata for the chosen frequency. Returns null when
 * there is nothing left to pay or no plan amount has been set.
 */
export function forecast(d: Debt): Forecast | null {
  let balance = remaining(d);
  if (balance <= 0) return null;

  const freq: PayFreq = d.planFreq ?? "monthly";
  const amt = d.planAmount ?? d.monthly ?? 0;
  if (amt <= 0) return null;

  const monthlyRate = (d.interestRate ?? 0) / 100;
  const periodRate = monthlyRate * (FREQ_DAYS[freq] / 30);

  // Interest per period at the current balance already eats the whole payment.
  if (periodRate > 0 && balance * periodRate >= amt) {
    return {
      installments: 0,
      days: 0,
      freedomDate: new Date(),
      perInstallment: amt,
      freq,
      totalInterest: 0,
      impossible: true,
    };
  }

  let installments = 0;
  let totalInterest = 0;
  const MAX = 5000;
  while (balance > 0 && installments < MAX) {
    const interest = balance * periodRate;
    totalInterest += interest;
    balance = balance + interest - amt;
    installments += 1;
  }

  const freedomDate = addPeriods(new Date(), freq, installments);
  const days = Math.max(1, Math.round((+freedomDate - Date.now()) / 86400000));

  return {
    installments,
    days,
    freedomDate,
    perInstallment: amt,
    freq,
    totalInterest: Math.round(totalInterest),
    impossible: false,
  };
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export const KIND_LABEL: Record<DebtKind, string> = {
  udhari_given: "Udhari Given",
  udhari_taken: "Udhari Taken",
  emi: "EMI / Loan",
};

/** Pre-built WhatsApp reminder for money you lent out. */
export function whatsappReminder(d: Debt, appLink: string) {
  const left = remaining(d);
  const due = d.dueDate
    ? new Date(d.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const interest = (d.interestRate ?? 0) > 0 ? interestAccrued(d) : 0;

  const lines = [
    `Hi ${d.title}! 👋`,
    "",
    `Chhota reminder: ₹${d.principal.toLocaleString("en-IN")} udhaar${d.reason ? ` (${d.reason})` : ""} lia tha.`,
  ];
  if (interest > 0) {
    lines.push(`Interest @ ${d.interestRate}%/month: ₹${interest.toLocaleString("en-IN")}`);
  }
  lines.push(`Pending amount: ₹${left.toLocaleString("en-IN")}`);
  if (due) lines.push(`Due date: ${due}`);
  lines.push("", "Jab possible ho settle kar dena 🙏", "", `Tracked on MONEY.FYI — ${appLink}`);

  return lines.join("\n");
}

export function whatsappLink(d: Debt, appLink: string) {
  const text = encodeURIComponent(whatsappReminder(d, appLink));
  const phone = (d.contactPhone ?? "").replace(/[^0-9]/g, "");
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
