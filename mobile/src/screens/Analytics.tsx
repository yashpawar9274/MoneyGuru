import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useStore, inRange, totals } from "../lib/store";
import { CATEGORIES } from "../lib/types";

export default function AnalyticsScreen() {
  const { transactions } = useStore();
  const week = useMemo(() => totals(inRange(transactions, 7)), [transactions]);
  const month = useMemo(() => totals(inRange(transactions, 30)), [transactions]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions.filter((t) => t.type === "expense")) {
      m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
    }
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const max = arr[0]?.[1] ?? 1;
    return arr.map(([k, v]) => ({ k, v, pct: v / max }));
  }, [transactions]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h}>ANALYTICS</Text>
      <View style={s.card}>
        <Text style={s.lbl}>THIS WEEK</Text>
        <Text style={s.big}>₹{week.expense.toFixed(0)} spent</Text>
        <Text style={{ color: "#c4ff3d" }}>+₹{week.income.toFixed(0)} earned</Text>
      </View>
      <View style={[s.card, { marginTop: 12 }]}>
        <Text style={s.lbl}>THIS MONTH</Text>
        <Text style={s.big}>₹{month.expense.toFixed(0)} spent</Text>
        <Text style={{ color: "#c4ff3d" }}>+₹{month.income.toFixed(0)} earned</Text>
      </View>
      <Text style={[s.lbl, { marginTop: 20 }]}>BY CATEGORY</Text>
      {byCat.map(({ k, v, pct }) => (
        <View key={k} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#ccc" }}>
              {CATEGORIES.find((c) => c.id === k)?.emoji} {k}
            </Text>
            <Text style={{ color: "#fff" }}>₹{v.toFixed(0)}</Text>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct * 100}%` }]} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { color: "#c4ff3d", fontWeight: "800", fontSize: 20, letterSpacing: 2, marginBottom: 12 },
  card: { backgroundColor: "#141416", padding: 16, borderRadius: 20 },
  lbl: { color: "#666", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  big: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 6 },
  barBg: { height: 8, backgroundColor: "#222", borderRadius: 4, marginTop: 6, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: "#c4ff3d" },
});
