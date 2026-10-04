"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, FormEvent, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Lightbulb,
  Loader2,
  X,
  Camera,
  Phone,
  MapPin,
  ShieldAlert,
  Clock,
  Lamp,
  LampWallUp,
  Flashlight,
  Zap,
  Siren,
  LightbulbOff,
  Sun,
  Flame,
  LampDesk,
  LampFloor,
} from "lucide-react";
// @ts-ignore
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as turf from "@turf/turf";
import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
  Geometry,
  LineString,
} from "geojson";

// --- INTERFACES ---
interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  description: string | null;
  neighborhood: string | null;
  street: string | null;
  contactInfo?: string | null;
  status: string;
  eta: string;
}

interface LeafletCluster {
  getChildCount: () => number;
}

interface CustomWindow extends Window {
  L?: { map?: { instances?: L.Map[] } };
}

// --- CONSTANTS ---
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// --- HELPER FUNCTIONS ---
const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case "lightbulbOff":
      return LightbulbOff;
    case "zap":
      return Zap;
    case "sun":
      return Sun;
    case "siren":
      return Siren;
    case "flame":
      return Flame;
    case "lamp":
      return Lamp;
    case "lampDesk":
      return LampDesk;
    case "lampFloor":
      return LampFloor;
    case "lampWall":
      return LampWallUp;
    case "flashlight":
      return Flashlight;
    default:
      return Lightbulb;
  }
};

const getMarkerIcon = (
  status: string,
  zoom: number,
  globalColor: string,
  globalIcon: string,
) => {
  const isSolved = status === "Çözüldü";
  const color = isSolved ? "#fbbf24" : globalColor;
  const SelectedIcon = getIconComponent(globalIcon);
  const size = zoom > 15 ? (zoom - 15) * 8 + 22 : (zoom - 10) * 4 + 5;

  const iconHTML = renderToStaticMarkup(
    <div
      className={`relative flex items-center justify-center ${isSolved ? "animate-pulse" : ""}`}
    >
      {isSolved && (
        <div
          className="absolute inset-0 bg-yellow-400 blur-xl opacity-20 rounded-full"
          style={{ width: size, height: size }}
        ></div>
      )}
      <SelectedIcon
        color={color}
        size={size}
        strokeWidth={2.5}
        fill={isSolved ? "#fbbf24" : "transparent"}
      />
    </div>,
  );

  return L.divIcon({
    html: iconHTML,
    className: "bg-transparent border-none",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

const getUserIcon = () => {
  const iconHTML = renderToStaticMarkup(
    <div className="flex items-center justify-center w-[18px] h-[18px] bg-[#1a73e8] border-[2.5px] border-white rounded-full shadow-md"></div>,
  );
  return L.divIcon({
    html: iconHTML,
    className: "bg-transparent",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

function MapController({
  setZoom,
  onLocationFound,
}: {
  setZoom: (z: number) => void;
  onLocationFound: (pos: L.LatLng) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (map.attributionControl) map.attributionControl.setPrefix("");
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
    map.on("locationfound", (e) => onLocationFound(e.latlng));
    map.on("locationerror", () => {
      map.setView([41.0267, 29.0151], 14);
    });
  }, [map, onLocationFound]);

  useMapEvents({ zoomend: (e) => setZoom(e.target.getZoom()) });
  return null;
}

// --- MAIN COMPONENT ---
export default function MapComponent() {
  // --- STATE MANAGEMENT ---
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [userLocation, setUserLocation] = useState<L.LatLng | null>(null);
  const [tempLocation, setTempLocation] = useState<{
    lat: number;
    lng: number;
    street: string;
    neighborhood: string;
  } | null>(null);

  const [globalMarkerColor, setGlobalMarkerColor] = useState("#f43f5e");
  const [globalMarkerIcon, setGlobalMarkerIcon] = useState("lightbulb");
  const [globalBorderColor, setGlobalBorderColor] = useState("#4f46e5");

  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [photo, setPhoto] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoom, setZoom] = useState(14);
  const [showWarning, setShowWarning] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const uskudarBounds: L.LatLngBoundsExpression = [
    [40.985, 28.98],
    [41.07, 29.1],
  ];
  const isNight = new Date().getHours() >= 18 || new Date().getHours() <= 6;

  const tileUrl = isNight
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_49f0_1_af17ef0abca14aab7a02c4c4"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_49f0_1_af17ef0abca14aab7a02c4c4";
  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, markersRes] = await Promise.all([
        fetch(`${API_URL}/settings`),
        fetch(`${API_URL}/markers`),
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData) {
          setGlobalMarkerColor(settingsData.markerColor || "#f43f5e");
          setGlobalMarkerIcon(settingsData.markerIcon || "lightbulb");
          setGlobalBorderColor(settingsData.borderColor || "#4f46e5");
        }
      }

      if (markersRes.ok) {
        const markersData: MarkerData[] = await markersRes.json();
        setMarkers(markersData.filter((m) => m.status !== "Çözüldü"));
      }
    } catch (err) {
      console.error("Veri çekme hatası:", err);
    }
  }, []);

  useEffect(() => {
    fetch("/export.geojson")
      .then((res) => res.json())
      .then((data: FeatureCollection) => setGeoData(data));
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- FORM SUBMISSION ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !tempLocation) return;

    setIsSubmitting(true);
    try {
      const payload = {
        lat: tempLocation.lat,
        lng: tempLocation.lng,
        description: description || "Belirtilmedi",
        contactInfo: contactInfo || "Belirtilmedi",
        street: tempLocation.street,
        neighborhood: tempLocation.neighborhood,
        imageData: photo || null,
        status: "İncelemede",
        eta: "Belirlenmedi",
        isTest: false,
      };

      const response = await fetch(`${API_URL}/markers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setTempLocation(null);
        setPhoto("");
        setDescription("");
        setContactInfo("");
        fetchData();
      } else {
        const errorData = await response.json();
        console.error("Kayıt oluşturulamadı:", errorData);
      }
    } catch (err) {
      console.error("İstek Hatası:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- MAP CLUSTER RENDERING ---
  const createClusterIcon = (cluster: LeafletCluster) => {
    const count = cluster.getChildCount();
    return L.divIcon({
      html: `<div style="background-color: ${globalMarkerColor};" class="w-8 h-8 md:w-10 md:h-10 text-white border-2 border-white/50 shadow-lg flex items-center justify-center rounded-full font-black text-[10px]">${count}</div>`,
      className: "custom-marker-cluster",
      iconSize: L.point(40, 40, true),
    });
  };

  // --- MAP EVENTS & GEOSPATIAL ANALYSIS ---
  const MapEvents = () => {
    useMapEvents({
      async click(e) {
        if (isValidating) return;
        setIsValidating(true);
        setTempLocation(null);

        const clickedPt = turf.point([e.latlng.lng, e.latlng.lat]);
        let inside = false;
        geoData?.features.forEach((f) => {
          if (
            turf.booleanPointInPolygon(
              clickedPt,
              f as Feature<Polygon | MultiPolygon>,
            )
          )
            inside = true;
        });

        if (!inside) {
          setShowWarning("boundary");
          setTimeout(() => setShowWarning(null), 4000);
          setIsValidating(false);
          return;
        }

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.latlng.lat}&lon=${e.latlng.lng}&zoom=18&polygon_geojson=1`,
          );
          const data = await res.json();
          const addr = data.address || {};

          const isGreenArea =
            data.category === "leisure" ||
            data.category === "natural" ||
            data.category === "landuse" ||
            addr.park ||
            addr.forest;
          const isBuilding = data.category === "building" || addr.building;
          const isHighway =
            data.category === "highway" ||
            data.class === "highway" ||
            addr.road ||
            addr.street ||
            addr.pedestrian;

          if (isGreenArea) {
            setShowWarning("green_area");
          } else if (isBuilding) {
            setShowWarning("building");
          } else if (isHighway && data.geojson) {
            let distance = 999;

            if (data.geojson.type.includes("LineString")) {
              distance = turf.pointToLineDistance(
                clickedPt,
                data.geojson as Feature<LineString>,
                { units: "meters" },
              );
            } else if (
              data.geojson.type.includes("Polygon") &&
              turf.booleanPointInPolygon(
                clickedPt,
                data.geojson as Feature<Polygon | MultiPolygon>,
              )
            ) {
              distance = 0;
            }

            if (distance <= 15) {
              const roadName =
                addr.road || addr.pedestrian || addr.street || "İsimsiz Sokak";
              const suburbName =
                addr.suburb || addr.neighbourhood || addr.village || "Üsküdar";
              setTempLocation({
                lat: e.latlng.lat,
                lng: e.latlng.lng,
                street: roadName,
                neighborhood: suburbName,
              });
            } else {
              setShowWarning("no_lamp");
            }
          } else {
            setShowWarning("no_lamp");
          }
        } catch (err) {
          console.error("Zemin analiz hatası:", err);
          setShowWarning("error");
        } finally {
          setIsValidating(false);
          setTimeout(() => setShowWarning(null), 4000);
        }
      },
    });
    return null;
  };

  const handleGoToUserLocation = () => {
    if (userLocation && typeof window !== "undefined") {
      const customWindow = window as unknown as CustomWindow;
      const mapInstance = customWindow.L?.map?.instances?.[0];
      if (mapInstance) {
        mapInstance.setView(userLocation, 16);
      }
    }
  };

  // --- COMPONENT RENDER ---
  return (
    <div className="h-full w-full relative overflow-hidden bg-slate-950 font-sans">
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[4000] pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3 py-2 md:px-4 md:py-3 rounded-2xl shadow-xl border border-white/50">
          <img
            src="/uskkentaslogo-300x78.png"
            alt="Kentaş Logo"
            className="h-8 md:h-10 w-auto"
          />
        </div>
      </div>

      <MapContainer
        center={[41.0246, 29.0143]}
        zoom={14}
        minZoom={13}
        maxBounds={uskudarBounds}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer url={tileUrl} />
        {geoData && (
          <GeoJSON
            key={`border-${globalBorderColor}`}
            data={geoData}
            filter={(f: Feature<Geometry>) => f.geometry.type !== "Point"}
            style={{ color: globalBorderColor, weight: 3, fillOpacity: 0.01 }}
          />
        )}

        <MapEvents />
        <MapController setZoom={setZoom} onLocationFound={setUserLocation} />

        <MarkerClusterGroup
          key={`cluster-${globalMarkerColor}`}
          chunkedLoading
          iconCreateFunction={createClusterIcon}
        >
          {markers.map((m) => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={getMarkerIcon(
                m.status,
                zoom,
                globalMarkerColor,
                globalMarkerIcon,
              )}
            >
              <Popup>
                <div className="p-3 min-w-[160px] flex flex-col items-center text-center gap-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                    <ShieldAlert size={16} className="text-slate-500" />
                  </div>
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">
                    Aydınlatma Arızası
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase">
                    {m.street}
                  </span>

                  <div className="w-full bg-emerald-50 border border-emerald-100 py-2 px-1 rounded-xl flex items-center justify-center gap-1.5">
                    <Clock size={12} className="text-emerald-600" />
                    <span className="text-[9px] font-black text-emerald-700 uppercase">
                      {m.eta || "Süre Bekleniyor"}
                    </span>
                  </div>

                  <div
                    className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest w-full text-white ${m.status === "Ekip Yollandı" ? "bg-blue-600" : "bg-slate-900"}`}
                  >
                    {m.status}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {userLocation && (
          <Marker position={userLocation} icon={getUserIcon()} />
        )}

        {tempLocation && (
          <Marker
            position={[tempLocation.lat, tempLocation.lng]}
            icon={L.divIcon({
              className:
                "bg-indigo-600 w-4 h-4 rounded-full border-[3px] border-white shadow-lg animate-pulse",
            })}
          >
            <Popup>
              <div className="w-[260px] overflow-hidden rounded-2xl bg-white m-[-1px] shadow-2xl border border-slate-200">
                <div className="bg-slate-900 px-4 py-2 flex justify-between items-center text-white">
                  <span className="font-black text-[9px] uppercase tracking-widest italic">
                    {tempLocation.street}
                  </span>
                  <X
                    className="w-4 h-4 cursor-pointer"
                    onClick={() => setTempLocation(null)}
                  />
                </div>
                <form
                  onSubmit={handleSubmit}
                  className="p-4 flex flex-col gap-3"
                >
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer bg-slate-50 hover:bg-indigo-50 transition-colors">
                    {photo ? (
                      <img
                        src={photo}
                        alt="Önizleme"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Camera size={18} className="text-slate-400" />
                        <span className="text-[8px] font-black text-slate-400 uppercase">
                          Fotoğraf Ekle
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const r = new FileReader();
                          r.onloadend = () => setPhoto(r.result as string);
                          r.readAsDataURL(f);
                        }
                      }}
                    />
                  </label>

                  <div className="relative">
                    <Phone
                      size={14}
                      className="absolute left-3 top-2.5 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="İletişim (Telefon/E-posta)"
                      className="w-full text-[10px] pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      value={contactInfo}
                      onChange={(e) => setContactInfo(e.target.value)}
                    />
                  </div>

                  <textarea
                    placeholder="Sorunu kısaca tarif edin..."
                    className="text-[10px] p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-16 resize-none outline-none"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white text-[9px] py-3 rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      "ARIZA BİLDİR"
                    )}
                  </button>
                </form>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* --- WARNING MESSAGES --- */}
      <div
        className={`absolute top-20 left-1/2 -translate-x-1/2 z-[3000] transition-all duration-500 w-[90vw] md:w-auto ${showWarning ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10 pointer-events-none"}`}
      >
        <div className="bg-white px-5 py-4 rounded-[2rem] shadow-2xl border border-rose-100 flex items-center gap-4">
          <div className="w-10 h-10 flex-shrink-0 bg-rose-500 text-white rounded-full flex items-center justify-center font-black text-lg shadow-lg italic">
            !
          </div>
          <div className="flex flex-col flex-1">
            <span className="font-black text-[10px] text-rose-600 uppercase tracking-widest mb-1">
              Uyarı
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">
              {showWarning === "boundary"
                ? "Lütfen Üsküdar sınırları içinde kalın."
                : showWarning === "green_area"
                  ? "Yeşil alanlara/Parklara bildirim yapılamaz."
                  : showWarning === "building"
                    ? "Binaların üzerine bildirim yapılamaz."
                    : "Burada arıza bildirebileceğiniz bir sokak lambası bulunmuyor."}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleGoToUserLocation}
        className="absolute bottom-6 right-6 z-[4000] bg-white p-3 rounded-2xl shadow-xl border border-slate-200 text-slate-700 hover:text-indigo-600 transition-all active:scale-95"
      >
        <MapPin size={24} />
      </button>

      {isValidating && (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-slate-900/10 backdrop-blur-[2px]">
          <div className="bg-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 border border-indigo-100">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">
              Zemin Analiz Ediliyor...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
