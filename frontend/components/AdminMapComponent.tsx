"use client";
import { useEffect, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server"; 
import { Lightbulb, LightbulbOff, Zap, Sun, Siren, Flame, Lamp, LampDesk, LampFloor, LampWallUp, Flashlight } from "lucide-react"; 
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { FeatureCollection, Feature, Geometry } from "geojson";

// --- CONSTANTS ---
const uskudarBounds: L.LatLngBoundsExpression = [
  [40.985, 28.980], 
  [41.070, 29.100]  
];

// --- INTERFACES ---
interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  description: string | null;
  neighborhood: string | null;
  status: string;
}

interface AdminMapProps {
  markers?: MarkerData[]; 
  borderColor?: string;
  markerColor?: string;
  markerIcon?: string; 
}

interface LeafletCluster {
  getChildCount: () => number;
}

// --- MAIN COMPONENT ---
export default function AdminMapComponent({ 
  markers = [], 
  borderColor = "#4f46e5", 
  markerColor = "#f43f5e", 
  markerIcon = "lightbulb" 
}: AdminMapProps) {
  
  // --- STATE MANAGEMENT ---
  const [isMounted, setIsMounted] = useState(false);
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    setIsMounted(true); 
    fetch("/export.geojson")
      .then(res => res.json())
      .then((data: FeatureCollection) => {
        if (data && Array.isArray(data.features)) setGeoData(data);
      })
      .catch(err => console.error("GeoJSON hatası:", err));
  }, []);

  if (!isMounted || typeof window === "undefined") {
    return (
      <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center text-slate-500 rounded-[2rem] border border-slate-800">
        <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Harita Modülü Hazırlanıyor...</span>
      </div>
    );
  }

  // --- HELPER FUNCTIONS ---
  function MapController() {
    const map = useMap();
    useEffect(() => { 
      if (map.attributionControl) map.attributionControl.setPrefix(""); 
    }, [map]);
    return null;
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "lightbulbOff": return LightbulbOff;
      case "zap": return Zap;
      case "sun": return Sun;
      case "siren": return Siren;
      case "flame": return Flame;
      case "lamp": return Lamp;
      case "lampDesk": return LampDesk;
      case "lampFloor": return LampFloor;
      case "lampWall": return LampWallUp;
      case "flashlight": return Flashlight;
      default: return Lightbulb;
    }
  };

  const getCustomIcon = (status: string) => {
    const fillCol = status === "Çözüldü" ? "#fbbf24" : markerColor; 
    const SelectedIcon = getIconComponent(markerIcon);
    
    const iconHTML = renderToStaticMarkup(
      <div className="flex items-center justify-center">
        <SelectedIcon color={fillCol} size={28} strokeWidth={2.5} fill={status === "Çözüldü" ? fillCol : "transparent"} />
      </div>
    );
    return L.divIcon({ html: iconHTML, className: "bg-transparent border-none", iconSize: [28, 28], iconAnchor: [14, 28] });
  };

  const createClusterCustomIcon = (cluster: LeafletCluster) => {
    const count = cluster.getChildCount();
    return L.divIcon({
      html: `<div style="width: 40px; height: 40px; background-color: ${markerColor};" class="text-white border-2 border-white/50 shadow-xl flex items-center justify-center rounded-full font-black text-xs">${count}</div>`,
      className: "custom-marker-cluster",
      iconSize: L.point(40, 40, true),
    });
  };

  const isNight = new Date().getHours() >= 18 || new Date().getHours() <= 6;
  const tileUrl = isNight 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  // --- RENDER MAP ---
  return (
    <div className="h-full w-full rounded-[2rem] overflow-hidden border border-slate-800 relative z-0 bg-slate-950">
      <MapContainer 
        center={[41.0246, 29.0143]} 
        zoom={13} 
        minZoom={12} 
        maxBounds={uskudarBounds} 
        maxBoundsViscosity={1.0}
        preferCanvas={true} 
        className="h-full w-full outline-none"
      >
        <TileLayer url={tileUrl} />
        
        {geoData && (
          <GeoJSON 
            key={`border-${borderColor}`} 
            data={geoData} 
            filter={(f: Feature<Geometry>) => f.geometry.type !== "Point"}
            style={{ color: borderColor, weight: 3, fillOpacity: 0.05 }} 
          />
        )}
        
        <MapController />

        <MarkerClusterGroup 
          key={`cluster-${markerColor}`} 
          chunkedLoading 
          iconCreateFunction={createClusterCustomIcon} 
          maxClusterRadius={50}
        >
          {markers.map((m: MarkerData) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={getCustomIcon(m.status)}>
              <Popup>
                <div className="p-2 text-center text-xs font-bold text-slate-700">
                  <p className="mb-1 uppercase text-indigo-600 border-b border-slate-100 pb-1">{m.neighborhood || "Üsküdar"}</p>
                  <p className="text-[10px] text-slate-500">{m.description}</p>
                  <div className="mt-2 px-2 py-1 bg-slate-100 rounded-lg">Durum: {m.status}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}