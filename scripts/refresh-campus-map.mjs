// Fetch a small, offline-ready OSM extract. UCF's public location registry supplies
// waypoint anchors and Memory Mall's boundary; it remains a separate source layer.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { geographicPath, MAP_SIZE, projectCoordinate } from '../src/timeMachine/mapProjection.ts';

const osmUrl = 'https://api.openstreetmap.org/api/0.6/map?bbox=-81.210,28.595,-81.189,28.613';
const ucfUrl = 'https://www.map.ucf.edu/locations.json';
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}
const local = process.argv[2] === '--from-files';
const [xml, locationsText] = await Promise.all(local
  ? [readFile(process.argv[3], 'utf8'), readFile(process.argv[4], 'utf8')]
  : [download(osmUrl), download(ucfUrl)]);
const decode = text => text.replace(/&(amp|quot|apos|lt|gt);/g, (_, key) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[key]);
const attributes = text => Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(match => [match[1], decode(match[2])]));
const nodes = new Map([...xml.matchAll(/<node\s+([^>]+)>?/g)].map(match => {
  const node = attributes(match[1]);
  return [node.id, [Number(node.lon), Number(node.lat)]];
}));
const ways = [...xml.matchAll(/<way\s+([^>]+)>([\s\S]*?)<\/way>/g)].map(match => ({
  id: attributes(match[1]).id,
  tags: Object.fromEntries([...match[2].matchAll(/<tag\s+([^>]+)\/?\s*>/g)].map(tag => {
    const { k, v } = attributes(tag[1]); return [k, v];
  })),
  coordinates: [...match[2].matchAll(/<nd\s+ref="(\d+)"\s*\/>/g)].map(node => nodes.get(node[1])),
}));
function layer(tags) {
  if (tags.building && tags.building !== 'no') return 'buildings';
  if (tags.natural === 'water' || tags.water || tags.amenity === 'fountain') return 'water';
  if (tags.amenity === 'parking') return 'parking';
  if (/^(wood|scrub|grassland|wetland)$/.test(tags.natural) || /^(forest|grass|meadow|recreation_ground)$/.test(tags.landuse) || /^(park|garden|pitch)$/.test(tags.leisure)) return 'greenery';
  if (tags.highway) return /^(footway|path|pedestrian|steps|cycleway|bridleway)$/.test(tags.highway) ? 'paths' : 'roads';
}
const features = ways.flatMap(way => {
  const kind = layer(way.tags);
  if (!kind || way.coordinates.length < 2 || way.coordinates.some(point => !point || !point.every(Number.isFinite))) return [];
  return [{ id: way.id, layer: kind, name: way.tags.name || '', detail: way.tags.highway || '', closed: way.coordinates[0][0] === way.coordinates.at(-1)[0] && way.coordinates[0][1] === way.coordinates.at(-1)[1], coordinates: way.coordinates }];
});
const locations = JSON.parse(locationsText);
const ids = ['memorymall', '52', '2', '360', '40', '91', '120', '80', '26'];
const anchors = ids.map(id => {
  const location = locations.find(location => location.id === id);
  if (!location?.googlemap_point?.every(Number.isFinite)) throw new Error(`Missing official anchor ${id}`);
  return { id, name: location.name, coordinates: [location.googlemap_point[1], location.googlemap_point[0]] };
});
// UCF's registry has no entry for the cypress dome. Its boardwalk (the team's CYP_Inside.jpg) is OSM way
// 334887933 (bridge=boardwalk) through the scrub between the Student Union and Memory Mall; the anchor is
// that way's middle node. Not OSM's "Cypress Trail", which is on the far east side of campus.
const boardwalk = features.find(feature => feature.id === '334887933');
if (!boardwalk) throw new Error('Missing cypress dome boardwalk (OSM way 334887933)');
anchors.push({ id: 'cypress-dome', name: 'Cypress Dome boardwalk (OSM way 334887933)', coordinates: boardwalk.coordinates[Math.floor(boardwalk.coordinates.length / 2)] });
const mall = locations.find(location => location.id === 'memorymall');
if (features.length < 500 || !features.some(feature => feature.name === 'Student Union') || !mall?.poly_coords?.length) throw new Error('Incomplete campus data');
// OSM outlines highlighted for selected waypoints; keep in sync with LANDMARK_IDS in mapData.ts.
const landmarkIds = ['154245264', '154245274', '272718812', '307647104', '307646411', '827224010', '154245252', '154245217', '334882442'];
const fetched = new Date().toISOString().slice(0, 10);
const osmData = { fetched, source: osmUrl, license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', features };
const data = {
  fetched,
  osm: { source: osmUrl, license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', landmarks: features.filter(feature => landmarkIds.includes(feature.id)) },
  ucf: { source: ucfUrl, attribution: 'UCF Campus Map', anchors, memoryMall: mall.poly_coords },
};
const escapeXml = text => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const layers = ['greenery', 'parking', 'water', 'paths', 'roads', 'buildings'];
const shapes = layers.map(layer => `<g class="${layer}">${features.filter(feature => feature.layer === layer).map(feature => `<path id="osm-way-${feature.id}" d="${geographicPath(feature.coordinates, feature.closed)}"${feature.detail === 'service' ? ' class="service"' : ''}/>`).join('')}</g>`).join('\n');
const labelNames = {
  'Lake Claire': 'LAKE CLAIRE', 'Engineering I': 'ENG I', 'Engineering II': 'ENG II',
  'Business Administration I': 'BA I', 'Business Administration II': 'BA II',
  'L3Harris Engineering Center': 'HEC', 'Parking Garage C': 'GARAGE C',
};
const labels = features.flatMap(feature => {
  const label = labelNames[feature.name];
  if (!label || !feature.closed) return [];
  const points = feature.coordinates.slice(0, -1);
  const center = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map(value => value / points.length);
  const { x, y } = projectCoordinate(center);
  return [`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle">${escapeXml(label)}</text>`];
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}">
<title>University of Central Florida main campus</title>
<desc>North-up map from real OpenStreetMap road, footpath, building and water geometry.</desc>
<metadata>© OpenStreetMap contributors; ODbL-1.0 https://opendatacommons.org/licenses/odbl/1-0/ ; ${escapeXml(osmUrl)} ; extracted ${fetched}</metadata>
<style>
.greenery{fill:#151515;stroke:#2b2b2b;stroke-width:.6}.parking{fill:#1d1d1d;stroke:#3d3b34;stroke-width:1}
.water{fill:#262626;stroke:#61615a;stroke-width:1.5}.paths{fill:none;stroke:#736b53;stroke-width:1.4;opacity:.65}
.roads{fill:none;stroke:#545247;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}.roads .service{stroke:#3a3a35;stroke-width:4}
.buildings{fill:#252525;stroke:#737064;stroke-width:1}.labels{fill:#cfc6aa;font:11px Consolas,monospace;letter-spacing:1px;paint-order:stroke;stroke:#090909;stroke-width:3px;stroke-linejoin:round}
</style><rect width="${MAP_SIZE.width}" height="${MAP_SIZE.height}" fill="#090909"/>
${shapes}<g class="labels">${labels}</g></svg>\n`;
await mkdir(new URL('../public/maps/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/maps/ucf-campus.svg', import.meta.url), svg);
await writeFile(new URL('../public/maps/ucf-osm.json', import.meta.url), JSON.stringify(osmData) + '\n');
await writeFile(new URL('../src/timeMachine/campusGeography.json', import.meta.url), JSON.stringify(data) + '\n');
console.log(`Saved ${features.length} OSM features and ${anchors.length} UCF waypoint anchors.`);
