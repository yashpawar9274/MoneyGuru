import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "hi" | "es" | "fr";

const dict = {
  en: {
    welcome: "Welcome back",
    totalBalance: "Total Balance",
    dailyIncome: "Daily Income",
    thisWeek: "This Week",
    todaySpends: "Today's Spends",
    viewAnalytics: "View Analytics",
    scanBill: "Scan Bill to Add Automatically",
    aiCoach: "AI Savings Coach",
    listen: "Listen",
    addTx: "Add Transaction",
    income: "Income",
    expense: "Expense",
    amount: "Amount",
    category: "Category",
    note: "Note (optional)",
    save: "Save",
    weekly: "Weekly",
    monthly: "Monthly",
    daily: "Daily",
    analytics: "Analytics",
    home: "Home",
    ai: "AI",
    settings: "Settings",
    language: "Language",
    spendByCategory: "Spend by Category",
    askAI: "Ask AI Coach",
    thinking: "Thinking…",
    nothingYet: "No transactions yet",
    earlier: "Earlier",
    today: "Today",
    yesterday: "Yesterday",
  },
  hi: {
    welcome: "वापसी पर स्वागत है",
    totalBalance: "कुल बैलेंस",
    dailyIncome: "आज की आय",
    thisWeek: "इस हफ़्ते",
    todaySpends: "आज का खर्च",
    viewAnalytics: "विश्लेषण देखें",
    scanBill: "बिल स्कैन करके जोड़ें",
    aiCoach: "AI सेविंग कोच",
    listen: "सुनें",
    addTx: "लेन-देन जोड़ें",
    income: "आय",
    expense: "खर्च",
    amount: "राशि",
    category: "श्रेणी",
    note: "नोट (वैकल्पिक)",
    save: "सेव करें",
    weekly: "साप्ताहिक",
    monthly: "मासिक",
    daily: "रोज़",
    analytics: "विश्लेषण",
    home: "होम",
    ai: "AI",
    settings: "सेटिंग्स",
    language: "भाषा",
    spendByCategory: "श्रेणी के अनुसार खर्च",
    askAI: "AI कोच से पूछें",
    thinking: "सोच रहा है…",
    nothingYet: "अभी कोई लेन-देन नहीं",
    earlier: "पुराने",
    today: "आज",
    yesterday: "कल",
  },
  es: {
    welcome: "Bienvenido",
    totalBalance: "Saldo Total",
    dailyIncome: "Ingreso Diario",
    thisWeek: "Esta Semana",
    todaySpends: "Gastos de Hoy",
    viewAnalytics: "Ver Analítica",
    scanBill: "Escanear factura",
    aiCoach: "Coach de Ahorro IA",
    listen: "Escuchar",
    addTx: "Añadir transacción",
    income: "Ingreso",
    expense: "Gasto",
    amount: "Cantidad",
    category: "Categoría",
    note: "Nota (opcional)",
    save: "Guardar",
    weekly: "Semanal",
    monthly: "Mensual",
    daily: "Diario",
    analytics: "Analítica",
    home: "Inicio",
    ai: "IA",
    settings: "Ajustes",
    language: "Idioma",
    spendByCategory: "Gasto por Categoría",
    askAI: "Preguntar al Coach IA",
    thinking: "Pensando…",
    nothingYet: "Aún no hay transacciones",
    earlier: "Antes",
    today: "Hoy",
    yesterday: "Ayer",
  },
  fr: {
    welcome: "Bon retour",
    totalBalance: "Solde Total",
    dailyIncome: "Revenu du jour",
    thisWeek: "Cette semaine",
    todaySpends: "Dépenses du jour",
    viewAnalytics: "Voir l'analyse",
    scanBill: "Scanner la facture",
    aiCoach: "Coach IA d'Épargne",
    listen: "Écouter",
    addTx: "Ajouter une transaction",
    income: "Revenu",
    expense: "Dépense",
    amount: "Montant",
    category: "Catégorie",
    note: "Note (optionnel)",
    save: "Enregistrer",
    weekly: "Hebdo",
    monthly: "Mensuel",
    daily: "Journalier",
    analytics: "Analyse",
    home: "Accueil",
    ai: "IA",
    settings: "Réglages",
    language: "Langue",
    spendByCategory: "Dépense par catégorie",
    askAI: "Demander au Coach IA",
    thinking: "Réflexion…",
    nothingYet: "Aucune transaction",
    earlier: "Plus tôt",
    today: "Aujourd'hui",
    yesterday: "Hier",
  },
} as const;

export type DictKey = keyof typeof dict.en;

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: DictKey) => string } | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const stored = localStorage.getItem("money_fyi_lang") as Lang | null;
    if (stored) setLangState(stored);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("money_fyi_lang", l);
  };
  const t = useMemo(() => (k: DictKey) => dict[lang][k] ?? dict.en[k], [lang]);
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "hi", label: "Hindi", native: "हिन्दी" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "fr", label: "French", native: "Français" },
];
