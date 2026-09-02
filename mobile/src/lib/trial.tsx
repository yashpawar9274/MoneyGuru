import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const START_KEY = "mfy.trial.start";
const PRO_KEY = "mfy.plan";
export const TRIAL_MS = 24 * 60 * 60 * 1000;

type Plan = "free" | "pro" | "lifetime";

interface TrialCtx {
  ready: boolean;
  plan: Plan;
  isPro: boolean;
  msLeft: number;
  locked: boolean;
  setPlan: (p: Plan) => Promise<void>;
  resetTrial: () => Promise<void>;
}

const Ctx = createContext<TrialCtx | null>(null);

export function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export function TrialProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState<number | null>(null);
  const [plan, setPlanState] = useState<Plan>("free");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        AsyncStorage.getItem(START_KEY),
        AsyncStorage.getItem(PRO_KEY),
      ]);
      let ts = s ? Number(s) : NaN;
      if (!Number.isFinite(ts)) {
        ts = Date.now();
        await AsyncStorage.setItem(START_KEY, String(ts));
      }
      setStart(ts);
      if (p === "pro" || p === "lifetime") setPlanState(p);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isPro = plan !== "free";
  const msLeft = start === null ? TRIAL_MS : Math.max(0, start + TRIAL_MS - now);
  const locked = ready && !isPro && msLeft <= 0;

  const setPlan = async (p: Plan) => {
    setPlanState(p);
    await AsyncStorage.setItem(PRO_KEY, p);
  };
  const resetTrial = async () => {
    const ts = Date.now();
    setStart(ts);
    await AsyncStorage.setItem(START_KEY, String(ts));
  };

  return (
    <Ctx.Provider value={{ ready, plan, isPro, msLeft, locked, setPlan, resetTrial }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTrial() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTrial must be used within TrialProvider");
  return c;
}
