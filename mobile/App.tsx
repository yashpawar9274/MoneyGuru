import "react-native-gesture-handler";
import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StoreProvider } from "./src/lib/store";
import { TrialProvider, useTrial, fmt } from "./src/lib/trial";
import TrialLock from "./src/components/TrialLock";
import HomeScreen from "./src/screens/Home";
import AnalyticsScreen from "./src/screens/Analytics";
import AIScreen from "./src/screens/AI";
import SettingsScreen from "./src/screens/Settings";
import PricingScreen from "./src/screens/Pricing";

const qc = new QueryClient();
type Tab = "home" | "analytics" | "ai" | "pro" | "settings";
const TABS: Tab[] = ["home", "analytics", "ai", "pro", "settings"];

function TrialPill({ onPress }: { onPress: () => void }) {
  const { ready, isPro, msLeft, locked } = useTrial();
  if (!ready || isPro || locked) return null;
  return (
    <Pressable onPress={onPress} style={styles.pill}>
      <Text style={styles.pillLabel}>FREE TRIAL </Text>
      <Text style={[styles.pillTime, msLeft < 3600_000 && { color: "#f87171" }]}>
        {fmt(msLeft)}
      </Text>
    </Pressable>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  return (
    <SafeAreaView style={styles.root}>
      <TrialPill onPress={() => setTab("pro")} />
      <View style={{ flex: 1 }}>
        {tab === "home" && <HomeScreen />}
        {tab === "analytics" && <AnalyticsScreen />}
        {tab === "ai" && <AIScreen />}
        {tab === "pro" && <PricingScreen />}
        {tab === "settings" && <SettingsScreen />}
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
            <Text style={[styles.tabTxt, tab === t && styles.tabActive]}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      {tab !== "pro" && tab !== "settings" && <TrialLock onUpgrade={() => setTab("pro")} />}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <TrialProvider>
        <StoreProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <Shell />
          </SafeAreaProvider>
        </StoreProvider>
      </TrialProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  pill: {
    alignSelf: "center",
    flexDirection: "row",
    marginTop: 6,
    backgroundColor: "#15151a",
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillLabel: { color: "#6b6b72", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  pillTime: { color: "#c4ff3d", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#222",
    backgroundColor: "#09090b",
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabTxt: { color: "#666", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  tabActive: { color: "#c4ff3d" },
});
