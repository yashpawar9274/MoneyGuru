import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, FileText, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EntryForm, ReceiptSheet } from "@/components/UdhaariLedgerSheet";
import { ledger, type LedgerItem } from "@/lib/debt-proof";
import { ledgerGivenTotal, paidTotal, remaining, useDebts } from "@/lib/debts";

export const Route = createFileRoute("/ledger")({
  validateSearch: (search: Record<string, unknown>) => ({ debtId: String(search.debtId ?? "") }),
  head: () => ({
    meta: [
      { title: "Udhari Ledger — MONEY.FYI" },
      { name: "description", content: "Full given and received history for one person, with running balance and receipt sharing." },
      { property: "og:title", content: "Udhari Ledger — MONEY.FYI" },
      { property: "og:description", content: "Track every rupee given and returned with exact date, time and running balance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LedgerPage,
});

function LedgerPage() {
  const { debtId } = Route.useSearch();
  const { debts, removeEntry, removePayment } = useDebts();
  const navigate = useNavigate();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerItem | undefined>();
  const debt = debts.find((item) => item.id === debtId);
  const items = useMemo(
    () => (debt ? ledger(debt).slice().sort((a, b) => +new Date(a.date) - +new Date(b.date)) : []),
    [debt],
  );
  if (!debt)
    return (
      <main className="p-6">
        <Link to="/debts" className="text-neon">Back</Link>
        <p className="mt-8 text-sm text-foreground/60">Ledger not found.</p>
      </main>
    );

  const totalGiven = ledgerGivenTotal(debt);
  const totalReceived = paidTotal(debt);
  const remove = (item: LedgerItem) => {
    if (item.id.endsWith("-base")) return toast.error("This old entry cannot be deleted");
    if (!confirm("Delete this transaction?")) return;
    void (item.kind === "given" ? removeEntry(item.id) : removePayment(item.id))
      .then(() => toast.success("Transaction deleted"))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not delete"));
  };

  let running = 0;
  return (
    <main className="min-h-screen px-5 pb-28 pt-6">
      <header className="flex items-start gap-3">
        <button
          onClick={() => navigate({ to: "/debts" })}
          className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-display font-bold">{debt.title}</h1>
          <p className="text-xs text-foreground/50">{debt.contactPhone || "No mobile number"}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-2">
        <Stat label="Total Given" value={totalGiven} />
        <Stat label="Received" value={totalReceived} />
        <Stat label="Pending" value={remaining(debt)} />
      </section>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => { setEditing(undefined); setFormOpen(true); }}
          className="rounded-2xl bg-neon py-3 text-xs font-bold text-neon-foreground"
        >
          <Plus className="mr-1 inline size-4" /> Add Transaction
        </button>
        <button onClick={() => setReceiptOpen(true)} className="rounded-2xl bg-secondary py-3 text-xs font-bold">
          <FileText className="mr-1 inline size-4" /> Generate Receipt
        </button>
      </div>
      <button
        onClick={() => toast.info("Use Generate Receipt to share the complete ledger")}
        className="mt-2 w-full rounded-2xl border border-border py-3 text-xs font-bold text-foreground/70"
      >
        <Share2 className="mr-1 inline size-4" /> Share Ledger
      </button>

      <div className="mt-6 space-y-2">
        {items.map((item) => {
          running += item.kind === "given" ? item.amount : -item.amount;
          return (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{item.kind === "given" ? "Given" : "Received"}</p>
                  <p className="mt-1 text-xs text-foreground/50">{new Date(item.date).toLocaleString("en-IN")}</p>
                  {item.note && <p className="mt-2 text-xs text-foreground/70">{item.note}</p>}
                  {(item.purpose || item.method || item.location) && (
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-foreground/40">
                      {[item.purpose, item.method, item.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-bold ${item.kind === "given" ? "text-danger" : "text-success"}`}>
                    {item.kind === "given" ? "+" : "-"}₹{item.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-widest text-foreground/40">
                    Balance ₹{Math.max(0, running).toLocaleString("en-IN")}
                  </p>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <button
                      onClick={() => { setEditing(item); setFormOpen(true); }}
                      className="size-8 rounded-lg bg-secondary grid place-items-center"
                      aria-label="Edit transaction"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => remove(item)}
                      className="size-8 rounded-lg bg-secondary grid place-items-center text-danger"
                      aria-label="Delete transaction"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {formOpen && <EntryForm debt={debt} item={editing} onClose={() => { setFormOpen(false); setEditing(undefined); }} />}
      {receiptOpen && <ReceiptSheet debt={debt} onClose={() => setReceiptOpen(false)} onEdit={() => { setReceiptOpen(false); setFormOpen(true); }} />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-foreground/45">{label}</p>
      <p className="mt-2 text-lg font-bold text-neon">₹{value.toLocaleString("en-IN")}</p>
    </div>
  );
}
