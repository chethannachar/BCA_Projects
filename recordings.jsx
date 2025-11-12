// speechRecognitionService.jsx
// WebView-based speech recognition for Expo Go.
// Exposes startListening() and stopListening() via ref, and sends final result via onResult callback.

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
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
  <head><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
  <body style="background:#000;color:#fff;">
    <script>
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      let recognition = null;
      let isListening = false;

      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onstart = () => {
          // onstart may fire after we already reported started; ensure flag
          isListening = true;
          try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'started' })); } catch (e) {}
        };

        recognition.onresult = (event) => {
          const last = event.results.length - 1;
          const command = event.results[last][0].transcript.trim();
          if (command) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'final', text: command }));
            } catch (e) {}
          }
        };

        recognition.onend = () => {
          // notify end
          try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' })); } catch (e) {}
          // Auto restart if should be listening
          if (isListening) {
            try {
              setTimeout(() => {
                if (isListening) recognition.start();
              }, 50);
            } catch (err) {}
          }
        };

        recognition.onerror = (event) => {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: (event && (event.error || event.message)) || 'unknown' }));
          } catch (e) {}
          // For no-speech try to restart gracefully
          if (event && event.error === 'no-speech') {
            if (isListening) {
              try {
                recognition.stop();
                setTimeout(() => {
                  if (isListening) recognition.start();
                }, 50);
              } catch (err) {}
            }
          }
        };
      }

      function startRecognition() {
        if (!recognition) {
          try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'SpeechRecognition-not-supported' })); } catch(e){}
          return;
        }

        // Request mic permission first (if available)
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            isListening = true;
            try { recognition.start(); } catch (e) {}
            try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'started' })); } catch(e){}
          }).catch((err) => {
            try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'mic-permission-denied: ' + (err && err.message) })); } catch(e){}
          });
        } else {
          // Fallback - try to start directly
          try {
            isListening = true;
            recognition.start();
            try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'started' })); } catch(e){}
          } catch (err) {
            try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: err.message || 'start-failed' })); } catch(e){}
          }
        }
      }

      function stopRecognition() {
        isListening = false;
        try { recognition && recognition.stop(); } catch (e) {}
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' })); } catch(e){}
      }

      function handleMessage(e) {
        const data = (e && (e.data || e.detail && e.detail.data)) || '';
        if (!data) return;
        if (!recognition && (data === 'START' || data === 'STOP')) {
          try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'SpeechRecognition-not-supported' })); } catch(e){}
          return;
        }
        if (data === 'START') {
          startRecognition();
        } else if (data === 'STOP') {
          stopRecognition();
        }
      }

      // Listen to both document and window message events to maximize compatibility
      document.addEventListener('message', handleMessage);
      window.addEventListener('message', handleMessage);
    </script>
  </body>
</html>
`;

const SpeechRecognitionComponent = forwardRef(({ onResult, onStart, onEnd, onError, autoStart }, ref) => {
  const webRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useImperativeHandle(ref, () => ({
    startListening: () => {
      if (webRef.current && !isActive) {
        setIsActive(true);
        try { webRef.current.postMessage("START"); } catch (e) { console.warn('postMessage START failed', e); }
      }
    },
    stopListening: () => {
      if (webRef.current && isActive) {
        setIsActive(false);
        try { webRef.current.postMessage("STOP"); } catch (e) { console.warn('postMessage STOP failed', e); }
      }
    }
  }));

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'started':
          onStart?.();
          break;
        case 'final':
          if (data.text?.trim()) {
            onResult?.(data.text.trim());
          }
          break;
        case 'ended':
          onEnd?.();
          // Auto-restart listening
          if (isActive) {
            setTimeout(() => {
              if (webRef.current && isActive) {
                try { webRef.current.postMessage("START"); } catch (e) {}
              }
            }, 50);
          }
          break;
        case 'error':
          onError?.(data.error);
          break;
      }
    } catch (e) {
      console.warn('Speech recognition error:', e);
    }
  };

  return (
    <View style={{ width: 0, height: 0 }}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        onLoadEnd={() => {
          // Start automatically if requested once the WebView is loaded
          if (autoStart && webRef.current) {
            setIsActive(true);
            try { webRef.current.postMessage("START"); } catch (e) { console.warn('autoStart postMessage failed', e); }
          }
        }}
        javaScriptEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        style={{ width: 0, height: 0 }}
      />
    </View>
  );
});

export default SpeechRecognitionComponent;
