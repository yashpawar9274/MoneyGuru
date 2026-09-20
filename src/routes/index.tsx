import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bell, TrendingUp, ArrowDownRight, ArrowUpRight, HandCoins, CreditCard, Minus, Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { groupByDay, inRange, totals, useStore } from "@/lib/store";
import { categoryMeta } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { AIAdvisorCard } from "@/components/AIAdvisorCard";
import { ScanBillButton } from "@/components/ScanBillButton";
import { useAuth } from "@/lib/auth";
import { useCreditCards } from "@/lib/credit-cards";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MONEY.FYI — Dashboard" },
      { name: "description", content: "Your daily money snapshot, AI coach, and bill scanner." },
      { property: "og:title", content: "MONEY.FYI — Dashboard" },
      { property: "og:description", content: "Your daily money snapshot, AI coach, and bill scanner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function dayLabel(iso: string, t: (k: "today" | "yesterday" | "earlier") => string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((+today.setHours(0, 0, 0, 0) - +new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return t("today");
  if (diff === 1) return t("yesterday");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function Dashboard() {
  const { transactions, addTransaction } = useStore();
  const { cards, addRepayment, cardBalance } = useCreditCards();
  const { profile, user } = useAuth();
  const { t, setLang, lang } = useI18n();
  const [cardAction, setCardAction] = useState<{ cardId: string; kind: "payment" | "expense" } | null>(null);
  const [cardAmount, setCardAmount] = useState("");
  const [savingCardAction, setSavingCardAction] = useState(false);
  const initials = (profile?.full_name || user?.email || "MG").slice(0, 2).toUpperCase();

  const stats = useMemo(() => {
    const week = inRange(transactions, 7);
    const today = transactions.filter(
      (tx) => new Date(tx.date).toDateString() === new Date().toDateString(),
    );
    return {
      week: totals(week),
      today: totals(today),
      all: totals(transactions),
    };
  }, [transactions]);

  const groups = useMemo(() => groupByDay(transactions).slice(0, 5), [transactions]);
  const totalCardAvailable = useMemo(
    () => cards.reduce((sum, card) => sum + cardBalance(card.id).available, 0),
    [cards, cardBalance],
  );
  const selectedCard = cardAction ? cards.find((card) => card.id === cardAction.cardId) : undefined;

  async function saveCardAction() {
    if (!cardAction || !selectedCard) return;
    const amount = Number(cardAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSavingCardAction(true);
    try {
      if (cardAction.kind === "payment") {
        await addRepayment(selectedCard.id, amount, "Card payment");
        toast.success("Card payment added");
      } else {
        await addTransaction({
          type: "expense",
          amount,
          category: "other",
          note: `${selectedCard.name} card expense`,
          date: new Date().toISOString(),
          method: "card",
          source: "manual",
          cardId: selectedCard.id,
        });
        toast.success("Card expense added");
      }
      setCardAmount("");
      setCardAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update card balance");
    } finally {
      setSavingCardAction(false);
    }
  }

  return (
    <div className="px-5 pt-6">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/profile" aria-label="Open profile" className="size-9 bg-accent rounded-full grid place-items-center text-xs font-bold text-accent-foreground active:scale-95 transition-transform">
            {initials}
          </Link>
          <div>
            <p className="text-[10px] text-foreground/50 leading-none uppercase tracking-widest">{t("welcome")}</p>
            <p className="text-sm font-semibold mt-1">{profile?.full_name ? `Hey, ${profile.full_name.split(" ")[0]}` : "Hey there"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const order: ("en" | "hi" | "es" | "fr")[] = ["en", "hi", "es", "fr"];
              setLang(order[(order.indexOf(lang) + 1) % order.length]);
            }}
            className="px-2.5 py-1.5 bg-card rounded-lg text-[10px] font-bold border border-border uppercase tracking-tighter"
          >
            {lang.toUpperCase()}
          </button>
          <button className="size-9 bg-card rounded-full border border-border flex items-center justify-center">
            <Bell className="size-4 text-foreground/70" />
          </button>
        </div>
      </header>

      {/* Balance hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="mt-6"
      >
        <div className="bg-gradient-to-br from-neon to-emerald-400 p-6 rounded-3xl text-neon-foreground relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 size-40 rounded-full bg-white/10 blur-2xl" />
          <div className="flex justify-between items-start mb-4 relative">
            <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">{t("totalBalance")}</span>
            <span className="text-[10px] font-bold bg-black/10 px-2 py-1 rounded-full flex items-center gap-1">
              <TrendingUp className="size-3" />
              {t("thisWeek")} {stats.week.balance >= 0 ? "+" : ""}
              {formatINR(stats.week.balance)}
            </span>
          </div>
          <h2 className="text-4xl font-display font-bold tracking-tight mb-2 relative">
            {formatINR(stats.all.balance + totalCardAvailable)}
          </h2>
          <div className="flex gap-4 text-xs font-medium opacity-80 relative">
            <span>Cash {formatINR(stats.all.balance)}</span>
            <span>Card {formatINR(totalCardAvailable)}</span>
          </div>
        </div>
      </motion.section>

      <section className="mt-5 border-y border-border py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Credit available</p>
            <p className="mt-1 text-xl font-display font-bold">{formatINR(totalCardAvailable)}</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/cards">Manage cards</Link></Button>
        </div>

        {cards.length === 0 ? (
          <Link to="/cards" className="flex items-center gap-3 rounded-xl bg-secondary p-3">
            <span className="grid size-9 place-items-center rounded-lg bg-background"><CreditCard className="size-4 text-neon" /></span>
            <span className="text-sm font-semibold">Add your credit card</span>
          </Link>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => {
              const balance = cardBalance(card.id);
              return (
                <div key={card.id} className="flex items-center gap-3 rounded-xl bg-card p-3">
                  <CreditCard className="size-5 shrink-0 text-neon" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{card.name} •••• {card.lastFour}</p>
                    <p className="mt-0.5 text-[10px] text-foreground/45">{formatINR(balance.available)} left · {formatINR(balance.outstanding)} used</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={`Add payment to ${card.name}`}
                    onClick={() => { setCardAmount(""); setCardAction({ cardId: card.id, kind: "payment" }); }}
                  >
                    <Plus className="text-success" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={`Add expense to ${card.name}`}
                    onClick={() => { setCardAmount(""); setCardAction({ cardId: card.id, kind: "expense" }); }}
                  >
                    <Minus className="text-danger" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Udhari & EMI quick action */}
      <section className="mt-5">
        <Link
          to="/debts"
          className="w-full flex items-center justify-between p-4 bg-card border border-border rounded-2xl active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gradient-to-br from-accent to-neon grid place-items-center text-neon-foreground"><HandCoins className="size-5" /></div>
            <div>
              <p className="text-sm font-semibold">Udhari & EMI</p>
              <p className="text-[10px] text-foreground/50 uppercase tracking-widest">Track loans • Mark payments</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-neon uppercase tracking-widest">Open →</span>
        </Link>
      </section>

      {/* AI */}
      <section className="mt-5"><AIAdvisorCard /></section>

      {/* Scan */}
      <section className="mt-4"><ScanBillButton /></section>


      {/* Day-by-day feed */}
      <section className="mt-7">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">{t("todaySpends")}</h3>
          <Link to="/analytics" className="text-[10px] font-bold text-neon uppercase tracking-widest">
            {t("viewAnalytics")} →
          </Link>
        </div>

        {groups.length === 0 && (
          <div className="text-center py-10 text-sm text-foreground/40">{t("nothingYet")}</div>
        )}

        <div className="space-y-5">
          {groups.map(([day, items]) => {
            const dayTot = totals(items);
            return (
              <div key={day}>
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                    {dayLabel(day, t)}
                  </p>
                  <p className="text-[10px] font-mono text-foreground/40">
                    {dayTot.income > 0 && <span className="text-success">+{formatINR(dayTot.income)} </span>}
                    {dayTot.expense > 0 && <span className="text-danger">-{formatINR(dayTot.expense)}</span>}
                  </p>
                </div>
                <div className="space-y-2">
                  {items.map((tx) => {
                    const c = categoryMeta(tx.category);
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3.5 bg-card/60 rounded-2xl border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="size-10 bg-secondary rounded-xl flex items-center justify-center text-neon">
                            <c.Icon className="size-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{tx.note || c.label}</p>
                            <p className="text-[10px] text-foreground/40 mt-0.5">
                              {c.label} • {new Date(tx.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <p className={`text-sm font-display font-bold ${tx.type === "income" ? "text-success" : "text-danger"}`}>
                          {tx.type === "income" ? "+" : "-"}{formatINR(tx.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {cardAction && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm" onClick={() => setCardAction(null)}>
          <div className="w-full max-w-[440px] rounded-t-2xl border-t border-border bg-card p-5 pb-8" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neon">{selectedCard.name} •••• {selectedCard.lastFour}</p>
                <h2 className="mt-1 text-xl font-display font-bold">{cardAction.kind === "payment" ? "Add card payment" : "Add card expense"}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCardAction(null)} aria-label="Close card entry"><X /></Button>
            </div>
            <label className="mt-5 block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Amount</span>
              <div className="mt-2 flex items-baseline gap-2 border-b border-border pb-2">
                <span className="text-2xl font-bold text-foreground/40">₹</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={cardAmount}
                  onChange={(event) => setCardAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent text-3xl font-display font-bold outline-none"
                  aria-label="Card amount"
                />
              </div>
            </label>
            <Button className="mt-5 h-12 w-full" disabled={savingCardAction} onClick={() => void saveCardAction()}>
              {savingCardAction ? "Saving…" : cardAction.kind === "payment" ? "Add payment (+)" : "Add expense (−)"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
