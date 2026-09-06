import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import type { UdhaariPerson, UdhaariTransaction, UdhaariTransactionType } from "./types";
import { rupeesToPaise } from "./types";

const PEOPLE_KEY = "money-fyi:udhaari:people:v2";
const TRANSACTIONS_KEY = "money-fyi:udhaari:transactions:v2";
const LEGACY_KEY = "money-fyi:udhaari:v1";

type LegacyEntry = {
  id?: string;
  name?: string;
  phone?: string;
  amount?: number;
  amountPaise?: number;
  type?: UdhaariTransactionType | "udhari_given" | "udhari_taken";
  note?: string;
  date?: string;
};

type LedgerContext = {
  people: UdhaariPerson[];
  transactions: UdhaariTransaction[];
  addPerson: (name: string, phone?: string) => UdhaariPerson;
  findPerson: (name: string, phone?: string) => UdhaariPerson | undefined;
  addTransaction: (input: Omit<UdhaariTransaction, "id" | "createdAt">) => void;
  updateTransaction: (
    id: string,
    patch: Partial<Omit<UdhaariTransaction, "id" | "personId" | "createdAt">>,
  ) => void;
  removeTransaction: (id: string) => void;
};

const LedgerContext = createContext<LedgerContext | null>(null);

export function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function normalizePhone(value?: string) {
  const digits = value?.replace(/\D/g, "");
  return digits ? digits.slice(-10) : undefined;
}

function makeId() {
  return String(uuid.v4());
}

function balanceFor(transactions: UdhaariTransaction[], personId: string) {
  return transactions.reduce(
    (total, item) =>
      item.personId === personId
        ? total + (item.type === "given" ? item.amountPaise : -item.amountPaise)
        : total,
    0,
  );
}

function migrateLegacy(value: string | null) {
  if (!value) return { people: [] as UdhaariPerson[], transactions: [] as UdhaariTransaction[] };
  try {
    const legacy = JSON.parse(value) as LegacyEntry[];
    const people: UdhaariPerson[] = [];
    const transactions: UdhaariTransaction[] = [];
    for (const item of Array.isArray(legacy) ? legacy : []) {
      const name = item.name?.trim();
      if (!name) continue;
      const normalizedName = normalizeName(name);
      const normalizedPhone = normalizePhone(item.phone);
      let person = people.find(
        (candidate) =>
          candidate.normalizedName === normalizedName &&
          (!normalizedPhone || candidate.normalizedPhone === normalizedPhone),
      );
      if (!person) {
        person = {
          id: makeId(),
          name,
          phone: item.phone?.trim() || undefined,
          normalizedName,
          normalizedPhone,
          createdAt: item.date || new Date().toISOString(),
        };
        people.push(person);
      }
      const amountPaise = Number.isFinite(item.amountPaise)
        ? Math.round(item.amountPaise!)
        : rupeesToPaise(item.amount ?? 0);
      if (amountPaise <= 0) continue;
      transactions.push({
        id: item.id || makeId(),
        personId: person.id,
        type: item.type === "returned" || item.type === "udhari_taken" ? "returned" : "given",
        amountPaise,
        note: item.note?.trim() || "",
        createdAt: item.date || new Date().toISOString(),
        transactionDate: item.date || new Date().toISOString(),
      });
    }
    return { people, transactions };
  } catch {
    return { people: [] as UdhaariPerson[], transactions: [] as UdhaariTransaction[] };
  }
}

export function UdhaariProvider({ children }: { children: React.ReactNode }) {
  const [people, setPeople] = useState<UdhaariPerson[]>([]);
  const [transactions, setTransactions] = useState<UdhaariTransaction[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [peopleValue, transactionValue, legacyValue] = await Promise.all([
        AsyncStorage.getItem(PEOPLE_KEY),
        AsyncStorage.getItem(TRANSACTIONS_KEY),
        AsyncStorage.getItem(LEGACY_KEY),
      ]);
      let nextPeople: UdhaariPerson[] = [];
      let nextTransactions: UdhaariTransaction[] = [];
      try {
        nextPeople = peopleValue ? JSON.parse(peopleValue) : [];
      } catch {
        nextPeople = [];
      }
      try {
        nextTransactions = transactionValue ? JSON.parse(transactionValue) : [];
      } catch {
        nextTransactions = [];
      }
      if (!peopleValue && !transactionValue && legacyValue) {
        const migrated = migrateLegacy(legacyValue);
        nextPeople = migrated.people;
        nextTransactions = migrated.transactions;
        await AsyncStorage.setItem(PEOPLE_KEY, JSON.stringify(nextPeople));
        await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(nextTransactions));
      }
      setPeople(Array.isArray(nextPeople) ? nextPeople : []);
      setTransactions(Array.isArray(nextTransactions) ? nextTransactions : []);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) void AsyncStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
  }, [people, ready]);
  useEffect(() => {
    if (ready) void AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  }, [transactions, ready]);

  const value = useMemo<LedgerContext>(
    () => ({
      people,
      transactions,
      addPerson: (name, phone) => {
        const existing = people.find(
          (person) =>
            person.normalizedName === normalizeName(name) &&
            (!normalizePhone(phone) || person.normalizedPhone === normalizePhone(phone)),
        );
        if (existing) return existing;
        const person: UdhaariPerson = {
          id: makeId(),
          name: name.trim(),
          phone: phone?.trim() || undefined,
          normalizedName: normalizeName(name),
          normalizedPhone: normalizePhone(phone),
          createdAt: new Date().toISOString(),
        };
        setPeople((current) => [person, ...current]);
        return person;
      },
      findPerson: (name, phone) =>
        people.find(
          (person) =>
            person.normalizedName === normalizeName(name) &&
            (!normalizePhone(phone) || person.normalizedPhone === normalizePhone(phone)),
        ),
      addTransaction: (input) => {
        if (input.amountPaise <= 0) throw new Error("Amount must be greater than zero");
        setTransactions((current) => [
          { ...input, id: makeId(), createdAt: new Date().toISOString() },
          ...current,
        ]);
      },
      updateTransaction: (id, patch) => {
        if (patch.amountPaise !== undefined && patch.amountPaise <= 0)
          throw new Error("Amount must be greater than zero");
        setTransactions((current) =>
          current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );
      },
      removeTransaction: (id) =>
        setTransactions((current) => current.filter((item) => item.id !== id)),
    }),
    [people, transactions],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useUdhaari() {
  const context = useContext(LedgerContext);
  if (!context) throw new Error("UdhaariProvider missing");
  return context;
}

export function personTransactions(personId: string, transactions: UdhaariTransaction[]) {
  return transactions
    .filter((item) => item.personId === personId)
    .sort((a, b) => +new Date(b.transactionDate) - +new Date(a.transactionDate));
}

export function personBalance(personId: string, transactions: UdhaariTransaction[]) {
  return Math.max(0, balanceFor(transactions, personId));
}
