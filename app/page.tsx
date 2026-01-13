'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, Search, Lock, CheckCircle, 
  AlertCircle, Plus, Users, Calendar, ChevronRight, 
  LogOut, Image as ImageIcon, Film, Save, Trash2,
  Clock, Check, ExternalLink, Link as LinkIcon,
  UserCheck, Users as UsersIcon, ImagePlus, Hourglass,
  Upload, Loader2, AtSign, MessageSquare, Send,
  Copy, ClipboardCheck, BookOpen, ArrowRight, HardDrive, ShieldCheck, History,
  Euro, Eye, AlertTriangle, CreditCard, X, Phone, Rocket, Star, Mail, Settings
} from 'lucide-react';

// --- Configuration Firebase ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, serverTimestamp, setDoc, getDoc, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
  signInWithEmailAndPassword, signOut 
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';

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

// --- CONFIGURATION ---
const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/VOTRE_URL_ICI"; 
const STRIPE_ARCHIVE_LINK = "https://buy.stripe.com/3cI3cv3jq2j37x9eFy5gc0b";
const STRIPE_PRIORITY_LINK = "https://buy.stripe.com/VOTRE_LIEN_PRIORITE";

// ⚠️ LISTE DES EMAILS ADMINS (Qui ont le droit de voir la finance et supprimer)
const SUPER_ADMINS = ["raventech75@gmail.com", "irzzenproductions@gmail.com"]; 

const COLLECTION_NAME = 'wedding_projects';
const LEADS_COLLECTION = 'leads';
const SETTINGS_COLLECTION = 'settings'; // Pour stocker la liste du staff

// --- Types & Interfaces ---
interface Message {
  author: 'client' | 'admin';
  text: string;
  date: any; // Timestamp
}

interface Project {
  id: string;
  clientNames: string;
  clientEmail?: string;
  clientPhone?: string;
  weddingDate: string;
  code: string;
  statusPhoto: 'waiting' | 'culling' | 'editing' | 'exporting' | 'delivered' | 'none';
  statusVideo: 'waiting' | 'cutting' | 'grading' | 'mixing' | 'delivered' | 'none';
  progressPhoto: number; 
  progressVideo: number;
  photographerName: string;
  videographerName: string;
  managerName?: string; 
  onSiteTeam?: string[]; 
  coverImage?: string; 
  estimatedDelivery?: string;
  linkPhoto?: string;
  linkVideo?: string;
  clientNotes?: string; // Legacy
  messages?: Message[]; // Nouveau système de chat
  hasUnreadMessage?: boolean; // Pour notification Admin
  hasAlbum?: boolean;
  totalPrice?: number;
  depositAmount?: number;
  isPriority?: boolean; 
  createdAt: any;
}

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
  const [view, setView] = useState<'landing' | 'client' | 'admin' | 'archive'>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [staffList, setStaffList] = useState<string[]>([]); // Liste dynamique
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) signInAnonymously(auth).catch((err) => console.error("Auth Anon Error", err));
    });
    return () => unsubscribeAuth();
  }, []);

  // Chargement Projets & Staff
  useEffect(() => {
    if (!user) return;
    
    // 1. Projets
    let colRef;
    if (typeof __app_id !== 'undefined') { colRef = collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME); } 
    else { colRef = collection(db, COLLECTION_NAME); }
    const q = query(colRef);
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
      // Tri : Unread Messages > Priority > Date
      const sortedData = data.sort((a, b) => {
          if (a.hasUnreadMessage && !b.hasUnreadMessage) return -1;
          if (!a.hasUnreadMessage && b.hasUnreadMessage) return 1;
          if (a.isPriority && !b.isPriority) return -1;
          if (!a.isPriority && b.isPriority) return 1;
          return new Date(b.weddingDate).getTime() - new Date(a.weddingDate).getTime();
      });
      setProjects(sortedData);
      setLoading(false);
    });

    // 2. Staff List (Settings)
    let settingsRef;
    if (typeof __app_id !== 'undefined') { settingsRef = doc(db, 'artifacts', appId, 'public', 'data', SETTINGS_COLLECTION, 'general'); } 
    else { settingsRef = doc(db, SETTINGS_COLLECTION, 'general'); }
    
    // On écoute le document settings
    getDoc(settingsRef).then(docSnap => {
        if(docSnap.exists()) setStaffList(docSnap.data().staff || []);
        else setDoc(settingsRef, { staff: ["Feridun", "Volkan"] }); // Init par défaut
    });

    return () => unsubscribeData();
  }, [user]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
      <div className="animate-pulse flex flex-col items-center"><Camera className="w-10 h-10 mb-4 text-stone-400" />Chargement...</div>
    </div>
  );

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
          <div className="flex items-center gap-4">
            <button onClick={() => setView('client')} className="hidden md:flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"><Search className="w-4 h-4"/> Espace Mariés</button>
            <button onClick={() => setView('admin')} className="bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center gap-2"><Lock className="w-3 h-3"/> Accès Studio</button>
          </div>
        </div>
      </nav>
      {/* Hero simple pour le code */}
      <section className="pt-48 pb-32 px-6 max-w-7xl mx-auto text-center">
         <h1 className="text-6xl font-serif mb-6">L'excellence visuelle.</h1>
         <div className="flex justify-center gap-4">
            <button onClick={() => setView('client')} className="px-8 py-4 bg-stone-900 text-white rounded-full font-medium">Espace Mariés</button>
            <button onClick={() => setView('archive')} className="px-8 py-4 border rounded-full font-medium">Archives</button>
         </div>
      </section>
    </div>
  );
}

// --- Composant Chat (Réutilisable) ---
function ChatBox({ project, userType }: { project: Project, userType: 'admin' | 'client' }) {
    const [msgText, setMsgText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const messages = project.messages || [];

    useEffect(() => {
        if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        if(!msgText.trim()) return;
        setSending(true);
        const newMessage: Message = {
            author: userType,
            text: msgText,
            date: new Date().toISOString()
        };

        let docRef;
        if (typeof __app_id !== 'undefined') { docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, project.id); } 
        else { docRef = doc(db, COLLECTION_NAME, project.id); }

        // Si le client écrit, on met hasUnreadMessage à TRUE. Si c'est l'admin, FALSE.
        const updates: any = { messages: arrayUnion(newMessage) };
        if (userType === 'client') updates.hasUnreadMessage = true;
        if (userType === 'admin') updates.hasUnreadMessage = false;

        await updateDoc(docRef, updates);
        setMsgText('');
        setSending(false);
    };

    return (
        <div className="flex flex-col h-[400px] border border-stone-200 rounded-xl bg-stone-50 overflow-hidden">
            <div className="bg-white p-4 border-b border-stone-100 flex justify-between items-center">
                <h4 className="font-bold text-stone-700 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Conversation {userType === 'admin' ? 'avec les mariés' : 'avec le studio'}</h4>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && <p className="text-center text-stone-400 text-sm mt-10">Aucun message pour le moment.</p>}
                {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.author === userType ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-xl text-sm ${m.author === userType ? 'bg-stone-800 text-white rounded-tr-none' : 'bg-white border border-stone-200 rounded-tl-none'}`}>
                            <p>{m.text}</p>
                            <span className={`text-[10px] block mt-1 ${m.author === userType ? 'text-stone-400' : 'text-stone-400'}`}>{new Date(m.date).toLocaleString()}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-3 bg-white border-t border-stone-100 flex gap-2">
                <input 
                    className="flex-1 bg-stone-100 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-200" 
                    placeholder="Votre message..." 
                    value={msgText} 
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button onClick={handleSend} disabled={sending} className="bg-stone-800 text-white p-2 rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                </button>
            </div>
        </div>
    );
}

// --- Dashboard Admin ---
function AdminDashboard({ projects, user, onLogout, staffList, setStaffList }: { projects: Project[], user: any, onLogout: () => void, staffList: string[], setStaffList: any }) {
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [newProject, setNewProject] = useState({ 
    clientNames: '', clientEmail: '', clientPhone: '', weddingDate: '', photographerName: '', videographerName: '', 
    managerName: '', onSiteTeam: [] as string[], hasPhoto: true, hasVideo: true, hasAlbum: false, isPriority: false
  });
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'late'>('all');

  const isSuperAdmin = SUPER_ADMINS.includes(user?.email);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      try { await signInWithEmailAndPassword(auth, emailInput, passInput); } 
      catch (err: any) { setErrorMsg("Email ou mot de passe incorrect."); }
  };

  const handleAddMember = async () => {
      if(!newMember.trim()) return;
      const updatedList = [...staffList, newMember];
      setStaffList(updatedList);
      
      let settingsRef;
      if (typeof __app_id !== 'undefined') { settingsRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', SETTINGS_COLLECTION, 'general'); } 
      else { settingsRef = doc(db, SETTINGS_COLLECTION, 'general'); }
      
      await setDoc(settingsRef, { staff: updatedList }, { merge: true });
      setNewMember('');
  };

  const handleRemoveMember = async (member: string) => {
      const updatedList = staffList.filter(m => m !== member);
      setStaffList(updatedList);
      let settingsRef;
      if (typeof __app_id !== 'undefined') { settingsRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', SETTINGS_COLLECTION, 'general'); } 
      else { settingsRef = doc(db, SETTINGS_COLLECTION, 'general'); }
      await setDoc(settingsRef, { staff: updatedList }, { merge: true });
  }

  if (!user || user.isAnonymous) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
         <h2 className="text-xl font-bold mb-4 flex gap-2"><Lock className="w-5 h-5" /> Accès Production</h2>
         <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="text-xs font-bold text-stone-500 uppercase">Email</label><input type="email" required className="w-full p-3 border rounded-lg" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} /></div>
            <div><label className="text-xs font-bold text-stone-500 uppercase">Mot de passe</label><input type="password" required className="w-full p-3 border rounded-lg" value={passInput} onChange={(e) => setPassInput(e.target.value)} /></div>
            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700">Se Connecter</button>
         </form>
         <button onClick={onLogout} className="mt-4 text-sm w-full hover:underline text-stone-500">Retour Accueil</button>
      </div>
    </div>
  );

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    let colRef;
    if (typeof __app_id !== 'undefined') { colRef = collection(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME); } 
    else { colRef = collection(db, COLLECTION_NAME); }
    
    const code = (newProject.clientNames.split(' ')[0] + '-' + Math.floor(Math.random() * 1000)).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    await addDoc(colRef, {
      ...newProject, code,
      statusPhoto: newProject.hasPhoto ? 'waiting' : 'none', statusVideo: newProject.hasVideo ? 'waiting' : 'none',
      progressPhoto: 0, progressVideo: 0,
      linkPhoto: '', linkVideo: '', clientNotes: '', messages: [], hasUnreadMessage: false,
      totalPrice: 0, depositAmount: 0,
      createdAt: serverTimestamp()
    });
    setIsAdding(false);
  };

  const filteredProjects = projects.filter(p => {
    const isFinished = (p.statusPhoto === 'delivered' || p.statusPhoto === 'none') && (p.statusVideo === 'delivered' || p.statusVideo === 'none');
    const isLate = new Date().getTime() - new Date(p.weddingDate).getTime() > (60 * 24 * 60 * 60 * 1000) && !isFinished;
    if (filter === 'completed') return isFinished;
    if (filter === 'active') return !isFinished;
    if (filter === 'late') return isLate;
    return true; 
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-stone-900 text-white p-2 rounded-lg"><Users className="w-5 h-5" /></div>
            <div><h1 className="font-bold text-stone-900">Dashboard</h1><p className="text-xs text-stone-500">Connecté en tant que {user.email}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTeamModal(true)} className="text-stone-500 hover:text-stone-800 px-3 py-2 text-sm font-medium transition flex items-center gap-1 border rounded-lg mr-2"><Settings className="w-4 h-4"/> Gérer l'équipe</button>
            <button onClick={onLogout} className="text-stone-500 hover:text-stone-800 px-3 py-2 text-sm font-medium transition flex items-center gap-1"><LogOut className="w-4 h-4"/> <span className="hidden sm:inline">Déconnexion</span></button>
            <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2 text-sm font-medium hover:bg-blue-700 transition"><Plus className="w-4 h-4" /> Nouveau</button>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-full text-sm font-medium ${filter === 'all' ? 'bg-stone-800 text-white' : 'bg-white text-stone-600'}`}>Tous ({projects.length})</button>
          <button onClick={() => setFilter('active')} className={`px-4 py-2 rounded-full text-sm font-medium ${filter === 'active' ? 'bg-blue-600 text-white' : 'bg-white text-stone-600'}`}>En cours</button>
          <button onClick={() => setFilter('late')} className={`px-4 py-2 rounded-full text-sm font-medium ${filter === 'late' ? 'bg-red-500 text-white' : 'bg-white text-stone-600'}`}>En retard</button>
        </div>

        <div className="grid gap-6">
          {filteredProjects.map(p => <ProjectEditor key={p.id} project={p} isSuperAdmin={isSuperAdmin} staffList={staffList} />)}
        </div>
      </main>
      
      {/* MODAL AJOUT PROJET */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-6 border-b pb-2">Nouveau Mariage</h3>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div><label className="text-sm font-medium text-stone-600 block mb-1">Mariés</label><input required placeholder="Ex: Sophie & Marc" className="w-full border rounded-lg p-2.5" value={newProject.clientNames} onChange={e => setNewProject({...newProject, clientNames: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-sm font-medium text-stone-600 block mb-1">Email</label><input type="email" placeholder="mariage@exemple.com" className="w-full border rounded-lg p-2.5" value={newProject.clientEmail} onChange={e => setNewProject({...newProject, clientEmail: e.target.value})} /></div>
                 <div><label className="text-sm font-medium text-stone-600 block mb-1">Téléphone</label><input type="tel" placeholder="06..." className="w-full border rounded-lg p-2.5" value={newProject.clientPhone} onChange={e => setNewProject({...newProject, clientPhone: e.target.value})} /></div>
              </div>
              <div><label className="text-sm font-medium text-stone-600 block mb-1">Date</label><input required type="date" className="w-full border rounded-lg p-2.5" value={newProject.weddingDate} onChange={e => setNewProject({...newProject, weddingDate: e.target.value})} /></div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <label className="flex items-center gap-2 mb-2 font-medium text-sm"><input type="checkbox" checked={newProject.hasPhoto} onChange={e => setNewProject({...newProject, hasPhoto: e.target.checked})} className="accent-amber-600" /> Photo</label>
                  {newProject.hasPhoto && (
                      <select className="w-full text-sm border rounded p-1.5" value={newProject.photographerName} onChange={e => setNewProject({...newProject, photographerName: e.target.value})}>
                          <option value="">Choisir...</option>
                          {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  )}
                </div>
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <label className="flex items-center gap-2 mb-2 font-medium text-sm"><input type="checkbox" checked={newProject.hasVideo} onChange={e => setNewProject({...newProject, hasVideo: e.target.checked})} className="accent-sky-600" /> Vidéo</label>
                  {newProject.hasVideo && (
                      <select className="w-full text-sm border rounded p-1.5" value={newProject.videographerName} onChange={e => setNewProject({...newProject, videographerName: e.target.value})}>
                          <option value="">Choisir...</option>
                          {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-8 pt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-2.5 bg-gray-100 rounded-lg">Annuler</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EQUIPE */}
      {showTeamModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold mb-4">Gérer l'équipe</h3>
                <div className="flex gap-2 mb-4">
                    <input className="flex-1 border rounded-lg p-2" placeholder="Nouveau membre..." value={newMember} onChange={e => setNewMember(e.target.value)} />
                    <button onClick={handleAddMember} className="bg-green-600 text-white px-4 rounded-lg"><Plus className="w-4 h-4"/></button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {staffList.map(member => (
                        <div key={member} className="flex justify-between items-center p-2 bg-stone-50 rounded-lg">
                            <span>{member}</span>
                            <button onClick={() => handleRemoveMember(member)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>
                <button onClick={() => setShowTeamModal(false)} className="w-full mt-4 py-2 text-stone-500 hover:bg-stone-100 rounded-lg">Fermer</button>
            </div>
          </div>
      )}
    </div>
  );
}

// --- Editeur de Projet (Admin) ---
function ProjectEditor({ project, isSuperAdmin, staffList }: { project: Project, isSuperAdmin: boolean, staffList: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState(project);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewAsClient, setViewAsClient] = useState(false); 

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

  const toggleTeamMember = (member: string) => {
      const currentTeam = localData.onSiteTeam || [];
      const newTeam = currentTeam.includes(member) ? currentTeam.filter(m => m !== member) : [...currentTeam, member];
      updateField('onSiteTeam', newTeam);
  };
  
  const handleSave = async () => {
    const { id, ...data } = localData;
    let docRef;
    if (typeof __app_id !== 'undefined') { docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, project.id); } 
    else { docRef = doc(db, COLLECTION_NAME, project.id); }
    await updateDoc(docRef, data);
    setHasChanges(false); setIsExpanded(false);
  };

  const handleDelete = async () => {
    if(!isSuperAdmin) return;
    let docRef;
    if (typeof __app_id !== 'undefined') { docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, project.id); } 
    else { docRef = doc(db, COLLECTION_NAME, project.id); }
    if (confirm('Supprimer définitivement ce projet ?')) await deleteDoc(docRef);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      setUploading(true);
      let storageRef = ref(storage, `covers/${project.id}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateField('coverImage', url);
    } catch (error: any) { alert(`Erreur: ${error.message}`); } finally { setUploading(false); }
  };

  const sendEmailInvite = () => {
      const subject = `Votre Espace Mariage - ${localData.clientNames}`;
      const body = `Félicitations pour votre mariage !\n\nSuivez l'avancement de vos photos et vidéos sur votre espace dédié.\n\nLien : ${window.location.origin}\nVotre Code d'accès : ${localData.code}\n\nÀ très vite,\nL'équipe.`;
      window.open(`mailto:${localData.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const copyInvite = () => {
    const text = `Suivi Mariage : ${window.location.origin}\nCode : ${localData.code}`;
    const textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select();
    try { document.execCommand('copy'); alert("Invitation copiée !"); } catch (err) {}
    document.body.removeChild(textArea);
  };

  const isLate = new Date().getTime() - new Date(project.weddingDate).getTime() > (60 * 24 * 60 * 60 * 1000) && (project.statusPhoto !== 'delivered' || project.statusVideo !== 'delivered');
  const remaining = (localData.totalPrice || 0) - (localData.depositAmount || 0);

  if (viewAsClient) {
      return (
        <div className="fixed inset-0 z-50 bg-stone-50 overflow-y-auto">
             <div className="p-4 bg-stone-900 text-white flex justify-between items-center sticky top-0 z-50">
                <span>Mode Prévisualisation Client</span>
                <button onClick={() => setViewAsClient(false)} className="bg-white text-black px-4 py-2 rounded">Fermer la preview</button>
             </div>
             <ClientPortal projects={[localData]} onBack={() => {}} /> 
        </div>
      );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-all ${isExpanded ? 'ring-2 ring-blue-500/20 border-blue-500' : 'border-stone-200 hover:border-blue-300'}`}>
      <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-4">
          <div className={`w-1.5 h-12 rounded-full ${project.isPriority ? 'bg-amber-500 animate-pulse' : (isLate ? 'bg-red-500' : 'bg-green-500')}`}></div>
          <div>
             <div className="flex items-center gap-2">
                 <h3 className="font-bold text-lg text-stone-900">{project.clientNames}</h3>
                 {project.isPriority && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Rocket className="w-3 h-3"/> PRIO</span>}
                 {project.hasUnreadMessage && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-bounce">Nouveau Message</span>}
             </div>
             <div className="text-sm text-stone-500 flex items-center gap-3">
               <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 select-all">{project.code}</span>
               <span>{new Date(project.weddingDate).toLocaleDateString()}</span>
               {isSuperAdmin && remaining > 0 && <span className="bg-red-100 text-red-600 px-2 rounded-full text-xs font-bold">Reste: {remaining}€</span>}
             </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="hidden sm:flex gap-4 text-right">
             {project.statusPhoto !== 'none' && (
               <div><div className="text-[10px] uppercase text-stone-400 font-bold tracking-wider">Photo</div><div className={`text-sm font-bold ${project.statusPhoto === 'delivered' ? 'text-green-600' : 'text-amber-600'}`}>{project.progressPhoto}%</div></div>
             )}
             {project.statusVideo !== 'none' && (
               <div><div className="text-[10px] uppercase text-stone-400 font-bold tracking-wider">Vidéo</div><div className={`text-sm font-bold ${project.statusVideo === 'delivered' ? 'text-green-600' : 'text-sky-600'}`}>{project.progressVideo}%</div></div>
             )}
           </div>
           <ChevronRight className={`w-5 h-5 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-stone-100 bg-stone-50/50 p-6 rounded-b-xl">
           <div className="mb-6 flex justify-between items-center">
              <div className="flex gap-2">
                  <button onClick={() => setViewAsClient(true)} className="text-xs flex items-center gap-2 bg-stone-800 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700 transition-colors"><Eye className="w-3 h-3"/> Voir comme le client</button>
                  <label className="flex items-center gap-2 text-xs font-bold text-amber-700 cursor-pointer bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100"><input type="checkbox" checked={localData.isPriority || false} onChange={e => updateField('isPriority', e.target.checked)} className="accent-amber-600" /> <Rocket className="w-3 h-3"/> Mode Priority</label>
              </div>
              <div className="flex gap-2">
                  <button onClick={sendEmailInvite} className="text-xs flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"><Mail className="w-3 h-3"/> Envoyer Email</button>
                  <button onClick={copyInvite} className="text-xs flex items-center gap-2 bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 text-stone-600 transition-colors"><Copy className="w-3 h-3"/> Copier invitation</button>
              </div>
           </div>

           <div className="grid lg:grid-cols-2 gap-6">
               <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-4">
                    <h4 className="font-bold text-stone-700 flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Infos Générales</h4>
                    <div><label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Responsable</label><input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" value={localData.managerName || ''} onChange={e => updateField('managerName', e.target.value)} /></div>
                    <div>
                        <label className="text-xs font-semibold text-stone-500 uppercase block mb-2">Équipe sur place (Tags)</label>
                        <div className="flex flex-wrap gap-2">{staffList.map(member => (<button key={member} onClick={() => toggleTeamMember(member)} className={`text-xs px-3 py-1 rounded-full border transition-all ${(localData.onSiteTeam || []).includes(member) ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}>{member}</button>))}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1 mb-1"><AtSign className="w-3 h-3" /> Email Mariés</label><input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" value={localData.clientEmail || ''} onChange={e => updateField('clientEmail', e.target.value)} /></div>
                        <div><label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1 mb-1"><Phone className="w-3 h-3" /> Téléphone</label><input className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" value={localData.clientPhone || ''} onChange={e => updateField('clientPhone', e.target.value)} /></div>
                    </div>
               </div>

               {isSuperAdmin && (
                   <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-4 relative overflow-hidden">
                        <h4 className="font-bold text-stone-700 flex items-center gap-2"><Euro className="w-4 h-4" /> Finance (Super Admin)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Total Devis (€)</label><input type="number" className="w-full text-sm font-mono border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" value={localData.totalPrice || 0} onChange={e => updateField('totalPrice', parseFloat(e.target.value))} /></div>
                            <div><label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Acompte Reçu (€)</label><input type="number" className="w-full text-sm font-mono border-b border-stone-200 py-1 focus:outline-none focus:border-stone-500 bg-transparent" value={localData.depositAmount || 0} onChange={e => updateField('depositAmount', parseFloat(e.target.value))} /></div>
                        </div>
                        <div className={`p-3 rounded-lg flex justify-between items-center ${remaining > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}><span className="text-sm font-bold">Reste à payer :</span><span className="text-lg font-bold">{remaining} €</span></div>
                   </div>
               )}
           </div>

           <div className="mt-6">
                <label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1 mb-1"><ImagePlus className="w-3 h-3" /> Photo de Couverture</label>
                <div className="flex items-start gap-3">
                    {localData.coverImage ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0 group"><img src={localData.coverImage} className="w-full h-full object-cover" alt="Preview" /><button onClick={() => updateField('coverImage', '')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"><Trash2 className="w-4 h-4" /></button></div>
                    ) : (<div className="w-16 h-16 rounded-lg bg-stone-100 flex items-center justify-center border border-dashed border-stone-300 shrink-0"><ImageIcon className="w-6 h-6 text-stone-300" /></div>)}
                    <label className={`mt-2 inline-flex items-center gap-2 cursor-pointer bg-stone-800 hover:bg-stone-700 text-white text-xs px-3 py-1.5 rounded-md transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}><input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={handleImageUpload} />{uploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3"/>} {uploading ? 'Envoi...' : 'Choisir une photo'}</label>
                </div>
           </div>

           <div className="grid md:grid-cols-2 gap-6 mt-6">
             {project.statusPhoto !== 'none' && (
               <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                 <div className="flex items-center justify-between mb-4"><h4 className="font-bold text-stone-700 flex items-center gap-2"><Camera className="w-4 h-4 text-amber-500"/> Photo</h4><span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{localData.progressPhoto}%</span></div>
                 <div className="space-y-3">
                   <div><label className="text-xs font-semibold text-stone-500 uppercase">Photographe</label>
                   <select className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-amber-500 bg-transparent" value={localData.photographerName} onChange={e => updateField('photographerName', e.target.value)}>
                        <option value="">Choisir...</option>
                        {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                   </div>
                   <div><label className="text-xs font-semibold text-stone-500 uppercase">Étape</label><div className="flex gap-2"><select className="flex-1 mt-1 p-2 bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" value={localData.statusPhoto} onChange={e => updateField('statusPhoto', e.target.value as any)}>{Object.entries(PHOTO_STEPS).filter(([k]) => k !== 'none').map(([k, s]) => (<option key={k} value={k}>{s.label}</option>))}</select></div></div>
                   <div><label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Lien Livraison</label><input className="w-full mt-1 p-2 bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="https://..." value={localData.linkPhoto || ''} onChange={e => updateField('linkPhoto', e.target.value)} /></div>
                 </div>
               </div>
             )}
             {project.statusVideo !== 'none' && (
               <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                 <div className="flex items-center justify-between mb-4"><h4 className="font-bold text-stone-700 flex items-center gap-2"><Video className="w-4 h-4 text-sky-500"/> Vidéo</h4><span className="text-xs font-bold bg-sky-100 text-sky-700 px-2 py-1 rounded-full">{localData.progressVideo}%</span></div>
                 <div className="space-y-3">
                   <div><label className="text-xs font-semibold text-stone-500 uppercase">Vidéaste</label>
                   <select className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-sky-500 bg-transparent" value={localData.videographerName} onChange={e => updateField('videographerName', e.target.value)}>
                        <option value="">Choisir...</option>
                        {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                   </div>
                   <div><label className="text-xs font-semibold text-stone-500 uppercase">Étape</label><div className="flex gap-2"><select className="flex-1 mt-1 p-2 bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none" value={localData.statusVideo} onChange={e => updateField('statusVideo', e.target.value as any)}>{Object.entries(VIDEO_STEPS).filter(([k]) => k !== 'none').map(([k, s]) => (<option key={k} value={k}>{s.label}</option>))}</select></div></div>
                   <div><label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Lien Livraison</label><input className="w-full mt-1 p-2 bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none" placeholder="https://..." value={localData.linkVideo || ''} onChange={e => updateField('linkVideo', e.target.value)} /></div>
                 </div>
               </div>
             )}
           </div>

           {/* --- CHAT ADMIN --- */}
           <div className="mt-8">
               <ChatBox project={localData} userType="admin" />
           </div>
           
           <div className="flex justify-between items-center pt-6 mt-6 border-t border-stone-200">
             {isSuperAdmin ? (
                 <button onClick={handleDelete} className="text-red-500 text-sm flex gap-1.5 hover:bg-red-50 px-3 py-2 rounded-lg transition"><Trash2 className="w-4 h-4"/> Supprimer projet</button>
             ) : <div></div>}
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

// --- Vue Client (Existante) ---
function ClientPortal({ projects, onBack }: { projects: Project[], onBack: () => void }) {
  const [searchCode, setSearchCode] = useState('');
  const [foundProject, setFoundProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    if (projects.length === 1 && projects[0].id) {
        setFoundProject(projects[0]);
    }
  }, [projects]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = searchCode.trim().toUpperCase();
    const project = projects.find(p => p.code === cleanCode);
    if (project) { 
      setFoundProject(project); 
      setError(''); 
      setImgError(false);
    } 
    else { setError('Code introuvable.'); setFoundProject(null); }
  };

  const copyProdEmail = () => {
    navigator.clipboard.writeText('irzzenproductions@gmail.com').then(() => {
      setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
    }).catch(() => {
      const textArea = document.createElement("textarea"); textArea.value = 'irzzenproductions@gmail.com'; document.body.appendChild(textArea); textArea.select();
      document.execCommand('copy'); document.body.removeChild(textArea); setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
    });
  };

  useEffect(() => { if (foundProject) setImgError(false); }, [foundProject?.coverImage]);

  if (foundProject) {
    const defaultImage = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80';
    const displayImage = (!imgError && foundProject.coverImage) ? foundProject.coverImage : defaultImage;
    
    // Check Finance
    const remaining = (foundProject.totalPrice || 0) - (foundProject.depositAmount || 0);
    const isBlocked = remaining > 0 && (foundProject.totalPrice || 0) > 0;
    
    // Calcul Jours Restants
    const delivery = foundProject.estimatedDelivery ? new Date(foundProject.estimatedDelivery) : null;
    const diffTime = delivery ? delivery.getTime() - new Date().getTime() : 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    let badgeColor = "bg-stone-100 text-stone-600";
    let badgeText = "";
    
    if (delivery) {
        if (diffDays < 0) { badgeColor = "bg-red-100 text-red-600"; badgeText = `En retard de ${Math.abs(diffDays)}j`; }
        else if (diffDays < 15) { badgeColor = "bg-amber-100 text-amber-600"; badgeText = `J-${diffDays}`; }
        else { badgeText = `J-${diffDays}`; }
    }

    return (
      <div className="min-h-screen bg-stone-50">
        <div className="relative h-[40vh] md:h-[50vh] w-full overflow-hidden bg-stone-900">
           <img src={displayImage} alt="Couverture Mariage" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" onError={() => setImgError(true)} />
           <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
           <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
             <button onClick={() => onBack()} className="absolute top-6 left-6 text-white/80 hover:text-white flex items-center gap-2 text-sm bg-black/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/20 transition-all hover:bg-black/40 z-20"><ChevronRight className="w-4 h-4 rotate-180" /> Retour</button>
             <h2 className="text-4xl md:text-6xl font-serif mb-4 drop-shadow-lg relative z-10">{foundProject.clientNames}</h2>
             <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:text-base relative z-10">
                <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 flex items-center gap-2"><Calendar className="w-4 h-4" />{new Date(foundProject.weddingDate).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</span>
                {foundProject.isPriority && <span className="bg-amber-500/90 text-white backdrop-blur-md px-4 py-1.5 rounded-full border border-amber-400/50 flex items-center gap-2 animate-pulse"><Rocket className="w-4 h-4" /> Dossier Prioritaire</span>}
             </div>
           </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10 pb-20">
          
          {foundProject.estimatedDelivery && (
             <div className="bg-white rounded-xl shadow-lg border border-amber-100 p-6 mb-8 flex items-center gap-4 animate-fade-in justify-between">
               <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-full"><Hourglass className="w-6 h-6 text-amber-600 animate-pulse-slow" /></div>
                    <div><h4 className="text-sm font-bold text-stone-500 uppercase tracking-wide">Livraison Estimée</h4><p className="text-lg font-serif text-stone-800">{new Date(foundProject.estimatedDelivery).toLocaleDateString()}</p></div>
               </div>
               <div className="flex flex-col items-end gap-2">
                   {badgeText && <span className={`px-3 py-1 rounded-full font-bold text-sm ${badgeColor}`}>{badgeText}</span>}
                   {!foundProject.isPriority && (
                       <a href={STRIPE_PRIORITY_LINK} target="_blank" className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700 underline"><Star className="w-3 h-3"/> Je suis pressé (Passer en priorité)</a>
                   )}
               </div>
             </div>
          )}

          {isBlocked && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 flex items-center gap-4 animate-pulse">
                   <AlertTriangle className="w-8 h-8 text-red-600" />
                   <div><h3 className="font-bold text-red-800 text-lg">Action requise</h3><p className="text-red-700">Le téléchargement est bloqué en attente du solde ({remaining} €). Merci de contacter l'administration.</p></div>
              </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 p-6 md:p-10 space-y-12">
            <div className={`grid gap-10 ${foundProject.statusPhoto !== 'none' && foundProject.statusVideo !== 'none' ? 'md:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'}`}>
              {foundProject.statusPhoto !== 'none' && (
                <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-amber-600"><ImageIcon className="w-6 h-6" /></div><div><h3 className="font-serif text-xl text-stone-800">Photos</h3><p className="text-sm text-stone-500 flex items-center gap-1"><Users className="w-3 h-3" /> {foundProject.photographerName || 'En attente'}</p></div></div>
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between items-end mb-2"><span className="text-sm font-medium text-stone-600 uppercase tracking-wider text-xs">Statut</span><span className="text-2xl font-bold text-amber-600">{foundProject.progressPhoto}%</span></div>
                      <div className="h-3 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${foundProject.progressPhoto}%` }} /></div>
                      <p className="text-right text-sm font-medium text-stone-700 mt-2">{PHOTO_STEPS[foundProject.statusPhoto].label}</p>
                    </div>
                  </div>
                  {foundProject.statusPhoto === 'delivered' && (isBlocked ? (<button disabled className="mt-4 w-full flex items-center justify-center gap-2 bg-stone-300 text-stone-500 py-3 rounded-xl cursor-not-allowed"><Lock className="w-4 h-4" /> Téléchargement bloqué</button>) : (foundProject.linkPhoto && (<a href={foundProject.linkPhoto} target="_blank" rel="noopener noreferrer" className="mt-4 w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-3 rounded-xl hover:bg-stone-700 transition-colors shadow-lg"><ExternalLink className="w-4 h-4" /> Accéder à la Galerie</a>)))}
                </div>
              )}
              {foundProject.statusVideo !== 'none' && (
                <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-sky-600"><Film className="w-6 h-6" /></div><div><h3 className="font-serif text-xl text-stone-800">Film</h3><p className="text-sm text-stone-500 flex items-center gap-1"><Users className="w-3 h-3" /> {foundProject.videographerName || 'En attente'}</p></div></div>
                    <div className="space-y-2 mb-6">
                       <div className="flex justify-between items-end mb-2"><span className="text-sm font-medium text-stone-600 uppercase tracking-wider text-xs">Statut</span><span className="text-2xl font-bold text-sky-600">{foundProject.progressVideo}%</span></div>
                      <div className="h-3 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-sky-500 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${foundProject.progressVideo}%` }} /></div>
                      <p className="text-right text-sm font-medium text-stone-700 mt-2">{VIDEO_STEPS[foundProject.statusVideo].label}</p>
                    </div>
                  </div>
                  {foundProject.statusVideo === 'delivered' && (isBlocked ? (<button disabled className="mt-4 w-full flex items-center justify-center gap-2 bg-stone-300 text-stone-500 py-3 rounded-xl cursor-not-allowed"><Lock className="w-4 h-4" /> Téléchargement bloqué</button>) : (foundProject.linkVideo && (<a href={foundProject.linkVideo} target="_blank" rel="noopener noreferrer" className="mt-4 w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-3 rounded-xl hover:bg-stone-700 transition-colors shadow-lg"><ExternalLink className="w-4 h-4" /> Télécharger le Film</a>)))}
                </div>
              )}
            </div>
            {foundProject.hasAlbum && foundProject.statusPhoto === 'delivered' && !isBlocked && (
              <div className="mt-12 bg-stone-800 rounded-2xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-stone-700 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6"><div className="bg-stone-700 p-3 rounded-xl"><BookOpen className="w-6 h-6 text-amber-200" /></div><h3 className="font-serif text-2xl">Production de l'Album</h3></div>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4"><p className="text-stone-300">Votre galerie est livrée ! Pour l'album, merci d'envoyer votre sélection.</p><ul className="space-y-2 text-sm text-stone-400"><li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Sélectionnez vos photos</li><li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Créez un dossier unique</li></ul></div>
                    <div className="bg-stone-900/50 p-6 rounded-xl border border-stone-700"><div className="mb-4"><label className="text-xs uppercase text-stone-500 font-bold mb-1 block">Adresse d'envoi</label><div className="flex items-center gap-2 bg-stone-800 p-2 rounded-lg border border-stone-700"><code className="flex-1 text-sm text-amber-100">irzzenproductions@gmail.com</code><button onClick={copyProdEmail} className="p-1.5 hover:bg-stone-700 rounded text-stone-400 hover:text-white transition-colors">{emailCopied ? <ClipboardCheck className="w-4 h-4 text-green-400"/> : <Copy className="w-4 h-4"/>}</button></div></div><a href="https://wetransfer.com/" target="_blank" rel="noopener noreferrer" className="w-full bg-white text-stone-900 py-3 rounded-lg font-medium hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">Envoyer ma sélection <ArrowRight className="w-4 h-4"/></a></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* --- CHAT CLIENT --- */}
            <div className="mt-8">
               <ChatBox project={foundProject} userType="client" />
            </div>

          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <button onClick={() => onBack()} className="absolute top-6 left-6 text-stone-400 hover:text-stone-800 flex gap-2 transition-colors"><LogOut className="w-4 h-4" /> Accueil</button>
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

// --- Vue Archive (Lead Capture) ---
function ArchiveView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setStep(1.5);
  };

  const handleCaptureLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let colRef;
    if (typeof __app_id !== 'undefined') { colRef = collection(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', LEADS_COLLECTION); } 
    else { colRef = collection(db, LEADS_COLLECTION); }
    try {
        await addDoc(colRef, {
            name: leadName, email: leadEmail, phone: leadPhone, weddingDate: date,
            createdAt: serverTimestamp(), source: 'archive_check'
        });
    } catch (err) { console.error("Erreur sauvegarde lead", err); }
    setLoading(false);
    
    const year = new Date(date).getFullYear();
    if (year < 2022) { setStep(3); } else { setStep(2); }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 relative">
       <button onClick={onBack} className="absolute top-6 left-6 text-stone-400 hover:text-white flex gap-2 transition-colors"><LogOut className="w-4 h-4" /> Retour</button>
       
       <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
         <div className="bg-stone-100 p-6 text-center border-b border-stone-200">
            <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-lg"><ShieldCheck className="w-8 h-8" /></div>
            <h2 className="text-2xl font-serif text-stone-900">Vérification des Archives</h2>
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
                  <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-4 border-2 border-stone-200 rounded-xl focus:border-stone-800 outline-none transition-colors" />
                </div>
                <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-transform active:scale-95">Vérifier mes fichiers</button>
              </form>
            )}

            {step === 1.5 && (
               <form onSubmit={handleCaptureLead} className="space-y-4 animate-fade-in">
                  <div className="text-center mb-6"><h3 className="font-bold text-lg text-stone-900">Sécurisation de la requête</h3><p className="text-sm text-stone-500">Pour accéder au résultat, confirmez vos coordonnées.</p></div>
                  <div><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Nom & Prénom</label><input required type="text" value={leadName} onChange={(e) => setLeadName(e.target.value)} className="w-full p-3 border rounded-lg" /></div>
                  <div><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Email</label><input required type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} className="w-full p-3 border rounded-lg" /></div>
                  <div><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Téléphone</label><input required type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} className="w-full p-3 border rounded-lg" /></div>
                  <button disabled={loading} type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Accéder au résultat'}</button>
               </form>
            )}

            {step === 2 && (
              <div className="text-center space-y-6 animate-fade-in">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600"><CheckCircle className="w-8 h-8" /></div>
                <div><h3 className="text-2xl font-bold text-stone-900">Bonne nouvelle !</h3><p className="text-stone-600 mt-2">Vos fichiers sont présents.</p></div>
                <div className="bg-stone-50 p-6 rounded-xl border border-stone-200 text-left space-y-4">
                  <div className="flex justify-between items-center"><span className="font-bold text-stone-700">Taille estimée</span><span className="font-mono text-stone-500">~450 Go</span></div>
                  <div className="flex justify-between items-center"><span className="font-bold text-stone-900">Pack Sécurité à vie</span><span className="text-2xl font-bold text-green-600">199 €</span></div>
                </div>
                <a href={STRIPE_ARCHIVE_LINK} target="_blank" rel="noopener noreferrer" className="block w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-200 text-center flex items-center justify-center gap-2">
                  <CreditCard className="w-5 h-5"/> Sécuriser maintenant (CB)
                </a>
              </div>
            )}

            {step === 3 && (
               <div className="text-center space-y-6 animate-fade-in">
                 <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500"><History className="w-8 h-8" /></div>
                 <div><h3 className="text-xl font-bold text-stone-900">Archives Indisponibles</h3><p className="text-stone-600 mt-2 text-sm">Désolé, les serveurs d'avant 2022 ont été purgés.</p></div>
                 <button onClick={() => setStep(1)} className="text-stone-400 underline text-sm hover:text-stone-800">Réessayer une autre date</button>
               </div>
            )}
         </div>
       </div>
    </div>
  );
}