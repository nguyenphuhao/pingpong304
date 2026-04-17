"use client";

// Web Speech API types (not in all TS lib configs)
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition ??
    (window as unknown as Record<string, unknown>).SpeechRecognition ??
    null
  ) as (new () => SpeechRecognition) | null;
}

export function VoiceInputButton({
  onResult,
  onInterim,
  disabled,
}: {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognition() != null);
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      recogRef.current?.stop();
      return;
    }

    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "vi-VN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recogRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim && onInterim) onInterim(interim);
      if (final) onResult(final);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
    setListening(true);
  }, [listening, onResult, onInterim]);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
      className={listening ? "text-red-500 animate-pulse" : ""}
    >
      {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
    </Button>
  );
}
