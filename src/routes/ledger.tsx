import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, FileText, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ReceiptSheet } from "@/components/UdhaariLedgerSheet";
import { ledger } from "@/lib/debt-proof";
import { remaining, useDebts } from "@/lib/debts";

export const Route = createFileRoute("/ledger")({
  validateSearch: (search: Record<string, unknown>) => ({ debtId: String(search.debtId ?? "") }),
  component: LedgerPage,
});

function LedgerPage() {
  const { debtId } = Route.useSearch();
  const { debts } = useDebts();
  const navigate = useNavigate();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const debt = debts.find((item) => item.id === debtId);
  const items = useMemo(() => debt ? ledger(debt).slice().sort((a, b) => +new Date(a.date) - +new Date(b.date)) : [], [debt]);
  if (!debt) return <main className="p-6"><Link to="/debts" className="text-neon">Back</Link><p className="mt-8 text-sm text-foreground/60">Ledger not found.</p></main>;
  const totalGiven = items.filter((item) => item.kind === "given").reduce((sum, item) => sum + item.amount, 0);
  const totalReceived = items.filter((item) => item.kind === "paid").reduce((sum, item) => sum + item.amount, 0);
  let running = 0;
  return <main className="min-h-screen px-5 pb-12 pt-6"><header className="flex items-start gap-3"><button onClick={() => navigate({ to: "/debts" })} className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold"><ArrowLeft className="size-4" /> Back</button><div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-display font-bold">{debt.title}</h1><p className="text-xs text-foreground/50">{debt.contactPhone || "No mobile number"}</p></div></header><section className="mt-6 grid grid-cols-3 gap-2"><Stat label="Total Given" value={totalGiven} /><Stat label="Received" value={totalReceived} /><Stat label="Pending" value={remaining(debt)} /></section><div className="mt-5 flex gap-2"><button onClick={() => setReceiptOpen(true)} className="flex-1 rounded-2xl bg-neon py-3 text-xs font-bold text-neon-foreground"><FileText className="mr-1 inline size-4" /> Generate Receipt</button><button onClick={() => toast.info("Use Generate Receipt to share the complete ledger")} className="rounded-2xl bg-secondary px-4 text-xs font-bold"><Share2 className="mr-1 inline size-4" /> Share Ledger</button></div><div className="mt-6 space-y-2">{items.map((item) => { running += item.kind === "given" ? item.amount : -item.amount; return <div key={item.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex justify-between"><div><p className="text-sm font-bold">{item.kind === "given" ? "Given" : "Received"}</p><p className="mt-1 text-xs text-foreground/50">{new Date(item.date).toLocaleString("en-IN")}</p>{item.note && <p className="mt-2 text-xs text-foreground/70">{item.note}</p>}</div><div className="text-right"><p className={`text-sm font-bold ${item.kind === "given" ? "text-danger" : "text-success"}`}>{item.kind === "given" ? "+" : "-"}₹{item.amount.toLocaleString("en-IN")}</p><p className="mt-2 text-[10px] uppercase tracking-widest text-foreground/40">Balance ₹{Math.max(0, running).toLocaleString("en-IN")}</p></div></div></div>; })}</div>{receiptOpen && <ReceiptSheet debt={debt} onClose={() => setReceiptOpen(false)} onEdit={() => setReceiptOpen(false)} />}</main>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-border bg-card p-3"><p className="text-[10px] uppercase tracking-widest text-foreground/45">{label}</p><p className="mt-2 text-lg font-bold text-neon">₹{value.toLocaleString("en-IN")}</p></div>; }