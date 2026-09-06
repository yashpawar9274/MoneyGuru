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
  emoji: string;
  kind: TxType;
}[] = [
  { id: "food", label: "Food & Drinks", emoji: "🍔", kind: "expense" },
  { id: "groceries", label: "Groceries", emoji: "🛒", kind: "expense" },
  { id: "transport", label: "Transport", emoji: "🚕", kind: "expense" },
  { id: "petrol", label: "Petrol", emoji: "⛽", kind: "expense" },
  { id: "travel", label: "Travel", emoji: "✈️", kind: "expense" },
  { id: "shopping", label: "Shopping", emoji: "🛍️", kind: "expense" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬", kind: "expense" },
  { id: "bills", label: "Bills & Utilities", emoji: "💡", kind: "expense" },
  { id: "recharge", label: "Mobile Recharge", emoji: "📱", kind: "expense" },
  { id: "rent", label: "Rent", emoji: "🏠", kind: "expense" },
  { id: "emi", label: "EMI", emoji: "🏦", kind: "expense" },
  { id: "insurance", label: "Insurance", emoji: "🛡️", kind: "expense" },
  { id: "health", label: "Health & Medicine", emoji: "💊", kind: "expense" },
  { id: "education", label: "Education", emoji: "📚", kind: "expense" },
  { id: "personal_care", label: "Personal Care", emoji: "🧴", kind: "expense" },
  { id: "gifts", label: "Gifts", emoji: "🎁", kind: "expense" },
  { id: "other", label: "Other Expense", emoji: "✨", kind: "expense" },

  { id: "salary", label: "Salary", emoji: "💼", kind: "income" },
  { id: "freelance", label: "Freelance", emoji: "💻", kind: "income" },
  { id: "business_income", label: "Business Income", emoji: "🏪", kind: "income" },
  { id: "cashback", label: "Cashback", emoji: "🎁", kind: "income" },
  { id: "interest", label: "Interest Received", emoji: "💰", kind: "income" },
  { id: "investment", label: "Investment Return", emoji: "📈", kind: "income" },
  { id: "loan", label: "Loan Received", emoji: "🏦", kind: "income" },
];

export function categoryMeta(id: Category) {
  return (
    CATEGORIES.find((category) => category.id === id) ??
    CATEGORIES.find((category) => category.id === "other")!
  );
}