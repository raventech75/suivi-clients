'use client';
import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Calendar, MapPin, Users, LogOut, BarChart3, 
  Settings, Trash2, Save, AlertCircle, Clock, CheckCircle2, 
  Rocket, Bell, MessageSquare, AlertTriangle, ArrowUpDown, UserCheck, CalendarDays, ArrowLeft
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore'; 
import { db, appId } from '../lib/firebase';
import { COLLECTION_NAME, Project } from '../lib/config';
import ProjectEditor from './ProjectEditor';

export default function AdminDashboard({ 
    projects, staffList, staffDirectory, user, onLogout, onStats, setStaffList 
}: { 
    projects: Project[], staffList: string[], staffDirectory: Record<string, string>, user: any, onLogout: () => void, onStats: () => void, setStaffList?: any 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'delivered' | 'archived' | 'mine'>('active'); 
  const [sortMode, setSortMode] = useState<'priority' | 'date'>('priority'); 
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // 👇 NOUVEAU : État pour le calendrier
  const [isViewingCalendar, setIsViewingCalendar] = useState(false);

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId) || null
  , [projects, selectedProjectId]);

  const [isAdding, setIsAdding] = useState(false);
  const [isManagingTeam, setIsManagingTeam] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');

  const [newProject, setNewProject] = useState({
    clientNames: '', clientEmail: '', clientEmail2: '', clientPhone: '', clientPhone2: '', 
    weddingDate: '', weddingVenue: '', weddingVenueZip: '',
    photographerName: '', videographerName: '', managerName: '', managerEmail: '',
    hasPhoto: true, hasVideo: true
  });

  const isSuperAdmin = user?.email && (user.email.includes('irzzen') || user.email === 'admin@raventech.com');

  const getProjectStatus = (p: Project) => {
      const now = Date.now();
      const wedDate = new Date(p.weddingDate).getTime();
      const photoDone = p.statusPhoto === 'delivered' || p.statusPhoto === 'none';
      const videoDone = p.statusVideo === 'delivered' || p.statusVideo === 'none';
      const isDelivered = photoDone && videoDone;

      const isLatePhoto = p.estimatedDeliveryPhoto && new Date(p.estimatedDeliveryPhoto).getTime() < now && !photoDone;
      const isLateVideo = p.estimatedDeliveryVideo && new Date(p.estimatedDeliveryVideo).getTime() < now && !videoDone;
      const isLateGeneral = !isDelivered && (now > wedDate + (60 * 24 * 3600 * 1000));
      const isLate = isLatePhoto || isLateVideo || isLateGeneral;

      const isUrgent = !isDelivered && !isLate && (now > wedDate + (30 * 24 * 3600 * 1000)); 
      
      return { isDelivered, isLate, isUrgent };
  };

  const processedProjects = useMemo(() => {
    let filtered = projects.filter(p => {
        const matchesSearch = p.clientNames.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (statusFilter === 'mine') {
            const myEmail = user?.email?.toLowerCase() || '';
            const isAssigned = (p.managerEmail?.toLowerCase() === myEmail) || 
                               (p.photographerEmail?.toLowerCase() === myEmail) || 
                               (p.videographerEmail?.toLowerCase() === myEmail);
            return matchesSearch && !p.isArchived && isAssigned;
        }

        if (statusFilter === 'archived') return matchesSearch && p.isArchived;
        if (statusFilter === 'active') return matchesSearch && !p.isArchived && !getProjectStatus(p).isDelivered;
        if (statusFilter === 'delivered') return matchesSearch && !p.isArchived && getProjectStatus(p).isDelivered;
        if (statusFilter === 'all') return matchesSearch && !p.isArchived;
        
        return matchesSearch;
    });

    return filtered.sort((a, b) => {
        if (sortMode === 'date') {
            return new Date(b.weddingDate).getTime() - new Date(a.weddingDate).getTime();
        } else {
            const statusA = getProjectStatus(a);
            const statusB = getProjectStatus(b);
            const getScore = (p: Project, s: any) => {
                let score = 0;
                if (p.isPriority) score += 10000;
                if (s.isLate) score += 5000;
                if (s.isUrgent) score += 1000;
                if (p.messages && p.messages.length > 0 && !p.messages[p.messages.length - 1].isStaff) {
                    score += 2000;
                }
                return score;
            };
            const scoreA = getScore(a, statusA);
            const scoreB = getScore(b, statusB);

            if (scoreA !== scoreB) return scoreB - scoreA;
            return new Date(a.weddingDate).getTime() - new Date(b.weddingDate).getTime();
        }
    });
  }, [projects, searchTerm, statusFilter, sortMode, user]);

  // 👇 NOUVEAU : Regroupement des projets pour le Calendrier
  const calendarGroups = useMemo(() => {
      const upcoming = projects
          .filter(p => !p.isArchived)
          .sort((a, b) => new Date(a.weddingDate).getTime() - new Date(b.weddingDate).getTime());

      const groups: Record<string, Project[]> = {};
      
      upcoming.forEach(p => {
          const date = new Date(p.weddingDate);
          const monthYear = date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
          const capitalizedMonth = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
          if (!groups[capitalizedMonth]) groups[capitalizedMonth] = [];
          groups[capitalizedMonth].push(p);
      });

      return groups;
  }, [projects]);

  const notifications = useMemo(() => {
    const notifs: any[] = [];
    projects.forEach(p => {
        if (p.isArchived) return;
        if (p.messages && p.messages.length > 0) {
            const lastMsg = p.messages[p.messages.length - 1];
            if (!lastMsg.isStaff) {
                notifs.push({ id: `msg-${p.id}`, type: 'message', level: 'high', project: p, text: `Réponse de ${p.clientNames}`, date: lastMsg.date });
            }
        }
        const { isLate } = getProjectStatus(p);
        if (isLate) notifs.push({ id: `late-${p.id}`, type: 'late', level: 'critical', project: p, text: `Retard : ${p.clientNames}`, date: new Date().toISOString() });
    });
    return notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [projects]);

  const addStaffMember = async () => {
      if(!newStaffName || !newStaffEmail) return alert("Nom et Email requis");
      const updatedDirectory = { ...staffDirectory, [newStaffName]: newStaffEmail };
      await setDoc(doc(db, "settings", "general"), { staffDirectory: updatedDirectory }, { merge: true });
      setNewStaffName(''); setNewStaffEmail(''); alert(`✅ ${newStaffName} ajouté à l'équipe !`);
  };

  const removeStaffMember = async (name: string) => {
      if(!confirm(`Supprimer ${name} de la liste ?`)) return;
      const updatedDirectory = { ...staffDirectory };
      delete updatedDirectory[name];
      await setDoc(doc(db, "settings", "general"), { staffDirectory: updatedDirectory }, { merge: true });
  };

  const createProject = async (e: any) => {
      e.preventDefault();
      if (!newProject.clientEmail || !newProject.clientEmail.includes('@')) return alert("⛔️ Email client obligatoire.");
      
      const code = (newProject.clientNames.split(' ')[0] + '-' + Math.floor(Math.random()*1000)).toUpperCase();
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      
      try {
          const docRef = await addDoc(collection(db, colPath), { 
              ...newProject, 
              code, 
              statusPhoto: newProject.hasPhoto ? 'waiting' : 'none', 
              statusVideo: newProject.hasVideo ? 'waiting' : 'none', 
              progressPhoto: 0, 
              progressVideo: 0, 
              messages: [], 
              albums: [], 
              internalChat: [], 
              inviteCount: 0, 
              createdAt: serverTimestamp() 
          });
          setIsAdding(false);
          setNewProject({ clientNames: '', clientEmail: '', clientEmail2: '', clientPhone: '', clientPhone2: '', weddingDate: '', weddingVenue: '', weddingVenueZip: '', photographerName: '', videographerName: '', managerName: '', managerEmail: '', hasPhoto: true, hasVideo: true });
          setSelectedProjectId(docRef.id);
      } catch (error) {
          console.error("Erreur création:", error);
          alert("Erreur lors de la création du dossier.");
      }
  };

  if (selectedProject) {
    return (
      <div className="min-h-screen bg-stone-100">
        <div className="max-w-7xl mx-auto p-4">
          <button onClick={() => setSelectedProjectId(null)} className="mb-4 text-sm font-bold text-stone-500 hover:text-stone-800 flex items-center gap-2">← Retour au tableau de bord</button>
          <ProjectEditor project={selectedProject} isSuperAdmin={!!isSuperAdmin} staffList={staffList} staffDirectory={staffDirectory} user={user} />
        </div>
      </div>
    );
  }

  // 👇 NOUVEAU : VUE CALENDRIER D'ÉQUIPE
  if (isViewingCalendar) {
      return (
        <div className="min-h-screen bg-stone-100 pb-20">
            <header className="bg-white border-b sticky top-0 z-20 shadow-sm px-6 py-4">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsViewingCalendar(false)} className="p-2 hover:bg-stone-100 rounded-full transition"><ArrowLeft className="w-5 h-5"/></button>
                        <div className="bg-emerald-600 text-white p-2 rounded-lg"><CalendarDays className="w-5 h-5" /></div>
                        <h1 className="font-bold text-stone-900 text-lg">Planning de l'Équipe</h1>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-6 space-y-10">
                {Object.entries(calendarGroups).length === 0 ? (
                    <div className="text-center text-stone-500 py-20">Aucun mariage à venir.</div>
                ) : (
                    Object.entries(calendarGroups).map(([month, monthProjects]) => (
                        <div key={month} className="animate-fade-in">
                            <h2 className="text-xl font-serif font-bold text-stone-800 mb-4 border-b-2 border-stone-200 pb-2 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-emerald-600"/> {month}
                                <span className="bg-stone-200 text-stone-600 text-xs px-2 py-0.5 rounded-full font-sans">{monthProjects.length} mariages</span>
                            </h2>
                            
                            <div className="grid gap-4">
                                {monthProjects.map(p => {
                                    const dateObj = new Date(p.weddingDate);
                                    const dayNum = dateObj.getDate();
                                    const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
                                    const isPast = dateObj.getTime() < Date.now();
                                    
                                    // Alertes Staff
                                    const missingPhoto = p.hasPhoto && !p.photographerName;
                                    const missingVideo = p.hasVideo && !p.videographerName;
                                    const hasWarning = (!isPast) && (missingPhoto || missingVideo);

                                    return (
                                        <div key={p.id} onClick={() => setSelectedProjectId(p.id)} className={`bg-white p-4 rounded-2xl shadow-sm border cursor-pointer hover:shadow-md transition flex items-center gap-6 ${isPast ? 'opacity-50 grayscale border-stone-100' : hasWarning ? 'border-red-300 bg-red-50/30' : 'border-stone-200'}`}>
                                            
                                            {/* Date Box */}
                                            <div className="flex flex-col items-center justify-center w-16 h-16 bg-stone-50 rounded-xl border border-stone-100 shrink-0">
                                                <span className="text-xs uppercase font-bold text-stone-400">{dayName}</span>
                                                <span className="text-2xl font-black text-stone-800 leading-none">{dayNum}</span>
                                            </div>
                                            
                                            {/* Client Info */}
                                            <div className="flex-1 min-w-[200px]">
                                                <h3 className="font-bold text-lg text-stone-900">{p.clientNames}</h3>
                                                <p className="text-sm text-stone-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3"/> {p.weddingVenue || 'Lieu à définir'}</p>
                                            </div>

                                            {/* Team Assignment */}
                                            <div className="hidden md:flex gap-4 items-center">
                                                {p.hasPhoto && (
                                                    <div className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${missingPhoto ? (!isPast ? 'bg-red-100 border-red-200 text-red-700 font-bold animate-pulse' : 'bg-stone-100 text-stone-400') : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                                                        <Camera className="w-4 h-4"/> 
                                                        {missingPhoto ? 'À ASSIGNER' : p.photographerName}
                                                    </div>
                                                )}
                                                {p.hasVideo && (
                                                    <div className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${missingVideo ? (!isPast ? 'bg-red-100 border-red-200 text-red-700 font-bold animate-pulse' : 'bg-stone-100 text-stone-400') : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                                                        <Video className="w-4 h-4"/> 
                                                        {missingVideo ? 'À ASSIGNER' : p.videographerName}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <ChevronRight className="w-5 h-5 text-stone-300"/>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-800">Studio Dashboard</h1>
            <div className="flex gap-4 items-center mt-2 text-sm text-stone-500 overflow-x-auto pb-2">
                <span className="bg-stone-200 px-2 py-0.5 rounded text-stone-600 font-bold whitespace-nowrap">{processedProjects.length} dossiers</span>
                <button onClick={onStats} className="flex items-center gap-1 hover:text-stone-900 transition whitespace-nowrap"><BarChart3 className="w-4 h-4"/> Statistiques</button>
                {/* 👇 BOUTON CALENDRIER */}
                <button onClick={() => setIsViewingCalendar(true)} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold transition whitespace-nowrap"><CalendarDays className="w-4 h-4"/> Calendrier</button>
                <button onClick={() => setIsManagingTeam(true)} className="flex items-center gap-1 hover:text-stone-900 transition text-amber-600 font-bold whitespace-nowrap"><Settings className="w-4 h-4"/> Équipe</button>
                <button onClick={onLogout} className="flex items-center gap-1 text-red-400 hover:text-red-600 transition whitespace-nowrap"><LogOut className="w-4 h-4"/> Quitter</button>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
              <div className="relative">
                  <button onClick={() => setShowNotifications(!showNotifications)} className={`p-3 rounded-xl transition shadow-sm ${showNotifications ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}>
                      <Bell className="w-5 h-5"/>
                      {notifications.length > 0 && (<span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-md animate-pulse">{notifications.length}</span>)}
                  </button>
                  {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-stone-100 z-50 overflow-hidden animate-fade-in">
                          <div className="p-3 border-b border-stone-100 bg-stone-50 font-bold text-stone-700 text-sm flex justify-between items-center"><span>À traiter ({notifications.length})</span><button onClick={()=>setShowNotifications(false)} className="text-xs text-stone-400 hover:text-stone-600">Fermer</button></div>
                          <div className="max-h-[300px] overflow-y-auto">
                              {notifications.length === 0 ? <div className="p-6 text-center text-stone-400 text-xs italic">Aucune alerte. Tout est à jour ! 🎉</div> : notifications.map(notif => (
                                  <div key={notif.id} onClick={() => { setSelectedProjectId(notif.project.id); setShowNotifications(false); }} className="p-3 border-b border-stone-50 hover:bg-amber-50 cursor-pointer transition flex items-start gap-3">
                                      <div className={`mt-1 p-1.5 rounded-full shrink-0 ${notif.type === 'late' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                          {notif.type === 'late' ? <AlertCircle className="w-3 h-3"/> : <MessageSquare className="w-3 h-3"/>}
                                      </div>
                                      <div><div className="text-sm font-bold text-stone-800">{notif.text}</div><div className="text-xs text-stone-400 mt-0.5">{new Date(notif.date).toLocaleDateString()}</div></div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
              <button onClick={() => setIsAdding(true)} className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition shadow-lg"><Plus className="w-5 h-5"/> Nouveau Dossier</button>
          </div>
        </div>

        {/* BARRE D'OUTILS */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-6 flex flex-col lg:flex-row gap-4 justify-between items-center sticky top-4 z-10">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-3.5 text-stone-400 w-5 h-5"/>
            <input type="text" placeholder="Rechercher client, code..." className="w-full pl-10 p-3 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-stone-200 outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
             <button onClick={() => setStatusFilter('mine')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${statusFilter === 'mine' ? 'bg-purple-600 text-white border-purple-600 shadow-md transform scale-105' : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100'}`}><UserCheck className="w-4 h-4"/> Mes Dossiers</button>
             <div className="h-6 w-px bg-stone-300 mx-2 hidden md:block"></div>
             <div className="flex bg-stone-100 p-1 rounded-lg">
                <button onClick={() => setSortMode('priority')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${sortMode === 'priority' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}><Rocket className="w-3 h-3"/> Priorité</button>
                <button onClick={() => setSortMode('date')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${sortMode === 'date' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}><ArrowUpDown className="w-3 h-3"/> Date</button>
             </div>
             <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                <button onClick={() => setStatusFilter('active')} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === 'active' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>En cours</button>
                <button onClick={() => setStatusFilter('delivered')} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === 'delivered' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>Livrés</button>
                <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === 'all' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>Tous</button>
                <button onClick={() => setStatusFilter('archived')} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === 'archived' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>Archivés</button>
             </div>
          </div>
        </div>

        {/* MODALES */}
        {isManagingTeam && ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"> <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in"> <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5"/> Gestion de l'équipe</h3> <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto bg-stone-50 p-2 rounded-lg"> {Object.entries(staffDirectory).map(([name, email]) => ( <div key={name} className="flex justify-between items-center bg-white p-2 rounded border border-stone-100 shadow-sm text-sm"> <div><div className="font-bold">{name}</div><div className="text-xs text-stone-400">{email}</div></div> <button onClick={() => removeStaffMember(name)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button> </div> ))} </div> <div className="space-y-3 pt-4 border-t border-stone-100"> <input className="w-full p-2 border rounded text-sm" placeholder="Prénom" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} /> <input className="w-full p-2 border rounded text-sm" placeholder="Email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} /> <button onClick={addStaffMember} className="w-full bg-stone-900 text-white py-2 rounded-lg font-bold text-sm hover:bg-black flex justify-center gap-2"><Save className="w-4 h-4"/> Enregistrer</button> </div> <button onClick={() => setIsManagingTeam(false)} className="w-full mt-4 text-stone-400 text-sm hover:text-stone-600">Fermer</button> </div> </div> )}
        {isAdding && ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"> <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in"> <h2 className="text-2xl font-bold mb-6">Nouveau Dossier Mariage</h2> <form onSubmit={createProject} className="space-y-4"> <div className="grid md:grid-cols-2 gap-4"> <div><label className="text-xs font-bold text-stone-500">Noms des Mariés</label><input required className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" placeholder="Julie & Thomas" value={newProject.clientNames} onChange={e => setNewProject({...newProject, clientNames: e.target.value})} /></div> <div><label className="text-xs font-bold text-stone-500">Date du Mariage</label><input type="date" required className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" value={newProject.weddingDate} onChange={e => setNewProject({...newProject, weddingDate: e.target.value})} /></div> </div> <div><label className="text-xs font-bold text-stone-500">Email Client (Obligatoire)</label><input type="email" required className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" placeholder="client@email.com" value={newProject.clientEmail} onChange={e => setNewProject({...newProject, clientEmail: e.target.value})} /></div> <div className="grid md:grid-cols-2 gap-4"> <div><label className="text-xs font-bold text-stone-500">Lieu</label><input className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" placeholder="Domaine de..." value={newProject.weddingVenue} onChange={e => setNewProject({...newProject, weddingVenue: e.target.value})} /></div> <div><label className="text-xs font-bold text-stone-500">Téléphone</label><input className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" placeholder="06..." value={newProject.clientPhone} onChange={e => setNewProject({...newProject, clientPhone: e.target.value})} /></div> </div> <div className="flex gap-4 pt-2"> <label className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-lg cursor-pointer"><input type="checkbox" checked={newProject.hasPhoto} onChange={e => setNewProject({...newProject, hasPhoto: e.target.checked})} /> <span className="font-bold">Prestation Photo</span></label> <label className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-lg cursor-pointer"><input type="checkbox" checked={newProject.hasVideo} onChange={e => setNewProject({...newProject, hasVideo: e.target.checked})} /> <span className="font-bold">Prestation Vidéo</span></label> </div> <div className="flex gap-3 pt-6"> <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-100 rounded-xl">Annuler</button> <button type="submit" className="flex-1 py-3 bg-stone-900 text-white font-bold rounded-xl hover:bg-black">Créer le dossier</button> </div> </form> </div> </div> )}

        {processedProjects.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 shadow-sm border-dashed">
                <div className="text-stone-300 mb-4"><Search className="w-12 h-12 mx-auto"/></div>
                <h3 className="text-xl font-bold text-stone-800 mb-2">Aucun dossier trouvé</h3>
                <p className="text-stone-500">
                    {statusFilter === 'mine' ? "Aucun dossier ne vous est assigné." : "Essayez de changer les filtres ou la recherche."}
                </p>
            </div>
        ) : (
            <div className="flex flex-col gap-4 pb-10">
            {processedProjects.map(project => {
                const { isDelivered, isLate, isUrgent } = getProjectStatus(project);
                const hasUnreadMessage = project.messages && project.messages.length > 0 && !project.messages[project.messages.length - 1].isStaff;
                const deadline = project.estimatedDeliveryPhoto || project.estimatedDeliveryVideo;
                
                let borderClass = 'border-l-4 border-l-blue-500';
                let bgClass = 'bg-white';
                let badge = null;

                if (project.isArchived) {
                    borderClass = 'border-l-4 border-l-stone-300';
                    bgClass = 'bg-stone-50 opacity-70 grayscale';
                } else if (isDelivered) {
                    borderClass = 'border-l-4 border-l-emerald-500';
                    badge = <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> LIVRÉ</span>;
                } else if (project.isPriority) {
                    borderClass = 'border-l-8 border-l-orange-500 ring-2 ring-orange-200';
                    bgClass = 'bg-orange-50/50';
                    badge = <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm animate-pulse"><Rocket className="w-3 h-3"/> FAST TRACK</span>;
                } else if (isLate) {
                    borderClass = 'border-l-8 border-l-red-500';
                    bgClass = 'bg-red-50/40';
                    badge = <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm"><AlertCircle className="w-3 h-3"/> RETARD CRITIQUE</span>;
                } else if (isUrgent) {
                    borderClass = 'border-l-4 border-l-amber-500';
                    bgClass = 'bg-amber-50/30';
                    badge = <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3"/> URGENT</span>;
                } else {
                    const daysDiff = Math.ceil((new Date(project.weddingDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                    if (daysDiff > 0) badge = <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100">J-{daysDiff}</span>;
                    else badge = <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded">En attente</span>;
                }

                return (
                    <div key={project.id} onClick={() => setSelectedProjectId(project.id)} className={`relative rounded-xl shadow-sm border border-stone-200 p-4 hover:shadow-md transition-all cursor-pointer group ${borderClass} ${bgClass} flex flex-col md:flex-row gap-4 justify-between items-center`}>
                        {hasUnreadMessage && <div className="absolute -top-2 -right-2 md:top-auto md:bottom-auto md:right-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg animate-bounce flex items-center gap-1 z-20 border-2 border-white"><MessageSquare className="w-3 h-3 fill-current"/> Message Client</div>}
                        
                        <div className="flex-1 w-full md:w-auto">
                            <div className="flex justify-between items-start mb-2 md:mb-0">
                                <div><h3 className="font-bold text-lg text-stone-900 group-hover:text-stone-700 flex items-center gap-2">{project.clientNames} <span className="text-[10px] font-mono text-stone-400 bg-stone-100 px-1.5 rounded">{project.code}</span></h3></div>
                                <div className="md:hidden">{badge}</div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-stone-600 mt-2">
                                <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-md border border-stone-100"><Calendar className="w-3 h-3 text-stone-400"/> {new Date(project.weddingDate).toLocaleDateString()}</div>
                                {deadline && !isDelivered && <div className={`flex items-center gap-1 px-2 py-1 rounded-md border font-bold ${new Date(deadline).getTime() < Date.now() ? 'bg-red-100 text-red-600 border-red-200' : 'bg-white/50 border-stone-100 text-stone-500'}`}><Clock className="w-3 h-3"/> Fin : {new Date(deadline).toLocaleDateString()}</div>}
                                <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-md border border-stone-100"><Users className="w-3 h-3 text-stone-400"/> <span className="truncate max-w-[150px]">{project.photographerName || project.videographerName || 'Staff non assigné'}</span></div>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full md:w-96 items-center">
                             {project.statusPhoto !== 'none' && (
                                <div className="flex-1 bg-white/80 p-2 rounded-lg border border-stone-100">
                                    <div className="flex justify-between text-[10px] mb-1 font-bold text-stone-500"><span>Photo</span><span>{project.progressPhoto}%</span></div>
                                    <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${project.statusPhoto === 'delivered' ? 'bg-emerald-500' : project.progressPhoto > 80 ? 'bg-blue-600' : 'bg-blue-500'}`} style={{width: `${project.progressPhoto}%`}}></div></div>
                                </div>
                            )}
                            {project.statusVideo !== 'none' && (
                                <div className="flex-1 bg-white/80 p-2 rounded-lg border border-stone-100">
                                    <div className="flex justify-between text-[10px] mb-1 font-bold text-stone-500"><span>Vidéo</span><span>{project.progressVideo}%</span></div>
                                    <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${project.statusVideo === 'delivered' ? 'bg-emerald-500' : project.progressVideo > 80 ? 'bg-purple-600' : 'bg-purple-500'}`} style={{width: `${project.progressVideo}%`}}></div></div>
                                </div>
                            )}
                            <div className="hidden md:block pl-4 border-l">{badge}</div>
                        </div>
                    </div>
                );
            })}
            </div>
        )}
      </div>
    </div>
  );
}