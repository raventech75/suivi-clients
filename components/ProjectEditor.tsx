'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, Ban, ChevronRight, Rocket, Mail, 
  BookOpen, Trash2, Image as ImageIcon, CheckSquare, 
  Upload, Loader2, MapPin, FileText, Users, Calendar, Eye, Timer, Music, Briefcase, History, Archive, RefreshCw, UserCheck, Send, Palette, ExternalLink, HardDrive, Link, Printer, CheckCircle2, ImagePlus, Copy
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, MAKE_WEBHOOK_URL, PHOTO_STEPS, 
  VIDEO_STEPS, ALBUM_STATUSES, USB_STATUSES, Project, 
  STAFF_DIRECTORY, CHECKLIST_PHOTO, CHECKLIST_VIDEO
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [localData, setLocalData] = useState<Project>(project);
  const [hasChanges, setHasChanges] = useState(false);
  const originalDataRef = useRef<Project>(JSON.parse(JSON.stringify(project)));

  const [newAlbum, setNewAlbum] = useState({ name: '', format: '', price: 0 });
  const [uploading, setUploading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false); // Pour la couverture
  const [isGalleryDragging, setIsGalleryDragging] = useState(false); // 👇 NOUVEAU : Pour la galerie
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null); 

  const canEdit = !!user; 
  const now = Date.now();
  const isFinished = (project.statusPhoto === 'delivered' || project.statusPhoto === 'none') && (project.statusVideo === 'delivered' || project.statusVideo === 'none');
  const daysRemaining = project.fastTrackActivationDate 
      ? Math.ceil((new Date(project.fastTrackActivationDate).getTime() + (14 * 24 * 60 * 60 * 1000) - now) / (1000 * 60 * 60 * 24))
      : 0;

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

  useEffect(() => { 
      if (!hasChanges) {
          setLocalData(project);
          originalDataRef.current = JSON.parse(JSON.stringify(project));
      }
  }, [project]);

  useEffect(() => {
      const lastMsg = project.messages?.[project.messages.length - 1];
      if (lastMsg && !lastMsg.isStaff) {
          const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
          updateDoc(doc(db, colPath, project.id), { lastAdminRead: new Date().toISOString() }).catch(console.error);
      }
  }, [project.id, project.messages]);

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
    setLocalData(p => ({ ...p, [k]: v }));
    setHasChanges(true); 
  };

  const toggleCheck = (type: 'photo' | 'video', taskId: string, weight: number) => {
      if (!canEdit) return;
      const listKey = type === 'photo' ? 'checkListPhoto' : 'checkListVideo';
      const progressKey = type === 'photo' ? 'progressPhoto' : 'progressVideo';
      const statusKey = type === 'photo' ? 'statusPhoto' : 'statusVideo';
      
      const currentList = localData[listKey] || {};
      const newValue = !currentList[taskId];
      const newList = { ...currentList, [taskId]: newValue };
      
      const refList = type === 'photo' ? CHECKLIST_PHOTO : CHECKLIST_VIDEO;
      let totalWeight = 0, currentWeight = 0;
      refList.forEach(task => { totalWeight += task.weight; if (newList[task.id]) currentWeight += task.weight; });
      const newPercent = Math.min(100, Math.round((currentWeight / totalWeight) * 100));
      
      let newStatus = localData[statusKey];
      if (newPercent === 0) newStatus = 'waiting';
      else if (newPercent < 100) newStatus = type === 'photo' ? 'editing' : 'cutting';
      else newStatus = 'delivered';

      setLocalData(prev => ({ ...prev, [listKey]: newList, [progressKey]: newPercent, [statusKey]: newStatus }));
      setHasChanges(true);
  };

  const toggleArchive = async () => {
      if(!confirm(localData.isArchived ? "Réactiver ce dossier ?" : "Clôturer et archiver ce dossier ?")) return;
      const newStatus = !localData.isArchived;
      const newHistory = [{ date: new Date().toISOString(), user: user.email ? user.email.split('@')[0] : 'Admin', action: newStatus ? 'DOSSIER ARCHIVÉ' : 'DOSSIER RÉACTIVÉ' }, ...(localData.history || [])];
      setLocalData(prev => ({ ...prev, isArchived: newStatus, history: newHistory }));
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, project.id), { isArchived: newStatus, history: newHistory, lastUpdated: serverTimestamp() });
  };

  const toggleFastTrack = () => {
      const isActive = !localData.isPriority;
      updateField('isPriority', isActive);
      updateField('fastTrackActivationDate', isActive ? new Date().toISOString() : null);
  };

  // --- UPLOAD COUVERTURE ---
  const processFile = async (file: File) => {
    if (!canEdit) return;
    try {
      setUploading(true);
      const storageRef = ref(storage, `covers/${project.id}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setLocalData(prev => ({ ...prev, coverImage: url }));
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      await updateDoc(doc(db, colPath, project.id), { coverImage: url, lastUpdated: serverTimestamp() });
    } catch (error: any) { alert(`Erreur: ${error.message}`); } finally { setUploading(false); setIsDragging(false); }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if(e.target.files && e.target.files[0]) processFile(e.target.files[0]); };
  const handleDrag = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };

  // 👇 NOUVEAU : UPLOAD GALERIE (DRAG & DROP MASSIF)
  const processGalleryFiles = async (files: File[]) => {
      if (!canEdit || files.length === 0) return;
      setUploading(true);
      const newImages: {url: string, filename: string}[] = [];
      
      try {
          // Upload en boucle
          for (const file of files) {
              const fileRef = ref(storage, `galleries/${project.id}/${file.name}`);
              await uploadBytes(fileRef, file);
              const url = await getDownloadURL(fileRef);
              newImages.push({ url, filename: file.name });
          }
          const currentGallery = localData.galleryImages || [];
          const finalGallery = [...currentGallery, ...newImages];
          
          setLocalData(prev => ({ ...prev, galleryImages: finalGallery }));
          const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
          await updateDoc(doc(db, colPath, project.id), { galleryImages: finalGallery });
          alert(`${newImages.length} photos ajoutées à la sélection client !`);
      } catch(err: any) {
          alert(`Erreur d'upload: ${err.message}`);
      } finally {
          setUploading(false);
          setIsGalleryDragging(false);
          if (galleryInputRef.current) galleryInputRef.current.value = '';
      }
  };
  
  const handleGalleryUploadClick = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processGalleryFiles(Array.from(e.target.files));
  };
  const handleGalleryDrag = (e: React.DragEvent) => { 
      e.preventDefault(); 
      setIsGalleryDragging(e.type === "dragenter" || e.type === "dragover"); 
  };
  const handleGalleryDrop = (e: React.DragEvent) => { 
      e.preventDefault(); 
      setIsGalleryDragging(false); 
      if (e.dataTransfer.files) processGalleryFiles(Array.from(e.dataTransfer.files)); 
  };

  // COPIE POUR LIGHTROOM
  const copyLightroomString = () => {
      if (!localData.selectedImages || localData.selectedImages.length === 0) return alert("Aucune photo sélectionnée.");
      const query = localData.selectedImages.join(' OR ');
      navigator.clipboard.writeText(query);
      alert("Requête copiée avec succès !\n\nCollez ceci dans la barre de recherche Lightroom.");
  };

  const handleDelete = async () => {
    if(!confirm('Supprimer ce dossier ?')) return;
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    await deleteDoc(doc(db, colPath, project.id));
  };

  const invite = async () => {
      if (!localData.clientEmail) { alert("Email client manquant"); return; }
      setSendingInvite(true);
      try {
          await fetch(MAKE_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'invite', clientName: localData.clientNames, clientEmail: localData.clientEmail, projectCode: localData.code, url: window.location.origin }) });
          const newCount = (localData.inviteCount || 0) + 1;
          const newHistory = [{ date: new Date().toISOString(), user: user.email?.split('@')[0] || 'Admin', action: `INVITATION ENVOYÉE (N°${newCount})` }, ...(localData.history||[])];
          setLocalData(prev => ({ ...prev, inviteCount: newCount, history: newHistory }));
          originalDataRef.current = { ...originalDataRef.current, inviteCount: newCount, history: newHistory };
          const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
          await updateDoc(doc(db, colPath, project.id), { inviteCount: newCount, history: newHistory, lastUpdated: serverTimestamp() });
          alert(`✅ Invitation envoyée (N°${newCount})`);
      } catch (err) { alert("Erreur envoi"); } finally { setSendingInvite(false); }
  };

  const addAlbum = () => {
      if(!newAlbum.name) return alert("Nom requis");
      const albums = localData.albums || [];
      updateField('albums', [...albums, { id: Date.now().toString(), name: newAlbum.name, format: newAlbum.format || "Standard", price: newAlbum.price, status: 'pending', paid: false }]);
      setNewAlbum({ name: '', format: '', price: 0 });
  };

  const updateAlbum = (idx: number, field: string, val: any) => {
      const albums = [...(localData.albums || [])];
      albums[idx] = { ...albums[idx], [field]: val };
      updateField('albums', albums);
  };

  const save = async () => {
      if (!localData.clientEmail) return alert("Email manquant.");
      const cleanData = { ...localData, lastUpdated: serverTimestamp() };
      
      const changes: string[] = [];
      const old = originalDataRef.current;
      const cur = localData;

      if (old) {
          if (old.statusPhoto !== cur.statusPhoto) changes.push(`Statut Photo : ${old.statusPhoto} ➔ ${cur.statusPhoto}`);
          if (old.statusVideo !== cur.statusVideo) changes.push(`Statut Vidéo : ${old.statusVideo} ➔ ${cur.statusVideo}`);
          if (old.usbStatus !== cur.usbStatus) changes.push(`Statut USB : ${old.usbStatus || 'aucun'} ➔ ${cur.usbStatus}`);
          if (old.linkPhoto !== cur.linkPhoto) changes.push(`Lien Galerie ${cur.linkPhoto ? 'MAJ' : 'Supprimé'}`);
          if (old.linkVideo !== cur.linkVideo) changes.push(`Lien Vidéo ${cur.linkVideo ? 'MAJ' : 'Supprimé'}`);
          if (old.musicInstructions !== cur.musicInstructions || old.musicLinks !== cur.musicLinks) changes.push(`Préférences musicales mises à jour`);
          if (old.moodboardLink !== cur.moodboardLink) changes.push(`Moodboard mis à jour`);
          if (old.maxSelection !== cur.maxSelection) changes.push(`Limite sélection album fixée à ${cur.maxSelection}`);
      }

      let updatedHistory = [...(localData.history || [])];
      if (changes.length > 0) { updatedHistory.unshift({ date: new Date().toISOString(), user: user.email ? user.email.split('@')[0] : 'Admin', action: changes.join(' | ') }); }
      cleanData.history = updatedHistory;

      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      try { 
          await updateDoc(doc(db, colPath, project.id), cleanData); 
          alert("✅ Sauvegarde effectuée !");
      } catch (e: any) { alert(e.message); return; }
      
      setHasChanges(false); 
      originalDataRef.current = JSON.parse(JSON.stringify(cleanData));

      const hasPhotoChanged = localData.statusPhoto !== project.statusPhoto;
      const hasVideoChanged = localData.statusVideo !== project.statusVideo;
      if (hasPhotoChanged || hasVideoChanged) {
          let stepLabel = (PHOTO_STEPS as any)[localData.statusPhoto]?.label || "Mise à jour";
          if (hasVideoChanged) stepLabel = (VIDEO_STEPS as any)[localData.statusVideo]?.label || "Mise à jour";
          fetch(MAKE_WEBHOOK_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'step_update', clientName: localData.clientNames, clientEmail: localData.clientEmail, projectCode: localData.code, managerEmail: localData.managerEmail || null, photographerEmail: localData.photographerEmail || null, videographerEmail: localData.videographerEmail || null, stepName: stepLabel, url: window.location.origin })
          }).catch(console.error);
      }
  };

  const printOrder = () => {
      const win = window.open('', '', 'width=800,height=600');
      if(!win) return;
      const content = `<html><head><title>Bon de Commande - ${project.code}</title></head><body style="font-family: sans-serif; padding: 40px;"><div style="text-align:center; margin-bottom: 40px;"><h1>RavenTech Studio</h1><p>Bon de Commande / Récapitulatif</p></div><div style="border: 1px solid #ccc; padding: 20px; border-radius: 8px; margin-bottom: 30px;"><h3>Client : ${project.clientNames}</h3><p>Code Projet : <strong>${project.code}</strong></p><p>Date Mariage : ${formatDateFR(project.weddingDate)}</p><p>Email : ${project.clientEmail}</p></div><h3>Commandes & Options :</h3><table style="width: 100%; border-collapse: collapse;"><tr style="background: #f0f0f0;"><th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Désignation</th><th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Statut</th><th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Prix</th></tr>${project.isPriority ? `<tr><td style="border:1px solid #ddd; padding:10px;">Option Fast Track (Prioritaire)</td><td style="border:1px solid #ddd; padding:10px;">Activé</td><td style="border:1px solid #ddd; padding:10px; text-align:right;">290 €</td></tr>` : ''}${(project.albums || []).map(a => `<tr><td style="border:1px solid #ddd; padding:10px;">Album ${a.name} (${a.format})</td><td style="border:1px solid #ddd; padding:10px;">${a.paid ? 'PAYÉ' : 'À RÉGLER'}</td><td style="border:1px solid #ddd; padding:10px; text-align:right;">${a.price} €</td></tr>`).join('')}</table><div style="margin-top: 40px; text-align: right;"><p>Date d'impression : ${new Date().toLocaleDateString()}</p></div><script>window.print();</script></body></html>`;
      win.document.write(content);
      win.document.close();
  };

  return (
    <div className={`rounded-lg transition-all duration-200 mb-4 ${borderStyle} ${bgStyle}`}>
        {/* EN-TÊTE CARTE */}
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
            </div>
            <div className="flex items-center gap-4">{(project.deliveryConfirmedPhoto || project.deliveryConfirmedVideo) && <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-sm"><CheckSquare className="w-3 h-3"/> LIVRÉ</span>}<ChevronRight className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} /></div>
        </div>

        {/* CONTENU EDITABLE */}
        {isExpanded && (
            <div className="p-6 border-t bg-stone-50/50 space-y-8 animate-fade-in">
                
                {/* BARRE ACTIONS */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-4 w-full md:w-auto"><button onClick={toggleFastTrack} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${localData.isPriority ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 transform scale-105' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}><Rocket className="w-5 h-5"/> {localData.isPriority ? 'FAST TRACK ACTIF' : 'Activer Fast Track'}</button></div>
                    <div className="flex gap-2 w-full md:w-auto items-center">
                         <div className="px-4 py-2 bg-stone-100 rounded-lg font-mono text-sm font-bold text-stone-600 border border-stone-200">CODE : <span className="text-black select-all">{localData.code}</span></div>
                        <div className="flex flex-col items-end"><button onClick={invite} disabled={sendingInvite} className="px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-bold hover:bg-stone-50 flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]">{sendingInvite ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}{localData.inviteCount && localData.inviteCount > 0 ? "Renvoyer" : "Inviter"}</button>{localData.inviteCount && localData.inviteCount > 0 && <span className="text-[10px] text-stone-400 font-mono mt-1 mr-1">Envoyé {localData.inviteCount} fois</span>}</div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        {/* FICHE MARIÉS */}
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
                        {/* EQUIPE */}
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-stone-400"/> Équipe & Contact</h4>
                            <div className="space-y-4">
                                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100"><label className="text-[10px] uppercase font-bold text-purple-600 block mb-1">Responsable Dossier</label><div className="flex gap-2"><select disabled={!isSuperAdmin} className="w-1/3 p-2 border rounded bg-white text-sm" value={localData.managerName || ''} onChange={e=>handleStaffChange('managerName', 'managerEmail', e.target.value)}><option value="">-- Nom --</option>{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select><input disabled={!isSuperAdmin} className="flex-1 p-2 border rounded bg-white text-sm" value={localData.managerEmail || ''} onChange={e=>updateField('managerEmail', e.target.value)} placeholder="Email du responsable" /></div></div>
                                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100"><label className="text-[10px] uppercase font-bold text-amber-600 block mb-1">Photographe J-J</label><div className="flex gap-2"><select disabled={!canEdit} className="w-1/3 p-2 border rounded bg-white text-sm" value={localData.photographerName || ''} onChange={e=>handleStaffChange('photographerName', 'photographerEmail', e.target.value)}><option value="">-- Nom --</option>{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select><input disabled={!canEdit} className="flex-1 p-2 border rounded bg-white text-sm" value={localData.photographerEmail || ''} onChange={e=>updateField('photographerEmail', e.target.value)} placeholder="Email Photographe" /></div></div>
                                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100"><label className="text-[10px] uppercase font-bold text-blue-600 block mb-1">Vidéaste J-J</label><div className="flex gap-2"><select disabled={!canEdit} className="w-1/3 p-2 border rounded bg-white text-sm" value={localData.videographerName || ''} onChange={e=>handleStaffChange('videographerName', 'videographerEmail', e.target.value)}><option value="">-- Nom --</option>{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select><input disabled={!canEdit} className="flex-1 p-2 border rounded bg-white text-sm" value={localData.videographerEmail || ''} onChange={e=>updateField('videographerEmail', e.target.value)} placeholder="Email Vidéaste" /></div></div>
                            </div>
                        </div>

                        {/* PRODUCTION & CHECKLISTS */}
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-stone-400"/> Suivi Production</h4>
                            
                            {/* PRÉFÉRENCES CLIENTS (Moodboard & Musique) */}
                            <div className="grid md:grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-pink-50 rounded-xl border border-pink-100 flex flex-col gap-3">
                                    <div className="flex items-center justify-between text-pink-800">
                                        <div className="flex items-center gap-2"><Palette className="w-4 h-4"/><span className="text-xs font-bold uppercase">Moodboard</span></div>
                                        {localData.moodboardLink && <a href={localData.moodboardLink} target="_blank" rel="noopener noreferrer" className="bg-white p-1.5 rounded shadow-sm text-pink-600 hover:bg-pink-100"><ExternalLink className="w-3 h-3"/></a>}
                                    </div>
                                    <input disabled={!canEdit} className="w-full p-2 border border-pink-200 rounded text-xs bg-white focus:ring-1 outline-none placeholder-pink-300" placeholder="Lien d'inspiration..." value={localData.moodboardLink || ''} onChange={e=>updateField('moodboardLink', e.target.value)} />
                                </div>
                                
                                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 flex flex-col gap-3">
                                    <div className="flex items-center justify-between text-purple-800">
                                        <div className="flex items-center gap-2"><Music className="w-4 h-4"/><span className="text-xs font-bold uppercase">Musique & Notes</span></div>
                                        {localData.musicLinks && <a href={localData.musicLinks} target="_blank" rel="noopener noreferrer" className="bg-white p-1.5 rounded shadow-sm text-purple-600 hover:bg-purple-100"><ExternalLink className="w-3 h-3"/></a>}
                                    </div>
                                    <textarea disabled={!canEdit} className="w-full p-2 border border-purple-200 rounded text-xs bg-white min-h-[60px] focus:ring-1 outline-none placeholder-purple-300" placeholder="Instructions de montage du client..." value={localData.musicInstructions || ''} onChange={e=>updateField('musicInstructions', e.target.value)} />
                                    <input disabled={!canEdit} className="w-full p-2 border border-purple-200 rounded text-xs bg-white focus:ring-1 outline-none placeholder-purple-300" placeholder="Lien Spotify/Youtube..." value={localData.musicLinks || ''} onChange={e=>updateField('musicLinks', e.target.value)} />
                                </div>
                            </div>

                            {/* CHECKLIST PHOTO */}
                            <div className="mb-6 pb-6 border-b border-stone-100">
                                <div className="flex justify-between mb-2 items-center"><span className="font-bold text-stone-600 flex gap-2 items-center"><Camera className="w-4 h-4"/> Photo</span><span className="text-xs bg-stone-100 px-2 py-1 rounded font-mono">{localData.progressPhoto}%</span></div>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    {CHECKLIST_PHOTO.map(task => (
                                        <button 
                                            key={task.id} 
                                            onClick={() => toggleCheck('photo', task.id, task.weight)}
                                            className={`text-xs text-left px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${localData.checkListPhoto?.[task.id] ? 'bg-amber-100 border-amber-200 text-amber-900 font-bold' : 'bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100'}`}
                                        >
                                            {localData.checkListPhoto?.[task.id] ? <CheckCircle2 className="w-3 h-3"/> : <div className="w-3 h-3 border rounded-full"></div>} {task.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2 items-center"><div className="w-1/3"><label className="text-[10px] font-bold text-stone-400">LIVRAISON PRÉVUE</label><input disabled={!canEdit} type="date" className={`w-full p-2 border rounded text-xs ${!localData.estimatedDeliveryPhoto && localData.statusPhoto !== 'none' ? 'border-red-400 bg-red-50' : 'bg-yellow-50 border-yellow-200'}`} value={localData.estimatedDeliveryPhoto || ''} onChange={e=>updateField('estimatedDeliveryPhoto', e.target.value)}/></div></div>
                            </div>

                            {/* CHECKLIST VIDEO */}
                            <div className="mb-6 pb-6 border-b border-stone-100">
                                <div className="flex justify-between mb-2 items-center"><span className="font-bold text-stone-600 flex gap-2 items-center"><Video className="w-4 h-4"/> Vidéo</span><span className="text-xs bg-stone-100 px-2 py-1 rounded font-mono">{localData.progressVideo}%</span></div>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    {CHECKLIST_VIDEO.map(task => (
                                        <button 
                                            key={task.id} 
                                            onClick={() => toggleCheck('video', task.id, task.weight)}
                                            className={`text-xs text-left px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${localData.checkListVideo?.[task.id] ? 'bg-blue-100 border-blue-200 text-blue-900 font-bold' : 'bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100'}`}
                                        >
                                            {localData.checkListVideo?.[task.id] ? <CheckCircle2 className="w-3 h-3"/> : <div className="w-3 h-3 border rounded-full"></div>} {task.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2 items-center"><div className="w-1/3"><label className="text-[10px] font-bold text-stone-400">LIVRAISON PRÉVUE</label><input disabled={!canEdit} type="date" className={`w-full p-2 border rounded text-xs ${!localData.estimatedDeliveryVideo && localData.statusVideo !== 'none' ? 'border-red-400 bg-red-50' : 'bg-yellow-50 border-yellow-200'}`} value={localData.estimatedDeliveryVideo || ''} onChange={e=>updateField('estimatedDeliveryVideo', e.target.value)}/></div></div>
                            </div>

                            {/* SECTION LIVRABLES */}
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                                <h5 className="font-bold text-xs uppercase text-stone-500 mb-3 flex items-center gap-2"><Link className="w-3 h-3"/> Liens Livrables Finaux</h5>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-stone-400"/>
                                        <input className="flex-1 p-2 border rounded text-xs" placeholder="Lien Galerie Photo" value={localData.linkPhoto || ''} onChange={e => updateField('linkPhoto', e.target.value)} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Video className="w-4 h-4 text-stone-400"/>
                                        <input className="flex-1 p-2 border rounded text-xs" placeholder="Lien Vidéo / Teaser" value={localData.linkVideo || ''} onChange={e => updateField('linkVideo', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ALBUMS & COMMANDES + GALERIE SELECTION */}
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-stone-800 flex items-center gap-2"><BookOpen className="w-5 h-5 text-stone-400"/> Albums & Sélection</h4>
                                <button onClick={printOrder} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition"><Printer className="w-3 h-3"/> Bon de Commande</button>
                            </div>
                            
                            {/* 👇 NOUVEAU : LA ZONE DE GLISSER-DÉPOSER POUR LA GALERIE */}
                            <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h5 className="font-bold text-sm text-amber-900 flex items-center gap-2"><ImagePlus className="w-4 h-4"/> Galerie de Sélection Client</h5>
                                        <p className="text-xs text-amber-700">Déposez ici toutes les photos JPEG allégées pour le client.</p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <label className="text-[10px] font-bold text-amber-800 uppercase">Limite max.</label>
                                        <input type="number" className="w-16 p-1.5 rounded border border-amber-200 text-sm outline-none text-center font-bold" placeholder="Ex: 60" value={localData.maxSelection || ''} onChange={e => updateField('maxSelection', Number(e.target.value))} />
                                    </div>
                                </div>

                                {/* ZONE DROPZONE GÉANTE */}
                                <div 
                                    onDragEnter={handleGalleryDrag} 
                                    onDragLeave={handleGalleryDrag} 
                                    onDragOver={handleGalleryDrag} 
                                    onDrop={handleGalleryDrop}
                                    onClick={() => !uploading && galleryInputRef.current?.click()}
                                    className={`relative w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden ${isGalleryDragging ? 'border-amber-500 bg-amber-100' : 'border-amber-300 bg-white hover:bg-amber-50/50'}`}
                                >
                                    <input type="file" ref={galleryInputRef} multiple accept="image/jpeg, image/png" className="hidden" onChange={handleGalleryUploadClick} />
                                    
                                    {uploading ? (
                                        <div className="flex flex-col items-center text-amber-600">
                                            <Loader2 className="w-8 h-8 animate-spin mb-2"/>
                                            <span className="text-xs font-bold uppercase tracking-wider">Upload en cours... Patientez</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className={`w-8 h-8 mb-2 transition-colors ${isGalleryDragging ? 'text-amber-600' : 'text-amber-400'}`}/>
                                            <span className="text-sm font-bold text-amber-900">Glissez vos photos ici</span>
                                            <span className="text-xs text-amber-600 mt-1">ou cliquez pour parcourir</span>
                                        </>
                                    )}
                                </div>

                                <div className="mt-3 flex justify-between items-center px-1">
                                    <span className="text-xs font-bold text-amber-800 bg-amber-200/50 px-2 py-1 rounded">{(localData.galleryImages || []).length} photos en ligne</span>
                                    {localData.galleryImages && localData.galleryImages.length > 0 && (
                                         <button onClick={() => {if(confirm("Effacer toute la galerie ?")) updateField('galleryImages', [])}} className="text-[10px] text-red-500 hover:underline">Vider la galerie</button>
                                    )}
                                </div>

                                {/* Résultat de la sélection client */}
                                {localData.selectedImages && localData.selectedImages.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-amber-200/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-stone-800">Sélection Client ({localData.selectedImages.length} photos)</span>
                                            {localData.selectionValidated && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> VALIDÉ</span>}
                                        </div>
                                        <button onClick={copyLightroomString} className="w-full bg-stone-900 text-white py-2 rounded-lg text-xs font-bold hover:bg-black transition flex items-center justify-center gap-2 shadow-sm"><Copy className="w-4 h-4"/> Copier pour Lightroom</button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                {(localData.albums || []).map((album, idx) => (
                                    <div key={idx} className="flex flex-wrap gap-2 items-center bg-stone-50 p-2 rounded-lg text-sm">
                                        <div className="flex-1">
                                            <div className="font-bold">{album.name}</div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-stone-400">Format :</span>
                                                <input className="text-[10px] font-bold text-stone-600 bg-transparent border-none p-0 focus:ring-0 w-24" value={album.format} disabled={!canEdit} onChange={(e) => updateAlbum(idx, 'format', e.target.value)} />
                                            </div>
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
                                        <input className="w-1/3 p-2 border rounded text-xs" placeholder="Format (Ex: 30x30)" value={newAlbum.format} onChange={e => setNewAlbum({...newAlbum, format: e.target.value})} />
                                    </div>
                                    <div className="flex gap-2">
                                         <input type="number" className="w-20 p-2 border rounded text-xs" placeholder="Prix €" value={newAlbum.price} onChange={e => setNewAlbum({...newAlbum, price: Number(e.target.value)})} />
                                         <button onClick={addAlbum} className="flex-1 bg-stone-900 text-white px-3 py-2 rounded text-xs font-bold hover:bg-black">Ajouter la commande</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SECTION CLEF USB */}
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><HardDrive className="w-5 h-5 text-stone-400"/> Coffret USB</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-stone-400">Statut Envoi</label>
                                    <select 
                                        disabled={!canEdit} 
                                        className="w-full p-2 border rounded bg-stone-50 text-sm font-medium mt-1" 
                                        value={localData.usbStatus || 'none'} 
                                        onChange={e => updateField('usbStatus', e.target.value)}
                                    >
                                        {Object.entries(USB_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-stone-400">Adresse d'expédition</label>
                                    <textarea 
                                        disabled={!canEdit} 
                                        className="w-full p-3 border rounded bg-stone-50 text-sm min-h-[80px]" 
                                        placeholder="Nom, Rue, CP, Ville..." 
                                        value={localData.usbAddress || ''} 
                                        onChange={e => updateField('usbAddress', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                
                {/* HISTORIQUE */}
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
                    <div className="flex justify-between pt-6 border-t items-center bg-white sticky bottom-0 p-4 rounded-xl shadow-[0_-5px_15px_rgba(0,0,0,0.05)] border-t border-stone-100 mt-4 z-20">
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