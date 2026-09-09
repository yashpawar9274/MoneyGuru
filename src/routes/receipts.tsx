import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { ReceiptSheet } from "@/components/UdhaariLedgerSheet";
import { remaining, useDebts, type Debt } from "@/lib/debts";

export const Route = createFileRoute("/receipts")({ component: ReceiptCenter });

type Filter = "all" | "pending" | "settled" | "month";

function ReceiptCenter() {
  const { debts, ensureReceipt } = useDebts();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = debts.find((debt) => debt.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const debt = debts.find((item) => item.id === selectedId);
    if (debt && !debt.receiptNumber) void ensureReceipt(debt.id).catch(() => toast.error("Could not create receipt number"));
  }, [debts, ensureReceipt, selectedId]);

  const results = useMemo(() => debts.filter((debt) => {
    const matchesQuery = !query.trim() || `${debt.receiptNumber ?? ""} ${debt.title}`.toLowerCase().includes(query.trim().toLowerCase());
    const balance = remaining(debt);
    const matchesFilter = filter === "all" || (filter === "pending" && balance > 0) || (filter === "settled" && balance === 0) || (filter === "month" && new Date(debt.receiptCreatedAt ?? debt.createdAt).getMonth() === new Date().getMonth() && new Date(debt.receiptCreatedAt ?? debt.createdAt).getFullYear() === new Date().getFullYear());
    return matchesQuery && matchesFilter;
  }), [debts, filter, query]);

  return <main className="min-h-screen px-5 pb-12 pt-6"><header className="mb-6 flex items-center gap-3"><Link to="/debts" className="grid size-9 place-items-center rounded-full border border-border bg-card"><ArrowLeft className="size-4" /></Link><div><p className="text-[10px] font-bold uppercase tracking-widest text-neon">MoneyFYI</p><h1 className="text-2xl font-display font-bold">Receipt Center</h1></div></header><div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-foreground/40" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search receipt number or person" className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-neon" /></div><div className="mt-4 flex gap-2 overflow-x-auto">{(["all", "pending", "settled", "month"] as Filter[]).map((value) => <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold capitalize ${filter === value ? "bg-neon text-neon-foreground" : "bg-secondary text-foreground/70"}`}>{value === "month" ? "This Month" : value}</button>)}</div><div className="mt-5 space-y-3">{results.map((debt) => <ReceiptCard key={debt.id} debt={debt} onOpen={() => setSelectedId(debt.id)} />)}{results.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-foreground/50">No matching receipts.</div>}</div>{selected && <ReceiptSheet debt={selected} onClose={() => setSelectedId(null)} onEdit={() => setSelectedId(null)} />}</main>;
}

function ReceiptCard({ debt, onOpen }: { debt: Debt; onOpen: () => void }) {
  return <button onClick={onOpen} className="w-full rounded-2xl border border-border bg-card p-4 text-left transition hover:border-neon/50"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-neon/10 text-neon"><FileText className="size-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{debt.receiptNumber ?? "Receipt number will be assigned"}</p><p className="mt-1 text-xs text-foreground/60">{debt.title}{debt.contactPhone ? ` · ${debt.contactPhone}` : ""}</p><p className="mt-2 text-[11px] text-foreground/45">Generated {new Date(debt.receiptCreatedAt ?? debt.createdAt).toLocaleString("en-IN")}</p></div><div className="text-right"><p className="text-sm font-bold text-neon">₹{remaining(debt).toLocaleString("en-IN")}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-foreground/40">{remaining(debt) > 0 ? "Pending" : "Settled"}</p></div></div></button>;
}
