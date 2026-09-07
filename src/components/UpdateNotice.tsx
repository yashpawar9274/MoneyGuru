import { useEffect, useState } from "react";
import { Download, RefreshCw, Sparkles, X } from "lucide-react";
import { APP_VERSION, isNewReleaseSeen, markReleaseSeen, RELEASE_NOTES } from "@/lib/app-update";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function UpdateNotice() {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isNewReleaseSeen(window.localStorage)) setOpen(true);
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => window.removeEventListener("beforeinstallprompt", captureInstall);
  }, []);

  const close = () => {
    markReleaseSeen(window.localStorage);
    setOpen(false);
  };

  const update = async () => {
    setUpdating(true);
    try {
      if (installPrompt) {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
      } else if (navigator.serviceWorker?.controller) {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        window.location.reload();
      } else {
        window.location.reload();
      }
    } finally {
      markReleaseSeen(window.localStorage);
      setOpen(false);
      setUpdating(false);
    }
  };

  if (!open) return null;
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
    <section className="w-full max-w-[420px] rounded-3xl border border-neon/30 bg-card p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-neon"><Sparkles className="size-4" /><span className="text-[10px] font-bold uppercase tracking-widest">New update</span></div><h2 className="mt-2 text-2xl font-display font-bold">MONEY.FYI v{APP_VERSION}</h2></div>
        <button onClick={close} aria-label="Close update notes" className="grid size-9 place-items-center rounded-full bg-secondary"><X className="size-4" /></button>
      </div>
      <p className="mt-2 text-sm text-foreground/60">Latest features and fixes are ready. Install or refresh the app to use them.</p>
      <ul className="mt-5 space-y-3">{RELEASE_NOTES.map((note) => <li key={note} className="flex gap-2 text-sm"><span className="mt-1 size-2 shrink-0 rounded-full bg-neon" />{note}</li>)}</ul>
      <div className="mt-6 grid grid-cols-2 gap-2"><button onClick={close} className="rounded-2xl bg-secondary py-3 text-sm font-bold">Later</button><button onClick={() => void update()} disabled={updating} className="rounded-2xl bg-neon py-3 text-sm font-bold text-neon-foreground disabled:opacity-60"><span className="inline-flex items-center gap-1.5">{updating ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}{installPrompt ? "Install app" : "Update app"}</span></button></div>
    </section>
  </div>;
}