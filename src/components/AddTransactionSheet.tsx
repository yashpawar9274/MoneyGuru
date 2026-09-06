import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES, type TxType } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { X } from "lucide-react";

export function AddTransactionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTransaction } = useStore();
  const { t } = useI18n();
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [note, setNote] = useState("");

  const cats = CATEGORIES.filter((c) => c.kind === type);

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    addTransaction({
      type,
      amount: n,
      category,
      note: note.trim() || cats.find((c) => c.id === category)?.label || "",
      date: new Date().toISOString(),
      source: "manual",
    });
    toast.success(`${type === "income" ? "Income" : "Expense"} added`);
    setAmount(""); setNote("");
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-display font-bold">{t("addTx")}</h2>
              <button onClick={onClose} className="size-9 rounded-full bg-secondary flex items-center justify-center">
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
                    <span className="text-xl">{c.emoji}</span>
                    <span className="text-[9px] font-semibold text-center leading-tight">{c.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <input
              value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")}
              className="mt-5 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-foreground/30"
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
