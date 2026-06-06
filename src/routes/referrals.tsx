import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, ExternalLink, Gift, Pencil, Plus, RotateCcw, Share2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  REFERRAL_APPS,
  getStats,
  getLinks,
  setLinks,
  resolveUrl,
  trackClick,
  logSignup,
  resetApp,
  getMyReferral,
  setMyReferral,
  myReferralUrl,
  type AppStats,
  type LinksMap,
} from "@/lib/referrals";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Referral Earnings — MONEY.FYI" },
      { name: "description", content: "Track your referral signups and earnings from saving apps and MONEY.FYI invites." },
    ],
  }),
  component: ReferralsPage,
});

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

function ReferralsPage() {
  const [stats, setStatsState] = useState<Record<string, AppStats>>({});
  const [links, setLinksState] = useState<LinksMap>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [myCode, setMyCode] = useState("");
  const [mySignups, setMySignups] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStatsState(getStats());
    setLinksState(getLinks());
    const me = getMyReferral();
    setMyCode(me.code);
    setMySignups(me.signups);
  }, []);

  const refresh = () => setStatsState(getStats());

  const totals = useMemo(() => {
    let signups = 0, earnings = 0, clicks = 0;
    for (const a of REFERRAL_APPS) {
      const s = stats[a.id] ?? { clicks: 0, signups: 0, earnings: 0 };
      signups += s.signups; earnings += s.earnings; clicks += s.clicks;
    }
    return { signups: signups + mySignups, earnings, clicks };
  }, [stats, mySignups]);

  const startEdit = (id: string) => {
    setEditing(id);
    setDraftUrl(links[id]?.url ?? "");
  };

  const saveEdit = () => {
    if (!editing) return;
    const url = draftUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) return toast.error("URL must start with http(s)://");
    const next = { ...links, [editing]: { ...(links[editing] ?? {}), url: url || undefined } };
    setLinks(next);
    setLinksState(next);
    setEditing(null);
    toast.success(url ? "Saved your link" : "Reset to default");
  };

  const openApp = (id: string, perSignup: number) => {
    const app = REFERRAL_APPS.find((a) => a.id === id)!;
    trackClick(id);
    refresh();
    window.open(resolveUrl(app), "_blank", "noreferrer");
  };

  const onLogSignup = (id: string, perSignup: number) => {
    logSignup(id, perSignup);
    refresh();
    toast.success(`+${inr(perSignup)} logged`);
  };

  const onReset = (id: string) => {
    resetApp(id);
    refresh();
    toast("Cleared", { icon: "🧹" });
  };

  const myUrl = typeof window !== "undefined" ? myReferralUrl() : "";

  const copyMine = async () => {
    try { await navigator.clipboard.writeText(myUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success("Link copied"); }
    catch { toast.error("Copy failed"); }
  };

  const shareMine = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: "MONEY.FYI", text: "Track your money like a pro 💸", url: myUrl }); } catch {}
    } else {
      copyMine();
    }
  };

  const regenerate = () => {
    const code = "MFY-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const me = { code, signups: mySignups };
    setMyReferral(me);
    setMyCode(code);
    toast.success("New code generated");
  };

  const bumpMySignups = (delta: number) => {
    const next = Math.max(0, mySignups + delta);
    setMyReferral({ code: myCode, signups: next });
    setMySignups(next);
  };

  return (
    <div className="px-5 pt-6">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/debts" className="size-9 bg-card rounded-full border border-border flex items-center justify-center">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold">Referral Earnings</h1>
          <p className="text-[10px] text-foreground/50 uppercase tracking-widest">Signups • Income • Links</p>
        </div>
      </header>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Signups" value={String(totals.signups)} icon={<Users className="size-3.5" />} tint="text-neon" />
        <Stat label="Earnings" value={inr(totals.earnings)} icon={<Wallet className="size-3.5" />} tint="text-success" />
        <Stat label="Clicks" value={String(totals.clicks)} icon={<ExternalLink className="size-3.5" />} tint="text-accent" />
      </div>

      {/* My MONEY.FYI link */}
      <div className="bg-gradient-to-br from-neon/20 via-card to-card border border-neon/30 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="size-3.5 text-neon" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-neon">Your MONEY.FYI Invite</p>
        </div>
        <p className="text-[11px] text-foreground/60 mb-3">Share this link — when a friend signs up, both of you win.</p>

        <div className="bg-secondary/70 rounded-xl px-3 py-2.5 text-xs font-mono break-all mb-2">{myUrl}</div>

        <div className="flex gap-2">
          <button onClick={copyMine} className="flex-1 bg-neon text-neon-foreground font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={shareMine} className="flex-1 bg-secondary font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5">
            <Share2 className="size-3.5" /> Share
          </button>
          <button onClick={regenerate} aria-label="Regenerate code" className="size-10 rounded-xl bg-secondary grid place-items-center">
            <RotateCcw className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-bold">Friends joined</p>
            <p className="text-lg font-display font-bold">{mySignups}</p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => bumpMySignups(-1)} className="size-9 rounded-xl bg-secondary text-sm font-bold">−</button>
            <button onClick={() => bumpMySignups(1)} className="size-9 rounded-xl bg-neon text-neon-foreground text-sm font-bold flex items-center justify-center">
              <Plus className="size-4" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>

      {/* Saving apps */}
      <div className="flex items-center gap-2 mb-2 mt-6">
        <Gift className="size-3.5 text-success" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Saving Apps</p>
      </div>
      <p className="text-[11px] text-foreground/55 mb-3">
        Tap an app to open via your link. When a friend signs up, hit <b>+1 Signup</b> to log the kickback.
      </p>

      <div className="space-y-2.5">
        {REFERRAL_APPS.map((app) => {
          const s = stats[app.id] ?? { clicks: 0, signups: 0, earnings: 0 };
          const custom = links[app.id]?.url;
          return (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-secondary grid place-items-center text-xl">{app.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold">{app.name}</p>
                    {custom && <span className="text-[8px] uppercase tracking-widest font-bold bg-neon/15 text-neon px-1.5 py-0.5 rounded">YOUR LINK</span>}
                  </div>
                  <p className="text-[10px] text-foreground/55 truncate">{app.tagline}</p>
                </div>
                <button onClick={() => startEdit(app.id)} aria-label="Edit link" className="size-8 rounded-lg bg-secondary grid place-items-center">
                  <Pencil className="size-3.5" />
                </button>
              </div>

              {editing === app.id ? (
                <div className="mt-3 space-y-2">
                  <input
                    autoFocus value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder={app.defaultUrl}
                    className="w-full bg-secondary rounded-xl px-3 py-2.5 text-xs outline-none placeholder:text-foreground/30"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(null)} className="flex-1 bg-secondary py-2 rounded-xl text-xs font-bold">Cancel</button>
                    <button onClick={saveEdit} className="flex-1 bg-neon text-neon-foreground py-2 rounded-xl text-xs font-bold">Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <Mini label="Clicks" value={String(s.clicks)} />
                    <Mini label="Signups" value={String(s.signups)} tint="text-neon" />
                    <Mini label="Earned" value={inr(s.earnings)} tint="text-success" />
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => openApp(app.id, app.perSignup)}
                      className="flex-1 bg-secondary font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="size-3" /> Open
                    </button>
                    <button
                      onClick={() => onLogSignup(app.id, app.perSignup)}
                      className={`flex-1 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 bg-success/15 ${app.color}`}
                    >
                      <Plus className="size-3" strokeWidth={3} /> Signup (+{inr(app.perSignup)})
                    </button>
                    {(s.clicks || s.signups) ? (
                      <button onClick={() => onReset(app.id)} aria-label="Reset" className="size-9 rounded-xl bg-secondary grid place-items-center">
                        <RotateCcw className="size-3.5 text-foreground/50" />
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="text-[10px] text-foreground/40 mt-4 mb-2 text-center">
        Earnings are estimates per partner program. Replace the link on each card with your personal referral URL.
      </p>
    </div>
  );
}

function Stat({ label, value, icon, tint }: { label: string; value: string; icon: React.ReactNode; tint: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-2.5">
      <div className={`flex items-center gap-1 ${tint}`}>{icon}<span className="text-[9px] font-bold uppercase tracking-widest">{label}</span></div>
      <p className="text-base font-display font-bold mt-0.5">{value}</p>
    </div>
  );
}

function Mini({ label, value, tint = "text-foreground" }: { label: string; value: string; tint?: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-1.5 text-center">
      <p className="text-[9px] text-foreground/45 uppercase tracking-widest font-bold">{label}</p>
      <p className={`text-xs font-bold ${tint}`}>{value}</p>
    </div>
  );
}
