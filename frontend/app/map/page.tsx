"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "../../lib/firebase"; 
import { signOut, onAuthStateChanged, User } from "firebase/auth";

// --- DYNAMIC IMPORTS ---
const MapWithNoSSR = dynamic(() => import("../../components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 animate-pulse text-slate-400 font-bold">
      Harita Hazırlanıyor...
    </div>
  ),
});

export default function MapPage() {
  // --- STATE MANAGEMENT ---
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // --- AUTHENTICATION OBSERVER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // --- HANDLERS ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Çıkış hatası:", error);
    }
  };

  if (loading) return null;

  // --- RENDER COMPONENT ---
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden font-sans">
      <header className="h-20 bg-white border-b flex items-center justify-between px-8 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <Image 
            src="/uskkentaslogo-300x78.png" 
            alt="Üsküdar Kentaş Logo" 
            width={180} 
            height={47} 
            className="w-auto h-10 object-contain"
            priority
          />
        </div>

        {/* --- USER PROFILE & LOGOUT --- */}
        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden md:flex items-center gap-3 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-200">
                <Image 
                  src={user.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                  alt="Profil" 
                  fill
                  sizes="32px"
                  className="object-cover"
                  unoptimized // Harici Google URL'leri için optimizasyonu devre dışı bırakır
                />
              </div>
              <span className="text-sm font-bold text-slate-700">{user.displayName}</span>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="bg-red-50 text-red-600 px-6 py-2.5 rounded-2xl font-bold hover:bg-red-100 transition-all text-sm"
          >
            Güvenli Çıkış
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        {/* HATA BURADAYDI: user={user} prop'u kaldırıldı */}
        <MapWithNoSSR />
      </main>
    </div>
  );
}