# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The design language is one custom look shared by two clients: `spotcheck-web` (React + Vite, browser) and `spotcheck-mobile` (Expo / React Native, shipped to Android, with an Expo web export). Neither client follows per-OS native conventions; both must read as the same product.

## Users

Travelling skaters: people visiting a city they don't know who need trustworthy skate spots near them, fast. They are on foot or on the board, phone in hand, often outdoors in daylight, deciding whether a spot is worth the trip from a photo, a rating and a short description. Locals add and rate the spots those travellers rely on.

## Product Purpose

SpotCheck geolocates skate spots on a map and lets the community rate and comment on them. Anyone can browse; an account is needed to add, rate or comment. Success is a skater in an unfamiliar city opening the app, seeing what is close, judging a spot from its photo and rating, and getting there.

## Positioning

Spots enter the map photo-first: a new spot starts with a photo taken on site, then is pinned within the contributor's GPS radius, then described. That makes the map a record of places someone actually stood at, not pins dropped from a sofa.

## Operating Context

- Map-first use: a full-screen map is the home of both clients; spots cluster as "+N" labels and open into a detail view with photo, average rating, the user's own vote and comments.
- Add-spot flow (mobile): camera → tap inside the location circle to place the pin → name, description, type, level → save.
- Filters: spot type, maximum distance from the user, minimum stars. Language selection lives with filters today.
- The backend runs on free hosting and can take 1–2 minutes to wake up; the clients tell the user so. The mobile app shows cached spots when offline.
- Web has an admin page for moderation.

## Capabilities and Constraints

- Backend: Spring Boot + PostgreSQL/PostGIS, JWT with refresh tokens, rate limiting, AI moderation of submitted content, Cloudinary image hosting.
- Spot types: STREET, PARK, RAMPS, RAIL, LEDGE. Difficulty: BEGINNER, INTERMEDIATE, ADVANCED. Ratings 1–5 stars.
- Translated into 20 languages, including Arabic (RTL), Hindi, Bengali, Thai, Chinese, Japanese and Korean; every visible string must go through i18n and layouts must survive long and RTL text.
- Maps are Leaflet with OpenStreetMap-style tiles on both clients (WebView on mobile).

## Brand Commitments

- The Leaflet map tiles and map theme stay as they are; redesigns do not restyle the map itself.
- Map-first layout stays: full-screen map, no tab bar, primary map controls along the bottom on mobile.
- The photo-first add-spot flow stays.
- The recent map visuals stay: the user location marker and the "+N" cluster labels.
- Name: SpotCheck. No logo asset exists beyond the default app icons.

## Evidence on Hand

- Real spot data and photos come from the live backend (Cloudinary URLs); there are no curated brand photos in the repo.
- No testimonials, user counts or press exist; none may be invented.

## Product Principles

1. The spot is the hero: its photo and rating carry the decision, and chrome stays out of their way.
2. Readable in the street: controls and text must work one-handed, in sunlight, at a glance.
3. Honest state: say when the server is waking, when data is cached, and when an account is required, before the user hits a wall.
4. One product everywhere: web and mobile share a single visual language.

## Accessibility & Inclusion

Must hold WCAG AA contrast on map controls and sheets, labelled touch targets of at least 44pt, and layouts that survive RTL and long translations across the 20 supported languages.
