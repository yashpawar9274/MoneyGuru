import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function SplashScreen() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const seen = sessionStorage.getItem("splash_seen");
    if (seen) { setShow(false); return; }
    const t = setTimeout(() => {
      setShow(false);
      sessionStorage.setItem("splash_seen", "1");
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 12, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="size-24 bg-neon rounded-3xl flex items-center justify-center neon-glow"
          >
            <span className="text-neon-foreground text-5xl font-extrabold font-display -rotate-12">$</span>
          </motion.div>
          <motion.h1
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="mt-8 text-3xl font-display font-bold tracking-tighter"
          >
            MONEY.FYI
          </motion.h1>
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 0.5 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-sm text-foreground/50 mt-2"
          >
            Smart saving for the fast lane
          </motion.p>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 120 }}
            transition={{ delay: 0.6, duration: 1.1 }}
            className="mt-8 h-0.5 bg-neon rounded-full"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
