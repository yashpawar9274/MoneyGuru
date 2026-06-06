// Referral apps + lightweight tracking stored in localStorage.
// Users can override URLs/codes with their own so kickbacks come to them.

export interface ReferralApp {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  defaultUrl: string;    // homepage / default link
  reward?: string;       // joining bonus blurb
  perSignup: number;     // estimated INR you earn per successful signup
  color: string;         // accent class for cards
}

export const REFERRAL_APPS: ReferralApp[] = [
  { id: "jar",     name: "Jar",     tagline: "Auto-save daily in digital gold", emoji: "🏺", defaultUrl: "https://myjar.app",       reward: "₹50 on first save",     perSignup: 75,  color: "text-warning" },
  { id: "fi",      name: "Fi Money",tagline: "Smart savings + UPI jars",        emoji: "💰", defaultUrl: "https://fi.money",        reward: "₹100 sign-up bonus",    perSignup: 150, color: "text-success" },
  { id: "slice",   name: "Slice",   tagline: "Spend, split, get rewards",       emoji: "🍕", defaultUrl: "https://sliceit.com",     reward: "Mystery scratch card",  perSignup: 100, color: "text-accent"  },
  { id: "jupiter", name: "Jupiter", tagline: "Pots that auto-grow",             emoji: "🪐", defaultUrl: "https://jupiter.money",   reward: "₹50 jewels",            perSignup: 80,  color: "text-neon"    },
  { id: "anq",     name: "Anq",     tagline: "Anonymous high-yield savings",    emoji: "🔐", defaultUrl: "https://anq.in",          reward: "₹25 welcome",           perSignup: 60,  color: "text-danger"  },
];

// Back-compat for older imports
export const REFERRALS = REFERRAL_APPS.map((r) => ({
  id: r.id, name: r.name, tagline: r.tagline, emoji: r.emoji, url: r.defaultUrl, reward: r.reward,
}));

// ---------- Tracking ----------

const LINKS_KEY = "money_fyi_referral_links_v1";   // per-app custom URL/code
const STATS_KEY = "money_fyi_referral_stats_v1";   // per-app signups/clicks/earnings
const ME_KEY    = "money_fyi_my_referral_v1";      // user's own MONEY.FYI referral code + signups

export interface AppStats { clicks: number; signups: number; earnings: number; }
export type StatsMap  = Record<string, AppStats>;
export type LinksMap  = Record<string, { url?: string; code?: string }>;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const getLinks  = (): LinksMap => read(LINKS_KEY, {});
export const setLinks  = (m: LinksMap) => write(LINKS_KEY, m);
export const getStats  = (): StatsMap => read(STATS_KEY, {});
export const setStats  = (m: StatsMap) => write(STATS_KEY, m);

export function appStats(id: string): AppStats {
  return getStats()[id] ?? { clicks: 0, signups: 0, earnings: 0 };
}

export function resolveUrl(app: ReferralApp): string {
  const custom = getLinks()[app.id];
  return (custom?.url && custom.url.trim()) ? custom.url.trim() : app.defaultUrl;
}

export function trackClick(id: string) {
  const m = getStats();
  const cur = m[id] ?? { clicks: 0, signups: 0, earnings: 0 };
  m[id] = { ...cur, clicks: cur.clicks + 1 };
  setStats(m);
}

export function logSignup(id: string, perSignup: number) {
  const m = getStats();
  const cur = m[id] ?? { clicks: 0, signups: 0, earnings: 0 };
  m[id] = { clicks: cur.clicks, signups: cur.signups + 1, earnings: cur.earnings + perSignup };
  setStats(m);
}

export function resetApp(id: string) {
  const m = getStats();
  delete m[id];
  setStats(m);
}

// ---------- User's own MONEY.FYI referral ----------

export interface MyReferral { code: string; signups: number; }

function randomCode() {
  return "MFY-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function getMyReferral(): MyReferral {
  const existing = read<MyReferral | null>(ME_KEY, null);
  if (existing) return existing;
  const fresh = { code: randomCode(), signups: 0 };
  write(ME_KEY, fresh);
  return fresh;
}
export function setMyReferral(m: MyReferral) { write(ME_KEY, m); }

export function myReferralUrl(): string {
  const code = getMyReferral().code;
  if (typeof window === "undefined") return `https://mmoneyguru.lovable.app/?ref=${code}`;
  return `${window.location.origin}/?ref=${code}`;
}
