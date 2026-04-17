"use client";

import { ThemeProvider } from "next-themes";
import { FontSizeProvider } from "./_FontSizeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="pingpong:theme"
      disableTransitionOnChange
    >
      <FontSizeProvider>{children}</FontSizeProvider>
    </ThemeProvider>
  );
}
