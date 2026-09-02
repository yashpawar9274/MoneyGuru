import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  language: string;
}

export type Plan = "free" | "pro" | "lifetime";

export interface Subscription {
  plan: Plan;
  status: string;
  price_inr: number;
  current_period_end: string | null;
  trial_ends_at: string | null;
}

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  isPro: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirm: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  activatePro: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const load = useCallback(async (uid: string) => {
    await supabase.rpc("bootstrap_account");
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    if (p) setProfile(p as Profile);
    if (s) setSubscription(s as Subscription);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      if (!s) {
        setProfile(null);
        setSubscription(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // Never block the UI if session restore stalls (e.g. embedded previews).
    const t = setTimeout(() => setLoading(false), 4000);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    void load(uid);
  }, [session?.user.id, load]);

  // Realtime (websocket) plan/trial sync so lock + unlock happen instantly on every device.
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    const channel = supabase
      .channel(`sub-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as Subscription | null;
          if (row) setSubscription(row);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id]);


  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: name },
      },
    });
    if (error) throw error;
    return { needsConfirm: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSubscription(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const uid = session?.user.id;
      if (!uid) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [session?.user.id],
  );

  const refresh = useCallback(async () => {
    const uid = session?.user.id;
    if (uid) await load(uid);
  }, [session?.user.id, load]);

  const activatePro = useCallback(async () => {
    const { error } = await supabase.rpc("activate_pro");
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const plan = subscription?.plan ?? "free";
  const expired =
    plan === "pro" &&
    !!subscription?.current_period_end &&
    +new Date(subscription.current_period_end) < Date.now();
  const isPro = plan === "lifetime" || (plan === "pro" && !expired);

  const value = useMemo(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      subscription,
      isPro,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      updateProfile,
      activatePro,
      refresh,
    }),
    [
      loading,
      session,
      profile,
      subscription,
      isPro,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      updateProfile,
      activatePro,
      refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
