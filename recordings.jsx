// speechRecognitionService.jsx
// WebView-based speech recognition for Expo Go.
// Exposes startListening() and stopListening() via ref, and sends final result via onResult callback.

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
          isListening = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'started' }));
        };

        recognition.onresult = (event) => {
          const last = event.results.length - 1;
          const command = event.results[last][0].transcript.trim();
          
          if (command) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'final', 
              text: command 
            }));
          }
        };

        recognition.onend = () => {
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
          if (event.error === 'no-speech') {
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

      // Handle messages from React Native
      window.document.addEventListener('message', function(e) {
        if (!recognition) return;
        
        if (e.data === 'START') {
          isListening = true;
          try { recognition.start(); } catch (err) {}
        } 
        else if (e.data === 'STOP') {
          isListening = false;
          try { recognition.stop(); } catch (err) {}
        }
      });
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
        webRef.current.postMessage("START");
      }
    },
    stopListening: () => {
      if (webRef.current && isActive) {
        setIsActive(false);
        webRef.current.postMessage("STOP");
      }
    }
  }));

  useEffect(() => {
    // Auto-start listening when component mounts
    if (autoStart && webRef.current) {
      setIsActive(true);
      webRef.current.postMessage("START");
    }
  }, [autoStart]);

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
                webRef.current.postMessage("START");
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
        javaScriptEnabled={true}
        style={{ width: 0, height: 0 }}
      />
    </View>
  );
});

export default SpeechRecognitionComponent;
