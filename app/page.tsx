'use client';
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Loader2, Lock, HeartHandshake, ChevronRight, PlayCircle } from 'lucide-react';

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
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, COLLECTION_NAME));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      data.sort((a, b) => new Date(b.weddingDate).getTime() - new Date(a.weddingDate).getTime());
      setProjects(data);
    });
    return () => unsubscribe();
  }, []);

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
    <div className="h-screen flex items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin w-10 h-10 text-stone-500"/>
            <span className="text-xs font-serif tracking-widest text-stone-500">CHARGEMENT RAVENTECH...</span>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-stone-800">
      
      {/* ==========================
          VUE : ACCUEIL (LANDING)
         ========================== */}
      {view === 'landing' && (
        <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
           
           {/* 1. IMAGE DE FOND (Changez l'URL ici si vous avez votre propre photo) */}
           <img 
             src="https://images.unsplash.com/photo-1511285560982-1351cdeb9821?q=80&w=2940&auto=format&fit=crop" 
             className="absolute inset-0 w-full h-full object-cover transform scale-105"
             alt="Wedding Background"
           />
           
           {/* 2. FILTRE SOMBRE (Pour la lisibilité) */}
           <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>

           {/* 3. CONTENU PRINCIPAL */}
           <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl animate-fade-in-up">
               
               {/* Logo Cercle */}
               <div className="w-24 h-24 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center shadow-2xl mb-8">
                  <HeartHandshake className="text-white w-12 h-12 opacity-90"/>
               </div>

               {/* Titres */}
               <h1 className="text-6xl md:text-8xl font-serif text-white tracking-tight mb-4 drop-shadow-lg">
                   RavenTech
               </h1>
               <p className="text-lg md:text-2xl text-stone-300 font-light max-w-2xl leading-relaxed mb-12">
                   L'excellence visuelle au service de vos souvenirs.<br/>
                   <span className="text-stone-400 text-base">Cinéma & Photographie de Mariage</span>
               </p>
               
               {/* Boutons d'action */}
               <div className="flex flex-col md:flex-row gap-6 w-full max-w-lg">
                  <button 
                    onClick={() => setView('client')} 
                    className="group flex-1 bg-white text-black py-5 rounded-2xl font-bold text-lg hover:bg-stone-200 transition-all transform hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3"
                  >
                    <span>Espace Mariés</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
                  </button>

                  <button 
                    onClick={handleAdminClick} 
                    className="flex-1 bg-black/40 backdrop-blur-md border border-white/20 text-white py-5 rounded-2xl font-bold text-lg hover:bg-black/60 hover:border-white/40 transition-all flex items-center justify-center gap-3"
                  >
                    <Lock className="w-4 h-4 text-stone-400"/> 
                    <span>Accès Studio</span>
                  </button>
               </div>
           </div>

           {/* Footer discret */}
           <div className="absolute bottom-8 text-white/30 text-[10px] uppercase tracking-widest font-mono z-10">
              RavenTech Systems V2.0 • Paris • Production
           </div>
        </div>
      )}

      {/* AUTRES VUES (Restent inchangées) */}
      {view === 'login' && (
          <AdminLogin onLogin={() => setView('admin')} onBack={() => setView('landing')} />
      )}

      {view === 'client' && (
          <ClientPortal projects={projects} onBack={() => setView('landing')} />
      )}

      {view === 'admin' && (
          <AdminDashboard 
            projects={projects} 
            staffList={Object.keys(STAFF_DIRECTORY)}
            staffDirectory={STAFF_DIRECTORY}
            user={user} 
            onLogout={handleLogout}
            onStats={() => setView('stats')} 
          />
      )}

      {view === 'stats' && (
          <StatsDashboard projects={projects} onBack={() => setView('admin')} />
      )}

    </div>
  );
}