import { createFileRoute } from "@tanstack/react-router";
import { AIAdvisorCard } from "@/components/AIAdvisorCard";
import { LiveVoiceChat } from "@/components/LiveVoiceChat";
import { useStore, inRange, totals } from "@/lib/store";
<<<<<<< HEAD
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { hasActivePremium } from "@/lib/premium";
=======
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Coach — MONEY.FYI" },
<<<<<<< HEAD
      {
        name: "description",
        content: "Your AI money coach analyses spending and gives voice tips.",
      },
=======
      { name: "description", content: "Your AI money coach analyses spending and gives voice tips." },
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256
    ],
  }),
  component: AIPage,
});

<<<<<<< HEAD
function INR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
=======
function INR(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256

function AIPage() {
  const { transactions } = useStore();
  const { t } = useI18n();
<<<<<<< HEAD
  const { subscription } = useAuth();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const week = useMemo(() => totals(inRange(transactions, 7)), [transactions]);
  const month = useMemo(() => totals(inRange(transactions, 30)), [transactions]);
  const trialExpired =
    !hasActivePremium(subscription, now) &&
    Boolean(subscription?.trial_ends_at && Date.parse(subscription.trial_ends_at) <= now);

  if (trialExpired)
    return (
      <div className="px-5 pt-6">
        <h1 className="mb-5 text-2xl font-display font-bold">Your money brain</h1>
        <LiveVoiceChat />
      </div>
    );
=======
  const week = useMemo(() => totals(inRange(transactions, 7)), [transactions]);
  const month = useMemo(() => totals(inRange(transactions, 30)), [transactions]);
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256

  return (
    <div className="px-5 pt-6">
      <header className="mb-5">
<<<<<<< HEAD
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
          {t("ai")} Coach
        </p>
=======
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("ai")} Coach</p>
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256
        <h1 className="text-2xl font-display font-bold mt-1">Your money brain</h1>
      </header>

      <AIAdvisorCard />

      <div className="mt-4">
        <LiveVoiceChat />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="bg-card rounded-2xl p-4">
<<<<<<< HEAD
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
            7-day spend
          </p>
          <p className="text-xl font-display font-bold mt-1 text-danger">{INR(week.expense)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
            30-day spend
          </p>
          <p className="text-xl font-display font-bold mt-1 text-danger">{INR(month.expense)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
            7-day saved
          </p>
          <p
            className={`text-xl font-display font-bold mt-1 ${week.balance >= 0 ? "text-neon" : "text-danger"}`}
          >
            {INR(week.balance)}
          </p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
            30-day saved
          </p>
          <p
            className={`text-xl font-display font-bold mt-1 ${month.balance >= 0 ? "text-neon" : "text-danger"}`}
          >
            {INR(month.balance)}
          </p>
=======
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">7-day spend</p>
          <p className="text-xl font-display font-bold mt-1 text-danger">{INR(week.expense)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">30-day spend</p>
          <p className="text-xl font-display font-bold mt-1 text-danger">{INR(month.expense)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">7-day saved</p>
          <p className={`text-xl font-display font-bold mt-1 ${week.balance >= 0 ? "text-neon" : "text-danger"}`}>{INR(week.balance)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">30-day saved</p>
          <p className={`text-xl font-display font-bold mt-1 ${month.balance >= 0 ? "text-neon" : "text-danger"}`}>{INR(month.balance)}</p>
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256
        </div>
      </div>

      <div className="mt-6 p-5 bg-gradient-to-br from-accent/20 to-neon/10 border border-accent/30 rounded-2xl">
        <p className="text-[10px] font-bold text-accent uppercase tracking-widest">How it works</p>
        <p className="text-sm mt-2 text-foreground/80 leading-relaxed">
<<<<<<< HEAD
          Guru Voice AI is a Premium feature for Hindi, Hinglish and English conversations based on
          your saved income, expenses, Udhari and EMI records. Voice replies use ElevenLabs with a
          device-voice fallback. Your existing spending insights remain available above.
=======
          The coach reads your recent spending, flags wasteful categories, and speaks the advice out loud in your chosen language using ElevenLabs voice.
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256
        </p>
      </div>
    </div>
  );
}
