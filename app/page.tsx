'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, Search, Lock, CheckCircle, 
  AlertCircle, Plus, Users, Calendar, ChevronRight, 
  LogOut, Image as ImageIcon, Film, Save, Trash2,
  Clock, Link as LinkIcon, ExternalLink,
  UserCheck, Users as UsersIcon, ImagePlus, Hourglass,
  Upload, Loader2, AtSign, MessageSquare, Send,
  Copy, ClipboardCheck, BookOpen, ArrowRight, HardDrive, ShieldCheck, History,
  Euro, Eye, AlertTriangle, CreditCard, X, Phone, Rocket, Star, Mail, Settings, AlertOctagon, Music, Disc, Download, Ban, CheckSquare
} from 'lucide-react';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, serverTimestamp, setDoc, getDoc, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut 
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';

// --- Globales ---
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;
declare const __app_id: string | undefined;

const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config as string);
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
const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/iwf8nbt3tywmywp6u89xgn7e2nar0bbs"; 
const SUPER_ADMINS = ["admin@raventech.fr", "irzzenproductions@gmail.com"]; 
const STRIPE_ARCHIVE_LINK = "https://buy.stripe.com/3cI3cv3jq2j37x9eFy5gc0b";
const STRIPE_PRIORITY_LINK = "https://buy.stripe.com/VOTRE_LIEN_PRIORITE"; 

const DEFAULT_STAFF = ["Feridun", "Volkan", "Ali", "Steeven", "Taner", "Yunus", "Emir", "Serife"];

const COLLECTION_NAME = 'wedding_projects';
const LEADS_COLLECTION = 'leads';
const SETTINGS_COLLECTION = 'settings'; 

interface Message { id: string; author: 'client' | 'admin'; text: string; date: any; }
interface Remuneration { name: string; amount: number; note: string; paid?: boolean; }
interface AlbumOrder { id: string; name: string; format: string; price: number; status: string; stripeLink?: string; paid: boolean; }

interface Project {
  id: string;
  clientNames: string;
  clientEmail?: string;
  clientEmail2?: string;
  clientPhone?: string;
  clientPhone2?: string;
  weddingDate: string;
  code: string;
  
  statusPhoto: 'waiting' | 'culling' | 'editing' | 'exporting' | 'delivered' | 'none';
  statusVideo: 'waiting' | 'cutting' | 'grading' | 'mixing' | 'delivered' | 'none';
  progressPhoto: number; 
  progressVideo: number;
  
  photographerName: string;
  videographerName: string;
  managerName?: string; 
  managerEmail?: string; 
  onSiteTeam?: string[]; 
  
  coverImage?: string; 
  estimatedDeliveryPhoto?: string;
  estimatedDeliveryVideo?: string;
  linkPhoto?: string;
  linkVideo?: string;
  
  // Validation Client (Preuve)
  deliveryConfirmed?: boolean;
  deliveryConfirmationDate?: any;

  messages?: Message[]; 
  hasUnreadMessage?: boolean; 
  
  musicLinks?: string; 
  musicInstructions?: string;
  
  // Albums Multiple
  albums?: AlbumOrder[];

  totalPrice?: number;
  depositAmount?: number;
  teamPayments?: Remuneration[];
  financeNotes?: string;
  
  isPriority?: boolean; 
  createdAt: any;
  lastUpdated?: any;
}

const PHOTO_STEPS = {
  'waiting': { label: 'En attente', percent: 5 },
  'culling': { label: 'Tri & Sélection', percent: 30 },
  'editing': { label: 'Retouches & Colo', percent: 65 },
  'exporting': { label: 'Export HD', percent: 90 },
  'delivered': { label: 'Livré', percent: 100 },
  'none': { label: 'Non inclus', percent: 0 }
};

const VIDEO_STEPS = {
  'waiting': { label: 'En attente', percent: 5 },
  'cutting': { label: 'Montage', percent: 35 },
  'grading': { label: 'Étalonnage', percent: 70 },
  'mixing': { label: 'Finalisation', percent: 90 },
  'delivered': { label: 'Livré', percent: 100 },
  'none': { label: 'Non inclus', percent: 0 }
};

const ALBUM_STATUSES = {
  'pending': 'En attente',
  'selection': 'Sélection reçue',
  'design': 'Mise en page',
  'print': 'Impression',
  'sent': 'Expédié'
};
// --- COMPOSANT PRINCIPAL ---
export default function WeddingTracker() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'client' | 'admin' | 'archive'>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [staffList, setStaffList] = useState<string[]>(DEFAULT_STAFF);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) signInAnonymously(auth).catch((err) => console.error("Auth Anon Error", err));
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const colPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    const q = query(collection(db, colPath));
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
      // Tri par date de mariage
      setProjects(data.sort((a, b) => new Date(b.weddingDate).getTime() - new Date(a.weddingDate).getTime()));
      setLoading(false);
    });

    const settingsPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${SETTINGS_COLLECTION}` : SETTINGS_COLLECTION;
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
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-serif leading-[1.1]">L'art de sublimer <br/><span className="text-stone-400 italic">vos souvenirs.</span></h1>
            <p className="text-base md:text-lg text-stone-500 max-w-md mx-auto lg:mx-0 leading-relaxed">Une expérience digitale complète pour suivre votre reportage.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button onClick={() => setView('client')} className="px-8 py-4 bg-stone-900 text-white rounded-full font-medium hover:bg-black transition-transform hover:scale-105 shadow-xl flex items-center justify-center gap-2">Accéder à mon mariage <ArrowRight className="w-4 h-4" /></button>
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
    const colPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${LEADS_COLLECTION}` : LEADS_COLLECTION;
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

// --- Chat ---
function ChatBox({ project, userType, disabled }: { project: Project, userType: 'admin' | 'client', disabled?: boolean }) {
    const [msgText, setMsgText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messages = project.messages || [];

    useEffect(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

    const handleSend = async () => {
        if(!msgText.trim()) return;
        setSending(true);
        const newMessage: Message = { id: Date.now().toString(), author: userType, text: msgText, date: new Date().toISOString() };
        const colPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
        await updateDoc(doc(db, colPath, project.id), { messages: arrayUnion(newMessage), hasUnreadMessage: userType === 'client', lastUpdated: serverTimestamp() });
        
        if (MAKE_WEBHOOK_URL && !MAKE_WEBHOOK_URL.includes('VOTRE_URL')) {
            const targetEmail = userType === 'client' ? (project.managerEmail || 'admin@raventech.fr') : project.clientEmail;
            if (targetEmail) {
                fetch(MAKE_WEBHOOK_URL, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'new_message', author: userType, targetEmail: targetEmail, clientName: project.clientNames, msg: msgText, url: window.location.origin })
                }).catch(err => console.error(err));
            }
        }
        setMsgText(''); setSending(false);
    };

    return (
        <div className="flex flex-col h-[400px] border border-stone-200 rounded-xl bg-stone-50 overflow-hidden shadow-sm">
            <div className="bg-white p-3 border-b flex justify-between items-center"><h4 className="font-bold text-sm">Messagerie</h4></div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.author === userType ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.author === 'admin' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
                            <p className="whitespace-pre-wrap">{m.text}</p>
                            <span className="text-[9px] block mt-1 opacity-60 text-right">{new Date(m.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                    </div>
                ))}
            </div>
            {!disabled && (
                <div className="p-2 bg-white border-t flex gap-2">
                    <input className="flex-1 bg-stone-100 rounded-full px-4 py-3 text-sm" placeholder="Message..." value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
                    <button onClick={handleSend} disabled={sending} className="bg-blue-600 text-white p-3 rounded-full"><Send className="w-4 h-4"/></button>
                </div>
            )}
        </div>
    );
}
// --- Client Portal ---
function ClientPortal({ projects, onBack }: { projects: Project[], onBack: () => void }) {
  const [searchCode, setSearchCode] = useState('');
  const [foundProject, setFoundProject] = useState<Project | null>(null);
  const [musicLinks, setMusicLinks] = useState('');
  const [musicInstructions, setMusicInstructions] = useState('');
  const [savingMusic, setSavingMusic] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projects.length === 1 && projects[0].id) setFoundProject(projects[0]);
    else if (foundProject) { const live = projects.find(p => p.id === foundProject.id); if(live) setFoundProject(live); }
  }, [projects, foundProject]);

  useEffect(() => { if(foundProject) { setMusicLinks(foundProject.musicLinks || ''); setMusicInstructions(foundProject.musicInstructions || ''); } }, [foundProject]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = projects.find(p => p.code === searchCode.trim().toUpperCase());
    if (p) { setFoundProject(p); setError(''); } else setError('Code invalide');
  };

  const handleSaveMusic = async () => {
      if(!foundProject) return;
      setSavingMusic(true);
      const colPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { musicLinks, musicInstructions, lastUpdated: serverTimestamp() });
      alert("Enregistré !");
      setSavingMusic(false);
  };

  const confirmDelivery = async () => {
      if(!foundProject || !confirm("Confirmer la bonne réception de tous les fichiers ? Cette action est définitive.")) return;
      const colPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, foundProject.id), { deliveryConfirmed: true, deliveryConfirmationDate: serverTimestamp() });
      alert("Merci ! Votre confirmation a bien été reçue.");
  };

  if (foundProject) {
    const isBlocked = ((foundProject.totalPrice || 0) - (foundProject.depositAmount || 0)) > 0 && (foundProject.totalPrice || 0) > 0;
    
    return (
      <div className="min-h-screen bg-stone-50 pb-20">
        <div className="bg-stone-900 text-white p-10 text-center relative">
             <button onClick={onBack} className="absolute top-6 left-6 text-white/50 hover:text-white flex gap-2 items-center"><ChevronRight className="rotate-180 w-4 h-4"/> Retour</button>
             <h2 className="text-4xl font-serif mb-2">{foundProject.clientNames}</h2>
             <span className="bg-white/20 px-4 py-1 rounded-full text-sm">{new Date(foundProject.weddingDate).toLocaleDateString()}</span>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 -mt-8 space-y-8 relative z-10">
          
          {/* CONFIRMATION DE LIVRAISON (NOUVEAU) */}
          {(foundProject.statusPhoto === 'delivered' || foundProject.statusVideo === 'delivered') && !foundProject.deliveryConfirmed && !isBlocked && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                  <div>
                      <h3 className="font-bold text-green-900 text-lg flex items-center gap-2"><CheckCircle className="w-5 h-5"/> Confirmation de réception</h3>
                      <p className="text-green-800 text-sm">Avez-vous bien téléchargé et vérifié vos fichiers ?</p>
                  </div>
                  <button onClick={confirmDelivery} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-md flex items-center gap-2">
                      <CheckSquare className="w-5 h-5"/> Je confirme la bonne réception
                  </button>
              </div>
          )}

          {foundProject.deliveryConfirmed && (
              <div className="bg-stone-100 border border-stone-200 rounded-xl p-4 flex items-center justify-center gap-2 text-stone-500 text-sm italic">
                  <CheckCircle className="w-4 h-4"/> Réception confirmée le {new Date(foundProject.deliveryConfirmationDate?.seconds * 1000).toLocaleDateString()}
              </div>
          )}

          {isBlocked && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4 text-red-800">
                   <AlertTriangle className="w-6 h-6" />
                   <div><h3 className="font-bold">Paiement en attente</h3><p className="text-sm">Le téléchargement sera débloqué une fois le solde réglé.</p></div>
              </div>
          )}

          {/* CARTES PHOTO / VIDEO */}
          <div className="grid md:grid-cols-2 gap-6">
              {foundProject.statusPhoto !== 'none' && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
                  <div className="flex items-center gap-4 mb-4"><div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center"><ImageIcon/></div><h3 className="font-bold text-lg">Photos</h3></div>
                  <div className="mb-4">
                      <div className="flex justify-between text-sm font-bold text-stone-500 mb-1"><span>Progression</span><span>{foundProject.progressPhoto}%</span></div>
                      <div className="h-2 bg-stone-100 rounded-full"><div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${foundProject.progressPhoto}%` }} /></div>
                      <p className="text-right text-xs mt-1 text-stone-400">{PHOTO_STEPS[foundProject.statusPhoto].label}</p>
                  </div>
                  {foundProject.estimatedDeliveryPhoto && <div className="mb-4 bg-amber-50 text-amber-800 text-xs p-3 rounded-lg flex items-center gap-2"><Calendar className="w-4 h-4"/> Livraison estimée : <strong>{new Date(foundProject.estimatedDeliveryPhoto).toLocaleDateString()}</strong></div>}
                  {foundProject.statusPhoto === 'delivered' && !isBlocked && <a href={foundProject.linkPhoto} target="_blank" className="block w-full bg-stone-900 text-white text-center py-2 rounded-lg text-sm font-bold">Voir la Galerie</a>}
                </div>
              )}

              {foundProject.statusVideo !== 'none' && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
                  <div className="flex items-center gap-4 mb-4"><div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><Film/></div><h3 className="font-bold text-lg">Vidéo</h3></div>
                  <div className="mb-4">
                      <div className="flex justify-between text-sm font-bold text-stone-500 mb-1"><span>Progression</span><span>{foundProject.progressVideo}%</span></div>
                      <div className="h-2 bg-stone-100 rounded-full"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${foundProject.progressVideo}%` }} /></div>
                      <p className="text-right text-xs mt-1 text-stone-400">{VIDEO_STEPS[foundProject.statusVideo].label}</p>
                  </div>
                  {foundProject.estimatedDeliveryVideo && <div className="mb-4 bg-blue-50 text-blue-800 text-xs p-3 rounded-lg flex items-center gap-2"><Calendar className="w-4 h-4"/> Livraison estimée : <strong>{new Date(foundProject.estimatedDeliveryVideo).toLocaleDateString()}</strong></div>}
                  {foundProject.statusVideo === 'delivered' && !isBlocked && <a href={foundProject.linkVideo} target="_blank" className="block w-full bg-stone-900 text-white text-center py-2 rounded-lg text-sm font-bold">Télécharger</a>}
                </div>
              )}
          </div>

          {/* ALBUMS SUPPLEMENTAIRES (CLIENT) */}
          {foundProject.albums && foundProject.albums.length > 0 && (
              <div className="bg-stone-100 p-6 rounded-2xl border border-stone-200">
                  <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-4"><BookOpen className="w-5 h-5"/> Vos commandes d'albums</h3>
                  <div className="space-y-3">
                      {foundProject.albums.map((album, i) => (
                          <div key={i} className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm">
                              <div>
                                  <div className="font-bold">{album.name} ({album.format})</div>
                                  <div className="text-xs text-stone-500">{ALBUM_STATUSES[album.status as keyof typeof ALBUM_STATUSES]}</div>
                              </div>
                              <div>
                                  {!album.paid && album.stripeLink && <a href={album.stripeLink} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold mr-2">Payer {album.price}€</a>}
                                  {album.paid && <span className="bg-stone-100 text-stone-500 px-2 py-1 rounded text-xs border">Payé</span>}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* MUSIQUE & CHAT */}
          {foundProject.statusVideo !== 'none' && (
             <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                <h3 className="font-bold text-purple-900 flex items-center gap-2 mb-4"><Music/> Musique & Montage</h3>
                <textarea className="w-full p-3 rounded-xl border mb-2" rows={2} placeholder="Liens Youtube..." value={musicLinks} onChange={e => setMusicLinks(e.target.value)}/>
                <input className="w-full p-3 rounded-xl border mb-2" placeholder="Instructions..." value={musicInstructions} onChange={e => setMusicInstructions(e.target.value)}/>
                <button onClick={handleSaveMusic} disabled={savingMusic} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Sauvegarder</button>
             </div>
          )}
          <ChatBox project={foundProject} userType="client" />
          
          {/* OPTION FAST TRACK */}
          {!foundProject.isPriority && (
              <div className="bg-white border border-amber-200 p-6 rounded-2xl flex justify-between items-center shadow-lg shadow-amber-50">
                  <div><h4 className="font-bold text-lg text-stone-900 flex items-center gap-2"><Rocket className="text-amber-500"/> Option Fast Track</h4><p className="text-sm text-stone-500">Recevez vos images en 1 semaine.</p></div>
                  <a href={STRIPE_PRIORITY_LINK} className="bg-amber-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-600 transition">Activer (290 €)</a>
              </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-stone-100">
       <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <h2 className="text-2xl font-serif mb-6">Accès Mariés</h2>
          <form onSubmit={handleSearch} className="space-y-4">
             <input className="w-full p-4 border rounded-xl text-center text-lg uppercase tracking-widest" placeholder="CODE..." value={searchCode} onChange={e => setSearchCode(e.target.value)}/>
             <button className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold">Entrer</button>
          </form>
          {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
       </div>
    </div>
  );
}
// --- Dashboard Admin ---
function AdminDashboard({ projects, user, onLogout, staffList, setStaffList }: { projects: Project[], user: any, onLogout: () => void, staffList: string[], setStaffList: any }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'late'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  
  const [newProject, setNewProject] = useState({ 
    clientNames: '', clientEmail: '', clientEmail2: '', clientPhone: '', clientPhone2: '', weddingDate: '', 
    photographerName: '', videographerName: '', managerName: '', managerEmail: '',
    onSiteTeam: [] as string[], hasPhoto: true, hasVideo: true
  });

  const isSuperAdmin = SUPER_ADMINS.includes(user?.email);

  // --- LOGIQUE INTELLIGENTE DES COMPTEURS ---
  const counts = {
    all: projects.length,
    active: projects.filter(p => (p.statusPhoto !== 'delivered' && p.statusPhoto !== 'none') || (p.statusVideo !== 'delivered' && p.statusVideo !== 'none')).length,
    late: projects.filter(p => {
      // Retard = Date mariage > 60 jours ET Non livré
      const limit = new Date(p.weddingDate).getTime() + (60 * 24 * 3600 * 1000); 
      const isNotFinished = (p.statusPhoto !== 'delivered' && p.statusPhoto !== 'none') || (p.statusVideo !== 'delivered' && p.statusVideo !== 'none');
      return Date.now() > limit && isNotFinished;
    }).length
  };

  const exportCSV = () => {
    const headers = ["Mariés", "Email 1", "Email 2", "Tel 1", "Tel 2", "Date Mariage", "Date Prevu Photo", "Date Prevu Video", "Statut Photo", "Statut Video"];
    const rows = projects.map(p => [
        p.clientNames, p.clientEmail, p.clientEmail2, p.clientPhone, p.clientPhone2, 
        new Date(p.weddingDate).toLocaleDateString(), 
        p.estimatedDeliveryPhoto ? new Date(p.estimatedDeliveryPhoto).toLocaleDateString() : "",
        p.estimatedDeliveryVideo ? new Date(p.estimatedDeliveryVideo).toLocaleDateString() : "",
        p.statusPhoto, p.statusVideo
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${c || ''}"`).join(","))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csvContent], {type:'text/csv;charset=utf-8;'}));
    link.download = "marketing_export.csv"; link.click();
  };

  const handleLogin = async (e:any) => { e.preventDefault(); await signInWithEmailAndPassword(auth, emailInput, passInput); };
  const addTeam = async () => { if(!newMember) return; const list=[...staffList, newMember]; setStaffList(list); const colPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${SETTINGS_COLLECTION}` : SETTINGS_COLLECTION; await setDoc(doc(db, colPath, 'general'), {staff:list}, {merge:true}); setNewMember(''); };
  
  const createProject = async (e:any) => {
      e.preventDefault();
      const code = (newProject.clientNames.split(' ')[0] + '-' + Math.floor(Math.random()*1000)).toUpperCase();
      const colPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await addDoc(collection(db, colPath), { ...newProject, code, statusPhoto: newProject.hasPhoto?'waiting':'none', statusVideo: newProject.hasVideo?'waiting':'none', progressPhoto:0, progressVideo:0, messages:[], createdAt: serverTimestamp() });
      setIsAdding(false);
  };

  if (!user || user.isAnonymous) return (
      <div className="h-screen flex items-center justify-center bg-stone-100">
          <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-80 space-y-4">
              <h2 className="font-bold text-xl"><Lock className="inline w-5 h-5"/> Admin</h2>
              <input type="email" value={emailInput} onChange={e=>setEmailInput(e.target.value)} className="w-full p-2 border rounded" placeholder="Email" required/>
              <input type="password" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-2 border rounded" placeholder="Password" required/>
              <button className="w-full bg-blue-600 text-white p-2 rounded">Login</button>
          </form>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm p-4 flex justify-between items-center">
        <div className="flex items-center gap-3"><div className="bg-stone-900 text-white p-2 rounded-lg"><Users className="w-5 h-5" /></div><h1 className="font-bold text-stone-900 text-lg">Dashboard</h1></div>
        <div className="flex gap-2">
          {isSuperAdmin && <button onClick={exportCSV} className="p-2 border rounded hover:bg-stone-100" title="Export CSV"><Download className="w-5 h-5"/></button>}
          <button onClick={() => setShowTeamModal(true)} className="p-2 border rounded hover:bg-stone-100"><Settings className="w-5 h-5"/></button>
          <button onClick={onLogout} className="p-2 border rounded hover:bg-stone-100"><LogOut className="w-5 h-5"/></button>
          <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-4 rounded flex items-center gap-2 font-bold"><Plus className="w-4 h-4"/> Nouveau</button>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
            <button onClick={()=>setFilter('all')} className={`px-4 py-2 rounded-full text-sm font-bold ${filter==='all'?'bg-stone-800 text-white':'bg-white text-stone-600'}`}>Tous ({counts.all})</button>
            <button onClick={()=>setFilter('active')} className={`px-4 py-2 rounded-full text-sm font-bold ${filter==='active'?'bg-blue-600 text-white':'bg-white text-stone-600'}`}>En cours ({counts.active})</button>
            <button onClick={()=>setFilter('late')} className={`px-4 py-2 rounded-full text-sm font-bold ${filter==='late'?'bg-red-500 text-white':'bg-white text-stone-600'}`}>En retard ({counts.late})</button>
        </div>
        <div className="grid gap-4">
            {projects.filter(p => {
                const finished = (p.statusPhoto === 'delivered' || p.statusPhoto === 'none') && (p.statusVideo === 'delivered' || p.statusVideo === 'none');
                const late = !finished && (Date.now() > new Date(p.weddingDate).getTime() + (60*24*3600*1000));
                if(filter === 'active') return !finished;
                if(filter === 'late') return late;
                return true;
            }).map(p => <ProjectEditor key={p.id} project={p} isSuperAdmin={isSuperAdmin} staffList={staffList} user={user} />)}
        </div>
      </main>

      {/* MODALS AJOUT & EQUIPE (Simplifiés pour tenir) */}
      {isAdding && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-4">Nouveau Mariage</h3>
                  <form onSubmit={createProject} className="space-y-4">
                      <input required placeholder="Mariés" className="w-full p-2 border rounded" onChange={e => setNewProject({...newProject, clientNames: e.target.value})}/>
                      <div className="grid grid-cols-2 gap-4">
                          <input type="email" placeholder="Email 1" className="p-2 border rounded" onChange={e => setNewProject({...newProject, clientEmail: e.target.value})}/>
                          <input type="tel" placeholder="Tel 1" className="p-2 border rounded" onChange={e => setNewProject({...newProject, clientPhone: e.target.value})}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <input type="email" placeholder="Email 2" className="p-2 border rounded" onChange={e => setNewProject({...newProject, clientEmail2: e.target.value})}/>
                          <input type="tel" placeholder="Tel 2" className="p-2 border rounded" onChange={e => setNewProject({...newProject, clientPhone2: e.target.value})}/>
                      </div>
                      <input required type="date" className="w-full p-2 border rounded" onChange={e => setNewProject({...newProject, weddingDate: e.target.value})}/>
                      <select className="w-full p-2 border rounded" onChange={e => setNewProject({...newProject, managerName: e.target.value})}>
                          <option value="">Choisir Responsable</option>
                          {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="email" placeholder="Email Responsable (Notif)" className="w-full p-2 border rounded" onChange={e => setNewProject({...newProject, managerEmail: e.target.value})}/>
                      <div className="flex gap-4">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={newProject.hasPhoto} onChange={e=>setNewProject({...newProject, hasPhoto:e.target.checked})}/> Photo</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={newProject.hasVideo} onChange={e=>setNewProject({...newProject, hasVideo:e.target.checked})}/> Vidéo</label>
                      </div>
                      <button className="w-full bg-blue-600 text-white p-3 rounded font-bold">Créer</button>
                      <button type="button" onClick={() => setIsAdding(false)} className="w-full text-stone-400">Annuler</button>
                  </form>
              </div>
          </div>
      )}
      {showTeamModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold mb-4">Gérer l'équipe</h3>
                  <div className="flex gap-2 mb-4"><input className="flex-1 border rounded p-2" value={newMember} onChange={e=>setNewMember(e.target.value)} placeholder="Nom"/><button onClick={addTeam} className="bg-green-600 text-white px-3 rounded"><Plus/></button></div>
                  <div className="space-y-2">{staffList.map(m => <div key={m} className="bg-stone-50 p-2 rounded flex justify-between">{m}</div>)}</div>
                  <button onClick={() => setShowTeamModal(false)} className="w-full mt-4 p-2 bg-stone-100 rounded">Fermer</button>
              </div>
          </div>
      )}
    </div>
  );
}

// --- Project Editor (Avec Albums Multiples) ---
function ProjectEditor({ project, isSuperAdmin, staffList, user }: { project: Project, isSuperAdmin: boolean, staffList: string[], user: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState(project);
  const [hasChanges, setHasChanges] = useState(false);
  
  // State pour Nouvel Album
  const [newAlbum, setNewAlbum] = useState({ name: 'Album Mariés', format: '30x30', price: 0 });

  const isManager = user?.email && project.managerEmail && user.email.toLowerCase() === project.managerEmail.toLowerCase();
  const canEdit = isSuperAdmin || isManager;

  // LOGIQUE COULEURS D'ETAT
  const now = Date.now();
  const limitDate = new Date(project.weddingDate).getTime() + (60 * 24 * 3600 * 1000); // 60 jours
  const lastUpdate = project.lastUpdated?.toMillis() || project.createdAt?.toMillis() || now;
  const daysInactive = (now - lastUpdate) / (1000 * 3600 * 24);
  
  const isFinished = (project.statusPhoto === 'delivered' || project.statusPhoto === 'none') && (project.statusVideo === 'delivered' || project.statusVideo === 'none');
  const isLate = !isFinished && now > limitDate;
  const isStale = !isFinished && !isLate && daysInactive > 15;

  let borderColor = 'border-stone-200';
  if (isLate) borderColor = 'border-red-500 border-2';
  else if (isStale) borderColor = 'border-orange-400 border-2';
  else if (isExpanded) borderColor = 'border-blue-400 ring-1 ring-blue-100';

  useEffect(() => { if (!hasChanges) setLocalData(project); }, [project]);

  const updateField = (k: keyof Project, v: any) => { 
    if(!canEdit) return;
    setLocalData(p => {
        const newState = { ...p, [k]: v };
        if(k === 'statusPhoto') newState.progressPhoto = PHOTO_STEPS[v as keyof typeof PHOTO_STEPS].percent;
        if(k === 'statusVideo') newState.progressVideo = VIDEO_STEPS[v as keyof typeof VIDEO_STEPS].percent;
        return newState;
    });
    setHasChanges(true); 
  };

  const addAlbum = () => {
      const albums = localData.albums || [];
      updateField('albums', [...albums, { id: Date.now().toString(), ...newAlbum, status: 'pending', paid: false }]);
  };

  const updateAlbum = (idx: number, field: string, val: any) => {
      const albums = [...(localData.albums || [])];
      albums[idx] = { ...albums[idx], [field]: val };
      updateField('albums', albums);
  };

  const save = async () => {
      const colPath = typeof __app_id !== 'undefined' ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, project.id), { ...localData, lastUpdated: serverTimestamp() });
      if (localData.statusPhoto !== project.statusPhoto || localData.statusVideo !== project.statusVideo) {
          fetch(MAKE_WEBHOOK_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'step_update', clientName: localData.clientNames, clientEmail: localData.clientEmail, stepName: localData.statusPhoto !== project.statusPhoto ? PHOTO_STEPS[localData.statusPhoto].label : VIDEO_STEPS[localData.statusVideo].label, url: window.location.origin })
          }).catch(console.error);
      }
      setHasChanges(false); setIsExpanded(false);
  };

  const invite = async () => {
      fetch(MAKE_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'invite', clientName: localData.clientNames, clientEmail: localData.clientEmail, projectCode: localData.code, url: window.location.origin }) });
      alert("Invitation envoyée !");
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-all ${borderColor}`}>
        <div className="p-4 flex justify-between cursor-pointer items-center" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex gap-4 items-center">
                <div className={`w-1.5 h-10 rounded-full ${project.statusPhoto === 'delivered' ? 'bg-green-500' : 'bg-blue-500'}`} />
                <div>
                    <h3 className="font-bold flex items-center gap-2">
                        {project.clientNames}
                        {isLate && <span className="bg-red-100 text-red-600 text-[10px] px-2 rounded-full">RETARD</span>}
                        {isStale && <span className="bg-orange-100 text-orange-600 text-[10px] px-2 rounded-full">INACTIF +15J</span>}
                    </h3>
                    <p className="text-xs text-stone-500">{new Date(project.weddingDate).toLocaleDateString()} - {project.managerName}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {project.deliveryConfirmed && <span className="text-green-600 text-xs font-bold flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Reçu</span>}
                {!canEdit && <span className="text-xs bg-stone-100 px-2 py-1 rounded flex items-center gap-1"><Ban className="w-3 h-3"/> Lecture seule</span>}
                <ChevronRight className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </div>
        </div>

        {isExpanded && (
            <div className="p-6 border-t bg-stone-50/30 space-y-6">
                {project.deliveryConfirmed && (
                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm text-green-800 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4"/> 
                        Le client a confirmé la réception des fichiers le {new Date(project.deliveryConfirmationDate?.seconds * 1000).toLocaleString()}.
                    </div>
                )}

                <div className="flex justify-between">
                    <div className="flex gap-2">
                        <label className={`text-xs font-bold px-3 py-2 rounded border cursor-pointer ${localData.isPriority ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white'}`}><input disabled={!canEdit} type="checkbox" className="hidden" checked={localData.isPriority||false} onChange={e=>updateField('isPriority', e.target.checked)}/> <Rocket className="w-3 h-3 inline"/> Fast Track</label>
                        <button onClick={invite} className="text-xs bg-white border px-3 py-2 rounded flex items-center gap-1"><Mail className="w-3 h-3"/> Inviter</button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border space-y-3">
                    <h4 className="font-bold text-sm text-stone-500 uppercase">Contacts</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <input disabled={!canEdit} className="p-2 border rounded text-sm" value={localData.clientEmail} onChange={e=>updateField('clientEmail', e.target.value)} placeholder="Email 1" />
                        <input disabled={!canEdit} className="p-2 border rounded text-sm" value={localData.clientPhone} onChange={e=>updateField('clientPhone', e.target.value)} placeholder="Tel 1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input disabled={!canEdit} className="p-2 border rounded text-sm" value={localData.clientEmail2 || ''} onChange={e=>updateField('clientEmail2', e.target.value)} placeholder="Email 2" />
                        <input disabled={!canEdit} className="p-2 border rounded text-sm" value={localData.clientPhone2 || ''} onChange={e=>updateField('clientPhone2', e.target.value)} placeholder="Tel 2" />
                    </div>
                </div>

                {/* ALBUMS INCREMENTAUX */}
                <div className="bg-white p-4 rounded-xl border space-y-4">
                    <h4 className="font-bold text-sm text-stone-500 uppercase flex items-center gap-2"><BookOpen className="w-4 h-4"/> Commandes Albums</h4>
                    {(localData.albums || []).map((album, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-stone-50 p-2 rounded">
                            <div className="flex-1 text-sm font-bold">{album.name} ({album.format})</div>
                            <select disabled={!canEdit} value={album.status} onChange={e => updateAlbum(idx, 'status', e.target.value)} className="text-xs p-1 border rounded">
                                {Object.entries(ALBUM_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <input disabled={!canEdit} placeholder="Lien Stripe" value={album.stripeLink || ''} onChange={e => updateAlbum(idx, 'stripeLink', e.target.value)} className="text-xs p-1 border rounded w-32"/>
                            <button disabled={!canEdit} onClick={() => updateAlbum(idx, 'paid', !album.paid)} className={`px-2 py-1 text-[10px] rounded font-bold ${album.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{album.paid ? 'PAYÉ' : 'IMPAYÉ'}</button>
                            {canEdit && <button onClick={() => { const a = [...(localData.albums||[])]; a.splice(idx, 1); updateField('albums', a); }} className="text-red-400"><Trash2 className="w-3 h-3"/></button>}
                        </div>
                    ))}
                    {canEdit && (
                        <div className="flex gap-2 items-center pt-2 border-t">
                            <input className="p-1 border rounded text-xs" placeholder="Nom (ex: Album Parents)" value={newAlbum.name} onChange={e => setNewAlbum({...newAlbum, name: e.target.value})} />
                            <select className="p-1 border rounded text-xs" value={newAlbum.format} onChange={e => setNewAlbum({...newAlbum, format: e.target.value})}>{ALBUM_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}</select>
                            <input type="number" className="p-1 border rounded text-xs w-20" placeholder="Prix €" value={newAlbum.price} onChange={e => setNewAlbum({...newAlbum, price: parseFloat(e.target.value)})} />
                            <button onClick={addAlbum} className="bg-stone-800 text-white px-3 py-1 rounded text-xs">Ajouter</button>
                        </div>
                    )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-xl border">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Camera className="w-4 h-4"/> Photo</h4>
                        <select disabled={!canEdit} className="w-full p-2 border rounded mb-2 text-sm" value={localData.statusPhoto} onChange={e=>updateField('statusPhoto', e.target.value)}>{Object.entries(PHOTO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                        <input disabled={!canEdit} type="date" className="w-full p-2 border rounded mb-2 text-sm" value={localData.estimatedDeliveryPhoto || ''} onChange={e=>updateField('estimatedDeliveryPhoto', e.target.value)} />
                        <input disabled={!canEdit} className="w-full p-2 border rounded text-sm" placeholder="Lien Galerie" value={localData.linkPhoto} onChange={e=>updateField('linkPhoto', e.target.value)}/>
                    </div>
                    <div className="bg-white p-4 rounded-xl border">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Video className="w-4 h-4"/> Vidéo</h4>
                        <select disabled={!canEdit} className="w-full p-2 border rounded mb-2 text-sm" value={localData.statusVideo} onChange={e=>updateField('statusVideo', e.target.value)}>{Object.entries(VIDEO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                        <input disabled={!canEdit} type="date" className="w-full p-2 border rounded mb-2 text-sm" value={localData.estimatedDeliveryVideo || ''} onChange={e=>updateField('estimatedDeliveryVideo', e.target.value)} />
                        <input disabled={!canEdit} className="w-full p-2 border rounded text-sm" placeholder="Lien Film" value={localData.linkVideo} onChange={e=>updateField('linkVideo', e.target.value)}/>
                    </div>
                </div>

                <ChatBox project={project} userType="admin" disabled={!canEdit} />

                {canEdit && (
                    <div className="flex justify-end pt-4 border-t">
                        <button onClick={save} disabled={!hasChanges} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50">Enregistrer</button>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}