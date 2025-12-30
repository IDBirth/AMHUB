import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Device } from '../types';

interface MapPickerProps {
  lat: number;
  lng: number;
  onLocationSelect: (lat: number, lng: number) => void;
  isMaximized?: boolean;
  devices?: Device[];
  flyTo?: { lat: number; lng: number };
}

// Mapbox Configuration
const MAPBOX_TOKEN = "pk.eyJ1IjoiYmlsYWxhbXQiLCJhIjoiY21qcHdmNjd1M2ljMTNncXh4OG10bjM1ZSJ9.DdrBIWn_ukTldrDk0_7oWg";
const STYLE_STREETS = "mapbox/streets-v12"; 
const STYLE_SATELLITE = "mapbox/satellite-streets-v12";

// Drone SVG Icon Definition
const getDroneSvg = (color: string) => {
  const c = color; 
  const id = color.replace('#', '');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><filter id="glow-${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#glow-${id})"><path d="M40 40 h20 v20 h-20 z" fill="${c}" /><path d="M40 40 L25 25" stroke="${c}" stroke-width="4" stroke-linecap="round" /><path d="M60 40 L75 25" stroke="${c}" stroke-width="4" stroke-linecap="round" /><path d="M40 60 L25 75" stroke="${c}" stroke-width="4" stroke-linecap="round" /><path d="M60 60 L75 75" stroke="${c}" stroke-width="4" stroke-linecap="round" /><circle cx="25" cy="25" r="8" stroke="${c}" stroke-width="2" fill="none" /><circle cx="75" cy="25" r="8" stroke="${c}" stroke-width="2" fill="none" /><circle cx="25" cy="75" r="8" stroke="${c}" stroke-width="2" fill="none" /><circle cx="75" cy="75" r="8" stroke="${c}" stroke-width="2" fill="none" /><path d="M15 25 h20 M25 15 v20" stroke="${c}" stroke-width="1" opacity="0.6" /><path d="M65 25 h20 M75 15 v20" stroke="${c}" stroke-width="1" opacity="0.6" /><path d="M15 75 h20 M25 65 v20" stroke="${c}" stroke-width="1" opacity="0.6" /><path d="M65 75 h20 M75 65 v20" stroke="${c}" stroke-width="1" opacity="0.6" /><path d="M45 35 L55 35 L50 25 Z" fill="${c}" /></g></svg>`;
};

export const MapPicker: React.FC<MapPickerProps> = ({ lat, lng, onLocationSelect, isMaximized, devices = [], flyTo }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Track existing device markers to update them instead of clearing
  const deviceMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);

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
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: false 
    });
    
    mapInstanceRef.current = map;

    const initialLayer = L.tileLayer(`https://api.mapbox.com/styles/v1/${isSatellite ? STYLE_SATELLITE : STYLE_STREETS}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`, {
      attribution: '© Mapbox © OpenStreetMap',
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 20
    }).addTo(map);

    tileLayerRef.current = initialLayer;

    const targetIcon = L.icon({
       iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
       shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
       iconSize: [25, 41],
       iconAnchor: [12, 41],
       popupAnchor: [1, -34],
       shadowSize: [41, 41]
    });

    const marker = L.marker([lat, lng], { icon: targetIcon, draggable: true }).addTo(map);
    marker.bindPopup("<div class='font-sans p-1'><b class='text-slate-800 uppercase text-[10px] tracking-widest'>Target Origin</b></div>").openPopup();
    
    marker.on('dragend', (e) => {
      const marker = e.target;
      const position = marker.getLatLng();
      onLocationSelect(position.lat, position.lng);
    });

    targetMarkerRef.current = marker;

    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
       const { lat, lng } = e.latlng;
       const safeLat = Number(lat.toFixed(6));
       const safeLng = Number(lng.toFixed(6));
       onLocationSelect(safeLat, safeLng);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      deviceMarkersRef.current.clear();
    };
  }, []); 

  useEffect(() => {
    if (mapInstanceRef.current) {
        if (tileLayerRef.current) {
            tileLayerRef.current.remove();
        }
        const newLayer = L.tileLayer(`https://api.mapbox.com/styles/v1/${isSatellite ? STYLE_SATELLITE : STYLE_STREETS}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`, {
            attribution: '© Mapbox © OpenStreetMap',
            tileSize: 512,
            zoomOffset: -1,
            maxZoom: 20
        }).addTo(mapInstanceRef.current);
        tileLayerRef.current = newLayer;
    }
  }, [isSatellite]);

  useEffect(() => {
    if (mapInstanceRef.current && targetMarkerRef.current) {
        const currentLatLng = targetMarkerRef.current.getLatLng();
        if (currentLatLng.lat !== lat || currentLatLng.lng !== lng) {
            targetMarkerRef.current.setLatLng([lat, lng]);
            if (mapInstanceRef.current.distance([lat, lng], currentLatLng) > 500) {
                mapInstanceRef.current.flyTo([lat, lng], mapInstanceRef.current.getZoom());
            }
        }
    }
  }, [lat, lng]);

  useEffect(() => {
    if (mapInstanceRef.current && flyTo) {
        mapInstanceRef.current.flyTo([flyTo.lat, flyTo.lng], 19, {
            animate: true,
            duration: 1.5
        });
    }
  }, [flyTo]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 300);
    }
  }, [isMaximized]);

  // Optimized Device Marker Updates with live coordinate display
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentMap = mapInstanceRef.current;
    const markersMap = deviceMarkersRef.current;
    const activeSns = new Set<string>();

    devices.forEach(device => {
        if (device.telemetry && (device.telemetry.latitude !== 0 || device.telemetry.longitude !== 0)) {
            const lat = device.telemetry.latitude;
            const lon = device.telemetry.longitude;
            const speed = device.telemetry.speed ?? 0;
            const height = device.telemetry.height ?? 0;
            const batt = device.telemetry.battery_percent ?? 0;
            const yaw = device.telemetry.yaw ?? 0;
            const flightTime = device.telemetry.flight_time ?? 0;
            const sn = device.device_sn;

            activeSns.add(sn);

            const m = Math.floor(flightTime / 60);
            const s = flightTime % 60;
            
            const statusBadge = device.status 
                ? '<span class="text-emerald-500 font-black text-[10px] tracking-wider uppercase">LINK ESTABLISHED</span>' 
                : '<span class="text-red-500 font-black text-[10px] tracking-wider uppercase">CONNECTION LOST</span>';

            const popupContent = `
                <div class="font-sans min-w-[220px] p-1">
                    <div class="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                         <div class="flex flex-col">
                           <h3 class="font-black text-slate-900 text-sm uppercase tracking-tight">${device.nickname}</h3>
                           <span class="text-[9px] text-slate-500 font-mono tracking-tighter">${device.device_model}</span>
                         </div>
                    </div>
                    ${statusBadge}
                    
                    <div class="mt-3 space-y-2 bg-slate-50 p-2 rounded border border-slate-200">
                        <div class="flex justify-between items-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Latitude</span>
                            <span class="font-mono text-[10px] font-bold text-slate-900">${lat.toFixed(7)}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Longitude</span>
                            <span class="font-mono text-[10px] font-bold text-slate-900">${lon.toFixed(7)}</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] text-slate-600 mt-3 pt-1 border-t border-slate-100">
                        <div class="flex flex-col"><span class="text-slate-400 text-[8px] font-black uppercase">Speed</span><span class="font-bold text-slate-800">${speed.toFixed(1)} m/s</span></div>
                        <div class="flex flex-col"><span class="text-slate-400 text-[8px] font-black uppercase">AGL Height</span><span class="font-bold text-slate-800">${height.toFixed(1)} m</span></div>
                        <div class="flex flex-col"><span class="text-slate-400 text-[8px] font-black uppercase">Battery</span><span class="${batt < 20 ? 'text-red-600 font-black' : 'font-bold text-slate-800'}">${batt}%</span></div>
                        <div class="flex flex-col"><span class="text-slate-400 text-[8px] font-black uppercase">Flight Time</span><span class="font-bold text-slate-800">${m}m ${s}s</span></div>
                    </div>
                    <div class="mt-2 pt-2 border-t border-slate-100 text-[8px] text-slate-400 font-mono flex justify-between">
                        <span>SIG: ${device.telemetry?.link_signal_quality}%</span>
                        <span>SN: ${device.device_sn}</span>
                    </div>
                </div>
            `;

            const createIcon = () => {
                const color = device.status ? '#10b981' : '#ef4444'; 
                const svgString = getDroneSvg(color);
                const encodedSvg = encodeURIComponent(svgString);
                
                return L.divIcon({
                    className: 'custom-drone-icon',
                    html: `<div style="transform: rotate(${yaw}deg); width: 48px; height: 48px; background-image: url('data:image/svg+xml;charset=utf-8,${encodedSvg}'); background-repeat: no-repeat; background-position: center; background-size: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); opacity: ${device.status ? 1 : 0.7}; transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);"></div>`,
                    iconSize: [48, 48],
                    iconAnchor: [24, 24],
                });
            };

            let marker = markersMap.get(sn);

            if (marker) {
                const currentLatLng = marker.getLatLng();
                if (currentLatLng.lat !== lat || currentLatLng.lng !== lon) {
                    marker.setLatLng([lat, lon]);
                }
                marker.setIcon(createIcon());
                if (marker.getPopup()?.isOpen()) {
                     marker.getPopup()?.setContent(popupContent);
                } else {
                    marker.bindPopup(popupContent, { minWidth: 230 });
                }
                marker.setZIndexOffset(device.status ? 1000 : 500);
            } else {
                marker = L.marker([lat, lon], { 
                    icon: createIcon(),
                    zIndexOffset: device.status ? 1000 : 500 
                });
                marker.bindPopup(popupContent, { minWidth: 230 });
                marker.addTo(currentMap);
                markersMap.set(sn, marker);
            }
        }
    });

    markersMap.forEach((marker, sn) => {
        if (!activeSns.has(sn)) {
            marker.remove();
            markersMap.delete(sn);
        }
    });

  }, [devices]);

  return (
    <div className="relative h-full w-full bg-slate-900 group">
      <div ref={mapContainerRef} className="h-full w-full z-0" />
      
      {/* Top Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-sm px-4">
        <form onSubmit={handleSearch} className="shadow-2xl">
          <div className="relative flex items-center">
             <input 
                type="text" 
                placeholder="Search target grid (GeoCode)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/90 backdrop-blur-xl text-slate-100 placeholder:text-slate-600 text-[11px] font-black uppercase tracking-widest px-5 py-3 pr-12 rounded-full border border-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
             />
             <button 
                type="submit" 
                disabled={isSearching}
                className="absolute right-4 text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-50"
             >
                {isSearching ? (
                   <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                )}
             </button>
          </div>
        </form>
      </div>

      {/* Map Control Cluster */}
      <div className="absolute top-4 right-1/4 translate-x-32 z-[1000] flex gap-2">
        <button 
          onClick={() => setIsSatellite(!isSatellite)}
          className={`
            flex items-center gap-2 backdrop-blur-xl border rounded-lg px-4 py-2 shadow-2xl transition-all active:scale-95 group
            ${isSatellite 
                ? 'bg-cyan-600 border-cyan-400 text-white' 
                : 'bg-slate-950/90 border-slate-800 text-slate-400 hover:text-slate-200'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 7m0 10V7" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            {isSatellite ? 'SATELLITE' : 'STREETS'}
          </span>
        </button>
      </div>
    </div>
  );
};
