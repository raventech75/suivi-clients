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
  Euro, Eye, AlertTriangle, CreditCard, X, Phone, Rocket, Star, Mail, Settings, AlertOctagon, Music, Disc
} from 'lucide-react';

// --- Configuration Firebase ---
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
const SUPER_ADMINS = ["admin@raventech.fr", "irzzenproductions@gmail.com"]; 
const STRIPE_ARCHIVE_LINK = "https://buy.stripe.com/3cI3cv3jq2j37x9eFy5gc0b";
const STRIPE_PRIORITY_LINK = "https://buy.stripe.com/VOTRE_LIEN_PRIORITE";

const DEFAULT_STAFF = ["Feridun", "Volkan", "Ali", "Steeven", "Taner", "Yunus", "Emir", "Serife"];
const ALBUM_FORMATS = ["30x20", "30x30", "40x30", "40x30 + 2x 18x24", "Autre"];

const COLLECTION_NAME = 'wedding_projects';
const LEADS_COLLECTION = 'leads';
const SETTINGS_COLLECTION = 'settings'; 

// --- Types ---
interface Message { id: string; author: 'client' | 'admin'; text: string; date: any; }
interface Remuneration { name: string; amount: number; note: string; }

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
  managerEmail?: string; 
  onSiteTeam?: string[]; 
  coverImage?: string; 
  estimatedDelivery?: string;
  linkPhoto?: string;
  linkVideo?: string;
  messages?: Message[]; 
  hasUnreadMessage?: boolean; 
  clientNotes?: string; 
  musicLinks?: string; 
  musicInstructions?: string;
  albumFormat?: string;
  albumNotes?: string;
  hasAlbum?: boolean;
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

export default function WeddingTracker() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'client' | 'admin' | 'archive'>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [staffList, setStaffList] = useState<string[]>([]);
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
    
    let colRef;
    if (typeof __app_id !== 'undefined') { colRef = collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME); } 
    else { colRef = collection(db, COLLECTION_NAME); }
    
    const q = query(colRef);
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
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

    let settingsRef;
    if (typeof __app_id !== 'undefined') { settingsRef = doc(db, 'artifacts', appId, 'public', 'data', SETTINGS_COLLECTION, 'general'); } 
    else { settingsRef = doc(db, SETTINGS_COLLECTION, 'general'); }
    
    getDoc(settingsRef).then(docSnap => {
        if(docSnap.exists() && docSnap.data().staff && docSnap.data().staff.length > 0) {
            setStaffList(docSnap.data().staff);
        } else {
            setDoc(settingsRef, { staff: DEFAULT_STAFF });
            setStaffList(DEFAULT_STAFF);
        }
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

// --- Vue Accueil (Landing Page) ---
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
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-serif leading-[1.1]">
              L'art de sublimer <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-stone-800 to-stone-500">vos souvenirs.</span>
            </h1>
            <p className="text-base md:text-lg text-stone-500 max-w-md mx-auto lg:mx-0 leading-relaxed">
              Une expérience digitale complète pour suivre votre reportage, valider vos montages et sécuriser votre patrimoine visuel à vie.
            </p>
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
      
      <footer className="bg-white border-t border-stone-100 py-12 text-center text-sm text-stone-500">
        © 2026 RavenTech Solutions.
      </footer>
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
                  <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-4 border-2 border-stone-200 rounded-xl focus:border-stone-800 outline-none transition-colors text-lg" />
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

// --- Composant Chat ---
function ChatBox({ project, userType }: { project: Project, userType: 'admin' | 'client' }) {
    const [msgText, setMsgText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messages = project.messages || [];

    useEffect(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

    const handleSend = async () => {
        if(!msgText.trim()) return;
        setSending(true);
        const newMessage: Message = { id: Date.now().toString(), author: userType, text: msgText, date: new Date().toISOString() };
        let docRef;
        if (typeof __app_id !== 'undefined') { docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, project.id); } 
        else { docRef = doc(db, COLLECTION_NAME, project.id); }

        const updates: any = { messages: arrayUnion(newMessage), lastUpdated: serverTimestamp() };
        if (userType === 'client') updates.hasUnreadMessage = true;
        if (userType === 'admin') updates.hasUnreadMessage = false;

        await updateDoc(docRef, updates);
        setMsgText('');
        setSending(false);
    };

    const handleDeleteMessage = async (msgToDelete: Message) => {
        if (!confirm("Supprimer ce message ?")) return;
        const updatedMessages = messages.filter(m => m.id !== msgToDelete.id);
        let docRef;
        if (typeof __app_id !== 'undefined') { docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, project.id); } 
        else { docRef = doc(db, COLLECTION_NAME, project.id); }
        await updateDoc(docRef, { messages: updatedMessages });
    };

    return (
        <div className="flex flex-col h-[400px] border border-stone-200 rounded-xl bg-stone-50 overflow-hidden shadow-sm">
            <div className="bg-white p-3 border-b border-stone-100 flex justify-between items-center"><h4 className="font-bold text-stone-700 text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Messagerie</h4></div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && <p className="text-center text-stone-400 text-xs mt-10">Démarrez la conversation !</p>}
                {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.author === userType ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm relative group ${m.author === userType ? 'bg-stone-800 text-white rounded-tr-none' : 'bg-white border border-stone-200 rounded-tl-none text-stone-800 shadow-sm'}`}>
                            <p className="whitespace-pre-wrap">{m.text}</p>
                            <span className="text-[9px] block mt-1 opacity-60 text-right">{new Date(m.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            {userType === 'admin' && (<button onClick={() => handleDeleteMessage(m)} className="absolute -top-2 -right-2 bg-red-100 text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>)}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-2 bg-white border-t border-stone-100 flex gap-2">
                <input className="flex-1 bg-stone-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-200" placeholder="Votre message..." value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
                <button onClick={handleSend} disabled={sending} className="bg-stone-800 text-white p-3 rounded-full hover:bg-stone-700 transition-colors disabled:opacity-50">{sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}</button>
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
    clientNames: '', clientEmail: '', clientPhone: '', weddingDate: '', 
    photographerName: '', videographerName: '', managerName: '', managerEmail: '',
    onSiteTeam: [] as string[], hasPhoto: true, hasVideo: true, hasAlbum: false, isPriority: false
  });
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'late'>('all');

  const isSuperAdmin = SUPER_ADMINS.includes(user?.email);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      try { await signInWithEmailAndPassword(auth, emailInput, passInput); } 
      catch (err: any) { setErrorMsg("Identifiants incorrects."); }
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
      <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full">
         <h2 className="text-xl font-bold mb-4 flex gap-2"><Lock className="w-5 h-5" /> Accès Production</h2>
         <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="text-xs font-bold text-stone-500 uppercase">Email</label><input type="email" required className="w-full p-3 border rounded-lg text-base" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} /></div>
            <div><label className="text-xs font-bold text-stone-500 uppercase">Mot de passe</label><input type="password" required className="w-full p-3 border rounded-lg text-base" value={passInput} onChange={(e) => setPassInput(e.target.value)} /></div>
            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 text-lg">Se Connecter</button>
         </form>
         <button onClick={onLogout} className="mt-4 text-sm w-full text-center text-stone-500 py-2">Retour Accueil</button>
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
      linkPhoto: '', linkVideo: '', messages: [], hasUnreadMessage: false,
      totalPrice: 0, depositAmount: 0, teamPayments: [],
      createdAt: serverTimestamp(), lastUpdated: serverTimestamp()
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
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-stone-900 text-white p-2 rounded-lg"><Users className="w-5 h-5" /></div>
                <div><h1 className="font-bold text-stone-900 text-lg">Dashboard</h1><p className="text-xs text-stone-500 truncate max-w-[150px]">{user.email}</p></div>
            </div>
            <div className="flex items-center gap-2 md:hidden">
                <button onClick={() => setShowTeamModal(true)} className="p-2 border rounded-lg bg-stone-100"><Settings className="w-5 h-5 text-stone-600"/></button>
                <button onClick={() => setIsAdding(true)} className="p-2 bg-blue-600 text-white rounded-lg"><Plus className="w-5 h-5"/></button>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => setShowTeamModal(true)} className="text-stone-500 hover:text-stone-800 px-3 py-2 text-sm font-medium transition flex items-center gap-1 border rounded-lg mr-2"><Settings className="w-4 h-4"/> Équipe</button>
            <button onClick={onLogout} className="text-stone-500 hover:text-stone-800 px-3 py-2 text-sm font-medium transition flex items-center gap-1"><LogOut className="w-4 h-4"/> Déconnexion</button>
            <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2 text-sm font-medium hover:bg-blue-700 transition"><Plus className="w-4 h-4" /> Nouveau</button>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${filter === 'all' ? 'bg-stone-800 text-white' : 'bg-white text-stone-600'}`}>Tous ({projects.length})</button>
          <button onClick={() => setFilter('active')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${filter === 'active' ? 'bg-blue-600 text-white' : 'bg-white text-stone-600'}`}>En cours</button>
          <button onClick={() => setFilter('late')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${filter === 'late' ? 'bg-red-500 text-white' : 'bg-white text-stone-600'}`}>En retard</button>
        </div>
        <div className="grid gap-4 md:gap-6">
          {filteredProjects.map(p => <ProjectEditor key={p.id} project={p} isSuperAdmin={isSuperAdmin} staffList={staffList} />)}
        </div>
      </main>
      
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-2">
                <h3 className="text-lg font-bold">Nouveau Dossier</h3>
                <button onClick={() => setIsAdding(false)}><X className="w-6 h-6 text-stone-400" /></button>
            </div>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div><label className="text-sm font-medium text-stone-600 block mb-1">Mariés</label><input required placeholder="Ex: Sophie & Marc" className="w-full border rounded-lg p-3 text-base" value={newProject.clientNames} onChange={e => setNewProject({...newProject, clientNames: e.target.value})} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div><label className="text-sm font-medium text-stone-600 block mb-1">Email Client</label><input type="email" className="w-full border rounded-lg p-3 text-base" value={newProject.clientEmail} onChange={e => setNewProject({...newProject, clientEmail: e.target.value})} /></div>
                 <div><label className="text-sm font-medium text-stone-600 block mb-1">Téléphone</label><input type="tel" className="w-full border rounded-lg p-3 text-base" value={newProject.clientPhone} onChange={e => setNewProject({...newProject, clientPhone: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div><label className="text-sm font-medium text-stone-600 block mb-1">Date Mariage</label><input required type="date" className="w-full border rounded-lg p-3 text-base" value={newProject.weddingDate} onChange={e => setNewProject({...newProject, weddingDate: e.target.value})} /></div>
                 <div>
                     <label className="text-sm font-medium text-stone-600 block mb-1">Responsable</label>
                     <select className="w-full border rounded-lg p-3 text-base bg-white" value={newProject.managerName} onChange={e => setNewProject({...newProject, managerName: e.target.value})}>
                        <option value="">Sélectionner...</option>
                        {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                 </div>
              </div>
              <div><label className="text-sm font-medium text-stone-600 block mb-1">Email du Responsable (Pour notif)</label><input type="email" className="w-full border rounded-lg p-3 text-base" placeholder="responsable@agence.com" value={newProject.managerEmail} onChange={e => setNewProject({...newProject, managerEmail: e.target.value})} /></div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <label className="flex items-center gap-2 mb-2 font-medium text-sm"><input type="checkbox" checked={newProject.hasPhoto} onChange={e => setNewProject({...newProject, hasPhoto: e.target.checked})} className="w-5 h-5 accent-amber-600" /> Photo</label>
                  {newProject.hasPhoto && (
                      <select className="w-full text-sm border rounded p-2 bg-white" value={newProject.photographerName} onChange={e => setNewProject({...newProject, photographerName: e.target.value})}>
                          <option value="">Qui photographie ?</option>
                          {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  )}
                </div>
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <label className="flex items-center gap-2 mb-2 font-medium text-sm"><input type="checkbox" checked={newProject.hasVideo} onChange={e => setNewProject({...newProject, hasVideo: e.target.checked})} className="w-5 h-5 accent-sky-600" /> Vidéo</label>
                  {newProject.hasVideo && (
                      <select className="w-full text-sm border rounded p-2 bg-white" value={newProject.videographerName} onChange={e => setNewProject({...newProject, videographerName: e.target.value})}>
                          <option value="">Qui filme ?</option>
                          {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  )}
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-lg">Créer le projet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EQUIPE */}
      {showTeamModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold mb-4">Gérer l'équipe (Tags)</h3>
                <div className="flex gap-2 mb-4">
                    <input className="flex-1 border rounded-lg p-3 text-base" placeholder="Nouveau membre..." value={newMember} onChange={e => setNewMember(e.target.value)} />
                    <button onClick={handleAddMember} className="bg-green-600 text-white px-4 rounded-lg"><Plus className="w-6 h-6"/></button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {staffList.length === 0 && <p className="text-stone-400 text-center italic">Aucun membre. Ajoutez-en un !</p>}
                    {staffList.map(member => (
                        <div key={member} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                            <span className="font-medium">{member}</span>
                            <button onClick={() => handleRemoveMember(member)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-5 h-5"/></button>
                        </div>
                    ))}
                </div>
                <button onClick={() => setShowTeamModal(false)} className="w-full mt-6 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl">Fermer</button>
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
  const [sendingInvite, setSendingInvite] = useState(false);
  const [viewAsClient, setViewAsClient] = useState(false); 
  
  // States pour Finance
  const [newPayName, setNewPayName] = useState('');
  const [newPayAmount, setNewPayAmount] = useState('');

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

  // Finance Helpers
  const addPayment = () => {
      if(!newPayName || !newPayAmount) return;
      const payments = localData.teamPayments || [];
      updateField('teamPayments', [...payments, { name: newPayName, amount: parseFloat(newPayAmount), note: '' }]);
      setNewPayName(''); setNewPayAmount('');
  };
  const removePayment = (idx: number) => {
      const payments = [...(localData.teamPayments || [])];
      payments.splice(idx, 1);
      updateField('teamPayments', payments);
  };
  
  const handleSave = async () => {
    const { id, ...data } = localData;
    let docRef;
    if (typeof __app_id !== 'undefined') { docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, project.id); } 
    else { docRef = doc(db, COLLECTION_NAME, project.id); }
    
    // Si statut change, on peut envoyer une notif
    const finalData = { ...data, lastUpdated: serverTimestamp() };
    await updateDoc(docRef, finalData);
    
    // Si l'admin modifie, on peut notifier le manager responsable si son email est là
    if(localData.managerEmail && MAKE_WEBHOOK_URL && !MAKE_WEBHOOK_URL.includes('VOTRE_URL')) {
        fetch(MAKE_WEBHOOK_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'update_manager', clientName: localData.clientNames, managerEmail: localData.managerEmail, status: 'Mise à jour dossier' })
        }).catch(err => console.error(err));
    }

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

  const sendInviteViaWebhook = async () => {
      if (!localData.clientEmail) { alert("Veuillez renseigner l'email du client."); return; }
      if (MAKE_WEBHOOK_URL.includes('VOTRE_URL_ICI')) { alert("Configurez le Webhook Make dans le code !"); return; }
      setSendingInvite(true);
      try {
          await fetch(MAKE_WEBHOOK_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'invite', clientName: localData.clientNames, clientEmail: localData.clientEmail, projectCode: localData.code, url: window.location.origin })
          });
          alert(`Invitation envoyée !`);
      } catch (error) { console.error(error); alert("Erreur envoi."); } 
      finally { setSendingInvite(false); }
  };

  const copyInvite = () => {
    const text = `Suivi Mariage : ${window.location.origin}\nCode : ${localData.code}`;
    const textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select();
    try { document.execCommand('copy'); alert("Lien copié !"); } catch (err) {}
    document.body.removeChild(textArea);
  };

  const now = Date.now();
  const lastUpdate = project.lastUpdated?.toMillis() || project.createdAt?.toMillis() || now;
  const diffDays = (now - lastUpdate) / (1000 * 60 * 60 * 24);
  const isInactive = diffDays > 7 && (project.statusPhoto !== 'delivered' || project.statusVideo !== 'delivered');
  const isLate = new Date().getTime() - new Date(project.weddingDate).getTime() > (60 * 24 * 60 * 60 * 1000) && (project.statusPhoto !== 'delivered' || project.statusVideo !== 'delivered');
  const remaining = (localData.totalPrice || 0) - (localData.depositAmount || 0);

  if (viewAsClient) {
      return (
        <div className="fixed inset-0 z-50 bg-stone-50 overflow-y-auto">
             <div className="p-4 bg-stone-900 text-white flex justify-between items-center sticky top-0 z-50"><span>Preview Client</span><button onClick={() => setViewAsClient(false)} className="bg-white text-black px-4 py-2 rounded">Fermer</button></div>
             <ClientPortal projects={[project]} onBack={() => {}} /> 
        </div>
      );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-all ${isInactive ? 'border-red-500 border-2' : 'border-stone-200'} hover:border-blue-300`}>
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between cursor-pointer gap-4" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-4">
          <div className={`w-1.5 h-12 rounded-full flex-shrink-0 ${project.isPriority ? 'bg-amber-500 animate-pulse' : (isLate ? 'bg-red-500' : 'bg-green-500')}`}></div>
          <div>
             <div className="flex flex-wrap items-center gap-2">
                 <h3 className="font-bold text-lg text-stone-900">{project.clientNames}</h3>
                 {isInactive && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-red-200 animate-pulse"><AlertOctagon className="w-3 h-3"/> Inactif +7j</span>}
                 {project.isPriority && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Rocket className="w-3 h-3"/> PRIO</span>}
                 {project.hasUnreadMessage && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-bounce">MSG</span>}
             </div>
             <div className="text-sm text-stone-500 flex flex-wrap items-center gap-3 mt-1">
               <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 select-all">{project.code}</span>
               <span>{new Date(project.weddingDate).toLocaleDateString()}</span>
               {isSuperAdmin && remaining > 0 && <span className="bg-red-100 text-red-600 px-2 rounded-full text-xs font-bold">Reste: {remaining}€</span>}
             </div>
          </div>
        </div>
        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto pl-6 md:pl-0">
           <div className="flex gap-4 text-right">
             {project.statusPhoto !== 'none' && (<div><div className="text-[10px] uppercase text-stone-400 font-bold tracking-wider">Photo</div><div className={`text-sm font-bold ${project.statusPhoto === 'delivered' ? 'text-green-600' : 'text-amber-600'}`}>{project.progressPhoto}%</div></div>)}
             {project.statusVideo !== 'none' && (<div><div className="text-[10px] uppercase text-stone-400 font-bold tracking-wider">Vidéo</div><div className={`text-sm font-bold ${project.statusVideo === 'delivered' ? 'text-green-600' : 'text-sky-600'}`}>{project.progressVideo}%</div></div>)}
           </div>
           <ChevronRight className={`w-5 h-5 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-stone-100 bg-stone-50/50 p-4 md:p-6 rounded-b-xl">
           <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <button onClick={() => setViewAsClient(true)} className="flex-1 md:flex-none justify-center text-xs flex items-center gap-2 bg-stone-800 text-white px-3 py-2 rounded-lg hover:bg-stone-700 transition-colors"><Eye className="w-3 h-3"/> Voir comme le client</button>
                  <label className="flex-1 md:flex-none justify-center flex items-center gap-2 text-xs font-bold text-amber-700 cursor-pointer bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-100"><input type="checkbox" checked={localData.isPriority || false} onChange={e => updateField('isPriority', e.target.checked)} className="accent-amber-600" /> <Rocket className="w-3 h-3"/> Fast Track</label>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={sendInviteViaWebhook} disabled={sendingInvite} className="flex-1 md:flex-none justify-center text-xs flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">{sendingInvite ? <Loader2 className="w-3 h-3 animate-spin"/> : <Mail className="w-3 h-3"/>} Inviter (Email)</button>
                  <button onClick={copyInvite} className="text-xs flex items-center gap-2 bg-white border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 text-stone-600 transition-colors"><Copy className="w-3 h-3"/></button>
              </div>
           </div>

           <div className="grid lg:grid-cols-2 gap-6">
               <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-4">
                    <h4 className="font-bold text-stone-700 flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Infos Générales</h4>
                    <div>
                        <label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Responsable</label>
                        <div className="flex gap-2">
                            <select className="w-full text-sm border-b border-stone-200 py-1 bg-transparent" value={localData.managerName} onChange={e => updateField('managerName', e.target.value)}>
                                <option value="">Sélectionner...</option>
                                {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input className="w-full text-sm border-b border-stone-200 py-1 bg-transparent" placeholder="Email notif" value={localData.managerEmail || ''} onChange={e => updateField('managerEmail', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-stone-500 uppercase block mb-2">Équipe (Tags)</label>
                        <div className="flex flex-wrap gap-2">{staffList.map(member => (<button key={member} onClick={() => toggleTeamMember(member)} className={`text-xs px-3 py-2 rounded-full border transition-all ${(localData.onSiteTeam || []).includes(member) ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}>{member}</button>))}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        
                        <div className="border-t border-stone-100 pt-3">
                            <label className="text-xs font-semibold text-stone-500 uppercase block mb-2">Rémunérations Équipe</label>
                            <div className="space-y-2 mb-3">
                                {localData.teamPayments?.map((pay, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm bg-stone-50 p-2 rounded">
                                        <span>{pay.name}</span>
                                        <span className="font-mono">{pay.amount}€</span>
                                        <button onClick={() => removePayment(i)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3"/></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <select className="flex-1 text-sm border rounded p-1" value={newPayName} onChange={e => setNewPayName(e.target.value)}>
                                    <option value="">Qui payer ?</option>
                                    {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <input className="w-20 text-sm border rounded p-1" type="number" placeholder="€" value={newPayAmount} onChange={e => setNewPayAmount(e.target.value)} />
                                <button onClick={addPayment} className="bg-green-600 text-white px-3 rounded text-xs"><Plus className="w-3 h-3"/></button>
                            </div>
                        </div>
                        
                        <div className="pt-2"><label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Notes Finance</label><textarea className="w-full text-sm border-b border-stone-200 py-1 bg-transparent h-12" placeholder="Mémo interne..." value={localData.financeNotes || ''} onChange={e => updateField('financeNotes', e.target.value)} /></div>
                   </div>
               )}
           </div>

           {/* --- ALBUMS --- */}
           <div className="mt-6 bg-stone-50 p-4 rounded-xl border border-stone-200">
               <h4 className="font-bold text-stone-700 flex items-center gap-2 mb-4"><BookOpen className="w-4 h-4" /> Commande Album</h4>
               <div className="flex flex-col md:flex-row gap-4">
                   <div className="flex-1">
                       <label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Format Album</label>
                       <select className="w-full text-sm border rounded p-2 bg-white" value={localData.albumFormat || ''} onChange={e => updateField('albumFormat', e.target.value)}>
                           <option value="">Aucun album</option>
                           {ALBUM_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                       </select>
                   </div>
                   <div className="flex-[2]">
                       <label className="text-xs font-semibold text-stone-500 uppercase block mb-1">Notes Album</label>
                       <input className="w-full text-sm border rounded p-2 bg-white" placeholder="Détails (couverture, pages supp...)" value={localData.albumNotes || ''} onChange={e => updateField('albumNotes', e.target.value)} />
                   </div>
               </div>
           </div>

           <div className="mt-6">
                <label className="text-xs font-semibold text-stone-500 uppercase flex items-center gap-1 mb-1"><ImagePlus className="w-3 h-3" /> Photo de Couverture</label>
                <div className="flex items-start gap-3">
                    {localData.coverImage ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0 group"><img src={localData.coverImage} className="w-full h-full object-cover" alt="Preview" /><button onClick={() => updateField('coverImage', '')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"><Trash2 className="w-4 h-4" /></button></div>
                    ) : (<div className="w-16 h-16 rounded-lg bg-stone-100 flex items-center justify-center border border-dashed border-stone-300 shrink-0"><ImageIcon className="w-6 h-6 text-stone-300" /></div>)}
                    <label className={`mt-2 inline-flex items-center gap-2 cursor-pointer bg-stone-800 hover:bg-stone-700 text-white text-xs px-3 py-2 rounded-lg transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}><input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={handleImageUpload} />{uploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3"/>} {uploading ? 'Envoi...' : 'Choisir une photo'}</label>
                </div>
           </div>

           <div className="grid md:grid-cols-2 gap-6 mt-6">
             {project.statusPhoto !== 'none' && (
               <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                 <div className="flex items-center justify-between mb-4"><h4 className="font-bold text-stone-700 flex items-center gap-2"><Camera className="w-4 h-4 text-amber-500"/> Photo</h4><span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{localData.progressPhoto}%</span></div>
                 <div className="space-y-3">
                   <div><label className="text-xs font-semibold text-stone-500 uppercase">Photographe</label>
                   <select className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-amber-500 bg-transparent h-8" value={localData.photographerName} onChange={e => updateField('photographerName', e.target.value)}>
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
                   <select className="w-full text-sm border-b border-stone-200 py-1 focus:outline-none focus:border-sky-500 bg-transparent h-8" value={localData.videographerName} onChange={e => updateField('videographerName', e.target.value)}>
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

           {/* --- CHAT ADMIN LIVE --- */}
           <div className="mt-8">
               {/* Important: On passe le projet LIVE pour que les messages soient synchronisés */}
               <ChatBox project={project} userType="admin" />
           </div>
           
           <div className="flex justify-between items-center pt-6 mt-6 border-t border-stone-200">
             {isSuperAdmin ? (
                 <button onClick={handleDelete} className="text-red-500 text-xs md:text-sm flex gap-1.5 hover:bg-red-50 px-3 py-2 rounded-lg transition"><Trash2 className="w-4 h-4"/> Supprimer</button>
             ) : <div></div>}
             <div className="flex gap-3">
               {hasChanges && <button onClick={() => { setLocalData(project); setHasChanges(false); }} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">Annuler</button>}
               <button onClick={handleSave} disabled={!hasChanges} className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all text-sm ${hasChanges ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}>Enregistrer</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}