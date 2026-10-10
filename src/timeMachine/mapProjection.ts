// North-up local projection: longitude distances are corrected by campus latitude.
// Shared by the SVG exporter and HTML waypoint overlay to keep their anchors aligned.
export const MAP_SIZE = { width: 1840, height: 1380 };
const WEST = -81.2116;
const NORTH = 28.6098;
const LONGITUDE_SCALE = Math.cos(28.6029 * Math.PI / 180);
export function projectCoordinate([longitude, latitude]: readonly number[]) {
  return { x: (longitude - WEST) * LONGITUDE_SCALE * 100000, y: (NORTH - latitude) * 100000 };
}
export function geographicPath(coordinates: readonly (readonly number[])[], closed: boolean) {
  return coordinates.map((coordinate, index) => {
    const point = projectCoordinate(coordinate);
    return `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(' ') + (closed ? 'Z' : '');
}
