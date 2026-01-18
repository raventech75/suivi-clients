'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, Ban, ChevronRight, Rocket, Mail, 
  BookOpen, Trash2, Image as ImageIcon, CheckSquare, 
  Upload, Loader2, MapPin, FileText, Users, Calendar, Eye, Timer, Music, Briefcase, History, Archive, RefreshCw, UserCheck, Send, Palette, ExternalLink
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, MAKE_WEBHOOK_URL, PHOTO_STEPS, SETTINGS_COLLECTION,
  VIDEO_STEPS, ALBUM_FORMATS, ALBUM_STATUSES, Project, HistoryLog,
  STAFF_DIRECTORY 
} from '../lib/config';
import ChatBox from './ChatSystem';
import TeamChat from './TeamChat';

const formatDateFR = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTimeFR = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit' });
};

export default function ProjectEditor({ project, isSuperAdmin, staffList, staffDirectory, user }: { project: Project, isSuperAdmin: boolean, staffList: string[], staffDirectory: Record<string, string>, user: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState(project);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [newAlbum, setNewAlbum] = useState({ name: '', format: ALBUM_FORMATS[0], price: 0 });
  
  const [uploading, setUploading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = !!user; 

  const now = Date.now();
  const wedDate = new Date(project.weddingDate).getTime();
  const isFinished = (project.statusPhoto === 'delivered' || project.statusPhoto === 'none') && (project.statusVideo === 'delivered' || project.statusVideo === 'none');
  
  const activationTime = project.fastTrackActivationDate ? new Date(project.fastTrackActivationDate).getTime() : now;
  const fastTrackDeadline = activationTime + (14 * 24 * 60 * 60 * 1000);
  const daysRemaining = project.fastTrackActivationDate 
      ? Math.ceil((fastTrackDeadline - now) / (1000 * 60 * 60 * 24))
      : 0;
  
  // 👇 RESTAURATION DES COULEURS DE PRIORITÉ
  let borderStyle = 'border-l-4 border-l-stone-300 border-y border-r border-stone-200';
  let bgStyle = 'bg-white';
  
  if (localData.isArchived) {
      borderStyle = 'border-l-4 border-l-stone-400 border-y border-r border-stone-200 opacity-60 grayscale';
      bgStyle = 'bg-stone-100';
  } else if (localData.isPriority && !isFinished) {
      borderStyle = 'border-l-8 border-l-orange-500 border-y-2 border-r-2 border-orange-400 ring-2 ring-orange-200 shadow-xl shadow-orange-100/50';
      bgStyle = 'bg-orange-50/40';
  } else if (!isFinished && now > wedDate + (60 * 24 * 3600 * 1000)) { 
      // Retard > 60 jours : Rouge
      borderStyle = 'border-l-4 border-l-red-500 border-y border-r border-red-200';
      bgStyle = 'bg-red-50/30';
  } else if (!isFinished && now > wedDate + (15 * 24 * 3600 * 1000)) { 
      // Retard > 15 jours : Orange
      borderStyle = 'border-l-4 border-l-orange-300 border-y border-r border-orange-200';
      bgStyle = 'bg-orange-50/20';
  }

  useEffect(() => { if (!hasChanges) setLocalData(project); }, [project, hasChanges]);

  const handleStaffChange = (roleNameKey: 'photographerName' | 'videographerName' | 'managerName', roleEmailKey: 'photographerEmail' | 'videographerEmail' | 'managerEmail', name: string) => {
      let newData = { ...localData, [roleNameKey]: name };
      const fixedEmail = STAFF_DIRECTORY[name];
      const learnedEmail = staffDirectory ? staffDirectory[name] : null;
      const emailToUse = fixedEmail || learnedEmail;
      if (emailToUse) newData = { ...newData, [roleEmailKey]: emailToUse };
      setLocalData(newData);
      setHasChanges(true);
  };

  const updateField = (k: keyof Project, v: any) => { 
    if(!canEdit) return;
    setLocalData(p => {
        const newState = { ...p, [k]: v };
        if(k === 'statusPhoto' && PHOTO_STEPS[v as keyof typeof PHOTO_STEPS]) newState.progressPhoto = PHOTO_STEPS[v as keyof typeof PHOTO_STEPS].percent;
        if(k === 'statusVideo' && VIDEO_STEPS[v as keyof typeof VIDEO_STEPS]) newState.progressVideo = VIDEO_STEPS[v as keyof typeof VIDEO_STEPS].percent;
        return newState;
    });
    setHasChanges(true); 
  };

  const toggleArchive = async () => {
      if(!confirm(localData.isArchived ? "Réactiver ce dossier ?" : "Clôturer et archiver ce dossier ?")) return;
      const newStatus = !localData.isArchived;
      const newHistory = [{
          date: new Date().toISOString(),
          user: user.email ? user.email.split('@')[0] : 'Admin',
          action: newStatus ? 'DOSSIER ARCHIVÉ' : 'DOSSIER RÉACTIVÉ'
      }, ...(localData.history || [])];
      await updateDoc(doc(db, typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME, project.id), {
          isArchived: newStatus, history: newHistory, lastUpdated: serverTimestamp()
      });
      setIsExpanded(false);
  };

  const toggleFastTrack = () => {
      const isActive = !localData.isPriority;
      updateField('isPriority', isActive);
      updateField('fastTrackActivationDate', isActive ? new Date().toISOString() : null);
  };

  const addAlbum = () => {
      if(!newAlbum.name) return alert("Nom de l'album requis");
      const albums = localData.albums || [];
      updateField('albums', [...albums, { id: Date.now().toString(), ...newAlbum, status: 'pending', paid: false }]);
      setNewAlbum({ name: '', format: ALBUM_FORMATS[0], price: 0 });
  };

  const updateAlbum = (idx: number, field: string, val: any) => {
      const albums = [...(localData.albums || [])];
      albums[idx] = { ...albums[idx], [field]: val };
      updateField('albums', albums);
  };

  // 👇 MODIFICATION : Sauvegarde Automatique après Upload
  const processFile = async (file: File) => {
    if (!canEdit) return;
    try {
      setUploading(true);
      const fileName = `${project.id}_${Date.now()}`; 
      let storageRef = ref(storage, `covers/${fileName}`);
      
      // 1. Upload
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // 2. Mise à jour locale (pour voir l'image tout de suite)
      setLocalData(prev => ({ ...prev, coverImage: url }));
      
      // 3. SAUVEGARDE DIRECTE EN BDD (Plus besoin de cliquer sur Enregistrer)
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, project.id), { 
          coverImage: url,
          lastUpdated: serverTimestamp() 
      });

    } catch (error: any) { 
        alert(`Erreur upload: ${error.message}`); 
    } finally { 
        setUploading(false); 
        setIsDragging(false); 
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const handleDrag = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
      else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const save = async () => {
      if (!localData.clientEmail || !localData.clientEmail.includes('@')) { alert("⛔️ Email client manquant."); return; }
      
      let updatedHistory = [...(localData.history || [])];
      const cleanData = { ...localData } as any;
      if (cleanData.photographerEmail === undefined) cleanData.photographerEmail = null;
      if (cleanData.videographerEmail === undefined) cleanData.videographerEmail = null;
      if (cleanData.managerEmail === undefined) cleanData.managerEmail = null;

      const finalData = { ...cleanData, history: updatedHistory, lastUpdated: serverTimestamp() };
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      
      try { await updateDoc(doc(db, colPath, project.id), finalData); } 
      catch (error) { console.error("Erreur Sauvegarde:", error); return; }

      const hasPhotoChanged = localData.statusPhoto !== project.statusPhoto;
      const hasVideoChanged = localData.statusVideo !== project.statusVideo;
      
      if (hasPhotoChanged || hasVideoChanged) {
          let stepLabel = PHOTO_STEPS[localData.statusPhoto]?.label || "Mise à jour";
          if (hasVideoChanged) stepLabel = VIDEO_STEPS[localData.statusVideo]?.label || "Mise à jour";
          
          fetch(MAKE_WEBHOOK_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  type: 'step_update', clientName: localData.clientNames, clientEmail: localData.clientEmail,
                  projectCode: localData.code, managerEmail: localData.managerEmail || "",
                  photographerEmail: localData.photographerEmail || "", videographerEmail: localData.videographerEmail || "",
                  stepName: stepLabel, url: window.location.origin 
              })
          }).catch(err => console.error("Erreur Webhook", err));
      }
      setHasChanges(false); setIsExpanded(false);
  };

  const invite = async () => {
      if (!localData.clientEmail) { alert("Email client manquant"); return; }
      setSendingInvite(true);
      try {
          await fetch(MAKE_WEBHOOK_URL, { 
              method:'POST', headers:{'Content-Type':'application/json'}, 
              body:JSON.stringify({ type:'invite', clientName: localData.clientNames, clientEmail: localData.clientEmail, projectCode: localData.code, url: window.location.origin }) 
          });
          const newCount = (localData.inviteCount || 0) + 1;
          const newHistory = [{ date: new Date().toISOString(), user: user.email?.split('@')[0] || 'Admin', action: `INVITATION ENVOYÉE (N°${newCount})` }, ...(localData.history||[])];
          const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
          await updateDoc(doc(db, colPath, project.id), { inviteCount: newCount, history: newHistory, lastUpdated: serverTimestamp() });
          setLocalData(prev => ({ ...prev, inviteCount: newCount, history: newHistory }));
          alert(`✅ Invitation envoyée (N°${newCount})`);
      } catch (err) { alert("Erreur envoi"); } finally { setSendingInvite(false); }
  };

  const handleDelete = async () => {
    if(!confirm('Supprimer ?')) return;
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    await deleteDoc(doc(db, colPath, project.id));
  };

  return (
    <div className={`rounded-lg transition-all duration-200 mb-4 ${borderStyle} ${bgStyle}`}>
        <div className="p-4 flex items-center justify-between cursor-pointer" onClick={(e) => { if(!(e.target as HTMLElement).closest('.avatar-uploader')) setIsExpanded(!isExpanded); }}>
            <div className="flex items-center gap-4 flex-1">
                <div 
                    className={`avatar-uploader w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden relative group transition-all duration-200 border-2 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50 scale-110 shadow-lg' : 'border-transparent bg-stone-100 text-stone-400'}`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    onClick={() => canEdit && fileInputRef.current?.click()} title="Changer couverture"
                >
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    {uploading ? <Loader2 className="w-5 h-5 text-stone-500 animate-spin"/> : localData.coverImage ? <img src={localData.coverImage} className={`w-full h-full object-cover transition-opacity ${isDragging ? 'opacity-50' : ''}`}/> : <span className="text-lg">{localData.clientNames.charAt(0)}</span>}
                    {canEdit && !uploading && <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><Upload className="w-4 h-4 text-white"/></div>}
                </div>
                <div className="min-w-[180px]">
                    <div className="flex items-center gap-2"><span className="font-bold text-stone-800 text-lg">{project.clientNames}</span>{localData.isPriority && !isFinished && !localData.isArchived && <div className="flex items-center gap-1 bg-orange-500 text-white px-2 py-0.5 rounded-md text-xs font-black animate-pulse"><Rocket className="w-3 h-3"/> {daysRemaining >= 0 ? `J-${daysRemaining}` : `RETARD`}</div>}{localData.isArchived && <span className="bg-stone-200 text-stone-500 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"><Archive className="w-3 h-3"/> ARCHIVÉ</span>}</div>
                    <p className="text-xs text-stone-500 flex items-center gap-2 mt-1"><span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono font-bold">{project.code}</span><span>•</span><MapPin className="w-3 h-3"/> {project.weddingVenue || 'Lieu non défini'}</p>
                </div>
                <div className="hidden lg:flex items-center gap-4 text-xs text-stone-500 border-l border-r border-stone-100 px-4">
                    <div className="flex flex-col items-center w-16 text-center" title="Responsable Dossier"><UserCheck className="w-4 h-4 mb-1 text-purple-400"/><span className="truncate w-full font-bold">{project.managerName || '-'}</span></div>
                    <div className="flex flex-col items-center w-16 text-center" title="Photographe"><Camera className="w-4 h-4 mb-1 text-amber-400"/><span className="truncate w-full font-bold">{project.photographerName || '-'}</span></div>
                    <div className="flex flex-col items-center w-16 text-center" title="Vidéaste"><Video className="w-4 h-4 mb-1 text-blue-400"/><span className="truncate w-full font-bold">{project.videographerName || '-'}</span></div>
                </div>
                <div className="hidden md:block text-sm text-stone-500 font-mono bg-stone-50 px-2 py-1 rounded">{formatDateFR(project.weddingDate)}</div>
                <div className="hidden md:flex gap-3">
                    {project.statusPhoto !== 'none' && <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border shadow-sm transition-all ${project.statusPhoto === 'delivered' ? 'bg-white border-green-200' : 'bg-white border-amber-200'} ${localData.isArchived ? 'opacity-50 grayscale' : ''}`}><div className={`p-1.5 rounded-md ${project.statusPhoto === 'delivered' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}><Camera className="w-4 h-4" /></div><div className="flex flex-col leading-none"><span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${project.statusPhoto === 'delivered' ? 'text-green-700' : 'text-amber-700'}`}>{(PHOTO_STEPS as any)[project.statusPhoto]?.label || project.statusPhoto}</span><span className="text-[10px] text-stone-400 font-mono">{project.estimatedDeliveryPhoto ? formatDateFR(project.estimatedDeliveryPhoto) : 'Date à définir'}</span></div></div>}
                    {project.statusVideo !== 'none' && <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border shadow-sm transition-all ${project.statusVideo === 'delivered' ? 'bg-white border-green-200' : 'bg-white border-blue-200'} ${localData.isArchived ? 'opacity-50 grayscale' : ''}`}><div className={`p-1.5 rounded-md ${project.statusVideo === 'delivered' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}><Video className="w-4 h-4" /></div><div className="flex flex-col leading-none"><span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${project.statusVideo === 'delivered' ? 'text-green-700' : 'text-blue-700'}`}>{(VIDEO_STEPS as any)[project.statusVideo]?.label || project.statusVideo}</span><span className="text-[10px] text-stone-400 font-mono">{project.estimatedDeliveryVideo ? formatDateFR(project.estimatedDeliveryVideo) : 'Date à définir'}</span></div></div>}
                </div>
            </div>
            <div className="flex items-center gap-4">{(project.deliveryConfirmedPhoto || project.deliveryConfirmedVideo) && <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-sm"><CheckSquare className="w-3 h-3"/> LIVRÉ</span>}<ChevronRight className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} /></div>
        </div>

        {isExpanded && (
            <div className="p-6 border-t bg-stone-50/50 space-y-8 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-4 w-full md:w-auto"><button onClick={toggleFastTrack} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${localData.isPriority ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 transform scale-105' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}><Rocket className="w-5 h-5"/> {localData.isPriority ? 'FAST TRACK ACTIF' : 'Activer Fast Track'}</button></div>
                    <div className="flex gap-2 w-full md:w-auto items-center">
                         <div className="px-4 py-2 bg-stone-100 rounded-lg font-mono text-sm font-bold text-stone-600 border border-stone-200">CODE : <span className="text-black select-all">{localData.code}</span></div>
                        <div className="flex flex-col items-end"><button onClick={invite} disabled={sendingInvite} className="px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-bold hover:bg-stone-50 flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]">{sendingInvite ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}{localData.inviteCount && localData.inviteCount > 0 ? "Renvoyer" : "Inviter"}</button>{localData.inviteCount && localData.inviteCount > 0 && <span className="text-[10px] text-stone-400 font-mono mt-1 mr-1">Envoyé {localData.inviteCount} fois</span>}</div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-stone-400"/> Fiche Mariés</h4>
                            <div className="space-y-4">
                                <div><label className="text-[10px] uppercase font-bold text-stone-400">Noms</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 font-bold text-lg" value={localData.clientNames} onChange={e=>updateField('clientNames', e.target.value)} /></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] uppercase font-bold text-stone-400">Email 1</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientEmail} onChange={e=>updateField('clientEmail', e.target.value)} /></div><div><label className="text-[10px] uppercase font-bold text-stone-400">Tel 1</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientPhone} onChange={e=>updateField('clientPhone', e.target.value)} /></div></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] uppercase font-bold text-stone-400">Email 2</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientEmail2 || ''} onChange={e=>updateField('clientEmail2', e.target.value)} /></div><div><label className="text-[10px] uppercase font-bold text-stone-400">Tel 2</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientPhone2 || ''} onChange={e=>updateField('clientPhone2', e.target.value)} /></div></div>
                                <div className="pt-2 border-t border-dashed mt-2"><div className="grid grid-cols-3 gap-2"><div className="col-span-1"><label className="text-[10px] uppercase font-bold text-stone-400">Date Mariage</label><input required type="date" disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.weddingDate} onChange={e=>updateField('weddingDate', e.target.value)} /></div><div className="col-span-2"><label className="text-[10px] uppercase font-bold text-stone-400">Nom Salle / Lieu</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" placeholder="Château de..." value={localData.weddingVenue || ''} onChange={e=>updateField('weddingVenue', e.target.value)} /></div></div><div className="mt-2"><label className="text-[10px] uppercase font-bold text-stone-400">Code Postal</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" placeholder="75000" value={localData.weddingVenueZip || ''} onChange={e=>updateField('weddingVenueZip', e.target.value)} /></div></div>
                            </div>
                        </div>
                        {/* CHAT EQUIPE */}
                        <div className="h-[400px]"><TeamChat project={project} user={user} /></div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-stone-400"/> Équipe & Contact</h4>
                            <div className="space-y-4">
                                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100"><label className="text-[10px] uppercase font-bold text-purple-600 block mb-1">Responsable Dossier</label><div className="flex gap-2"><select disabled={!isSuperAdmin} className="w-1/3 p-2 border rounded bg-white text-sm" value={localData.managerName || ''} onChange={e=>handleStaffChange('managerName', 'managerEmail', e.target.value)}><option value="">-- Nom --</option>{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select><input disabled={!isSuperAdmin} className="flex-1 p-2 border rounded bg-white text-sm" value={localData.managerEmail || ''} onChange={e=>updateField('managerEmail', e.target.value)} placeholder="Email du responsable" /></div></div>
                                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100"><label className="text-[10px] uppercase font-bold text-amber-600 block mb-1">Photographe J-J</label><div className="flex gap-2"><select disabled={!canEdit} className="w-1/3 p-2 border rounded bg-white text-sm" value={localData.photographerName || ''} onChange={e=>handleStaffChange('photographerName', 'photographerEmail', e.target.value)}><option value="">-- Nom --</option>{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select><input disabled={!canEdit} className="flex-1 p-2 border rounded bg-white text-sm" value={localData.photographerEmail || ''} onChange={e=>updateField('photographerEmail', e.target.value)} placeholder="Email Photographe" /></div></div>
                                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100"><label className="text-[10px] uppercase font-bold text-blue-600 block mb-1">Vidéaste J-J</label><div className="flex gap-2"><select disabled={!canEdit} className="w-1/3 p-2 border rounded bg-white text-sm" value={localData.videographerName || ''} onChange={e=>handleStaffChange('videographerName', 'videographerEmail', e.target.value)}><option value="">-- Nom --</option>{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select><input disabled={!canEdit} className="flex-1 p-2 border rounded bg-white text-sm" value={localData.videographerEmail || ''} onChange={e=>updateField('videographerEmail', e.target.value)} placeholder="Email Vidéaste" /></div></div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-stone-400"/> Production</h4>
                            
                            {/* MOODBOARD */}
                            <div className="mb-6 p-3 bg-pink-50 rounded-lg border border-pink-100 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-pink-800"><Palette className="w-4 h-4"/><span className="text-xs font-bold uppercase">Moodboard Client</span></div>
                                {localData.moodboardLink ? (<a href={localData.moodboardLink} target="_blank" className="flex items-center gap-1 bg-white text-pink-600 px-3 py-1.5 rounded-md text-xs font-bold border border-pink-200 hover:bg-pink-100 transition shadow-sm"><ExternalLink className="w-3 h-3"/> Voir le style</a>) : (<span className="text-xs text-pink-300 italic">Aucun lien fourni</span>)}
                            </div>

                            <div className="mb-6 pb-6 border-b border-stone-100">
                                <div className="flex justify-between mb-2"><span className="font-bold text-stone-600">Photo</span><span className="text-xs bg-stone-100 px-2 py-1 rounded">{localData.progressPhoto}%</span></div>
                                <select disabled={!canEdit} className="w-full p-2 border rounded mb-2 text-sm font-medium" value={localData.statusPhoto} onChange={e=>updateField('statusPhoto', e.target.value)}>{Object.entries(PHOTO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                                <div className="flex gap-2 items-center"><div className="w-1/3"><label className="text-[10px] font-bold text-stone-400">PRÉVU <span className="text-red-500">*</span></label><input disabled={!canEdit} type="date" className={`w-full p-2 border rounded text-xs ${!localData.estimatedDeliveryPhoto && localData.statusPhoto !== 'none' ? 'border-red-400 bg-red-50' : 'bg-yellow-50 border-yellow-200'}`} value={localData.estimatedDeliveryPhoto || ''} onChange={e=>updateField('estimatedDeliveryPhoto', e.target.value)}/></div><div className="flex-1"><label className="text-[10px] font-bold text-stone-400">LIEN GALERIE</label><input disabled={!canEdit} className="w-full p-2 border rounded text-xs" placeholder="https://..." value={localData.linkPhoto || ''} onChange={e=>updateField('linkPhoto', e.target.value)}/></div></div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-2"><span className="font-bold text-stone-600">Vidéo</span><span className="text-xs bg-stone-100 px-2 py-1 rounded">{localData.progressVideo}%</span></div>
                                <select disabled={!canEdit} className="w-full p-2 border rounded mb-2 text-sm font-medium" value={localData.statusVideo} onChange={e=>updateField('statusVideo', e.target.value)}>{Object.entries(VIDEO_STEPS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
                                <div className="flex gap-2 items-center"><div className="w-1/3"><label className="text-[10px] font-bold text-stone-400">PRÉVU <span className="text-red-500">*</span></label><input disabled={!canEdit} type="date" className={`w-full p-2 border rounded text-xs ${!localData.estimatedDeliveryVideo && localData.statusVideo !== 'none' ? 'border-red-400 bg-red-50' : 'bg-yellow-50 border-yellow-200'}`} value={localData.estimatedDeliveryVideo || ''} onChange={e=>updateField('estimatedDeliveryVideo', e.target.value)}/></div><div className="flex-1"><label className="text-[10px] font-bold text-stone-400">LIEN VIDÉO</label><input disabled={!canEdit} className="w-full p-2 border rounded text-xs" placeholder="https://..." value={localData.linkVideo || ''} onChange={e=>updateField('linkVideo', e.target.value)}/></div></div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-stone-400"/> Albums</h4>
                            <div className="space-y-2">
                                {(localData.albums || []).map((album, idx) => (
                                    <div key={idx} className="flex flex-wrap gap-2 items-center bg-stone-50 p-2 rounded-lg text-sm">
                                        <div className="flex-1">
                                            <div className="font-bold">{album.name}</div>
                                            <div className="text-[10px] text-stone-400">{album.format}</div>
                                        </div>
                                        <select disabled={!canEdit} value={album.status} onChange={e => updateAlbum(idx, 'status', e.target.value)} className="p-1 border rounded text-xs">{Object.entries(ALBUM_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
                                        <button disabled={!canEdit} onClick={() => updateAlbum(idx, 'paid', !album.paid)} className={`px-2 py-1 rounded text-[10px] font-bold ${album.paid ? 'bg-green-200 text-green-800' : 'bg-red-100 text-red-800'}`}>{album.paid ? 'PAYÉ' : 'DÛ'}</button>
                                        {canEdit && <button onClick={() => { const a = [...(localData.albums||[])]; a.splice(idx, 1); updateField('albums', a); }} className="text-red-400"><Trash2 className="w-3 h-3"/></button>}
                                    </div>
                                ))}
                            </div>
                            
                            {canEdit && (
                                <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <input className="flex-1 p-2 border rounded text-xs" placeholder="Nom (Ex: Livre Parents)" value={newAlbum.name} onChange={e => setNewAlbum({...newAlbum, name: e.target.value})} />
                                        <select className="p-2 border rounded text-xs bg-white" value={newAlbum.format} onChange={e => setNewAlbum({...newAlbum, format: e.target.value})}>
                                            {ALBUM_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                         <input type="number" className="w-20 p-2 border rounded text-xs" placeholder="Prix €" value={newAlbum.price} onChange={e => setNewAlbum({...newAlbum, price: Number(e.target.value)})} />
                                         <button onClick={addAlbum} className="flex-1 bg-stone-900 text-white px-3 py-2 rounded text-xs font-bold hover:bg-black">Ajouter la commande</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="mt-8 bg-stone-100 p-6 rounded-xl border border-stone-200">
                    <h4 className="font-bold text-stone-700 mb-4 flex items-center gap-2"><History className="w-5 h-5"/> Historique</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {localData.history && localData.history.length > 0 ? (
                            localData.history.map((log, i) => (
                                <div key={i} className="flex gap-3 text-sm items-start bg-white p-3 rounded-lg border border-stone-200 shadow-sm">
                                    <div className="min-w-[120px] text-xs font-mono text-stone-400 pt-0.5">{formatDateTimeFR(log.date)}</div>
                                    <div className="flex-1">
                                        <div className="font-bold text-stone-800 flex items-center gap-2"><span className="bg-stone-100 px-1.5 rounded text-xs border border-stone-200">{log.user}</span></div>
                                        <div className="text-stone-600 mt-1 pl-1 border-l-2 border-stone-200 text-xs">{log.action}</div>
                                    </div>
                                </div>
                            ))
                        ) : (<p className="text-stone-400 italic text-sm text-center py-4">Aucune modification.</p>)}
                    </div>
                </div>

                <ChatBox project={project} userType="admin" disabled={!canEdit} />

                {canEdit && (
                    <div className="flex justify-between pt-6 border-t items-center bg-white sticky bottom-0 p-4 rounded-xl shadow-[0_-5px_15px_rgba(0,0,0,0.05)] border-t border-stone-100 mt-4">
                        <div className="flex gap-2">
                             {isSuperAdmin && <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-xs flex gap-1 items-center font-bold px-4 py-2 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4"/> Supprimer</button>}
                             <button onClick={toggleArchive} className={`text-xs flex gap-1 items-center font-bold px-4 py-2 rounded-lg transition ${localData.isArchived ? 'text-green-600 hover:bg-green-50' : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'}`}>{localData.isArchived ? <><RefreshCw className="w-4 h-4"/> Réactiver</> : <><Archive className="w-4 h-4"/> Clôturer</>}</button>
                        </div>
                        <button onClick={save} disabled={!hasChanges} className="bg-stone-900 text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:bg-black transition-all disabled:opacity-50 disabled:shadow-none transform hover:scale-105">Enregistrer</button>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}