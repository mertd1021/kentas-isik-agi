"use client";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, KeyRound, Loader2, Lock, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/firebase"; 
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

export default function AdminLoginPage() {
  const router = useRouter(); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- AUTH STATE OBSERVER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.push('/admin');
    });
    return () => unsubscribe();
  }, [router]);

  // --- LOGIN HANDLER ---
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Lütfen e-posta adresinizi giriniz.");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Lütfen geçerli bir e-posta adresi giriniz (Örn: admin@kentas.com).");
      return;
    }

    if (!password) {
      setError("Lütfen şifrenizi giriniz.");
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        router.push('/admin'); 
      }
    } catch (err: unknown) { 
      console.error("Giriş Hatası:", err);
      const firebaseError = err as { code?: string };
      
      if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password') {
        setError("E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.");
      } else if (firebaseError.code === 'auth/too-many-requests') {
        setError("Çok fazla başarısız deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.");
      } else {
        setError("Giriş yapılamadı. Lütfen internet bağlantınızı kontrol edin.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI RENDER ---
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden font-sans">
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600 rounded-full blur-[150px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-500 rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <div className="z-10 flex flex-col items-center w-full sm:w-11/12 max-w-md px-6 sm:px-10 py-10 sm:py-12 bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl transition-all relative overflow-hidden">
        
        <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-2xl animate-pulse" />
          <Lock className="text-indigo-400 w-8 h-8 md:w-10 md:h-10 relative z-10" />
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase leading-tight mb-2 text-center">
          Yönetici <span className="text-indigo-400">Girişi</span>
        </h1>
        
        <p className="text-xs md:text-sm text-slate-400 font-medium mb-8 text-center px-2 leading-relaxed">
          Kentaş Işık Ağı Operasyon Merkezi&apos;ne erişmek için e-posta ve şifrenizi girin.
        </p>

        {error && (
          <div className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] md:text-xs font-bold p-3.5 rounded-xl mb-6 text-center animate-in fade-in zoom-in flex items-center justify-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4" noValidate>
          
          <div className="relative flex items-center w-full">
            <Mail size={18} className={`absolute left-4 transition-colors ${error && !email.includes('@') ? 'text-rose-400' : 'text-slate-400'}`} />
            <input 
              type="email" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="E-posta adresiniz" 
              className={`w-full bg-slate-950 border ${error && !email.includes('@') ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'} text-white text-sm md:text-base font-medium rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600`}
            />
          </div>

          <div className="relative flex items-center w-full">
            <KeyRound size={18} className="absolute left-4 text-slate-400" />
            <input 
              type="password" 
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Şifreniz" 
              className="w-full bg-slate-950 border border-slate-800 text-white text-sm md:text-base font-medium rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-2 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] md:text-xs hover:bg-indigo-500 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_30px_rgba(79,70,229,0.2)]"
          >
            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Giriş Yap <ShieldCheck size={16} /></>}
          </button>
        </form>

      </div>
    </div>
  );
}