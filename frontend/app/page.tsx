"use client";

import dynamic from "next/dynamic";
import { Loader2, Lightbulb } from "lucide-react";

// --- DYNAMIC IMPORTS ---
const MapComponent = dynamic(() => import("@/components/MapComponent"), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center relative shadow-2xl">
        <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 rounded-3xl animate-pulse" />
        <Lightbulb className="text-yellow-400 w-10 h-10 relative z-10" />
      </div>
      <div className="flex items-center gap-3 text-indigo-400 font-black uppercase tracking-widest text-xs mt-4">
        <Loader2 className="animate-spin" size={16} /> Harita Yükleniyor...
      </div>
    </div>
  )
});

// --- MAIN COMPONENT ---
export default function Home(): React.JSX.Element {
  return (
    <main className="w-full h-screen">
      <MapComponent />
    </main>
  );
}