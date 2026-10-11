import { memo } from 'react';
import { LANDMARK_IDS, MAP_FEATURES, MAP_SIZE, MEMORY_MALL_PATH } from './mapData';

export const CampusBasemap = memo(function CampusBasemap({ selected }: { selected?: string }) {
  return <svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} className="map-art" aria-hidden="true">
    <image href={`${import.meta.env.BASE_URL}maps/ucf-campus.svg`} width={MAP_SIZE.width} height={MAP_SIZE.height} />
    <g className="map-landmarks">
      {MAP_FEATURES.filter(feature => LANDMARK_IDS[feature.id]).map(feature => <path key={feature.id} d={feature.path} className={selected === LANDMARK_IDS[feature.id] ? 'selected' : undefined} />)}
      <path d={MEMORY_MALL_PATH} className={selected === 'memory-mall' ? 'selected' : undefined} />
    </g>
  </svg>;
});
