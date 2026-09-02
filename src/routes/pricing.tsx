import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Crown, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { createCheckout, confirmCheckout, paymentsStatus, type PaidPlan } from "@/lib/payments.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — MONEY.FYI Pro at ₹100/month" },
      {
        name: "description",
        content:
          "Unlock MONEY.FYI: AI money coach, bill scan, udhari & EMI planner and analytics. ₹100 per month or one-time lifetime access, paid securely via Cashfree.",
      },
      { property: "og:title", content: "MONEY.FYI Pricing — ₹100/month" },
      { property: "og:description", content: "Go Pro for ₹100/month or grab lifetime access. Secure Cashfree checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pricing,
});

const FEATURES = [
  "Unlimited daily / weekly / monthly tracking",
  "AI money coach with real human voice",
  "Bill & receipt scanner (OCR)",
  "Udhari + EMI payoff planner with reminders",
  "Weekly & monthly graph analysis",
  "Auto voice alerts on every kharcha",
];

declare global {
  interface Window {
    Cashfree?: (opts: { mode: string }) => { checkout: (o: Record<string, unknown>) => Promise<unknown> };
  }
}

function loadSdk(): Promise<NonNullable<Window["Cashfree"]>> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve(window.Cashfree);
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => (window.Cashfree ? resolve(window.Cashfree) : reject(new Error("SDK failed")));
    s.onerror = () => reject(new Error("Could not load Cashfree checkout"));
    document.head.appendChild(s);
  });
}

function Pricing() {
  const navigate = useNavigate();
  const { user, subscription, isPro, refresh } = useAuth();
  const start = useServerFn(createCheckout);
  const confirm = useServerFn(confirmCheckout);
  const status = useServerFn(paymentsStatus);
  const [busy, setBusy] = useState<PaidPlan | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [mode, setMode] = useState("sandbox");
  const [keyError, setKeyError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    status()
      .then((r) => {
        setReady(r.ready);
        setMode(r.mode);
        setKeyError(r.keysValid ? "" : r.error);
      })
      .catch(() => setReady(false));
  }, [status]);

  // Cashfree redirects back with ?order_id=... — verify and activate.
  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId || !user) return;
    setVerifying(true);
    (async () => {
      for (let i = 0; i < 6; i++) {
        try {
          const r = await confirm({ data: { orderId } });
          if (r.status === "paid") {
            await refresh();
            toast.success(r.plan === "lifetime" ? "Lifetime unlocked 🎉" : "Pro activated — 30 days added 🎉");
            window.history.replaceState({}, "", "/pricing");
            setVerifying(false);
            return;
          }
          if (r.status === "failed") {
            toast.error("Payment failed or cancelled");
            break;
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Verification failed");
          break;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
      setVerifying(false);
      window.history.replaceState({}, "", "/pricing");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const pay = async (plan: PaidPlan) => {
    if (!user) {
      toast.error("Sign in first to subscribe");
      return;
    }
    setBusy(plan);
    try {
      const [sdk, order] = await Promise.all([
        loadSdk(),
        start({ data: { plan, returnUrl: `${window.location.origin}/pricing` } }),
      ]);
      const cf = sdk({ mode: order.mode === "production" ? "production" : "sandbox" });
      await cf.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: "_self" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  };

  const plan = subscription?.plan ?? "free";
  const trialLeft = subscription?.trial_ends_at ? +new Date(subscription.trial_ends_at) - Date.now() : null;

  return (
    <main className="min-h-dvh px-5 pt-6 pb-28">
      <div className="flex items-center gap-3">
        <button
          onClick={() => void navigate({ to: "/" })}
          className="size-9 rounded-full bg-card grid place-items-center active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-2xl font-display font-bold">Pricing</h1>
        {mode === "sandbox" && ready && (
          <span className="ml-auto rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
            test mode
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-foreground/60 leading-relaxed">
        Paisa track karo, AI se plan banao. Cancel anytime — payments secured by Cashfree (UPI, cards,
        netbanking, wallets).
      </p>

      {verifying && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-card p-3 text-sm">
          <Loader2 className="size-4 animate-spin text-neon" /> Verifying your payment…
        </div>
      )}

      {isPro && (
        <div className="mt-4 rounded-2xl bg-neon/10 border border-neon/30 p-4">
          <p className="text-sm font-bold text-neon flex items-center gap-2">
            <ShieldCheck className="size-4" /> You are on {plan === "lifetime" ? "Lifetime" : "Pro"}
          </p>
          {plan === "pro" && subscription?.current_period_end && (
            <p className="mt-1 text-xs text-foreground/60">
              Renews / expires on {new Date(subscription.current_period_end).toLocaleDateString("en-IN")}
            </p>
          )}
        </div>
      )}

      {!isPro && trialLeft !== null && trialLeft > 0 && (
        <div className="mt-4 rounded-2xl bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-foreground/50">Free trial</p>
          <p className="mt-1 text-sm">
            {Math.max(1, Math.floor(trialLeft / 3600_000))} hours left. Upgrade now — trial ka data safe
            rahega.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-card p-5 border border-neon/40 relative overflow-hidden"
        >
          <span className="absolute top-4 right-4 rounded-full bg-neon px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neon-foreground">
            popular
          </span>
          <Zap className="size-6 text-neon" />
          <h2 className="mt-3 text-lg font-display font-bold">Pro — monthly</h2>
          <p className="mt-1 flex items-end gap-1">
            <span className="text-4xl font-display font-bold">₹100</span>
            <span className="pb-1 text-sm text-foreground/50">/ month</span>
          </p>
          <ul className="mt-4 space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-foreground/80">
                <Check className="size-4 shrink-0 text-neon mt-0.5" /> {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => void pay("pro")}
            disabled={busy !== null || ready === false}
            className="mt-5 w-full rounded-xl bg-neon py-3.5 text-sm font-bold text-neon-foreground active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy === "pro" && <Loader2 className="size-4 animate-spin" />}
            {plan === "pro" ? "Extend 30 days — ₹100" : "Subscribe — ₹100 / month"}
          </button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="rounded-3xl bg-card p-5"
        >
          <Crown className="size-6 text-accent" />
          <h2 className="mt-3 text-lg font-display font-bold">Lifetime</h2>
          <p className="mt-1 flex items-end gap-1">
            <span className="text-4xl font-display font-bold">₹999</span>
            <span className="pb-1 text-sm text-foreground/50">one-time</span>
          </p>
          <p className="mt-3 text-sm text-foreground/70 leading-relaxed">
            Sab Pro features, forever. Ek baar pay karo — koi monthly tension nahi, future updates bhi free.
          </p>
          <button
            onClick={() => void pay("lifetime")}
            disabled={busy !== null || ready === false || plan === "lifetime"}
            className="mt-5 w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-accent-foreground active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy === "lifetime" && <Loader2 className="size-4 animate-spin" />}
            {plan === "lifetime" ? "You own Lifetime" : "Get Lifetime — ₹999"}
          </button>
        </motion.section>

        <section className="rounded-3xl bg-card/60 p-5">
          <Sparkles className="size-5 text-foreground/50" />
          <h3 className="mt-2 text-sm font-bold">Free trial</h3>
          <p className="mt-1 text-sm text-foreground/60 leading-relaxed">
            Every new account gets 24 hours of full access. After that the app locks until you subscribe.
          </p>
        </section>
      </div>

      {ready === false && (
        <p className="mt-5 text-xs text-danger">
          Payments are not configured yet — Cashfree keys missing. Add them and reload this page.
        </p>
      )}
    </main>
  );
}
