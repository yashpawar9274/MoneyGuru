import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bell, TrendingUp, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { groupByDay, inRange, totals, useStore } from "@/lib/store";
import { categoryMeta } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { AIAdvisorCard } from "@/components/AIAdvisorCard";
import { ScanBillButton } from "@/components/ScanBillButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MONEY.FYI — Dashboard" },
      { name: "description", content: "Your daily money snapshot, AI coach, and bill scanner." },
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
  const { transactions } = useStore();
  const { t, setLang, lang } = useI18n();

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

  return (
    <div className="px-5 pt-6">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-accent rounded-full grid place-items-center text-xs font-bold text-accent-foreground">
            YO
          </div>
          <div>
            <p className="text-[10px] text-foreground/50 leading-none uppercase tracking-widest">{t("welcome")}</p>
            <p className="text-sm font-semibold mt-1">Hey there 👋</p>
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
            {formatINR(stats.all.balance)}
          </h2>
          <div className="flex gap-4 text-xs font-medium opacity-80 relative">
            <span className="flex items-center gap-1"><ArrowUpRight className="size-3" /> {formatINR(stats.today.income)}</span>
            <span className="flex items-center gap-1"><ArrowDownRight className="size-3" /> {formatINR(stats.today.expense)}</span>
          </div>
        </div>
      </motion.section>

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
                          <div className="size-10 bg-secondary rounded-xl flex items-center justify-center text-xl">
                            {c.emoji}
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
    </div>
  );
}
