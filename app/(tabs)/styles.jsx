import { StyleSheet, Dimensions, Platform } from "react-native";

const windowDimensions = Dimensions.get("window");
const width = windowDimensions?.width ?? 0;
const height = windowDimensions?.height ?? 0;

export default StyleSheet.create({
  container: {
    flexGrow: 1,
    minHeight: height,
    backgroundColor: "#000000ff",
    paddingBottom: Platform.OS === "android" ? 40 : 40,

  },

  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },

  // 🏛️ Header Title
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginTop: 0,

    letterSpacing: 1.2,
    textShadowColor: "rgba(255,255,255,0.25)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
    paddingBottom:20
  },

  // 🖼️ Top Image Display
  topImageContainer: {
    width: width * 0.92,
    height: 340,
    borderRadius: 26,
    overflow: "hidden",
    alignSelf: "center",
    marginBottom: 25,
    backgroundColor: "rgba(255,255,255,0.08)",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },

  topImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  topPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  placeholderText: {
    color: "#cbd5e1",
    fontSize: 16,
    fontStyle: "italic",
  },

  // 🪄 Action Buttons (Pick & Upload)
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: width * 0.9,
    alignSelf: "center",
    marginBottom: 25,
  },

  pickButton: {
    flex: 1,
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    shadowColor: "#818cf8",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },

  uploadButton: {
    flex: 1,
    backgroundColor: "#f97316",
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },

  pickButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  uploadButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  tipText: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 10,
    fontStyle: "italic",
  },

  // 🧠 Recognized Text Section
  recognizedContainer: {
    width: "92%",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },

  recognizedRow: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },

  labelTextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  labelContainer: {
    backgroundColor: "rgba(147,51,234,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 50,
    marginRight: 8,
  },

  labelText: {
    color: "#d8b4fe",
    fontWeight: "600",
    fontSize: 12,
  },

  itemText: {
    fontSize: 17,
    color: "#f1f5f9",
    fontWeight: "600",
    flexShrink: 1,
  },

  // 🔘 Info & Navigate Buttons
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  infoButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 50,
    alignItems: "center",
    paddingVertical: 10,
  },

  navigateButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 50,
    alignItems: "center",
    paddingVertical: 10,
  },

  infoButtonText: {
    color: "#fff",
    fontWeight: "600",
  },

  navigateButtonText: {
    color: "#fff",
    fontWeight: "600",
  },

  // 🌿 Cropped Images Section
  uploadContainer: {
    width: "92%",
    alignSelf: "center",
    marginTop: 25,
    marginBottom: 20,
  },

  toggleButton: {
    backgroundColor: "#22d3ee",
    paddingVertical: 12,
    borderRadius: 40,
    alignItems: "center",
    shadowColor: "#22d3ee",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },

  toggleButtonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 15,
  },

  croppedDropdown: {
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 14,
  },

  croppedDropdownTitle: {
    textAlign: "center",
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 17,
    marginBottom: 10,
  },

  croppedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },

  cropBox: {
    width: (width - 72) / 2,
    height: 180,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },

  cropImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  noCropText: {
    textAlign: "center",
    color: "#9ca3af",
    fontStyle: "italic",
    marginTop: 20,
  },

  // 🌫 Fullscreen Modal for Crop Preview
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000000ff", // full opaque black for top coverage
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    paddingTop: 100,

  },

  fullscreenImage: {
    width: "94%",
    height: "100%",
    borderRadius: 18,
    resizeMode: "contain",
  },

  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 20,
    backgroundColor: "transparent",
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 1100,
  },

  closeText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },
});
