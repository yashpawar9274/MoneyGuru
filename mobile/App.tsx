import "react-native-gesture-handler";
import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StoreProvider } from "./src/lib/store";
import HomeScreen from "./src/screens/Home";
import AnalyticsScreen from "./src/screens/Analytics";
import AIScreen from "./src/screens/AI";
import SettingsScreen from "./src/screens/Settings";

const qc = new QueryClient();
type Tab = "home" | "analytics" | "ai" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <QueryClientProvider client={qc}>
      <StoreProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <SafeAreaView style={styles.root}>
            <View style={{ flex: 1 }}>
              {tab === "home" && <HomeScreen />}
              {tab === "analytics" && <AnalyticsScreen />}
              {tab === "ai" && <AIScreen />}
              {tab === "settings" && <SettingsScreen />}
            </View>
            <View style={styles.tabs}>
              {(["home", "analytics", "ai", "settings"] as Tab[]).map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
                  <Text style={[styles.tabTxt, tab === t && styles.tabActive]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#222",
    backgroundColor: "#09090b",
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabTxt: { color: "#666", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  tabActive: { color: "#c4ff3d" },
});
