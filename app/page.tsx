'use client';

import React, { useState, useEffect } from 'react';
import { 
  Camera, Video, Search, Lock, CheckCircle, 
  AlertCircle, Plus, Users, Calendar, ChevronRight, 
  LogOut, Image as ImageIcon, Film, Save, Trash2,
  Clock, Check, ExternalLink, Link as LinkIcon,
  UserCheck, Users as UsersIcon, ImagePlus, Hourglass,
  Upload, Loader2, Filter, Mail, AtSign, MessageSquare, Send,
  Copy, ClipboardCheck, BookOpen, ArrowRight, HardDrive, ShieldCheck, History
} from 'lucide-react';

// --- Configuration Firebase (Identique à votre configuration actuelle) ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';

// --- Correction TypeScript pour Vercel ---
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;
declare const __app_id: string | undefined;

const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
};

const app = !getApps().length ? initializeApp(getFirebaseConfig()) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Types & Interfaces ---
interface Project {
  id: string;
  clientNames: string;
  clientEmail?: string;
  weddingDate: string;
  code: string;
  statusPhoto: 'waiting' | 'culling' | 'editing' | 'exporting' | 'delivered' | 'none';
  statusVideo: 'waiting' | 'cutting' | 'grading' | 'mixing' | 'delivered' | 'none';
  progressPhoto: number; 
  progressVideo: number;
  photographerName: string;
  videographerName: string;
  managerName?: string; 
  onSiteTeam?: string;
  coverImage?: string; 
  estimatedDelivery?: string;
  linkPhoto?: string;
  linkVideo?: string;
  notes: string;
  clientNotes?: string; 
  hasAlbum?: boolean;
  createdAt: any;
}

const COLLECTION_NAME = 'wedding_projects';
const ADMIN_PASS = 'iz2025';

const PHOTO_STEPS = {
  'waiting': { label: 'En attente', percent: 5 },
  'culling': { label: 'Tri & Sélection', percent: 30 },
  'editing': { label: 'Retouches & Colorimétrie', percent: 65 },
  'exporting': { label: 'Exportation HD', percent: 90 },
  'delivered': { label: 'Galerie Livrée', percent: 100 },
  'none': { label: 'Non commandé', percent: 0 }
};

const VIDEO_STEPS = {
  'waiting': { label: 'En attente', percent: 5 },
  'cutting': { label: 'Dérushage & Montage', percent: 35 },
  'grading': { label: 'Étalonnage & Son', percent: 70 },
  'mixing': { label: 'Mixage & Finalisation', percent: 90 },
  'delivered': { label: 'Film Livré', percent: 100 },
  'none': { label: 'Non commandé', percent: 0 }
};

export default function WeddingTracker() {
  const [user, setUser] = useState<any>(null);
  // Ajout de la vue 'archive'
  const [view, setView] = useState<'landing' | 'client' | 'admin' | 'archive'>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erreur auth:", error);
      }
    };
    initAuth();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    let colRef;
    if (typeof __app_id !== 'undefined') {
      colRef = collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME);
    } else {
      colRef = collection(db, COLLECTION_NAME);
    }
    const q = query(colRef);
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
      setProjects(data.sort((a, b) => new Date(b.weddingDate).getTime() - new Date(a.weddingDate).getTime()));
      setLoading(false);
    }, (error) => {
      console.error("Erreur lecture:", error);
      setLoading(false);
    });
    return () => unsubscribeData();
  }, [user]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
      <div className="animate-pulse flex flex-col items-center">
        <Camera className="w-10 h-10 mb-4 text-stone-400" />
        Chargement...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-800">
      {view === 'landing' && <LandingView setView={setView} />}
      {view === 'client' && <ClientPortal projects={projects} onBack={() => setView('landing')} />}
      {view === 'admin' && <AdminDashboard projects={projects} user={user} onLogout={() => setView('landing')} />}
      {view === 'archive' && <ArchiveView onBack={() => setView('landing')} />}
    </div>
  );
}

// --- Vue Accueil (Mise à jour) ---
function LandingView({ setView }: { setView: (v: any) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-900 relative overflow-hidden">
      {/* Background avec Overlay */}
      <div className="absolute inset-0 opacity-30 bg-[url('https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80')] bg-cover bg-center" />
      
      <div className="relative z-10 w-full max-w-lg space-y-6">
        
        {/* En-tête */}
        <div className="text-center mb-10 text-white">
          <div className="inline-block p-3 bg-white/10 backdrop-blur-md rounded-2xl mb-4 border border-white/10">
             <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-serif mb-2">RavenTech</h1>
          <p className="text-stone-400 text-sm uppercase tracking-widest">Atelier Visuel & Conservation</p>
        </div>

        {/* Carte : Espace Mariés (Actifs) */}
        <button onClick={() => setView('client')} className="w-full group flex items-center justify-between p-5 bg-white rounded-2xl hover:scale-[1.02] transition-all shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
              <Search className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-bold text-stone-900 text-lg">Suivre mon Mariage</div>
              <div className="text-sm text-stone-500">Accéder à mon reportage en cours</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-amber-500 transition-colors" />
        </button>

        {/* Carte : NOUVEAU - Archives & Sauvegarde */}
        <button onClick={() => setView('archive')} className="w-full group flex items-center justify-between p-5 bg-gradient-to-r from-stone-800 to-stone-700 text-white rounded-2xl hover:scale-[1.02] transition-all shadow-xl border border-stone-600 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">URGENT</div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-stone-200">
              <HardDrive className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg">Coffre-fort Archives</div>
              <div className="text-sm text-stone-400">Récupération données (2022-2025)</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-white transition-colors" />
        </button>

        {/* Lien Discret : Accès Équipe */}
        <button onClick={() => setView('admin')} className="w-full text-center text-xs text-stone-500 hover:text-white transition-colors mt-8 flex items-center justify-center gap-2">
           <Lock className="w-3 h-3" /> Accès Production
        </button>
      </div>
    </div>
  );
}

// --- NOUVELLE VUE : Archive / Tunnel de Vente ---
function ArchiveView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [email, setEmail] = useState('');
  
  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    const year = new Date(date).getFullYear();
    // Logique : Si avant 2022 = Perdu. Si >= 2022 = Gagné.
    if (year < 2022) {
      setStep(3); // Écran "Trop tard"
    } else {
      setStep(2); // Écran "Paiement"
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 relative">
       <button onClick={onBack} className="absolute top-6 left-6 text-stone-400 hover:text-white flex gap-2 transition-colors"><LogOut className="w-4 h-4" /> Retour</button>
       
       <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
         {/* En-tête visuel */}
         <div className="bg-stone-100 p-6 text-center border-b border-stone-200">
            <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-lg">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-serif text-stone-900">Vérification des Archives</h2>
            <p className="text-sm text-stone-500 mt-2">Base de données RavenTech</p>
         </div>

         <div className="p-8">
            {step === 1 && (
              <form onSubmit={handleCheck} className="space-y-6 animate-fade-in">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 text-sm text-amber-800">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>Suite à une maintenance serveur, certaines archives anciennes ne sont plus accessibles. Vérifiez votre éligibilité.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 uppercase mb-2">Date de votre mariage</label>
                  <input 
                    required 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    className="w-full p-4 border-2 border-stone-200 rounded-xl focus:border-stone-800 outline-none transition-colors"
                  />
                </div>
                <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-transform active:scale-95">
                  Vérifier mes fichiers
                </button>
              </form>
            )}

            {step === 2 && (
              <div className="text-center space-y-6 animate-fade-in">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-stone-900">Bonne nouvelle !</h3>
                  <p className="text-stone-600 mt-2">Vos fichiers (Vidéo & Photo) sont encore présents sur nos serveurs de secours.</p>
                </div>
                
                <div className="bg-stone-50 p-6 rounded-xl border border-stone-200 text-left space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-700">Taille estimée</span>
                    <span className="font-mono text-stone-500">~450 Go</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-700">Statut actuel</span>
                    <span className="text-amber-600 font-bold text-sm bg-amber-100 px-2 py-1 rounded">En danger</span>
                  </div>
                  <hr />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-900">Pack Sécurité à vie</span>
                    <span className="text-2xl font-bold text-green-600">199 €</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-2">Paiement unique. Stockage Cloud sécurisé (Glacier).</p>
                </div>
                // Remplacez la balise <a> actuelle par :
<a 
  href="https://buy.stripe.com/3cI3cv3jq2j37x9eFy5gc0b" 
  target="_blank"
  className="block w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-200 text-center"
>
  Payer 199€ et Sécuriser (Carte Bancaire)
</a>
<p className="text-xs text-stone-400 mt-2">Paiement sécurisé par Stripe. Facture immédiate.</p>
            
              </div>
            )}

            {step === 3 && (
               <div className="text-center space-y-6 animate-fade-in">
                 <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                   <History className="w-8 h-8" />
                 </div>
                 <div>
                   <h3 className="text-xl font-bold text-stone-900">Archives Indisponibles</h3>
                   <p className="text-stone-600 mt-2 text-sm">
                     Nous sommes désolés. Les serveurs contenant les données d'avant 2022 ont été purgés définitivement.
                   </p>
                 </div>
                 <div className="bg-stone-50 p-4 rounded-lg text-sm text-stone-500">
                    Si vous possédez une copie physique (Clé USB), faites-en une copie immédiatement. Nous ne possédons plus de doublon.
                 </div>
                 <button onClick={() => setStep(1)} className="text-stone-400 underline text-sm hover:text-stone-800">Réessayer une autre date</button>
               </div>
            )}
         </div>
       </div>
    </div>
  );
}

// --- Vue Client (Existante) ---
function ClientPortal({ projects, onBack }: { projects: Project[], onBack: () => void }) {
  const [searchCode, setSearchCode] = useState('');
  const [foundProject, setFoundProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = searchCode.trim().toUpperCase();
    const project = projects.find(p => p.code === cleanCode);
    if (project) { 
      setFoundProject(project); 
      setNotes(project.clientNotes || ''); 
      setError(''); 
      setImgError(false);
    } 
    else { setError('Code introuvable.'); setFoundProject(null); }
  };

  const handleSaveNotes = async () => {
    if (!foundProject) return;
    setSavingNotes(true);
    try {
      let docRef;
      if (typeof __app_id !== 'undefined') {
         docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, foundProject.id);
      } else {
         docRef = doc(db, COLLECTION_NAME, foundProject.id);
      }
      await updateDoc(docRef, { clientNotes: notes });
      alert('Informations enregistrées avec succès !');
    } catch (err) {
      alert('Erreur lors de la sauvegarde.');
    } finally {
      setSavingNotes(false);
    }
  };

  const copyProdEmail = () => {
    navigator.clipboard.writeText('irzzenproductions@gmail.com').then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }).catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = 'irzzenproductions@gmail.com';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (foundProject) setImgError(false);
  }, [foundProject?.coverImage]);

  if (foundProject) {
    const defaultImage = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80';
    const displayImage = (!imgError && foundProject.coverImage) ? foundProject.coverImage : defaultImage;

    return (
      <div className="min-h-screen bg-stone-50">
        <div className="relative h-[40vh] md:h-[50vh] w-full overflow-hidden bg-stone-900">
           <img 
             src={displayImage}
             alt="Couverture Mariage"
             className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
             onError={() => setImgError(true)}
           />
           <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
           <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
             <button onClick={() => setFoundProject(null)} className="absolute top-6 left-6 text-white/80 hover:text-white flex items-center gap-2 text-sm bg-black/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/20 transition-all hover:bg-black/40 z-20">
                <ChevronRight className="w-4 h-4 rotate-180" /> Retour
             </button>
             <h2 className="text-4xl md:text-6xl font-serif mb-4 drop-shadow-lg relative z-10">{foundProject.clientNames}</h2>
             <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:text-base relative z-10">
                <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
                   <Calendar className="w-4 h-4" />
                   {new Date(foundProject.weddingDate).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                </span>
                {foundProject.managerName && (
                  <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    Resp: {foundProject.managerName}
                  </span>
                )}
             </div>
           </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10 pb-20">
          
          {foundProject.estimatedDelivery && (
             <div className="bg-white rounded-xl shadow-lg border border-amber-100 p-6 mb-8 flex items-center gap-4 animate-fade-in">
               <div className="p-3 bg-amber-50 rounded-full">
                 <Hourglass className="w-6 h-6 text-amber-600 animate-pulse-slow" />
               </div>
               <div>
                 <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wide">Livraison Estimée</h4>
                 <p className="text-lg font-serif text-stone-800">{foundProject.estimatedDelivery}</p>
               </div>
             </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 p-6 md:p-10 space-y-12">
            
            <div className={`grid gap-10 ${foundProject.statusPhoto !== 'none' && foundProject.statusVideo !== 'none' ? 'md:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'}`}>
              {foundProject.statusPhoto !== 'none' && (
                <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-amber-600">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-serif text-xl text-stone-800">Photos</h3>
                        <p className="text-sm text-stone-500 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {foundProject.photographerName || 'En attente'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium text-stone-600 uppercase tracking-wider text-xs">Statut</span>
                        <span className="text-2xl font-bold text-amber-600">{foundProject.progressPhoto}%</span>
                      </div>
                      <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${foundProject.progressPhoto}%` }}>
                           <div className="absolute top-0 right-0 bottom-0 w-[20px] bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-right text-sm font-medium text-stone-700 mt-2">{PHOTO_STEPS[foundProject.statusPhoto].label}</p>
                    </div>
                  </div>
                  {foundProject.linkPhoto && foundProject.statusPhoto === 'delivered' && (
                    <a href={foundProject.linkPhoto} target="_blank" rel="noopener noreferrer" className="mt-4 w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-3 rounded-xl hover:bg-stone-700 transition-colors shadow-lg">
                      <ExternalLink className="w-4 h-4" /> Accéder à la Galerie
                    </a>
                  )}
                </div>
              )}

              {foundProject.statusVideo !== 'none' && (
                <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-sky-600">
                        <Film className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-serif text-xl text-stone-800">Film</h3>
                        <p className="text-sm text-stone-500 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {foundProject.videographerName || 'En attente'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-6">
                       <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium text-stone-600 uppercase tracking-wider text-xs">Statut</span>
                        <span className="text-2xl font-bold text-sky-600">{foundProject.progressVideo}%</span>
                      </div>
                      <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${foundProject.progressVideo}%` }}>
                          <div className="absolute top-0 right-0 bottom-0 w-[20px] bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-right text-sm font-medium text-stone-700 mt-2">{VIDEO_STEPS[foundProject.statusVideo].label}</p>
                    </div>
                  </div>
                  {foundProject.linkVideo && foundProject.statusVideo === 'delivered' && (
                    <a href={foundProject.linkVideo} target="_blank" rel="noopener noreferrer" className="mt-4 w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-3 rounded-xl hover:bg-stone-700 transition-colors shadow-lg">
                      <ExternalLink className="w-4 h-4" /> Télécharger le Film
                    </a>
                  )}
                </div>
              )}
            </div>

            {foundProject.hasAlbum && foundProject.statusPhoto === 'delivered' && (
              <div className="mt-12 bg-stone-800 rounded-2xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-stone-700 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-stone-700 p-3 rounded-xl">
                      <BookOpen className="w-6 h-6 text-amber-200" />
                    </div>
                    <h3 className="font-serif text-2xl">Production de l'Album</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <p className="text-stone-300">
                        Votre galerie est livrée ! Pour lancer la création de votre album photo, nous avons besoin de votre sélection.
                      </p>
                      <ul className="space-y-2 text-sm text-stone-400">
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Sélectionnez vos photos préférées</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Créez un dossier unique</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Envoyez-le nous via WeTransfer</li>
                      </ul>
                    </div>
                    <div className="bg-stone-900/50 p-6 rounded-xl border border-stone-700">
                      <div className="mb-4">
                        <label className="text-xs uppercase text-stone-500 font-bold mb-1 block">Adresse d'envoi</label>
                        <div className="flex items-center gap-2 bg-stone-800 p-2 rounded-lg border border-stone-700">
                          <code className="flex-1 text-sm text-amber-100">irzzenproductions@gmail.com</code>
                          <button onClick={copyProdEmail} className="p-1.5 hover:bg-stone-700 rounded text-stone-400 hover:text-white transition-colors">
                            {emailCopied ? <ClipboardCheck className="w-4 h-4 text-green-400"/> : <Copy className="w-4 h-4"/>}
                          </button>
                        </div>
                      </div>
                      <a 
                        href="https://wetransfer.com/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full bg-white text-stone-900 py-3 rounded-lg font-medium hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                      >
                        Envoyer ma sélection <ArrowRight className="w-4 h-4"/>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-stone-100 pt-8 mt-8">
              <h4 className="font-serif text-xl text-stone-800 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-stone-400" /> Informations Complémentaires
              </h4>
              <p className="text-stone-500 text-sm mb-4">
                Vous avez une demande particulière pour le montage ou une précision à apporter ? Écrivez-nous ici, l'équipe responsable verra votre message.
              </p>
              <textarea 
                className="w-full border border-stone-200 rounded-xl p-4 text-stone-700 focus:ring-2 focus:ring-stone-800 outline-none resize-none bg-stone-50"
                rows={4}
                placeholder="Ex: Pour le film, nous aimerions beaucoup intégrer la chanson..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex justify-end mt-3">
                <button 
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="bg-stone-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-stone-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {savingNotes ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                  Enregistrer ma demande
                </button>
              </div>
            </div>

            {(foundProject.statusPhoto === 'delivered' || foundProject.statusVideo === 'delivered') && (
               <div className="bg-green-50 border border-green-100 rounded-xl p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                   <Check className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium text-green-900 text-lg">Livraison disponible</h4>
                  <p className="text-green-700 mt-1">
                    Félicitations ! Votre reportage est prêt. Utilisez les boutons ci-dessus pour accéder à vos souvenirs.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <button onClick={onBack} className="absolute top-6 left-6 text-stone-400 hover:text-stone-800 flex gap-2 transition-colors"><LogOut className="w-4 h-4" /> Accueil</button>
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl text-center">
        <div className="bg-stone-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"><Search className="w-8 h-8 text-stone-400" /></div>
        <h2 className="text-2xl font-serif text-stone-900 mb-2">Accès Mariés</h2>
        <form onSubmit={handleSearch} className="space-y-4 mt-8">
          <input type="text" placeholder="CODE..." value={searchCode} onChange={(e) => setSearchCode(e.target.value)} className="w-full p-4 border rounded-xl text-center text-lg tracking-widest uppercase focus:ring-2 focus:ring-stone-800 outline-none" />
          <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-colors">Voir l'avancement</button>
        </form>
        {error && <div className="mt-4 text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div>}
      </div>
    </div>
  );
}

// --- Dashboard Admin (Existant) ---
function AdminDashboard({ projects, user, onLogout }: { projects: Project[], user: any, onLogout: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newProject, setNewProject] = useState({ 
    clientNames: '', clientEmail: '', weddingDate: '', photographerName: '', videographerName: '', 
    managerName: '', onSiteTeam: '', hasPhoto: true, hasVideo: true, hasAlbum: false
  });
  
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'late'>('all');

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    let colRef;
    if (typeof __app_id !== 'undefined') {
       colRef = collection(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME);
    } else {
       colRef = collection(db, COLLECTION_NAME);
    }

    const code = (newProject.clientNames.split(' ')[0] + '-' + Math.floor(Math.random() * 1000)).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    
    await addDoc(colRef, {
      ...newProject,
      code,
      statusPhoto: newProject.hasPhoto ? 'waiting' : 'none',
      statusVideo: newProject.hasVideo ? 'waiting' : 'none',
      progressPhoto: newProject.hasPhoto ? PHOTO_STEPS['waiting'].percent : 0,
      progressVideo: newProject.hasVideo ? VIDEO_STEPS['waiting'].percent : 0,
      linkPhoto: '',
      linkVideo: '',
      notes: '',
      clientNotes: '', 
      clientEmail: newProject.clientEmail || '', 
      managerName: newProject.managerName || '',
      onSiteTeam: newProject.onSiteTeam || '',
      coverImage: '', 
      estimatedDelivery: '',
      hasAlbum: newProject.hasAlbum || false,
      createdAt: serverTimestamp()
    });
    setIsAdding(false);
    setNewProject({ 
      clientNames: '', clientEmail: '', weddingDate: '', photographerName: '', videographerName: '', 
      managerName: '', onSiteTeam: '', hasPhoto: true, hasVideo: true, hasAlbum: false 
    });
  };

  const handleDelete = async (id: string) => {
    let docRef;
    if (typeof __app_id !== 'undefined') {
       docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, id);
    } else {
       docRef = doc(db, COLLECTION_NAME, id);
    }
    if (confirm('Supprimer ?')) await deleteDoc(docRef);
  };

  const filteredProjects = projects.filter(p => {
    const isFinished = (p.statusPhoto === 'delivered' || p.statusPhoto === 'none') && (p.statusVideo === 'delivered' || p.statusVideo === 'none');
    const isLate = new Date().getTime() - new Date(p.weddingDate).getTime() > (60 * 24 * 60 * 60 * 1000) && !isFinished;

    if (filter === 'completed') return isFinished;
    if (filter === 'active') return !isFinished;
    if (filter === 'late') return isLate;
    return true; 
  });

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
         <h2 className="text-xl font-bold mb-4 flex gap-2"><Lock className="w-5 h-5" /> Accès Équipe</h2>
         <input type="password" placeholder="Mot de passe" className="w-full p-3 border rounded-lg mb-4" value={passInput} onChange={(e) => setPassInput(e.target.value)} />
         <button onClick={() => passInput === ADMIN_PASS ? setIsAuthenticated(true) : alert('Erreur')} className="w-full bg-blue-600 text-white p-3 rounded-lg">Connexion</button>
         <button onClick={onLogout} className="mt-4 text-sm w-full hover:underline text-stone-500">Retour</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-stone-900 text-white p-2 rounded-lg"><Users className="w-5 h-5" /></div>
            <div>
              <h1 className="font-bold text-stone-900">Dashboard</h1>
              <p className="text-xs text-stone-500">Gestion des projets</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={onLogout} className="text-stone-500 hover:text-stone-800 px-3 py-2 text-sm font-medium transition flex items-center gap-1">
               <LogOut className="w-4 h-4"/> <span className="hidden sm:inline">Déconnexion</span>
            </button>
            <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2 text-sm font-medium hover:bg-blue-700 transition">
               <Plus className="w-4 h-4" /> Nouveau
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${filter === 'all' ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}>Tous ({projects.length})</button>
          <button onClick={() => setFilter('active')} className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${filter === 'active' ? 'bg-blue-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}>En cours</button>
          <button onClick={() => setFilter('late')} className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${filter === 'late' ? 'bg-red-500 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}>En retard</button>
          <button onClick={() => setFilter('completed')} className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${filter === 'completed' ? 'bg-green-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}>Terminés</button>
        </div>

        <div className="grid gap-6">
          {filteredProjects.map(p => <ProjectEditor key={p.id} project={p} onDelete={() => handleDelete(p.id)} />)}
          {filteredProjects.length === 0 && (
            <div className="text-center py-20 text-stone-400 bg-white rounded-xl border border-dashed border-stone-300"><p>Aucun projet correspondant.</p></div>
          )}
        </div>
      </main>
      
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-6 border-b pb-2">Nouveau Mariage</h3>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div><label className="text-sm font-medium text-stone-600 block mb-1">Mariés</label><input required placeholder="Ex: Sophie & Marc" className="w-full border rounded-lg p-2.5" value={newProject.clientNames} onChange={e => setNewProject({...newProject, clientNames: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-sm font-medium text-stone-600 block mb-1">Email des mariés</label><input type="email" placeholder="mariage@exemple.com" className="w-full border rounded-lg p-2.5" value={newProject.clientEmail} onChange={e => setNewProject({...newProject, clientEmail: e.target.value})} /></div>
                 <div><label className="text-sm font-medium text-stone-600 block mb-1">Date</label><input required type="date" className="w-full border rounded-lg p-2.5" value={newProject.weddingDate} onChange={e => setNewProject({...newProject, weddingDate: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-sm font-medium text-stone-600 block mb-1">Responsable</label><input placeholder="Ex: Julien" className="w-full border rounded-lg p-2.5" value={newProject.managerName} onChange={e => setNewProject({...newProject, managerName: e.target.value})} /></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <label className="flex items-center gap-2 mb-2 font-medium text-sm cursor-pointer"><input type="checkbox" checked={newProject.hasPhoto} onChange={e => setNewProject({...newProject, hasPhoto: e.target.checked})} className="accent-amber-600" /> Prestation Photo</label>
                  {newProject.hasPhoto && <input placeholder="Nom Photographe" className="w-full text-sm border rounded p-1.5" value={newProject.photographerName} onChange={e => setNewProject({...newProject, photographerName: e.target.value})} />}
                </div>
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <label className="flex items-center gap-2 mb-2 font-medium text-sm cursor-pointer"><input type="checkbox" checked={newProject.hasVideo} onChange={e => setNewProject({...newProject, hasVideo: e.target.checked})} className="accent-sky-600" /> Prestation Vidéo</label>
                  {newProject.hasVideo && <input placeholder="Nom Vidéaste" className="w-full text-sm border rounded p-1.5" value={newProject.videographerName} onChange={e => setNewProject({...newProject, videographerName: e.target.value})} />}
                </div>
              </div>

              <div className="pt-2">
                 <label className="flex items-center gap-2 text-sm font-medium text-stone-700 cursor-pointer p-3 bg-stone-50 rounded-lg border border-stone-100">
                    <input type="checkbox" checked={newProject.hasAlbum} onChange={e => setNewProject({...newProject, hasAlbum: e.target.checked})} className="accent-stone-800" />
                    <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-stone-500" /> Album Photo inclus (Active l'étape de sélection post-livraison)</span>
                 </label>
              </div>

              <div className="flex gap-3 mt-8 pt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">Annuler</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition">Créer le projet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectEditor({ project, onDelete }: { project: Project, onDelete: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState(project);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (!hasChanges) setLocalData(project); }, [project]);

  const updateField = (k: keyof Project, v: any) => { 
    setLocalData(p => {
      const newState = { ...p, [k]: v };
      if (k === 'statusPhoto') newState.progressPhoto = PHOTO_STEPS[v as keyof typeof PHOTO_STEPS].percent;
      if (k === 'statusVideo') newState.progressVideo = VIDEO_STEPS[v as keyof typeof VIDEO_STEPS].percent;
      return newState;
    }); 
    setHasChanges(true); 
  };
  
  const handleSave = async () => {
    const { id, ...data } = localData;
    let docRef;
    if (typeof __app_id !== 'undefined') {
       docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, project.id);
    } else {
       docRef = doc(db, COLLECTION_NAME, project.id);
    }
    await updateDoc(docRef, data);
    setHasChanges(false); setIsExpanded(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      let storageRef = ref(storage, `covers/${project.id}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateField('coverImage', url);
    } catch (error: any) {
      console.error("Erreur upload:", error);
      alert(`Erreur: ${error.message || "Vérifiez que Firebase Storage est activé."}`);
    } finally {
      setUploading(false);
    }
  };

  const sendEmailNotification = (type: 'photo' | 'video') => {
    const email = localData.clientEmail;
    if (!email) {
      alert("Veuillez d'abord renseigner l'email du client.");
      return;
    }
    const subject = `Mise à jour de votre reportage ${type === 'photo' ? 'Photo' : 'Vidéo'} - ${localData.clientNames}`;
    const statusLabel = type === 'photo' ? PHOTO_STEPS[localData.statusPhoto].label : VIDEO_STEPS[localData.statusVideo].label;
    const body = `Bonjour,\n\nLe statut de votre reportage ${type === 'photo' ? 'photo' : 'vidéo'} a avancé !\n\nNouvel état : ${statusLabel}\n\nVous pouvez suivre l'avancement complet ici : ${window.location.origin}\nVotre code : ${localData.code}\n\nCordialement,\nL'équipe.`;
    
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const copyInvite = () => {
    const url = window.location.origin;
    const text = `Félicitations pour votre mariage !\n\nSuivez l'avancement de vos photos/vidéos ici : ${url}\nVotre code d'accès : ${localData.code}`;
    
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur copie', err);
    }
    document.body.removeChild(textArea);
  };

  const isLate = new Date().getTime() - new Date(project.weddingDate).getTime() > (60 * 24 * 60 * 60 * 1000) && (project.statusPhoto !== 'delivered' || project.statusVideo !== 'delivered');

  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-all ${isExpanded ? 'ring-2 ring-blue-500/20 border-blue-500' : 'border-stone-200 hover:border-blue-300'}`}>
      <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-4">
          <div className={`w-1.5 h-12 rounded-full ${isLate ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <div>
             <h3 className="font-bold text-lg text-stone-900">{project.clientNames}</h3>
             <div className="text-sm text-stone-500 flex items-center gap-3">
               <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 select-all">{project.code}</span>
               <span>{new Date(project.weddingDate).toLocaleDateString()}</span>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="hidden sm:flex gap-4 text-right">
             {project.statusPhoto !== 'none' && (
               <div>
                  <div className="text-[10px] uppercase text-stone-400 font-bold tracking-wider">Photo</div>
                  <div className={`text-sm font-bold ${project.statusPhoto === 'delivered' ? 'text-green-600' : 'text-amber-600'}`}>{project.progressPhoto}%</div>
               </div>
             )}
             {project.statusVideo !== 'none' && (
               <div>
                  <div className="text-[10px] uppercase text-stone-400 font-bold tracking-wider">Vidéo</div>
                  <div className={`text-sm font-bold ${project.statusVideo === 'delivered' ? 'text-green-600' : 'text-sky-600'}`}>{project.progressVideo}%</div>
               </div>
             )}
           </div>
           <ChevronRight className={`w-5 h-5 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-stone-100 bg-stone-50/50 p-6 rounded-b-xl">
           
           <div className="mb-6 flex justify-end">
              <button 
                onClick={copyInvite}
                className="text-xs flex items-center gap-2 bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 text-stone-600 transition-colors"
              >
                {copied ? <ClipboardCheck className="w-3 h-3 text-green-600"/> : <Copy className="w-3 h-3"/>}
                {copied ? 'Copié !' : "Copier l'invitation client"}
              </button>
           </div>

           <div className="mb-6 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
             <h4 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Informations Générales</h4>
             <div className="grid md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Responsable du dossier</label>
                  <input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" placeholder="Ex: Julien" value={localData.managerName || ''} onChange={e => updateField('managerName', e.target.value)} />
                </div>
             </div>
             <div className="mb-4">
                <label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Équipe sur place (Liste complète)</label>
                <input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" placeholder="Ex: Sophie (Photo), Marc (Vidéo), Assistant..." value={localData.onSiteTeam || ''} onChange={e => updateField('onSiteTeam', e.target.value)} />
             </div>
             <div className="mb-4">
                <label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1 mb-1"><AtSign className="w-3 h-3" /> Email des mariés (pour notifications)</label>
                <input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" placeholder="mariage@exemple.com" type="email" value={localData.clientEmail || ''} onChange={e => updateField('clientEmail', e.target.value)} />
             </div>
             <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-stone-100">
               <div>
                  <label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1 mb-1"><ImagePlus className="w-3 h-3" /> Photo de Couverture (Teaser)</label>
                  <div className="flex items-start gap-3">
                     {localData.coverImage ? (
                       <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0 group">
                         <img src={localData.coverImage} className="w-full h-full object-cover" alt="Preview" />
                         <button onClick={() => updateField('coverImage', '')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white" title="Supprimer l'image"><Trash2 className="w-4 h-4" /></button>
                       </div>
                     ) : (
                       <div className="w-16 h-16 rounded-lg bg-stone-100 flex items-center justify-center border border-dashed border-stone-300 shrink-0"><ImageIcon className="w-6 h-6 text-stone-300" /></div>
                     )}
                     <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                           <input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" placeholder="URL ou Upload..." value={localData.coverImage || ''} onChange={e => updateField('coverImage', e.target.value)} />
                        </div>
                        <label className={`inline-flex items-center gap-2 cursor-pointer bg-stone-800 hover:bg-stone-700 text-white text-xs px-3 py-1.5 rounded-md transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                           <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={handleImageUpload} />
                           {uploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3"/>} {uploading ? 'Envoi...' : 'Choisir une photo'}
                        </label>
                     </div>
                  </div>
               </div>
               <div>
                  <label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Estimation de Livraison</label>
                  <input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" placeholder="Ex: Entre le 15 et le 20 Octobre" value={localData.estimatedDelivery || ''} onChange={e => updateField('estimatedDelivery', e.target.value)} />
               </div>
             </div>

             <div className="mt-4 pt-4 border-t border-stone-100">
               <label className="flex items-center gap-2 text-sm font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={localData.hasAlbum || false} onChange={e => updateField('hasAlbum', e.target.checked)} className="accent-stone-800" />
                  <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-stone-500" /> Album Photo inclus (Active l'étape de sélection post-livraison)</span>
               </label>
             </div>
           </div>

           {localData.clientNotes && (
             <div className="mb-6 bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
               <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Message des Mariés</h4>
               <p className="text-stone-700 text-sm whitespace-pre-wrap italic">{localData.clientNotes}</p>
             </div>
           )}

           <div className="grid md:grid-cols-2 gap-6">
             {project.statusPhoto !== 'none' && (
               <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                   <h4 className="font-bold text-stone-700 flex items-center gap-2"><Camera className="w-4 h-4 text-amber-500"/> Photo</h4>
                   <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{localData.progressPhoto}%</span>
                 </div>
                 <div className="space-y-3">
                   <div>
                     <label className="text-xs font-semibold text-stone-500 uppercase">Photographe Principal</label>
                     <input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-amber-500 bg-transparent" value={localData.photographerName} onChange={e => updateField('photographerName', e.target.value)} />
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-stone-500 uppercase">Étape actuelle</label>
                     <div className="flex gap-2">
                        <select className="flex-1 mt-1 p-2 bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" value={localData.statusPhoto} onChange={e => updateField('statusPhoto', e.target.value as any)}>
                            {Object.entries(PHOTO_STEPS).filter(([k]) => k !== 'none').map(([k, s]) => (<option key={k} value={k}>{s.label}</option>))}
                        </select>
                        <button onClick={() => sendEmailNotification('photo')} title="Envoyer mail de mise à jour" className="mt-1 p-2 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-stone-200"><Send className="w-4 h-4" /></button>
                     </div>
                   </div>
                   <div>
                      <label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Lien Livraison (Optionnel)</label>
                      <input className="w-full mt-1 p-2 bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="https://..." value={localData.linkPhoto || ''} onChange={e => updateField('linkPhoto', e.target.value)} />
                   </div>
                 </div>
               </div>
             )}

             {project.statusVideo !== 'none' && (
               <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                   <h4 className="font-bold text-stone-700 flex items-center gap-2"><Video className="w-4 h-4 text-sky-500"/> Vidéo</h4>
                   <span className="text-xs font-bold bg-sky-100 text-sky-700 px-2 py-1 rounded-full">{localData.progressVideo}%</span>
                 </div>
                 <div className="space-y-3">
                   <div>
                     <label className="text-xs font-semibold text-stone-500 uppercase">Vidéaste Principal</label>
                     <input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-sky-500 bg-transparent" value={localData.videographerName} onChange={e => updateField('videographerName', e.target.value)} />
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-stone-500 uppercase">Étape actuelle</label>
                     <div className="flex gap-2">
                        <select className="flex-1 mt-1 p-2 bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none" value={localData.statusVideo} onChange={e => updateField('statusVideo', e.target.value as any)}>
                            {Object.entries(VIDEO_STEPS).filter(([k]) => k !== 'none').map(([k, s]) => (<option key={k} value={k}>{s.label}</option>))}
                        </select>
                        <button onClick={() => sendEmailNotification('video')} title="Envoyer mail de mise à jour" className="mt-1 p-2 text-stone-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors border border-stone-200"><Send className="w-4 h-4" /></button>
                     </div>
                   </div>
                   <div>
                      <label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Lien Livraison (Optionnel)</label>
                      <input className="w-full mt-1 p-2 bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none" placeholder="https://..." value={localData.linkVideo || ''} onChange={e => updateField('linkVideo', e.target.value)} />
                   </div>
                 </div>
               </div>
             )}
           </div>
           
           <div className="flex justify-between items-center pt-6 mt-2">
             <button onClick={onDelete} className="text-red-500 text-sm flex gap-1.5 hover:bg-red-50 px-3 py-2 rounded-lg transition"><Trash2 className="w-4 h-4"/> Supprimer ce projet</button>
             <div className="flex gap-3">
               {hasChanges && <button onClick={() => { setLocalData(project); setHasChanges(false); }} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg">Annuler</button>}
               <button onClick={handleSave} disabled={!hasChanges} className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all ${hasChanges ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}>Enregistrer</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}