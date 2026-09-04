import { supabase } from "@/integrations/supabase/client";
import type { Debt, DebtEntry, DebtPayment } from "./debts";
import { remaining, paidTotal } from "./debts";

const BUCKET = "debt-proofs";

/** Uploads a payment screenshot into the signed-in user's private folder. */
export async function uploadProof(file: File, userId: string) {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Short-lived signed URL so proofs can be previewed / shared. */
export async function proofUrl(path: string, seconds = 60 * 60 * 24 * 7) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeProof(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export type LedgerItem = {
  kind: "given" | "paid";
  id: string;
  amount: number;
  date: string;
  note?: string;
  proofPath?: string;
};

/** Merged timeline: every amount given/taken + every payment, newest first. */
export function ledger(d: Debt): LedgerItem[] {
  const given: LedgerItem[] = (d.entries ?? []).map((e: DebtEntry) => ({
    kind: "given",
    id: e.id,
    amount: e.amount,
    date: e.date,
    note: e.note,
    proofPath: e.proofPath,
  }));
  // Legacy debts created before the ledger existed: show the original amount.
  if (given.length === 0 && d.principal > 0) {
    given.push({ kind: "given", id: `${d.id}-base`, amount: d.principal, date: d.createdAt });
  }
  const paid: LedgerItem[] = (d.payments ?? []).map((p: DebtPayment) => ({
    kind: "paid",
    id: p.id,
    amount: p.amount,
    date: p.date,
    note: p.note,
    proofPath: p.proofPath,
  }));
  return [...given, ...paid].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** Human-readable proof statement to share on WhatsApp etc. */
export function proofText(d: Debt) {
  const items = ledger(d);
  const lines: string[] = [];
  const who = d.title;
  lines.push(
    d.kind === "udhari_given"
      ? `Udhari statement — ${who}`
      : d.kind === "udhari_taken"
        ? `Udhari statement (mera liya hua) — ${who}`
        : `EMI statement — ${who}`,
  );
  lines.push("");
  for (const it of items) {
    lines.push(
      `${it.kind === "given" ? "➕ Diya" : "✅ Wapas mila"} ${inr(it.amount)} — ${fmtTime(it.date)}${
        it.note ? ` (${it.note})` : ""
      }`,
    );
  }
  lines.push("");
  lines.push(`Total diya: ${inr(d.principal)}`);
  lines.push(`Total wapas: ${inr(paidTotal(d))}`);
  lines.push(`Pending: ${inr(remaining(d))}`);
  lines.push("");
  lines.push("Statement from MONEY.FYI");
  return lines.join("\n");
}

/**
 * Parses a UPI / bank notification or SMS into an amount, a counter-party name
 * and a timestamp so payments can be synced without typing them again.
 */
export function parseNotification(raw: string): {
  amount?: number;
  name?: string;
  direction: "debit" | "credit";
  at: string;
} {
  const text = raw.replace(/\s+/g, " ").trim();

  const amountMatch =
    text.match(/(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d{1,2})?)/i) ??
    text.match(/([\d,]+(?:\.\d{1,2})?)\s?(?:rupees|rs\b)/i);
  const amount = amountMatch?.[1] ? Number(amountMatch[1].replace(/,/g, "")) : undefined;

  const creditWords = /(received|credited|credit|aaya|mila|deposited|refund)/i;
  const direction: "debit" | "credit" = creditWords.test(text) ? "credit" : "debit";

  const nameMatch =
    text.match(/\b(?:paid to|sent to|to)\s+([A-Za-z][A-Za-z .'-]{1,30}?)(?=\s+(?:on|at|via|using|from|ref|upi|₹|rs\b|\d)|[.,]|$)/i) ??
    text.match(/\b(?:from|by|received from)\s+([A-Za-z][A-Za-z .'-]{1,30}?)(?=\s+(?:on|at|via|using|ref|upi|₹|rs\b|\d)|[.,]|$)/i);
  const name = nameMatch?.[1]?.trim().replace(/\s+(?:upi|bank|account)$/i, "");

  // Optional explicit time like "at 6:12 PM" or "18:12"
  let at = new Date().toISOString();
  const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\s?(am|pm)?/i);
  if (timeMatch) {
    const d = new Date();
    let h = Number(timeMatch[1]);
    const m = Number(timeMatch[2]);
    const ap = timeMatch[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    d.setHours(h, m, 0, 0);
    if (+d > Date.now() + 60000) d.setDate(d.getDate() - 1);
    at = d.toISOString();
  }

  return { amount, name, direction, at };
}
