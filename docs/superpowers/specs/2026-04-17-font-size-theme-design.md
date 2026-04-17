# Font Size & Theme Toggle — Design Spec

**Date:** 2026-04-17
**Status:** Approved, ready for implementation plan

## Summary

Add two user preferences to the public site: **light/dark theme** and **4-level font size**. Both are controlled from a new ⚙️ tab on the `BottomNav`, persisted to `localStorage`, and surfaced to first-time visitors via an onboarding dialog.

## Goals

- Let users switch between Light and Dark themes (default: Light).
- Let users pick one of 4 font-size levels (15 / 17 / 19 / 21 px; default: 17 px).
- No visible flash on page load once the user has made a choice.
- First-time visitors see an onboarding dialog to set preferences upfront; returning visitors don't.
- Preferences apply to the whole site, including `/admin` (admin has no UI to change them — settings inherit from the public site).

## Non-Goals

- No "system" / "auto" theme mode (explicitly rejected in brainstorming).
- No per-page scoping of preferences.
- No cross-tab real-time sync for font size (next-themes handles theme sync; font-size sync is deferred unless it becomes a problem).
- No server-side persistence or account-level preferences.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Control location | 4th `BottomNav` tab (⚙️) opens a bottom-sheet | Discoverable, single place for all settings |
| Font-size levels | 4 levels: 15 / 17 / 19 / 21 px | Covers elderly users without breaking `max-w-md` layouts |
| Theme modes | 2: Light / Dark, default Light | Simpler; no "system" mode |
| Persistence | `localStorage` + inline `<script>` in `<head>` to set `data-font-size` before hydrate | `next-themes` already handles theme flash |
| Scope | Whole site, including `/admin` | No technical reason to split; admin has no tab ⚙️ so can't change it there, but settings still apply |
| First visit | Single-screen popup (not a wizard) with Skip link | Fast, non-blocking; flag `pingpong:onboarded=1` prevents re-showing |

## Architecture

### New files

```
src/app/
  _Providers.tsx              # wraps <ThemeProvider> + <FontSizeProvider>
  _FontSizeProvider.tsx       # context + useFontSize() hook
  _SettingsSheet.tsx          # Sheet content (theme + font-size controls)
  _OnboardingDialog.tsx       # first-visit popup
  _preferences-script.tsx     # inline <script> for font-size flash prevention
src/components/ui/
  sheet.tsx                   # shadcn Sheet (add via CLI if missing)
  dialog.tsx                  # shadcn Dialog (add via CLI if missing)
```

### Modified files

```
src/app/layout.tsx            # wrap with <Providers>, add <PreferencesScript /> in <head>, suppressHydrationWarning on <html>
src/app/_BottomNav.tsx        # add 4th tab "Cài đặt" (Settings), grid-cols-3 → grid-cols-4, NavTab supports onClick
src/app/globals.css           # remove html{font-size:17px}, add html[data-font-size="..."] rules
```

### Data flow (font-size change)

```
User taps "A" pill in Sheet
     ↓
useFontSize().setSize("lg")
     ↓
Context state updates
     ↓
document.documentElement.setAttribute("data-font-size","lg")
localStorage.setItem("pingpong:font-size","lg")
     ↓
CSS rule html[data-font-size="lg"] { font-size: 19px } applies
     ↓
All rem/em-based styles (Tailwind text-sm, text-lg, etc.) scale automatically
```

### Data flow (theme change)

Handled entirely by `next-themes`. `useTheme().setTheme("dark")` toggles class `.dark` on `<html>`, persists to `localStorage["pingpong:theme"]`, and next-themes' own inline script prevents flash on subsequent loads.

## Component details

### `_Providers.tsx`

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

### `_FontSizeProvider.tsx`

- Exports `FontSize = "sm" | "base" | "lg" | "xl"`.
- `FontSizeProvider`: reads current `data-font-size` attribute on mount (set by inline script), exposes `{ size, setSize }`.
- `setSize` updates state, sets DOM attribute, writes `localStorage["pingpong:font-size"]`.
- `useFontSize()` hook throws if used outside provider.
- All `localStorage` access wrapped in `try/catch` (Safari Private Mode).

### `_preferences-script.tsx`

Inline `<script>` rendered inside `<head>`. Runs before React hydrate. Reads `localStorage["pingpong:font-size"]`, validates it's one of `sm|base|lg|xl`, sets `data-font-size` on `<html>`. Falls back to `"base"` on any error or missing value.

```
(function(){try{var s=localStorage.getItem("pingpong:font-size");
  if(s==="sm"||s==="base"||s==="lg"||s==="xl"){
    document.documentElement.setAttribute("data-font-size",s);
  }else{
    document.documentElement.setAttribute("data-font-size","base");
  }}catch(e){}})();
```

### `globals.css` changes

Remove:
```css
html { font-size: 17px; }
```

Add:
```css
html[data-font-size="sm"]   { font-size: 15px; }
html[data-font-size="base"] { font-size: 17px; }
html[data-font-size="lg"]   { font-size: 19px; }
html[data-font-size="xl"]   { font-size: 21px; }
html:not([data-font-size])  { font-size: 17px; } /* fallback if JS disabled */
```

### `layout.tsx` changes

```tsx
<html lang="vi" className={`${fontSans.variable} h-full`} suppressHydrationWarning>
  <head>
    <PreferencesScript />
  </head>
  <body className="min-h-full flex flex-col antialiased">
    <Providers>
      {children}
      <BottomNav />
      <Toaster position="top-center" richColors />
      <OnboardingDialog />
    </Providers>
  </body>
</html>
```

Note: `Toaster` moves inside `<Providers>` so it resolves `useTheme()` consistently.

### `_BottomNav.tsx` changes

- `grid-cols-3` → `grid-cols-4`.
- Extend `NavTab` props with optional `onClick` — when present, render `<button>` instead of `<Link>`.
- New state `const [settingsOpen, setSettingsOpen] = useState(false)`.
- New tab "Cài đặt" with `Settings` icon from `lucide-react`.
- Render `<SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />` inside `BottomNav`.

### `_SettingsSheet.tsx`

Bottom-anchored shadcn `Sheet` with two sections:

1. **Giao diện** — 2 pill buttons (Sun/Moon icons): Sáng / Tối. Active state uses primary ring.
2. **Cỡ chữ** — 4 pill buttons labeled "A" at increasing font-size (text-xs / text-base / text-xl / text-2xl). Active state uses primary ring.
3. **Preview paragraph** below the font-size row using `text-base` — scales live as the user taps.

All changes apply immediately (no "Save" button).

### `_OnboardingDialog.tsx`

- On mount: if `localStorage["pingpong:onboarded"]` is missing, open the dialog.
- Do **not** open the dialog when pathname starts with `/admin` (admin workflow is not interrupted).
- Body: preview card, theme picker (2 pills), font-size picker (4 pills) — same controls as the Sheet.
- Footer: "Bỏ qua" (left, subtle text button) and "Xong" (right, primary). Both call the same `finish()` which sets the `onboarded` flag and closes.
- Closing via outside-tap, ESC, or any button sets the flag — we do not want to nag users.

## Storage keys

| Key | Values | Owner |
|---|---|---|
| `pingpong:theme` | `"light"` / `"dark"` | next-themes |
| `pingpong:font-size` | `"sm"` / `"base"` / `"lg"` / `"xl"` | FontSizeProvider |
| `pingpong:onboarded` | `"1"` | OnboardingDialog |

## Edge cases

1. **`localStorage` blocked** (Safari Private Mode, quota exceeded): all writes wrapped in `try/catch`. App runs with defaults. Onboarding may re-prompt on each load — acceptable for this edge case.
2. **JS disabled**: fallback CSS rule `html:not([data-font-size]) { font-size: 17px }` keeps base size. Theme stays light (`.dark` class only added by JS). Acceptable.
3. **Hydration mismatch**: `suppressHydrationWarning` on `<html>` only. Attributes differ between SSR and client since inline script runs before hydrate — this is expected and silenced.
4. **Cross-tab sync**: next-themes syncs theme across tabs. Font-size does not (custom provider). Acceptable; revisit if users report issues.
5. **Admin scope**: `BottomNav` already hidden on `/admin`; `OnboardingDialog` also suppressed there. But theme class and `data-font-size` attribute on `<html>` apply globally — admin inherits the user's public-site preferences.
6. **Hardcoded sizes**: before merging, grep for `text-\[` patterns and explicit `font-size:` declarations. Anything in `px` that should scale gets converted to `rem`. Small decorative text (e.g., BottomNav label) may intentionally stay fixed.

## Testing

### Manual QA checklist

- [ ] Fresh localStorage → onboarding dialog appears on first page load (any public page).
- [ ] Dismiss dialog via Skip, Xong, outside tap, ESC → flag set; reload → no dialog.
- [ ] Toggle Light ↔ Dark in Settings sheet → immediate change; reload → persists; no flash.
- [ ] Pick each font-size level → immediate change; reload → persists; no flash.
- [ ] Navigate to `/admin` → no BottomNav tab ⚙️, no onboarding dialog, but theme/font inherited.
- [ ] Clear localStorage, visit `/admin` first → no dialog (admin should not be interrupted); visit `/` next → dialog shows.
- [ ] DevTools slow-3G throttle → verify no white flash on dark mode reload.

### Unit tests (Vitest)

- `FontSizeProvider` reads initial value from `data-font-size` attribute.
- `setSize` writes to both DOM and localStorage.
- `useFontSize` throws outside provider.
- (Theme already covered by `next-themes`; no need to re-test.)

## Rollout

Single PR, no feature flag. Feature is additive (no breaking changes to existing routes or APIs).

## Open questions

None. All decisions confirmed during brainstorming.
