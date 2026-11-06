---
name: SkateMap
description: Locate-paint skate map. Asphalt shell, concrete map ground, five flat paint colours, a dashed pink painted route.
colors:
  asphalt: "#1C1C1C"
  asphalt-raised: "#2A2A2A"
  concrete: "#C9C9C4"
  sheet: "#FFFFFF"
  ink-muted: "#4A4A46"
  hairline: "#D7D7D2"
  on-asphalt-muted: "#C8C8C3"
  paint-orange: "#FF7A00"
  paint-yellow: "#FFD400"
  paint-blue: "#2F6BFF"
  paint-green: "#18A558"
  paint-pink: "#FF4FA3"
  danger: "#C62828"
  danger-on-dark: "#FF8A80"
  positive: "#0F7A3E"
typography:
  display:
    fontFamily: "BigShouldersDisplay_900Black, system bold"
    fontSize: "36px"
    fontWeight: 900
    lineHeight: "38px"
    letterSpacing: "0.4px"
  distance:
    fontFamily: "BigShouldersDisplay_900Black, system bold"
    fontSize: "48px"
    fontWeight: 900
    lineHeight: "50px"
  title:
    fontFamily: "BigShouldersDisplay_700Bold, system bold"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "0.6px"
  label:
    fontFamily: "BigShouldersDisplay_700Bold, system bold"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "0.6px"
  body:
    fontFamily: "system (system-ui on iOS, Roboto on Android)"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
rounded:
  chip: "10px"
  card: "16px"
  control: "24px"
  sheet: "28px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  min-target: "48px"
components:
  button-primary:
    backgroundColor: "{colors.paint-pink}"
    textColor: "{colors.asphalt}"
    rounded: "26px"
    height: "52px"
  pill-on-dark:
    backgroundColor: "{colors.asphalt}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  choice-pill-selected:
    backgroundColor: "{colors.asphalt}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    height: "48px"
  type-chip:
    textColor: "{colors.asphalt}"
    rounded: "{rounded.chip}"
    padding: "4px 10px"
  map-fab:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.asphalt}"
    rounded: "16px"
    size: "56px"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.asphalt}"
    rounded: "14px"
    height: "48px"
---

# Design System: SkateMap

## Overview

**Creative North Star: "Locate Paint"**

The app is the pavement. Spots are marked the way crews mark the street, in flat utility locate paint, and the route to a spot is a dashed painted line on the ground. The shell is asphalt-black, the map ground is concrete grey, sheets are white, and type is stencil-cut condensed caps. The result reads as marked-up street rather than a map-app skin.

Everything is flat. Fields are solid colour with 2px outlines in white (on asphalt) or ink (on light). Colour is information: each of five paints is one spot type, and pink alone also owns the primary action and the route. Difficulty is never carried by hue; it is text plus one to three slanted marks.

Recognisable with content removed: a black top bar, flat paint dots with dark rings, and a dashed pink line.

**Key Characteristics:**
- Asphalt shell, concrete ground, white sheets.
- Five flat paints, one per spot type; pink also means "go".
- 2px outlines on every control; pill and sheet radii.
- Condensed uppercase display face for all headings, buttons, labels; system face for reading text.
- 48px minimum targets; legible in direct sun.

## Colors

Five saturated paints on a neutral asphalt and concrete field; the neutrals stay quiet so the paints carry meaning.

### Primary
- **Locate Pink** (#FF4FA3, `paint-pink`): the primary action fill (Roll there, Sign in, Send, Add spot), the painted route, the filter count badge, and links on asphalt. Ink text on it.

### Secondary (spot-type paints)
- **Safety Orange** (#FF7A00): Street.
- **Survey Yellow** (#FFD400): Rail. Also the offline and waking-server notice.
- **Utility Blue** (#2F6BFF): Ramps.
- **Park Green** (#18A558): Park and Skatepark.
- **Ledge white** (#FFFFFF with ink outline): Ledge, the "proposed excavation" mark.

### Neutral
- **Asphalt** (#1C1C1C, `asphalt`): top bar, ink text, outlines, user dot, clusters, selected pill fill.
- **Raised Asphalt** (#2A2A2A): auth card on the asphalt screen.
- **Concrete** (#C9C9C4): map ground, photo placeholder.
- **Sheet White** (#FFFFFF): sheets, inputs, FABs.
- **Worn Ink** (#4A4A46): secondary text on white.
- **Hairline** (#D7D7D2): dividers and comment borders.
- **Chalk** (#C8C8C3): secondary text on asphalt.
- **Danger** (#C62828) / **Danger on dark** (#FF8A80) and **Positive** (#0F7A3E): status text and icons only.

### Named Rules
**The Colour-Is-Type Rule.** Orange, yellow, blue, green and white mean a spot type and nothing else. Do not use them as decoration or as state colours (yellow on notices is the one recorded exception, see Components).
**The One Go Rule.** Pink is the primary action and the route. One pink action per view.
**The Not-Hue-Alone Rule.** Type and difficulty always carry a text label; difficulty is marks plus text.

## Typography

**Display Font:** Big Shoulders Display, 700 and 900 (falls back to system bold; Latin only)
**Body Font:** System face (Roboto on Android, system-ui on iOS)

**Character:** Stencil-cut condensed caps against a plain system face. Other scripts (Arabic, Hindi, CJK, Thai) fall back to the system bold, so layouts must tolerate longer, wider strings.

### Hierarchy
- **Distance** (900, 48/50): the huge distance on the spot sheet; also rating number at 44.
- **Display** (900, 36/38, uppercase, +0.4): spot name on the sheet; 38 for auth titles.
- **Button** (900, 22-24, uppercase, +1): primary buttons (22 on sheet, 24 on auth, 22 on add FAB).
- **Title** (700, 20, uppercase, +0.6): accordion headers, top-bar pills.
- **Label** (700, 16-18, uppercase, +0.6 to 0.8): chips, difficulty text, choice pills, form labels.
- **Body** (400, 16/22; secondary 15, 14, 13): descriptions, comments, notices (bold 700 at 14-15 in notices).

### Named Rules
**The Stencil Rule.** Display face is always uppercase and used only for names, numbers, buttons and labels. Never for paragraphs.

## Layout

Full-bleed map beneath everything. A black top bar pinned to the top holds the Filters pill (left) and account pill (right). Controls (add spot, reload, locate) float over the map in the thumb zone above the sheet. The spot sheet rises from the bottom (max 92% height) with 20px side padding. Auth is a centred asphalt card (max 430px wide, 24px padding) on an asphalt screen. Spacing runs on a 4/8 rhythm: 8, 12, 16, 20, 24 observed. Minimum touch target 48px (56px for FABs and primary buttons).

## Elevation & Depth

Flat by default: depth comes from 2px outlines and colour contrast, not tonal layering. Soft drop shadows exist only on floating map controls (FAB and Add: `0 3px 6px rgba(0,0,0,0.25)`, Android elevation 4) and the top bar (elevation 6). WebView markers use `0 2px 3px rgba(0,0,0,0.35)`, popups `0 4px 12px rgba(0,0,0,0.3)`. A scrim `rgba(28,28,28,0.6)` sits behind sheets. No gradients, no glows.

### Named Rules
**The Flat-Fields Rule.** Fills are solid. Shadows are only for objects floating over the map, never for sheet content.

## Shapes

Pills and rounded sheets, always outlined. Controls are fully round pills (24-28px radius), sheet top corners 28px, cards 16px, chips 10px, inputs 14-16px, FABs 16px rounded squares. Map markers are 28px circles with a 3px ink ring; clusters are 42px asphalt circles with a 3px white ring and white "+N". Difficulty marks are 7x16 parallelograms (skewX -18deg), filled when active and outlined when off. The 6px paint strip (five paints in equal bands) is the section divider on the sheet.

## Components

### Buttons
- **Primary:** pink fill, 2px ink border, full pill, uppercase 900 ink text, min height 52-56px.
- **Top-bar pill:** transparent on asphalt, 2px white border, white 700 caps text; account pill inverts to white fill with ink text.
- **Choice pill** (filters, add form): 2px border, selected = solid fill inverted (asphalt on light, white on dark); optional paint dot.
- **Map FAB:** 56px white rounded square, 2px ink border, ink glyph; spins at 900ms linear while busy. Close variant is asphalt with white border.
- **Press:** `activeOpacity 0.8`; WebView buttons scale to 0.96.

### Chips
- **Type chip:** paint-filled, 2px ink border, 10px radius, uppercase label. Colour plus text.
- **Difficulty:** 1-3 slanted marks plus uppercase text label.

### Cards / Containers
- **Sheet:** white, 28px top radius, 200px photo on top, concrete placeholder if no photo, asphalt close button (48px, white ring).
- **Rate box:** 2px ink border, 16px radius. Comments: 1px hairline border, 12px radius.

### Inputs / Fields
- 2px border (ink on white sheets, white on the asphalt auth card), white fill, 14-16px radius, min height 48. Auth labels are display-face caps on asphalt.
- **Error / success:** tinted boxes with icon plus bold text (light: #FCE8E6 / #E2F4E8; dark: #3A1B1B with danger-on-dark border).

### Navigation
- Single black top bar; no tab bar chrome on the map. Filter count shown as a pink badge.

### Painted Route (signature)
- Pink 6px line, round dashes (`2 12`), from user to selected spot. User dot: asphalt with white ring and pulsing ring. Search radius uses a dark dashed ring (`4 6`).

### Notices
- Offline / waking server: yellow pill with ink border and ink text. Add-mode hint: asphalt pill with white border.

## Do's and Don'ts

### Do:
- **Do** colour spots only with the five paints through `spotTypePaint`, with a text label alongside.
- **Do** outline every control and chip in 2px (white on asphalt, ink on light).
- **Do** keep every target at least 48px and ink-on-paint text for contrast.
- **Do** render the route as a dashed pink line and keep pink for the single primary action.
- **Do** design for long strings, RTL and non-Latin fallback: let labels wrap or shrink instead of truncating the type chip.

### Don't:
- **Don't** use gradients, glows, or blur in new surfaces.
- **Don't** use the paints for decoration or non-type state.
- **Don't** signal difficulty by colour.
- **Don't** set paragraphs in the display face.
- **Don't** reintroduce the old navy and teal palette; the web client keeps its own look and is out of scope.
