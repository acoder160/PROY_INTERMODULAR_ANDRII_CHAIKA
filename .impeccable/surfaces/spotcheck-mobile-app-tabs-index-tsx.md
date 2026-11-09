---
version: 1
slug: "spotcheck-mobile-app-tabs-index-tsx"
primary_target: "spotcheck-mobile/app/(tabs)/index.tsx"
related_targets: []
---

# Surface brief: SpotCheck mobile app (map, spot sheet, filters, add flow, auth)

Mode: Operate. Platform: adaptive (Android + iOS, native conventions). Scope: spotcheck-mobile; web client and admin untouched.

Audience: street skaters outdoors, one-handed, bright sun. Job: find a nearby spot, judge it from photo and rating, roll there, add new spots. Constraints: 20 languages incl. RTL, 48dp/44pt targets, WCAG AA, no invented proof.

Open decisions (defaults chosen at brief confirmation): colour = spot type only; difficulty = text plus 1-3 mark glyph, never hue alone. Markers uniform size, colour carries type. Light theme first, dark follows. Display face Big Shoulders Display (Latin only; other scripts fall back to system bold).

## Direction contract

THESIS: The app is the pavement. Spots are marked the way crews mark the street, in utility locate paint, and the route to a spot is painted on the ground. Refuses the navy-teal glass look, glow, gradients, grunge and flame skate clichés, and generic Material-map chrome.

OWN-WORLD: Asphalt-black shell (#1C1C1C) with white stencil-cut condensed type (Big Shoulders Display) over concrete-grey map ground; white sheets. Five flat paint colours, each one spot type: orange, yellow, blue, green, pink (pink also owns the painted route and the primary action). Flat fields, 2px white or black outlines, no gradients, no zero-offset glows. Body text in the system face. Recognisable with content removed: black bar, flat paint dots, dashed pink line.

STORY: A skater opens the map, sees paint-coloured marks where spots are, taps one, sees the photo and a huge distance, and follows the pink painted line there. They rate it, and add spots that appear as new paint on the map.

FIRST VIEWPORT: Full-screen map, concrete-grey. Black top bar with outlined Filters pill (left) and account pill (right). Paint-colour dots as markers. Tapping a spot raises a white sheet from the bottom: 110px photo, name in stencil caps at 34px, a 5-stripe paint strip, type chip and difficulty text with mark glyph, the distance at 40px, rating, and a full-width pink "Roll there" button. Add-spot, reload and locate controls sit above the sheet in the thumb zone; a dashed pink route runs from the user to the selected spot.

FORM: Painted route plus locate-paint colour coding, form 3 of own grounded list after the first hand was eliminated, rolled assigned index 6 and picked by the user from own grounded list (pick card). seed:a71f9d574ce311cc

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
