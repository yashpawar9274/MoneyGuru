import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CreditCard, Plus, ReceiptIndianRupee, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreditCards } from "@/lib/credit-cards";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "Credit Cards — MoneyGuruAI" },
      { name: "description", content: "Track credit limits, card spending, repayments, and available balance." },
      { property: "og:title", content: "Credit Cards — MoneyGuruAI" },
      { property: "og:description", content: "Track credit limits, card spending, repayments, and available balance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CardsPage,
});

const inr = (amount: number) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function CardsPage() {
  const { cards, entries, loading, addCard, addRepayment, removeCard, cardBalance } = useCreditCards();
  const [showAdd, setShowAdd] = useState(false);
  const [repayCard, setRepayCard] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [limit, setLimit] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [repayment, setRepayment] = useState("");
  const [repaymentNote, setRepaymentNote] = useState("");
  const totals = useMemo(() => cards.reduce((result, card) => {
    const balance = cardBalance(card.id);
    return { limit: result.limit + card.creditLimit, outstanding: result.outstanding + balance.outstanding, available: result.available + balance.available };
  }, { limit: 0, outstanding: 0, available: 0 }), [cards, cardBalance]);

  async function saveCard() {
    const creditLimit = Number(limit);
    if (!name.trim() || !/^\d{4}$/.test(lastFour) || creditLimit <= 0) {
      toast.error("Enter a card name, last 4 digits, and valid limit.");
      return;
    }
    try {
      await addCard({
        name: name.trim(), lastFour, creditLimit,
        statementDay: statementDay ? Number(statementDay) : null,
        dueDay: dueDay ? Number(dueDay) : null,
      });
      setName(""); setLastFour(""); setLimit(""); setStatementDay(""); setDueDay(""); setShowAdd(false);
      toast.success("Credit card added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add card");
    }
  }

  async function saveRepayment() {
    const amount = Number(repayment);
    if (!repayCard || amount <= 0) return toast.error("Enter a valid repayment amount.");
    try {
      await addRepayment(repayCard, amount, repaymentNote);
      setRepayCard(null); setRepayment(""); setRepaymentNote("");
      toast.success("Repayment recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record repayment");
    }
  }

  return (
    <main className="px-4 pb-8 pt-6">
      <header className="flex items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-neon">MoneyGuruAI</p><h1 className="mt-1 text-3xl font-display font-bold">Credit cards</h1></div>
        <Button size="icon" onClick={() => setShowAdd((value) => !value)} aria-label={showAdd ? "Close add card form" : "Add credit card"}>{showAdd ? <X /> : <Plus />}</Button>
      </header>

      {cards.length > 0 && <section className="mt-5 grid grid-cols-3 gap-2 border-y border-border py-4 text-center">
        <div><p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40">Total limit</p><p className="mt-1 text-sm font-bold">{inr(totals.limit)}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40">Used</p><p className="mt-1 text-sm font-bold text-danger">{inr(totals.outstanding)}</p></div>
        <div><p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40">Available</p><p className="mt-1 text-sm font-bold text-neon">{inr(totals.available)}</p></div>
      </section>}

      {showAdd && <section className="mt-5 border-b border-border pb-5">
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="Card name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Card name" className="rounded-xl bg-secondary px-3 py-3 text-sm outline-none" />
          <input aria-label="Last four digits" inputMode="numeric" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, ""))} placeholder="Last 4 digits" className="rounded-xl bg-secondary px-3 py-3 text-sm outline-none" />
          <input aria-label="Credit limit" inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value.replace(/[^\d.]/g, ""))} placeholder="Credit limit" className="col-span-2 rounded-xl bg-secondary px-3 py-3 text-sm outline-none" />
          <input aria-label="Statement day" inputMode="numeric" value={statementDay} onChange={(event) => setStatementDay(event.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Statement day" className="rounded-xl bg-secondary px-3 py-3 text-sm outline-none" />
          <input aria-label="Due day" inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Due day" className="rounded-xl bg-secondary px-3 py-3 text-sm outline-none" />
        </div>
        <Button className="mt-3 w-full" onClick={() => void saveCard()}>Save card</Button>
      </section>}

      {loading ? <p className="py-16 text-center text-sm text-foreground/40">Loading cards…</p> : cards.length === 0 ? <div className="py-16 text-center"><CreditCard className="mx-auto size-10 text-foreground/25"/><p className="mt-3 text-sm font-semibold">No credit cards yet</p><p className="mt-1 text-xs text-foreground/45">Add a card to see its remaining limit after every expense.</p></div> : <div className="mt-5 space-y-4">
        {cards.map((card) => {
          const balance = cardBalance(card.id);
          const usage = Math.min(100, card.creditLimit ? (balance.outstanding / card.creditLimit) * 100 : 0);
          const recent = entries.filter((entry) => entry.cardId === card.id).slice(0, 3);
          return <article key={card.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-base font-display font-bold">{card.name}</p><p className="mt-0.5 text-[11px] text-foreground/45">•••• {card.lastFour}{card.dueDay ? ` · Due on ${card.dueDay}` : ""}</p></div><Button variant="ghost" size="icon" aria-label={`Delete ${card.name}`} onClick={() => { if (window.confirm(`Delete ${card.name}?`)) void removeCard(card.id).catch(() => toast.error("Could not delete card")); }}><Trash2 className="text-danger" /></Button></div>
            <div className="mt-4 flex items-end justify-between"><div><p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40">Available</p><p className="mt-1 text-2xl font-display font-bold text-neon">{inr(balance.available)}</p></div><p className="text-right text-xs text-foreground/50">{inr(balance.outstanding)} used<br/>of {inr(card.creditLimit)}</p></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${usage >= 80 ? "bg-danger" : "bg-neon"}`} style={{ width: `${usage}%` }} /></div>
            <div className="mt-4 flex gap-2"><Button className="flex-1" variant="secondary" onClick={() => setRepayCard(repayCard === card.id ? null : card.id)}><ReceiptIndianRupee /> Record payment</Button></div>
            {repayCard === card.id && <div className="mt-3 grid gap-2 border-t border-border pt-3"><input aria-label="Repayment amount" inputMode="decimal" value={repayment} onChange={(event) => setRepayment(event.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount paid" className="rounded-xl bg-secondary px-3 py-3 text-sm outline-none"/><input aria-label="Repayment note" value={repaymentNote} onChange={(event) => setRepaymentNote(event.target.value)} placeholder="Note (optional)" className="rounded-xl bg-secondary px-3 py-3 text-sm outline-none"/><Button onClick={() => void saveRepayment()}>Save payment</Button></div>}
            {recent.length > 0 && <div className="mt-4 border-t border-border pt-3">{recent.map((entry) => <div key={entry.id} className="flex justify-between py-1 text-xs"><span className="truncate text-foreground/55">{entry.note || "Card payment"}</span><span className={entry.type === "repayment" ? "text-success" : "text-danger"}>{entry.type === "repayment" ? "+" : "-"}{inr(entry.amount)}</span></div>)}</div>}
          </article>;
        })}
      </div>}
    </main>
  );
}