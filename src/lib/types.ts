import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Banknote,
  Briefcase,
  Car,
  CircleDot,
  Clapperboard,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Lightbulb,
  PiggyBank,
  Plane,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  Utensils,
} from "lucide-react";

export type TxType = "income" | "expense";

export type Category =
  | "food"
  | "transport"
  | "shopping"
  | "entertainment"
  | "bills"
  | "health"
  | "education"
  | "petrol"
  | "recharge"
  | "rent"
  | "emi"
  | "insurance"
  | "groceries"
  | "gifts"
  | "travel"
  | "personal_care"
  | "salary"
  | "freelance"
  | "business_income"
  | "cashback"
  | "interest"
  | "investment"
  | "loan"
  | "other";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: Category;
  note: string;
  date: string;
  source?: "manual" | "scan";
}

export const CATEGORIES: {
  id: Category;
  label: string;
  Icon: LucideIcon;
  kind: TxType;
}[] = [
  { id: "food", label: "Food & Drinks", Icon: Utensils, kind: "expense" },
  { id: "groceries", label: "Groceries", Icon: ShoppingCart, kind: "expense" },
  { id: "transport", label: "Transport", Icon: Car, kind: "expense" },
  { id: "petrol", label: "Petrol", Icon: Fuel, kind: "expense" },
  { id: "travel", label: "Travel", Icon: Plane, kind: "expense" },
  { id: "shopping", label: "Shopping", Icon: ShoppingBag, kind: "expense" },
  { id: "entertainment", label: "Entertainment", Icon: Clapperboard, kind: "expense" },
  { id: "bills", label: "Bills & Utilities", Icon: Lightbulb, kind: "expense" },
  { id: "recharge", label: "Mobile Recharge", Icon: Smartphone, kind: "expense" },
  { id: "rent", label: "Rent", Icon: Home, kind: "expense" },
  { id: "emi", label: "EMI", Icon: Landmark, kind: "expense" },
  { id: "insurance", label: "Insurance", Icon: ShieldCheck, kind: "expense" },
  { id: "health", label: "Health & Medicine", Icon: HeartPulse, kind: "expense" },
  { id: "education", label: "Education", Icon: GraduationCap, kind: "expense" },
  { id: "personal_care", label: "Personal Care", Icon: Sparkles, kind: "expense" },
  { id: "gifts", label: "Gifts", Icon: Gift, kind: "expense" },
  { id: "other", label: "Other Expense", Icon: CircleDot, kind: "expense" },
  { id: "salary", label: "Salary", Icon: Briefcase, kind: "income" },
  { id: "freelance", label: "Freelance", Icon: Laptop, kind: "income" },
  { id: "business_income", label: "Business Income", Icon: Store, kind: "income" },
  { id: "cashback", label: "Cashback", Icon: BadgePercent, kind: "income" },
  { id: "interest", label: "Interest Received", Icon: PiggyBank, kind: "income" },
  { id: "investment", label: "Investment Return", Icon: TrendingUp, kind: "income" },
  { id: "loan", label: "Loan Received", Icon: Banknote, kind: "income" },
];

export function categoryMeta(id: Category) {
  return (
    CATEGORIES.find((category) => category.id === id) ??
    CATEGORIES.find((category) => category.id === "other")!
  );
}