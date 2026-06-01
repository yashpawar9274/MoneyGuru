import { createFileRoute } from "@tanstack/react-router";
import { AIAdvisorCard } from "@/components/AIAdvisorCard";
import { useStore, inRange, totals } from "@/lib/store";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Coach — MONEY.FYI" },
      { name: "description", content: "Your AI money coach analyses spending and gives voice tips." },
    ],
  }),
  component: AIPage,
});

function INR(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

function AIPage() {
  const { transactions } = useStore();
  const { t } = useI18n();
  const week = useMemo(() => totals(inRange(transactions, 7)), [transactions]);
  const month = useMemo(() => totals(inRange(transactions, 30)), [transactions]);

  return (
    <div className="px-5 pt-6">
      <header className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("ai")} Coach</p>
        <h1 className="text-2xl font-display font-bold mt-1">Your money brain</h1>
      </header>

      <AIAdvisorCard />

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">7-day spend</p>
          <p className="text-xl font-display font-bold mt-1 text-danger">{INR(week.expense)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">30-day spend</p>
          <p className="text-xl font-display font-bold mt-1 text-danger">{INR(month.expense)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">7-day saved</p>
          <p className={`text-xl font-display font-bold mt-1 ${week.balance >= 0 ? "text-neon" : "text-danger"}`}>{INR(week.balance)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">30-day saved</p>
          <p className={`text-xl font-display font-bold mt-1 ${month.balance >= 0 ? "text-neon" : "text-danger"}`}>{INR(month.balance)}</p>
        </div>
      </div>

      <div className="mt-6 p-5 bg-gradient-to-br from-accent/20 to-neon/10 border border-accent/30 rounded-2xl">
        <p className="text-[10px] font-bold text-accent uppercase tracking-widest">How it works</p>
        <p className="text-sm mt-2 text-foreground/80 leading-relaxed">
          The coach reads your recent spending, flags wasteful categories, and speaks the advice out loud in your chosen language using ElevenLabs voice.
        </p>
      </div>
    </div>
  );
}
