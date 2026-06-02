import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";
import { useStore } from "../lib/store";
import { API_BASE, scanBill } from "../lib/api";

export default function AIScreen() {
  const { transactions, addTransaction } = useStore();
  const [advice, setAdvice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/ai-advice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: transactions.slice(0, 80),
          lang: "en",
        }),
      });
      const data = await r.json();
      setAdvice(data.message ?? "No advice");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const speak = () => advice && Speech.speak(advice, { language: "en-US" });

  const scan = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
    if (res.canceled || !res.assets[0].base64) return;
    setBusy(true);
    try {
      const data = await scanBill(`data:image/jpeg;base64,${res.assets[0].base64}`);
      addTransaction({
        type: "expense", amount: data.total, category: data.category as any,
        note: data.merchant, date: new Date().toISOString(), source: "scan",
      });
      Alert.alert("Added", `₹${data.total} from ${data.merchant}`);
    } catch (e: any) {
      Alert.alert("Scan failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ padding: 16, flex: 1 }}>
      <Text style={s.h}>AI COACH</Text>
      <View style={s.card}>
        <Text style={{ color: "#fff", lineHeight: 22 }}>
          {advice ?? "Tap below for savings tips powered by Gemini."}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <Pressable onPress={ask} disabled={busy} style={s.btn}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={s.btnTxt}>ASK AI</Text>}
          </Pressable>
          {advice && (
            <Pressable onPress={speak} style={[s.btn, { backgroundColor: "#222" }]}>
              <Text style={[s.btnTxt, { color: "#fff" }]}>LISTEN</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Pressable onPress={scan} style={[s.card, { marginTop: 16, alignItems: "center", borderStyle: "dashed", borderWidth: 2, borderColor: "#333" }]}>
        <Text style={{ color: "#c4ff3d", fontWeight: "800" }}>📷 SCAN BILL</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  h: { color: "#c4ff3d", fontWeight: "800", fontSize: 20, letterSpacing: 2, marginBottom: 12 },
  card: { backgroundColor: "#141416", padding: 16, borderRadius: 20 },
  btn: { backgroundColor: "#c4ff3d", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  btnTxt: { color: "#000", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
});
