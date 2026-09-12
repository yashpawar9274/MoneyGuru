import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, CreditCard, Loader2, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminDashboard,
  unlockCustomerPro,
  type AdminDashboardData,
} from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — MONEY.FYI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

const emptyData: AdminDashboardData = {
  customers: [],
  payments: [],
  subscriptions: [],
  webhooks: [],
};

function AdminPage() {
  const { user } = useAuth();
  const fetchDashboard = useServerFn(getAdminDashboard);
  const unlock = useServerFn(unlockCustomerPro);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError("");
      setData(await fetchDashboard());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin access required");
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase
      .channel(`admin-refresh-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "webhook_logs" }, load)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);

  const grant = async (userId: string, plan: "pro" | "lifetime") => {
    setUnlocking(`${userId}:${plan}`);
    try {
      const result = await unlock({ data: { userId, plan } });
      toast.success(`${result.email ?? "Customer"} unlocked as ${plan}`);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unlock failed");
    } finally {
      setUnlocking("");
    }
  };

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-neon" />
      </main>
    );
  if (error)
    return (
      <main className="mx-auto min-h-screen max-w-[440px] px-5 py-12">
        <ShieldAlert className="size-8 text-danger" />
        <h1 className="mt-4 text-2xl font-display font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-foreground/60">{error}</p>
      </main>
    );

  const stats = [
    ["Customers", data.customers.length, Users],
    ["Payments", data.payments.length, CreditCard],
    ["Subscriptions", data.subscriptions.length, RefreshCw],
    ["Webhook logs", data.webhooks.length, Activity],
  ] as const;
  return (
    <main className="mx-auto min-h-screen max-w-[1100px] px-5 py-8 pb-24">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neon">
            Secure operations
          </p>
          <h1 className="mt-1 text-3xl font-display font-bold">Admin dashboard</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Live payments, subscriptions and callbacks.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-xl bg-secondary p-3"
          aria-label="Refresh dashboard"
        >
          <RefreshCw className="size-4" />
        </button>
      </header>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <Icon className="size-5 text-neon" />
            <p className="mt-4 text-2xl font-bold">{value}</p>
            <p className="text-xs text-foreground/50">{label}</p>
          </div>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-bold">Customers & direct Pro unlock</h2>
        <div className="mt-3 space-y-2">
          {data.customers.map((customer) => (
            <article
              key={customer.id}
              className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-3 md:flex-row md:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {customer.fullName || customer.email || "Customer"}
                </p>
                <p className="truncate text-xs text-foreground/50">{customer.email}</p>
                <p className="mt-1 text-[10px] uppercase text-neon">
                  {customer.plan} · {customer.subscriptionStatus}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!!unlocking}
                  onClick={() => void grant(customer.id, "pro")}
                  className="rounded-lg bg-neon px-3 py-2 text-xs font-bold text-neon-foreground disabled:opacity-50"
                >
                  {unlocking === `${customer.id}:pro` ? "Unlocking…" : "Pro 30 days"}
                </button>
                <button
                  disabled={!!unlocking}
                  onClick={() => void grant(customer.id, "lifetime")}
                  className="rounded-lg border border-neon/30 px-3 py-2 text-xs font-bold text-neon disabled:opacity-50"
                >
                  Lifetime
                </button>
              </div>
            </article>
          ))}
          {data.customers.length === 0 ? (
            <p className="text-xs text-foreground/50">No customers yet.</p>
          ) : null}
        </div>
      </section>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Recent payments">
          {data.payments.map((payment) => (
            <Row
              key={payment.id}
              title={payment.email || payment.orderId}
              detail={`${payment.plan} · ₹${payment.amountInr} · ${payment.status}`}
              meta={payment.orderId}
            />
          ))}
        </Panel>
        <Panel title="Subscriptions">
          {data.subscriptions.map((subscription) => (
            <Row
              key={subscription.userId}
              title={subscription.email || subscription.userId}
              detail={`${subscription.plan} · ${subscription.status}`}
              meta={
                subscription.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleString("en-IN")
                  : "No expiry"
              }
            />
          ))}
        </Panel>
        <Panel title="Webhook & audit logs">
          {data.webhooks.map((log) => (
            <Row
              key={log.id}
              title={`${log.provider} · ${log.eventType || "callback"}`}
              detail={`${log.status || "unknown"} · HTTP ${log.httpStatus ?? "-"} · signature ${log.signatureValid ? "valid" : "invalid"}`}
              meta={log.message || log.orderId || new Date(log.createdAt).toLocaleString("en-IN")}
            />
          ))}
        </Panel>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-3 max-h-[500px] space-y-2 overflow-y-auto">{children}</div>
    </section>
  );
}
function Row({ title, detail, meta }: { title: string; detail: string; meta: string }) {
  return (
    <article className="rounded-xl bg-secondary/60 p-3 text-xs">
      <p className="truncate font-bold">{title}</p>
      <p className="mt-1 text-foreground/70">{detail}</p>
      <p className="mt-1 break-all text-[10px] text-foreground/40">{meta}</p>
    </article>
  );
}
