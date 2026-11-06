---
target: skatemap-mobile home map screen
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Admin\\Desktop\\Proyecto\\skatemap-mobile\\app\\(tabs)\\index.tsx"
target_fingerprint: "sha256:41eef54387ee92533eb00f00e2a66f88dc61051fca3c6739ae6d42d794ffdcf9"
target_path: "C:\\Users\\Admin\\Desktop\\Proyecto\\skatemap-mobile\\app\\(tabs)\\index.tsx"
timestamp: 2026-10-29T20-15-25Z
slug: skatemap-mobile-app-tabs-index-tsx
---
Method: design review only (detector not applicable, native platform)
Target: skatemap-mobile home map screen and surfaces it opens.
Score 21/40 (Acceptable). Heuristics: 1=3 2=3 3=2 4=2 5=2 6=2 7=2 8=2 9=2 10=1.
Priority issues:
- [P1] Three visual dialects: dark glass chrome vs white default-RN sheets (details, form) vs Leaflet popups. Unify tokens; redesign spot details sheet around the photo. (shape, document)
- [P1] Accessibility: white on #2ed573 ~2:1, success text ~1.7:1, empty stars near-invisible, stars unlabeled, filter/user badge/logout lack labels or hit area, 10-12px text. (audit, harden)
- [P1] Type/Level are hidden tap-to-cycle buttons in SpotFormModal; reuse FilterModal pills. (layout)
- [P2] Top chrome hard-coded top:40/95, no safe area, unbounded username collides with Filters. (adapt)
- [P2] Decoration (gradients, glow, bubbles, emoji) louder than the map; no active-filter count; language buried in Filters. (quieter, distill)
Personas: Alex (no search/list/reset), Jordan (icon-only FABs, unexplained permissions, no empty state), Casey (reach, sun legibility, no photo retake).
Minor: dead explore.tsx/modal.tsx template leftovers, alert() for feedback, emoji in status strings, placeholder.com image, hard-coded English eyebrow on login.
