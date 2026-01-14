'use client';
import React, { useState, useEffect } from 'react';
import { 
  Camera, Video, Ban, ChevronRight, Rocket, Mail, 
  BookOpen, Trash2, Image as ImageIcon, CheckSquare, 
  Upload, Loader2, MapPin, FileText, Users, Calendar, Eye
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, MAKE_WEBHOOK_URL, PHOTO_STEPS, 
  VIDEO_STEPS, ALBUM_FORMATS, ALBUM_STATUSES, Project 
} from '../lib/config';
import ChatBox from './ChatSystem';

export default function ProjectEditor({ project, isSuperAdmin, staffList, user }: { project: Project, isSuperAdmin: boolean, staffList: string[], user: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState(project);
  const [hasChanges, setHasChanges] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ name: 'Album', format: '30x30', price: 0 });
  const [uploading, setUploading] = useState(false);

  const isManager = user?.email && project.managerEmail && user.email.toLowerCase() === project.managerEmail.toLowerCase();
  const canEdit = isSuperAdmin || isManager;

  // --- LOGIQUE ETAT COULEURS ---
  const now = Date.now();
  const wedDate = new Date(project.weddingDate).getTime();
  const isFinished = (project.statusPhoto === 'delivered' || project.statusPhoto === 'none') && (project.statusVideo === 'delivered' || project.statusVideo === 'none');
  const isUrgent = !isFinished && now > wedDate + (60 * 24 * 3600 * 1000); // 2 mois
  const isLate = !isFinished && !isUrgent && now > wedDate + (15 * 24 * 3600 * 1000); // 15 jours

  let borderStyle = 'border-l-4 border-l-stone-300 border-y border-r border-stone-200';
  if (isUrgent) borderStyle = 'border-l-4 border-l-red-500 border-y border-r border-red-200 bg-red-50/30';
  else if (isLate) borderStyle = 'border-l-4 border-l-orange-400 border-y border-r border-orange-200 bg-orange-50/30';
  else if (isExpanded) borderStyle = 'border-l-4 border-l-stone-800 border-y border-r border-stone-300 shadow-md transform scale-[1.01]';

  useEffect(() => { if (!hasChanges) setLocalData(project); }, [project, hasChanges]);

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
      setNewAlbum({ name: 'Album', format: '30x30', price: 0 });
  };

  const updateAlbum = (idx: number, field: string, val: any) => {
      const albums = [...(localData.albums || [])];
      albums[idx] = { ...albums[idx], [field]: val };
      updateField('albums', albums);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0]; if (!file) return;
    try {
      setUploading(true);
      let storageRef = ref(storage, `covers/${project.id}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateField('coverImage', url);
    } catch (error: any) { alert(`Erreur: ${error.message}`); } finally { setUploading(false); }
  };

  const save = async () => {
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
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

  const handleDelete = async () => {
    if(!confirm('Supprimer définitivement ce dossier ?')) return;
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    await deleteDoc(doc(db, colPath, project.id));
  };

  return (
    <div className={`bg-white rounded-lg transition-all duration-200 ${borderStyle}`}>
        {/* ENTÊTE LIGNE (LISTE) */}
        <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-center gap-6 flex-1">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-400 shrink-0 overflow-hidden relative group">
                    {project.coverImage ? <img src={project.coverImage} className="w-full h-full object-cover"/> : project.clientNames.charAt(0)}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Eye className="w-4 h-4 text-white"/></div>
                </div>
                <div className="min-w-[200px]">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-800 text-lg">{project.clientNames}</span>
                        {localData.isPriority && <Rocket className="w-4 h-4 text-amber-500 animate-pulse"/>}
                    </div>
                    <p className="text-xs text-stone-500 flex items-center gap-2">
                        <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono font-bold">CODE: {project.code}</span>
                        <span>•</span>
                        <MapPin className="w-3 h-3"/> {project.clientCity || 'Ville?'}
                    </p>
                </div>
                <div className="hidden md:block text-sm text-stone-500 font-mono bg-stone-50 px-2 py-1 rounded">{project.weddingDate}</div>
                <div className="hidden md:flex gap-4">
                    {project.statusPhoto !== 'none' && <span className={`text-xs px-2 py-1 rounded-full font-bold ${project.statusPhoto === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>PHOTO: {PHOTO_STEPS[project.statusPhoto].label}</span>}
                    {project.statusVideo !== 'none' && <span className={`text-xs px-2 py-1 rounded-full font-bold ${project.statusVideo === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>VIDEO: {VIDEO_STEPS[project.statusVideo].label}</span>}
                </div>
            </div>
            <div className="flex items-center gap-4">
                {project.deliveryConfirmed && <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckSquare className="w-3 h-3"/> LIVRÉ</span>}
                <ChevronRight className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </div>
        </div>

        {isExpanded && (
            <div className="p-6 border-t bg-stone-50/50 space-y-8 animate-fade-in">
                
                {/* BARRE D'ACTION HAUTE */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button onClick={() => updateField('isPriority', !localData.isPriority)} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${localData.isPriority ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 transform scale-105' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}>
                            <Rocket className="w-5 h-5"/> {localData.isPriority ? 'FAST TRACK ACTIF' : 'Activer Fast Track'}
                        </button>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto items-center">
                         <div className="px-4 py-2 bg-stone-100 rounded-lg font-mono text-sm font-bold text-stone-600 border border-stone-200">
                             CODE CLIENT : <span className="text-black select-all">{localData.code}</span>
                         </div>
                        <button onClick={invite} className="px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-bold hover:bg-stone-50 flex items-center justify-center gap-2"><Mail className="w-4 h-4"/> Inviter</button>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* COLONNE GAUCHE : INFOS CLIENTS */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-stone-400"/> Fiche Mariés (Éditable)</h4>
                            <div className="space-y-4">
                                <div><label className="text-[10px] uppercase font-bold text-stone-400">Noms des Mariés</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 font-bold text-lg" value={localData.clientNames} onChange={e=>updateField('clientNames', e.target.value)} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] uppercase font-bold text-stone-400">Email 1</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientEmail} onChange={e=>updateField('clientEmail', e.target.value)} /></div>
                                    <div><label className="text-[10px] uppercase font-bold text-stone-400">Tel 1</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientPhone} onChange={e=>updateField('clientPhone', e.target.value)} /></div>
                                </div>
                                <div><label className="text-[10px] uppercase font-bold text-stone-400">Salle de Mariage (Lieu)</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" placeholder="Château de..." value={localData.weddingVenue || ''} onChange={e=>updateField('weddingVenue', e.target.value)} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] uppercase font-bold text-stone-400">Adresse Postale</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" placeholder="12 rue..." value={localData.clientAddress || ''} onChange={e=>updateField('clientAddress', e.target.value)} /></div>
                                    <div><label className="text-[10px] uppercase font-bold text-stone-400">Ville</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" placeholder="Paris" value={localData.clientCity || ''} onChange={e=>updateField('clientCity', e.target.value)} /></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
                            <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><FileText className="w-5 h-5"/> Notes Internes</h4>
                            <textarea disabled={!canEdit} className="w-full p-3 rounded-xl border border-amber-200 bg-white text-sm min-h-[100px]" placeholder="Allergies, infos importantes, VIP..." value={localData.adminNotes || ''} onChange={e=>updateField('adminNotes', e.target.value)} />
                        </div>
                    </div>

                    {/* COLONNE DROITE : PRODUCTION */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-stone-400"/> Suivi Production</h4>
                            
                            {/* PHOTO */}
                            <div className="mb-6 pb-6 border-b border-stone-100">
                                <div className="flex justify-between mb-2"><span className="font-bold text-stone-600">Photo</span><span className="text-xs bg-stone-100 px-2 py-1 rounded">{localData.progressPhoto}%</span></div>
                                <select disabled={!canEdit} className="w-full p-2 border rounded mb-2 text-sm font-medium" value={localData.statusPhoto} onChange={e=>updateField('statusPhoto', e.target.value)}>{Object.entries(PHOTO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                                <div className="flex gap-2 items-center">
                                    <div className="w-1/3"><label className="text-[10px] font-bold text-stone-400">LIVRAISON PRÉVUE</label><input disabled={!canEdit} type="date" className="w-full p-2 border rounded text-xs bg-yellow-50 border-yellow-200" value={localData.estimatedDeliveryPhoto || ''} onChange={e=>updateField('estimatedDeliveryPhoto', e.target.value)}/></div>
                                    <div className="flex-1"><label className="text-[10px] font-bold text-stone-400">LIEN GALERIE</label><input disabled={!canEdit} className="w-full p-2 border rounded text-xs" placeholder="https://..." value={localData.linkPhoto || ''} onChange={e=>updateField('linkPhoto', e.target.value)}/></div>
                                </div>
                            </div>

                            {/* VIDEO */}
                            <div>
                                <div className="flex justify-between mb-2"><span className="font-bold text-stone-600">Vidéo</span><span className="text-xs bg-stone-100 px-2 py-1 rounded">{localData.progressVideo}%</span></div>
                                <select disabled={!canEdit} className="w-full p-2 border rounded mb-2 text-sm font-medium" value={localData.statusVideo} onChange={e=>updateField('statusVideo', e.target.value)}>{Object.entries(VIDEO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                                <div className="flex gap-2 items-center">
                                    <div className="w-1/3"><label className="text-[10px] font-bold text-stone-400">LIVRAISON PRÉVUE</label><input disabled={!canEdit} type="date" className="w-full p-2 border rounded text-xs bg-yellow-50 border-yellow-200" value={localData.estimatedDeliveryVideo || ''} onChange={e=>updateField('estimatedDeliveryVideo', e.target.value)}/></div>
                                    <div className="flex-1"><label className="text-[10px] font-bold text-stone-400">LIEN VIDÉO</label><input disabled={!canEdit} className="w-full p-2 border rounded text-xs" placeholder="https://..." value={localData.linkVideo || ''} onChange={e=>updateField('linkVideo', e.target.value)}/></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-stone-400"/> Albums</h4>
                            <div className="space-y-2">
                                {(localData.albums || []).map((album, idx) => (
                                    <div key={idx} className="flex flex-wrap gap-2 items-center bg-stone-50 p-2 rounded-lg text-sm">
                                        <div className="font-bold flex-1">{album.name}</div>
                                        <select disabled={!canEdit} value={album.status} onChange={e => updateAlbum(idx, 'status', e.target.value)} className="p-1 border rounded text-xs">{Object.entries(ALBUM_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
                                        <button disabled={!canEdit} onClick={() => updateAlbum(idx, 'paid', !album.paid)} className={`px-2 py-1 rounded text-[10px] font-bold ${album.paid ? 'bg-green-200 text-green-800' : 'bg-red-100 text-red-800'}`}>{album.paid ? 'PAYÉ' : 'DÛ'}</button>
                                        {canEdit && <button onClick={() => { const a = [...(localData.albums||[])]; a.splice(idx, 1); updateField('albums', a); }} className="text-red-400"><Trash2 className="w-3 h-3"/></button>}
                                    </div>
                                ))}
                            </div>
                            {canEdit && (
                                <div className="mt-4 pt-4 border-t flex gap-2">
                                    <input className="flex-1 p-2 border rounded text-xs" placeholder="Nouvel Album" value={newAlbum.name} onChange={e => setNewAlbum({...newAlbum, name: e.target.value})} />
                                    <button onClick={addAlbum} className="bg-stone-900 text-white px-3 rounded text-xs font-bold">Ajouter</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <ChatBox project={project} userType="admin" disabled={!canEdit} />

                {canEdit && (
                    <div className="flex justify-between pt-6 border-t items-center">
                        {isSuperAdmin ? <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-xs flex gap-1 items-center font-bold px-4 py-2 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4"/> Supprimer Dossier</button> : <div/>}
                        <button onClick={save} disabled={!hasChanges} className="bg-stone-900 text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:bg-black transition-all disabled:opacity-50 disabled:shadow-none transform hover:scale-105">Enregistrer les modifications</button>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}