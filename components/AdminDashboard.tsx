'use client';
import React, { useState } from 'react';
import { Plus, Search, Loader2, Calendar, MapPin, Users } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { db, appId } from '../lib/firebase';
import { COLLECTION_NAME, PHOTO_STEPS, VIDEO_STEPS, Project } from '../lib/config';
import ProjectEditor from './ProjectEditor';

export default function AdminDashboard({ projects, staffList, staffDirectory, user }: { projects: Project[], staffList: string[], staffDirectory: Record<string, string>, user: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // État pour le nouveau projet
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

  const createProject = async (e: any) => {
      e.preventDefault();

      if (!newProject.clientEmail || !newProject.clientEmail.includes('@')) {
          alert("⛔️ Email client obligatoire.");
          return;
      }
      
      const code = (newProject.clientNames.split(' ')[0] + '-' + Math.floor(Math.random()*1000)).toUpperCase();
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      
      await addDoc(collection(db, colPath), { 
          ...newProject, 
          code, 
          statusPhoto: newProject.hasPhoto ? 'waiting' : 'none', 
          statusVideo: newProject.hasVideo ? 'waiting' : 'none', 
          progressPhoto: 0, 
          progressVideo: 0, 
          messages: [],
          albums: [], // ✅ LISTE VIDE À LA CRÉATION
          internalChat: [],
          inviteCount: 0,
          createdAt: serverTimestamp() 
      });
      
      setIsAdding(false);
      setNewProject({ 
        clientNames: '', clientEmail: '', clientEmail2: '', clientPhone: '', clientPhone2: '', 
        weddingDate: '', weddingVenue: '', weddingVenueZip: '',
        photographerName: '', videographerName: '', managerName: '', managerEmail: '',
        hasPhoto: true, hasVideo: true
      });
  };

  if (selectedProject) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-7xl mx-auto p-4">
          <button onClick={() => setSelectedProject(null)} className="mb-4 text-sm font-bold text-stone-500 hover:text-stone-800 flex items-center gap-2">
            ← Retour au tableau de bord
          </button>
          <ProjectEditor 
            project={selectedProject} 
            isSuperAdmin={!!isSuperAdmin} 
            staffList={staffList}
            staffDirectory={staffDirectory}
            user={user}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-800">Tableau de Bord</h1>
            <p className="text-stone-500 text-sm">Gérez vos {projects.length} dossiers mariages</p>
          </div>
          <button onClick={() => setIsAdding(true)} className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition shadow-lg">
            <Plus className="w-5 h-5"/> Nouveau Dossier
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3.5 text-stone-400 w-5 h-5"/>
            <input 
              type="text" 
              placeholder="Rechercher un client, un code..." 
              className="w-full pl-10 p-3 bg-stone-50 rounded-xl border-none focus:ring-2 focus:ring-stone-200 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${statusFilter === 'all' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>Tous</button>
            <button onClick={() => setStatusFilter('active')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${statusFilter === 'active' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>En cours</button>
            <button onClick={() => setStatusFilter('archived')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${statusFilter === 'archived' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>Archivés</button>
          </div>
        </div>

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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <div key={project.id} onClick={() => setSelectedProject(project)} className={`bg-white p-6 rounded-2xl shadow-sm border border-stone-200 cursor-pointer hover:shadow-md transition group ${project.isArchived ? 'opacity-60 grayscale' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-stone-800 group-hover:text-amber-600 transition">{project.clientNames}</h3>
                  <p className="text-xs text-stone-400 font-mono mt-1">{project.code}</p>
                </div>
                {project.isPriority && !project.isArchived && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full">FAST TRACK</span>}
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-stone-600"><Calendar className="w-4 h-4 text-stone-400"/> {new Date(project.weddingDate).toLocaleDateString()}</div>
                <div className="flex items-center gap-2 text-sm text-stone-600"><MapPin className="w-4 h-4 text-stone-400"/> {project.weddingVenue || 'Lieu non défini'}</div>
                <div className="flex items-center gap-2 text-sm text-stone-600"><Users className="w-4 h-4 text-stone-400"/> {project.photographerName || project.videographerName || 'Équipe non assignée'}</div>
              </div>

              <div className="flex gap-2 mt-auto pt-4 border-t border-stone-100">
                {project.statusPhoto !== 'none' && (
                   <div className="flex-1 bg-stone-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] font-bold text-stone-400 uppercase mb-1">Photo</div>
                      <div className={`text-xs font-bold ${project.statusPhoto === 'delivered' ? 'text-green-600' : 'text-stone-700'}`}>{(PHOTO_STEPS as any)[project.statusPhoto]?.label || 'En cours'}</div>
                   </div>
                )}
                {project.statusVideo !== 'none' && (
                   <div className="flex-1 bg-stone-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] font-bold text-stone-400 uppercase mb-1">Vidéo</div>
                      <div className={`text-xs font-bold ${project.statusVideo === 'delivered' ? 'text-green-600' : 'text-stone-700'}`}>{(VIDEO_STEPS as any)[project.statusVideo]?.label || 'En cours'}</div>
                   </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}