'use client';
import React, { useState } from 'react';
import { Plus, Search, Calendar, MapPin, Users, LogOut, BarChart3, Settings, Trash2, Save, AlertCircle, Clock, CheckCircle2, Rocket, Camera, Video } from 'lucide-react';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore'; 
import { db, appId } from '../lib/firebase';
import { COLLECTION_NAME, PHOTO_STEPS, VIDEO_STEPS, Project } from '../lib/config';
import ProjectEditor from './ProjectEditor'; // C'est ici qu'il importe ProjectEditor

export default function AdminDashboard({ 
    projects, staffList, staffDirectory, user, onLogout, onStats, setStaffList 
}: { 
    projects: Project[], staffList: string[], staffDirectory: Record<string, string>, user: any, onLogout: () => void, onStats: () => void, setStaffList?: any 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isManagingTeam, setIsManagingTeam] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');

  const [newProject, setNewProject] = useState({
    clientNames: '', clientEmail: '', clientEmail2: '', clientPhone: '', clientPhone2: '', 
    weddingDate: '', weddingVenue: '', weddingVenueZip: '',
    photographerName: '', videographerName: '', managerName: '', managerEmail: '',
    hasPhoto: true, hasVideo: true
  });

  const isSuperAdmin = user?.email && (user.email.includes('irzzen') || user.email === 'admin@raventech.com');

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.clientNames.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'archived') return matchesSearch && p.isArchived;
    if (statusFilter === 'active') return matchesSearch && !p.isArchived;
    return matchesSearch;
  });

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
      await addDoc(collection(db, colPath), { ...newProject, code, statusPhoto: newProject.hasPhoto ? 'waiting' : 'none', statusVideo: newProject.hasVideo ? 'waiting' : 'none', progressPhoto: 0, progressVideo: 0, messages: [], albums: [], internalChat: [], inviteCount: 0, createdAt: serverTimestamp() });
      setIsAdding(false);
      setNewProject({ clientNames: '', clientEmail: '', clientEmail2: '', clientPhone: '', clientPhone2: '', weddingDate: '', weddingVenue: '', weddingVenueZip: '', photographerName: '', videographerName: '', managerName: '', managerEmail: '', hasPhoto: true, hasVideo: true });
  };

  const getProjectStatus = (p: Project) => {
      const now = Date.now();
      const wedDate = new Date(p.weddingDate).getTime();
      const isDelivered = (p.statusPhoto === 'delivered' || p.statusPhoto === 'none') && (p.statusVideo === 'delivered' || p.statusVideo === 'none');
      const isLate = !isDelivered && (now > wedDate + (60 * 24 * 3600 * 1000));
      const isUrgent = !isDelivered && !isLate && (now > wedDate + (15 * 24 * 3600 * 1000));
      return { isDelivered, isLate, isUrgent };
  };

  if (selectedProject) {
    return (
      <div className="min-h-screen bg-stone-100">
        <div className="max-w-7xl mx-auto p-4">
          <button onClick={() => setSelectedProject(null)} className="mb-4 text-sm font-bold text-stone-500 hover:text-stone-800 flex items-center gap-2">← Retour au tableau de bord</button>
          <ProjectEditor project={selectedProject} isSuperAdmin={!!isSuperAdmin} staffList={staffList} staffDirectory={staffDirectory} user={user} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-800">Tableau de Bord</h1>
            <div className="flex gap-4 items-center mt-2 text-sm text-stone-500">
                <span className="bg-stone-200 px-2 py-0.5 rounded text-stone-600 font-bold">{projects.length} dossiers</span>
                <button onClick={onStats} className="flex items-center gap-1 hover:text-stone-900 transition"><BarChart3 className="w-4 h-4"/> Statistiques</button>
                <button onClick={() => setIsManagingTeam(true)} className="flex items-center gap-1 hover:text-stone-900 transition text-amber-600 font-bold"><Settings className="w-4 h-4"/> Gérer l'équipe</button>
                <button onClick={onLogout} className="flex items-center gap-1 text-red-400 hover:text-red-600 transition"><LogOut className="w-4 h-4"/> Déconnexion</button>
            </div>
          </div>
          <button onClick={() => setIsAdding(true)} className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition shadow-lg"><Plus className="w-5 h-5"/> Nouveau Dossier</button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3.5 text-stone-400 w-5 h-5"/>
            <input type="text" placeholder="Rechercher un client, un code..." className="w-full pl-10 p-3 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-stone-200 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${statusFilter === 'all' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>Tous</button>
            <button onClick={() => setStatusFilter('active')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${statusFilter === 'active' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>En cours</button>
            <button onClick={() => setStatusFilter('archived')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${statusFilter === 'archived' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>Archivés</button>
          </div>
        </div>

        {/* MODALE TEAM */}
        {isManagingTeam && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5"/> Gestion de l'équipe</h3>
                <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto bg-stone-50 p-2 rounded-lg">
                    {Object.entries(staffDirectory).map(([name, email]) => (
                        <div key={name} className="flex justify-between items-center bg-white p-2 rounded border border-stone-100 shadow-sm text-sm">
                            <div><div className="font-bold">{name}</div><div className="text-xs text-stone-400">{email}</div></div>
                            <button onClick={() => removeStaffMember(name)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>
                <div className="space-y-3 pt-4 border-t border-stone-100">
                    <input className="w-full p-2 border rounded text-sm" placeholder="Prénom" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} />
                    <input className="w-full p-2 border rounded text-sm" placeholder="Email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} />
                    <button onClick={addStaffMember} className="w-full bg-stone-900 text-white py-2 rounded-lg font-bold text-sm hover:bg-black flex justify-center gap-2"><Save className="w-4 h-4"/> Enregistrer</button>
                </div>
                <button onClick={() => setIsManagingTeam(false)} className="w-full mt-4 text-stone-400 text-sm hover:text-stone-600">Fermer</button>
            </div>
          </div>
        )}

        {/* MODALE AJOUT PROJET */}
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
              <h2 className="text-2xl font-bold mb-6">Nouveau Dossier Mariage</h2>
              <form onSubmit={createProject} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-stone-500">Noms des Mariés</label><input required className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" placeholder="Julie & Thomas" value={newProject.clientNames} onChange={e => setNewProject({...newProject, clientNames: e.target.value})} /></div>
                  <div><label className="text-xs font-bold text-stone-500">Date du Mariage</label><input type="date" required className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" value={newProject.weddingDate} onChange={e => setNewProject({...newProject, weddingDate: e.target.value})} /></div>
                </div>
                <div><label className="text-xs font-bold text-stone-500">Email Client (Obligatoire)</label><input type="email" required className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" placeholder="client@email.com" value={newProject.clientEmail} onChange={e => setNewProject({...newProject, clientEmail: e.target.value})} /></div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-stone-500">Lieu</label><input className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" placeholder="Domaine de..." value={newProject.weddingVenue} onChange={e => setNewProject({...newProject, weddingVenue: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-stone-500">Téléphone</label><input className="w-full p-3 bg-stone-50 rounded-lg border border-stone-200" placeholder="06..." value={newProject.clientPhone} onChange={e => setNewProject({...newProject, clientPhone: e.target.value})} /></div>
                </div>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-lg cursor-pointer"><input type="checkbox" checked={newProject.hasPhoto} onChange={e => setNewProject({...newProject, hasPhoto: e.target.checked})} /> <span className="font-bold">Prestation Photo</span></label>
                  <label className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-lg cursor-pointer"><input type="checkbox" checked={newProject.hasVideo} onChange={e => setNewProject({...newProject, hasVideo: e.target.checked})} /> <span className="font-bold">Prestation Vidéo</span></label>
                </div>
                <div className="flex gap-3 pt-6">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-100 rounded-xl">Annuler</button>
                  <button type="submit" className="flex-1 py-3 bg-stone-900 text-white font-bold rounded-xl hover:bg-black">Créer le dossier</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* LISTE TICKETING */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            const { isDelivered, isLate, isUrgent } = getProjectStatus(project);
            let borderClass = 'border-l-4 border-l-blue-500';
            let bgClass = 'bg-white';
            let badge = null;

            if (project.isArchived) {
                borderClass = 'border-l-4 border-l-stone-300';
                bgClass = 'bg-stone-50 opacity-70 grayscale';
            } else if (isDelivered) {
                borderClass = 'border-l-4 border-l-emerald-500';
                badge = <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> LIVRÉ</span>;
            } else if (isLate) {
                borderClass = 'border-l-4 border-l-red-500';
                bgClass = 'bg-red-50/50';
                badge = <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3"/> RETARD</span>;
            } else if (isUrgent || project.isPriority) {
                borderClass = 'border-l-4 border-l-orange-500';
                bgClass = 'bg-orange-50/50';
                badge = <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3"/> URGENT</span>;
            } else {
                const daysDiff = Math.ceil((new Date(project.weddingDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                if (daysDiff > 0) badge = <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">J-{daysDiff}</span>;
            }

            return (
                <div key={project.id} onClick={() => setSelectedProject(project)} className={`relative rounded-xl shadow-sm border border-stone-200 p-5 hover:shadow-md transition-all cursor-pointer group ${borderClass} ${bgClass}`}>
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-bold text-lg text-stone-900 group-hover:text-stone-700">{project.clientNames}</h3>
                            <span className="text-[10px] font-mono text-stone-400">{project.code}</span>
                        </div>
                        {badge}
                        {project.isPriority && !isDelivered && !project.isArchived && <span className="absolute top-2 right-2 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span></span>}
                    </div>
                    <div className="flex flex-col gap-1 mb-4 text-xs text-stone-600">
                        <div className="flex items-center gap-2"><Calendar className="w-3 h-3 text-stone-400"/> {new Date(project.weddingDate).toLocaleDateString()}</div>
                        <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-stone-400"/> <span className="truncate max-w-[200px]">{project.weddingVenue || 'Lieu non défini'}</span></div>
                        <div className="flex items-center gap-2"><Users className="w-3 h-3 text-stone-400"/> <span className="truncate max-w-[200px]">{project.photographerName || project.videographerName || 'Staff non assigné'}</span></div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-stone-200/50">
                        {project.statusPhoto !== 'none' && (
                            <div className="flex-1">
                                <div className="flex justify-between text-[10px] mb-1 font-bold text-stone-500"><span>Photo</span><span>{project.progressPhoto}%</span></div>
                                <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden"><div className={`h-full ${project.statusPhoto === 'delivered' ? 'bg-emerald-500' : 'bg-stone-500'}`} style={{width: `${project.progressPhoto}%`}}></div></div>
                            </div>
                        )}
                        {project.statusVideo !== 'none' && (
                            <div className="flex-1">
                                <div className="flex justify-between text-[10px] mb-1 font-bold text-stone-500"><span>Vidéo</span><span>{project.progressVideo}%</span></div>
                                <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden"><div className={`h-full ${project.statusVideo === 'delivered' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${project.progressVideo}%`}}></div></div>
                            </div>
                        )}
                    </div>
                </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}