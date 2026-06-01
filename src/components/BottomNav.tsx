import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BarChart3, Brain, Settings, Plus } from "lucide-react";
import { motion } from "framer-motion";

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const item = (to: string, Icon: typeof Home) => {
    const active = path === to;
    return (
      <Link to={to} className="size-10 flex items-center justify-center">
        <Icon className={`size-5 transition-colors ${active ? "text-neon" : "text-foreground/40"}`} />
      </Link>
    );
  };
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] px-4 pb-4 pt-2 bg-background/85 backdrop-blur-xl border-t border-border z-40">
      <div className="flex justify-between items-center max-w-xs mx-auto">
        {item("/", Home)}
        {item("/analytics", BarChart3)}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onAdd}
          className="size-14 bg-neon rounded-full -mt-10 border-4 border-background flex items-center justify-center neon-glow"
          aria-label="Add transaction"
        >
          <Plus className="size-6 text-neon-foreground" strokeWidth={3} />
        </motion.button>
        {item("/ai", Brain)}
        {item("/settings", Settings)}
      </div>
    </nav>
  );
}
