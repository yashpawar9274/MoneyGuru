import React from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useStore } from "../lib/store";
import { API_BASE } from "../lib/api";

export default function SettingsScreen() {
  const { clearAll, transactions } = useStore();
  return (
    <View style={{ padding: 16 }}>
      <Text style={s.h}>SETTINGS</Text>
      <View style={s.card}>
        <Text style={s.lbl}>API ENDPOINT</Text>
        <Text style={{ color: "#fff", marginTop: 6 }}>{API_BASE}</Text>
      </View>
      <View style={[s.card, { marginTop: 12 }]}>
        <Text style={s.lbl}>TRANSACTIONS</Text>
        <Text style={{ color: "#fff", marginTop: 6 }}>{transactions.length} stored locally</Text>
      </View>
      <Pressable
        onPress={() =>
          Alert.alert("Clear all?", "This cannot be undone.", [
            { text: "Cancel" },
            { text: "Delete", style: "destructive", onPress: clearAll },
          ])
        }
        style={[s.card, { marginTop: 12, alignItems: "center" }]}
      >
        <Text style={{ color: "#ff5e5e", fontWeight: "800" }}>CLEAR ALL DATA</Text>
      </Pressable>
      <Text style={{ color: "#444", fontSize: 11, marginTop: 24, textAlign: "center" }}>
        MONEY.FYI Mobile · Expo · v1.0.0
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  h: { color: "#c4ff3d", fontWeight: "800", fontSize: 20, letterSpacing: 2, marginBottom: 12 },
  card: { backgroundColor: "#141416", padding: 16, borderRadius: 20 },
  lbl: { color: "#666", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
});
