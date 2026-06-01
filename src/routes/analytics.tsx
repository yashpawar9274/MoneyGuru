import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { useStore, inRange, totals } from "@/lib/store";
import { categoryMeta } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — MONEY.FYI" },
      { name: "description", content: "Weekly and monthly spend analysis with category breakdown." },
    ],
  }),
  component: Analytics,
});

type Range = "weekly" | "monthly";

const PALETTE = ["#d9f99d", "#a855f7", "#f97316", "#06b6d4", "#f43f5e", "#22c55e", "#eab308", "#3b82f6"];

function formatINR(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

function Analytics() {
  const { transactions } = useStore();
  const { t } = useI18n();
  const [range, setRange] = useState<Range>("weekly");

  const days = range === "weekly" ? 7 : 30;
  const scoped = useMemo(() => inRange(transactions, days), [transactions, days]);
  const tot = useMemo(() => totals(scoped), [scoped]);

  const barData = useMemo(() => {
    const bucket = new Map<string, { day: string; expense: number; income: number }>();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0, 10);
      bucket.set(key, {
        day: range === "weekly"
          ? d.toLocaleDateString(undefined, { weekday: "short" })
          : d.getDate().toString(),
        expense: 0, income: 0,
      });
    }
    for (const tx of scoped) {
      const key = new Date(tx.date).toISOString().slice(0, 10);
      const b = bucket.get(key);
      if (!b) continue;
      if (tx.type === "expense") b.expense += tx.amount;
      else b.income += tx.amount;
    }
    return Array.from(bucket.values());
  }, [scoped, days, range]);

  const catData = useMemo(() => {
    const m = new Map<string, number>();
    for (const tx of scoped) {
      if (tx.type !== "expense") continue;
      m.set(tx.category, (m.get(tx.category) ?? 0) + tx.amount);
    }
    return Array.from(m.entries())
      .map(([cat, value]) => ({ cat, value, meta: categoryMeta(cat as never) }))
      .sort((a, b) => b.value - a.value);
  }, [scoped]);

  return (
    <div className="px-5 pt-6">
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("analytics")}</p>
        <h1 className="text-2xl font-display font-bold mt-1">Money pulse</h1>
      </header>

      <div className="flex p-1 bg-card rounded-2xl mb-5">
        {(["weekly", "monthly"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              range === r ? "bg-neon text-neon-foreground" : "text-foreground/50"
            }`}
          >
            {t(r)}
          </button>
        ))}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat label={t("income")} value={formatINR(tot.income)} accent="text-success" />
        <Stat label={t("expense")} value={formatINR(tot.expense)} accent="text-danger" />
        <Stat label="Net" value={formatINR(tot.balance)} accent="text-neon" />
      </div>

      {/* Bar chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl p-4 mb-5"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">
          {range === "weekly" ? "Last 7 days" : "Last 30 days"}
        </p>
        <div className="h-44">
          <ResponsiveContainer>
            <BarChart data={barData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="day" tickLine={false} axisLine={false}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                interval={range === "monthly" ? 4 : 0}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                formatter={(v: number) => formatINR(v)}
              />
              <Bar dataKey="expense" fill="#d9f99d" radius={[6, 6, 0, 0]} />
              <Bar dataKey="income" fill="#a855f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Category pie */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-card rounded-2xl p-4"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">
          {t("spendByCategory")}
        </p>
        {catData.length === 0 ? (
          <p className="text-sm text-foreground/40 py-6 text-center">No expenses yet</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catData} dataKey="value" innerRadius={36} outerRadius={64} paddingAngle={2}>
                    {catData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {catData.slice(0, 5).map((c, i) => {
                const pct = (c.value / tot.expense) * 100;
                return (
                  <div key={c.cat} className="flex items-center gap-2 text-xs">
                    <span className="size-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="flex-1 truncate">{c.meta.emoji} {c.meta.label}</span>
                    <span className="font-mono text-foreground/60">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-card rounded-2xl p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">{label}</p>
      <p className={`text-sm font-display font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
