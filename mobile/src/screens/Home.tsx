import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { useStore, totals, groupByDay } from "../lib/store";
import { CATEGORIES, type TxType } from "../lib/types";

export default function HomeScreen() {
  const { transactions, addTransaction } = useStore();
  const t = useMemo(() => totals(transactions), [transactions]);
  const grouped = useMemo(() => groupByDay(transactions), [transactions]);
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0].id);

  const cats = CATEGORIES.filter((c) => c.kind === type);

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return Alert.alert("Invalid amount");
    addTransaction({ type, amount: n, category: cat as any, note: "", date: new Date().toISOString(), source: "manual" });
    setAmount("");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.brand}>MONEY.FYI</Text>
      <View style={s.card}>
        <Text style={s.lbl}>BALANCE</Text>
        <Text style={s.balance}>₹{t.balance.toFixed(0)}</Text>
        <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
          <Text style={{ color: "#c4ff3d" }}>+₹{t.income.toFixed(0)}</Text>
          <Text style={{ color: "#ff5e5e" }}>-₹{t.expense.toFixed(0)}</Text>
        </View>
      </View>

      <View style={[s.card, { marginTop: 12 }]}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {(["expense", "income"] as TxType[]).map((k) => (
            <Pressable key={k} onPress={() => { setType(k); setCat(CATEGORIES.find(c => c.kind === k)!.id); }}
              style={[s.pill, type === k && s.pillOn]}>
              <Text style={{ color: type === k ? "#000" : "#888", fontWeight: "700" }}>{k.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="₹0"
          placeholderTextColor="#444" style={s.input}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {cats.map((c) => (
            <Pressable key={c.id} onPress={() => setCat(c.id)}
              style={[s.catChip, cat === c.id && s.catOn]}>
              <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
              <Text style={{ color: "#ccc", fontSize: 10 }}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={submit} style={s.btn}><Text style={{ color: "#000", fontWeight: "800" }}>ADD</Text></Pressable>
      </View>

      <Text style={[s.lbl, { marginTop: 20 }]}>TIMELINE</Text>
      {grouped.map(([day, items]) => (
        <View key={day} style={{ marginTop: 12 }}>
          <Text style={{ color: "#666", fontSize: 11, marginBottom: 6 }}>{day}</Text>
          {items.map((it) => (
            <View key={it.id} style={s.row}>
              <Text style={{ fontSize: 20 }}>{CATEGORIES.find(c => c.id === it.category)?.emoji}</Text>
              <Text style={{ color: "#fff", flex: 1, marginLeft: 10 }}>{it.note || it.category}</Text>
              <Text style={{ color: it.type === "income" ? "#c4ff3d" : "#ff5e5e", fontWeight: "700" }}>
                {it.type === "income" ? "+" : "-"}₹{it.amount}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  brand: { color: "#c4ff3d", fontWeight: "800", fontSize: 20, letterSpacing: 2, marginBottom: 12 },
  card: { backgroundColor: "#141416", padding: 16, borderRadius: 20 },
  lbl: { color: "#666", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  balance: { color: "#fff", fontSize: 40, fontWeight: "800", marginTop: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#222" },
  pillOn: { backgroundColor: "#c4ff3d" },
  input: { color: "#fff", fontSize: 28, fontWeight: "800", borderBottomWidth: 1, borderBottomColor: "#333", paddingVertical: 8 },
  catChip: { padding: 10, borderRadius: 14, backgroundColor: "#1f1f22", marginRight: 8, alignItems: "center", minWidth: 70 },
  catOn: { backgroundColor: "#2a3a10", borderWidth: 1, borderColor: "#c4ff3d" },
  btn: { marginTop: 14, backgroundColor: "#c4ff3d", padding: 14, borderRadius: 14, alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1c1c1f" },
});
