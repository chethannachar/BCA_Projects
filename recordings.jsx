// File: C:/Users/ADMIN/maps/voiceRecognition.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { Audio } from "expo-av";

export default function VoiceRecognition({ visible, onClose, onRecognized }) {
  const SERVER_URL = "http://172.29.149.65:5000";
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) startRecordingFlow();
    else stopAndUnloadRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.6,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else scaleAnim.setValue(1);
  }, [isRecording]);

  const startRecordingFlow = async () => {
    try {
      const p = await Audio.requestPermissionsAsync();
      if (!p.granted) {
        Alert.alert("Permission required", "Microphone permission is required.");
        onClose && onClose();
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
    } catch (err) {
      console.error("startRecordingFlow error", err);
      Alert.alert("Error", "Failed to start recording.");
      onClose && onClose();
    }
  };

  const stopAndUnloadRecording = async () => {
    try {
      if (recording) {
        setIsRecording(false);
        try {
          await recording.stopAndUnloadAsync();
        } catch {}
        setRecording(null);
      }
    } catch (err) {
      console.warn("stopAndUnloadRecording error", err);
    }
  };

  const acceptRecording = async () => {
    setProcessing(true);
    try {
      if (!recording) {
        Alert.alert("No recording", "No audio was recorded.");
        setProcessing(false);
        onClose && onClose();
        return;
      }

      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      const form = new FormData();
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename || "audio.m4a");
      const ext = match ? match[1] : "m4a";
      form.append("file", {
        uri,
        name: filename || `recording.${ext}`,
        type: `audio/${ext}`,
      });

      const resp = await fetch(`${SERVER_URL}/recognize`, { method: "POST", body: form });
      const data = await resp.json();
      const recognizedText = data.text || data.recognized_text || "";
      if (recognizedText) onRecognized && onRecognized(recognizedText);
      else Alert.alert("No speech recognized", "Server returned no recognized text.");
    } catch (err) {
      console.error("acceptRecording error", err);
      Alert.alert("Error", "Failed to process recording.");
    } finally {
      setProcessing(false);
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {}
      onClose && onClose();
    }
  };

  const cancelRecording = async () => {
    try {
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch {}
        setRecording(null);
        setIsRecording(false);
      }
    } catch (err) {
      console.warn("cancelRecording error", err);
    } finally {
      onClose && onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={localStyles.overlay}>
        <View style={localStyles.centerBox}>
          <Animated.View style={[localStyles.micBubble, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={localStyles.micEmoji}>🎤</Text>
          </Animated.View>

          <Text style={localStyles.listeningText}>
            {processing
              ? "Processing..."
              : isRecording
              ? "Listening..."
              : "Preparing..."}
          </Text>

          <View style={localStyles.controlsRow}>
            <Pressable
              style={[localStyles.controlButton, { backgroundColor: "#ef4444" }]}
              onPress={cancelRecording}
              disabled={processing}
            >
              <Text style={localStyles.controlText}>✖</Text>
            </Pressable>

            <Pressable
              style={[localStyles.controlButton, { backgroundColor: "#22c55e" }]}
              onPress={acceptRecording}
              disabled={processing}
            >
              <Text style={localStyles.controlText}>✔</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerBox: {
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    width: "75%",
  },
  micBubble: {
    backgroundColor: "#1e3a8a",
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },
  micEmoji: {
    fontSize: 52,
  },
  listeningText: {
    color: "#fff",
    fontSize: 20,
    marginBottom: 25,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 40,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: {
    fontSize: 26,
    color: "#fff",
    fontWeight: "bold",
  },
});
