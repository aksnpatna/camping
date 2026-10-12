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
  selectedState,
  selectedCampsite
}: { 
  campsites: Campsite[], 
  onSelectCampsite: (site: Campsite) => void,
  routeGeoJson?: GeoJSON.Geometry | GeoJSON.Feature | null,
  startLocation?: { longitude: number, latitude: number },
  selectedState?: string | null,
  selectedCampsite?: Campsite | null
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
        
        {campsites.map((site) => {
          const isSelected = selectedCampsite?.id === site.id;
          return (
            <Marker 
              key={site.id} 
              longitude={site.longitude} 
              latitude={site.latitude}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectCampsite(site);
              }}
            >
              {isSelected ? (
                <div className="relative flex items-center justify-center cursor-pointer">
                  <div className="absolute w-8 h-8 rounded-full bg-red-500/40 animate-ping"></div>
                  <div className="w-6 h-6 bg-red-600 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.9)] border-2 border-white flex items-center justify-center text-[10px] text-white font-black z-10 scale-110 transition-transform">
                    ⛺
                  </div>
                </div>
              ) : (
                <div className="w-5 h-5 bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.6)] cursor-pointer hover:scale-125 transition-transform duration-300 border-2 border-emerald-900"></div>
              )}
            </Marker>
          );
        })}

        {startLocation && (
          <Marker longitude={startLocation.longitude} latitude={startLocation.latitude}>
            <div className="w-4 h-4 bg-white rounded-full shadow-lg border-2 border-[var(--color-forest-900)]"></div>
          </Marker>
        )}

        {routeGeoJson && (
          <Source id="route" type="geojson" data={routeGeoJson}>
            {/* Outer red casing for contrast on dark map */}
            <Layer 
              id="route-line-casing" 
              type="line" 
              layout={{
                "line-join": "round",
                "line-cap": "round"
              }}
              paint={{
                "line-color": "#7f1d1d",
                "line-width": 7,
                "line-opacity": 0.6
              }}
            />
            {/* Distinct Red Route Trace */}
            <Layer 
              id="route-line" 
              type="line" 
              layout={{
                "line-join": "round",
                "line-cap": "round"
              }}
              paint={{
                "line-color": "#ef4444",
                "line-width": 4.5,
                "line-opacity": 0.95
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}
