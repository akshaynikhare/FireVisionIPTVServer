# FireVision IPTV Server — Color Palette Reference

> Unified design system shared with the FireVisionIPTV Android app.  
> Both apps use the same three-scale palette: **Flame** (brand), **Void** (dark surfaces), **Parchment** (light surfaces).

---

## Brand — Flame

| Token       | Hex       | HSL (approx)  | Usage                                       |
| ----------- | --------- | ------------- | ------------------------------------------- |
| `flame-50`  | `#FFECC8` | `38 100% 87%` | Tint backgrounds, hover overlays            |
| `flame-100` | `#FFD080` | `38 100% 75%` | Glow effects, badge tints                   |
| `flame-300` | `#F7A93A` | `38 92% 60%`  | **Dark mode primary** — buttons, focus ring |
| `flame-400` | `#E07818` | `32 80% 48%`  | Button fills, active nav                    |
| `flame-500` | `#B85E10` | `30 84% 38%`  | **Light mode primary** — pressed states     |
| `flame-700` | `#7A3A06` | `26 90% 25%`  | Text on flame-colored backgrounds           |

### CSS Variables (`globals.css`)

```css
/* Light mode (:root) */
--primary: 30 84% 38%; /* flame-500 */
--primary-foreground: 40 10% 98%; /* near-white on amber */
--ring: 30 84% 38%;

/* Dark mode (.dark) */
--primary: 38 92% 60%; /* flame-300 */
--primary-foreground: 240 10% 6%; /* near-black on amber */
--ring: 38 92% 60%;
```

---

## Dark Mode — Void

Blue-coal near-blacks. The cool undertone makes Flame accents pop.

| Token      | Hex       | HSL (approx)  | Usage                       |
| ---------- | --------- | ------------- | --------------------------- |
| `void-950` | `#0A0A12` | `240 30% 6%`  | App background              |
| `void-900` | `#11111A` | `240 22% 8%`  | Sidebar / drawer            |
| `void-800` | `#191921` | `240 15% 11%` | Card background             |
| `void-700` | `#21212C` | `240 14% 16%` | Elevated card               |
| `void-600` | `#2A2B37` | `236 13% 19%` | Overlay / modal             |
| `void-500` | `#343542` | `237 11% 23%` | Tooltip / highest elevation |

### CSS Variables (`globals.css`)

```css
/* Dark mode (.dark) */
--background: 240 30% 6%; /* void-950 */
--card: 240 15% 11%; /* void-800 */
--popover: 240 15% 11%;
--secondary: 240 14% 16%; /* void-700 */
--muted: 240 14% 16%;
--border: 236 13% 19%; /* void-600 */
--input: 240 14% 16%;
--sidebar-background: 240 22% 8%; /* void-900 */
```

---

## Light Mode — Parchment

Warm cream surfaces. Pairs naturally with the amber brand.

| Token           | Hex       | HSL (approx) | Usage                  |
| --------------- | --------- | ------------ | ---------------------- |
| `parchment-50`  | `#FAF8F4` | `40 33% 97%` | App background         |
| `parchment-100` | `#F4F0E8` | `40 29% 93%` | Content areas          |
| `parchment-200` | `#EDE8DE` | `38 22% 89%` | Card background        |
| `parchment-300` | `#E2DCD0` | `36 18% 85%` | Light border / divider |
| `parchment-500` | `#C8C0B0` | `36 14% 74%` | Strong border          |
| `parchment-700` | `#A09080` | `30 12% 56%` | Icons, dividers        |

### CSS Variables (`globals.css`)

```css
/* Light mode (:root) */
--background: 40 33% 97%; /* parchment-50 */
--card: 38 22% 89%; /* parchment-200 */
--popover: 0 0% 100%;
--secondary: 40 29% 93%; /* parchment-100 */
--muted: 40 29% 93%;
--border: 36 18% 85%; /* parchment-300 */
--input: 38 22% 89%;
--sidebar-background: 40 29% 93%; /* parchment-100 */
```

---

## Text

### Dark Mode

| Token            | Hex       | HSL (approx)  | Usage                     |
| ---------------- | --------- | ------------- | ------------------------- |
| `text-primary`   | `#F2EDE3` | `38 29% 92%`  | Headings, labels          |
| `text-secondary` | `#A8A0B2` | `270 8% 66%`  | Supporting text, metadata |
| `text-dim`       | `#706880` | `270 9% 45%`  | Placeholders, timestamps  |
| `text-disabled`  | `#3A3648` | `265 12% 25%` | Disabled state            |

### Light Mode

| Token            | Hex       | HSL (approx)  | Usage                     |
| ---------------- | --------- | ------------- | ------------------------- |
| `text-primary`   | `#1C1A24` | `252 15% 12%` | Headings, labels          |
| `text-secondary` | `#5A5470` | `260 13% 39%` | Supporting text, metadata |
| `text-dim`       | `#8C8898` | `258 7% 57%`  | Placeholders, timestamps  |
| `text-disabled`  | `#C4C0D0` | `255 13% 78%` | Disabled state            |

### CSS Variables (`globals.css`)

```css
/* Light mode (:root) */
--foreground: 252 15% 12%; /* text-primary light */
--muted-foreground: 260 13% 39%; /* text-secondary light */

/* Dark mode (.dark) */
--foreground: 38 29% 92%; /* text-primary dark */
--muted-foreground: 270 8% 66%; /* text-secondary dark */
```

---

## Semantic Colors

| Role        | Dark Mode Hex | Dark HSL (approx) | Light Mode Hex | Light HSL (approx) |
| ----------- | ------------- | ----------------- | -------------- | ------------------ |
| **Success** | `#28B560`     | `142 62% 43%`     | `#1A8A40`      | `142 67% 32%`      |
| **Error**   | `#E83838`     | `0 78% 56%`       | `#C02020`      | `0 71% 44%`        |
| **Warning** | `#F5A624`     | `38 91% 55%`      | `#D07808`      | `35 90% 42%`       |
| **Info**    | `#3D88F5`     | `217 89% 60%`     | `#1A60D0`      | `217 78% 45%`      |

### CSS Variables (`globals.css`)

```css
/* Signal colors — dark mode */
--signal-green: 142 62% 43%;
--signal-red: 0 78% 56%;
--signal-blue: 217 89% 60%;
--signal-amber: 38 91% 55%;

/* Signal colors — light mode */
--signal-green: 142 67% 32%;
--signal-red: 0 71% 44%;
--signal-blue: 217 78% 45%;
--signal-amber: 35 90% 42%;
```

---

## Tailwind Class Usage Guide

```tsx
// Primary actions (auto-adapts via CSS variables)
<Button className="bg-primary text-primary-foreground hover:bg-primary/90" />

// Cards (auto-adapts)
<div className="bg-card text-card-foreground border border-border rounded" />

// Status indicators
<span className="text-[hsl(var(--signal-green))]">● Online</span>
<span className="text-[hsl(var(--signal-red))]">● Offline</span>
<span className="text-[hsl(var(--signal-amber))]">● Checking</span>

// Sidebar (uses sidebar-specific tokens)
<nav className="bg-sidebar border-r border-sidebar-border" />
```

---

## Do's and Don'ts

**DO**

- Use CSS variable tokens (`bg-primary`, `text-foreground`, `bg-card`) — they auto-switch with dark mode
- Use `flame-500` equivalent (`--primary` in `:root`) for light mode primary actions
- Use `flame-300` equivalent (`--primary` in `.dark`) for dark mode primary actions

**DON'T**

- Hardcode hex values in component files — always use CSS variable tokens
- Use the previous teal/blue accent (`#2196F3`) — it does not exist in this palette
- Use pure black `#000` or pure white `#fff` backgrounds

---

## Cross-Platform Reference

The Android app uses the same palette mapped to Jetpack Compose `Color` constants.  
See `FireVisionIPTV/docs/COLOR_PALETTE.md` for the Android-side token mapping.
