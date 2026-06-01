import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import type { Category } from "@/lib/types";

export function ScanBillButton() {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { addTransaction } = useStore();
  const { t } = useI18n();

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const r = await fetch("/api/scan-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { merchant: string; total: number; category: Category };
      addTransaction({
        type: "expense",
        amount: data.total,
        category: data.category,
        note: data.merchant,
        date: new Date().toISOString(),
        source: "scan",
      });
      toast.success(`Added ₹${data.total} from ${data.merchant}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={onPick}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="w-full p-4 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 active:bg-white/5 transition disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-neon" />
        ) : (
          <Camera className="size-5 text-foreground/40" />
        )}
        <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
          {busy ? "Scanning…" : t("scanBill")}
        </p>
      </button>
    </>
  );
}
