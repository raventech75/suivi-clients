'use client';
import React, { useState, useEffect } from 'react';
import { 
  Camera, Video, Ban, ChevronRight, Rocket, Mail, 
  BookOpen, Trash2, Image as ImageIcon, CheckSquare, 
  Upload, Loader2, MapPin, FileText, Users, Calendar, Eye, Timer, Music, Briefcase, History, PenTool
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, MAKE_WEBHOOK_URL, PHOTO_STEPS, 
  VIDEO_STEPS, ALBUM_FORMATS, ALBUM_STATUSES, Project, HistoryLog 
} from '../lib/config';
import ChatBox from './ChatSystem';

// PETIT UTILITAIRE POUR LES DATES FR
const formatDateFR = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// UTILITAIRE POUR LA DATE ET L'HEURE DU LOG
const formatDateTimeFR = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit' });
};

export default function ProjectEditor({ project, isSuperAdmin, staffList, user }: { project: Project, isSuperAdmin: boolean, staffList: string[], user: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState(project);
  const [hasChanges, setHasChanges] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ name: 'Album', format: '30x30', price: 0 });
  const [uploading, setUploading] = useState(false);

  // 🟢 PERMISSION : TOUT LE MONDE CONNECTÉ A LE DROIT D'ÉCRIRE MAINTENANT
  // (On garde isManager/isSuperAdmin juste pour des actions destructrices si besoin, mais l'édition est ouverte)
  const canEdit = !!user; 

  // --- LOGIQUE FAST TRACK ---
  const now = Date.now();
  const wedDate = new Date(project.weddingDate).getTime();
  const isFinished = (project.statusPhoto === 'delivered' || project.statusPhoto === 'none') && (project.statusVideo === 'delivered' || project.statusVideo === 'none');
  
  const activationTime = project.fastTrackActivationDate ? new Date(project.fastTrackActivationDate).getTime() : now;
  const fastTrackDeadline = activationTime + (14 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.ceil((fastTrackDeadline - now) / (1000 * 60 * 60 * 24));
  
  let borderStyle = 'border-l-4 border-l-stone-300 border-y border-r border-stone-200';
  let bgStyle = 'bg-white';
  
  if (localData.isPriority && !isFinished) {
      borderStyle = 'border-l-8 border-l-orange-500 border-y-2 border-r-2 border-orange-400 ring-2 ring-orange-200 shadow-xl shadow-orange-100/50';
      bgStyle = 'bg-orange-50/40';
  } else if (!isFinished && now > wedDate + (60 * 24 * 3600 * 1000)) { 
      borderStyle = 'border-l-4 border-l-red-500 border-y border-r border-red-200';
      bgStyle = 'bg-red-50/30';
  } else if (!isFinished && now > wedDate + (15 * 24 * 3600 * 1000)) { 
      borderStyle = 'border-l-4 border-l-orange-300 border-y border-r border-orange-200';
      bgStyle = 'bg-orange-50/20';
  }

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

  const toggleFastTrack = () => {
      const isActive = !localData.isPriority;
      updateField('isPriority', isActive);
      updateField('fastTrackActivationDate', isActive ? new Date().toISOString() : null);
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

  // --- LOGIQUE DE DÉTECTION DES CHANGEMENTS (AUDIT LOG) ---
  const detectChanges = (): string[] => {
      const changes: string[] = [];
      const labels: Record<string, string> = {
          clientNames: 'Noms Mariés', clientEmail: 'Email 1', clientPhone: 'Tel 1',
          clientEmail2: 'Email 2', clientPhone2: 'Tel 2', weddingDate: 'Date Mariage',
          weddingVenue: 'Lieu', clientAddress: 'Adresse', clientCity: 'Ville',
          adminNotes: 'Notes Admin', statusPhoto: 'Statut Photo', statusVideo: 'Statut Vidéo',
          photographerName: 'Photographe', videographerName: 'Vidéaste', managerName: 'Responsable',
          isPriority: 'Fast Track'
      };

      // Comparaison champs simples
      Object.keys(labels).forEach(key => {
          // @ts-ignore
          const oldVal = project[key];
          // @ts-ignore
          const newVal = localData[key];

          if (oldVal != newVal) {
              // Cas speciaux pour affichage propre
              let displayOld = oldVal;
              let displayNew = newVal;

              if (key === 'statusPhoto') { displayOld = PHOTO_STEPS[oldVal]?.label; displayNew = PHOTO_STEPS[newVal]?.label; }
              if (key === 'statusVideo') { displayOld = VIDEO_STEPS[oldVal]?.label; displayNew = VIDEO_STEPS[newVal]?.label; }
              if (key === 'isPriority') { displayOld = oldVal ? 'Oui' : 'Non'; displayNew = newVal ? 'Oui' : 'Non'; }

              changes.push(`${labels[key]} : ${displayOld || 'Vide'} ➔ ${displayNew || 'Vide'}`);
          }
      });

      return changes;
  };

  const save = async () => {
      // 1. Détection des modifs pour l'historique
      const changesList = detectChanges();
      let updatedHistory = [...(localData.history || [])];

      if (changesList.length > 0) {
          const newEntry: HistoryLog = {
              date: new Date().toISOString(),
              user: user.email ? user.email.split('@')[0] : 'Inconnu', // On prend la partie avant @ du mail
              action: changesList.join(' | ')
          };
          // On ajoute en haut de la liste (le plus récent d'abord)
          updatedHistory = [newEntry, ...updatedHistory];
      }

      // 2. Préparation des données finales
      const finalData = { 
          ...localData, 
          history: updatedHistory,
          lastUpdated: serverTimestamp() 
      };

      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, project.id), finalData);
      
      // 3. Webhook (si changement d'étape et email valide)
      if (localData.statusPhoto !== project.statusPhoto || localData.statusVideo !== project.statusVideo) {
          if (localData.clientEmail && localData.clientEmail.includes('@')) {
              fetch(MAKE_WEBHOOK_URL, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                      type: 'step_update', 
                      clientName: localData.clientNames, 
                      clientEmail: localData.clientEmail, 
                      projectCode: localData.code,
                      stepName: localData.statusPhoto !== project.statusPhoto ? PHOTO_STEPS[localData.statusPhoto].label : VIDEO_STEPS[localData.statusVideo].label, 
                      url: window.location.origin 
                  })
              }).catch(console.error);
          }
      }
      setHasChanges(false); setIsExpanded(false);
  };

  const invite = async () => {
      if (!localData.clientEmail || !localData.clientEmail.includes('@')) {
          alert("❌ Impossible d'envoyer l'invitation : L'adresse email du client est manquante ou invalide.");
          return;
      }
      fetch(MAKE_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'invite', clientName: localData.clientNames, clientEmail: localData.clientEmail, projectCode: localData.code, url: window.location.origin }) });
      alert("Invitation envoyée !");
  };

  const handleDelete = async () => {
    if(!confirm('Supprimer définitivement ce dossier ?')) return;
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    await deleteDoc(doc(db, colPath, project.id));
  };

  return (
    <div className={`rounded-lg transition-all duration-200 mb-4 ${borderStyle} ${bgStyle}`}>
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
                        {localData.isPriority && !isFinished && (
                             <div className="flex items-center gap-1 bg-orange-500 text-white px-2 py-0.5 rounded-md text-xs font-black animate-pulse shadow-sm">
                                <Rocket className="w-3 h-3"/> 
                                {daysRemaining >= 0 ? `J-${daysRemaining}` : `RETARD J+${Math.abs(daysRemaining)}`}
                             </div>
                        )}
                    </div>
                    <p className="text-xs text-stone-500 flex items-center gap-2">
                        <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono font-bold">CODE: {project.code}</span>
                        <span>•</span>
                        <MapPin className="w-3 h-3"/> {project.clientCity || 'Ville?'}
                    </p>
                </div>
                <div className="hidden md:block text-sm text-stone-500 font-mono bg-stone-50 px-2 py-1 rounded">{formatDateFR(project.weddingDate)}</div>
                
                <div className="hidden md:flex gap-4">
                    {project.statusPhoto !== 'none' && (
                        <div className={`text-xs px-3 py-1.5 rounded-full font-bold flex flex-col items-center leading-tight ${project.statusPhoto === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            <span>PHOTO: {PHOTO_STEPS[project.statusPhoto].label}</span>
                            {project.estimatedDeliveryPhoto && <span className="text-[10px] opacity-75">{formatDateFR(project.estimatedDeliveryPhoto)}</span>}
                        </div>
                    )}
                    {project.statusVideo !== 'none' && (
                        <div className={`text-xs px-3 py-1.5 rounded-full font-bold flex flex-col items-center leading-tight ${project.statusVideo === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            <span>VIDEO: {VIDEO_STEPS[project.statusVideo].label}</span>
                            {project.estimatedDeliveryVideo && <span className="text-[10px] opacity-75">{formatDateFR(project.estimatedDeliveryVideo)}</span>}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4">
                {project.deliveryConfirmed && <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckSquare className="w-3 h-3"/> LIVRÉ</span>}
                <ChevronRight className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </div>
        </div>

        {isExpanded && (
            <div className="p-6 border-t bg-stone-50/50 space-y-8 animate-fade-in">
                
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button onClick={toggleFastTrack} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${localData.isPriority ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 transform scale-105' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] uppercase font-bold text-stone-400">Email 2</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientEmail2 || ''} onChange={e=>updateField('clientEmail2', e.target.value)} /></div>
                                    <div><label className="text-[10px] uppercase font-bold text-stone-400">Tel 2</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientPhone2 || ''} onChange={e=>updateField('clientPhone2', e.target.value)} /></div>
                                </div>
                                <div><label className="text-[10px] uppercase font-bold text-stone-400">Date Mariage</label><input required type="date" disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.weddingDate} onChange={e=>updateField('weddingDate', e.target.value)} /></div>
                                
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
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-stone-400"/> Équipe & Responsables</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-stone-400">Responsable Dossier (Accès Admin)</label>
                                    <select disabled={!isSuperAdmin} className="w-full p-2 border rounded bg-stone-50 font-medium" value={localData.managerName || ''} onChange={e=>updateField('managerName', e.target.value)}>
                                        <option value="">-- Sélectionner --</option>
                                        {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-stone-400">Email du Responsable (Pour Connexion)</label>
                                    <input disabled={!isSuperAdmin} className="w-full p-2 border rounded bg-stone-50 text-sm" value={localData.managerEmail || ''} onChange={e=>updateField('managerEmail', e.target.value)} placeholder="email@raventech.fr" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-stone-400">Photographe J-J</label>
                                        <select disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 text-sm" value={localData.photographerName || ''} onChange={e=>updateField('photographerName', e.target.value)}>
                                            <option value="">-- Non assigné --</option>
                                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-stone-400">Vidéaste J-J</label>
                                        <select disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 text-sm" value={localData.videographerName || ''} onChange={e=>updateField('videographerName', e.target.value)}>
                                            <option value="">-- Non assigné --</option>
                                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-stone-400"/> Suivi Production</h4>
                            <div className="mb-6 pb-6 border-b border-stone-100">
                                <div className="flex justify-between mb-2"><span className="font-bold text-stone-600">Photo</span><span className="text-xs bg-stone-100 px-2 py-1 rounded">{localData.progressPhoto}%</span></div>
                                <select disabled={!canEdit} className="w-full p-2 border rounded mb-2 text-sm font-medium" value={localData.statusPhoto} onChange={e=>updateField('statusPhoto', e.target.value)}>{Object.entries(PHOTO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                                <div className="flex gap-2 items-center">
                                    <div className="w-1/3"><label className="text-[10px] font-bold text-stone-400">LIVRAISON PRÉVUE</label><input disabled={!canEdit} type="date" className="w-full p-2 border rounded text-xs bg-yellow-50 border-yellow-200" value={localData.estimatedDeliveryPhoto || ''} onChange={e=>updateField('estimatedDeliveryPhoto', e.target.value)}/></div>
                                    <div className="flex-1"><label className="text-[10px] font-bold text-stone-400">LIEN GALERIE</label><input disabled={!canEdit} className="w-full p-2 border rounded text-xs" placeholder="https://..." value={localData.linkPhoto || ''} onChange={e=>updateField('linkPhoto', e.target.value)}/></div>
                                </div>
                            </div>
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

                        <div className="bg-purple-50 p-6 rounded-xl border border-purple-100 shadow-sm">
                            <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2"><Music className="w-5 h-5"/> Brief Créatif (Rempli par le client)</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-purple-400">Instructions de Montage</label>
                                    <textarea disabled={!canEdit} className="w-full p-3 rounded-xl border border-purple-200 bg-white text-sm min-h-[80px]" placeholder="Le client n'a rien indiqué..." value={localData.musicInstructions || ''} onChange={e=>updateField('musicInstructions', e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-purple-400">Liens Musique (Spotify/YouTube)</label>
                                    <textarea disabled={!canEdit} className="w-full p-3 rounded-xl border border-purple-200 bg-white text-sm" placeholder="Pas de liens..." value={localData.musicLinks || ''} onChange={e=>updateField('musicLinks', e.target.value)} />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                
                {/* 👇 NOUVEAU BLOC : HISTORIQUE DES MODIFICATIONS */}
                <div className="mt-8 bg-stone-100 p-6 rounded-xl border border-stone-200">
                    <h4 className="font-bold text-stone-700 mb-4 flex items-center gap-2">
                        <History className="w-5 h-5"/> Historique des modifications
                    </h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {localData.history && localData.history.length > 0 ? (
                            localData.history.map((log, i) => (
                                <div key={i} className="flex gap-3 text-sm items-start bg-white p-3 rounded-lg border border-stone-200 shadow-sm">
                                    <div className="min-w-[120px] text-xs font-mono text-stone-400 pt-0.5">
                                        {formatDateTimeFR(log.date)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-stone-800 flex items-center gap-2">
                                            <span className="bg-stone-100 px-1.5 rounded text-xs border border-stone-200">{log.user}</span>
                                        </div>
                                        <div className="text-stone-600 mt-1 pl-1 border-l-2 border-stone-200 text-xs">
                                            {log.action}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-stone-400 italic text-sm text-center py-4">Aucune modification enregistrée pour le moment.</p>
                        )}
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