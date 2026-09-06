import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTxVoiceLine } from "@/lib/tx-voice.functions";
import { getAutoSpeak, getVoiceLang } from "@/lib/voices";
import { speakLine } from "@/lib/speech";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import type { Transaction } from "@/lib/types";

export const TX_ADDED_EVENT = "money-fyi:tx-added";

/** Listens for new transactions and speaks an AI reaction automatically. */
export function AutoVoiceAgent() {
  const { transactions } = useStore();
  const { lang } = useI18n();
  const getLine = useServerFn(getTxVoiceLine);
  const txRef = useRef(transactions);
  const busy = useRef(false);
  txRef.current = transactions;

  useEffect(() => {
    const onAdded = async (e: Event) => {
      if (!getAutoSpeak() || busy.current) return;
      const tx = (e as CustomEvent<Transaction>).detail;
      if (!tx) return;
      busy.current = true;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const all = txRef.current;
        let todaySpend = 0, todayIncome = 0, income = 0, expense = 0;
        for (const t of all) {
          if (t.type === "income") income += t.amount;
          else expense += t.amount;
          if (t.date.slice(0, 10) === today) {
            if (t.type === "income") todayIncome += t.amount;
            else todaySpend += t.amount;
          }
        }
        const vl = getVoiceLang();
        const spokenLang = vl === "auto" ? lang : vl;
        const { line } = await getLine({
          data: {
            type: tx.type,
            amount: tx.amount,
            category: tx.category,
            note: tx.note ?? "",
            todaySpend,
            todayIncome,
            balance: income - expense,
            lang: spokenLang,
          },
        });
        toast(line, { icon: "🔊" });
        await speakLine(line, spokenLang);
      } catch {
        /* stay silent on failure */
      } finally {
        busy.current = false;
      }
    };

    window.addEventListener(TX_ADDED_EVENT, onAdded as EventListener);
    return () => window.removeEventListener(TX_ADDED_EVENT, onAdded as EventListener);
  }, [getLine, lang]);

  return null;
}
