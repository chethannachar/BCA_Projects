import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { WebView } from "react-native-webview";

import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "C:/Users/ADMIN/maps/app/(tabs)/styles.jsx";
import SpeechRecognitionComponent from "C:/Users/ADMIN/maps/recordings.jsx";
import {
  getCurrentText,
  getNextText,
  isSpeaking,
  setTexts,
  speakCurrentItem,
  speakInfo,
  stopSpeaking,
} from "C:/Users/ADMIN/maps/speechservice.jsx";


import { CORRECT_TEXTS, IGNORE_TEXTS, SPLIT_KEYWORDS } from "C:/Users/ADMIN/maps/text.jsx";

export default function App() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [recognizedTexts, setRecognizedTexts] = useState([]);
  const [cropImages, setCropImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [uploadDisabled, setUploadDisabled] = useState(false);
  const [analyzingDots, setAnalyzingDots] = useState("");
  const [buttonLoading, setButtonLoading] = useState({});
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [showCrops, setShowCrops] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false); // Start OFF by default
  const [isListening, setIsListening] = useState(false);
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const appStateRef = useRef(AppState.currentState);
  // 🟣 Custom Alert Modal State
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
  });
  const [mapsModalVisible, setMapsModalVisible] = useState(false);
  const [mapsUrl, setMapsUrl] = useState(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const speechRef = useRef(null);
  const SERVER_URL = "http://172.29.149.65:5000";

  // Listen for app state changes (when user returns from Maps)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [voiceEnabled, recognizedTexts]);

  const handleAppStateChange = (nextAppState) => {
    // When app comes back to foreground after being in background (Maps was open)
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      // Resume voice/listening if it was enabled and we have items
      if (voiceEnabled && recognizedTexts.length > 0) {
        try {
          speechRef.current?.startListening();
          setIsListening(true);
        } catch (e) {
          console.warn('Failed to resume listening on app return:', e);
        }
      }
    }
    appStateRef.current = nextAppState;
    setAppState(nextAppState);
  };

  // Open Google Maps inside the in-app modal and pause app audio/recognition
  const openMapsInModal = async (url) => {
    // stop app audio and recognition to avoid collision
    stopSpeaking();
    try { speechRef.current?.stopListening(); } catch (e) {}
    setVoiceEnabled(false);
    setIsListening(false);
    setNavigationOpen(true);
    setMapsUrl(url);
    setMapsModalVisible(true);
  };

  const purifyTexts = (texts) => {
    const filteredTexts = [];
    texts.forEach((txt) => {
      if (!txt || typeof txt !== "string") return;

      const normalized = txt.replace(/\s+/g, "").toLowerCase();
      const shouldIgnore = IGNORE_TEXTS.some(
        (ignore) => normalized === ignore.replace(/\s+/g, "").toLowerCase()
      );
      if (shouldIgnore) return;

      let cleanTxt = txt.replace(/\s{2,}/g, " ").trim();
      if (CORRECT_TEXTS[cleanTxt]) cleanTxt = CORRECT_TEXTS[cleanTxt];

      const lowerTxt = cleanTxt.toLowerCase();

      // ✅ Detect matching keywords
      const found = SPLIT_KEYWORDS.filter((kw) => lowerTxt.includes(kw));

      const splits =
        found.length > 1
          ? found.map((facility) => {
              const startIdx = lowerTxt.indexOf(facility);
              return cleanTxt.substring(startIdx, startIdx + facility.length);
            })
          : [cleanTxt];

      splits.forEach((s) =>
        s.split("\n").forEach((line) => {
          if (line.trim()) filteredTexts.push(line.trim());
        })
      );
    });

    return filteredTexts;
  };

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setAnalyzingDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  const pickImage = async () => {
    if (loading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled && result.assets?.length > 0) {
      setUploadedImage(result.assets[0].uri);
      setRecognizedTexts([]);
      setCropImages([]);
      setUploadEnabled(true);
      setUploadDisabled(false);
      setShowCrops(false);
    }
  };

  const fetchCropsFromServer = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/get_crops`);
      const data = await res.json();
      if (data.crops && Array.isArray(data.crops)) {
        const base64Imgs = data.crops.map(
          (c) => "data:image/jpeg;base64," + c.image_base64
        );
        setCropImages(base64Imgs);
      }
    } catch (e) {
      console.error("Failed to fetch crops:", e);
    }
  };

  const uploadImage = async () => {
    if (!uploadedImage) return;
    stopSpeaking();
    setLoading(true);
    setUploadEnabled(false);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: uploadedImage,
        type: "image/jpeg",
        name: "upload.jpg",
      });

      const res = await fetch(`${SERVER_URL}/upload/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.boxes && Array.isArray(data.boxes)) {
        const texts = data.boxes.map((b) => b.recognized_text || "");
        const filteredTexts = purifyTexts(texts);
        setRecognizedTexts(filteredTexts);

        // Ensure speech service knows the texts and enable voice/mic automatically
        setTexts(filteredTexts);
        setAutoVoiceEnabled(true);
        setVoiceEnabled(true);

        // Start the WebView mic shortly after state updates (allow render to settle)
        setTimeout(() => {
          try {
            speechRef.current?.startListening();
          } catch (e) {
            console.warn('startListening failed', e);
          }
        }, 250);

        await fetchCropsFromServer();
        setUploadDisabled(true);
      } else {
        setRecognizedTexts([]);
        setCropImages([]);
        // No results -> turn off voice/mic
        setAutoVoiceEnabled(false);
        setVoiceEnabled(false);
        try { speechRef.current?.stopListening(); } catch (e) {}
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Upload failed.");
    } finally {
      setLoading(false);
      setUploadEnabled(true);
    }
  };

  // ✅ Voice state behavior
  useEffect(() => {
    if (voiceEnabled && recognizedTexts.length > 0) {
      setTexts(recognizedTexts);
      // Start speech and enable mic automatically
      speakCurrentItem(recognizedTexts[0], {
        rate: 0.95,
        pitch: 1.0,
        onDone: () => {
          // Auto-restart listening after speech ends
          if (speechRef.current) {
            speechRef.current.startListening();
          }
        },
      });
      setIsListening(true);
    } else {
      stopSpeaking();
      setIsListening(false);
    }
  }, [voiceEnabled, recognizedTexts]);

  const findBestMatch = (command, targetTexts) => {
    const normalizedCommand = command.toLowerCase().replace(/\s+/g, " ").trim();

    // Try exact match first
    const exactMatch = targetTexts.find(
      (text) => text.toLowerCase() === normalizedCommand
    );
    if (exactMatch) return exactMatch;

    // Try contains match
    const containsMatch = targetTexts.find(
      (text) =>
        text.toLowerCase().includes(normalizedCommand) ||
        normalizedCommand.includes(text.toLowerCase())
    );
    if (containsMatch) return containsMatch;

    // Try word-by-word matching
    const commandWords = normalizedCommand.split(" ");
    const matches = targetTexts.map((text) => {
      const textWords = text.toLowerCase().split(" ");
      const matchingWords = commandWords.filter((word) =>
        textWords.some((tw) => tw.includes(word) || word.includes(tw))
      );
      return {
        text,
        score:
          matchingWords.length /
          Math.max(commandWords.length, textWords.length),
      };
    });

    // Find best matching text with at least 50% word match
    const bestMatch = matches.reduce(
      (best, current) => (current.score > best.score ? current : best),
      { text: null, score: 0 }
    );
    return bestMatch.score >= 0.5 ? bestMatch.text : null;
  };

  const handleVoiceCommand = async (command) => {
    if (!command || isSpeaking()) return;

    const normalizedCommand = command.toLowerCase().trim();
    const currentText = getCurrentText();

    // Special handling when user tries to exit navigation
    if (
      normalizedCommand.includes("exit navigation") ||
      normalizedCommand.includes("close navigation") ||
      normalizedCommand.includes("exit maps") ||
      normalizedCommand.includes("close maps")
    ) {
      await speakInfo("Please switch back to the application manually. Say resume when you return to continue.");
      return;
    }

    if (!currentText) return;

    if (normalizedCommand.includes("next")) {
      const nextText = getNextText();
      if (nextText) {
        await speakCurrentItem(nextText, { rate: 0.95 });
      } else {
        await speakInfo("No more items to read");
      }
      return;
    }

    // Voice-triggered "information" -> show same custom modal as Info button,
    // stop recognition while modal is shown, read the info aloud, auto-close, then resume.
    if (normalizedCommand.includes("information") || normalizedCommand.includes("details")) {
      try {
        const response = await fetch(`${SERVER_URL}/get_info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_name: currentText }),
        });
        const data = await response.json();

        // stop recognition while info modal is visible
        try { speechRef.current?.stopListening(); } catch (e) {}
        setIsListening(false);

        // show modal
        setCustomAlert({
          visible: true,
          title: currentText,
          message: data.info || "No information available.",
        });

        // speak the info and wait for completion (speakInfo now returns a Promise)
        try {
          await speakInfo(data.info || "No information available", { rate: 0.95 });
        } catch (e) {
          /* ignore speech errors */
        }

        // auto-close modal after speech finishes (voice flow)
        setCustomAlert((prev) => ({ ...prev, visible: false }));

        // DO NOT reset setTexts here—it resets _currentIndex to 0
        // Just resume listening on the current item
         setTimeout(() => {
           if (recognizedTexts.length > 0) {
             setVoiceEnabled(true);
           }
           try { speechRef.current?.startListening(); } catch (e) {}
          setIsListening(true);
         }, 300);
       } catch (err) {
         await speakInfo("Failed to fetch information");
       }
       return;
     }

    if (normalizedCommand.includes("navigate") || normalizedCommand.includes("direction")) {
      try {
        const destination = encodeURIComponent(`${currentText} Mysuru`);
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving&dir_action=navigate`;
        await speakInfo("Opening navigation");
        // Open Google Maps app directly for native voice guidance
        await Linking.openURL(url);
        // Keep voiceEnabled = true so mic can resume when user returns
        // Only stop listening temporarily during navigation
         try { speechRef.current?.stopListening(); } catch (e) {}
         setIsListening(false);
        } catch {
          await speakInfo("Failed to open navigation");
        }
        return;
     }
   };

  const handleInfoClick = async (index, text) => {
    try {
      setButtonLoading((prev) => ({ ...prev, [`info-${index}`]: true }));
      setAutoVoiceEnabled(false);
       const response = await fetch(`${SERVER_URL}/get_info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: text }),
      });
      const data = await response.json();

      // 🟣 Use custom modal here instead of Alert.alert()
      setCustomAlert({
        visible: true,
        title: text,
        message: data.info || "No information available.",
      });
    } catch (err) {
      setCustomAlert({
        visible: true,
        title: "Error",
        message: "Failed to fetch information.",
      });
    } finally {
      setButtonLoading((prev) => ({ ...prev, [`info-${index}`]: false }));
    }
  };

  const handleNavigateClick = async (text) => {
    try {
      setAutoVoiceEnabled(false);
       const destination = encodeURIComponent(`Sjce ${text} Mysuru`);
       const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving&dir_action=navigate`;
       await Linking.openURL(url);
       // Stop app listening while Maps is active
       try { speechRef.current?.stopListening(); } catch (e) {}
       setIsListening(false);
     } catch {
       Alert.alert("Error", "Failed to open navigation.");
     }
   };

  const renderCrop = ({ item }) => (
    <TouchableOpacity
      style={styles.cropBox}
      onPress={() => setSelectedCrop(item)}
    >
      <Image source={{ uri: item }} style={styles.cropImage} />
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" backgroundColor="#000" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Text style={styles.title}>Campus Guide</Text>
        </View>

        <View style={styles.cardContainer}>
          <View style={styles.topImageContainer}>
            {uploadedImage ? (
              <Image source={{ uri: uploadedImage }} style={styles.topImage} />
            ) : (
              <View style={styles.topPlaceholder}>
                <Text style={styles.placeholderText}>
                  Upload an image to start
                </Text>
              </View>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.pickButton, { opacity: loading ? 0.6 : 1 }]}
              onPress={pickImage}
              disabled={loading}
            >
              <Text style={styles.pickButtonText}>Pick Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadButton,
                {
                  opacity:
                    uploadEnabled && !loading && !uploadDisabled ? 1 : 0.6,
                },
              ]}
              onPress={!uploadDisabled ? uploadImage : undefined}
              disabled={!uploadEnabled || loading || uploadDisabled}
            >
              <Text style={styles.uploadButtonText}>
                {loading ? `Analyzing${analyzingDots}` : "Upload & Analyze"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.tipText}>
            Tip: Choose Gallery to start.
          </Text>
          <Text style={styles.dictate}>Dictate</Text>
          <Text style={styles.command}>Voice Command</Text>
          {/* ✅ Fixed Voice Button */}
          <View
            style={{
              alignSelf: "center",
              width: "90%",
              marginBottom: 20,
              marginTop: 8,
              marginLeft: -320,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                if (!next) stopSpeaking();
              }}
              style={{
                width: 125,
                height: 35,
                borderRadius: 65 / 2,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "transparent",
                backgroundColor: voiceEnabled ? "transparent" : "transparent",
                shadowColor: "transparent",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.6,
                shadowRadius: 10,
                elevation: 8,
                alignSelf: "center",
                marginVertical: 12,
              }}
            >
              <Ionicons
                name={voiceEnabled ? "volume-high" : "volume-mute"}
                size={30}
                color={voiceEnabled ? "rgba(221, 13, 13, 1)" : "rgba(255, 255, 255, 1)"}
              />
            </TouchableOpacity>
          </View>
          {/* Add Voice Command Button */}
          <View style={styles.voiceCommandContainer}>
            <TouchableOpacity
              style={[
                styles.voiceCommandButton,
                { backgroundColor: isListening ? "transparent" : "transparent" },
              ]}
              onPress={() => {
                if (isListening) {
                  // Turn off listening and voice
                  try { speechRef.current?.stopListening(); } catch (e) {}
                  setIsListening(false);
                  setVoiceEnabled(false);
                  setAutoVoiceEnabled(false);
                   stopSpeaking();
                } else {
                  // Turn on listening and voice; ensure texts are set
                  if (!voiceEnabled) setVoiceEnabled(true);
                  setAutoVoiceEnabled(true);
                  if (recognizedTexts.length > 0) setTexts(recognizedTexts);
                  try { speechRef.current?.startListening(); } catch (e) {}
                  setIsListening(true);
                }
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name={isListening ? "mic" : "mic-outline"}
                  size={32}
                  color={isListening ? "#5c0404ff" : "#fffcfcff"}
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.voiceCommandText}>
                  {isListening ? "" : ""}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <SpeechRecognitionComponent
            ref={speechRef}
            autoStart={voiceEnabled} // Auto-start when enabled
            onResult={handleVoiceCommand}
            onEnd={() => {
              // Keep listening unless voice is disabled or speaking
              if (voiceEnabled && !isSpeaking()) {
                setTimeout(() => {
                  speechRef.current?.startListening();
                }, 50);
              }
            }}
          />
          {/* In-app Maps Modal (WebView) */}
          <Modal visible={mapsModalVisible} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: "#000" }}>
              <View style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setMapsModalVisible(false);
                    setNavigationOpen(false);
                    // resume app listening briefly
                    setTimeout(() => {
                      if (recognizedTexts.length > 0) {
                        setVoiceEnabled(true);
                        setTexts(recognizedTexts);
                      }
                      try { speechRef.current?.startListening(); } catch (e) {}
                    }, 300);
                  }}
                  style={{ padding: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8 }}
                >
                  <Text style={{ color: "#fff" }}>Close Maps</Text>
                </TouchableOpacity>
                <Text style={{ color: "#fff" }}>Google Maps</Text>
                <View style={{ width: 64 }} />
              </View>
              <WebView source={{ uri: mapsUrl }} style={{ flex: 1 }} />
            </View>
          </Modal>

          {recognizedTexts.length > 0 && (
            <View style={styles.recognizedContainer}>
              {recognizedTexts.map((text, idx) => (
                <View key={idx} style={styles.recognizedRow}>
                  <View style={styles.labelTextRow}>
                    <View style={styles.labelContainer}>
                      <Text style={styles.labelText}>
                        {text.toLowerCase().includes("office")
                          ? "Office"
                          : text.toLowerCase().includes("guest")
                          ? "Guest"
                          : text.toLowerCase().includes("dept")
                          ? "Dept"
                          : text.toLowerCase().includes("engineering")
                          ? "Dept"
                          : text.toLowerCase().includes("hostel")
                          ? "Hostel"
                          : text.toLowerCase().includes("library")
                          ? "Library"
                          : "Area"}
                      </Text>
                    </View>
                    <Text style={styles.itemText}>{text}</Text>
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.infoButton}
                      onPress={async () => {
                        try {
                          setButtonLoading((prev) => ({
                            ...prev,
                            [`info-${idx}`]: true,
                          }));

                          // Stop recognizer while info modal is displayed
                          setAutoVoiceEnabled(false);
                           try { speechRef.current?.stopListening(); } catch (e) {}
                          setIsListening(false);

                          const response = await fetch(`${SERVER_URL}/get_info`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ item_name: text }),
                          });

                          const data = await response.json();

                          // 🟣 Custom Styled Pop-Up Instead of Alert.alert()
                          setCustomAlert({
                            visible: true,
                            title: text,
                            message: data.info || "No information available.",
                          });
                        } catch (err) {
                          setCustomAlert({
                            visible: true,
                            title: "Error",
                            message: "Failed to fetch information.",
                          });
                        } finally {
                          setButtonLoading((prev) => ({
                            ...prev,
                            [`info-${idx}`]: false,
                          }));
                        }
                      }}
                    >
                      {buttonLoading[`info-${idx}`] ? (
                        <ActivityIndicator size="small" color="#334155" />
                      ) : (
                        <Text style={styles.infoButtonText}>Info</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.navigateButton}
                      onPress={async () => {
                        try {
                          const destination = encodeURIComponent(`Sjce ${text} Mysuru`);
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving&dir_action=navigate`;
                           await Linking.openURL(url);
                           // Stop app listening while Maps is active
                           try { speechRef.current?.stopListening(); } catch (e) {}
                           setIsListening(false);
                         } catch {
                           Alert.alert("Error", "Failed to open navigation.");
                         }
                       }}
                     >
                       <Text style={styles.navigateButtonText}>Navigate</Text>
                     </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {cropImages.length > 0 && (
            <View style={styles.uploadContainer}>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setShowCrops(!showCrops)}
              >
                <Text style={styles.toggleButtonText}>
                  {showCrops
                    ? "Hide Cropped Images ▲"
                    : "View Cropped Images ▼"}
                </Text>
              </TouchableOpacity>

              {showCrops && (
                <View style={styles.croppedDropdown}>
                  <Text style={styles.croppedDropdownTitle}>
                    Cropped Images
                  </Text>
                  <FlatList
                    data={cropImages}
                    renderItem={renderCrop}
                    keyExtractor={(_, i) => i.toString()}
                    numColumns={2}
                    contentContainerStyle={styles.croppedGrid}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        <Modal visible={!!selectedCrop} transparent animationType="fade">
          <View style={styles.fullscreenContainer}>
            <Image
              source={{ uri: selectedCrop }}
              style={styles.fullscreenImage}
            />
            <Pressable
              style={styles.closeButton}
              onPress={() => setSelectedCrop(null)}
            >
              <Text style={styles.closeText}>✖</Text>
            </Pressable>
          </View>
        </Modal>
        {/* 🟣 Custom Styled Info Pop-up */}
        <Modal visible={customAlert.visible} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.6)",
            }}
          >
            <View
              style={{
                width: "80%",
                backgroundColor: "#000",
                borderRadius: 16,
                borderWidth: 2,
                borderColor: "purple",
                padding: 20,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "bold",
                  marginBottom: 10,
                  textAlign: "center",
                }}
              >
                {customAlert.title}
              </Text>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 16,
                  textAlign: "center",
                  marginBottom: 20,
                }}
              >
                {customAlert.message}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setCustomAlert({ ...customAlert, visible: false });
                  setTimeout(() => {
                    if (autoVoiceEnabled && recognizedTexts.length > 0) {
                      setVoiceEnabled(true);
                      setTexts(recognizedTexts);
                    }
                    if (autoVoiceEnabled) {
                      try { speechRef.current?.startListening(); } catch (e) {}
                      setIsListening(true);
                    }
                  }, 300);
                 }}
                style={{
                  alignSelf: "center",
                  backgroundColor: "purple",
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 25,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}