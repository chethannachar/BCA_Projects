import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "C:/Users/ADMIN/maps/app/(tabs)/styles.jsx";
import SpeechRecognitionComponent from "C:/Users/ADMIN/maps/recordings.jsx";
import { speakTexts, stopSpeaking } from "C:/Users/ADMIN/maps/speechservice.jsx";
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
  const speechRef = useRef(null);

  const SERVER_URL = "http://172.29.149.65:5000";

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
        await fetchCropsFromServer();
        setUploadDisabled(true);
      } else {
        setRecognizedTexts([]);
        setCropImages([]);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Upload failed.");
    } finally {
      setLoading(false);
      setUploadEnabled(true);
    }
  };

  // ✅ Voice state behavior (same as reference)
  useEffect(() => {
    if (voiceEnabled && recognizedTexts.length > 0) {
      speakTexts(recognizedTexts, {
        language: undefined,
        rate: 0.95,
        pitch: 1.0,
      }).catch(() => {});
    } else {
      stopSpeaking();
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
        score: matchingWords.length / Math.max(commandWords.length, textWords.length),
      };
    });

    // Find best matching text with at least 50% word match
    const bestMatch = matches.reduce(
      (best, current) => (current.score > best.score ? current : best),
      { text: null, score: 0 }
    );

    return bestMatch.score >= 0.5 ? bestMatch.text : null;
  };

  const handleVoiceCommand = (command) => {
    if (!command) return;
    const normalizedCommand = command.toLowerCase().trim();

    // Extract the search term based on command type
    let searchTerm = "";
    let actionType = "";

    if (
      normalizedCommand.includes("information about") ||
      normalizedCommand.includes("tell me about") ||
      normalizedCommand.includes("show info")
    ) {
      searchTerm = normalizedCommand
        .replace("information about", "")
        .replace("tell me about", "")
        .replace("show info", "")
        .trim();
      actionType = "info";
    } else if (
      normalizedCommand.includes("navigate to") ||
      normalizedCommand.includes("take me to")
    ) {
      searchTerm = normalizedCommand
        .replace("navigate to", "")
        .replace("take me to", "")
        .trim();
      actionType = "navigate";
    }

    if (searchTerm && actionType) {
      // Find best matching text
      const matchedText = findBestMatch(searchTerm, recognizedTexts);

      if (matchedText) {
        const index = recognizedTexts.indexOf(matchedText);
        if (actionType === "info") {
          handleInfoClick(index, matchedText);
        } else if (actionType === "navigate") {
          handleNavigateClick(matchedText);
        }
      }
    }
  };

  const handleInfoClick = async (index, text) => {
    try {
      setButtonLoading((prev) => ({
        ...prev,
        [`info-${index}`]: true,
      }));
      const response = await fetch(`${SERVER_URL}/get_info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: text }),
      });
      const data = await response.json();
      Alert.alert(text, data.info || "No information available.");
    } catch (err) {
      Alert.alert("Error", "Failed to fetch information.");
    } finally {
      setButtonLoading((prev) => ({
        ...prev,
        [`info-${index}`]: false,
      }));
    }
  };

  const handleNavigateClick = async (text) => {
    try {
      const destination = encodeURIComponent(`${text} `);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      await Linking.openURL(url);
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

          <Text style={styles.tipText}>Tip: Choose Camera or Gallery to start.</Text>

          {/* ✅ Fixed Voice Button */}
          <View
            style={{
              alignSelf: "center",
              width: "90%",
              marginBottom: 20,
              marginTop: -10,
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
                borderColor: "#a855f7",
                backgroundColor: voiceEnabled ? "#a855f7" : "#000",
                shadowColor: "#a855f7",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.6,
                shadowRadius: 10,
                elevation: 8,
                alignSelf: "center",
                marginVertical: 12,
              }}
            >
              <Text
                style={{
                  color: voiceEnabled ? "#fff" : "#a855f7",
                  fontWeight: "700",
                  fontSize: 16,
                  letterSpacing: 0.8,
                }}
              >
                {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Voice Command Button */}
          <View style={styles.voiceCommandContainer}>
            <TouchableOpacity
              style={[
                styles.voiceCommandButton,
                { backgroundColor: isListening ? "#ef4444" : "#6366f1" },
              ]}
              onPress={() => {
                if (isListening) {
                  speechRef.current?.stopListening();
                } else {
                  speechRef.current?.startListening();
                }
                setIsListening(!isListening);
              }}
            >
              <Text style={styles.voiceCommandText}>
                {isListening ? "🎤 Listening..." : "🎤 Voice Command"}
              </Text>
            </TouchableOpacity>
          </View>

          <SpeechRecognitionComponent
            ref={speechRef}
            onResult={handleVoiceCommand}
            onEnd={() => setIsListening(false)}
          />

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
                          const response = await fetch(`${SERVER_URL}/get_info`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ item_name: text }),
                          });
                          const data = await response.json();
                          Alert.alert(text, data.info || "No information available.");
                        } catch (err) {
                          Alert.alert("Error", "Failed to fetch information.");
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
                          const destination = encodeURIComponent(`${text} `);
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
                          await Linking.openURL(url);
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
                  {showCrops ? "Hide Cropped Images ▲" : "View Cropped Images ▼"}
                </Text>
              </TouchableOpacity>

              {showCrops && (
                <View style={styles.croppedDropdown}>
                  <Text style={styles.croppedDropdownTitle}>Cropped Images</Text>
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
            <Image source={{ uri: selectedCrop }} style={styles.fullscreenImage} />
            <Pressable style={styles.closeButton} onPress={() => setSelectedCrop(null)}>
              <Text style={styles.closeText}>✖</Text>
            </Pressable>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

// Add these styles to your existing styles object
const voiceCommandStyles = {
  voiceCommandContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingVertical: 10,
  },
  voiceCommandButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  voiceCommandText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
};