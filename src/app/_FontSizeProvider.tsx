"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  const [size, setSizeState] = useState<FontSize>("base");

  // After mount, sync state from DOM (the inline script set this before hydrate).
  useEffect(() => {
    const attr = document.documentElement.getAttribute(FONT_SIZE_ATTR);
    setSizeState(parseFontSize(attr));
  }, []);

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
