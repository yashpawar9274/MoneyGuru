import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, CreditCard, Database, Loader2, ShieldAlert, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Row = Record<string, unknown>;
type Feed = { customers: Row[]; payments: Row[]; webhooks: Row[]; debts: Row[] };

const emptyFeed: Feed = { customers: [], payments: [], webhooks: [], debts: [] };

function AdminPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [feed, setFeed] = useState<Feed>(emptyFeed);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!active) return;
      if (roleError) { setError(roleError.message); setAllowed(false); return; }
      setAllowed(Boolean(data));
      if (!data) return;
      const [customers, payments, webhooks, debts] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name,updated_at").order("updated_at", { ascending: false }).limit(100),
        supabase.from("payments").select("id,user_id,order_id,amount_inr,plan,status,created_at,updated_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("webhook_logs").select("id,event_type,order_id,status,http_status,signature_valid,message,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("debts").select("id,user_id,title,kind,principal,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      if (!active) return;
      const firstError = customers.error || payments.error || webhooks.error || debts.error;
      if (firstError) setError(firstError.message);
      setFeed({ customers: (customers.data ?? []) as Row[], payments: (payments.data ?? []) as Row[], webhooks: (webhooks.data ?? []) as Row[], debts: (debts.data ?? []) as Row[] });
    };
    void load();
    const channel = supabase
      .channel("admin-live-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "webhook_logs" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [user]);

  if (allowed === null) return <main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-neon" /></main>;
  if (!allowed) return <main className="mx-auto min-h-screen max-w-[440px] px-5 py-12"><ShieldAlert className="size-8 text-danger" /><h1 className="mt-4 text-2xl font-display font-bold">Admin access required</h1><p className="mt-2 text-sm text-foreground/60">{error || "This account is not an administrator."}</p></main>;

  const stats = [
    ["Customers", feed.customers.length, Users],
    ["Payments", feed.payments.length, CreditCard],
    ["Webhook callbacks", feed.webhooks.length, Activity],
    ["Debts", feed.debts.length, Database],
  ] as const;
  return <main className="mx-auto min-h-screen max-w-[900px] px-5 py-8 pb-16">
    <header><p className="text-[10px] font-bold uppercase tracking-widest text-neon">Operations</p><h1 className="mt-1 text-3xl font-display font-bold">Admin dashboard</h1><p className="mt-2 text-sm text-foreground/60">Live customer, payment, webhook and debt feeds.</p></header>
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{stats.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-border bg-card p-4"><Icon className="size-5 text-neon" /><p className="mt-4 text-2xl font-bold">{value}</p><p className="text-xs text-foreground/50">{label}</p></div>)}</div>
    {error && <p className="mt-4 rounded-xl bg-danger/10 p-3 text-xs text-danger">{error}</p>}
    <section className="mt-6 grid gap-4 md:grid-cols-2">
      <Feed title="Recent payments" rows={feed.payments} fields={["order_id", "plan", "amount", "status"]} />
      <Feed title="Webhook logs" rows={feed.webhooks} fields={["event_type", "order_id", "status", "http_status"]} />
      <Feed title="Customers" rows={feed.customers} fields={["full_name", "email"]} />
      <Feed title="Debts" rows={feed.debts} fields={["title", "kind", "principal"]} />
    </section>
  </main>;
}

function Feed({ title, rows, fields }: { title: string; rows: Row[]; fields: string[] }) {
  return <section className="rounded-2xl border border-border bg-card p-4"><h2 className="font-bold">{title}</h2><div className="mt-3 space-y-2">{rows.slice(0, 8).map((row, index) => <div key={String(row.id ?? index)} className="rounded-xl bg-secondary/60 p-3 text-xs">{fields.map((field) => <span key={field} className="mr-3 inline-block"><b className="text-foreground/50">{field}:</b> {String(row[field] ?? "-")}</span>)}</div>)}{rows.length === 0 && <p className="text-xs text-foreground/50">No records yet.</p>}</div></section>;
}