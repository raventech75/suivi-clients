'use client';
import React, { useState, useEffect } from 'react';
import { Camera, Search, Lock, HardDrive, Clock, Rocket, ShieldCheck, LogOut, CheckCircle, History, Loader2 } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, addDoc, serverTimestamp, query, onSnapshot } from 'firebase/firestore';
import { auth, db, appId } from '../lib/firebase';
import { DEFAULT_STAFF, COLLECTION_NAME, LEADS_COLLECTION, SETTINGS_COLLECTION, STRIPE_ARCHIVE_LINK, Project } from '../lib/config';
import AdminDashboard from '../components/AdminDashboard';
import ClientPortal from '../components/ClientPortal';

export default function WeddingTracker() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'client' | 'admin' | 'archive'>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [staffList, setStaffList] = useState<string[]>(DEFAULT_STAFF);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) signInAnonymously(auth).catch(console.error);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    const q = query(collection(db, colPath));
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
      setProjects(data.sort((a, b) => new Date(b.weddingDate).getTime() - new Date(a.weddingDate).getTime()));
      setLoading(false);
    });

    const settingsPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${SETTINGS_COLLECTION}` : SETTINGS_COLLECTION;
    getDoc(doc(db, settingsPath, 'general')).then(docSnap => {
        if(docSnap.exists() && docSnap.data().staff) setStaffList(docSnap.data().staff);
        else setDoc(doc(db, settingsPath, 'general'), { staff: DEFAULT_STAFF }, { merge: true });
    });

    return () => unsubscribeData();
  }, [user]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-stone-50"><Loader2 className="w-10 h-10 animate-spin text-stone-400"/></div>;

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-800">
      {view === 'landing' && <LandingView setView={setView} />}
      {view === 'client' && <ClientPortal projects={projects} onBack={() => setView('landing')} />}
      {view === 'admin' && <AdminDashboard projects={projects} staffList={staffList} setStaffList={setStaffList} user={user} onLogout={() => { signOut(auth); setView('landing'); }} />}
      {view === 'archive' && <ArchiveView onBack={() => setView('landing')} />}
    </div>
  );
}

// --- Vue Accueil ---
function LandingView({ setView }: { setView: (v: any) => void }) {
  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans selection:bg-amber-100 selection:text-amber-900">
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-stone-900 text-white p-2 rounded-lg"><Camera className="w-5 h-5" /></div>
            <span className="font-serif text-xl font-bold tracking-tight">RavenTech</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setView('client')} className="hidden md:flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"><Search className="w-4 h-4"/> Espace Mariés</button>
            <button onClick={() => setView('client')} className="md:hidden p-2 bg-stone-100 rounded-full"><Search className="w-5 h-5"/></button>
            <button onClick={() => setView('admin')} className="bg-stone-900 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-medium hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center gap-2"><Lock className="w-3 h-3"/> <span className="hidden md:inline">Accès Studio</span><span className="md:hidden">Studio</span></button>
          </div>
        </div>
      </nav>
      <section className="relative pt-32 pb-12 lg:pt-48 lg:pb-32 overflow-hidden px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 relative z-10 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Nouvelle plateforme 2026
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-serif leading-[1.1]">L'art de sublimer <br/><span className="text-stone-400 italic">vos souvenirs.</span></h1>
            <p className="text-base md:text-lg text-stone-500 max-w-md mx-auto lg:mx-0 leading-relaxed">Une expérience digitale complète pour suivre votre reportage, valider vos montages et sécuriser votre patrimoine visuel à vie.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button onClick={() => setView('client')} className="px-8 py-4 bg-stone-900 text-white rounded-full font-medium hover:bg-black transition-transform hover:scale-105 shadow-xl flex items-center justify-center gap-2">Accéder à mon mariage</button>
              <button onClick={() => setView('archive')} className="px-8 py-4 bg-white border border-stone-200 text-stone-900 rounded-full font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 group"><HardDrive className="w-4 h-4 text-stone-400 group-hover:text-stone-900 transition-colors" /> Vérifier mes archives</button>
            </div>
          </div>
          <div className="relative mt-8 lg:mt-0">
            <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-white/20 aspect-[4/5] md:aspect-auto md:h-[600px]">
               <img src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80" alt="Mariage Couple" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>
      <section className="py-20 bg-stone-50 px-6">
        <div className="max-w-7xl mx-auto">
           <h2 className="text-3xl font-serif mb-12 text-center">Services Premium</h2>
           <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100"><h3 className="text-xl font-bold mb-3 flex gap-2 items-center"><Clock className="text-amber-500 w-5 h-5"/> Suivi Live</h3><p className="text-stone-500 text-sm">Suivez l'avancement en temps réel.</p></div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100"><h3 className="text-xl font-bold mb-3 flex gap-2 items-center"><Rocket className="text-amber-500 w-5 h-5"/> Fast Track</h3><p className="text-stone-500 text-sm">Option prioritaire pour les pressés.</p></div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100"><h3 className="text-xl font-bold mb-3 flex gap-2 items-center"><ShieldCheck className="text-amber-500 w-5 h-5"/> Cold Storage</h3><p className="text-stone-500 text-sm">Archivage sécurisé à vie.</p></div>
           </div>
        </div>
      </section>
      <footer className="bg-white border-t border-stone-100 py-12 text-center text-sm text-stone-500">© 2026 RavenTech Solutions.</footer>
    </div>
  );
}

// --- Vue Archive ---
function ArchiveView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleCheck = (e: React.FormEvent) => { e.preventDefault(); if (!date) return; setStep(1.5); };

  const handleCaptureLead = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${LEADS_COLLECTION}` : LEADS_COLLECTION;
    await addDoc(collection(db, colPath), { name: leadName, email: leadEmail, phone: leadPhone, weddingDate: date, createdAt: serverTimestamp(), source: 'archive_check' });
    setLoading(false);
    const year = new Date(date).getFullYear();
    if (year < 2022) { setStep(3); } else { setStep(2); }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 relative">
       <button onClick={onBack} className="absolute top-6 left-6 text-stone-400 hover:text-white flex gap-2 transition-colors"><LogOut className="w-4 h-4" /> Retour</button>
       <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-8">
            {step === 1 && (
              <form onSubmit={handleCheck} className="space-y-6">
                <div className="text-center"><h2 className="text-2xl font-bold">Archives</h2><p>Vérifiez la disponibilité de vos fichiers.</p></div>
                <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-4 border rounded-xl" />
                <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold">Vérifier</button>
              </form>
            )}
            {step === 1.5 && (
               <form onSubmit={handleCaptureLead} className="space-y-4">
                  <div className="text-center mb-6"><h3 className="font-bold">Coordonnées</h3><p className="text-sm">Pour voir le résultat.</p></div>
                  <input required placeholder="Nom" value={leadName} onChange={(e) => setLeadName(e.target.value)} className="w-full p-3 border rounded-lg" />
                  <input required placeholder="Email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} className="w-full p-3 border rounded-lg" />
                  <input required placeholder="Téléphone" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} className="w-full p-3 border rounded-lg" />
                  <button disabled={loading} type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold">{loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Voir Résultat'}</button>
               </form>
            )}
            {step === 2 && (
              <div className="text-center space-y-6">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto"/>
                <h3 className="text-2xl font-bold">Fichiers trouvés !</h3>
                <a href={STRIPE_ARCHIVE_LINK} target="_blank" className="block w-full bg-green-600 text-white py-4 rounded-xl font-bold">Sécuriser (199 €)</a>
              </div>
            )}
            {step === 3 && (
               <div className="text-center space-y-6">
                 <History className="w-16 h-16 text-red-500 mx-auto"/>
                 <h3 className="text-xl font-bold">Archives Purgées</h3>
                 <p className="text-sm">Désolé, les fichiers sont introuvables.</p>
               </div>
            )}
       </div>
    </div>
  );
}