'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, Ban, ChevronRight, Rocket, Mail, 
  BookOpen, Trash2, Image as ImageIcon, CheckSquare, 
  Upload, Loader2, MapPin, FileText, Users, Calendar, Eye, Timer, Music, Briefcase, History, Archive, RefreshCw, UserCheck, Send, Palette, ExternalLink, HardDrive, Link, Printer, CheckCircle2, ImagePlus, Copy, Wallet, DollarSign, ClipboardList, Clock, Phone, FileSignature, AlertTriangle, ListChecks
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore'; 
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

  const [studioSettings, setStudioSettings] = useState({ formulas: FORMULAS, options: FORMULA_OPTIONS });

  useEffect(() => {
      const fetchSettings = async () => {
          try {
              const snap = await getDoc(doc(db, "settings", "studio_config"));
              if (snap.exists()) {
                  const data = snap.data();
                  setStudioSettings({
                      formulas: data.formulas || FORMULAS,
                      options: data.options || FORMULA_OPTIONS
                  });
              }
          } catch(e) { console.error(e); }
      };
      fetchSettings();
  }, []);

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

  const calculateTotalPrice = () => {
      let total = 0;
      if (localData.selectedFormula) {
          const formula = studioSettings.formulas.find((f:any) => f.id === localData.selectedFormula);
          if (formula) total += formula.price;
      }
      if (localData.selectedOptions) {
          localData.selectedOptions.forEach(optId => {
              const option = studioSettings.options.find((o:any) => o.id === optId);
              if (option) total += option.price;
          });
      }

      if (localData.contractSigned && (localData.totalPrice || 0) !== total) {
          alert("⚠️ ATTENTION : Vous modifiez le tarif d'un contrat déjà signé.\n\nN'oubliez pas de cliquer sur le bouton rouge 'Refaire signer (Avenant)' juste en dessous pour annuler l'ancienne signature et envoyer le nouveau devis au client !");
      }

      updateField('totalPrice', total);
  };

  const resetContract = async () => {
      if(!confirm("Créer un avenant ?\n\nCela effacera la signature actuelle et sauvegardera vos nouvelles modifications (Options/Prix). Le client devra re-signer le contrat.\n\nContinuer ?")) return;
      
      const cleanData = { 
          ...localData, 
          contractSigned: false, 
          contractSignatureData: '', 
          contractSignedDate: '',
          lastUpdated: serverTimestamp() 
      };
      
      setLocalData(cleanData as any);
      
      const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
      try {
          await updateDoc(doc(db, colPath, project.id), cleanData);
          originalDataRef.current = JSON.parse(JSON.stringify(cleanData));
          setHasChanges(false);
          alert("✅ Avenant généré et sauvegardé avec succès ! Le client peut maintenant re-signer le nouveau contrat sur son espace.");
      } catch (e: any) {
          alert(`Erreur: ${e.message}`);
      }
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
          if (old.linkPhoto !== cur.linkPhoto) changes.push(`Lien Galerie ${cur.linkPhoto ? 'MAJ' : 'Supprimé'}`);
          if (old.linkVideo !== cur.linkVideo) changes.push(`Lien Vidéo ${cur.linkVideo ? 'MAJ' : 'Supprimé'}`);
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

  // 👇 PDF OFFICIEL REPRENANT EXACTEMENT VOS TERMES
  const printContract = () => {
      const win = window.open('', '', 'width=900,height=1000');
      if(!win) return;
      
      const formulasHtml = studioSettings.formulas.map((f:any) => {
          const isSelected = localData.selectedFormula === f.id;
          const box = isSelected ? '☑' : '☐';
          return `
            <div style="margin-bottom: 15px; padding: 10px; border: ${isSelected ? '2px solid #111' : '1px solid #eee'}; background: ${isSelected ? '#f9f9f9' : '#fff'}; border-radius: 5px;">
                <div style="font-weight: bold; font-size: 16px;">${box} ${f.name} (${f.price} €)</div>
                <div style="font-size: 12px; color: #555; margin-left: 20px; margin-top: 5px;">${f.details.join(' • ')}</div>
            </div>
          `;
      }).join('');

      const optionsHtml = studioSettings.options.map((o:any) => {
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
              .signature-box { margin-top: 50px; border-top: 1px solid #ccc; padding-top: 20px; display: flex; justify-content: space-between; page-break-inside: avoid; }
              .signature-img { max-width: 250px; max-height: 100px; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
              .terms { font-size: 10px; color: #333; text-align: justify; column-count: 2; column-gap: 30px;}
              .terms h3 { font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-top: 15px; margin-bottom: 5px; }
              .terms p { margin-bottom: 10px; margin-top: 0; }
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
                <h3>ACOMPTE POUR RÉSERVATION</h3>
                <p>Le premier paiement est un acompte qui correspond à 30% de la somme totale. L'acompte n'est pas récupérable. Le paiement est à effectuer lors de la signature du présent contrat. Ainsi la date du mariage sera réservée.</p>

                <h3>GÉNÉRALITÉS</h3>
                <p>Les futurs Mariés déclarent être majeurs et poser librement. Si l'un des futurs époux est mineur, les signatures des parents ou des représentants légaux sont obligatoires. Pour que le Photographe puisse photographier le mariage dans de bonnes conditions, il requiert une consultation finale par téléphone au moins une semaine avant le mariage. Tout ceci dans un soucis de voir ensemble le déroulé de la journée et les derniers détails.</p>
                <p>Le Photographe s'efforcera d'obtenir des clichés de tous les invités mais ne sera pas tenu pour responsable si certaines personnes n'ont pas été photographiées. La prestation du Photographe se déroule d'un seul tenant. Son temps de présence ne peut être fractionné sauf accord préalable. Les Mariés peuvent choisir de passer à une collection supérieure, mais l'inverse n'est pas autorisé. Ce choix doit être fait maximum un mois avant la date du mariage par la signature d'un avenant au contrat.</p>
                <p>Le Photographe s'engage à se munir de matériel en suffisance, en bon état. Il apportera le soin nécessaire à la sauvegarde progressive des cartes mémoires. Il ne sera toutefois pas responsable d'une panne inopinée d'une partie de son matériel, ce cas devant alors être considéré comme force majeure. Lorsque le contrat n'a pas été conclu dans les bureaux, la loi autorise les Mariés à se rétracter pendant 14 jours (Art. L121-29 du Code de la Consommation). En cas de rétractation dans le délai légal, l'acompte sera intégralement restitué. Dans l'éventualité où ce contrat serait rompu par les clients, le Photographe serait libéré d'honorer le présent contrat et garderait les sommes versées jusqu'alors.</p>

                <h3>DROIT À L'IMAGE ET PROPRIÉTÉ INTELLECTUELLE</h3>
                <p>Toute réalisation photographique confère au Photographe, son auteur, des droits de propriété artistique, patrimoniaux et moraux, tels que définis par le Code de la Propriété Intellectuelle. En conséquence, le Photographe et les Mariés devront se consulter mutuellement en cas de besoin d'exploitation des photos. Si les Mariés donnent leur accord, cela inclut la publication ou utilisation des photos à des fins de promotion de l'auteur, ouvrage, expositions, sites web et réseaux sociaux du Photographe. Les Mariés s'engagent à être solidaire du Photographe en cas de préjudice causé, par une utilisation abusive ou détournée des images, par un tiers à son insu.</p>

                <h3>AUTORISATION DE PRISE DE VUE</h3>
                <p>Les Mariés autorisent le Photographe à prendre en photo l'ensemble des invités et personnes présentes. Ils feront leur affaire personnelle d'une éventuelle contestation. Le Photographe s'engage à ne pas faire usage à des fins promotionnelles des photos représentant des invités reconnaissables sans obtenir préalablement l'accord de ces derniers.</p>

                <h3>CHANGEMENT DE DATE ET ANNULATION</h3>
                <p>Aucune annulation ne pourra intervenir du fait du Photographe, excepté les cas de force majeure dûment justifiés. En cas de force majeure, le Photographe s'engage à prendre contact avec un autre Photographe partenaire pour réaliser la prestation. En cas d'impossibilité de trouver une alternative, aucune indemnisation ne pourra être réclamée au Photographe. Ce dernier proposera une nouvelle séance ou procédera au remboursement total. Tout changement de date fait office d'annulation. Si l'annulation est due à un cas de force majeure dûment démontré par les Mariés, l'acompte sera restitué. En cas de météo défavorable affectant les prises de vue, la responsabilité du Photographe ne pourra être engagée.</p>

                <h3>DÉPLACEMENT / LOGEMENT / REPAS / FRAIS</h3>
                <p>Le Photographe (et son équipe) requiert au moins un plat chaud quelle que soit la collection. Selon le lieu, l'hébergement peut être nécessaire. Les Mariés supporteront la charge des dépenses supplémentaires (accès, parking payant). Dans le cas où le Photographe doit rester au delà de ce qui est prévu, chaque heure supplémentaire sera facturée 400 EUROS. Chaque heure commencée est due.</p>
                <p>Les frais de déplacement sont pris en charge par les Mariés. En voiture, le coût kilométrique s'élève à 0,80 cts/km + les frais de péage.</p>

                <h3>STYLE PHOTOGRAPHIQUE ET LIVRAISON</h3>
                <p>En signant ce contrat, les Mariés reconnaissent connaître le style du Photographe. Aucun remboursement ne pourra être effectué sur le style. Le traitement implique un travail de recadrage et de colorimétrie. Toute demande de traitement plus poussée pourra être facturée. Toute réclamation devra être effectuée par LRAR dans les 5 jours de la prestation. Les photos seront traitées dans un délai de trois mois. Le coffret final sera livré dans les trois mois suivant le choix des Mariés. Le Photographe conserve les fichiers HD 12 mois, et la galerie en ligne 6 mois. Une fois livrées, les clients sont responsables de la sauvegarde de leurs images. (TVA non applicable, art 293.B du CGI).</p>
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

  const printOrder = () => {
      const win = window.open('', '', 'width=800,height=600');
      if(!win) return;
      const content = `<html><head><title>Bon de Commande - ${project.code}</title></head><body style="font-family: sans-serif; padding: 40px;"><div style="text-align:center; margin-bottom: 40px;"><h1>RavenTech Studio</h1><p>Bon de Commande / Récapitulatif</p></div><div style="border: 1px solid #ccc; padding: 20px; border-radius: 8px; margin-bottom: 30px;"><h3>Client : ${project.clientNames}</h3><p>Code Projet : <strong>${project.code}</strong></p><p>Date Mariage : ${formatDateFR(project.weddingDate)}</p><p>Email : ${project.clientEmail}</p></div><h3>Commandes & Options :</h3><table style="width: 100%; border-collapse: collapse;"><tr style="background: #f0f0f0;"><th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Désignation</th><th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Statut</th><th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Prix</th></tr>${project.isPriority ? `<tr><td style="border:1px solid #ddd; padding:10px;">Option Fast Track (Prioritaire)</td><td style="border:1px solid #ddd; padding:10px;">Activé</td><td style="border:1px solid #ddd; padding:10px; text-align:right;">290 €</td></tr>` : ''}${(project.albums || []).map(a => `<tr><td style="border:1px solid #ddd; padding:10px;">Album ${a.name} (${a.format})</td><td style="border:1px solid #ddd; padding:10px;">${a.paid ? 'PAYÉ' : 'À RÉGLER'}</td><td style="border:1px solid #ddd; padding:10px; text-align:right;">${a.price} €</td></tr>`).join('')}</table><div style="margin-top: 40px; text-align: right;"><p>Date d'impression : ${new Date().toLocaleDateString()}</p></div><script>window.print();</script></body></html>`;
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
                <div className="hidden lg:flex items-center gap-4 text-xs text-stone-500 border-l border-r border-stone-100 px-4">
                    <div className="flex flex-col items-center w-16 text-center" title="Responsable Dossier"><UserCheck className="w-4 h-4 mb-1 text-purple-400"/><span className="truncate w-full font-bold">{project.managerName || '-'}</span></div>
                    <div className="flex flex-col items-center w-16 text-center" title="Photographe"><Camera className="w-4 h-4 mb-1 text-amber-400"/><span className="truncate w-full font-bold">{project.photographerName || '-'}</span></div>
                    <div className="flex flex-col items-center w-16 text-center" title="Vidéaste"><Video className="w-4 h-4 mb-1 text-blue-400"/><span className="truncate w-full font-bold">{project.videographerName || '-'}</span></div>
                </div>
                <div className="hidden md:block text-sm text-stone-500 font-mono bg-stone-50 px-2 py-1 rounded">{formatDateFR(project.weddingDate)}</div>
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

                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-500"/> Feuille de Route (Jour J)</h4>
                            
                            {localData.questionnaireFilled && (
                                <div className="absolute top-6 right-6 bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3"/> Rempli par le client
                                </div>
                            )}

                            <div className="space-y-5">
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="w-1/3"><label className="text-[10px] uppercase font-bold text-pink-500 flex items-center gap-1"><Clock className="w-3 h-3"/> Heure (Mariée)</label><input disabled={!canEdit} type="time" className="w-full p-2 border rounded bg-stone-50 text-sm" value={localData.prepTimeBride || ''} onChange={e=>updateField('prepTimeBride', e.target.value)} /></div>
                                        <div className="flex-1"><label className="text-[10px] uppercase font-bold text-pink-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> Préparatifs (Mariée)</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 text-sm" placeholder="Où se prépare la mariée ?" value={localData.prepAddressBride || ''} onChange={e=>updateField('prepAddressBride', e.target.value)} /></div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-1/3"><label className="text-[10px] uppercase font-bold text-blue-500 flex items-center gap-1"><Clock className="w-3 h-3"/> Heure (Marié)</label><input disabled={!canEdit} type="time" className="w-full p-2 border rounded bg-stone-50 text-sm" value={localData.prepTimeGroom || ''} onChange={e=>updateField('prepTimeGroom', e.target.value)} /></div>
                                        <div className="flex-1"><label className="text-[10px] uppercase font-bold text-blue-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> Préparatifs (Marié)</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 text-sm" placeholder="Où se prépare le marié ?" value={localData.prepAddressGroom || ''} onChange={e=>updateField('prepAddressGroom', e.target.value)} /></div>
                                    </div>
                                    <div className="flex gap-3 pt-2 border-t border-stone-100">
                                        <div className="w-1/3"><label className="text-[10px] uppercase font-bold text-stone-400 flex items-center gap-1"><Clock className="w-3 h-3"/> Heure Cérémonie</label><input disabled={!canEdit} type="time" className="w-full p-2 border rounded bg-stone-50 text-sm" value={localData.ceremonyTime || ''} onChange={e=>updateField('ceremonyTime', e.target.value)} /></div>
                                        <div className="flex-1"><label className="text-[10px] uppercase font-bold text-stone-400 flex items-center gap-1"><MapPin className="w-3 h-3"/> Adresse Cérémonie</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 text-sm" placeholder="Mairie, Église, Laïque..." value={localData.ceremonyAddress || ''} onChange={e=>updateField('ceremonyAddress', e.target.value)} /></div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-1/3"><label className="text-[10px] uppercase font-bold text-stone-400 flex items-center gap-1"><Clock className="w-3 h-3"/> Heure Soirée</label><input disabled={!canEdit} type="time" className="w-full p-2 border rounded bg-stone-50 text-sm" value={localData.partyTime || ''} onChange={e=>updateField('partyTime', e.target.value)} /></div>
                                        <div className="flex-1"><label className="text-[10px] uppercase font-bold text-stone-400 flex items-center gap-1"><MapPin className="w-3 h-3"/> Adresse Soirée</label><input disabled={!canEdit} className="w-full p-2 border rounded bg-stone-50 text-sm" placeholder="Lieu de réception..." value={localData.partyAddress || ''} onChange={e=>updateField('partyAddress', e.target.value)} /></div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-stone-100 grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                                        <label className="text-[10px] uppercase font-bold text-stone-500 mb-2 block flex items-center gap-1"><Phone className="w-3 h-3"/> Contact Témoin 1</label>
                                        <input disabled={!canEdit} className="w-full p-1.5 border rounded text-xs mb-2 bg-white" placeholder="Nom du témoin" value={localData.witness1Name || ''} onChange={e=>updateField('witness1Name', e.target.value)} />
                                        <input disabled={!canEdit} className="w-full p-1.5 border rounded text-xs bg-white" placeholder="Téléphone" value={localData.witness1Phone || ''} onChange={e=>updateField('witness1Phone', e.target.value)} />
                                    </div>
                                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                                        <label className="text-[10px] uppercase font-bold text-stone-500 mb-2 block flex items-center gap-1"><Phone className="w-3 h-3"/> Contact Témoin 2</label>
                                        <input disabled={!canEdit} className="w-full p-1.5 border rounded text-xs mb-2 bg-white" placeholder="Nom du témoin" value={localData.witness2Name || ''} onChange={e=>updateField('witness2Name', e.target.value)} />
                                        <input disabled={!canEdit} className="w-full p-1.5 border rounded text-xs bg-white" placeholder="Téléphone" value={localData.witness2Phone || ''} onChange={e=>updateField('witness2Phone', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

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
                                    
                                    <div className="mb-4">
                                        <label className="text-[10px] uppercase font-bold text-green-800 block mb-1">Formule choisie</label>
                                        <select 
                                            disabled={!canEdit} 
                                            className="w-full p-2 border border-green-200 rounded text-sm bg-white" 
                                            value={localData.selectedFormula || ''} 
                                            onChange={e => updateField('selectedFormula', e.target.value)}
                                        >
                                            <option value="">-- Sélectionner une formule --</option>
                                            {studioSettings.formulas.map((f:any) => <option key={f.id} value={f.id}>{f.name} ({f.price}€)</option>)}
                                        </select>
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] uppercase font-bold text-green-800 block mb-1">Options supplémentaires</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {studioSettings.options.map((opt:any) => (
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

                                    {localData.totalPrice && localData.totalPrice > 0 ? (
                                        localData.contractSigned ? (
                                            <div className="pt-3 border-t border-green-200/50 flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-green-700">
                                                        <CheckCircle2 className="w-4 h-4"/> Contrat signé le {formatDateFR(localData.contractSignedDate!)}
                                                    </div>
                                                    {canEdit && (
                                                        <button onClick={resetContract} className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-50 text-[10px] font-bold transition">
                                                            Refaire signer (Avenant)
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="pt-3 border-t border-green-200/50 flex items-center justify-between text-xs font-bold text-amber-600">
                                                <span className="flex items-center gap-2 animate-pulse"><AlertTriangle className="w-4 h-4"/> En attente de signature client</span>
                                                <button onClick={printContract} className="bg-white border border-amber-200 text-amber-700 px-2 py-1 rounded shadow-sm hover:bg-amber-50">Aperçu PDF</button>
                                            </div>
                                        )
                                    ) : null}
                                </div>
                                
                                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                    <h5 className="font-bold text-sm text-stone-800 mb-3 flex items-center gap-2"><Users className="w-4 h-4"/> Rémunération Équipe</h5>
                                    <div className="space-y-2 mb-4">
                                        {(localData.teamPayments || []).length === 0 && <p className="text-xs text-stone-400 italic">Aucun paiement enregistré.</p>}
                                        {(localData.teamPayments || []).map((pay, idx) => (
                                            <div key={pay.id} className="flex justify-between items-center bg-white p-2 rounded border border-stone-200 text-sm">
                                                <div>
                                                    <div className="font-bold text-stone-700">{pay.recipient} <span className="text-green-600 ml-2">{pay.amount} €</span></div>
                                                    {pay.note && <div className="text-[10px] text-stone-400">{pay.note}</div>}
                                                </div>
                                                {canEdit && <button onClick={() => removeTeamPayment(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {canEdit && (
                                        <div className="flex flex-col gap-2 pt-3 border-t border-stone-200">
                                            <div className="flex gap-2">
                                                <input className="flex-1 p-2 border rounded text-xs" placeholder="Prénom (Ex: Volkan)" value={newPayment.recipient} onChange={e => setNewPayment({...newPayment, recipient: e.target.value})} />
                                                <input type="number" className="w-24 p-2 border rounded text-xs" placeholder="Montant €" value={newPayment.amount || ''} onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})} />
                                            </div>
                                            <div className="flex gap-2">
                                                <input className="flex-1 p-2 border rounded text-xs" placeholder="Note (Ex: Virement le 15/05)" value={newPayment.note} onChange={e => setNewPayment({...newPayment, note: e.target.value})} />
                                                <button onClick={addTeamPayment} className="bg-stone-800 text-white px-4 py-2 rounded text-xs font-bold hover:bg-black">Ajouter</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-stone-400"/> Suivi Production</h4>
                            
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

                        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-stone-800 flex items-center gap-2"><BookOpen className="w-5 h-5 text-stone-400"/> Albums & Sélection</h4>
                                <button onClick={printOrder} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition"><Printer className="w-3 h-3"/> Bon de Commande</button>
                            </div>
                            
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
                                        <div className="flex flex-col items-center text-amber-600 w-full px-8">
                                            <Loader2 className="w-8 h-8 animate-spin mb-2"/>
                                            <span className="text-xs font-bold uppercase tracking-wider mb-2">Upload en cours... {uploadProgress.current} / {uploadProgress.total}</span>
                                            <div className="w-full h-1.5 bg-amber-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-600 transition-all duration-300" style={{width: `${(uploadProgress.current / Math.max(1, uploadProgress.total)) * 100}%`}}></div>
                                            </div>
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