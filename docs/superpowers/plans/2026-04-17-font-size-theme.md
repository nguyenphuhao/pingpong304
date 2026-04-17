# Font Size & Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th ⚙️ tab to `BottomNav` that opens a Sheet with Light/Dark theme toggle and 4-level font size picker; show a first-visit onboarding Dialog; persist choices to `localStorage` with no flash on reload.

**Architecture:** Use `next-themes` (already installed, already consumed by sonner) for theme state and its built-in inline script for flash prevention. Add a custom `FontSizeProvider` that writes `data-font-size` attribute on `<html>`; prevent font-size flash with a tiny inline `<script>` in `<head>`. Pure read/write/validate logic lives in `src/lib/preferences.ts` (unit-tested). React providers are thin wire-ups over those helpers.

**Tech Stack:** Next.js 16 App Router, React 19, `next-themes`, Tailwind CSS v4, shadcn (base-ui) `Sheet` + `Dialog` (already installed), `lucide-react` icons, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-04-17-font-size-theme-design.md`

**Worktree:** `.worktrees/font-size-theme` on branch `feature/font-size-theme`.

---

## Pre-flight checks (already verified by plan author)

- `next-themes` is in `package.json` dependencies.
- `src/components/ui/sheet.tsx` and `src/components/ui/dialog.tsx` already exist (base-ui shadcn variants).
- `Vitest` uses `environment: "node"` with `include: ["src/**/*.test.ts"]` — no jsdom, no `@testing-library/react`. **All tests in this plan are pure-logic `.test.ts`** that mock `localStorage` / `document` via plain objects. Do not add RTL / jsdom.
- Existing baseline: 350 tests pass.

---

## Task 1: Pure preferences helpers + tests

**Files:**
- Create: `src/lib/preferences.ts`
- Test: `src/lib/preferences.test.ts`

Extract all read/write/validate logic for font-size and onboarding flag into pure functions that accept `Storage` and `Document` (or compatible stubs) as arguments. This keeps them testable in node env without a DOM.

- [ ] **Step 1: Write failing tests**

Create `src/lib/preferences.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  FONT_SIZE_LEVELS,
  FONT_SIZE_STORAGE_KEY,
  ONBOARDED_STORAGE_KEY,
  isOnboarded,
  markOnboarded,
  parseFontSize,
  readFontSize,
  writeFontSize,
} from "./preferences";

function makeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    _store: store,
  };
}

function makeDoc() {
  const attrs: Record<string, string> = {};
  return {
    documentElement: {
      getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
    },
    _attrs: attrs,
  };
}

describe("parseFontSize", () => {
  test("accepts all 4 valid levels", () => {
    for (const level of FONT_SIZE_LEVELS) {
      expect(parseFontSize(level)).toBe(level);
    }
  });

  test("returns 'base' for invalid input", () => {
    expect(parseFontSize("huge")).toBe("base");
    expect(parseFontSize(null)).toBe("base");
    expect(parseFontSize(undefined)).toBe("base");
    expect(parseFontSize(17)).toBe("base");
    expect(parseFontSize("")).toBe("base");
  });
});

describe("readFontSize", () => {
  test("reads stored value and parses it", () => {
    const storage = makeStorage({ [FONT_SIZE_STORAGE_KEY]: "lg" });
    expect(readFontSize(storage)).toBe("lg");
  });

  test("returns 'base' when key missing", () => {
    expect(readFontSize(makeStorage())).toBe("base");
  });

  test("returns 'base' when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(readFontSize(storage)).toBe("base");
  });
});

describe("writeFontSize", () => {
  test("sets DOM attribute and storage key", () => {
    const storage = makeStorage();
    const doc = makeDoc();
    writeFontSize(storage, doc, "xl");
    expect(doc._attrs["data-font-size"]).toBe("xl");
    expect(storage._store[FONT_SIZE_STORAGE_KEY]).toBe("xl");
  });

  test("still sets DOM attribute if storage throws", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    const doc = makeDoc();
    writeFontSize(storage, doc, "sm");
    expect(doc._attrs["data-font-size"]).toBe("sm");
  });
});

describe("onboarded flag", () => {
  test("isOnboarded returns false when flag missing", () => {
    expect(isOnboarded(makeStorage())).toBe(false);
  });

  test("isOnboarded returns true when flag is '1'", () => {
    const storage = makeStorage({ [ONBOARDED_STORAGE_KEY]: "1" });
    expect(isOnboarded(storage)).toBe(true);
  });

  test("isOnboarded returns false when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(isOnboarded(storage)).toBe(false);
  });

  test("markOnboarded writes '1' to storage", () => {
    const storage = makeStorage();
    markOnboarded(storage);
    expect(storage._store[ONBOARDED_STORAGE_KEY]).toBe("1");
  });

  test("markOnboarded does not throw when storage throws", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    expect(() => markOnboarded(storage)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/preferences.test.ts`
Expected: FAIL — `Cannot find module './preferences'`.

- [ ] **Step 3: Implement `src/lib/preferences.ts`**

```ts
export const FONT_SIZE_LEVELS = ["sm", "base", "lg", "xl"] as const;
export type FontSize = (typeof FONT_SIZE_LEVELS)[number];

export const FONT_SIZE_STORAGE_KEY = "pingpong:font-size";
export const ONBOARDED_STORAGE_KEY = "pingpong:onboarded";
export const FONT_SIZE_ATTR = "data-font-size";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type DocLike = {
  documentElement: {
    getAttribute: (k: string) => string | null;
    setAttribute: (k: string, v: string) => void;
  };
};

export function parseFontSize(value: unknown): FontSize {
  if (typeof value !== "string") return "base";
  return (FONT_SIZE_LEVELS as readonly string[]).includes(value)
    ? (value as FontSize)
    : "base";
}

export function readFontSize(storage: StorageLike): FontSize {
  try {
    return parseFontSize(storage.getItem(FONT_SIZE_STORAGE_KEY));
  } catch {
    return "base";
  }
}

export function writeFontSize(
  storage: StorageLike,
  doc: DocLike,
  size: FontSize,
): void {
  doc.documentElement.setAttribute(FONT_SIZE_ATTR, size);
  try {
    storage.setItem(FONT_SIZE_STORAGE_KEY, size);
  } catch {
    // Safari Private Mode / quota — DOM attribute still applied.
  }
}

export function isOnboarded(storage: StorageLike): boolean {
  try {
    return storage.getItem(ONBOARDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded(storage: StorageLike): void {
  try {
    storage.setItem(ONBOARDED_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/preferences.test.ts`
Expected: PASS — all tests green.

Also run full suite to confirm no regressions: `npm test`
Expected: 350 + new tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/preferences.ts src/lib/preferences.test.ts
git commit -m "feat(prefs): add pure helpers for font-size + onboarded flag"
```

---

## Task 2: Update `globals.css`

**Files:**
- Modify: `src/app/globals.css` (line 61-63 area, where `html { font-size: 17px }` lives)

Replace the single fixed font-size rule with a `data-font-size` attribute selector set. Keep a fallback rule for when JavaScript is disabled.

- [ ] **Step 1: Replace the `html { font-size: 17px }` block**

Find in `src/app/globals.css`:

```css
html {
  font-size: 17px;
}
```

Replace with:

```css
html[data-font-size="sm"] {
  font-size: 15px;
}
html[data-font-size="base"] {
  font-size: 17px;
}
html[data-font-size="lg"] {
  font-size: 19px;
}
html[data-font-size="xl"] {
  font-size: 21px;
}
html:not([data-font-size]) {
  font-size: 17px;
}
```

- [ ] **Step 2: Verify build + tests still pass**

Run: `npm test`
Expected: all tests still pass.

Run: `npm run build`
Expected: builds successfully.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(css): font-size driven by html[data-font-size] attribute"
```

---

## Task 3: Inline `<script>` for font-size flash prevention

**Files:**
- Create: `src/app/_preferences-script.tsx`

A tiny IIFE runs synchronously in `<head>` before React hydrates, reading `localStorage` and setting the `data-font-size` attribute on `<html>`. This means the CSS rule applies before any content paints, so there's no visual flash between initial render and the user's saved preference.

- [ ] **Step 1: Create the component**

```tsx
import { FONT_SIZE_ATTR, FONT_SIZE_STORAGE_KEY } from "@/lib/preferences";

export function PreferencesScript() {
  // Keep this inline IIFE tiny. It runs before hydration; any error is swallowed.
  // Duplicates the validation from parseFontSize() on purpose — cannot import
  // helpers here because this code is serialized as a raw string.
  const code = `(function(){try{var s=localStorage.getItem("${FONT_SIZE_STORAGE_KEY}");if(s==="sm"||s==="base"||s==="lg"||s==="xl"){document.documentElement.setAttribute("${FONT_SIZE_ATTR}",s);}else{document.documentElement.setAttribute("${FONT_SIZE_ATTR}","base");}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
```

No separate test: it's a string template; correctness verified via manual QA (Task 11).

- [ ] **Step 2: Verify tests still pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/_preferences-script.tsx
git commit -m "feat(prefs): add inline script to set data-font-size pre-hydration"
```

---

## Task 4: `FontSizeProvider` context + hook

**Files:**
- Create: `src/app/_FontSizeProvider.tsx`

Thin wrapper over the pure helpers from Task 1. State is seeded from the DOM attribute the inline script set, so there's no hydration mismatch between initial render and user storage.

- [ ] **Step 1: Create the provider**

```tsx
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
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `npm test`
Expected: all tests pass.

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_FontSizeProvider.tsx
git commit -m "feat(prefs): add FontSizeProvider context + useFontSize hook"
```

---

## Task 5: `Providers` wrapper

**Files:**
- Create: `src/app/_Providers.tsx`

Combines `next-themes` `ThemeProvider` and the new `FontSizeProvider` in a single client component so `layout.tsx` (a server component) can wrap its tree cleanly.

- [ ] **Step 1: Create the wrapper**

```tsx
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
```

- [ ] **Step 2: Verify tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/_Providers.tsx
git commit -m "feat(prefs): add Providers wrapper (next-themes + font-size)"
```

---

## Task 6: Update `layout.tsx`

**Files:**
- Modify: `src/app/layout.tsx`

Wrap the tree in `<Providers>`, render `<PreferencesScript />` inside a `<head>` tag, add `suppressHydrationWarning` on `<html>`, move `Toaster` inside `<Providers>` so it shares theme context, and render `<OnboardingDialog />` (created next task) alongside other layout children.

> Note: `OnboardingDialog` is created in Task 9. Until then, import+usage added here would break the build. To keep each task committable on its own, Task 6 does **not** add `OnboardingDialog` yet; Task 9 re-edits this file to add it.

- [ ] **Step 1: Replace current `RootLayout`**

Current (src/app/layout.tsx):

```tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${fontSans.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <BottomNav />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
```

Replace with:

```tsx
import { Providers } from "./_Providers";
import { PreferencesScript } from "./_preferences-script";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${fontSans.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <PreferencesScript />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          {children}
          <BottomNav />
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
```

Keep all existing imports (`Metadata`, `Viewport`, `Be_Vietnam_Pro`, `Toaster`, `BottomNav`, `globals.css`, `metadata`, `viewport`). Just add the two new imports (`Providers`, `PreferencesScript`) at the top with the others.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: builds successfully.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev` in another terminal, open `http://localhost:3000/`, confirm page renders without errors. In DevTools:

1. `document.documentElement.getAttribute("data-font-size")` → should return `"base"`.
2. `localStorage.setItem("pingpong:font-size","lg"); location.reload();` → after reload, attribute should be `"lg"`.
3. Set theme via next-themes default — page should render in light mode.

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): wire Providers + PreferencesScript into root layout"
```

---

## Task 7: Extend `NavTab` + add 4th "Cài đặt" tab

**Files:**
- Modify: `src/app/_BottomNav.tsx`

Three changes: (1) let `NavTab` accept an optional `onClick` and render `<button>` instead of `<Link>` when present, (2) change `grid-cols-3` to `grid-cols-4`, (3) add a 4th tab with a `Settings` icon that opens a local sheet-open state. The `<SettingsSheet>` is rendered in the same component so state is co-located.

> Note: `SettingsSheet` is created in Task 8. To keep this task committable on its own, Task 7 only adds the *state* (`settingsOpen`) and the tab button; the `<SettingsSheet>` JSX is added in Task 8 when the component exists. Without the sheet, clicking the tab does nothing observable — that's intentional until Task 8.

- [ ] **Step 1: Replace `_BottomNav.tsx` contents**

Replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, Settings, Shield, Users } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (pathname.startsWith("/admin")) return null;

  const onHome = pathname === "/";
  const onDoubles = pathname === "/d" || pathname.startsWith("/d/");
  const onTeams = pathname === "/t" || pathname.startsWith("/t/");

  return (
    <>
      {/* Spacer so content isn't covered by the fixed nav */}
      <div aria-hidden className="h-20" />
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="mx-auto grid max-w-md grid-cols-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <NavTab
            href="/"
            label="Trang chủ"
            active={onHome}
            icon={<Home className="size-5" />}
            activeClass="text-foreground"
            indicatorClass="bg-foreground"
          />
          <NavTab
            href="/t"
            label="Đồng đội"
            active={onTeams}
            icon={<Shield className="size-5" />}
            activeClass="text-violet-600 dark:text-violet-400"
            indicatorClass="bg-violet-500"
          />
          <NavTab
            href="/d"
            label="Đôi"
            active={onDoubles}
            icon={<Users className="size-5" />}
            activeClass="text-blue-600 dark:text-blue-400"
            indicatorClass="bg-blue-500"
          />
          <NavTab
            label="Cài đặt"
            active={settingsOpen}
            icon={<Settings className="size-5" />}
            activeClass="text-foreground"
            indicatorClass="bg-foreground"
            onClick={() => setSettingsOpen(true)}
          />
        </div>
      </nav>
      {/* SettingsSheet is rendered here in Task 8. */}
    </>
  );
}

type NavTabProps = {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  activeClass: string;
  indicatorClass: string;
} & ({ href: string; onClick?: undefined } | { href?: undefined; onClick: () => void });

function NavTab({
  href,
  label,
  active,
  icon,
  activeClass,
  indicatorClass,
  onClick,
}: NavTabProps) {
  const className = `relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
    active ? activeClass : "text-muted-foreground active:text-foreground"
  }`;

  const inner = (
    <>
      {active && (
        <span
          aria-hidden
          className={`absolute top-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full ${indicatorClass}`}
        />
      )}
      {icon}
      <span>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href!} className={className}>
      {inner}
    </Link>
  );
}
```

Key points:
- `NavTabProps` is a discriminated union so TS enforces exactly one of `href | onClick`.
- Existing 3 tabs keep their `Link` behaviour; the new 4th tab uses `onClick`.
- `grid-cols-3` → `grid-cols-4` on the nav grid.

- [ ] **Step 2: Verify build + tests**

Run: `npm run build && npm test`
Expected: pass.

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Smoke check**

Run dev server, confirm 4 tabs render, confirm bottom nav still hidden on `/admin`. Tapping ⚙️ does nothing yet (expected — sheet comes in Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/app/_BottomNav.tsx
git commit -m "feat(nav): add 4th Settings tab to BottomNav with button support"
```

---

## Task 8: `SettingsSheet` component + wire into `BottomNav`

**Files:**
- Create: `src/app/_SettingsSheet.tsx`
- Modify: `src/app/_BottomNav.tsx` (add `<SettingsSheet />` render)

Build a bottom-anchored Sheet with two sections: theme pills (Sun/Moon) and font-size pills (four "A" buttons of increasing size) plus a preview paragraph below that scales live.

- [ ] **Step 1: Create `src/app/_SettingsSheet.tsx`**

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FONT_SIZE_LEVELS, type FontSize } from "@/lib/preferences";
import { useFontSize } from "./_FontSizeProvider";

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();
  const { size, setSize } = useFontSize();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-6">
        <SheetHeader className="text-left">
          <SheetTitle>Cài đặt hiển thị</SheetTitle>
          <SheetDescription>
            Chọn giao diện và cỡ chữ phù hợp với bạn.
          </SheetDescription>
        </SheetHeader>

        <section className="mt-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Giao diện
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ThemePill
              active={theme !== "dark"}
              onClick={() => setTheme("light")}
              icon={<Sun className="size-4" />}
              label="Sáng"
            />
            <ThemePill
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
              icon={<Moon className="size-4" />}
              label="Tối"
            />
          </div>
        </section>

        <section className="mt-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Cỡ chữ
          </div>
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZE_LEVELS.map((lvl, idx) => (
              <FontSizePill
                key={lvl}
                level={lvl}
                index={idx}
                active={size === lvl}
                onClick={() => setSize(lvl)}
              />
            ))}
          </div>
          <p className="pt-3 text-base text-foreground">
            Đây là ví dụ cỡ chữ hiện tại.
          </p>
        </section>
      </SheetContent>
    </Sheet>
  );
}

function ThemePill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const A_CLASSES = ["text-xs", "text-base", "text-xl", "text-2xl"] as const;

function FontSizePill({
  level,
  index,
  active,
  onClick,
}: {
  level: FontSize;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Cỡ chữ ${level}`}
      className={`flex h-12 items-center justify-center rounded-lg border font-semibold transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground"
      } ${A_CLASSES[index]}`}
    >
      A
    </button>
  );
}
```

- [ ] **Step 2: Render `<SettingsSheet>` in `BottomNav`**

In `src/app/_BottomNav.tsx`, add the import at the top:

```tsx
import { SettingsSheet } from "./_SettingsSheet";
```

Replace the comment line `{/* SettingsSheet is rendered here in Task 8. */}` with:

```tsx
<SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
```

- [ ] **Step 3: Verify build + tests**

Run: `npm run build && npm test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 4: Smoke check**

Run dev server, tap ⚙️ → sheet slides up. Toggle Sáng/Tối → page theme flips. Tap each "A" pill → preview paragraph and overall page text resize. Close sheet via outside tap / ESC.

- [ ] **Step 5: Commit**

```bash
git add src/app/_SettingsSheet.tsx src/app/_BottomNav.tsx
git commit -m "feat(settings): add SettingsSheet with theme + font-size controls"
```

---

## Task 9: `OnboardingDialog` + wire into layout

**Files:**
- Create: `src/app/_OnboardingDialog.tsx`
- Modify: `src/app/layout.tsx` (add `<OnboardingDialog />`)

Shows a one-time first-visit Dialog. Reads `localStorage["pingpong:onboarded"]` on mount; if absent, opens the dialog. Dismissing (Xong / Bỏ qua / outside tap / ESC) sets the flag and closes. Does not open on `/admin` paths. User can still revisit preferences later via the ⚙️ tab.

- [ ] **Step 1: Create `src/app/_OnboardingDialog.tsx`**

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FONT_SIZE_LEVELS,
  isOnboarded,
  markOnboarded,
  type FontSize,
} from "@/lib/preferences";
import { useFontSize } from "./_FontSizeProvider";

export function OnboardingDialog() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { size, setSize } = useFontSize();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    if (!isOnboarded(window.localStorage)) setOpen(true);
  }, [pathname]);

  const finish = () => {
    markOnboarded(window.localStorage);
    setOpen(false);
  };

  // Never mount on /admin — keeps admin workflow uninterrupted.
  if (pathname.startsWith("/admin")) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) finish();
        else setOpen(true);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle>Chào mừng!</DialogTitle>
          <DialogDescription>
            Chọn giao diện và cỡ chữ phù hợp. Có thể đổi lại ở tab Cài đặt bất
            kỳ lúc nào.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-3">
          <p className="text-base">Lịch thi đấu · BXH · Kết quả</p>
        </div>

        <section className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Giao diện
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Pill
              active={theme !== "dark"}
              onClick={() => setTheme("light")}
              icon={<Sun className="size-4" />}
              label="Sáng"
            />
            <Pill
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
              icon={<Moon className="size-4" />}
              label="Tối"
            />
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Cỡ chữ
          </div>
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZE_LEVELS.map((lvl, idx) => (
              <APill
                key={lvl}
                level={lvl}
                index={idx}
                active={size === lvl}
                onClick={() => setSize(lvl)}
              />
            ))}
          </div>
        </section>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-muted-foreground"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={finish}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Xong
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Pill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const A_CLASSES = ["text-xs", "text-base", "text-xl", "text-2xl"] as const;

function APill({
  level,
  index,
  active,
  onClick,
}: {
  level: FontSize;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Cỡ chữ ${level}`}
      className={`flex h-12 items-center justify-center rounded-lg border font-semibold transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground"
      } ${A_CLASSES[index]}`}
    >
      A
    </button>
  );
}
```

- [ ] **Step 2: Add `<OnboardingDialog />` in `src/app/layout.tsx`**

Add import near the other layout imports:

```tsx
import { OnboardingDialog } from "./_OnboardingDialog";
```

Inside `<Providers>`, after `<Toaster ... />`, add:

```tsx
<OnboardingDialog />
```

Final JSX inside `<Providers>`:

```tsx
<Providers>
  {children}
  <BottomNav />
  <Toaster position="top-center" richColors />
  <OnboardingDialog />
</Providers>
```

- [ ] **Step 3: Verify build + tests + typecheck**

Run: `npm run build && npm test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 4: Smoke check**

Open `http://localhost:3000/` in a fresh browser session (or with `localStorage.clear()` first). The dialog should appear. Dismiss it. Reload — dialog should NOT reappear.

Navigate to `/admin` — dialog should not appear, `BottomNav` (including ⚙️) should be hidden.

- [ ] **Step 5: Commit**

```bash
git add src/app/_OnboardingDialog.tsx src/app/layout.tsx
git commit -m "feat(onboarding): first-visit dialog for theme + font-size"
```

---

## Task 10: Audit hardcoded sizes

**Files:**
- Possibly: small edits across `src/app/**` if any hardcoded `text-[Npx]` blocks important text from scaling.

Font-size scaling works for anything using rem/em (Tailwind `text-xs`..`text-2xl`). Pixel-valued arbitrary classes (`text-[12px]`) bypass the scale. Identify them and decide case-by-case: convert to rem if it's primary content; leave as-is if it's a decorative or tight UI chrome that shouldn't scale.

- [ ] **Step 1: Grep for pixel-valued text classes**

Run:

```bash
grep -rn 'text-\[.*px\]' src/app src/components 2>/dev/null
```

- [ ] **Step 2: Decide per hit**

For each match:
- **Primary content (body text, labels the user reads)** → change `text-[14px]` to `text-sm`, `text-[12px]` to `text-xs`, etc. (Tailwind's rem scale).
- **UI chrome (tiny indicator, badge number, icon-adjacent micro-label)** → leave as-is if scaling would break layout.

Record your decisions briefly in the commit message.

- [ ] **Step 3: Grep for explicit CSS font-size**

Run:

```bash
grep -rn 'font-size:' src 2>/dev/null
```

Expected: only the rules in `globals.css` you added. Flag any others.

- [ ] **Step 4: Verify tests + build**

Run: `npm test && npm run build`
Expected: pass.

- [ ] **Step 5: Commit (only if edits were made)**

```bash
git add -p  # review changes
git commit -m "refactor(ui): convert primary text from px to rem for font-size scaling"
```

If no edits were needed, skip the commit and note in the PR description that the audit was clean.

---

## Task 11: Manual QA exit criteria

**Not a code task.** Run through this checklist before opening a PR. Fix any failures before shipping.

- [ ] Fresh `localStorage.clear()`; visit `/` → onboarding dialog appears.
- [ ] Dismiss dialog via **Xong** → flag set; reload `/` → dialog does NOT reappear.
- [ ] `localStorage.clear()` again; dismiss via **Bỏ qua** → same flag behavior.
- [ ] `localStorage.clear()` again; dismiss via **outside tap / ESC** → same flag behavior.
- [ ] Open ⚙️ sheet; toggle **Sáng ↔ Tối** → page updates instantly; reload → persists; no white flash on dark mode reload (DevTools Network → Slow 3G to make any flash visible).
- [ ] Open ⚙️ sheet; tap each of **A / A / A / A** → text resizes across the whole page (not just preview); reload → persists; no flash.
- [ ] Navigate to `/admin` (requires admin cookie) → BottomNav hidden, no onboarding dialog, but theme + font-size from public site still applied.
- [ ] `localStorage.clear()`; visit `/admin` first → no dialog; then visit `/` → dialog appears. (Proves admin is excluded but public is not.)
- [ ] Safari Private Mode: page loads, dialog appears each session (acceptable), no JS errors in console.
- [ ] JS disabled: font stays at 17px, theme stays light, BottomNav does not render (uses client hooks) — acceptable degraded state.

---

## Finish-up

Once Task 11 is green, follow `superpowers:finishing-a-development-branch` to decide on merge/PR. Baseline reminder: this worktree started from `main` at commit `9140894` (spec commit); the feature branch is `feature/font-size-theme`.

---

## Self-review notes (completed by plan author)

**Spec coverage check** — every requirement maps to a task:
- Theme toggle (Light/Dark, default Light) → Task 5 (`ThemeProvider` config) + Task 8 (pills).
- Font-size 4 levels → Task 1 (helpers) + Task 2 (CSS) + Task 8 (pills).
- Flash prevention → Task 3 (inline script) + Task 5 (`disableTransitionOnChange`).
- localStorage persistence → Task 1 (helpers) + Task 4 (provider wire-up) + Task 9 (onboarded flag).
- ⚙️ tab on BottomNav → Task 7 (tab) + Task 8 (sheet).
- First-visit dialog → Task 9.
- Admin exclusion of dialog (but global theme/font inherited) → Task 9.
- Hardcoded-size audit → Task 10.
- Manual QA → Task 11.

**Placeholder scan**: no TBD / TODO / "add appropriate X". All code blocks are complete and runnable.

**Type / name consistency**:
- `FontSize = "sm" | "base" | "lg" | "xl"` defined in Task 1, imported everywhere.
- `FONT_SIZE_STORAGE_KEY` / `ONBOARDED_STORAGE_KEY` / `FONT_SIZE_ATTR` constants defined in Task 1, referenced in Tasks 3, 4, 9.
- `FONT_SIZE_LEVELS` used in Tasks 1, 8, 9 — iteration order matches `A_CLASSES` by index.
- Provider exports: `FontSizeProvider` (Task 4), `useFontSize` (Task 4), `Providers` (Task 5) — imports in later tasks match these names.
- Theme `storageKey="pingpong:theme"` used in Task 5 only (next-themes handles it internally) — no cross-task reference, cannot drift.
