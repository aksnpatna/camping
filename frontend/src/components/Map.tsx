"use client";

import { useState, useEffect } from 'react';

import Map, { NavigationControl, Marker, Source, Layer } from 'react-map-gl/maplibre';

export interface Campsite {
  id: number;
  name: string;
  state: string;
  longitude: number;
  latitude: number;
  management_type?: string;
  dog_friendly?: boolean;
  rig_access?: string[];
  source_url?: string;
}

export default function CampingMap({ 
  campsites, 
  onSelectCampsite,
  routeGeoJson,
  startLocation
}: { 
  campsites: Campsite[], 
  onSelectCampsite: (site: Campsite) => void,
  routeGeoJson?: any,
  startLocation?: { longitude: number, latitude: number }
}) {
  const [viewState, setViewState] = useState({
    longitude: startLocation ? startLocation.longitude : 133.7751,
    latitude: startLocation ? startLocation.latitude : -25.2744,
    zoom: startLocation ? 5 : 4
  });



  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <Map
        {...viewState}
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
            <div className="w-5 h-5 bg-[var(--color-neon-green)] rounded-full shadow-[0_0_15px_var(--color-neon-green)] cursor-pointer hover:scale-125 transition-transform duration-300 border-2 border-[var(--color-forest-900)]"></div>
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
