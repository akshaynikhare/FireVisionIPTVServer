# ADR-002: Unified Color Palette — Flame / Void / Parchment

## Status

Accepted

## Date

2026-04-02

## Context

The FireVision IPTV Server web app (Next.js) and the FireVision IPTV Android TV app evolved their color systems independently:

- **Server web app** used an HSL-based amber primary with cool blue-black dark surfaces, but the amber shade (`hsl(40 65% 55%)` ≈ `#D4953A`) differed from the Android app's amber (`#E8A849`).
- **Android app** used warm-tinted near-black surfaces (not cool blue-coal like the server) and still had Material Blue (`#2196F3`) in its XML resources for selection states.
- **Light mode** on the server defaulted to flat parchment-ish backgrounds, but the CSS variables were not a well-named system — `--secondary`, `--muted` etc. pointed to arbitrary warm grays with no documented design intent.
- No shared reference document existed. The two products looked related but not designed as a cohesive family.

As the platform grows toward a unified user experience (users pair TV devices via the web dashboard and expect visual consistency), the color divergence became a design quality issue.

## Decision

Adopt a single unified palette — **Flame / Void / Parchment** — across both apps, reflected in the `globals.css` CSS custom properties.

### Palette Summary

**Flame (brand)**
| Token | Hex | CSS (dark `.dark`) | CSS (light `:root`) |
|-------------|-----------|---------------------|----------------------|
| `flame-300` | `#F7A93A` | `--primary: 38 92% 60%` | — |
| `flame-500` | `#B85E10` | — | `--primary: 30 84% 38%` |
| `flame-400` | `#E07818` | `--accent: 32 80% 48%` | — |
| `flame-100` | `#FFD080` | — | `--accent: 38 100% 75%` |

**Void (dark mode surfaces)**
| Token | CSS Variable |
|------------|-------------------------------|
| `void-950` | `--background: 240 30% 6%` |
| `void-900` | `--sidebar-background: 240 22% 8%` |
| `void-800` | `--card: 240 15% 11%` |
| `void-700` | `--secondary: 240 14% 16%` |
| `void-600` | `--border: 236 13% 19%` |

**Parchment (light mode surfaces)**
| Token | CSS Variable |
|----------------|--------------------------------------|
| `parchment-50` | `--background: 40 33% 97%` |
| `parchment-100`| `--sidebar-background: 40 29% 93%` |
| `parchment-200`| `--card: 38 22% 89%` |
| `parchment-300`| `--border: 36 18% 85%` |

**Semantic / Signal**
| Role | Dark `.dark` | Light `:root` |
|---------|------------------------|------------------------|
| Success | `--signal-green: 142 62% 43%` | `--signal-green: 142 67% 32%` |
| Error | `--signal-red: 0 78% 56%` | `--signal-red: 0 71% 44%` |
| Warning | `--signal-amber: 38 91% 55%` | `--signal-amber: 35 90% 42%` |
| Info | `--signal-blue: 217 89% 60%` | `--signal-blue: 217 78% 45%` |

### CSS Variable Names Preserved

All existing CSS variable names (`--primary`, `--background`, `--card`, `--signal-green`, etc.) are preserved. **No component code changes are required** — only the values in `globals.css` change. This is a drop-in replacement.

### Reference Documents

- `frontend/COLOR_PALETTE.md` in this repo — CSS/Tailwind token reference
- `FireVisionIPTV/docs/COLOR_PALETTE.md` — Android Kotlin token reference

## Alternatives Considered

### Keep existing server palette, only fix Android to match

The server's amber (`hsl(40 65% 55%)`) is softer than the new `flame-300` (`#F7A93A`). Adopting the old server palette on Android would preserve the softer, champagne gold feel. Rejected because the design review found the new palette more energetic and appropriate for a media streaming brand.

### Move to CSS color-mix() and OKLCH

More perceptually uniform; better for generating tints/shades programmatically. Rejected for now because Tailwind 3.x CSS variable interop works best with HSL. Revisit when upgrading to Tailwind 4.

### Dark mode only

Android TV is dark-only by nature. The web dashboard, however, is used in office/daytime contexts where dark mode is not preferred. Light mode support was explicitly requested and the Parchment scale was designed specifically for this use case.

## Consequences

**Positive:**

- `globals.css` is the single source of truth for web color tokens
- Zero component code changes required — all token names preserved
- Light mode now uses the intentional Parchment scale rather than ad-hoc warm grays
- Android and web now share the same amber shade and semantic color values
- Reference documentation (`COLOR_PALETTE.md`) exists for the first time in both repos

**Negative:**

- Existing screenshots and Storybook snapshots (if any) show the old palette
- The amber shift (`#D4953A` → `#F7A93A` in dark, `#B85E10` in light) is visually noticeable — a intentional and approved change
