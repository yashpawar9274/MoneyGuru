import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User as UserIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export function AuthScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirm } = await signUp(email.trim(), password, name.trim());
        if (needsConfirm) {
          setSent(true);
          toast.success("Check your email to confirm your account");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen px-6 pt-16 pb-10 flex flex-col">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="size-14 rounded-2xl bg-neon grid place-items-center neon-glow">
          <Sparkles className="size-7 text-neon-foreground" strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 text-3xl font-display font-bold leading-tight">
          MONEY<span className="text-neon">.FYI</span>
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          Track spends, udhari &amp; EMI with an AI coach. Your data syncs securely across devices.
        </p>
      </motion.div>

      {sent ? (
        <div className="mt-10 rounded-2xl bg-card border border-border p-5">
          <p className="text-sm font-semibold">Confirm your email</p>
          <p className="mt-1 text-sm text-foreground/60">
            We sent a link to {email}. Open it to activate your account, then come back here.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-4 text-sm font-bold text-neon"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 space-y-3">
          {mode === "up" && (
            <Field icon={<UserIcon className="size-4" />}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/40"
              />
            </Field>
          )}
          <Field icon={<Mail className="size-4" />}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/40"
            />
          </Field>
          <Field icon={<Lock className="size-4" />}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/40"
            />
          </Field>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-neon py-3.5 text-sm font-bold text-neon-foreground active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "in" ? "Sign in" : "Create account"}
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-foreground/40">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="w-full rounded-full border border-border bg-card py-3.5 text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            Continue with Google
          </button>

          <p className="pt-4 text-center text-sm text-foreground/60">
            {mode === "in" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
              className="font-bold text-neon"
            >
              {mode === "in" ? "Create account" : "Sign in"}
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3.5 focus-within:border-neon/60 transition-colors">
      <span className="text-foreground/40">{icon}</span>
      {children}
    </div>
  );
}
