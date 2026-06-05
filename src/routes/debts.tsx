import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Trash2, X, Check, HandCoins, Wallet, CreditCard, Bell, Sparkles, CalendarClock, Brain, PiggyBank, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useDebts, remaining, paidTotal, forecast, daysUntil, type DebtKind, type Debt, type PayFreq } from "@/lib/debts";
import { getDebtAdvice } from "@/lib/debt-advice.functions";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/debts")({
  head: () => ({
    meta: [
      { title: "Udhari & EMI — MONEY.FYI" },
      { name: "description", content: "Track udhari (loans) and EMIs. Mark payments and see remaining balance." },
    ],
  }),
  component: DebtsPage,
});

const KIND_META: Record<DebtKind, { label: string; emoji: string; tint: string; Icon: typeof HandCoins }> = {
  udhari_given: { label: "Udhari Given", emoji: "🤝", tint: "text-success", Icon: HandCoins },
  udhari_taken: { label: "Udhari Taken", emoji: "💸", tint: "text-danger", Icon: Wallet },
  emi: { label: "EMI", emoji: "📅", tint: "text-accent", Icon: CreditCard },
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const FREQ_LABEL: Record<PayFreq, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

function fmtDuration(days: number) {
  if (days < 1) return "Today";
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  return rem === 0 ? `${months} mo` : `${months} mo ${rem}d`;
}

function DebtsPage() {
  const { debts, addDebt, removeDebt, addPayment } = useDebts();
  const [openAdd, setOpenAdd] = useState(false);
  const [payFor, setPayFor] = useState<Debt | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const { transactions } = useStore();
  const fetchAdvice = useServerFn(getDebtAdvice);
  const [advice, setAdvice] = useState<Awaited<ReturnType<typeof getDebtAdvice>> | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceOpen, setAdviceOpen] = useState(false);

  const runAdvice = async () => {
    if (debts.filter((d) => d.kind !== "udhari_given" && remaining(d) > 0).length === 0) return toast.error("Add a debt first");
    setAdviceLoading(true);
    setAdviceOpen(true);
    try {
      const now = Date.now();
      const monthTx = transactions.filter((t) => +new Date(t.date) >= now - 30 * 86400000);
      let inc = 0, exp = 0;
      for (const t of monthTx) {
        if (t.type === "income") inc += t.amount;
        else exp += t.amount;
      }
      const payload = {
        lang: "hi" as const,
        monthlyIncome: inc || undefined,
        monthlyExpense: exp || undefined,
        debts: debts.filter((d) => d.kind !== "udhari_given" && remaining(d) > 0).map((d) => ({
          title: d.title,
          kind: d.kind,
          remaining: remaining(d),
          monthly: d.monthly,
          planAmount: d.planAmount,
          planFreq: d.planFreq,
          dueInDays: daysUntil(d.dueDate),
        })),
      };
      const res = await fetchAdvice({ data: payload });
      setAdvice(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
      setAdviceOpen(false);
    } finally {
      setAdviceLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifEnabled(Notification.permission === "granted");
  }, []);

  // Fire in-app + browser reminders for items due in <=3 days, once per day per debt
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    const key = "money_fyi_debt_reminders_v1";
    let sent: Record<string, string> = {};
    try { sent = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
    let changed = false;
    for (const d of debts) {
      if (remaining(d) === 0) continue;
      const du = daysUntil(d.dueDate);
      if (du === null || du > 3 || du < 0) continue;
      if (sent[d.id] === today) continue;
      const msg = du === 0 ? `${d.title} is due today` : `${d.title} due in ${du} day${du === 1 ? "" : "s"}`;
      toast(msg, { icon: "🔔", duration: 6000 });
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification("Payment reminder", { body: msg, icon: "/icon-512.png" }); } catch {}
      }
      sent[d.id] = today;
      changed = true;
    }
    if (changed) localStorage.setItem(key, JSON.stringify(sent));
  }, [debts]);

  const enableNotifications = async () => {
    if (!("Notification" in window)) return toast.error("Browser doesn't support notifications");
    const p = await Notification.requestPermission();
    if (p === "granted") {
      setNotifEnabled(true);
      toast.success("Reminders on");
      try { new Notification("MONEY.FYI", { body: "You'll get alerts before due dates", icon: "/icon-512.png" }); } catch {}
    } else {
      toast.error("Permission denied");
    }
  };

  const totals = useMemo(() => {
    let owe = 0, lent = 0, emi = 0;
    for (const d of debts) {
      const r = remaining(d);
      if (d.kind === "udhari_taken") owe += r;
      else if (d.kind === "udhari_given") lent += r;
      else emi += r;
    }
    return { owe, lent, emi };
  }, [debts]);

  const myDebts = useMemo(
    () => debts.filter((d) => d.kind !== "udhari_given" && remaining(d) > 0),
    [debts],
  );

  const freedom = useMemo(() => {
    let maxDays = 0;
    let totalLeft = 0;
    let planned = 0;
    for (const d of myDebts) {
      totalLeft += remaining(d);
      const f = forecast(d);
      if (f) {
        planned++;
        if (f.days > maxDays) maxDays = f.days;
      }
    }
    return { maxDays, totalLeft, planned, unplanned: myDebts.length - planned };
  }, [myDebts]);

  const upcoming = useMemo(
    () =>
      debts
        .map((d) => ({ d, du: daysUntil(d.dueDate) }))
        .filter((x) => x.du !== null && x.du >= 0 && x.du <= 7 && remaining(x.d) > 0)
        .sort((a, b) => (a.du! - b.du!)),
    [debts],
  );

  return (
    <div className="px-5 pt-6">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/" className="size-9 bg-card rounded-full border border-border flex items-center justify-center">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold">Udhari & EMI</h1>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest">Free tracker</p>
        </div>
        {!notifEnabled && (
          <button
            onClick={enableNotifications}
            className="text-[10px] font-bold uppercase tracking-widest bg-secondary rounded-full px-3 py-1.5 flex items-center gap-1"
          >
            <Bell className="size-3" /> Alerts
          </button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="You Owe" value={inr(totals.owe)} tint="text-danger" />
        <StatCard label="Lent Out" value={inr(totals.lent)} tint="text-success" />
        <StatCard label="EMI Left" value={inr(totals.emi)} tint="text-accent" />
      </div>

      {myDebts.length > 0 && (
        <div className="bg-gradient-to-br from-neon/15 via-card to-card border border-neon/30 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-4 text-neon" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-neon">Debt Freedom Plan</p>
          </div>
          {freedom.maxDays > 0 ? (
            <>
              <p className="text-2xl font-display font-bold">{fmtDuration(freedom.maxDays)}</p>
              <p className="text-[11px] text-foreground/60 mt-0.5">
                Mukti by {new Date(Date.now() + freedom.maxDays * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className="text-[10px] text-foreground/50 mt-2">
                {freedom.planned} of {myDebts.length} planned · {inr(freedom.totalLeft)} pending
              </p>
            </>
          ) : (
            <p className="text-xs text-foreground/60">
              Add a payment plan (daily / weekly / monthly) to each debt to see when you'll be debt-free.
            </p>
          )}
          {freedom.unplanned > 0 && freedom.maxDays > 0 && (
            <p className="text-[10px] text-warning mt-1">{freedom.unplanned} debt{freedom.unplanned === 1 ? "" : "s"} missing a plan</p>
          )}
        </div>
      )}

      <button
        onClick={runAdvice}
        disabled={adviceLoading}
        className="w-full mb-4 bg-gradient-to-r from-accent/20 to-neon/20 border border-accent/40 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform disabled:opacity-60"
      >
        <div className="size-9 rounded-xl bg-accent/20 grid place-items-center">
          {adviceLoading ? <Loader2 className="size-4 animate-spin text-accent" /> : <Brain className="size-4 text-accent" />}
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-bold">AI Debt Coach</p>
          <p className="text-[10px] text-foreground/60">Daily pay plan + where to park savings</p>
        </div>
        <Sparkles className="size-4 text-neon" />
      </button>



      {upcoming.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="size-3.5 text-accent" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Due This Week</p>
          </div>
          <div className="space-y-1.5">
            {upcoming.map(({ d, du }) => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="truncate">{d.title}</span>
                <span className={`font-bold ${du! <= 1 ? "text-danger" : "text-warning"}`}>
                  {du === 0 ? "Today" : du === 1 ? "Tomorrow" : `${du}d`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpenAdd(true)}
        className="w-full bg-neon text-neon-foreground font-bold py-3.5 rounded-2xl text-sm tracking-wide neon-glow active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mb-5"
      >
        <Plus className="size-4" strokeWidth={3} /> Add Udhari / EMI
      </button>

      {debts.length === 0 && (
        <div className="text-center py-16 text-sm text-foreground/40">
          No udhari or EMI yet. Tap above to add one.
        </div>
      )}


      <div className="space-y-3">
        {debts.map((d) => {
          const meta = KIND_META[d.kind];
          const left = remaining(d);
          const pct = d.principal > 0 ? Math.min(100, (paidTotal(d) / d.principal) * 100) : 0;
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 bg-secondary rounded-xl grid place-items-center text-xl">{meta.emoji}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{d.title}</p>
                    <p className={`text-[10px] uppercase tracking-widest font-bold ${meta.tint}`}>{meta.label}</p>
                  </div>
                </div>
                <button
                  onClick={() => { removeDebt(d.id); toast.success("Removed"); }}
                  className="size-8 rounded-full bg-secondary grid place-items-center text-foreground/50 hover:text-danger"
                  aria-label="Remove"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-widest text-foreground/40">Remaining</span>
                <span className="text-lg font-display font-bold">{inr(left)}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                <div className="h-full bg-neon" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-foreground/40 mt-1.5">
                <span>Paid {inr(paidTotal(d))}</span>
                <span>of {inr(d.principal)}</span>
              </div>

              {(() => {
                const f = forecast(d);
                if (!f) return null;
                return (
                  <div className="mt-3 bg-neon/5 border border-neon/20 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="size-3 text-neon" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-neon">Mukti in</span>
                    </div>
                    <p className="text-sm font-display font-bold mt-0.5">{fmtDuration(f.days)}</p>
                    <p className="text-[10px] text-foreground/50">
                      {f.installments} × {inr(f.perInstallment)} ({FREQ_LABEL[f.freq]}) · by {f.freedomDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                );
              })()}
              {d.dueDate ? (
                <p className="text-[10px] text-foreground/50 mt-2">Due: {new Date(d.dueDate).toLocaleDateString()}</p>
              ) : null}


              <button
                onClick={() => setPayFor(d)}
                disabled={left === 0}
                className="mt-3 w-full py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Check className="size-3.5" /> {left === 0 ? "Cleared" : "Mark Payment"}
              </button>
            </motion.div>
          );
        })}
      </div>

      <AddDebtSheet
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSave={(d) => { addDebt(d); toast.success("Added"); }}
      />
      <PaymentSheet
        debt={payFor}
        onClose={() => setPayFor(null)}
        onPay={(amt, note) => {
          if (!payFor) return;
          addPayment(payFor.id, amt, note);
          toast.success("Payment recorded");
          setPayFor(null);
        }}
      />
      <AdviceSheet
        open={adviceOpen}
        loading={adviceLoading}
        advice={advice}
        onClose={() => setAdviceOpen(false)}
      />
    </div>
  );
}

function AdviceSheet({
  open, loading, advice, onClose,
}: {
  open: boolean;
  loading: boolean;
  advice: Awaited<ReturnType<typeof getDebtAdvice>> | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-card rounded-t-3xl z-50 p-6 pb-8 border-t border-border max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Brain className="size-5 text-accent" />
                <h2 className="text-lg font-display font-bold">AI Debt Coach</h2>
              </div>
              <button onClick={onClose} className="size-9 rounded-full bg-secondary flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>

            {loading && (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-accent" />
                <p className="text-xs text-foreground/60">Crunching your numbers…</p>
              </div>
            )}

            {!loading && advice && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <PayCard label="Daily" value={advice.dailyPay} tint="text-neon" />
                  <PayCard label="Weekly" value={advice.weeklyPay} tint="text-accent" />
                  <PayCard label="Monthly" value={advice.monthlyPay} tint="text-success" />
                </div>

                <div className="bg-gradient-to-br from-neon/15 to-card border border-neon/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="size-3.5 text-neon" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neon">Mukti in</p>
                  </div>
                  <p className="text-2xl font-display font-bold">{fmtDuration(advice.clearInDays)}</p>
                </div>

                <InfoCard
                  icon={<CreditCard className="size-3.5 text-warning" />}
                  label="Attack First"
                  text={advice.priority}
                  tone="warning"
                />
                <InfoCard
                  icon={<PiggyBank className="size-3.5 text-success" />}
                  label="Park Savings Here"
                  text={advice.saveWhere}
                  tone="success"
                />
                <InfoCard
                  icon={<Sparkles className="size-3.5 text-accent" />}
                  label="Bottom Line"
                  text={advice.summary}
                  tone="accent"
                />

                <p className="text-[10px] text-foreground/40 text-center pt-2">
                  AI suggestion — not financial advice. Adjust to your situation.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PayCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className="bg-secondary rounded-2xl p-3 text-center">
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">{label}</p>
      <p className={`text-base font-display font-bold mt-1 ${tint}`}>₹{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function InfoCard({ icon, label, text, tone }: { icon: React.ReactNode; label: string; text: string; tone: "warning" | "success" | "accent" }) {
  const border = tone === "warning" ? "border-warning/30" : tone === "success" ? "border-success/30" : "border-accent/30";
  const color = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-accent";
  return (
    <div className={`bg-card border ${border} rounded-2xl p-3`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{label}</p>
      </div>
      <p className="text-xs leading-relaxed text-foreground/85">{text}</p>
    </div>
  );
}

function StatCard({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">{label}</p>
      <p className={`text-base font-display font-bold mt-1 ${tint}`}>{value}</p>
    </div>
  );
}

function AddDebtSheet({
  open, onClose, onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (d: { kind: DebtKind; title: string; principal: number; monthly?: number; dueDate?: string; planAmount?: number; planFreq?: PayFreq }) => void;
}) {
  const [kind, setKind] = useState<DebtKind>("udhari_taken");
  const [title, setTitle] = useState("");
  const [principal, setPrincipal] = useState("");
  const [monthly, setMonthly] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [planFreq, setPlanFreq] = useState<PayFreq>("monthly");
  const [planAmount, setPlanAmount] = useState("");

  const submit = () => {
    const p = parseFloat(principal);
    if (!title.trim()) return toast.error("Enter a name/title");
    if (!p || p <= 0) return toast.error("Enter a valid amount");
    const pa = planAmount ? parseFloat(planAmount) : undefined;
    onSave({
      kind,
      title: title.trim(),
      principal: p,
      monthly: monthly ? parseFloat(monthly) : undefined,
      dueDate: dueDate || undefined,
      planAmount: pa,
      planFreq: pa ? planFreq : undefined,
    });
    setTitle(""); setPrincipal(""); setMonthly(""); setDueDate(""); setPlanAmount(""); setPlanFreq("monthly");
    onClose();
  };


  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-card rounded-t-3xl z-50 p-6 pb-8 border-t border-border"
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-display font-bold">Add Udhari / EMI</h2>
              <button onClick={onClose} className="size-9 rounded-full bg-secondary flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(["udhari_taken", "udhari_given", "emi"] as DebtKind[]).map((k) => {
                const m = KIND_META[k];
                return (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`p-3 rounded-2xl border text-center ${
                      kind === k ? "bg-neon/10 border-neon" : "bg-secondary border-transparent"
                    }`}
                  >
                    <div className="text-xl">{m.emoji}</div>
                    <div className="text-[9px] font-bold mt-1 leading-tight">{m.label}</div>
                  </button>
                );
              })}
            </div>

            <Field label="Title / Person">
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Rahul bhai, HDFC car loan"
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-foreground/30"
              />
            </Field>
            <Field label="Total Amount">
              <input
                inputMode="decimal" value={principal}
                onChange={(e) => setPrincipal(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Monthly (opt.)">
                <input
                  inputMode="decimal" value={monthly}
                  onChange={(e) => setMonthly(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </Field>
              <Field label="Due (opt.)">
                <input
                  type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </Field>
            </div>

            <div className="mt-1 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Payoff Plan (helps analyzer)</span>
              <div className="grid grid-cols-3 gap-2 mt-1.5 mb-2">
                {(["daily", "weekly", "monthly"] as PayFreq[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPlanFreq(f)}
                    className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${
                      planFreq === f ? "bg-neon/10 border-neon text-neon" : "bg-secondary border-transparent"
                    }`}
                  >
                    {FREQ_LABEL[f]}
                  </button>
                ))}
              </div>
              <input
                inputMode="decimal" value={planAmount}
                onChange={(e) => setPlanAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={`Amount per ${planFreq.replace("ly", "")}`}
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-foreground/30"
              />
            </div>



            <button
              onClick={submit}
              className="mt-5 w-full bg-neon text-neon-foreground font-bold py-3.5 rounded-2xl text-sm tracking-wide"
            >
              Save
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PaymentSheet({
  debt, onClose, onPay,
}: {
  debt: Debt | null;
  onClose: () => void;
  onPay: (amount: number, note?: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const left = debt ? remaining(debt) : 0;

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    if (n > left) return toast.error(`Cannot exceed remaining ${inr(left)}`);
    onPay(n, note.trim() || undefined);
    setAmount(""); setNote("");
  };

  return (
    <AnimatePresence>
      {debt && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-card rounded-t-3xl z-50 p-6 pb-8 border-t border-border"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-display font-bold">Record Payment</h2>
              <button onClick={onClose} className="size-9 rounded-full bg-secondary flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-foreground/50 mb-4">
              {debt.title} • Remaining {inr(left)}
            </p>

            <Field label="Amount Paid">
              <input
                inputMode="decimal" autoFocus value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="w-full bg-secondary rounded-xl px-3 py-3 text-lg font-bold outline-none"
              />
            </Field>
            <Field label="Note (opt.)">
              <input
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. UPI / Cash"
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-foreground/30"
              />
            </Field>

            <div className="flex gap-2 mt-2 mb-2">
              {[0.25, 0.5, 1].map((f) => (
                <button
                  key={f}
                  onClick={() => setAmount(String(Math.round(left * f)))}
                  className="flex-1 py-2 rounded-xl bg-secondary text-xs font-bold"
                >
                  {f === 1 ? "Full" : `${f * 100}%`}
                </button>
              ))}
            </div>

            <button
              onClick={submit}
              className="mt-4 w-full bg-neon text-neon-foreground font-bold py-3.5 rounded-2xl text-sm tracking-wide"
            >
              Mark Paid
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
