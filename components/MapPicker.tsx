import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Device } from '../types';

interface MapPickerProps {
  lat: number;
  lng: number;
  onLocationSelect: (lat: number, lng: number) => void;
  isMaximized?: boolean;
  devices?: Device[];
  selectedDeviceSn?: string | null;
  onMapInteract?: () => void;
}

const MAPBOX_TOKEN = "pk.eyJ1IjoiYmlsYWxhbXQiLCJhIjoiY21qcHdmNjd1M2ljMTNncXh4OG10bjM1ZSJ9.DdrBIWn_ukTldrDk0_7oWg";
const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";
const MAPBOX_STYLE_SAT = "mapbox://styles/mapbox/satellite-streets-v12";

const getDroneSvg = (color: string) => `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow-${color.replace('#', '')}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <g filter="url(#glow-${color.replace('#', '')})">
    <path d="M40 40 h20 v20 h-20 z" fill="${color}" />
    <path d="M40 40 L25 25" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    <path d="M60 40 L75 25" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    <path d="M40 60 L25 75" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    <path d="M60 60 L75 75" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    <circle cx="25" cy="25" r="8" stroke="${color}" stroke-width="2" fill="none" />
    <circle cx="75" cy="25" r="8" stroke="${color}" stroke-width="2" fill="none" />
    <circle cx="25" cy="75" r="8" stroke="${color}" stroke-width="2" fill="none" />
    <circle cx="75" cy="75" r="8" stroke="${color}" stroke-width="2" fill="none" />
    <path d="M15 25 h20 M25 15 v20" stroke="${color}" stroke-width="1" opacity="0.6" />
    <path d="M65 25 h20 M75 15 v20" stroke="${color}" stroke-width="1" opacity="0.6" />
    <path d="M15 75 h20 M25 65 v20" stroke="${color}" stroke-width="1" opacity="0.6" />
    <path d="M65 75 h20 M75 65 v20" stroke="${color}" stroke-width="1" opacity="0.6" />
    <path d="M45 35 L55 35 L50 25 Z" fill="${color}" />
  </g>
</svg>
`;

const isDockDevice = (device: Device) => {
  if (device.domain === 3) return true;
  return device.device_model.toLowerCase().includes('dock');
};

export const MapPicker: React.FC<MapPickerProps> = ({
  lat,
  lng,
  onLocationSelect,
  isMaximized,
  devices = [],
  selectedDeviceSn,
  onMapInteract
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const targetMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const deviceMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [mapStyle, setMapStyle] = useState(MAPBOX_STYLE);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const newLat = parseFloat(result.lat);
        const newLng = parseFloat(result.lon);
        onLocationSelect(newLat, newLng);
      }
    } catch (err) {
      console.error("Geocoding failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      let token = MAPBOX_TOKEN;
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg?.mapbox_public_token) {
            token = cfg.mapbox_public_token;
          }
        }
      } catch {
        // Use embedded token
      }

      if (!isActive || !mapContainerRef.current) return;

      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: mapStyle,
        center: [lng, lat],
        zoom: 13
      });

      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

      map.on('click', () => {
        onMapInteract?.();
      });

      map.on('contextmenu', (e) => {
        onMapInteract?.();
        const safeLat = Number(e.lngLat.lat.toFixed(6));
        const safeLng = Number(e.lngLat.lng.toFixed(6));
        onLocationSelect(safeLat, safeLng);
      });

      const marker = new mapboxgl.Marker({ color: '#ef4444', draggable: true })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML("<b>Target Location</b><br>Incident Origin"))
        .addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        onLocationSelect(pos.lat, pos.lng);
      });

      targetMarkerRef.current = marker;
    };

    initMap();

    return () => {
      isActive = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.resize();
      }, 300);
    }
  }, [isMaximized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !targetMarkerRef.current) return;

    const current = targetMarkerRef.current.getLngLat();
    if (current.lat !== lat || current.lng !== lng) {
      targetMarkerRef.current.setLngLat([lng, lat]);
      const delta = Math.abs(current.lat - lat) + Math.abs(current.lng - lng);
      if (delta > 0.005) {
        map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13) });
      }
    }
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    deviceMarkersRef.current.forEach((marker) => marker.remove());
    deviceMarkersRef.current.clear();

    const createDroneMarkerEl = (heading: number, isOnline: boolean, isSelected: boolean) => {
      const baseColor = isOnline ? '#4ade80' : '#ef4444';
      const color = isSelected && isOnline ? '#22c55e' : baseColor;
      const svgString = getDroneSvg(color);
      const encodedSvg = encodeURIComponent(svgString);

      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          transform: rotate(${heading}deg); 
          width: 48px; 
          height: 48px; 
          background-image: url('data:image/svg+xml;charset=utf-8,${encodedSvg}');
          background-repeat: no-repeat;
          background-position: center;
          background-size: contain;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)) ${isSelected && isOnline ? 'drop-shadow(0 0 8px rgba(34,197,94,0.8))' : ''};
          opacity: ${isOnline ? 1 : 0.7};
        "></div>
      `;
      el.style.pointerEvents = 'auto';
      return el;
    };

    const createDockMarkerEl = (isOnline: boolean) => {
      const el = document.createElement('div');
      const fill = isOnline ? '#22c55e' : '#64748b';
      const border = isOnline ? '#86efac' : '#94a3b8';
      el.innerHTML = `
        <div style="
          width: 18px;
          height: 18px;
          border-radius: 3px;
          background: ${fill};
          border: 2px solid ${border};
          box-shadow: 0 0 8px rgba(0,0,0,0.35);
          opacity: ${isOnline ? 1 : 0.7};
        "></div>
      `;
      el.style.pointerEvents = 'auto';
      return el;
    };

    devices.forEach((device) => {
      if (!device.telemetry) return;
      const lat = device.telemetry.latitude ?? 0;
      const lon = device.telemetry.longitude ?? 0;
      if (lat === 0 && lon === 0) return;

      const speed = device.telemetry.speed ?? 0;
      const height = device.telemetry.height ?? 0;
      const batt = device.telemetry.battery_percent ?? 0;
      const yaw = device.telemetry.yaw ?? 0;
      const flightTime = device.telemetry.flight_time ?? 0;

      const m = Math.floor(flightTime / 60);
      const s = flightTime % 60;
      const statusBadge = device.status
        ? '<span class="text-green-500 font-bold text-[10px] uppercase">ONLINE</span>'
        : '<span class="text-red-500 font-bold text-[10px] uppercase">OFFLINE</span>';

      const isDock = isDockDevice(device);
      const isSelected = Boolean(selectedDeviceSn && device.device_sn === selectedDeviceSn);
      const el = isDock
        ? createDockMarkerEl(device.status)
        : createDroneMarkerEl(yaw, device.status, isSelected);

      el.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      const popupContent = isDock ? `
        <div class="font-sans min-w-[160px]">
          <div class="flex justify-between items-center border-b pb-1 mb-2">
            <div class="flex flex-col">
              <h3 class="font-bold text-slate-800 text-sm">${device.nickname}</h3>
              <span class="text-[9px] text-slate-500 font-mono">Dock</span>
            </div>
          </div>
          ${statusBadge}
          <div class="grid grid-cols-2 gap-y-1 text-xs text-slate-600 mt-2">
            <span class="font-semibold">Height:</span>
            <span>${height.toFixed(1)} m</span>
          </div>
          <div class="mt-2 pt-2 border-t text-[9px] text-slate-400 font-mono">SN: ${device.device_sn}</div>
        </div>
      ` : `
        <div class="font-sans min-w-[180px]">
          <div class="flex justify-between items-center border-b pb-1 mb-2">
            <div class="flex flex-col">
              <h3 class="font-bold text-slate-800 text-sm">${device.nickname}</h3>
              <span class="text-[9px] text-slate-500 font-mono">${device.device_model}</span>
            </div>
          </div>
          ${statusBadge}
          <div class="grid grid-cols-2 gap-y-1 text-xs text-slate-600 mt-2">
            <span class="font-semibold">Speed:</span>
            <span>${speed.toFixed(1)} m/s</span>
            <span class="font-semibold">Height:</span>
            <span>${height.toFixed(1)} m</span>
            <span class="font-semibold">Battery:</span>
            <span class="${batt < 20 ? 'text-red-600 font-bold' : ''}">${batt}%</span>
            ${device.status ? `
            <span class="font-semibold">Flight Time:</span>
            <span>${m}m ${s}s</span>
            ` : ''}
          </div>
          <div class="mt-2 pt-2 border-t text-[9px] text-slate-400 font-mono">SN: ${device.device_sn}</div>
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setHTML(popupContent))
        .addTo(map);

      deviceMarkersRef.current.set(device.device_sn, marker);
    });
  }, [devices, selectedDeviceSn]);

  useEffect(() => {
    if (!mapRef.current || !selectedDeviceSn) return;
    const target = devices.find((device) => device.device_sn === selectedDeviceSn);
    if (!target?.telemetry) return;
    const lat = target.telemetry.latitude ?? 0;
    const lon = target.telemetry.longitude ?? 0;
    if (lat === 0 && lon === 0) return;
    mapRef.current.flyTo({ center: [lon, lat], zoom: Math.max(mapRef.current.getZoom(), 15) });
  }, [devices, selectedDeviceSn]);

  return (
    <div className="relative h-full w-full group">
      <div ref={mapContainerRef} className="h-full w-full z-0" />
      
      <form onSubmit={handleSearch} className="absolute top-4 left-4 z-[400] w-64 shadow-xl">
        <div className="relative flex items-center">
           <input 
              type="text" 
              placeholder="Search target location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full panel-strong text-[color:var(--text)] placeholder:text-[color:var(--muted)] text-xs px-3 py-2 pr-8 rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] shadow-sm"
           />
           <button 
              type="submit" 
              disabled={isSearching}
              className="absolute right-2 muted-text hover:text-[color:var(--accent)] transition-colors disabled:opacity-50"
           >
              {isSearching ? (
                 <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
           </button>
        </div>
      </form>

      <div className="absolute bottom-4 left-4 z-[400] flex gap-2">
        <button
          type="button"
          onClick={() => setMapStyle(MAPBOX_STYLE)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors ${
            mapStyle === MAPBOX_STYLE ? 'accent-chip' : 'panel-strong text-[color:var(--text)]'
          }`}
        >
          Streets
        </button>
        <button
          type="button"
          onClick={() => setMapStyle(MAPBOX_STYLE_SAT)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors ${
            mapStyle === MAPBOX_STYLE_SAT ? 'accent-chip' : 'panel-strong text-[color:var(--text)]'
          }`}
        >
          Satellite
        </button>
      </div>
    </div>
  );
};
