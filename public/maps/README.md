# UCF geographic basemap

`ucf-campus.svg` is a locally rendered, north-up map made from real OpenStreetMap ways. It depicts roads, pedestrian paths, buildings, parking, green areas, and water. It uses no Google imagery, traced visitor-map artwork, tile service, or API key. Campus extent is chosen for the four generation waypoints; zoom and pan reveal neighboring features.

`ucf-osm.json` is the corresponding geographic extract, with original OSM way IDs and longitude/latitude coordinates. **© OpenStreetMap contributors**, available under the [Open Database License (ODbL 1.0)](https://opendatacommons.org/licenses/odbl/1-0/). Source: [OSM map API, UCF bounding box](https://api.openstreetmap.org/api/0.6/map?bbox=-81.210,28.595,-81.189,28.613). Extraction date and provenance are included in the JSON and SVG. The data is supplied as-is; updates to OSM after extraction are not automatic.

The separate official UCF layer in `src/timeMachine/campusGeography.json` contains waypoint coordinates and Memory Mall's polygon from [UCF's public campus location registry](https://www.map.ucf.edu/locations.json). That layer is credited to [UCF Campus Map](https://www.map.ucf.edu/), kept separate from the OSM extract, and rendered as an interactive overlay.

Regenerate from the project root with Node 22.18+ and network access:

```sh
node scripts/refresh-campus-map.mjs
```

The exporter and frontend share `src/timeMachine/mapProjection.ts`. SVG paths and HTML pin positions use the same projection and scale; the responsive viewport crops or pans the map instead of stretching its geography. Purple basemap colors live in the exporter's SVG stylesheet; selection highlights live in `timeMachine.css`. Regenerate after changing the exporter or projection, then run `npm test` and `npm run build`.
