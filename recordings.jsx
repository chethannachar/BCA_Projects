// speechRecognitionService.jsx
// WebView-based speech recognition for Expo Go.
// Exposes startListening() and stopListening() via ref, and sends final result via onResult callback.

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View, Platform } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Usage:
 *   const ref = useRef();
 *   <SpeechRecognitionComponent ref={ref} onResult={(text)=>...} />
 *   ref.current.startListening();
 *   ref.current.stopListening();
 */

const html = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  </head>
  <body style="background:#000;color:#fff;">
    <script>
      // Use browser SpeechRecognition (webkit for Chrome)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      let recognition = null;
      let finalTranscript = "";
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'started' }));
        };

        recognition.onresult = function(event) {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              finalTranscript += res[0].transcript;
            } else {
              interim += res[0].transcript;
            }
          }
          // send interim so UI can show it if needed
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'interim', interim: interim, final: finalTranscript }));
        };

        recognition.onerror = function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: e.error }));
        };

        recognition.onend = function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended', final: finalTranscript }));
          // reset for next time
          finalTranscript = "";
        };
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'SpeechRecognition not supported' }));
      }

      // receive commands from React Native
      window.document.addEventListener('message', function(e) {
        const msg = e.data;
        if (!recognition) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'No recognition available' }));
          return;
        }
        if (msg === 'START') {
          finalTranscript = "";
          try { recognition.start(); } catch (err) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'error', error: String(err) })); }
        } else if (msg === 'STOP') {
          try { recognition.stop(); } catch (err) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'error', error: String(err) })); }
        }
      });

      // iOS WKWebView uses window.webkit.messageHandlers; make both
      window.addEventListener("message", function(e) {
        const msg = e.data;
        if (!recognition) return;
        if (msg === 'START') {
          finalTranscript = "";
          try { recognition.start(); } catch (err) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'error', error: String(err) })); }
        } else if (msg === 'STOP') {
          try { recognition.stop(); } catch (err) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'error', error: String(err) })); }
        }
      });
    </script>
    <!-- minimal visible content -->
    <div style="color:#fff">Listening window</div>
  </body>
</html>
`;

const SpeechRecognitionComponent = forwardRef(({ onResult, onStart, onEnd, onError }, ref) => {
  const webRef = useRef(null);
  const [ready, setReady] = useState(true);

  useImperativeHandle(ref, () => ({
    startListening: () => {
      if (webRef.current) {
        try {
          webRef.current.postMessage("START");
        } catch (e) {
          console.warn("postMessage start error:", e);
        }
      }
    },
    stopListening: () => {
      if (webRef.current) {
        try {
          webRef.current.postMessage("STOP");
        } catch (e) {
          console.warn("postMessage stop error:", e);
        }
      }
    },
  }));

  const handleMessage = (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (!payload || !payload.type) return;
      if (payload.type === "started") {
        onStart && onStart();
      } else if (payload.type === "interim") {
        // interim results available; we don't expose them to App by default
        // but you could call a callback here to show live text
      } else if (payload.type === "ended") {
        onEnd && onEnd();
        const finalText = payload.final || "";
        if (finalText && finalText.trim()) {
          onResult && onResult(finalText.trim());
        } else {
          onResult && onResult("");
        }
      } else if (payload.type === "error") {
        onError && onError(payload.error);
      }
    } catch (e) {
      // ignore JSON parse errors
    }
  };

  return (
    <View style={{ width: 0, height: 0 }}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        injectedJavaScriptBeforeContentLoaded={''}
        // hide visually
        style={{ width: 0, height: 0 }}
      />
    </View>
  );
});

export default SpeechRecognitionComponent;
