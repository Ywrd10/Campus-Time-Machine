# Campus explorer frontend

The map and Journey Wall share one workspace. Free mode stays mounted alongside it so switching views doesn't lose uploads or ongoing polling.

## Flow

1. Start on the purple campus map. Pick Reflecting Pond, Student Union, Library, or Memory Mall using a keyboard-accessible pin or the place dropdown.
2. The selected place's source preview and photo upload appear below the map. Moment selection sits directly below that place, followed by Snapshot/Film options and Generate.
3. Follow the existing timeline, play/download the arrival, then save a mock journey or view the server Wall. The inline Wall refreshes after a local save or a completed live journey; no separate Wall tab is needed.
4. Back to map clears the finished journey selection. While a render is running, waypoint changes are locked; Stop waiting stops local polling without canceling the server job.

## Map and photo boundaries

`CampusMap.tsx` is an original SVG schematic inspired by the supplied reference, with approximate layout clearly labeled. It is not a navigation/geolocation map and doesn't fetch external tiles. `mapData.ts` contains frontend-only positions; every pin maps to an existing `places.ts` ID. Those IDs, shared prompt templates, and backend scripts are unchanged.

The map is separate from the generation source image. Real generation still requires the team's preset photo or an uploaded photo of the selected place. Until preset photos arrive, HTTP mode opens the upload panel and explains this requirement. An uploaded photo uses the existing multipart `image` field rather than adding an unsupported field to the relay contract. The local ticket keeps the waypoint display name for reload recovery. The relay currently labels uploaded-photo Wall entries “Your campus photo”; it needs a future contract change to carry the waypoint name to its server Wall.

Live mode offers Snapshot only. Film is enabled only with the mock provider. Comparison still requires `finalFrameUrl` from the relay. Demo outputs stay explicitly labeled as fixed sample MP4s.

## Verification

Run `npm run build` and `npm test`. The suite includes a local integration test of the unchanged relay and both HTTP frontend adapters, isolated from cloud credentials and the real Wall index.

Browser checks should cover waypoint and dropdown selection, moment options below the chosen place, keyboard/zoom/reset navigation, photo upload, generation across workspace changes, reload recovery, inline Wall updates/playback/filtering, errors, and responsive layouts. Live GPU inference requires the team's private notebook connection settings in `relay/.env.local`; those never belong in `VITE_` variables or Git.
