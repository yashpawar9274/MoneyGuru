import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { useStore } from "./store";

export type CreditCard = {
  id: string;
  name: string;
  lastFour: string;
  creditLimit: number;
  statementDay: number | null;
  dueDay: number | null;
};

export type CreditCardEntry = {
  id: string;
  cardId: string;
  type: "purchase" | "repayment";
  amount: number;
  note: string;
  date: string;
};

type CardInput = Omit<CreditCard, "id">;

type CreditCardsContextValue = {
  cards: CreditCard[];
  entries: CreditCardEntry[];
  loading: boolean;
  addCard: (card: CardInput) => Promise<void>;
  addRepayment: (cardId: string, amount: number, note: string) => Promise<void>;
  removeCard: (cardId: string) => Promise<void>;
  cardBalance: (cardId: string) => { spent: number; repaid: number; outstanding: number; available: number };
};

const CreditCardsContext = createContext<CreditCardsContextValue | null>(null);

export function CreditCardsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { transactions } = useStore();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [entries, setEntries] = useState<CreditCardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setCards([]);
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [cardResult, entryResult] = await Promise.all([
      supabase.from("credit_cards").select("id,name,last_four,credit_limit,statement_day,due_day").order("created_at"),
      supabase.from("credit_card_entries").select("id,card_id,entry_type,amount,note,entry_date").order("entry_date", { ascending: false }),
    ]);
    if (cardResult.error) throw cardResult.error;
    if (entryResult.error) throw entryResult.error;
    setCards((cardResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      lastFour: row.last_four,
      creditLimit: Number(row.credit_limit),
      statementDay: row.statement_day,
      dueDay: row.due_day,
    })));
    setEntries((entryResult.data ?? []).map((row) => ({
      id: row.id,
      cardId: row.card_id,
      type: row.entry_type === "repayment" ? "repayment" : "purchase",
      amount: Number(row.amount),
      note: row.note,
      date: row.entry_date,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load().catch(() => setLoading(false));
  }, [load]);

  const addCard = useCallback(async (card: CardInput) => {
    if (!user) throw new Error("Sign in to add a card.");
    const { error } = await supabase.from("credit_cards").insert({
      user_id: user.id,
      name: card.name.trim(),
      last_four: card.lastFour,
      credit_limit: card.creditLimit,
      statement_day: card.statementDay,
      due_day: card.dueDay,
    });
    if (error) throw error;
    await load();
  }, [load, user]);

  const addRepayment = useCallback(async (cardId: string, amount: number, note: string) => {
    if (!user) throw new Error("Sign in to record a repayment.");
    const { data, error } = await supabase.from("credit_card_entries").insert({
      user_id: user.id,
      card_id: cardId,
      entry_type: "repayment",
      amount,
      note: note.trim(),
    }).select("id,card_id,entry_type,amount,note,entry_date").single();
    if (error) throw error;
    setEntries((previous) => [{
      id: data.id,
      cardId: data.card_id,
      type: "repayment",
      amount: Number(data.amount),
      note: data.note,
      date: data.entry_date,
    }, ...previous]);
  }, [user]);

  const removeCard = useCallback(async (cardId: string) => {
    const { error } = await supabase.from("credit_cards").delete().eq("id", cardId);
    if (error) throw error;
    setCards((previous) => previous.filter((card) => card.id !== cardId));
    setEntries((previous) => previous.filter((entry) => entry.cardId !== cardId));
  }, []);

  const cardBalance = useCallback((cardId: string) => {
    const card = cards.find((item) => item.id === cardId);
    const spentFromTransactions = transactions
      .filter((transaction) => transaction.cardId === cardId && transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const manualPurchases = entries
      .filter((entry) => entry.cardId === cardId && entry.type === "purchase")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const repaid = entries
      .filter((entry) => entry.cardId === cardId && entry.type === "repayment")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const spent = spentFromTransactions + manualPurchases;
    const outstanding = Math.max(0, spent - repaid);
    return { spent, repaid, outstanding, available: Math.max(0, (card?.creditLimit ?? 0) - outstanding) };
  }, [cards, entries, transactions]);

  const value = useMemo(() => ({ cards, entries, loading, addCard, addRepayment, removeCard, cardBalance }), [cards, entries, loading, addCard, addRepayment, removeCard, cardBalance]);
  return <CreditCardsContext.Provider value={value}>{children}</CreditCardsContext.Provider>;
}

export function useCreditCards() {
  const value = useContext(CreditCardsContext);
  if (!value) throw new Error("useCreditCards must be used within CreditCardsProvider");
  return value;
}