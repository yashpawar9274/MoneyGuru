import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Crown, Mail, UserRound, WalletCards, ReceiptText, HandCoins, Settings, LogOut, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { totals, useStore } from "@/lib/store";
import { useDebts } from "@/lib/debts";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — MoneyGuruAI" }, { name: "description", content: "Your MoneyGuruAI account, plan and money activity." }] }),
  component: ProfilePage,
});

function money(n: number) { return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }

function ProfilePage() {
  const { user, profile, subscription, isPro, signOut } = useAuth();
  const { transactions } = useStore();
  const { debts } = useDebts();
  const summary = useMemo(() => totals(transactions), [transactions]);
  const udhari = useMemo(() => debts.reduce((sum, d) => sum + Math.max(0, d.principal - d.payments.reduce((s, p) => s + p.amount, 0)), 0), [debts]);
  const initials = (profile?.full_name || user?.email || "MG").slice(0, 2).toUpperCase();
  const plan = subscription?.plan ?? "free";

  return <main className="min-h-dvh px-5 pt-6 pb-28">
    <header className="flex items-center gap-3">
      <Link to="/" className="size-9 rounded-full bg-card grid place-items-center" aria-label="Back"><ArrowLeft className="size-4" /></Link>
      <div><p className="text-[10px] uppercase tracking-widest text-foreground/40 font-bold">Account</p><h1 className="text-2xl font-display font-bold">Your profile</h1></div>
    </header>

    <section className="mt-6 rounded-3xl bg-card border border-border p-5">
      <div className="flex items-center gap-4">
        <div className="size-16 overflow-hidden rounded-full bg-accent grid place-items-center font-bold text-accent-foreground text-lg">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="size-full object-cover" /> : initials}</div>
        <div className="min-w-0 flex-1"><h2 className="font-display font-bold text-lg truncate">{profile?.full_name || "MoneyGuruAI User"}</h2><p className="text-sm text-foreground/50 truncate">{user?.email}</p><span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${isPro ? "bg-neon text-neon-foreground" : "bg-secondary"}`}>{isPro ? <Crown className="size-3" /> : <ShieldCheck className="size-3" />}{plan}</span></div>
      </div>
    </section>

    <section className="mt-4 grid grid-cols-2 gap-3">
      <Stat label="Balance" value={money(summary.balance)} icon={WalletCards}/><Stat label="Transactions" value={String(transactions.length)} icon={ReceiptText}/><Stat label="Income" value={money(summary.income)} icon={WalletCards}/><Stat label="Udhari" value={money(udhari)} icon={HandCoins}/>
    </section>

    <section className="mt-4 rounded-3xl bg-card border border-border overflow-hidden">
      <Row icon={UserRound} title="Name" value={profile?.full_name || "Not set"}/><Row icon={Mail} title="Email" value={user?.email || "Not set"}/><Row icon={WalletCards} title="Currency" value={profile?.currency || "INR"}/><Row icon={Crown} title="Plan" value={plan === "pro" ? "Pro — monthly" : plan === "lifetime" ? "Lifetime" : "Free"}/>
      {subscription?.current_period_end && <Row icon={ShieldCheck} title="Plan valid until" value={new Date(subscription.current_period_end).toLocaleDateString("en-IN")}/>} 
    </section>

    <div className="mt-4 grid gap-3">
      <Link to="/settings" className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3"><Settings className="size-5 text-neon"/><span className="font-semibold text-sm">Profile & App Settings</span><span className="ml-auto">→</span></Link>
      <Link to="/pricing" className="rounded-2xl bg-neon text-neon-foreground p-4 flex items-center gap-3"><Crown className="size-5"/><span className="font-bold text-sm">{isPro ? "Manage your plan" : "Upgrade MoneyGuruAI"}</span><span className="ml-auto">→</span></Link>
      <button onClick={() => void signOut()} className="rounded-2xl border border-border p-4 flex items-center gap-3 text-foreground/70"><LogOut className="size-5"/><span className="font-semibold text-sm">Sign out</span></button>
    </div>
  </main>;
}

function Stat({label,value,icon:Icon}:{label:string;value:string;icon:any}) { return <div className="rounded-2xl bg-card border border-border p-4"><Icon className="size-4 text-neon"/><p className="mt-3 text-[10px] uppercase tracking-widest text-foreground/40 font-bold">{label}</p><p className="mt-1 font-display font-bold truncate">{value}</p></div>; }
function Row({icon:Icon,title,value}:{icon:any;title:string;value:string}) { return <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0"><Icon className="size-4 text-foreground/45"/><span className="text-sm text-foreground/60">{title}</span><span className="ml-auto max-w-[55%] truncate text-sm font-semibold text-right">{value}</span></div>; }
