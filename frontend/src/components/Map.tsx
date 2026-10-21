"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { setWorkerUrl } from 'maplibre-gl';
import Map, { NavigationControl, Marker, Popup, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { Tent } from 'lucide-react';

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

  const [cursor, setCursor] = useState<string>('auto');
  const [hoveredSite, setHoveredSite] = useState<{
    name: string;
    state: string;
    longitude: number;
    latitude: number;
  } | null>(null);

  const hasSelectedSite = !!selectedCampsite;

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

  // Convert campsites array to WebGL-accelerated GeoJSON FeatureCollection
  const campsitesGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: "FeatureCollection",
      features: campsites.map((site) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [site.longitude, site.latitude]
        },
        properties: {
          id: site.id,
          name: site.name,
          state: site.state,
          management_type: site.management_type || "",
          dog_friendly: site.dog_friendly ?? null
        }
      }))
    };
  }, [campsites]);

  // Interactive click handler for WebGL layer
  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features && e.features[0];
    if (feature && feature.properties) {
      const siteId = Number(feature.properties.id);
      const site = campsites.find(c => c.id === siteId);
      if (site) {
        onSelectCampsite(site);
      }
    }
  }, [campsites, onSelectCampsite]);

  // Hover detection for interactive tooltip
  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features && e.features[0];
    if (feature && feature.properties) {
      setCursor('pointer');
      setHoveredSite({
        name: String(feature.properties.name),
        state: String(feature.properties.state),
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat
      });
    } else {
      setCursor('auto');
      setHoveredSite(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCursor('auto');
    setHoveredSite(null);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <Map
        ref={mapRef}
        {...viewState}
        cursor={cursor}
        interactiveLayerIds={['campsites-circles']}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: "100%", height: "100%" }}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      >
        <NavigationControl position="bottom-right" />

        {/* High-Performance WebGL GeoJSON Layer for all ~3000 Campsites */}
        <Source id="campsites-source" type="geojson" data={campsitesGeoJson}>
          {/* Primary Crisp Campsite Circle Layer - Printed Field Guide Styling */}
          <Layer
            id="campsites-circles"
            type="circle"
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3, hasSelectedSite ? 2 : 3.5,
                8, hasSelectedSite ? 3 : 5,
                14, hasSelectedSite ? 5 : 8
              ],
              "circle-color": hasSelectedSite ? "rgba(47, 93, 80, 0.35)" : "#2F5D50",
              "circle-stroke-color": hasSelectedSite ? "rgba(244, 240, 230, 0.4)" : "#F4F0E6",
              "circle-stroke-width": hasSelectedSite ? 0.75 : 1.25,
              "circle-opacity": hasSelectedSite ? 0.35 : 0.95
            }}
          />
        </Source>

        {/* Selected Campsite: Printed-Map Crosshair Target Marker */}
        {selectedCampsite && (
          <Marker 
            longitude={selectedCampsite.longitude} 
            latitude={selectedCampsite.latitude}
            style={{ zIndex: 40 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectCampsite(selectedCampsite);
            }}
          >
            <div 
              className="relative flex items-center justify-center cursor-pointer group"
              title={`${selectedCampsite.name} (Selected)`}
              aria-label={`${selectedCampsite.name} (Selected)`}
            >
              {/* Printed crosshair ticks */}
              <span className="absolute w-7 h-[1px] bg-ink/70 pointer-events-none" />
              <span className="absolute h-7 w-[1px] bg-ink/70 pointer-events-none" />
              {/* 10px eucalypt ring, 2px paper stroke with Tent icon */}
              <div className="relative w-7 h-7 rounded-full bg-eucalypt text-paper border-2 border-paper shadow-md flex items-center justify-center transition-transform group-hover:scale-105">
                <Tent className="w-3.5 h-3.5 text-paper stroke-[2.2]" />
              </div>
            </div>
          </Marker>
        )}

        {/* Lightweight Hover Tooltip for Quick Campsite Discovery */}
        {hoveredSite && !selectedCampsite && (
          <Popup
            longitude={hoveredSite.longitude}
            latitude={hoveredSite.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={14}
            className="z-30 pointer-events-none"
          >
            <div className="bg-paper-card text-ink text-xs px-2.5 py-1.5 rounded-sm border border-paper-rule shadow-md flex items-center gap-1.5 font-sans">
              <span className="font-medium text-ink">{hoveredSite.name}</span>
              <span className="text-[10px] bg-eucalypt-tint text-eucalypt px-1 py-0.5 rounded-sm border border-eucalypt/30 uppercase font-mono tracking-wider">
                {hoveredSite.state}
              </span>
            </div>
          </Popup>
        )}

        {startLocation && (
          <Marker longitude={startLocation.longitude} latitude={startLocation.latitude}>
            <div className="w-3.5 h-3.5 bg-paper rounded-full shadow-md border-2 border-ink" />
          </Marker>
        )}

        {routeGeoJson && (
          <Source id="route" type="geojson" data={routeGeoJson}>
            {/* Ink casing line */}
            <Layer 
              id="route-line-casing" 
              type="line" 
              layout={{
                "line-join": "round",
                "line-cap": "round"
              }}
              paint={{
                "line-color": "#1A231E",
                "line-width": 6,
                "line-opacity": 0.35
              }}
            />
            {/* Clay route line */}
            <Layer 
              id="route-line" 
              type="line" 
              layout={{
                "line-join": "round",
                "line-cap": "round"
              }}
              paint={{
                "line-color": "#A65640",
                "line-width": 3,
                "line-opacity": 0.95
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}
