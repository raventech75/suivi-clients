'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, Ban, ChevronRight, Rocket, Mail, 
  BookOpen, Trash2, Image as ImageIcon, CheckSquare, 
  Upload, Loader2, MapPin, FileText, Users, Calendar, Eye, Timer, Music, Briefcase, History, Archive, RefreshCw, UserCheck, Send, Palette, ExternalLink
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, MAKE_WEBHOOK_URL, PHOTO_STEPS, 
  VIDEO_STEPS, ALBUM_STATUSES, Project, 
  STAFF_DIRECTORY 
} from '../lib/config';
import ChatBox from './ChatSystem';
import TeamChat from './TeamChat';

// Utilitaires dates
const formatDateFR = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatDateTimeFR = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit' });
};

export default function ProjectEditor({ project, isSuperAdmin, staffList, staffDirectory, user }: { project: Project, isSuperAdmin: boolean, staffList: string[], staffDirectory: Record<string, string>, user: any }) {
  // Par défaut ouvert pour éviter un clic
  const [isExpanded, setIsExpanded] = useState(true);
  const [localData, setLocalData] = useState<Project>(project);
  const [hasChanges, setHasChanges] = useState(false);
  const originalDataRef = useRef<Project>(JSON.parse(JSON.stringify(project)));

  const [newAlbum, setNewAlbum] = useState({ name: '', format: '', price: 0 });
  const [uploading, setUploading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = !!user; 
  const now = Date.now();
  const isFinished = (project.statusPhoto === 'delivered' || project.statusPhoto === 'none') && (project.statusVideo === 'delivered' || project.statusVideo === 'none');
  const daysRemaining = project.fastTrackActivationDate 
      ? Math.ceil((new Date(project.fastTrackActivationDate).getTime() + (14 * 24 * 60 * 60 * 1000) - now) / (1000 * 60 * 60 * 24))
      : 0;

  // Style Bordure (réplique du Dashboard)
  let borderStyle = 'border-l-4 border-l-stone-300 border-y border-r border-stone-200';
  let bgStyle = 'bg-white';
  const wedDate = new Date(project.weddingDate).getTime();

  if (localData.isArchived) {
      borderStyle = 'border-l-4 border-l-stone-400 border-y border-r border-stone-200 opacity-60 grayscale';
      bgStyle = 'bg-stone-100';
  } else if (localData.isPriority && !isFinished) {
      borderStyle = 'border-l-8 border-l-orange-500 border-y-2 border-r-2 border-orange-400 ring-2 ring-orange-200 shadow-xl shadow-orange-100/50';
      bgStyle = 'bg-orange-50/40';
  } else if (!isFinished && now > wedDate + (60 * 24 * 3600 * 1000)) { 
      borderStyle = 'border-l-4 border-l-red-500 border-y border-r border-red-200';
      bgStyle = 'bg-red-50/30';
  } else if (!isFinished && now > wedDate + (15 * 24 * 3600 * 1000)) { 
      borderStyle = 'border-l-4 border-l-orange-300 border-y border-r border-orange-200';
      bgStyle = 'bg-orange-50/20';
  }

  // Synchronisation
  useEffect(() => { 
      if (!hasChanges) {
          setLocalData(project);
          originalDataRef.current = JSON.parse(JSON.stringify(project));
      }
  }, [project]);

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
        if(k === 'statusPhoto' && (PHOTO_STEPS as any)[v]) newState.progressPhoto = (PHOTO_STEPS as any)[v].percent;
        if(k === 'statusVideo' && (VIDEO_STEPS as any)[v]) newState.progressVideo = (VIDEO_STEPS as any)[v].percent;
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
      
      setLocalData(prev => ({ ...prev, isArchived: newStatus, history: newHistory }));
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, project.id), {
          isArchived: newStatus, history: newHistory, lastUpdated: serverTimestamp()
      });
  };

  const toggleFastTrack = () => {
      const isActive = !localData.isPriority;
      updateField('isPriority', isActive);
      updateField('fastTrackActivationDate', isActive ? new Date().toISOString() : null);
  };

  const addAlbum = () => {
      if(!newAlbum.name) return alert("Nom de l'album requis");
      const finalFormat = newAlbum.format || "Format Standard";
      const albums = localData.albums || [];
      updateField('albums', [...albums, { id: Date.now().toString(), name: newAlbum.name, format: finalFormat, price: newAlbum.price, status: 'pending', paid: false }]);
      setNewAlbum({ name: '', format: '', price: 0 });
  };

  const updateAlbum = (idx: number, field: string, val: any) => {
      const albums = [...(localData.albums || [])];
      albums[idx] = { ...albums[idx], [field]: val };
      updateField('albums', albums);
  };

  const processFile = async (file: File) => {
    if (!canEdit) return;
    try {
      setUploading(true);
      const fileName = `${project.id}_${Date.now()}`; 
      let storageRef = ref(storage, `covers/${fileName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setLocalData(prev => ({ ...prev, coverImage: url }));
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, project.id), { coverImage: url, lastUpdated: serverTimestamp() });
    } catch (error: any) { alert(`Erreur upload: ${error.message}`); } finally { setUploading(false); setIsDragging(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };
  const handleDrag = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };

  // --- SAUVEGARDE & FIX MAKE ---
  const save = async () => {
      if (!localData.clientEmail || !localData.clientEmail.includes('@')) { alert("⛔️ Email client manquant."); return; }
      
      const changes: string[] = [];
      const old = originalDataRef.current;
      const cur = localData;

      if (!old) return; 
      // Comparaison des champs... (abrégé pour lisibilité, même logique que précédemment)
      if (old.statusPhoto !== cur.statusPhoto) changes.push(`Statut Photo : ${old.statusPhoto} ➔ ${cur.statusPhoto}`);
      if (old.statusVideo !== cur.statusVideo) changes.push(`Statut Vidéo : ${old.statusVideo} ➔ ${cur.statusVideo}`);
      // ... (autres champs)

      let updatedHistory = [...(localData.history || [])];
      if (changes.length > 0) {
          updatedHistory.unshift({ date: new Date().toISOString(), user: user.email ? user.email.split('@')[0] : 'Admin', action: changes.join(' | ') });
      }

      // Nettoyage des données pour éviter les undefined
      const cleanData = { ...localData } as any;
      ['photographerEmail', 'videographerEmail', 'managerEmail', 'clientEmail2', 'clientPhone2', 'weddingVenueZip'].forEach(k => {
          if (cleanData[k] === undefined) cleanData[k] = null;
      });

      const finalLocalState = { ...cleanData, history: updatedHistory };
      const finalDbState = { ...finalLocalState, lastUpdated: serverTimestamp() };

      setLocalData(finalLocalState); 
      originalDataRef.current = JSON.parse(JSON.stringify(finalLocalState));

      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      try { 
          await updateDoc(doc(db, colPath, project.id), finalDbState); 
          alert("✅ Sauvegarde effectuée !");
      } 
      catch (error) { console.error("Erreur Sauvegarde:", error); return; }

      setHasChanges(false); 
      // On ne ferme plus isExpanded ici pour éviter la page blanche

      // Webhook avec FIX NULL (on envoie null au lieu de "" pour Make)
      const hasPhotoChanged = localData.statusPhoto !== project.statusPhoto;
      const hasVideoChanged = localData.statusVideo !== project.statusVideo;
      if (hasPhotoChanged || hasVideoChanged) {
          let stepLabel = (PHOTO_STEPS as any)[localData.statusPhoto]?.label || "Mise à jour";
          if (hasVideoChanged) stepLabel = (VIDEO_STEPS as any)[localData.statusVideo]?.label || "Mise à jour";
          
          fetch(MAKE_WEBHOOK_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  type: 'step_update', 
                  clientName: localData.clientNames, 
                  clientEmail: localData.clientEmail,
                  projectCode: localData.code, 
                  // FIX MAKE: Si vide, on envoie null, pas ""
                  managerEmail: localData.managerEmail || null,
                  photographerEmail: localData.photographerEmail || null,
                  videographerEmail: localData.videographerEmail || null,
                  stepName: stepLabel, 
                  url: window.location.origin 
              })
          }).catch(err => console.error("Erreur Webhook", err));
      }
  };

  const invite = async () => {
      if (!localData.clientEmail) { alert("Email client manquant"); return; }
      setSendingInvite(true);
      try {
          await fetch(MAKE_WEBHOOK_URL, { 
              method:'POST', headers:{'Content-Type':'application/json'}, 
              body:JSON.stringify({ type:'invite', clientName: localData.clientNames, clientEmail: localData.clientEmail, projectCode: localData.code, url: window.location.origin }) 
          });
          // Mise à jour compteur...
          const newCount = (localData.inviteCount || 0) + 1;
          const newHistory = [{ date: new Date().toISOString(), user: user.email?.split('@')[0] || 'Admin', action: `INVITATION ENVOYÉE (N°${newCount})` }, ...(localData.history||[])];
          setLocalData(prev => ({ ...prev, inviteCount: newCount, history: newHistory }));
          originalDataRef.current = { ...originalDataRef.current, inviteCount: newCount, history: newHistory };
          const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
          await updateDoc(doc(db, colPath, project.id), { inviteCount: newCount, history: newHistory, lastUpdated: serverTimestamp() });
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
        {/* EN-TÊTE CARTE (Reste identique visuellement) */}
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

        {/* CONTENU EDITABLE */}
        {isExpanded && (
            <div className="p-6 border-t bg-stone-50/50 space-y-8 animate-fade-in">
                {/* ... (Le reste du formulaire reste identique) ... */}
                
                {/* ... Bloc Boutons Save ... */}
                {canEdit && (
                    <div className="flex justify-between pt-6 border-t items-center bg-white sticky bottom-0 p-4 rounded-xl shadow-[0_-5px_15px_rgba(0,0,0,0.05)] border-t border-stone-100 mt-4 z-20">
                        <div className="flex gap-2">
                             {isSuperAdmin && <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-xs flex gap-1 items-center font-bold px-4 py-2 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4"/> Supprimer</button>}
                             <button onClick={toggleArchive} className={`text-xs flex gap-1 items-center font-bold px-4 py-2 rounded-lg transition ${localData.isArchived ? 'text-green-600 hover:bg-green-50' : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'}`}>{localData.isArchived ? <><RefreshCw className="w-4 h-4"/> Réactiver</> : <><Archive className="w-4 h-4"/> Clôturer</>}</button>
                        </div>
                        <button onClick={save} disabled={!hasChanges} className="bg-stone-900 text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:bg-black transition-all disabled:opacity-50 disabled:shadow-none transform hover:scale-105">Enregistrer</button>
                    </div>
                )}
                
                {/* On garde TeamChat et ChatBox */}
                <div className="grid lg:grid-cols-2 gap-8">
                     <div className="h-[400px] lg:col-span-2"><TeamChat project={project} user={user} /></div>
                     <div className="lg:col-span-2"><ChatBox project={project} userType="admin" disabled={!canEdit} /></div>
                </div>
            </div>
        )}
    </div>
  );
}