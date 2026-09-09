import { Link, useRouterState } from "@tanstack/react-router";
import { Brain, HandCoins, Home, Plus, ReceiptText } from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const item = (to: string, Icon: LucideIcon, label: string) => {
    const active = to === "/" ? path === "/" : path.startsWith(to);
    return (
      <Link
        to={to}
        aria-label={label}
        className="flex w-14 flex-col items-center gap-1 py-1"
      >
        <Icon className={`size-5 transition-colors ${active ? "text-neon" : "text-foreground/40"}`} />
        <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-neon" : "text-foreground/35"}`}>
          {label}
        </span>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 border-t border-border bg-background/85 px-4 pb-4 pt-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-sm items-center justify-between">
        {item("/", Home, "Home")}
        {item("/transactions", ReceiptText, "Money")}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onAdd}
          className="-mt-10 flex size-14 items-center justify-center rounded-full border-4 border-background bg-neon neon-glow"
          aria-label="Quick add"
        >
          <Plus className="size-6 text-neon-foreground" strokeWidth={3} />
        </motion.button>
        {item("/debts", HandCoins, "Udhari")}
        {item("/ai", Brain, "Guru")}
      </div>
    </nav>
  );
}
