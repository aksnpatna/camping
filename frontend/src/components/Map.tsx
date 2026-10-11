"use client";

import { useState, useEffect, useRef } from 'react';
import { setWorkerUrl } from 'maplibre-gl';
import Map, { NavigationControl, Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';

if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
}

const STATE_CENTERS: Record<string, { longitude: number, latitude: number, zoom: number }> = {
  NSW: { longitude: 147.0, latitude: -32.5, zoom: 6 },
  VIC: { longitude: 145.0, latitude: -37.0, zoom: 6.5 },
  QLD: { longitude: 145.5, latitude: -21.5, zoom: 5 },
  WA: { longitude: 121.5, latitude: -26.0, zoom: 5 },
  SA: { longitude: 136.0, latitude: -31.5, zoom: 5.5 },
  TAS: { longitude: 146.8, latitude: -42.0, zoom: 7 },
  NT: { longitude: 133.5, latitude: -19.5, zoom: 5 },
  ACT: { longitude: 149.1, latitude: -35.4, zoom: 9.5 },
  JBT: { longitude: 150.7, latitude: -35.15, zoom: 11 },
};

export interface Campsite {
  id: number;
  name: string;
  state: string;
  longitude: number;
  latitude: number;
  management_type?: string;
  dog_friendly?: boolean;
  rig_access?: string[];
  booking_url?: string;
  facilities?: Record<string, unknown>;
  fees?: string;
  source_url?: string;
}

export default function CampingMap({ 
  campsites, 
  onSelectCampsite,
  routeGeoJson,
  startLocation,
  selectedState
}: { 
  campsites: Campsite[], 
  onSelectCampsite: (site: Campsite) => void,
  routeGeoJson?: GeoJSON.Geometry | GeoJSON.Feature | null,
  startLocation?: { longitude: number, latitude: number },
  selectedState?: string | null
}) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: 133.7751,
    latitude: -25.2744,
    zoom: 4
  });

  useEffect(() => {
    if (selectedState && STATE_CENTERS[selectedState] && mapRef.current) {
      const center = STATE_CENTERS[selectedState];
      mapRef.current.flyTo({
        center: [center.longitude, center.latitude],
        zoom: center.zoom,
        duration: 1200
      });
    }
  }, [selectedState]);

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <Map
        ref={mapRef}
        {...viewState}
        style={{ width: "100%", height: "100%" }}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      >
        <NavigationControl position="bottom-right" />
        
        {campsites.map((site) => (
          <Marker 
            key={site.id} 
            longitude={site.longitude} 
            latitude={site.latitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectCampsite(site);
            }}
          >
            <div className="w-5 h-5 bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.6)] cursor-pointer hover:scale-125 transition-transform duration-300 border-2 border-emerald-900"></div>
          </Marker>
        ))}

        {startLocation && (
          <Marker longitude={startLocation.longitude} latitude={startLocation.latitude}>
            <div className="w-4 h-4 bg-white rounded-full shadow-lg border-2 border-[var(--color-forest-900)]"></div>
          </Marker>
        )}

        {routeGeoJson && (
          <Source id="route" type="geojson" data={routeGeoJson}>
            <Layer 
              id="route-line" 
              type="line" 
              layout={{
                "line-join": "round",
                "line-cap": "round"
              }}
              paint={{
                "line-color": "#00ff9d",
                "line-width": 4,
                "line-opacity": 0.8
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}
