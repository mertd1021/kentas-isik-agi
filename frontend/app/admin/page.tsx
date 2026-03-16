"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useMemo, FormEvent, useCallback } from "react";
import dynamic from "next/dynamic";
import { 
  LayoutDashboard, Table as TableIcon, Map as MapIcon, BarChart3, 
  Trash2, Phone, Clock, Loader2, Activity, Settings2, X, Filter, 
  Lightbulb, Zap, Siren, Users, UserPlus,
  Lamp, LampWallUp, Flashlight, AlertTriangle, Mail, KeyRound, CheckCircle2, ShieldAlert
} from "lucide-react"; 

import { auth } from "@/lib/firebase"; 
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut, signInWithEmailAndPassword, updatePassword } from "firebase/auth"; 
import * as turf from "@turf/turf";
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from "geojson";

const AdminMap = dynamic(() => import('@/components/AdminMapComponent'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const ETA_OPTIONS = ["Belirlenmedi", "1 Saat İçinde", "2 Saat İçinde", "6 Saat İçinde", "12 Saat İçinde", "24 Saat İçinde", "2 Gün İçinde", "1 Hafta", "Uzun Vadeli"];
const COLOR_PALETTE = ["#4f46e5", "#10b981", "#f43f5e", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308", "#0f172a", "#ffffff"];

// --- CONSTANTS ---
const SUPER_ADMIN_EMAIL = "mert36.demirbas@gmail.com";

const isSuperAdmin = (email: string | null | undefined) => {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase();
};

// --- INTERFACES ---
interface MarkerData { 
  id: string; lat: number; lng: number; description: string | null; 
  neighborhood: string | null; street: string | null; contactInfo?: string | null; 
  status: string; eta: string; isTest?: boolean; imageData?: string | null; 
  createdAt?: string | number | Date; 
}

interface AdminUser { id: string; name: string; email: string; role: string; createdAt: string; }

export default function AdminDashboard() {
  // --- STATE MANAGEMENT ---
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"table" | "map" | "stats" | "admins">("table");
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [stressMarkers, setStressMarkers] = useState<MarkerData[]>([]); 
  const [dbAdmins, setDbAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("Tümü");
  const [filterHood, setFilterHood] = useState<string>("Tümü");
  
  const [borderColor, setBorderColor] = useState("#4f46e5"); 
  const [markerColor, setMarkerColor] = useState("#f43f5e"); 
  const [markerIcon, setMarkerIcon] = useState("lightbulb"); 

  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const [passwordModal, setPasswordModal] = useState({ isOpen: false, adminEmail: "" });
  const [oldPasswordInput, setOldPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isDanger?: boolean; }>({ isOpen: false, title: "", message: "", onConfirm: () => {}, isDanger: true });
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: "success" | "error" | "info"; }>({ isOpen: false, title: "", message: "", type: "info" });

  // --- AUTHENTICATION OBSERVER ---
  useEffect(() => {
    document.title = "Işık Ağı Yönetimi - Kentaş";
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.replace("/login"); 
      } else {
        setCurrentUserEmail(user.email);
        setIsAuthChecking(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const getAuthToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  }, []);

  // --- DATA FETCHING ---
  const fetchInitialData = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const [resSettings, resMarkers] = await Promise.all([
        fetch(`${API_URL}/settings`),
        fetch(`${API_URL}/markers`)
      ]);

      if (resSettings.ok) {
        const dataSettings = await resSettings.json();
        setBorderColor(dataSettings.borderColor || "#4f46e5");
        setMarkerColor(dataSettings.markerColor || "#f43f5e");
        setMarkerIcon(dataSettings.markerIcon || "lightbulb");
      }

      if (resMarkers.ok) {
        const dataMarkers = await resMarkers.json();
        setMarkers(Array.isArray(dataMarkers) ? dataMarkers : []);
      }

      if (token) {
        const resAdmins = await fetch(`${API_URL}/admins`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (resAdmins.ok) {
          const dataAdmins = await resAdmins.json();
          setDbAdmins(Array.isArray(dataAdmins) ? dataAdmins : []);
        }
      }
    } catch (err) {
      console.error("Veri çekme hatası:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (!isAuthChecking) {
      fetchInitialData();
      const interval = setInterval(fetchInitialData, 30000); 
      return () => clearInterval(interval);
    }
  }, [fetchInitialData, isAuthChecking]);

  // --- HANDLERS ---
  const handleUpdateSettings = async (field: string, value: string) => {
    if (field === "borderColor") setBorderColor(value);
    if (field === "markerColor") setMarkerColor(value);
    if (field === "markerIcon") setMarkerIcon(value);

    try {
      const token = await getAuthToken();
      await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ [field]: value })
      });
    } catch (err) {
      console.error("Ayarlar kaydedilemedi:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.replace("/login"); 
    } catch (err) {
      console.error("Çıkış hatası:", err);
    }
  };

  // --- MEMOIZED DATA ---
  const allMarkers = useMemo(() => [...(markers || []), ...(stressMarkers || [])], [markers, stressMarkers]);
  const uniqueNeighborhoods = useMemo(() => { const hoods = new Set(allMarkers.map(m => m.neighborhood).filter(Boolean)); return Array.from(hoods).sort(); }, [allMarkers]);
  const filteredTableMarkers = useMemo(() => { return allMarkers.filter(m => { const matchStatus = filterStatus === "Tümü" || m.status === filterStatus; const matchHood = filterHood === "Tümü" || m.neighborhood === filterHood; return matchStatus && matchHood; }); }, [allMarkers, filterStatus, filterHood]);

  const neighborhoodStats = useMemo(() => {
    const stats: Record<string, { total: number, solved: number }> = {};
    allMarkers.forEach(m => { const hood = m.neighborhood || "Bilinmeyen Bölge"; if (!stats[hood]) stats[hood] = { total: 0, solved: 0 }; stats[hood].total += 1; if (m.status === "Çözüldü") stats[hood].solved += 1; });
    return Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
  }, [allMarkers]);

  // --- MARKER OPERATIONS ---
  const updateMarker = async (id: string, field: string, value: string, isTest?: boolean) => {
    if (isTest) {
      setStressMarkers(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
      return;
    }
    const previousMarkers = [...markers];
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/markers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ [field]: value })
      });
      if (!res.ok) throw new Error("Update failed");
    } catch (err) { 
      console.error(err);
      setMarkers(previousMarkers);
      setAlertModal({ isOpen: true, title: "Hata", message: "Güncelleme yapılamadı.", type: "error" });
    }
  };

  const handleDelete = (id: string, isTest?: boolean) => {
    setConfirmModal({
      isOpen: true, title: "Kayıt Sil", message: "Bu kaydı silmek istediğinize emin misiniz?", isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        if (isTest) {
          setStressMarkers(prev => prev.filter(m => m.id !== id));
        } else {
          const previousMarkers = [...markers];
          setMarkers(prev => prev.filter(m => m.id !== id));
          try { 
            const token = await getAuthToken();
            await fetch(`${API_URL}/markers/${id}`, { 
              method: "DELETE",
              headers: { "Authorization": `Bearer ${token}` }
            });
          } catch (err) { 
            console.error(err);
            setMarkers(previousMarkers);
          }
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedRows.length === 0) return;
    setConfirmModal({
      isOpen: true, title: "Toplu Silme", message: `${selectedRows.length} kaydı silmek üzeresiniz.`, isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const realIds = selectedRows.filter(id => !id.toString().startsWith("test-"));
        if (realIds.length > 0) {
          try {
            const token = await getAuthToken();
            await Promise.all(realIds.map(id => fetch(`${API_URL}/markers/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` }})));
            fetchInitialData();
          } catch (err) { console.error(err); }
        }
        setSelectedRows([]);
      }
    });
  };

  const toggleRowSelection = (id: string) => setSelectedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  const toggleAllSelection = () => setSelectedRows(selectedRows.length === filteredTableMarkers.length ? [] : filteredTableMarkers.map(m => m.id));

  // --- ADMIN OPERATIONS ---
  const handleDeleteAdmin = (id: string, email: string) => {
    setConfirmModal({
      isOpen: true, title: "Yönetici Sil", message: `${email} yetkilisini sistemden tamamen silmek istediğinize emin misiniz?`, isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try { 
          const token = await getAuthToken();
          const res = await fetch(`${API_URL}/admins/${id}`, { 
            method: "DELETE",
            headers: { 
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
          });
          if(res.ok){
            setAlertModal({ isOpen: true, title: "Başarılı", message: "Yönetici kalıcı olarak silindi.", type: "success" });
            fetchInitialData();
          } else {
            const errData = await res.json();
            setAlertModal({ isOpen: true, title: "Hata", message: errData.hata || "Yönetici silinemedi.", type: "error" });
          }
        } catch (err) { 
          console.error(err);
          setAlertModal({ isOpen: true, title: "Hata", message: "İşlem sırasında bir hata oluştu.", type: "error" });
        }
      }
    });
  };

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setIsAddingAdmin(true);
    try {
      const secondaryApp = getApps().find(app => app.name === "Secondary") || initializeApp(auth.app.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, newAdminEmail, newAdminPassword);
      await secondaryAuth.signOut();
      
      const token = await getAuthToken();
      await fetch(`${API_URL}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: newAdminName, email: newAdminEmail, password: "hidden", role: "Yönetici" })
      });

      setNewAdminName(""); setNewAdminEmail(""); setNewAdminPassword("");
      setAlertModal({isOpen: true, title: "Başarılı!", message: "Yönetici başarıyla eklendi.", type: "success"});
      fetchInitialData(); 
    } catch (err) { 
      console.error(err);
      setAlertModal({isOpen: true, title: "Hata", message: "İşlem başarısız. Bu e-posta kullanılıyor olabilir.", type: "error"});
    }
    setIsAddingAdmin(false);
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setIsPasswordChanging(true);
    try {
      const secondaryApp = getApps().find(app => app.name === "Secondary") || initializeApp(auth.app.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCred = await signInWithEmailAndPassword(secondaryAuth, passwordModal.adminEmail, oldPasswordInput);
      await updatePassword(userCred.user, newPasswordInput);
      await secondaryAuth.signOut();
      
      setPasswordModal({ isOpen: false, adminEmail: "" });
      setOldPasswordInput("");
      setNewPasswordInput("");
      setAlertModal({ isOpen: true, title: "Başarılı", message: "Şifre güvenlik kalkanı geçildi ve başarıyla güncellendi.", type: "success" });
    } catch(err: unknown) {
      console.error(err);
      setAlertModal({ isOpen: true, title: "Güvenlik İhlali", message: "Girdiğiniz mevcut şifre yanlış. İşlem reddedildi.", type: "error" });
    } finally {
      setIsPasswordChanging(false);
    }
  };

  // --- STRESS TEST ---
  const runStressTest = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/export.geojson");
      const geoDataJson: FeatureCollection = await res.json();
      const polygonFeature = geoDataJson.features.find((f: Feature) => 
        f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
      );

      if (!polygonFeature) throw new Error("Poligon verisi bulunamadı.");

      const fakeData: MarkerData[] = [];
      const targetCount = 5000;
      let attempts = 0;

      while (fakeData.length < targetCount && attempts < 250000) {
        const rLat = 41.005 + Math.random() * 0.055; 
        const rLng = 29.010 + Math.random() * 0.060;
        const pt = turf.point([rLng, rLat]);
        
        if (turf.booleanPointInPolygon(pt, polygonFeature as Feature<Polygon | MultiPolygon>)) {
          fakeData.push({ 
            id: `test-${Date.now()}-${fakeData.length}`, 
            lat: rLat, lng: rLng, 
            description: "Performans Test Verisi", 
            neighborhood: "Test Bölgesi", street: "Test Sokak", 
            status: "İncelemede", eta: "Belirlenmedi", isTest: true 
          });
        }
        attempts++;
      }
      setStressMarkers(fakeData);
    } catch (err) { 
      console.error("Test Hatası:", err); 
    }
    setIsLoading(false);
  };

  // --- RENDER COMPONENT ---
  if (isAuthChecking) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20 relative">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 md:px-8 py-4 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30"><LayoutDashboard size={20} /></div>
            <div><h1 className="text-sm md:text-lg font-black uppercase tracking-widest text-white leading-tight">Üsküdar Işık Ağı Yönetimi</h1><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Kentaş Operasyon Merkezi</span></div>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50 flex flex-col items-center"><span className="text-xs text-slate-400 font-bold uppercase">Aktif Çağrı</span><span className="text-lg font-black text-rose-400">{allMarkers.filter(m => m.status !== "Çözüldü").length}</span></div>
            <div className="bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50 flex flex-col items-center"><span className="text-xs text-slate-400 font-bold uppercase">Çözülen</span><span className="text-lg font-black text-emerald-400">{allMarkers.filter(m => m.status === "Çözüldü").length}</span></div>
            <button onClick={handleLogout} className="bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20">Çıkış Yap</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <div className="flex bg-slate-900 p-2 rounded-2xl border border-slate-800 w-full md:w-fit mb-8 shadow-lg overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab("table")} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "table" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"}`}><TableIcon size={16} /> Veri Tablosu</button>
          <button onClick={() => setActiveTab("map")} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "map" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"}`}><MapIcon size={16} /> Harita Ayarları</button>
          <button onClick={() => setActiveTab("stats")} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "stats" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"}`}><BarChart3 size={16} /> Bölge Analizi</button>
          <button onClick={() => setActiveTab("admins")} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "admins" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"}`}><Users size={16} /> Yetkililer</button>
        </div>

        {activeTab === "table" && (
            <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-indigo-400"><Filter size={16} /></div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-slate-950 border border-slate-700 text-xs font-bold uppercase p-2.5 rounded-xl outline-none text-white"><option value="Tümü">Tüm Durumlar</option><option value="İncelemede">İncelemede</option><option value="Ekip Yollandı">Ekip Yollandı</option><option value="Çözüldü">Çözüldü</option></select>
                <select value={filterHood} onChange={(e) => setFilterHood(e.target.value)} className="bg-slate-950 border border-slate-700 text-xs font-bold uppercase p-2.5 rounded-xl outline-none text-white max-w-[200px]"><option value="Tümü">Tüm Konumlar</option>{uniqueNeighborhoods.map(hood => <option key={hood as string} value={hood as string}>{hood as string}</option>)}</select>
              </div>
              {selectedRows.length > 0 && (<button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg animate-in fade-in zoom-in"><Trash2 size={16} /> Seçili ({selectedRows.length}) Kaydı Sil</button>)}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-black tracking-widest">
                      <th className="p-5 w-10 text-center"><input type="checkbox" onChange={toggleAllSelection} checked={filteredTableMarkers.length > 0 && selectedRows.length === filteredTableMarkers.length} className="w-4 h-4 rounded border-slate-700 text-indigo-600 bg-slate-900 cursor-pointer" /></th>
                      <th className="p-5">Detay & Foto</th><th className="p-5">İletişim & Konum</th><th className="p-5">Durum & Ekip</th><th className="p-5">Çözüm Süresi (ETA)</th><th className="p-5 text-right">Tekil İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredTableMarkers.length === 0 ? (<tr><td colSpan={6} className="p-10 text-center text-slate-500 font-bold uppercase">Kayıt bulunamadı.</td></tr>) : (
                      filteredTableMarkers.map(m => (
                        <tr key={m.id} className={`hover:bg-slate-800/20 transition-colors ${selectedRows.includes(m.id) ? 'bg-indigo-900/10' : ''}`}>
                          <td className="p-5 text-center"><input type="checkbox" checked={selectedRows.includes(m.id)} onChange={() => toggleRowSelection(m.id)} className="w-4 h-4 rounded border-slate-700 text-indigo-600 bg-slate-900 cursor-pointer" /></td>
                          <td className="p-5 flex items-center gap-4">
                            {m.imageData ? <img src={m.imageData} alt="Foto" onClick={() => setSelectedImage(m.imageData as string)} className="w-12 h-12 object-cover rounded-xl cursor-pointer hover:opacity-80 border border-slate-700 shrink-0" /> : <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-700"><Lightbulb size={20} className="text-slate-600"/></div>}
                            <div className="max-w-[200px] whitespace-normal"><div className="text-xs font-bold text-white mb-1">{m.description || "Açıklama Yok"}</div><div className="text-[9px] text-slate-500 uppercase">{m.isTest ? "Test Verisi" : "Kullanıcı Kaydı"}</div></div>
                          </td>
                          <td className="p-5"><div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 mb-1"><Phone size={12}/> {m.contactInfo || "Belirtilmedi"}</div><div className="text-[10px] text-slate-400 uppercase">{m.neighborhood || "Sokak:"} {m.street}</div></td>
                          <td className="p-5"><select value={m.status} onChange={(e) => updateMarker(m.id, "status", e.target.value, m.isTest)} className="bg-slate-950 border border-slate-700 text-[10px] font-black uppercase p-2.5 rounded-xl outline-none cursor-pointer text-white"><option value="İncelemede">İncelemede</option><option value="Ekip Yollandı">Ekip Yollandı</option><option value="Çözüldü">Çözüldü</option></select></td>
                          <td className="p-5"><div className="flex items-center gap-2"><Clock size={14} className="text-slate-500" /><select value={m.eta || "Belirlenmedi"} onChange={(e) => updateMarker(m.id, "eta", e.target.value, m.isTest)} className="bg-slate-950 border border-slate-700 text-[10px] font-bold p-2.5 rounded-xl outline-none cursor-pointer text-emerald-400">{ETA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div></td>
                          <td className="p-5 text-right"><button onClick={() => handleDelete(m.id, m.isTest)} className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all"><Trash2 size={16} /></button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "map" && (
            <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-6 bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
              <div className="flex-[2] grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full"><h3 className="text-sm font-black uppercase text-white flex items-center gap-2 border-b border-slate-800 pb-2"><Settings2 size={16} /> Harita Görünüm Ayarları</h3></div>
                <div><label className="text-xs font-bold text-slate-400 block mb-3">Sınır Çizgisi Rengi</label><div className="flex flex-wrap gap-2">{COLOR_PALETTE.map(color => (<button key={`border-${color}`} onClick={() => handleUpdateSettings("borderColor", color)} className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${borderColor === color ? "scale-125 border-white shadow-lg" : "border-transparent"}`} style={{ backgroundColor: color }}></button>))}</div></div>
                <div><label className="text-xs font-bold text-slate-400 block mb-3">Arıza İkonu Rengi</label><div className="flex flex-wrap gap-2">{COLOR_PALETTE.map(color => (<button key={`marker-${color}`} onClick={() => handleUpdateSettings("markerColor", color)} className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${markerColor === color ? "scale-125 border-white shadow-lg" : "border-transparent"}`} style={{ backgroundColor: color }}></button>))}</div></div>
                <div className="col-span-full mt-2">
                  <label className="text-xs font-bold text-slate-400 block mb-3">Arıza İkonu Tipi</label>
                  <div className="flex flex-wrap gap-3">
                    {[{ id: "lightbulb", icon: <Lightbulb size={20}/>, label: "Lamba" }, { id: "lamp", icon: <Lamp size={20}/>, label: "Sokak" }, { id: "lampWall", icon: <LampWallUp size={20}/>, label: "Duvar" }, { id: "flashlight", icon: <Flashlight size={20}/>, label: "Fener" }, { id: "zap", icon: <Zap size={20}/>, label: "Elektrik" }, { id: "siren", icon: <Siren size={20}/>, label: "Uyarı" }].map(item => (
                      <button key={item.id} onClick={() => handleUpdateSettings("markerIcon", item.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border ${markerIcon === item.id ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800"}`}>{item.icon} {item.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-6 flex flex-col justify-center">
                <h3 className="text-sm font-black uppercase text-white flex items-center gap-2 mb-4"><Activity size={16} /> Performans Testi</h3>
                <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">Harita kümeleme kapasitesini test etmek için anında <strong>5000 adet</strong> sahte kayıt üretir.</p>
                <button onClick={runStressTest} disabled={isLoading} className="bg-slate-800 hover:bg-indigo-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border border-slate-700">{isLoading ? <Loader2 className="animate-spin" /> : "5000 Kayıt Üret"}</button>
              </div>
            </div>
            <div className="h-[600px] w-full rounded-[2rem] overflow-hidden shadow-2xl relative"><AdminMap markers={allMarkers} borderColor={borderColor} markerColor={markerColor} markerIcon={markerIcon} /></div>
          </div>
        )}

        {activeTab === "stats" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {neighborhoodStats.map(([hood, data]) => {
              const solveRate = Math.round((data.solved / data.total) * 100) || 0;
              return (
                <div key={hood} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full group-hover:scale-110 transition-transform"></div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4">{hood}</h3>
                  <div className="flex justify-between items-end mb-6"><div className="flex flex-col"><span className="text-xs font-bold text-slate-500 uppercase">Toplam Çağrı</span><span className="text-3xl font-black text-indigo-400">{data.total}</span></div><div className="flex flex-col text-right"><span className="text-xs font-bold text-slate-500 uppercase">Çözülen</span><span className="text-xl font-black text-emerald-400">{data.solved}</span></div></div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full transition-all duration-1000 relative" style={{ width: `${solveRate}%` }}></div></div>
                  <div className="text-[10px] font-bold text-slate-400 mt-2 text-right">% {solveRate} Çözüm Oranı</div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === "admins" && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-1/3 bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl h-fit">
              <h3 className="text-sm font-black uppercase text-white flex items-center gap-2 mb-6 border-b border-slate-800 pb-4"><UserPlus size={18} className="text-indigo-400" /> Yeni Yönetici Ekle</h3>
              <form onSubmit={handleAddAdmin} className="flex flex-col gap-4">
                <input type="text" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Ad Soyad" className="w-full bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl py-3 px-4 outline-none focus:border-indigo-500" required />
                <div className="relative"><Mail size={16} className="absolute left-4 top-3.5 text-slate-500" /><input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="E-Posta" className="w-full bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl py-3 pl-12 pr-4 outline-none focus:border-indigo-500" required /></div>
                <div className="relative"><KeyRound size={16} className="absolute left-4 top-3.5 text-slate-500" /><input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} placeholder="Şifre (Min 6 karakter)" minLength={6} className="w-full bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl py-3 pl-12 pr-4 outline-none focus:border-indigo-500" required /></div>
                <button type="submit" disabled={isAddingAdmin} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">{isAddingAdmin ? <Loader2 className="animate-spin" size={16}/> : "Yönetici Hesabı Oluştur"}</button>
              </form>
            </div>
            <div className="lg:w-2/3 bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between"><h3 className="text-sm font-black uppercase text-white flex items-center gap-2"><Users size={18} className="text-emerald-400" /> Aktif Yöneticiler</h3></div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left whitespace-nowrap">
                  <thead><tr className="bg-slate-950/50 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-black tracking-widest"><th className="p-5">Yönetici Adı</th><th className="p-5">E-Posta</th><th className="p-5">Görev</th><th className="p-5 text-right">İşlemler</th></tr></thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {dbAdmins.length === 0 ? (
                      <tr><td colSpan={4} className="p-10 text-center text-slate-500 font-bold uppercase text-[10px]">Yönetici bulunamadı veya yükleniyor...</td></tr>
                    ) : (
                      dbAdmins.map(adm => (
                        <tr key={adm.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-5 text-xs font-bold text-white">{adm.name}</td>
                          <td className="p-5 text-xs text-slate-400 italic">{adm.email}</td>
                          <td className="p-5">
                            {isSuperAdmin(adm.email) ? (
                              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase rounded-full border border-emerald-500/20 flex items-center w-fit gap-1"><ShieldAlert size={12}/> Kurucu Yönetici</span>
                            ) : (
                              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase rounded-full border border-indigo-500/20">{adm.role}</span>
                            )}
                          </td>
                          <td className="p-5 flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setPasswordModal({ isOpen: true, adminEmail: adm.email })}
                              className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white text-[10px] font-black uppercase rounded-lg transition-colors flex items-center gap-1"
                            >
                              <KeyRound size={12} /> Şifre Değiştir
                            </button>
                            {isSuperAdmin(currentUserEmail) && !isSuperAdmin(adm.email) && (
                              <button 
                                onClick={() => handleDeleteAdmin(adm.id, adm.email)}
                                className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white text-[10px] font-black uppercase rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Trash2 size={12} /> Sil
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 z-[8000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 md:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-5"><KeyRound size={32} /></div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Şifre Güvenliği</h3>
            <p className="text-[10px] text-slate-400 mb-6 text-center italic">İşlemi tamamlamak için <span className="text-indigo-400 font-bold">{passwordModal.adminEmail}</span> hesabının mevcut şifresini girmelisiniz.</p>
            <form onSubmit={handlePasswordChange} className="w-full flex flex-col gap-4">
              <input type="password" placeholder="Eski (Mevcut) Şifre" value={oldPasswordInput} onChange={(e) => setOldPasswordInput(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl py-3 px-4 outline-none focus:border-indigo-500" />
              <input type="password" placeholder="Yeni Şifre (Min 6 Karakter)" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} required minLength={6} className="w-full bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl py-3 px-4 outline-none focus:border-indigo-500" />
              <div className="flex gap-3 w-full mt-2">
                <button type="button" onClick={() => {setPasswordModal({isOpen: false, adminEmail: ""}); setOldPasswordInput(""); setNewPasswordInput("");}} className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">İPTAL</button>
                <button type="submit" disabled={isPasswordChanging} className="flex-1 py-3 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all bg-indigo-600 hover:bg-indigo-500 flex justify-center items-center">
                  {isPasswordChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : "DEĞİŞTİR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[8000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 md:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${confirmModal.isDanger ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'}`}><AlertTriangle size={32} /></div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-3">{confirmModal.title}</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed px-2">{confirmModal.message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-4 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">İPTAL ET</button>
              <button onClick={confirmModal.onConfirm} className={`flex-1 py-4 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all active:scale-95 shadow-lg ${confirmModal.isDanger ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'}`}>EVET, ONAYLIYORUM</button>
            </div>
          </div>
        </div>
      )}

      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[8000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 md:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${alertModal.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : alertModal.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'}`}>{alertModal.type === 'success' ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}</div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-3">{alertModal.title}</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed px-2">{alertModal.message}</p>
            <button onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))} className={`w-full py-4 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all active:scale-95 shadow-lg ${alertModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : alertModal.type === 'error' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'}`}>TAMAM</button>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-[6000] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-rose-500 transition-colors"><X size={24} /></button>
          <img src={selectedImage} alt="Foto" className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl border border-white/10 object-contain" />
        </div>
      )}
    </div>
  );
}