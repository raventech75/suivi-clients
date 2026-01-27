'use client';
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { HeartHandshake, ChevronRight, Lock, Sparkles, ShieldCheck, Clock, ChevronDown } from 'lucide-react';

import { auth, db } from '../lib/firebase';
import { COLLECTION_NAME, Project, STAFF_DIRECTORY } from '../lib/config';
import AdminDashboard from '../components/AdminDashboard';
import ClientPortal from '../components/ClientPortal';
import StatsDashboard from '../components/StatsDashboard';
import AdminLogin from '../components/AdminLogin';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'client' | 'admin' | 'login' | 'stats'>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // État pour l'équipe dynamique
  const [dynamicStaff, setDynamicStaff] = useState<Record<string, string>>({});
  
  // 1. Auth - CORRIGÉ POUR GARDER LA SESSION
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
          // Si l'utilisateur est connecté, on va direct sur l'admin
          setView('admin');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Projets
  useEffect(() => {
    const q = query(collection(db, COLLECTION_NAME));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      data.sort((a, b) => new Date(b.weddingDate).getTime() - new Date(a.weddingDate).getTime());
      setProjects(data);
    });
    return () => unsubscribe();
  }, []);

  // 3. Chargement équipe dynamique
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "general"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.staffDirectory) {
                setDynamicStaff(data.staffDirectory);
            }
        }
    });
    return () => unsub();
  }, []);

  const fullStaffDirectory = { ...STAFF_DIRECTORY, ...dynamicStaff };
  const fullStaffList = Object.keys(fullStaffDirectory);

  const handleLogout = async () => {
      await signOut(auth);
      setUser(null);
      setView('landing');
  };

  const handleAdminClick = () => {
      if (user) {
          setView('admin');
      } else {
          setView('login');
      }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-stone-50">
        <HeartHandshake className="w-12 h-12 text-amber-600 animate-pulse mb-4"/>
        <span className="text-xs font-serif tracking-[0.2em] text-stone-500 uppercase">Chargement de l'expérience...</span>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-stone-800 bg-stone-50 overflow-x-hidden">
      
      {/* VUE : ACCUEIL PREMIUM */}
      {view === 'landing' && (
        <div className="flex flex-col">
           <section className="relative h-screen flex flex-col items-center justify-center text-center px-6">
               <div className="absolute inset-0 z-0">
                   <img 
                     src="https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=2940&auto=format&fit=crop" 
                     className="w-full h-full object-cover"
                     alt="Wedding Atmosphere"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-stone-900/95 via-stone-900/60 to-stone-900/40"></div>
               </div>

               <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center animate-fade-in-up delay-200">
                   <div className="mb-8 animate-fade-in">
                      <img 
                        src="/logo.png" 
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                        alt="RavenTech Luxury Logo" 
                        className="w-40 h-auto drop-shadow-2xl" 
                      />
                      <div className="hidden text-amber-400 opacity-80">
                          <HeartHandshake className="w-20 h-20"/>
                      </div>
                   </div>

                   <h1 className="text-5xl md:text-7xl font-serif text-white tracking-tight mb-6 drop-shadow-sm">
                       RavenTech <span className="text-amber-400">Studio</span>
                   </h1>
                   <p className="text-xl md:text-2xl text-stone-200 font-light max-w-2xl leading-relaxed mb-12">
                       L'excellence visuelle au service de vos souvenirs.<br/>
                       <span className="font-serif italic text-amber-200/80 text-lg">Cinéma & Photographie de Mariage</span>
                   </p>
                   
                   <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg justify-center">
                      <button 
                        onClick={() => setView('client')} 
                        className="group relative overflow-hidden bg-white text-stone-900 py-5 px-8 rounded-xl font-bold text-lg hover:shadow-[0_0_30px_rgba(251,191,36,0.4)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3 border border-white"
                      >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-amber-100 via-white to-amber-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="relative z-10 font-serif tracking-wide">ESPACE MARIÉS</span>
                        <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform text-amber-700"/>
                      </button>

                      <button 
                        onClick={handleAdminClick} 
                        className="group bg-stone-900/40 backdrop-blur-md border border-white/20 text-white py-5 px-8 rounded-xl font-bold text-lg hover:bg-stone-900/80 hover:border-amber-500/50 transition-all flex items-center justify-center gap-3"
                      >
                        <Lock className="w-4 h-4 text-amber-400 group-hover:text-amber-300 transition-colors"/> 
                        <span className="font-serif tracking-wide text-sm">ACCÈS STUDIO</span>
                      </button>
                   </div>
               </div>

               <div className="absolute bottom-10 animate-bounce text-white/30 z-10">
                   <ChevronDown className="w-6 h-6"/>
               </div>
           </section>

           <section className="py-24 px-6 bg-stone-50 relative z-10">
               <div className="max-w-6xl mx-auto">
                   <div className="text-center mb-20 animate-fade-in">
                       <span className="text-amber-600 font-bold tracking-widest text-xs uppercase mb-2 block">Notre Engagement</span>
                       <h2 className="text-3xl md:text-5xl font-serif font-bold text-stone-900 mb-6">L'Art de la Post-Production</h2>
                       <div className="w-24 h-1 bg-amber-400 mx-auto rounded-full mb-6"></div>
                       <p className="text-stone-600 text-lg max-w-2xl mx-auto leading-relaxed">Nous avons conçu une plateforme unique pour prolonger la magie de votre mariage. Une transparence totale, de la production à la livraison finale.</p>
                   </div>

                   <div className="grid md:grid-cols-3 gap-8">
                       <div className="group bg-white p-10 rounded-3xl shadow-sm hover:shadow-2xl hover:shadow-stone-200/50 transition-all duration-500 transform hover:-translate-y-2 border border-stone-100">
                           <div className="w-16 h-16 bg-stone-50 text-stone-800 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                               <Clock className="w-8 h-8"/>
                           </div>
                           <h3 className="text-2xl font-serif font-bold mb-4 text-stone-800">Suivi Temps Réel</h3>
                           <p className="text-stone-500 leading-relaxed">Ne vous demandez plus où en sont vos souvenirs. Suivez chaque étape, du dérushage à l'étalonnage, via votre timeline personnelle.</p>
                       </div>
                       <div className="group bg-white p-10 rounded-3xl shadow-sm hover:shadow-2xl hover:shadow-stone-200/50 transition-all duration-500 transform hover:-translate-y-2 border border-stone-100">
                           <div className="w-16 h-16 bg-stone-50 text-stone-800 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                               <ShieldCheck className="w-8 h-8"/>
                           </div>
                           <h3 className="text-2xl font-serif font-bold mb-4 text-stone-800">Archive Sécurisée</h3>
                           <p className="text-stone-500 leading-relaxed">Vos galeries photos et vos films 4K sont hébergés sur des serveurs privés sécurisés, accessibles uniquement via votre code unique.</p>
                       </div>
                       <div className="group bg-white p-10 rounded-3xl shadow-sm hover:shadow-2xl hover:shadow-stone-200/50 transition-all duration-500 transform hover:-translate-y-2 border border-stone-100">
                           <div className="w-16 h-16 bg-stone-50 text-stone-800 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                               <Sparkles className="w-8 h-8"/>
                           </div>
                           <h3 className="text-2xl font-serif font-bold mb-4 text-stone-800">Expérience Luxe</h3>
                           <p className="text-stone-500 leading-relaxed">Commandez vos livres d'art, activez des options prioritaires (Fast Track) et dialoguez avec votre équipe dédiée directement.</p>
                       </div>
                   </div>
               </div>
           </section>

           <footer className="bg-[#0f0f0f] text-stone-500 py-16 text-center border-t border-white/5">
               <div className="flex items-center justify-center gap-3 mb-6 opacity-50">
                   <div className="h-px w-12 bg-white/20"></div>
                   <HeartHandshake className="w-6 h-6"/>
                   <div className="h-px w-12 bg-white/20"></div>
               </div>
               <p className="font-serif text-xl text-white mb-2 tracking-wide">RavenTech Studio</p>
               <p className="text-sm mb-8 font-light">Paris • International Wedding Cinematography</p>
               <div className="text-[10px] uppercase tracking-[0.2em] opacity-40">
                   © {new Date().getFullYear()} RavenTech Systems. All rights reserved.
               </div>
           </footer>
        </div>
      )}

      {view === 'login' && <AdminLogin onLogin={() => setView('admin')} onBack={() => setView('landing')} />}
      {view === 'client' && <ClientPortal projects={projects} onBack={() => setView('landing')} />}
      
      {view === 'admin' && (
          <AdminDashboard 
            projects={projects} 
            staffList={fullStaffList} 
            staffDirectory={fullStaffDirectory} 
            user={user} 
            onLogout={handleLogout} 
            onStats={() => setView('stats')} 
          />
      )}
      
      {view === 'stats' && <StatsDashboard projects={projects} onBack={() => setView('admin')} />}

    </div>
  );
}