import { ledger, type LedgerItem } from "./debt-proof";
import type { Debt } from "./debts";

export const PURPOSES = ["Personal", "Medical", "Travel", "Food", "Loan", "Business", "Education", "Other"] as const;
export const METHODS = ["Cash", "UPI", "Bank Transfer"] as const;

export const inr = (value: number) => "₹" + Math.round(value).toLocaleString("en-IN");

export function fullDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export interface ReceiptData {
  number: string;
  generatedAt: string;
  name: string;
  phone?: string;
  totalGiven: number;
  totalReturned: number;
  pending: number;
  items: LedgerItem[];
}

export function buildReceipt(debt: Debt): ReceiptData {
  const items = ledger(debt).slice().sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const totalGiven = items.filter((i) => i.kind === "given").reduce((s, i) => s + i.amount, 0);
  const totalReturned = items.filter((i) => i.kind === "paid").reduce((s, i) => s + i.amount, 0);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return {
    number: `MFY-${stamp}-${debt.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    generatedAt: fullDateTime(now.toISOString()),
    name: debt.title,
    phone: debt.contactPhone?.trim() || undefined,
    totalGiven,
    totalReturned,
    pending: Math.max(0, totalGiven - totalReturned),
    items,
  };
}

export function receiptMessage(r: ReceiptData) {
  return [
    `Hi ${r.name},`,
    "",
    "This is your udhari/payment record as per MoneyFYI.",
    "",
    `Total given: ${inr(r.totalGiven)}`,
    `Total received: ${inr(r.totalReturned)}`,
    `Pending balance: ${inr(r.pending)}`,
    "",
    `Receipt no: ${r.number}`,
    "Please check the attached receipt.",
  ].join("\n");
}

const BG = "#0a0a0c";
const CARD = "#121216";
const LINE = "#26262e";
const NEON = "#c4ff3d";
const TEXT = "#f5f5f7";
const MUTED = "#8b8b96";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Renders the receipt as a branded PNG blob (works on web, PWA and Android WebView). */
export async function renderReceiptImage(r: ReceiptData): Promise<Blob> {
  const W = 1000;
  const pad = 56;
  const rowHeight = 132;
  const H = 620 + r.items.length * rowHeight + 200;
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Receipt rendering is not supported on this device");
  ctx.scale(scale, scale);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Header band
  ctx.fillStyle = "#14180c";
  ctx.fillRect(0, 0, W, 168);
  ctx.fillStyle = NEON;
  ctx.fillRect(0, 0, W, 6);

  // Logo mark
  ctx.fillStyle = NEON;
  roundRect(ctx, pad, 48, 66, 66, 20);
  ctx.fill();
  ctx.fillStyle = "#0a0a0c";
  ctx.font = "900 40px Georgia, serif";
  ctx.fillText("₹", pad + 21, 94);

  ctx.fillStyle = TEXT;
  ctx.font = "900 40px 'Space Grotesk', Arial, sans-serif";
  ctx.fillText("MoneyFYI", pad + 86, 82);
  ctx.fillStyle = MUTED;
  ctx.font = "600 18px Arial, sans-serif";
  ctx.fillText("Udhari & EMI Payment Receipt", pad + 86, 108);

  ctx.textAlign = "right";
  ctx.fillStyle = NEON;
  ctx.font = "800 20px Arial, sans-serif";
  ctx.fillText(r.number, W - pad, 74);
  ctx.fillStyle = MUTED;
  ctx.font = "500 17px Arial, sans-serif";
  ctx.fillText(r.generatedAt, W - pad, 102);
  ctx.textAlign = "left";

  // Person block
  let y = 226;
  ctx.fillStyle = MUTED;
  ctx.font = "700 15px Arial, sans-serif";
  ctx.fillText("RECEIPT FOR", pad, y);
  ctx.fillStyle = TEXT;
  ctx.font = "800 34px 'Space Grotesk', Arial, sans-serif";
  ctx.fillText(r.name, pad, y + 42);
  if (r.phone) {
    ctx.fillStyle = MUTED;
    ctx.font = "500 19px Arial, sans-serif";
    ctx.fillText(r.phone, pad, y + 72);
  }

  // Totals
  y = 336;
  const boxW = (W - pad * 2 - 24) / 3;
  const totals: [string, string, string][] = [
    ["TOTAL GIVEN", inr(r.totalGiven), "#ff6b6b"],
    ["TOTAL RECEIVED", inr(r.totalReturned), "#4ade80"],
    ["PENDING BALANCE", inr(r.pending), NEON],
  ];
  totals.forEach(([label, value, color], index) => {
    const x = pad + index * (boxW + 12);
    ctx.fillStyle = CARD;
    roundRect(ctx, x, y, boxW, 110, 20);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = "700 14px Arial, sans-serif";
    ctx.fillText(label, x + 20, y + 36);
    ctx.fillStyle = color;
    ctx.font = "900 32px 'Space Grotesk', Arial, sans-serif";
    ctx.fillText(value, x + 20, y + 80);
  });

  // Transactions
  y = 508;
  ctx.fillStyle = MUTED;
  ctx.font = "700 15px Arial, sans-serif";
  ctx.fillText("TRANSACTION HISTORY", pad, y);
  y += 28;

  for (const item of r.items) {
    ctx.fillStyle = CARD;
    roundRect(ctx, pad, y, W - pad * 2, rowHeight - 16, 18);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = "500 17px Arial, sans-serif";
    ctx.fillText(fullDateTime(item.date), pad + 22, y + 34);

    ctx.fillStyle = item.kind === "given" ? "#ff6b6b" : "#4ade80";
    ctx.font = "800 26px 'Space Grotesk', Arial, sans-serif";
    ctx.fillText(`${item.kind === "given" ? "Given" : "Received"} · ${inr(item.amount)}`, pad + 22, y + 68);

    const details = [
      item.purpose ? `Purpose: ${item.purpose}` : null,
      item.method ? `Method: ${item.method}` : null,
      item.location ? `Location: ${item.location}` : null,
      item.note ? `Note: ${item.note}` : null,
    ].filter(Boolean) as string[];
    ctx.fillStyle = "#b6b6c2";
    ctx.font = "500 17px Arial, sans-serif";
    const lines = wrap(ctx, details.join("   ·   ") || "No extra details", W - pad * 2 - 44);
    lines.slice(0, 2).forEach((line, index) => ctx.fillText(line, pad + 22, y + 96 + index * 22));
    y += rowHeight;
  }

  // Footer
  y += 18;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  ctx.fillStyle = "#d4d4dd";
  ctx.font = "600 19px Arial, sans-serif";
  ctx.fillText("Please verify this payment record. If any entry is incorrect, contact me.", pad, y + 44);
  ctx.fillStyle = NEON;
  ctx.font = "800 18px Arial, sans-serif";
  ctx.fillText("Generated via MoneyFYI", pad, y + 82);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) throw new Error("Could not create the receipt image");
  return blob;
}

/** Multi-page-safe A4-ish PDF wrapper around the receipt image. */
export async function receiptPdf(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const bitmap = await createImageBitmap(blob);
  const pageW = 595;
  const pageH = Math.round((bitmap.height / bitmap.width) * pageW);
  const chunks: (string | Uint8Array)[] = [];
  const enc = (value: string) => new TextEncoder().encode(value);
  const objects: Uint8Array[] = [];
  const push = (value: string | Uint8Array) => objects.push(typeof value === "string" ? enc(value) : value);

  push(`1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n`);
  push(`2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n`);
  push(
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pageW} ${pageH}]/Resources<</XObject<</Im0 5 0 R>>>>/Contents 4 0 R>>endobj\n`,
  );
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  push(`4 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj\n`);
  const head = enc(
    `5 0 obj<</Type/XObject/Subtype/Image/Width ${bitmap.width}/Height ${bitmap.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${bytes.length}>>stream\n`,
  );
  const tail = enc(`\nendstream endobj\n`);
  const image = new Uint8Array(head.length + bytes.length + tail.length);
  image.set(head, 0);
  image.set(bytes, head.length);
  image.set(tail, head.length + bytes.length);
  push(image);

  const header = enc(`%PDF-1.4\n`);
  const offsets: number[] = [];
  let position = header.length;
  for (const object of objects) {
    offsets.push(position);
    position += object.length;
  }
  const xrefStart = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  xref += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  chunks.push(header, ...objects, enc(xref));
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

/** Encodes the receipt canvas as JPEG so it can be embedded in the PDF. */
export async function toJpeg(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Receipt rendering is not supported on this device");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!jpeg) throw new Error("Could not create the receipt file");
  return jpeg;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Shares the receipt to WhatsApp. Only ever called from an explicit user tap. */
export async function shareReceipt(r: ReceiptData, png: Blob): Promise<"shared" | "whatsapp-text"> {
  const message = receiptMessage(r);
  const file = new File([png], `MoneyFYI-Receipt-${r.number}.png`, { type: "image/png" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `MoneyFYI Receipt · ${r.name}`, text: message, files: [file] });
    return "shared";
  }
  download(png, file.name);
  const phone = r.phone?.replace(/\D/g, "");
  const to = phone ? (phone.length === 10 ? `91${phone}` : phone) : "";
  window.open(`https://wa.me/${to}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  return "whatsapp-text";
}

export async function downloadReceiptPdf(r: ReceiptData, png: Blob) {
  const pdf = await receiptPdf(await toJpeg(png));
  download(pdf, `MoneyFYI-Receipt-${r.number}.pdf`);
}
