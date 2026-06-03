import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Trash2, X, Check, HandCoins, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useDebts, remaining, paidTotal, type DebtKind, type Debt } from "@/lib/debts";

export const Route = createFileRoute("/debts")({
  head: () => ({
    meta: [
      { title: "Udhari & EMI — MONEY.FYI" },
      { name: "description", content: "Track udhari (loans) and EMIs. Mark payments and see remaining balance." },
    ],
  }),
  component: DebtsPage,
});

const KIND_META: Record<DebtKind, { label: string; emoji: string; tint: string; Icon: typeof HandCoins }> = {
  udhari_given: { label: "Udhari Given", emoji: "🤝", tint: "text-success", Icon: HandCoins },
  udhari_taken: { label: "Udhari Taken", emoji: "💸", tint: "text-danger", Icon: Wallet },
  emi: { label: "EMI", emoji: "📅", tint: "text-accent", Icon: CreditCard },
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

function DebtsPage() {
  const { debts, addDebt, removeDebt, addPayment } = useDebts();
  const [openAdd, setOpenAdd] = useState(false);
  const [payFor, setPayFor] = useState<Debt | null>(null);

  const totals = useMemo(() => {
    let owe = 0, lent = 0, emi = 0;
    for (const d of debts) {
      const r = remaining(d);
      if (d.kind === "udhari_taken") owe += r;
      else if (d.kind === "udhari_given") lent += r;
      else emi += r;
    }
    return { owe, lent, emi };
  }, [debts]);

  return (
    <div className="px-5 pt-6">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/" className="size-9 bg-card rounded-full border border-border flex items-center justify-center">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-display font-bold">Udhari & EMI</h1>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest">Free tracker</p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <StatCard label="You Owe" value={inr(totals.owe)} tint="text-danger" />
        <StatCard label="Lent Out" value={inr(totals.lent)} tint="text-success" />
        <StatCard label="EMI Left" value={inr(totals.emi)} tint="text-accent" />
      </div>

      <button
        onClick={() => setOpenAdd(true)}
        className="w-full bg-neon text-neon-foreground font-bold py-3.5 rounded-2xl text-sm tracking-wide neon-glow active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mb-5"
      >
        <Plus className="size-4" strokeWidth={3} /> Add Udhari / EMI
      </button>

      {debts.length === 0 && (
        <div className="text-center py-16 text-sm text-foreground/40">
          No udhari or EMI yet. Tap above to add one.
        </div>
      )}

      <div className="space-y-3">
        {debts.map((d) => {
          const meta = KIND_META[d.kind];
          const left = remaining(d);
          const pct = d.principal > 0 ? Math.min(100, (paidTotal(d) / d.principal) * 100) : 0;
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 bg-secondary rounded-xl grid place-items-center text-xl">{meta.emoji}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{d.title}</p>
                    <p className={`text-[10px] uppercase tracking-widest font-bold ${meta.tint}`}>{meta.label}</p>
                  </div>
                </div>
                <button
                  onClick={() => { removeDebt(d.id); toast.success("Removed"); }}
                  className="size-8 rounded-full bg-secondary grid place-items-center text-foreground/50 hover:text-danger"
                  aria-label="Remove"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-widest text-foreground/40">Remaining</span>
                <span className="text-lg font-display font-bold">{inr(left)}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                <div className="h-full bg-neon" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-foreground/40 mt-1.5">
                <span>Paid {inr(paidTotal(d))}</span>
                <span>of {inr(d.principal)}</span>
              </div>

              {d.monthly ? (
                <p className="text-[10px] text-foreground/50 mt-2">EMI per month: {inr(d.monthly)}</p>
              ) : null}
              {d.dueDate ? (
                <p className="text-[10px] text-foreground/50 mt-1">Due: {new Date(d.dueDate).toLocaleDateString()}</p>
              ) : null}

              <button
                onClick={() => setPayFor(d)}
                disabled={left === 0}
                className="mt-3 w-full py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Check className="size-3.5" /> {left === 0 ? "Cleared" : "Mark Payment"}
              </button>
            </motion.div>
          );
        })}
      </div>

      <AddDebtSheet
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSave={(d) => { addDebt(d); toast.success("Added"); }}
      />
      <PaymentSheet
        debt={payFor}
        onClose={() => setPayFor(null)}
        onPay={(amt, note) => {
          if (!payFor) return;
          addPayment(payFor.id, amt, note);
          toast.success("Payment recorded");
          setPayFor(null);
        }}
      />
    </div>
  );
}

function StatCard({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">{label}</p>
      <p className={`text-base font-display font-bold mt-1 ${tint}`}>{value}</p>
    </div>
  );
}

function AddDebtSheet({
  open, onClose, onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (d: { kind: DebtKind; title: string; principal: number; monthly?: number; dueDate?: string }) => void;
}) {
  const [kind, setKind] = useState<DebtKind>("udhari_taken");
  const [title, setTitle] = useState("");
  const [principal, setPrincipal] = useState("");
  const [monthly, setMonthly] = useState("");
  const [dueDate, setDueDate] = useState("");

  const submit = () => {
    const p = parseFloat(principal);
    if (!title.trim()) return toast.error("Enter a name/title");
    if (!p || p <= 0) return toast.error("Enter a valid amount");
    onSave({
      kind,
      title: title.trim(),
      principal: p,
      monthly: monthly ? parseFloat(monthly) : undefined,
      dueDate: dueDate || undefined,
    });
    setTitle(""); setPrincipal(""); setMonthly(""); setDueDate("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-card rounded-t-3xl z-50 p-6 pb-8 border-t border-border"
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-display font-bold">Add Udhari / EMI</h2>
              <button onClick={onClose} className="size-9 rounded-full bg-secondary flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(["udhari_taken", "udhari_given", "emi"] as DebtKind[]).map((k) => {
                const m = KIND_META[k];
                return (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`p-3 rounded-2xl border text-center ${
                      kind === k ? "bg-neon/10 border-neon" : "bg-secondary border-transparent"
                    }`}
                  >
                    <div className="text-xl">{m.emoji}</div>
                    <div className="text-[9px] font-bold mt-1 leading-tight">{m.label}</div>
                  </button>
                );
              })}
            </div>

            <Field label="Title / Person">
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Rahul bhai, HDFC car loan"
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-foreground/30"
              />
            </Field>
            <Field label="Total Amount">
              <input
                inputMode="decimal" value={principal}
                onChange={(e) => setPrincipal(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Monthly (opt.)">
                <input
                  inputMode="decimal" value={monthly}
                  onChange={(e) => setMonthly(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </Field>
              <Field label="Due (opt.)">
                <input
                  type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </Field>
            </div>

            <button
              onClick={submit}
              className="mt-5 w-full bg-neon text-neon-foreground font-bold py-3.5 rounded-2xl text-sm tracking-wide"
            >
              Save
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PaymentSheet({
  debt, onClose, onPay,
}: {
  debt: Debt | null;
  onClose: () => void;
  onPay: (amount: number, note?: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const left = debt ? remaining(debt) : 0;

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    if (n > left) return toast.error(`Cannot exceed remaining ${inr(left)}`);
    onPay(n, note.trim() || undefined);
    setAmount(""); setNote("");
  };

  return (
    <AnimatePresence>
      {debt && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-card rounded-t-3xl z-50 p-6 pb-8 border-t border-border"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-display font-bold">Record Payment</h2>
              <button onClick={onClose} className="size-9 rounded-full bg-secondary flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-foreground/50 mb-4">
              {debt.title} • Remaining {inr(left)}
            </p>

            <Field label="Amount Paid">
              <input
                inputMode="decimal" autoFocus value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="w-full bg-secondary rounded-xl px-3 py-3 text-lg font-bold outline-none"
              />
            </Field>
            <Field label="Note (opt.)">
              <input
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. UPI / Cash"
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-foreground/30"
              />
            </Field>

            <div className="flex gap-2 mt-2 mb-2">
              {[0.25, 0.5, 1].map((f) => (
                <button
                  key={f}
                  onClick={() => setAmount(String(Math.round(left * f)))}
                  className="flex-1 py-2 rounded-xl bg-secondary text-xs font-bold"
                >
                  {f === 1 ? "Full" : `${f * 100}%`}
                </button>
              ))}
            </div>

            <button
              onClick={submit}
              className="mt-4 w-full bg-neon text-neon-foreground font-bold py-3.5 rounded-2xl text-sm tracking-wide"
            >
              Mark Paid
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
