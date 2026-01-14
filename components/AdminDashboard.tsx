'use client';
import React, { useState } from 'react';
import { Users, Lock, Download, Settings, LogOut, Plus, Trash2, Search as SearchIcon } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db, appId } from '../lib/firebase';
import { COLLECTION_NAME, SETTINGS_COLLECTION, SUPER_ADMINS, Project } from '../lib/config';
import ProjectEditor from './ProjectEditor';

export default function AdminDashboard({ projects, user, onLogout, staffList, setStaffList }: { projects: Project[], user: any, onLogout: () => void, staffList: string[], setStaffList: any }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'late' | 'urgent'>('all');
  const [searchTerm, setSearchTerm] = useState('');
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

  // --- LOGIQUE COMPTEURS ---
  const getProjectStatus = (p: Project) => {
      const now = Date.now();
      const wedDate = new Date(p.weddingDate).getTime();
      const isDone = (p.statusPhoto === 'delivered' || p.statusPhoto === 'none') && (p.statusVideo === 'delivered' || p.statusVideo === 'none');
      
      if (isDone) return 'completed';
      if (now > wedDate + (60 * 24 * 3600 * 1000)) return 'urgent'; // > 60j
      if (now > wedDate + (15 * 24 * 3600 * 1000)) return 'late'; // > 15j
      return 'active';
  };

  const counts = {
    all: projects.length,
    active: projects.filter(p => getProjectStatus(p) === 'active').length,
    late: projects.filter(p => getProjectStatus(p) === 'late').length,
    urgent: projects.filter(p => getProjectStatus(p) === 'urgent').length,
  };

  const exportCSV = () => {
    const headers = ["Mariés", "Email 1", "Email 2", "Tel 1", "Tel 2", "Adresse", "Ville", "Date Mariage", "Prevu Photo", "Prevu Video", "Statut Photo", "Statut Video", "Validé Client ?"];
    const rows = projects.map(p => [
        p.clientNames, p.clientEmail, p.clientEmail2, p.clientPhone, p.clientPhone2, 
        p.clientAddress, p.clientCity,
        new Date(p.weddingDate).toLocaleDateString(), 
        p.estimatedDeliveryPhoto ? new Date(p.estimatedDeliveryPhoto).toLocaleDateString() : "",
        p.estimatedDeliveryVideo ? new Date(p.estimatedDeliveryVideo).toLocaleDateString() : "",
        p.statusPhoto, p.statusVideo, p.deliveryConfirmed ? "OUI" : "NON"
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${c || ''}"`).join(","))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csvContent], {type:'text/csv;charset=utf-8;'}));
    link.download = "marketing_export.csv"; link.click();
  };

  // HANDLERS
  const handleLogin = async (e:any) => { e.preventDefault(); await signInWithEmailAndPassword(auth, emailInput, passInput); };
  
  const addTeam = async () => { 
      if(!newMember) return; 
      const list=[...staffList, newMember]; setStaffList(list); 
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${SETTINGS_COLLECTION}` : SETTINGS_COLLECTION; 
      await setDoc(doc(db, colPath, 'general'), {staff:list}, {merge:true}); 
      setNewMember(''); 
  };

  const handleRemoveMember = async (member: string) => {
      const list = staffList.filter(m => m !== member);
      setStaffList(list);
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${SETTINGS_COLLECTION}` : SETTINGS_COLLECTION;
      await setDoc(doc(db, colPath, 'general'), {staff:list}, {merge:true});
  };
  
  const createProject = async (e:any) => {
      e.preventDefault();
      const code = (newProject.clientNames.split(' ')[0] + '-' + Math.floor(Math.random()*1000)).toUpperCase();
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await addDoc(collection(db, colPath), { ...newProject, code, statusPhoto: newProject.hasPhoto?'waiting':'none', statusVideo: newProject.hasVideo?'waiting':'none', progressPhoto:0, progressVideo:0, messages:[], createdAt: serverTimestamp() });
      setIsAdding(false);
  };

  if (!user || user.isAnonymous) return (
      <div className="h-screen flex items-center justify-center bg-stone-100">
          <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-96 space-y-6">
              <div className="text-center"><div className="inline-block p-3 bg-stone-100 rounded-full mb-4"><Lock className="w-6 h-6"/></div><h2 className="font-bold text-xl">Accès Studio</h2></div>
              <div className="space-y-4">
                <input type="email" value={emailInput} onChange={e=>setEmailInput(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="Email" required/>
                <input type="password" value={passInput} onChange={e=>setPassInput(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="Mot de passe" required/>
                <button className="w-full bg-stone-900 text-white p-3 rounded-lg font-bold hover:bg-black transition">Se connecter</button>
              </div>
          </form>
      </div>
  );

  return (
    <div className="min-h-screen bg-stone-100 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3"><div className="bg-stone-900 text-white p-2 rounded-lg"><Users className="w-5 h-5" /></div><h1 className="font-bold text-stone-900 text-lg">Dashboard</h1></div>
        <div className="flex gap-2">
          {isSuperAdmin && <button onClick={exportCSV} className="p-2 border rounded-lg hover:bg-stone-50 text-stone-600"><Download className="w-5 h-5"/></button>}
          <button onClick={() => setShowTeamModal(true)} className="p-2 border rounded-lg hover:bg-stone-50 text-stone-600"><Settings className="w-5 h-5"/></button>
          <button onClick={onLogout} className="p-2 border rounded-lg hover:bg-stone-50 text-stone-600"><LogOut className="w-5 h-5"/></button>
          <button onClick={() => setIsAdding(true)} className="bg-stone-900 hover:bg-black text-white px-4 rounded-lg flex items-center gap-2 font-bold shadow-md transition"><Plus className="w-4 h-4"/> Nouveau</button>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* FILTRES & RECHERCHE */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
                <button onClick={()=>setFilter('all')} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter==='all'?'bg-stone-800 text-white':'bg-white text-stone-500 border border-stone-200'}`}>Tous ({counts.all})</button>
                <button onClick={()=>setFilter('active')} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter==='active'?'bg-blue-600 text-white':'bg-white text-stone-500 border border-stone-200'}`}>En cours ({counts.active})</button>
                <button onClick={()=>setFilter('late')} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter==='late'?'bg-orange-500 text-white':'bg-white text-stone-500 border border-stone-200'}`}>Attention ({counts.late})</button>
                <button onClick={()=>setFilter('urgent')} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter==='urgent'?'bg-red-600 text-white':'bg-white text-stone-500 border border-stone-200'}`}>Urgent ({counts.urgent})</button>
            </div>
            <div className="relative w-full md:w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"/>
                <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-stone-200 outline-none" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
            </div>
        </div>

        {/* LISTE VERTICALE ÉPURÉE */}
        <div className="flex flex-col gap-3">
            {projects.filter(p => {
                const status = getProjectStatus(p);
                const matchesSearch = p.clientNames.toLowerCase().includes(searchTerm.toLowerCase());
                if(!matchesSearch) return false;
                if(filter === 'all') return true;
                if(filter === 'completed') return status === 'completed';
                return status === filter;
            }).map(p => <ProjectEditor key={p.id} project={p} isSuperAdmin={isSuperAdmin} staffList={staffList} user={user} />)}
        </div>
      </main>

      {/* MODAL CREATION */}
      {isAdding && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-6">Nouveau Dossier</h3>
                  <form onSubmit={createProject} className="space-y-4">
                      <input required placeholder="Mariés (ex: Julie & Thomas)" className="w-full p-3 border rounded-lg" onChange={e => setNewProject({...newProject, clientNames: e.target.value})}/>
                      <div className="grid grid-cols-2 gap-4">
                          <input type="email" placeholder="Email 1" className="p-3 border rounded-lg" onChange={e => setNewProject({...newProject, clientEmail: e.target.value})}/>
                          <input type="tel" placeholder="Tel 1" className="p-3 border rounded-lg" onChange={e => setNewProject({...newProject, clientPhone: e.target.value})}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <input type="email" placeholder="Email 2" className="p-3 border rounded-lg" onChange={e => setNewProject({...newProject, clientEmail2: e.target.value})}/>
                          <input type="tel" placeholder="Tel 2" className="p-3 border rounded-lg" onChange={e => setNewProject({...newProject, clientPhone2: e.target.value})}/>
                      </div>
                      <input required type="date" className="w-full p-3 border rounded-lg" onChange={e => setNewProject({...newProject, weddingDate: e.target.value})}/>
                      <select className="w-full p-3 border rounded-lg" onChange={e => setNewProject({...newProject, managerName: e.target.value})}>
                          <option value="">-- Responsable --</option>
                          {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="email" placeholder="Email du Responsable" className="w-full p-3 border rounded-lg" onChange={e => setNewProject({...newProject, managerEmail: e.target.value})}/>
                      <div className="flex gap-6 pt-2">
                          <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-600" checked={newProject.hasPhoto} onChange={e=>setNewProject({...newProject, hasPhoto:e.target.checked})}/> Photo</label>
                          <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-600" checked={newProject.hasVideo} onChange={e=>setNewProject({...newProject, hasVideo:e.target.checked})}/> Vidéo</label>
                      </div>
                      <div className="pt-4 flex gap-3">
                          <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 border rounded-xl font-bold text-stone-500 hover:bg-stone-50">Annuler</button>
                          <button className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black">Créer</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL EQUIPE */}
      {showTeamModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold mb-4 text-lg">Gérer l'équipe</h3>
                  <div className="flex gap-2 mb-4"><input className="flex-1 border rounded-lg p-2" value={newMember} onChange={e=>setNewMember(e.target.value)} placeholder="Nouveau nom..."/><button onClick={addTeam} className="bg-green-600 text-white px-3 rounded-lg"><Plus/></button></div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">{staffList.map(m => <div key={m} className="bg-stone-50 p-3 rounded-lg flex justify-between items-center font-medium">{m} <button onClick={()=>handleRemoveMember(m)} className="text-red-400"><Trash2 className="w-4 h-4"/></button></div>)}</div>
                  <button onClick={() => setShowTeamModal(false)} className="w-full mt-6 p-3 bg-stone-100 rounded-xl font-bold">Fermer</button>
              </div>
          </div>
      )}
    </div>
  );
}