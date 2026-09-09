import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, categoryMeta, type Category, type TxType } from "@/lib/types";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Money — MoneyGuruAI" }, { name: "description", content: "Search and filter your income and expenses." }] }),
  component: MoneyScreen,
});

type DateFilter = "all" | "today" | "week" | "month" | "custom";
type TypeFilter = "all" | TxType;
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function MoneyScreen() {
  const { transactions, removeTransaction, loading } = useStore();
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startWeek = startToday - 6 * 86400000;
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return transactions.filter((tx) => {
      const time = new Date(tx.date).getTime();
      if (dateFilter === "today" && time < startToday) return false;
      if (dateFilter === "week" && time < startWeek) return false;
      if (dateFilter === "month" && time < startMonth) return false;
      if (dateFilter === "custom") {
        if (from && time < new Date(`${from}T00:00:00`).getTime()) return false;
        if (to && time > new Date(`${to}T23:59:59`).getTime()) return false;
      }
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (category !== "all" && tx.category !== category) return false;
      const q = query.trim().toLowerCase();
      if (q) {
        const meta = categoryMeta(tx.category);
        const hay = `${tx.note} ${meta.label} ${tx.amount}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, query, dateFilter, typeFilter, category, from, to]);

  const summary = useMemo(() => filtered.reduce((a, t) => {
    a[t.type] += t.amount; return a;
  }, { income: 0, expense: 0 }), [filtered]);

  const clear = () => { setQuery(""); setDateFilter("all"); setTypeFilter("all"); setCategory("all"); setFrom(""); setTo(""); };

  return <main className="px-4 pb-8 pt-6">
    <div className="flex items-end justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-neon">MoneyGuruAI</p><h1 className="mt-1 text-3xl font-display font-bold">Money</h1></div>
      <div className="text-right text-[11px] text-foreground/50"><p><span className="text-success font-bold">+{inr(summary.income)}</span> in</p><p><span className="text-danger font-bold">-{inr(summary.expense)}</span> out</p></div>
    </div>

    <div className="relative mt-5"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search note, category or amount" className="w-full rounded-2xl border border-border bg-card py-3.5 pl-10 pr-10 text-sm outline-none focus:border-neon/60"/>{query && <button onClick={()=>setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-4 text-foreground/40"/></button>}</div>

    <section className="mt-4 rounded-2xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground/50"><SlidersHorizontal className="size-3.5"/> Filters</span><button onClick={clear} className="text-[10px] font-bold uppercase tracking-wider text-neon">Clear</button></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{(["all","today","week","month","custom"] as DateFilter[]).map(v=><button key={v} onClick={()=>setDateFilter(v)} className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-bold ${dateFilter===v?"bg-neon text-neon-foreground":"bg-secondary text-foreground/60"}`}>{v==="all"?"All dates":v==="week"?"This week":v==="month"?"This month":v[0].toUpperCase()+v.slice(1)}</button>)}</div>
      {dateFilter === "custom" && <div className="mt-3 grid grid-cols-2 gap-2"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="min-w-0 rounded-xl bg-secondary p-2.5 text-xs"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="min-w-0 rounded-xl bg-secondary p-2.5 text-xs"/></div>}
      <div className="mt-3 grid grid-cols-2 gap-2"><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value as TypeFilter)} className="min-w-0 rounded-xl bg-secondary p-2.5 text-xs"><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select><select value={category} onChange={e=>setCategory(e.target.value as "all"|Category)} className="min-w-0 rounded-xl bg-secondary p-2.5 text-xs"><option value="all">All categories</option>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
    </section>

    <div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{filtered.length} transaction{filtered.length===1?"":"s"}</p></div>
    {loading ? <div className="py-16 text-center text-sm text-foreground/40">Loading transactions…</div> : filtered.length===0 ? <div className="py-16 text-center"><p className="text-sm font-semibold">No transactions match these filters.</p><button onClick={clear} className="mt-2 text-xs font-bold text-neon">Clear filters</button></div> : <div className="mt-3 space-y-2">{filtered.map(tx=>{const c=categoryMeta(tx.category); return <div key={tx.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary"><c.Icon className="size-5 text-neon"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{tx.note||c.label}</p><p className="mt-0.5 truncate text-[10px] text-foreground/45">{c.label} · {new Date(tx.date).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</p></div><div className="text-right"><p className={`text-sm font-bold ${tx.type==="income"?"text-success":"text-danger"}`}>{tx.type==="income"?"+":"-"}{inr(tx.amount)}</p><p className="text-[9px] uppercase tracking-wider text-foreground/35">{tx.type}</p></div><button aria-label="Delete transaction" onClick={()=>{if(window.confirm("Delete this transaction? This cannot be undone.")) void removeTransaction(tx.id).then(()=>toast.success("Transaction deleted")).catch(()=>toast.error("Could not delete transaction"));}} className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-foreground/35 hover:text-danger"><Trash2 className="size-3.5"/></button></div>})}</div>}
  </main>;
}
