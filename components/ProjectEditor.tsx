'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, Ban, ChevronRight, Rocket, Mail, 
  BookOpen, Trash2, Image as ImageIcon, CheckSquare, 
  Upload, Loader2, MapPin, FileText, Users, Calendar, Eye, Timer, Music, Briefcase, History, Archive, RefreshCw, UserCheck, Send, Palette, ExternalLink, HardDrive, Link, Printer, CheckCircle2, ImagePlus, Copy, Wallet, DollarSign, ClipboardList, Clock, Phone, FileSignature, AlertTriangle, ListChecks
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, appId } from '../lib/firebase';
import { 
  COLLECTION_NAME, MAKE_WEBHOOK_URL, PHOTO_STEPS, 
  VIDEO_STEPS, ALBUM_STATUSES, USB_STATUSES, Project, 
  STAFF_DIRECTORY, CHECKLIST_PHOTO, CHECKLIST_VIDEO, TeamPayment, FORMULAS, FORMULA_OPTIONS
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
  const [newPayment, setNewPayment] = useState({ recipient: '', amount: 0, note: '' });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 }); 
  const [sendingInvite, setSendingInvite] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false); 
  const [isGalleryDragging, setIsGalleryDragging] = useState(false); 
  
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

  const toggleOption = (optionId: string) => {
      if (!canEdit) return;
      let currentOptions = localData.selectedOptions || [];
      if (currentOptions.includes(optionId)) {
          currentOptions = currentOptions.filter(id => id !== optionId);
      } else {
          currentOptions.push(optionId);
      }
      updateField('selectedOptions', currentOptions);
  };

  // 👇 NOUVEAU : Auto-calcul du prix
  const calculateTotalPrice = () => {
      let total = 0;
      if (localData.selectedFormula) {
          const formula = FORMULAS.find(f => f.id === localData.selectedFormula);
          if (formula) total += formula.price;
      }
      if (localData.selectedOptions) {
          localData.selectedOptions.forEach(optId => {
              const option = FORMULA_OPTIONS.find(o => o.id === optId);
              if (option) total += option.price;
          });
      }
      updateField('totalPrice', total);
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

  const processGalleryFiles = async (files: File[]) => {
      if (!canEdit || files.length === 0) return;
      setUploading(true);
      setUploadProgress({ current: 0, total: files.length });
      setIsGalleryDragging(false);
      try {
          const uploadPromises = files.map(async (file) => {
              const fileRef = ref(storage, `galleries/${project.id}/${file.name}`);
              await uploadBytes(fileRef, file);
              const url = await getDownloadURL(fileRef);
              setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
              return { url, filename: file.name };
          });
          const newImages = await Promise.all(uploadPromises);
          const currentGallery = localData.galleryImages || [];
          const finalGallery = [...currentGallery, ...newImages];
          setLocalData(prev => ({ ...prev, galleryImages: finalGallery }));
          const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
          await updateDoc(doc(db, colPath, project.id), { galleryImages: finalGallery });
          setTimeout(() => { alert(`${newImages.length} photos ajoutées à la sélection client !`); }, 500);
      } catch(err: any) { alert(`Erreur d'upload: ${err.message}`); } finally {
          setUploading(false); setUploadProgress({ current: 0, total: 0 });
          if (galleryInputRef.current) galleryInputRef.current.value = '';
      }
  };
  
  const handleGalleryUploadClick = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) processGalleryFiles(Array.from(e.target.files)); };
  const handleGalleryDrag = (e: React.DragEvent) => { e.preventDefault(); setIsGalleryDragging(e.type === "dragenter" || e.type === "dragover"); };
  const handleGalleryDrop = (e: React.DragEvent) => { e.preventDefault(); setIsGalleryDragging(false); if (e.dataTransfer.files) processGalleryFiles(Array.from(e.dataTransfer.files)); };

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

  const addTeamPayment = () => {
      if(!newPayment.recipient || newPayment.amount <= 0) return alert("Nom et montant requis");
      const payments = localData.teamPayments || [];
      updateField('teamPayments', [...payments, { id: Date.now().toString(), recipient: newPayment.recipient, amount: newPayment.amount, note: newPayment.note, date: new Date().toISOString() }]);
      setNewPayment({ recipient: '', amount: 0, note: '' });
  };
  const removeTeamPayment = (idx: number) => {
      if(!confirm("Supprimer ce paiement ?")) return;
      const payments = [...(localData.teamPayments || [])];
      payments.splice(idx, 1);
      updateField('teamPayments', payments);
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
          if (old.depositAmount !== cur.depositAmount || old.totalPrice !== cur.totalPrice) changes.push(`Finances mises à jour`);
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
  };

  // 👇 MISE À JOUR : PDF DU CONTRAT AVEC FORMULES
  const printContract = () => {
      const win = window.open('', '', 'width=900,height=1000');
      if(!win) return;
      
      const formulasHtml = FORMULAS.map(f => {
          const isSelected = localData.selectedFormula === f.id;
          const box = isSelected ? '☑' : '☐';
          return `
            <div style="margin-bottom: 15px; padding: 10px; border: ${isSelected ? '2px solid #111' : '1px solid #eee'}; background: ${isSelected ? '#f9f9f9' : '#fff'}; border-radius: 5px;">
                <div style="font-weight: bold; font-size: 16px;">${box} ${f.name} (${f.price} €)</div>
                <div style="font-size: 12px; color: #555; margin-left: 20px; margin-top: 5px;">${f.details.join(' • ')}</div>
            </div>
          `;
      }).join('');

      const optionsHtml = FORMULA_OPTIONS.map(o => {
          const isSelected = (localData.selectedOptions || []).includes(o.id);
          const box = isSelected ? '☑' : '☐';
          return `<div style="font-size: 14px; margin-bottom: 5px;">${box} ${o.name} (+${o.price} €)</div>`;
      }).join('');

      const content = `
        <html>
          <head>
            <title>Contrat - ${project.clientNames}</title>
            <style>
              body { font-family: 'Georgia', serif; padding: 40px; line-height: 1.5; color: #111; max-width: 800px; margin: 0 auto; }
              h1 { text-align: center; font-size: 26px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #111; padding-bottom: 10px;}
              .subtitle { text-align: center; font-size: 12px; color: #666; margin-bottom: 40px; font-family: sans-serif;}
              .box { border: 1px solid #ccc; padding: 20px; margin-bottom: 30px; background: #fafafa; border-radius: 8px;}
              .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-family: sans-serif; font-size: 14px;}
              .title { font-weight: bold; font-size: 18px; margin-top: 30px; border-bottom: 1px solid #111; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;}
              .signature-box { margin-top: 50px; border-top: 1px solid #ccc; padding-top: 20px; display: flex; justify-content: space-between; }
              .signature-img { max-width: 250px; max-height: 100px; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
              .terms { font-size: 11px; color: #444; text-align: justify; column-count: 2; column-gap: 30px;}
            </style>
          </head>
          <body>
            <h1>WEDDING CONTRACT - IRZZEN PRODUCTIONS</h1>
            <div class="subtitle">Référence: ${project.code} | Edité le: ${new Date().toLocaleDateString()}</div>
            
            <div class="box">
                <div class="row"><strong>LES MARIÉS :</strong> <span>${project.clientNames}</span></div>
                <div class="row"><strong>EMAIL :</strong> <span>${project.clientEmail}</span></div>
                <div class="row"><strong>TÉLÉPHONE :</strong> <span>${project.clientPhone || 'Non renseigné'}</span></div>
                <div class="row"><strong>DATE DE L'ÉVÉNEMENT :</strong> <span>${formatDateFR(project.weddingDate)}</span></div>
            </div>

            <div class="title">1. FORMULE SÉLECTIONNÉE</div>
            ${formulasHtml}

            <div class="title">2. OPTIONS SUPPLÉMENTAIRES</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                ${optionsHtml}
            </div>

            <div class="title">3. DÉTAILS FINANCIERS</div>
            <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 5px;">
                    <span>Prix total convenu :</span> <strong>${project.totalPrice || 0} €</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; color: #555; margin-bottom: 5px;">
                    <span>Acompte versé à la réservation :</span> <span>${project.depositAmount || 0} €</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 18px; color: #d32f2f; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc; font-weight: bold;">
                    <span>Reste à percevoir le jour J :</span> <span>${(project.totalPrice || 0) - (project.depositAmount || 0)} €</span>
                </div>
            </div>

            <div style="page-break-before: always;"></div>
            <h1>CONDITIONS GÉNÉRALES DE VENTE</h1>
            
            <div class="terms">
                <p><strong>ACOMPTE POUR RÉSERVATION :</strong> Le premier paiement est un acompte qui correspond à environ 30% de la somme totale. L'acompte n'est pas récupérable. Le paiement est à effectuer lors de la signature du présent contrat. Ainsi la date du mariage sera réservée.</p>
                
                <p><strong>GÉNÉRALITÉS :</strong> Les futurs Mariés déclarent être majeurs et poser librement. La prestation du Photographe se déroule d'un seul tenant. Son temps de présence ne peut être fractionné sauf accord préalable. Les Mariés peuvent choisir de passer à une collection supérieure, mais l'inverse n'est pas autorisé.</p>
                
                <p><strong>DROIT À L'IMAGE ET PROPRIÉTÉ INTELLECTUELLE :</strong> Toute réalisation photographique confère au Photographe, son auteur, des droits de propriété artistique, patrimoniaux et moraux, tels que définis par le Code de la Propriété Intellectuelle. Les Mariés autorisent le Photographe à prendre en photo l'ensemble des invités.</p>
                
                <p><strong>ANNULATION :</strong> Aucune annulation ne pourra intervenir du fait du Photographe, excepté les cas de force majeure dûment justifiés. Tout changement de date de la prestation fait office d'annulation. Dans l'éventualité où ce contrat serait rompu par les clients, le Photographe serait libéré d'honorer le présent contrat et garderait les sommes versées jusqu'alors.</p>
                
                <p><strong>APRÈS LE MARIAGE :</strong> Le coffret final avec la clé USB et les tirages sera livré dans les trois mois suivant le choix des Mariés sur les images à tirer. Le Photographe s'engage à conserver les fichiers numériques HD pendant une durée de 12 mois à compter de la date du mariage.</p>
            </div>

            <div class="signature-box">
                <div style="width: 45%;">
                    <p style="font-size: 12px; margin-bottom: 30px;"><strong>LE STUDIO :</strong><br/>IRZZEN PRODUCTIONS</p>
                    <div style="height:80px; width:200px; border-bottom:1px solid #000;">
                        <span style="font-family: 'Brush Script MT', cursive; font-size: 24px; color: #111; line-height: 80px; padding-left: 20px;">Irzzen</span>
                    </div>
                </div>
                <div style="width: 45%; text-align: right;">
                    <p style="font-size: 12px; margin-bottom: 5px;"><strong>LES MARIÉS :</strong><br/>${project.clientNames}</p>
                    <p style="font-size: 10px; color: #666; margin-bottom: 10px;">Lu et approuvé. Bon pour accord.</p>
                    ${project.contractSignatureData ? `<img src="${project.contractSignatureData}" class="signature-img"/>` : '<div style="height:80px; width:100%; border-bottom:1px dashed #000;"></div>'}
                    <p style="font-size:10px; color:#999; margin-top:5px;">Signé numériquement le ${project.contractSignedDate ? formatDateFR(project.contractSignedDate) : '...'}</p>
                </div>
            </div>
            
            <script>window.print();</script>
          </body>
        </html>
      `;
      win.document.write(content);
      win.document.close();
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
                    {uploading && !uploadProgress.total ? <Loader2 className="w-5 h-5 text-stone-500 animate-spin"/> : localData.coverImage ? <img src={localData.coverImage} className={`w-full h-full object-cover transition-opacity ${isDragging ? 'opacity-50' : ''}`}/> : <span className="text-lg">{localData.clientNames.charAt(0)}</span>}
                    {canEdit && !uploading && <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><Upload className="w-4 h-4 text-white"/></div>}
                </div>
                <div className="min-w-[180px]">
                    <div className="flex items-center gap-2"><span className="font-bold text-stone-800 text-lg">{project.clientNames}</span>{localData.isPriority && !isFinished && !localData.isArchived && <div className="flex items-center gap-1 bg-orange-500 text-white px-2 py-0.5 rounded-md text-xs font-black animate-pulse"><Rocket className="w-3 h-3"/> {daysRemaining >= 0 ? `J-${daysRemaining}` : `RETARD`}</div>}{localData.isArchived && <span className="bg-stone-200 text-stone-500 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"><Archive className="w-3 h-3"/> ARCHIVÉ</span>}</div>
                    <p className="text-xs text-stone-500 flex items-center gap-2 mt-1"><span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono font-bold">{project.code}</span><span>•</span><MapPin className="w-3 h-3"/> {project.weddingVenue || 'Lieu non défini'}</p>
                </div>
            </div>
            <div className="flex items-center gap-4"><ChevronRight className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} /></div>
        </div>

        {isExpanded && (
            <div className="p-6 border-t bg-stone-50/50 space-y-8 animate-fade-in">
                
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        
                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-stone-400"/> Fiche Mariés</h4>
                            <div className="space-y-4">
                                <div><label className="text-[10px] uppercase font-bold text-stone-400">Noms</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 font-bold text-lg" value={localData.clientNames} onChange={e=>updateField('clientNames', e.target.value)} /></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] uppercase font-bold text-stone-400">Email 1</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientEmail} onChange={e=>updateField('clientEmail', e.target.value)} /></div><div><label className="text-[10px] uppercase font-bold text-stone-400">Tel 1</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientPhone} onChange={e=>updateField('clientPhone', e.target.value)} /></div></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] uppercase font-bold text-stone-400">Email 2</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientEmail2 || ''} onChange={e=>updateField('clientEmail2', e.target.value)} /></div><div><label className="text-[10px] uppercase font-bold text-stone-400">Tel 2</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.clientPhone2 || ''} onChange={e=>updateField('clientPhone2', e.target.value)} /></div></div>
                                <div className="pt-2 border-t border-dashed mt-2"><div className="grid grid-cols-3 gap-2"><div className="col-span-1"><label className="text-[10px] uppercase font-bold text-stone-400">Date Mariage</label><input required type="date" disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" value={localData.weddingDate} onChange={e=>updateField('weddingDate', e.target.value)} /></div><div className="col-span-2"><label className="text-[10px] uppercase font-bold text-stone-400">Nom Salle / Lieu</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50" placeholder="Château de..." value={localData.weddingVenue || ''} onChange={e=>updateField('weddingVenue', e.target.value)} /></div></div></div>
                            </div>
                        </div>

                        {/* 👇 NOUVEAU : CRÉATION DU DEVIS / CONTRAT DANS LES FINANCES */}
                        {isSuperAdmin && (
                            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                                <h4 className="font-bold text-stone-800 mb-4 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Wallet className="w-5 h-5 text-green-600"/> Contrat & Finances</span>
                                    {localData.contractSigned && (
                                        <button onClick={printContract} className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1">
                                            <FileSignature className="w-4 h-4"/> Voir le PDF
                                        </button>
                                    )}
                                </h4>
                                
                                <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-100 relative">
                                    <h5 className="font-bold text-sm text-green-900 mb-3 flex items-center gap-2"><ListChecks className="w-4 h-4"/> Construction du Contrat</h5>
                                    
                                    {/* Choix Formule */}
                                    <div className="mb-4">
                                        <label className="text-[10px] uppercase font-bold text-green-800 block mb-1">Formule choisie</label>
                                        <select 
                                            disabled={!canEdit} 
                                            className="w-full p-2 border border-green-200 rounded text-sm bg-white" 
                                            value={localData.selectedFormula || ''} 
                                            onChange={e => updateField('selectedFormula', e.target.value)}
                                        >
                                            <option value="">-- Sélectionner une formule --</option>
                                            {FORMULAS.map(f => <option key={f.id} value={f.id}>{f.name} ({f.price}€)</option>)}
                                        </select>
                                    </div>

                                    {/* Choix Options */}
                                    <div className="mb-4">
                                        <label className="text-[10px] uppercase font-bold text-green-800 block mb-1">Options supplémentaires</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {FORMULA_OPTIONS.map(opt => (
                                                <label key={opt.id} className="flex items-center gap-2 text-xs text-stone-700 bg-white p-2 rounded border border-green-100 cursor-pointer hover:bg-green-50">
                                                    <input 
                                                        type="checkbox" 
                                                        disabled={!canEdit}
                                                        checked={(localData.selectedOptions || []).includes(opt.id)}
                                                        onChange={() => toggleOption(opt.id)}
                                                        className="rounded text-green-600 focus:ring-green-500"
                                                    />
                                                    {opt.name} <span className="font-bold ml-auto">+{opt.price}€</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Calcul automatique */}
                                    <div className="flex gap-2 items-end mb-4 pt-4 border-t border-green-200/50">
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase font-bold text-green-800">Prix Total Contrat (€)</label>
                                            <div className="flex gap-2">
                                                <input type="number" disabled={!canEdit} className="w-full p-2 border border-green-200 rounded text-sm outline-none bg-white font-bold" value={localData.totalPrice || 0} onChange={e => updateField('totalPrice', Number(e.target.value))} />
                                                {canEdit && <button onClick={calculateTotalPrice} className="bg-green-600 text-white px-3 rounded text-xs font-bold hover:bg-green-700">Calculer</button>}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase font-bold text-green-800">Acompte Versé (€)</label>
                                            <input type="number" disabled={!canEdit} className="w-full p-2 border border-green-200 rounded text-sm outline-none bg-white" value={localData.depositAmount || 0} onChange={e => updateField('depositAmount', Number(e.target.value))} title="Ce montant bloque la date." />
                                        </div>
                                    </div>
                                    
                                    {((localData.totalPrice || 0) - (localData.depositAmount || 0)) > 0 ? (
                                        <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-200 shadow-sm mb-3">
                                            <span className="text-sm font-bold text-red-600">Solde Jour J : {(localData.totalPrice || 0) - (localData.depositAmount || 0)} €</span>
                                        </div>
                                    ) : null}

                                    {/* Statut Signature */}
                                    {localData.totalPrice && localData.totalPrice > 0 ? (
                                        localData.contractSigned ? (
                                            <div className="pt-3 border-t border-green-200/50 flex items-center gap-2 text-xs font-bold text-green-700">
                                                <CheckCircle2 className="w-4 h-4"/> Contrat signé numériquement le {formatDateFR(localData.contractSignedDate!)}
                                            </div>
                                        ) : (
                                            <div className="pt-3 border-t border-green-200/50 flex items-center justify-between text-xs font-bold text-amber-600">
                                                <span className="flex items-center gap-2 animate-pulse"><AlertTriangle className="w-4 h-4"/> En attente de signature client</span>
                                                <button onClick={printContract} className="bg-white border border-amber-200 text-amber-700 px-2 py-1 rounded shadow-sm hover:bg-amber-50">Aperçu PDF</button>
                                            </div>
                                        )
                                    ) : null}
                                </div>
                            </div>
                        )}
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
                    </div>
                </div>

                {canEdit && (
                    <div className="flex justify-between pt-6 border-t items-center bg-white sticky bottom-0 p-4 rounded-xl shadow-[0_-5px_15px_rgba(0,0,0,0.05)] border-t border-stone-100 mt-4 z-20">
                        <div className="flex gap-2">
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