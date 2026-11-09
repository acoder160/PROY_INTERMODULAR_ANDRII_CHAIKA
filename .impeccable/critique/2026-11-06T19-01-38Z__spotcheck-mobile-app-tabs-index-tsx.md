---
target: spotcheck-mobile home map screen
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Admin\\Desktop\\Proyecto\\spotcheck-mobile\\app\\(tabs)\\index.tsx"
target_fingerprint: "sha256:923d7b6b38b78f43e29b1e4f0659be195ef19bfac99b63fad4c4c0e8c0d72f1b"
target_path: "C:\\Users\\Admin\\Desktop\\Proyecto\\spotcheck-mobile\\app\\(tabs)\\index.tsx"
timestamp: 2026-11-06T19-01-38Z
slug: spotcheck-mobile-app-tabs-index-tsx
---
Method: design review only (detector not applicable, native platform)
Target: spotcheck-mobile home map screen and the surfaces it opens (spot sheet, filters, add-spot form, camera, auth).
Run note: source-based review; the rendered native app was not inspected (Expo web renders spotcheck.web.tsx, not the WebView map).
Heuristics: 1=3 2=3 3=2 4=1 5=2 6=2 7=2 8=2 9=2 10=1.

Design specificity: migrated surfaces (top bar, spot sheet, camera, auth) are genuinely Locate Paint. The map itself and three components are still the old navy-teal / default-RN worlds, and the signature painted route does not exist.

Priority issues:
- [P1] Half-migrated chrome: MapFab (teal gradient circles, cyan glow) and FilterModal (navy glass, teal gradient Apply, emoji) sit beside the pink Add FAB and white paint sheet. Port MapFab to the 56px white rounded-square FAB and FilterModal to a white sheet with choice pills and a pink apply. (polish)
- [P1] SpotFormModal is default RN: tap-to-cycle Type/Level, placeholder-only labels, white on #2ED573 (~2:1), Close discards the photo with no confirm, alert() validation and success. Rebuild as a paint sheet with choice pills plus paint dots, real labels, inline errors, pink Save, discard confirm. (layout, harden)
- [P1] Map surface unpainted: PNG icon markers instead of paint dots; Leaflet popup uses teal/orange badges with 10px white text (~2:1); no dashed pink route anywhere; user dot #007AFF. Restyle popup CSS, paint markers via spotTypePaint, add the 2 12 dashed route. Cluster label and user marker are brand commitments: confirm before recolouring. (colorize, polish)
- [P2] Filters: no onRequestClose (Android back dead), no reset, "apply" button that applies nothing (filters are live), 21 languages + 16 filter pills in one sheet. (distill, harden)
- [P2] Logout is a one-tap red icon beside the username with no confirm; the username pill looks exactly like the tappable Enter pill but is inert. (harden)

Personas: Travelling skater (sun legibility of popup badges, route missing, distance only in sheet), Casey (form far from thumb, photo lost on Close), Sam (unlabelled cycle buttons, untranslated "n / 5" labels, popup buttons inside WebView), Jordan (no first-run hint before the camera opens).

Minor: invented "S" brand mark on login; 2s minimum reload spin; "n / 5" labels hard-coded; comments collapsed by default; rating number + stars + "average" text triple-state the same value; dead explore.tsx/modal.tsx template routes remain.
