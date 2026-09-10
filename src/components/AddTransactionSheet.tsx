import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES, PAYMENT_METHODS, type PaymentMethod, type TxType } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { X } from "lucide-react";

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddTransactionSheet({
  open,
  onClose,
  initialType = "expense",
}: {
  open: boolean;
  onClose: () => void;
  initialType?: TxType;
}) {
  const { addTransaction } = useStore();
  const { t } = useI18n();
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [when, setWhen] = useState(() => localInput(new Date()));

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setCategory(CATEGORIES.find((c) => c.kind === initialType)!.id);
    setWhen(localInput(new Date()));
  }, [open, initialType]);

  const cats = CATEGORIES.filter((c) => c.kind === type);

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    const at = new Date(when);
    void addTransaction({
      type,
      amount: n,
      category,
      note: note.trim() || cats.find((c) => c.id === category)?.label || "",
      date: (Number.isNaN(+at) ? new Date() : at).toISOString(),
      method,
      source: "manual",
    })
      .then(() => toast.success(`${type === "income" ? "Income" : "Expense"} added`))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save"));
    setAmount("");
    setNote("");
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
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] max-h-[92vh] overflow-y-auto bg-card rounded-t-3xl z-50 p-6 pb-8 border-t border-border"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-display font-bold">{t("addTx")}</h2>
              <button onClick={onClose} className="size-9 rounded-full bg-secondary flex items-center justify-center" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex p-1 bg-secondary rounded-2xl mb-5">
              {(["expense", "income"] as TxType[]).map((k) => (
                <button
                  key={k}
                  onClick={() => { setType(k); setCategory(CATEGORIES.find(c => c.kind === k)!.id); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    type === k
                      ? k === "income" ? "bg-neon text-neon-foreground" : "bg-accent text-accent-foreground"
                      : "text-foreground/50"
                  }`}
                >
                  {t(k)}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("amount")}</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-display font-bold text-foreground/40">₹</span>
                <input
                  inputMode="decimal" placeholder="0"
                  value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="bg-transparent outline-none text-4xl font-display font-bold flex-1 min-w-0"
                  autoFocus
                />
              </div>
            </label>

            <div className="mt-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("category")}</span>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {cats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`p-3 rounded-2xl flex flex-col items-center gap-1 border transition-all ${
                      category === c.id
                        ? "bg-neon/10 border-neon text-foreground"
                        : "bg-secondary border-transparent text-foreground/70"
                    }`}
                  >
                    <c.Icon className="size-5" />
                    <span className="text-[9px] font-semibold text-center leading-tight">{c.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Paid by</span>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`rounded-xl py-2.5 text-[11px] font-bold border transition-all ${
                      method === m.id ? "bg-neon/10 border-neon" : "bg-secondary border-transparent text-foreground/70"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Date &amp; time</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-2 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none"
              />
            </label>

            <input
              value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")}
              className="mt-4 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-foreground/30"
            />

            <button
              onClick={submit}
              className="mt-5 w-full bg-neon text-neon-foreground font-bold py-4 rounded-2xl text-sm tracking-wide neon-glow active:scale-[0.98] transition-transform"
            >
              {t("save")}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
