'use client';
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // Import signOut
import { collection, query, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { COLLECTION_NAME, Project, STAFF_DIRECTORY } from './lib/config'; // Ajout STAFF_DIRECTORY
import AdminDashboard from './components/AdminDashboard';
import ClientPortal from './components/ClientPortal';
import StatsDashboard from './components/StatsDashboard';
import AdminLogin from './components/AdminLogin';
import { Loader2, Lock, HeartHandshake } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'client' | 'admin' | 'login' | 'stats'>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Gestion de l'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Chargement des projets en temps réel
  useEffect(() => {
    const q = query(collection(db, COLLECTION_NAME));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      // Tri par date de création décroissante (ou mariage)
      data.sort((a, b) => new Date(b.weddingDate).getTime() - new Date(a.weddingDate).getTime());
      setProjects(data);
    });
    return () => unsubscribe();
  }, []);

  // 👇 FONCTION DE DÉCONNEXION ROBUSTE
  const handleLogout = async () => {
      await signOut(auth); // On attend que Firebase déconnecte vraiment
      setUser(null);       // On vide l'utilisateur localement
      setView('landing');  // On retourne à l'accueil
  };

  const handleAdminClick = () => {
      if (user) {
          setView('admin');
      } else {
          setView('login');
      }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-stone-100"><Loader2 className="animate-spin w-10 h-10 text-stone-400"/></div>;

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-800">
      
      {/* VUE : ACCUEIL (LANDING) */}
      {view === 'landing' && (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center space-y-8 animate-fade-in">
           <div className="w-24 h-24 bg-stone-900 rounded-full flex items-center justify-center shadow-2xl mb-4">
              <HeartHandshake className="text-white w-12 h-12"/>
           </div>
           <h1 className="text-5xl md:text-7xl font-serif text-stone-900 tracking-tight">RavenTech</h1>
           <p className="text-xl text-stone-500 font-light max-w-md">Plateforme de suivi de production<br/>Cinéma & Photographie de Mariage</p>
           
           <div className="flex flex-col md:flex-row gap-4 w-full max-w-md mt-8">
              <button 
                onClick={() => setView('client')} 
                className="flex-1 bg-stone-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-transform hover:scale-105 shadow-xl"
              >
                Espace Mariés
              </button>
              <button 
                onClick={handleAdminClick} 
                className="flex-1 bg-white text-stone-900 border-2 border-stone-200 py-4 rounded-xl font-bold text-lg hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4"/> Accès Studio
              </button>
           </div>
           <div className="absolute bottom-6 text-xs text-stone-300 font-mono">V 2.0 • RavenTech Systems</div>
        </div>
      )}

      {/* VUE : LOGIN ADMIN */}
      {view === 'login' && (
          <AdminLogin onLogin={() => setView('admin')} onBack={() => setView('landing')} />
      )}

      {/* VUE : PORTAIL CLIENT */}
      {view === 'client' && (
          <ClientPortal projects={projects} onBack={() => setView('landing')} />
      )}

      {/* VUE : BACKOFFICE ADMIN */}
      {view === 'admin' && (
          <AdminDashboard 
            projects={projects} 
            staffList={Object.keys(STAFF_DIRECTORY)} // On passe la liste des noms
            staffDirectory={STAFF_DIRECTORY}         // On passe l'annuaire complet
            user={user} 
            onLogout={handleLogout} // 👈 On passe la nouvelle fonction de déconnexion
            onStats={() => setView('stats')} 
          />
      )}

      {/* VUE : STATISTIQUES */}
      {view === 'stats' && (
          <StatsDashboard projects={projects} onBack={() => setView('admin')} />
      )}

    </div>
  );
}