export type TxType = "income" | "expense";

export type Category =
  | "food"
  | "transport"
  | "shopping"
  | "entertainment"
  | "bills"
  | "health"
  | "education"
  | "salary"
  | "freelance"
  | "investment"
  | "other";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: Category;
  note: string;
  date: string; // ISO
  source?: "manual" | "scan";
}

export const CATEGORIES: { id: Category; label: string; emoji: string; kind: TxType }[] = [
  { id: "food", label: "Food & Drinks", emoji: "🍔", kind: "expense" },
  { id: "transport", label: "Transport", emoji: "🚕", kind: "expense" },
  { id: "shopping", label: "Shopping", emoji: "🛍️", kind: "expense" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬", kind: "expense" },
  { id: "bills", label: "Bills & Utilities", emoji: "💡", kind: "expense" },
  { id: "health", label: "Health", emoji: "💊", kind: "expense" },
  { id: "education", label: "Education", emoji: "📚", kind: "expense" },
  { id: "other", label: "Other", emoji: "✨", kind: "expense" },
  { id: "salary", label: "Salary", emoji: "💼", kind: "income" },
  { id: "freelance", label: "Freelance", emoji: "💻", kind: "income" },
  { id: "investment", label: "Investment", emoji: "📈", kind: "income" },
];

export function categoryMeta(id: Category) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
