import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Crown, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import type { PaidPlan } from "@/lib/payments.functions";
import { createPayUCheckout, confirmPayUCheckout, payuStatus } from "@/lib/payu.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — MoneyGuruAI from ₹7" },
      {
        name: "description",
        content: "Try MoneyGuruAI for 7 days at ₹7, Pro for ₹100/30 days, or Lifetime for ₹999.",
      },
      { property: "og:title", content: "MoneyGuruAI Pricing — Pro at ₹100/month" },
      {
        property: "og:description",
        content: "Secure PayU plans: ₹7 for 7 days, ₹100 for 30 days, or Lifetime access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pricing,
});

const FEATURES = [
  "Unlimited money tracking",
  "Guru AI money coach",
  "Bill & receipt scanner",
  "Udhari + EMI tools",
  "Advanced analytics",
  "Voice money assistant",
];

function submitPayU(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function Pricing() {
  const navigate = useNavigate();
  const { user, profile, subscription, isPro, refresh } = useAuth();
  const start = useServerFn(createPayUCheckout);
  const confirm = useServerFn(confirmPayUCheckout);
  const status = useServerFn(payuStatus);
  const [busy, setBusy] = useState<PaidPlan | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [mode, setMode] = useState("test");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    status()
      .then((r) => {
        setReady(r.ready);
        setMode(r.mode);
      })
      .catch(() => setReady(false));
  }, [status]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txnid = params.get("payu_txnid");
    const result = params.get("payu_result");
    if (!txnid || !user) return;
    setVerifying(true);
    (async () => {
      for (let i = 0; i < 12; i++) {
        const r = await confirm({ data: { txnid } });
        if (r.status === "paid") {
          await refresh();
          toast.success(
            r.plan === "lifetime"
              ? "Lifetime unlocked"
              : r.plan === "weekly"
                ? "Starter activated — 7 days added"
                : "Pro activated — 30 days added",
          );
          window.history.replaceState({}, "", "/pricing");
          setVerifying(false);
          return;
        }
        if (r.status === "failed") {
          toast.error("Payment failed or cancelled");
          break;
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
      if (
        result === "invalid_hash" ||
        result === "fulfilment_error" ||
        result === "amount_mismatch" ||
        result === "order_not_found"
      )
        toast.error("Payment received but activation needs review. Your order ID is saved.");
      else
        toast.info(
          "Payment is still being verified. Your plan will unlock automatically after PayU confirms it.",
        );
      setVerifying(false);
      window.history.replaceState({}, "", "/pricing");
    })().catch((e) => {
      setVerifying(false);
      toast.error(e instanceof Error ? e.message : "Verification failed");
    });
  }, [confirm, refresh, user]);

  const pay = async (plan: PaidPlan) => {
    if (!user) return toast.error("Sign in first to subscribe");
    if (ready === false) return toast.error("PayU is not configured yet");
    setBusy(plan);
    try {
      const origin = window.location.origin;
      const order = await start({
        data: { plan, returnUrl: origin, firstName: profile?.full_name || undefined },
      });
      submitPayU(order.action, order.fields);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
      setBusy(null);
    }
  };
  const plan = subscription?.plan ?? "free";

  return (
    <main className="min-h-dvh px-5 pt-6 pb-28">
      <div className="flex items-center gap-3">
        <button
          onClick={() => void navigate({ to: "/" })}
          className="size-9 rounded-full bg-card grid place-items-center"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-2xl font-display font-bold">Pricing</h1>
        {ready && (
          <span className="ml-auto rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase">
            PayU {mode === "production" ? "live" : "test"}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-foreground/60">
        Simple SaaS plans. Secure checkout powered by PayU. UPI, cards and other methods depend on
        your PayU merchant account configuration.
      </p>
      {verifying && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-card p-3 text-sm">
          <Loader2 className="size-4 animate-spin text-neon" />
          Verifying payment securely with PayU…
        </div>
      )}
      {isPro && (
        <div className="mt-4 rounded-2xl bg-neon/10 border border-neon/30 p-4">
          <p className="text-sm font-bold text-neon flex gap-2">
            <ShieldCheck className="size-4" />
            You are on{" "}
            {plan === "lifetime" ? "Lifetime" : plan === "weekly" ? "Starter — 7 days" : "Pro"}
          </p>
        </div>
      )}
      <div className="mt-5 space-y-4">
        <PlanCard
          icon={Sparkles}
          title="Starter — 7 days"
          price="₹7"
          suffix="/ 7 days"
          features={FEATURES}
          onClick={() => void pay("weekly")}
          busy={busy === "weekly"}
          disabled={busy !== null || ready === false || plan === "lifetime"}
          button="Try 7 days with PayU — ₹7"
        />
        <PlanCard
          icon={Zap}
          title="Pro — monthly"
          price="₹100"
          suffix="/ 30 days"
          features={FEATURES}
          popular
          onClick={() => void pay("pro")}
          busy={busy === "pro"}
          disabled={busy !== null || ready === false}
          button={plan === "pro" ? "Extend 30 days — ₹100" : "Subscribe with PayU — ₹100"}
        />
        <PlanCard
          icon={Crown}
          title="Lifetime"
          price="₹999"
          suffix="one-time"
          features={["Everything in Pro", "Lifetime access", "Future core updates"]}
          onClick={() => void pay("lifetime")}
          busy={busy === "lifetime"}
          disabled={busy !== null || ready === false || plan === "lifetime"}
          button={plan === "lifetime" ? "You own Lifetime" : "Get Lifetime with PayU — ₹999"}
        />
        <section className="rounded-3xl bg-card/60 p-5">
          <Sparkles className="size-5 text-foreground/50" />
          <h3 className="mt-2 text-sm font-bold">Digital SaaS access</h3>
          <p className="mt-1 text-sm text-foreground/60">
            Paid access is activated only after MoneyGuruAI verifies the PayU transaction
            server-side.
          </p>
        </section>
      </div>
      {ready === false && (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
          <b>PayU setup required:</b> add <code>PAYU_MERCHANT_KEY</code>,{" "}
          <code>PAYU_MERCHANT_SALT</code> and <code>PAYU_ENV</code> to server environment variables.
          Start with test mode.
        </div>
      )}
    </main>
  );
}

function PlanCard({
  icon: Icon,
  title,
  price,
  suffix,
  features,
  popular,
  busy,
  disabled,
  onClick,
  button,
}: {
  icon: LucideIcon;
  title: string;
  price: string;
  suffix: string;
  features: string[];
  popular?: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  button: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl bg-card p-5 relative ${popular ? "border border-neon/40" : "border border-border"}`}
    >
      {popular && (
        <span className="absolute right-4 top-4 rounded-full bg-neon px-2.5 py-1 text-[10px] font-bold uppercase text-neon-foreground">
          popular
        </span>
      )}
      <Icon className="size-6 text-neon" />
      <h2 className="mt-3 text-lg font-display font-bold">{title}</h2>
      <p className="mt-1">
        <span className="text-4xl font-display font-bold">{price}</span>{" "}
        <span className="text-sm text-foreground/50">{suffix}</span>
      </p>
      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex gap-2 text-sm text-foreground/80">
            <Check className="size-4 shrink-0 text-neon" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={disabled}
        className="mt-5 w-full rounded-xl bg-neon py-3.5 text-sm font-bold text-neon-foreground disabled:opacity-50 flex justify-center gap-2"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {button}
      </button>
    </motion.section>
  );
}
