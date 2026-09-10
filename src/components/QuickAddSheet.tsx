import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Calculator, HandCoins, Undo2, X } from "lucide-react";

export interface QuickAddProps {
  open: boolean;
  onClose: () => void;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onCalculator: () => void;
}

export function QuickAddSheet({ open, onClose, onAddExpense, onAddIncome, onCalculator }: QuickAddProps) {
  const navigate = useNavigate();

  const go = (intent: "give" | "receive") => {
    onClose();
    void navigate({ to: "/debts", search: { intent } });
  };

  const actions = [
    { label: "Add Expense", hint: "Money you spent", Icon: ArrowDownLeft, tone: "text-danger", run: () => { onClose(); onAddExpense(); } },
    { label: "Add Income", hint: "Money you received", Icon: ArrowUpRight, tone: "text-success", run: () => { onClose(); onAddIncome(); } },
    { label: "Give Money", hint: "New udhari to someone", Icon: HandCoins, tone: "text-neon", run: () => go("give") },
    { label: "Receive Money", hint: "Udhari coming back", Icon: Undo2, tone: "text-neon", run: () => go("receive") },
    { label: "Calculator", hint: "Quick maths", Icon: Calculator, tone: "text-foreground/70", run: () => { onClose(); onCalculator(); } },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-6 pb-8"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">Quick add</h2>
              <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-secondary" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              {actions.map(({ label, hint, Icon, tone, run }) => (
                <button
                  key={label}
                  onClick={run}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-secondary/60 p-4 text-left transition-transform active:scale-[0.99]"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-background">
                    <Icon className={`size-5 ${tone}`} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-[11px] text-foreground/50">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
