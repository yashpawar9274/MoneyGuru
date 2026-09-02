import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Speech from "expo-speech";
import { useTrial } from "../lib/trial";

const NEON = "#c4ff3d";

/** Full-screen paywall shown when the 24h APK trial ends, with a Hinglish voice message. */
export default function TrialLock({ onUpgrade }: { onUpgrade: () => void }) {
  const { locked } = useTrial();

  useEffect(() => {
    if (!locked) return;
    Speech.speak(
      "Sir ya Madam, aapka free trial khatam ho gaya hai. Sirf sau rupaye ka ek month subscription le lijiye.",
      { language: "hi-IN", rate: 0.95 },
    );
    return () => Speech.stop();
  }, [locked]);

  if (!locked) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Text style={{ fontSize: 26 }}>🔒</Text>
      </View>
      <Text style={styles.h1}>Free trial khatam</Text>
      <Text style={styles.p}>
        Aapka 24 ghante ka free access poora ho gaya. Tracking, analytics, bill scan, AI coach aur
        udhari/EMI — sab unlock karne ke liye ₹100 per month.
      </Text>
      <Pressable style={styles.cta} onPress={onUpgrade}>
        <Text style={styles.ctaTxt}>See plans — ₹100 / month</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,9,11,0.97)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    zIndex: 100,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(248,113,113,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 18 },
  p: { color: "#9b9ba1", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 },
  cta: {
    marginTop: 22,
    alignSelf: "stretch",
    backgroundColor: NEON,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaTxt: { color: "#09090b", fontWeight: "800", fontSize: 14 },
});
