import Constants from "expo-constants";

export const API_BASE: string =
  (Constants.expoConfig?.extra as any)?.apiBaseUrl ?? "https://mmoneyguru.lovable.app";

export async function scanBill(imageBase64: string) {
  const r = await fetch(`${API_BASE}/api/scan-bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ merchant: string; total: number; category: string }>;
}

export async function ttsToFile(text: string, voiceId?: string) {
  const r = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId }),
  });
  if (!r.ok) throw new Error("tts failed");
  const buf = await r.arrayBuffer();
  return buf;
}
