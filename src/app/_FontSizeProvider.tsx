"use client";

import { createContext, useContext, useState } from "react";
import {
  FONT_SIZE_ATTR,
  parseFontSize,
  writeFontSize,
  type FontSize,
} from "@/lib/preferences";

type FontSizeCtx = {
  size: FontSize;
  setSize: (s: FontSize) => void;
};

const Ctx = createContext<FontSizeCtx | null>(null);

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  // Seed from DOM on client (PreferencesScript has already run in <head>).
  // On SSR, document is undefined; fall back to "base" — consumers that render
  // only on the client will re-resolve after mount.
  const [size, setSizeState] = useState<FontSize>(() => {
    if (typeof document === "undefined") return "base";
    return parseFontSize(document.documentElement.getAttribute(FONT_SIZE_ATTR));
  });

  const setSize = (s: FontSize) => {
    setSizeState(s);
    writeFontSize(window.localStorage, document, s);
  };

  return <Ctx.Provider value={{ size, setSize }}>{children}</Ctx.Provider>;
}

export function useFontSize(): FontSizeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFontSize must be used within FontSizeProvider");
  return ctx;
}
