# Campus explorer frontend

The map and Journey Wall share one workspace. Free mode and Film controls have been removed from the frontend.

## Flow

1. Start on the black-and-gold campus map. Pick one of the ten preset places (Memory Mall, Student Union, Library, Reflecting Pond, Engineering I and II, Research I, Health Sciences I, John T. Washington Center, Cypress Dome) using a keyboard-accessible pin or the place dropdown.
2. The selected place's source preview and photo upload appear below the map. Moment selection sits directly below that place, followed by Quick / Standard / High Detail quality options and Generate.
3. Follow the existing timeline, play/download the arrival, then save a mock journey or view the server Wall. The inline Wall refreshes after a local save or a completed live journey; no separate Wall tab is needed.
4. Back to map clears the finished journey selection. While a render is running, waypoint changes are locked; Stop waiting stops local polling without canceling the server job.

## Map and photo boundaries

`CampusMap.tsx` displays a real, north-up geographic basemap. Roads (including Gemini Boulevard), walking paths, building footprints, parking, green areas, Lake Claire and other water features come from a local OpenStreetMap extract. `public/maps/ucf-campus.svg` is rendered from those coordinates, rather than hand-drawn approximations. The OSM source data is distributed as `public/maps/ucf-osm.json` under ODbL 1.0; the map displays clickable attribution. See [source, license, and refresh instructions](../public/maps/README.md).

Waypoint anchors come from [UCF's official locations registry](https://www.map.ucf.edu/locations.json): Student Union (52), John C. Hitt Library (2), Reflecting Pond (360), Memory Mall (memorymall), Engineering I (40), Engineering II (91), Research 1 (120), Health Sciences I (80), and John T. Washington Center (26). Cypress Dome has no registry entry; its anchor is the middle of its boardwalk, OSM way 334887933 (`bridge=boardwalk`), between the Student Union and Memory Mall (not OSM's "Cypress Trail" on the east side of campus). Memory Mall's highlight uses its official polygon; the other highlights use OSM footprints (Cypress Dome: the scrub the boardwalk crosses, way 334882442). The official UCF data is a separate layer, credited beside OpenStreetMap. Crowded pins put their labels beside the pin instead of below it via per-pin `waypoint-<placeId>` rules in `timeMachine.css`.

`mapProjection.ts` applies the same latitude-corrected projection to the exported SVG and the pin overlay. `CampusMap` measures the viewport and maintains the map aspect ratio on resize; smaller screens crop surrounding campus rather than distort distances. North is up. The map is bundled locally, with no live tile requests or map API credentials. It is a dated campus explorer, not turn-by-turn navigation. Every pin maps to an existing `places.ts` ID; those IDs, shared prompt templates, and backend scripts are unchanged.

The map is separate from the generation source image. Real generation uses the team's preset photo of the selected place (one or more views each, `public/places/`) or an uploaded photo. An uploaded photo uses the existing multipart `image` field rather than adding an unsupported field to the relay contract. The local ticket keeps the waypoint display name for reload recovery. The relay currently labels uploaded-photo Wall entries “Your campus photo”; it needs a future contract change to carry the waypoint name to its server Wall.

Both providers offer Snapshot only. Quality IDs are mapped by the relay to tested worker settings; see [api.md](api.md). The before/after comparison uses the relay's `finalFrameUrl` (the clip's last frame). Demo outputs stay explicitly labeled as fixed sample MP4s.

## Verification

Run `npm run build` and `npm test`. The suite includes a local integration test of the unchanged relay and both HTTP frontend adapters, isolated from cloud credentials and the real Wall index.

Browser checks should cover waypoint and dropdown selection, moment options below the chosen place, keyboard/zoom/reset navigation, photo upload, generation across workspace changes, reload recovery, inline Wall updates/playback/filtering, errors, and responsive layouts. Live GPU inference requires the team's private notebook connection settings in `relay/.env.local`; those never belong in `VITE_` variables or Git.
